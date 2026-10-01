import { promises as fsPromises } from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

import { expect } from 'chai';
import sinon from 'sinon';
import { notEmpty } from '@stryker-mutator/util';

import { types } from '@babel/core';
import generate from '@babel/generator';

import {
  checkVueCompiler,
  loadVueCompiler,
  parse,
  VueCompilerSfc,
} from '../../../src/parsers/vue-parser.js';
import { parse as htmlParse } from '../../../src/parsers/html-parser.js';
import { createParser } from '../../../src/parsers/index.js';
import { ParserContext } from '../../../src/parsers/parser-context.js';
import {
  AstFormat,
  Range,
  TemplateScript,
  VueAst,
} from '../../../src/syntax/index.js';
import {
  createJSAst,
  createParserOptions,
  createTSAst,
} from '../../helpers/factories.js';
import { parserContextStub } from '../../helpers/stubs.js';
import { resolveTestResource } from '../../helpers/resolve-test-resource.js';

const resolveParserTestResource = resolveTestResource.bind(null, 'parser');

describe('vue-parser', () => {
  let contextStub: sinon.SinonStubbedInstance<ParserContext>;

  beforeEach(() => {
    contextStub = parserContextStub();
  });

  describe('script block classification', () => {
    it('should use a single plain script as the module script', async () => {
      const script = 'const name = "test"';
      contextStub.parse.resolves(createJSAst({ rawContent: script }));

      const actual = await parse(
        `<script>${script}</script><h1>hello!</h1>`,
        'App.vue',
        contextStub,
      );

      expect(actual.format).eq(AstFormat.Vue);
      expect(actual.root.moduleScript!.ast.rawContent).eq(script);
      expect(actual.root.additionalScripts).lengthOf(0);
      expect(actual.root.setup).undefined;
    });

    it('should not use a `<script setup>` as the module script', async () => {
      const script = 'const name = "test"';
      contextStub.parse.resolves(createJSAst({ rawContent: script }));

      const actual = await parse(
        `<script setup>${script}</script><h1>hello!</h1>`,
        'App.vue',
        contextStub,
      );

      expect(actual.root.moduleScript).undefined;
      expect(actual.root.additionalScripts).lengthOf(1);
      expect(actual.root.setup!.script).eq(actual.root.additionalScripts[0]);
    });

    it('should use the plain script as the module script when it comes first', async () => {
      const moduleScript = 'export default {}';
      const setupScript = 'const name = "test"';
      contextStub.parse
        .withArgs(moduleScript)
        .resolves(createJSAst({ rawContent: moduleScript }))
        .withArgs(setupScript)
        .resolves(createJSAst({ rawContent: setupScript }));

      const actual = await parse(
        `<script>${moduleScript}</script><script setup>${setupScript}</script>`,
        'App.vue',
        contextStub,
      );

      expect(actual.root.moduleScript!.ast.rawContent).eq(moduleScript);
      expect(actual.root.additionalScripts).lengthOf(1);
      expect(actual.root.additionalScripts[0].ast.rawContent).eq(setupScript);
      expect(actual.root.setup!.script).eq(actual.root.additionalScripts[0]);
    });

    it('should use the plain script as the module script when `<script setup>` comes first', async () => {
      const moduleScript = 'export default {}';
      const setupScript = 'const name = "test"';
      contextStub.parse
        .withArgs(moduleScript)
        .resolves(createJSAst({ rawContent: moduleScript }))
        .withArgs(setupScript)
        .resolves(createJSAst({ rawContent: setupScript }));

      const actual = await parse(
        `<script setup>${setupScript}</script><script>${moduleScript}</script>`,
        'App.vue',
        contextStub,
      );

      expect(actual.root.moduleScript!.ast.rawContent).eq(moduleScript);
      expect(actual.root.additionalScripts).lengthOf(1);
      expect(actual.root.additionalScripts[0].ast.rawContent).eq(setupScript);
      expect(actual.root.setup!.script).eq(actual.root.additionalScripts[0]);
    });

    it('should mark every script as a non-expression', async () => {
      const script = 'const name = "test"';
      contextStub.parse.resolves(createJSAst({ rawContent: script }));

      const actual = await parse(
        `<script>${script}</script><script setup>${script}</script>`,
        'App.vue',
        contextStub,
      );

      expect(actual.root.moduleScript!.isExpression).false;
      expect(actual.root.additionalScripts[0].isExpression).false;
    });

    it('should classify the `<script setup>` of the AppScriptSetup.vue test resource', async () => {
      const fileName = resolveParserTestResource('AppScriptSetup.vue');
      const content = await fsPromises.readFile(fileName, 'utf8');

      const actual = await parse(content, fileName, realParserContext());

      expect(actual.root.moduleScript).undefined;
      expect(actual.root.additionalScripts).lengthOf(1);
      expect(actual.root.setup!.script).eq(actual.root.additionalScripts[0]);
      expect(actual.root.setup!.lang).undefined;
      expect(actual.root.setup!.script.ast.format).eq(AstFormat.JS);
    });
  });

  describe('lang attribute of `<script setup>`', () => {
    it('should keep the raw lang', async () => {
      const script = 'const name: string = "test"';
      contextStub.parse.resolves(createTSAst({ rawContent: script }));

      const actual = await parse(
        `<script setup lang="ts">${script}</script>`,
        'App.vue',
        contextStub,
      );

      expect(actual.root.setup!.lang).eq('ts');
      expect(actual.root.setup!.script.ast.format).eq(AstFormat.TS);
    });

    it('should keep the raw lang casing', async () => {
      const script = 'const name: string = "test"';
      contextStub.parse.resolves(createTSAst({ rawContent: script }));

      const actual = await parse(
        `<script setup lang="TS">${script}</script>`,
        'App.vue',
        contextStub,
      );

      expect(actual.root.setup!.lang).eq('TS');
      expect(actual.root.setup!.script.ast.format).eq(AstFormat.TS);
    });

    it('should not report a lang when the `<script setup>` has none', async () => {
      const script = 'const name = "test"';
      contextStub.parse.resolves(createJSAst({ rawContent: script }));

      const actual = await parse(
        `<script setup>${script}</script>`,
        'App.vue',
        contextStub,
      );

      expect(actual.root.setup!.lang).undefined;
    });
  });

  describe('script format', () => {
    it('should parse a `lang="tsx"` script as tsx', async () => {
      const script = 'const app = <div />';

      await parse(
        `<script setup lang="tsx">${script}</script>`,
        'App.vue',
        contextStub,
      );

      expect(contextStub.parse).calledWith(script, 'App.vue', AstFormat.Tsx);
    });

    it('should skip a script with a "src" attribute', async () => {
      const actual = await parse(
        '<script setup src="./app.js"></script>',
        'App.vue',
        contextStub,
      );

      expect(contextStub.parse).not.called;
      expect(actual.root.moduleScript).undefined;
      expect(actual.root.additionalScripts).lengthOf(0);
      expect(actual.root.setup).undefined;
    });

    it('should silently skip a script with an unrecognized lang', async () => {
      const actual = await parse(
        '<script setup lang="coffee">x = 1</script>',
        'App.vue',
        contextStub,
      );

      expect(contextStub.parse).not.called;
      expect(actual.root.additionalScripts).lengthOf(0);
      expect(actual.root.setup).undefined;
    });

    it('should parse a script without a lang or type as js', async () => {
      const script = 'const name = "test"';

      await parse(`<script>${script}</script>`, 'App.vue', contextStub);

      expect(contextStub.parse).calledWith(script, 'App.vue', AstFormat.JS);
    });
  });

  it('should keep both blocks of an SFC with two plain scripts', async () => {
    const first = 'export default {}';
    const second = 'window.foo = 42';
    contextStub.parse
      .withArgs(first)
      .resolves(createJSAst({ rawContent: first }))
      .withArgs(second)
      .resolves(createJSAst({ rawContent: second }));

    const actual = await parse(
      `<script>${first}</script><script>${second}</script>`,
      'App.vue',
      contextStub,
    );

    expect(actual.root.moduleScript!.ast.rawContent).eq(first);
    expect(actual.root.additionalScripts).lengthOf(1);
    expect(actual.root.additionalScripts[0].ast.rawContent).eq(second);
    expect(actual.root.setup).undefined;
  });

  it('should report the same script ranges as the html parser', async () => {
    const fileName = resolveParserTestResource('App.vue');
    const content = await fsPromises.readFile(fileName, 'utf8');
    const context = realParserContext();

    const vueAst = await parse(content, fileName, context);
    const htmlAst = await htmlParse(content, fileName, context);

    const expectedRanges: Range[] = htmlAst.root.scripts.map(({ root }) => ({
      start: root.start!,
      end: root.end!,
    }));
    expect(expectedRanges).lengthOf(1);
    expect(
      [vueAst.root.moduleScript, ...vueAst.root.additionalScripts]
        .filter(notEmpty)
        .map(({ range }) => range),
    ).deep.eq(expectedRanges);
  });

  describe('template expressions', () => {
    let context: ParserContext;

    beforeEach(() => {
      context = realParserContext();
    });

    async function parseTemplate(
      template: string,
      scriptSetup = '<script setup>const a = 1;</script>',
    ): Promise<{ vueAst: VueAst; text: string }> {
      const text = `<template>${template}</template>\n${scriptSetup}\n`;
      return { vueAst: await parse(text, 'App.vue', context), text };
    }

    async function parseResource(
      name: string,
      transform = (content: string) => content,
    ): Promise<{ vueAst: VueAst; text: string }> {
      const fileName = resolveParserTestResource(name);
      const text = transform(await fsPromises.readFile(fileName, 'utf8'));
      return { vueAst: await parse(text, fileName, context), text };
    }

    function slices(text: string, scripts: TemplateScript[]): string[] {
      return scripts.map(({ range }) => text.slice(range.start, range.end));
    }

    function expressionOf(script: TemplateScript): types.Expression {
      const [statement] = script.ast.root.program.body;
      return (statement as types.ExpressionStatement).expression;
    }

    describe('group A', () => {
      (
        [
          ['an interpolation', '<p>{{ message }}</p>', 'message', 'Identifier'],
          ['v-if', '<p v-if="a > b"></p>', 'a > b', 'BinaryExpression'],
          [
            'v-else-if',
            '<p v-if="a"></p><p v-else-if="b || c"></p>',
            'b || c',
            'LogicalExpression',
          ],
          ['v-show', '<p v-show="!hidden"></p>', '!hidden', 'UnaryExpression'],
          ['v-html', '<p v-html="html"></p>', 'html', 'Identifier'],
          ['v-text', '<p v-text="`${a}!`"></p>', '`${a}!`', 'TemplateLiteral'],
          [
            'v-bind in full notation',
            '<p v-bind:title="a + b"></p>',
            'a + b',
            'BinaryExpression',
          ],
          [
            'v-bind in shorthand notation',
            '<p :title="a.b"></p>',
            'a.b',
            'MemberExpression',
          ],
          [
            'v-bind of class with an object literal',
            '<p :class="{ active: isActive }"></p>',
            '{ active: isActive }',
            'ObjectExpression',
          ],
          [
            'v-bind of style with an object literal',
            `<p :style="{ color: textColor, 'font-size': size + 'px' }"></p>`,
            `{ color: textColor, 'font-size': size + 'px' }`,
            'ObjectExpression',
          ],
          [
            'v-on in full notation',
            '<p v-on:click="count++"></p>',
            'count++',
            'UpdateExpression',
          ],
          [
            'v-on in shorthand notation',
            '<p @click="select(id)"></p>',
            'select(id)',
            'CallExpression',
          ],
          [
            'the source of v-for',
            '<p v-for="(item, index) in items.slice(1)"></p>',
            'items.slice(1)',
            'CallExpression',
          ],
        ] as const
      ).forEach(([description, template, expected, type]) => {
        it(`should collect ${description}`, async () => {
          const { vueAst, text } = await parseTemplate(template);

          const { templateScripts } = vueAst.root;
          const script = templateScripts[templateScripts.length - 1];
          expect(text.slice(script.range.start, script.range.end)).eq(expected);
          expect(script.isExpression).true;
          expect(expressionOf(script).type).eq(type);
          expect(vueAst.root.templateSkipReason).undefined;
          expect(vueAst.root.templateExpressionSkipReasons).deep.eq([]);
        });
      });

      (
        [
          ['an interpolation', '<p>{{ a }}</p>', { kind: 'interpolation' }],
          ['v-if', '<p v-if="a"></p>', { kind: 'if' }],
          [
            'v-else-if',
            '<p v-if="a"></p><p v-else-if="b"></p>',
            { kind: 'else-if' },
          ],
          ['v-show', '<p v-show="a"></p>', { kind: 'show' }],
          ['v-html', '<p v-html="a"></p>', { kind: 'html' }],
          ['v-text', '<p v-text="a"></p>', { kind: 'text' }],
          ['v-for', '<p v-for="item in items"></p>', { kind: 'for' }],
          [
            'v-bind',
            '<p :disabled="a"></p>',
            { kind: 'bind', argument: 'disabled' },
          ],
          ['v-on', '<p @click="a++"></p>', { kind: 'on', argument: 'click' }],
        ] as const
      ).forEach(([description, template, expected]) => {
        it(`should record the template position of ${description}`, async () => {
          const { vueAst } = await parseTemplate(template);

          const { templateScripts } = vueAst.root;
          expect(
            templateScripts[templateScripts.length - 1].templatePosition,
          ).deep.eq(expected);
        });
      });

      it('should not collect a binding with a dynamic argument, so no argument is recorded for it', async () => {
        /* `directiveExpression` skips a dynamic argument, and the position only records a static one */
        const { vueAst } = await parseTemplate('<p :[disabled]="x"></p>');

        expect(vueAst.root.templateScripts).deep.eq([]);
      });

      it('should not record a template position for a script block', async () => {
        const { vueAst } = await parseTemplate('<p>{{ a }}</p>');

        expect(vueAst.root.additionalScripts[0].templatePosition).undefined;
      });

      it('should derive the quote of a directive from the attribute delimiter', async () => {
        const { vueAst } = await parseTemplate(
          `<p :title="a" :lang='b'>{{ c }}</p>`,
        );

        expect(vueAst.root.templateScripts.map(({ quote }) => quote)).deep.eq([
          '"',
          "'",
          undefined,
        ]);
      });

      it('should skip an unquoted attribute value', async () => {
        const { vueAst } = await parseTemplate('<p :title=a></p>');

        expect(vueAst.root.templateScripts).lengthOf(0);
        expect(vueAst.root.templateExpressionSkipReasons).lengthOf(1);
      });

      it('should skip an expression with an html entity', async () => {
        const { vueAst } = await parseTemplate(
          '<p :title="a &amp;&amp; b">{{ c &lt; d }}</p>',
        );

        expect(vueAst.root.templateScripts).lengthOf(0);
        expect(vueAst.root.templateExpressionSkipReasons).lengthOf(2);
      });

      it('should skip an expression that is not a single expression', async () => {
        const { vueAst } = await parseTemplate('<p v-if="a; b"></p>');

        expect(vueAst.root.templateScripts).lengthOf(0);
        expect(vueAst.root.templateExpressionSkipReasons).lengthOf(1);
      });

      it('should sort the template scripts by their start', async () => {
        const { vueAst } = await parseResource('AppEventHandlers.vue');

        const starts = vueAst.root.templateScripts.map(
          ({ range }) => range.start,
        );
        expect(starts).lengthOf.above(1);
        expect(starts).deep.eq([...starts].sort((a, b) => a - b));
      });

      it('should collect the expressions of the AppMacros.vue test resource', async () => {
        const { vueAst, text } = await parseResource('AppMacros.vue');

        expect(slices(text, vueAst.root.templateScripts)).deep.eq([
          'title',
          'count + 1',
        ]);
      });

      it('should collect the expressions of the AppScriptSetupGeneric.vue test resource', async () => {
        const { vueAst, text } = await parseResource(
          'AppScriptSetupGeneric.vue',
        );

        expect(slices(text, vueAst.root.templateScripts)).deep.eq([
          'items',
          'render(item)',
        ]);
        expect(
          vueAst.root.templateScripts.map(({ ast }) => ast.format),
        ).deep.eq([AstFormat.TS, AstFormat.TS]);
      });
    });

    describe('groups B and C', () => {
      (
        [
          [
            'the aliases of v-for',
            '<p v-for="(item, index) in 42"></p>',
            ['42'],
          ],
          ['the parameters of v-slot', '<Comp v-slot="{ item }"></Comp>'],
          ['v-model', '<input v-model="value">'],
          [':key', '<p :key="id"></p>'],
          [':ref', '<p :ref="el"></p>'],
          ['a custom directive', '<p v-focus="enabled"></p>'],
          ['a dynamic argument', '<p :[name]="value"></p>'],
          ['v-memo', '<p v-memo="[a, b]"></p>'],
          ['a same-name shorthand', '<p :id></p>'],
          ['v-bind without an argument', '<p v-bind="attrs"></p>'],
          ['v-on without an argument', '<p v-on="handlers"></p>'],
          ['v-on with a dynamic argument', '<p @[event]="handler"></p>'],
          ['v-else', '<p v-if="true"></p><p v-else></p>', ['true']],
          ['the subtree of v-pre', '<div v-pre><p v-if="a">{{ b }}</p></div>'],
          ['a directive in front of v-pre', '<p v-if="a" v-pre></p>'],
        ] as ReadonlyArray<[string, string, string[]?]>
      ).forEach(([description, template, collected = []]) => {
        it(`should skip ${description}`, async () => {
          const { vueAst, text } = await parseTemplate(template);

          expect(slices(text, vueAst.root.templateScripts)).deep.eq(collected);
          expect(vueAst.root.templateSkipReason).undefined;
          expect(vueAst.root.templateExpressionSkipReasons).deep.eq([]);
        });
      });
    });

    describe('format', () => {
      it('should parse the expressions as ts when a script is ts', async () => {
        const { vueAst, text } = await parseResource('AppScriptSetupTs.vue');

        expect(slices(text, vueAst.root.templateScripts)).deep.eq([
          'count > 0',
          '(count as number) + 1',
        ]);
        expect(
          vueAst.root.templateScripts.map(({ ast }) => ast.format),
        ).deep.eq([AstFormat.TS, AstFormat.TS]);
      });

      it('should parse the expressions as ts when a script is tsx', async () => {
        const { vueAst } = await parseTemplate(
          '<p>{{ a }}</p>',
          '<script setup lang="tsx">const a = <div />;</script>',
        );

        expect(vueAst.root.templateScripts[0].ast.format).eq(AstFormat.TS);
      });

      it('should parse the expressions as js when no script is ts', async () => {
        const { vueAst } = await parseTemplate('<p>{{ a }}</p>');

        expect(vueAst.root.templateScripts[0].ast.format).eq(AstFormat.JS);
      });
    });

    describe('positions', () => {
      it('should offset an expression on the first line', async () => {
        const { vueAst } = await parseTemplate('<p v-if="visible"></p>');

        const [script] = vueAst.root.templateScripts;
        expect(script.range).deep.eq({ start: 19, end: 26 });
        expect(script.ast.offset).deep.eq({ line: 0, column: 19 });
      });

      it('should offset an expression below the first line', async () => {
        const { vueAst } = await parseTemplate('\n  <p v-if="visible"></p>');

        const [script] = vueAst.root.templateScripts;
        expect(script.ast.offset).deep.eq({ line: 1, column: 11 });
      });

      it('should offset an object literal one character earlier, for the parentheses it was parsed with', async () => {
        const { vueAst, text } = await parseTemplate('<p :class="{ a }"></p>');

        const [script] = vueAst.root.templateScripts;
        expect(script.ast.rawContent).eq('({ a })');
        expect(script.ast.offset).deep.eq({
          line: 0,
          column: text.indexOf('{') - 1,
        });
        expect(expressionOf(script).loc!.start.column).eq(1);
      });

      it('should keep the exact ranges of an SFC with CRLF line endings', async () => {
        const { vueAst, text } = await parseResource('AppCrlf.vue', (content) =>
          content.replace(/\n/g, '\r\n'),
        );

        expect(text).contains('\r\n');
        expect(slices(text, vueAst.root.templateScripts)).deep.eq([
          'visible',
          'message',
        ]);
        expect(vueAst.root.templateScripts[1].ast.offset).deep.eq({
          line: 2,
          column: 7,
        });
      });
    });

    describe('fallback', () => {
      it('should skip the whole template of an SFC without `<script setup>` without a reason', async () => {
        const { vueAst } = await parseResource('AppNoScriptSetup.vue');

        expect(vueAst.root.templateScripts).lengthOf(0);
        expect(vueAst.root.templateSkipReason).undefined;
        expect(vueAst.root.moduleScript).ok;
      });

      it('should skip the whole template when it is written in pug', async () => {
        const { vueAst } = await parseResource('AppTemplatePug.vue');

        expect(vueAst.root.templateScripts).lengthOf(0);
        expect(vueAst.root.templateSkipReason).contains('pug');
        expect(vueAst.root.setup).ok;
      });

      it('should skip the whole template when it is loaded with src', async () => {
        const { vueAst } = await parseResource('AppTemplateSrc.vue');

        expect(vueAst.root.templateScripts).lengthOf(0);
        expect(vueAst.root.templateSkipReason).contains('separate file');
        expect(vueAst.root.setup).ok;
      });

      it('should skip only the expression that cannot be parsed', async () => {
        const { vueAst, text } = await parseResource('AppBrokenExpression.vue');

        expect(vueAst.root.templateSkipReason).undefined;
        expect(slices(text, vueAst.root.templateScripts)).deep.eq(['message']);
        expect(vueAst.root.templateExpressionSkipReasons).lengthOf(1);
        expect(vueAst.root.templateExpressionSkipReasons[0]).contains(
          'could not be parsed',
        );
      });

      it('should keep both plain scripts and skip the template of an SFC with two plain scripts', async () => {
        const { vueAst } = await parseResource('AppTwoScripts.vue');

        expect(vueAst.root.moduleScript!.ast.rawContent).contains(
          'export default',
        );
        expect(vueAst.root.additionalScripts).lengthOf(1);
        expect(vueAst.root.additionalScripts[0].ast.rawContent).contains(
          'window.message',
        );
        expect(vueAst.root.templateScripts).lengthOf(0);
        expect(vueAst.root.templateSkipReason).undefined;
      });

      it('should not report a skip reason for an SFC without a template', async () => {
        const vueAst = await parse(
          '<script setup>const a = 1;</script>',
          'App.vue',
          context,
        );

        expect(vueAst.root.templateScripts).lengthOf(0);
        expect(vueAst.root.templateSkipReason).undefined;
      });
    });

    describe('vue compiler', () => {
      it('should resolve the compiler from the current working directory', async () => {
        const vueVersion = (
          createRequire(import.meta.url)('vue/package.json') as {
            version: string;
          }
        ).version;

        const lookup = await loadVueCompiler();

        expect(lookup.skipReason).undefined;
        expect(lookup.compiler!.version).eq(vueVersion);
      });

      async function createProject(compilerSource: string): Promise<string> {
        const projectRoot = await fsPromises.mkdtemp(
          path.join(os.tmpdir(), 'vue-parser-'),
        );
        const vueDir = path.join(projectRoot, 'node_modules', 'vue');
        await fsPromises.mkdir(vueDir, { recursive: true });
        await fsPromises.writeFile(
          path.join(projectRoot, 'package.json'),
          '{}',
        );
        await fsPromises.writeFile(
          path.join(vueDir, 'package.json'),
          '{ "name": "vue", "version": "3.99.0" }',
        );
        await fsPromises.writeFile(
          path.join(vueDir, 'compiler-sfc.js'),
          compilerSource,
        );
        return projectRoot;
      }

      it('should prefer the compiler of the project over the one of the instrumenter', async () => {
        const projectRoot = await createProject(
          `module.exports = { version: '3.99.0', parse: () => ({ descriptor: { template: null, scriptSetup: null }, errors: [] }) };`,
        );
        process.chdir(projectRoot);

        const { vueAst } = await parseTemplate('<p>{{ a }}</p>');

        expect(vueAst.root.templateScripts).lengthOf(0);
        expect(vueAst.root.templateSkipReason).eq(
          'vue/compiler-sfc 3.99.0 produces an unsupported template AST',
        );
        expect(vueAst.root.setup).ok;
      });

      it('should skip the template when the compiler cannot be loaded', async () => {
        const projectRoot = await createProject(`throw new Error('broken');`);

        const lookup = await loadVueCompiler(projectRoot);

        expect(lookup.compiler).undefined;
        expect(lookup.skipReason).contains('could not be loaded');
      });

      it('should load the compiler once per project root', async () => {
        const first = loadVueCompiler();
        const second = loadVueCompiler();

        expect(first).eq(second);
        expect(await first).eq(await second);
      });

      it('should accept the compiler of this project', async () => {
        const { compiler } = await loadVueCompiler();

        expect(checkVueCompiler(compiler!)).undefined;
      });

      it('should reject a compiler older than 3.4.0', () => {
        const parseStub = sinon.stub();
        const compiler: VueCompilerSfc = {
          version: '3.3.13',
          parse: parseStub,
        };

        expect(checkVueCompiler(compiler)).contains('3.3.13 is not supported');
        expect(parseStub).not.called;
      });

      it('should reject a compiler that produces a template AST without a root node', () => {
        const compiler: VueCompilerSfc = {
          version: '3.4.0',
          parse: () => ({
            descriptor: {
              template: { ast: { type: 1, tag: 'template', children: [] } },
              scriptSetup: null,
            },
            errors: [],
          }),
        };

        expect(checkVueCompiler(compiler)).contains('unsupported template AST');
      });

      it('should reject a compiler that does not parse the source of v-for', () => {
        const compiler: VueCompilerSfc = {
          version: '3.4.0',
          parse: () => ({
            descriptor: {
              template: {
                ast: {
                  type: 0,
                  children: [{ type: 1, props: [{ type: 7, name: 'for' }] }],
                },
              },
              scriptSetup: null,
            },
            errors: [],
          }),
        };

        expect(checkVueCompiler(compiler)).contains('unsupported template AST');
      });
    });

    describe('v-on', () => {
      async function parseHandler(
        handler: string,
        tag = 'button',
      ): Promise<TemplateScript> {
        const { vueAst } = await parseTemplate(
          `<${tag} @click="${handler}"></${tag}>`,
          '<script setup lang="ts">const a = 1;</script>',
        );
        expect(vueAst.root.templateScripts).lengthOf(1);
        return vueAst.root.templateScripts[0];
      }

      function expectLocationOf(node: types.Node, original: types.Node) {
        expect(node.loc).eq(original.loc);
        expect(node.start).eq(original.start);
        expect(node.end).eq(original.end);
      }

      (
        [
          ['an identifier', 'submit', 'Identifier'],
          ['a member expression', 'obj.submit', 'MemberExpression'],
          ['a ts expression', 'obj.submit as any', 'TSAsExpression'],
        ] as const
      ).forEach(([description, handler, originalType]) => {
        it(`should wrap ${description} handler in an arrow function`, async () => {
          const script = await parseHandler(handler);

          const arrow = expressionOf(script) as types.ArrowFunctionExpression;
          expect(arrow.type).eq('ArrowFunctionExpression');
          const call = arrow.body as types.CallExpression;
          expect(call.type).eq('CallExpression');
          const original = call.callee as types.Expression;
          expect(original.type).eq(originalType);
          expect(script.range.end - script.range.start).eq(handler.length);

          const rest = arrow.params[0] as types.RestElement;
          const spread = call.arguments[0] as types.SpreadElement;
          [arrow, rest, rest.argument, call, spread, spread.argument].forEach(
            (node) => expectLocationOf(node, original),
          );
          expect(original.start).eq(0);
          expect(original.end).eq(handler.length);
          expect(script.protectedNodes!.has(arrow)).true;
          expect(script.protectedNodes!.has(call)).true;
          expect(script.protectedNodes!.has(original)).false;
        });
      });

      it('should wrap an optional member handler in an optional call', async () => {
        const script = await parseHandler('obj?.handler');

        const arrow = expressionOf(script) as types.ArrowFunctionExpression;
        const call = arrow.body as types.OptionalCallExpression;
        expect(call.type).eq('OptionalCallExpression');
        expect(call.optional).false;
        expect(call.callee.type).eq('OptionalMemberExpression');
        expect(script.protectedNodes!.has(call.callee)).false;
      });

      (
        [
          [
            'args.submit',
            '(...stryArgs_9fa48) => args.submit(...stryArgs_9fa48)',
          ],
          ['args', '(...stryArgs_9fa48) => args(...stryArgs_9fa48)'],
          [
            'obj?.submit',
            '(...stryArgs_9fa48) => obj?.submit(...stryArgs_9fa48)',
          ],
          [
            'obj!.submit',
            '(...stryArgs_9fa48) => obj!.submit(...stryArgs_9fa48)',
          ],
        ] as const
      ).forEach(([handler, expected]) => {
        it(`should wrap \`${handler}\` with a reserved parameter name`, async () => {
          const script = await parseHandler(handler);

          expect(generate(expressionOf(script)).code).eq(expected);
        });
      });

      it('should protect the root of a function handler without wrapping it', async () => {
        const script = await parseHandler('() => count++');

        const root = expressionOf(script);
        expect(root.type).eq('ArrowFunctionExpression');
        expect(script.protectedNodes!.has(root)).true;
      });

      it('should protect the function inside a ts expression', async () => {
        const script = await parseHandler('(function () {}) as any');

        const root = expressionOf(script) as types.TSAsExpression;
        expect(script.protectedNodes!.has(root)).true;
        expect(script.protectedNodes!.has(root.expression)).true;
      });

      it('should leave an inline statement alone', async () => {
        const script = await parseHandler('count++');

        expect(expressionOf(script).type).eq('UpdateExpression');
        expect(script.protectedNodes).undefined;
      });

      it('should not wrap an `undefined` identifier', async () => {
        const script = await parseHandler('undefined');

        expect(expressionOf(script).type).eq('Identifier');
        expect(script.protectedNodes).undefined;
      });

      it('should skip a handler with more than one statement', async () => {
        const { vueAst } = await parseTemplate(
          '<button @click="first(); second()"></button>',
        );

        expect(vueAst.root.templateScripts).lengthOf(0);
        expect(vueAst.root.templateExpressionSkipReasons).lengthOf(1);
      });

      it('should classify every handler of the AppEventHandlers.vue test resource', async () => {
        const { vueAst, text } = await parseResource('AppEventHandlers.vue');

        expect(slices(text, vueAst.root.templateScripts)).deep.eq([
          'submit',
          'obj.submit',
          'obj?.handler',
          '(obj as any).handler',
          '() => count++',
          'count++',
          'submit',
        ]);
        expect(
          vueAst.root.templateScripts.map(
            (script) => expressionOf(script).type,
          ),
        ).deep.eq([
          'ArrowFunctionExpression',
          'ArrowFunctionExpression',
          'ArrowFunctionExpression',
          'ArrowFunctionExpression',
          'ArrowFunctionExpression',
          'UpdateExpression',
          'ArrowFunctionExpression',
        ]);
        expect(vueAst.root.templateExpressionSkipReasons).lengthOf(1);
      });

      it('should not wrap a member handler on any spelling of Transition and TransitionGroup', async () => {
        const { vueAst, text } = await parseResource(
          'AppTransitionHandlers.vue',
        );

        expect(slices(text, vueAst.root.templateScripts)).deep.eq([
          '() => obj.after()',
        ]);
        expect(vueAst.root.templateExpressionSkipReasons).lengthOf(4);
        vueAst.root.templateExpressionSkipReasons.forEach((reason) =>
          expect(reason).contains('transition'),
        );
      });
    });
  });

  function realParserContext(): ParserContext {
    return { parse: createParser(createParserOptions()) };
  }
});
