import { promises as fsPromises } from 'fs';

import { expect } from 'chai';
import sinon from 'sinon';

import { print } from '../../../src/printers/vue-printer.js';
import {
  PrinterContext,
  print as printAny,
} from '../../../src/printers/index.js';
import { parse as parseVue } from '../../../src/parsers/vue-parser.js';
import { createParser } from '../../../src/parsers/index.js';
import { transform } from '../../../src/transformers/index.js';
import { MutantCollector } from '../../../src/transformers/mutant-collector.js';
import { allMutators } from '../../../src/mutators/index.js';
import { AstFormat, VueAst } from '../../../src/syntax/index.js';
import {
  printerContextStub,
  transformerContextStub,
} from '../../helpers/stubs.js';
import {
  createJSAst,
  createParserOptions,
  createRange,
  createTemplateScript,
  createVueAst,
} from '../../helpers/factories.js';
import { resolveTestResource } from '../../helpers/resolve-test-resource.js';

describe('vue-printer', () => {
  let contextStub: sinon.SinonStubbedInstance<PrinterContext>;

  beforeEach(() => {
    contextStub = printerContextStub();
  });

  it('should output the original file when no scripts are found', () => {
    const expectedVue = '<template><h1>hello!</h1></template>';
    const ast = createVueAst({ rawContent: expectedVue });

    const output = print(ast, contextStub);

    expect(output).eq(expectedVue);
    expect(contextStub.print).not.called;
  });

  it('should replace the module script', () => {
    const script = createTemplateScript({
      ast: createJSAst({ rawContent: '1' }),
      range: createRange(8, 9),
    });
    contextStub.print.returns('const name = "test";');
    const ast = createVueAst({
      rawContent: '<script>1</script><h1>hello!</h1>',
      root: { moduleScript: script, additionalScripts: [] },
    });

    const output = print(ast, contextStub);

    expect(output).eq(
      '<script>\nconst name = "test";\n</script><h1>hello!</h1>',
    );
    expect(contextStub.print).calledOnceWithExactly(script.ast, contextStub);
  });

  it('should replace multiple script tags', () => {
    const scripts = [
      createTemplateScript({
        ast: createJSAst({ rawContent: '1' }),
        range: createRange(8, 9),
      }),
      createTemplateScript({
        ast: createJSAst({ rawContent: '2' }),
        range: createRange(32, 33),
      }),
    ];
    contextStub.print
      .withArgs(scripts[0].ast, sinon.match.any)
      .returns('let age = 30;')
      .withArgs(scripts[1].ast, sinon.match.any)
      .returns('let country = "uk";');
    const ast = createVueAst({
      rawContent: '<script>1</script><script setup>2</script>',
      root: { moduleScript: scripts[0], additionalScripts: [scripts[1]] },
    });

    const output = print(ast, contextStub);

    expect(output).eq(
      '<script>\nlet age = 30;\n</script><script setup>\nlet country = "uk";\n</script>',
    );
    expect(contextStub.print).calledTwice;
  });

  it('should order the scripts by range', () => {
    const scripts = [
      createTemplateScript({
        ast: createJSAst({ rawContent: '2' }),
        range: createRange(32, 33),
      }),
      createTemplateScript({
        ast: createJSAst({ rawContent: '1' }),
        range: createRange(8, 9),
      }),
    ];
    contextStub.print
      .withArgs(scripts[0].ast, sinon.match.any)
      .returns('let country = "uk";')
      .withArgs(scripts[1].ast, sinon.match.any)
      .returns('let age = 30;');
    const ast = createVueAst({
      rawContent: '<script>1</script><script setup>2</script>',
      root: { additionalScripts: scripts },
    });

    const output = print(ast, contextStub);

    expect(output).eq(
      '<script>\nlet age = 30;\n</script><script setup>\nlet country = "uk";\n</script>',
    );
  });

  describe('template expressions', () => {
    const parseCode = createParser(createParserOptions());

    for (const fixture of [
      'AppCrlf.vue',
      'AppEventHandlers.vue',
      'AppMacros.vue',
      'AppScriptSetupGeneric.vue',
      'AppScriptSetupTs.vue',
    ]) {
      it(`should leave the template of ${fixture} byte for byte as it was without placed mutants`, async () => {
        const text = await fsPromises.readFile(
          resolveTestResource('parser', fixture),
          'utf8',
        );

        const output = await instrument(
          text,
          allMutators.map(({ name }) => name),
        );

        expect(templateOf(output)).eq(templateOf(text));
      });
    }

    it('should quote new string literals with single quotes in a double quoted attribute', async () => {
      const output = await instrument(
        '<template><p :title="a + b"></p></template>\n' + SCRIPT_SETUP,
      );

      expect(templateOf(output)).eq(
        `<template><p :title="stryMutAct_9fa48('0') ? a - b : (stryCov_9fa48('0'), a + b)"></p></template>`,
      );
    });

    it('should quote new string literals with double quotes in a single quoted attribute', async () => {
      const output = await instrument(
        "<template><p :title='a + b'></p></template>\n" + SCRIPT_SETUP,
      );

      expect(templateOf(output)).eq(
        `<template><p :title='stryMutAct_9fa48("0") ? a - b : (stryCov_9fa48("0"), a + b)'></p></template>`,
      );
    });

    it('should not print `}}` inside an interpolation of an object literal', async () => {
      const output = await instrument(
        '<template><p>{{ { a: { b: c && d } } }}</p></template>\n' +
          SCRIPT_SETUP,
      );

      const interpolation = templateOf(output).slice(
        '<template><p>{{'.length,
        -'}}</p></template>'.length,
      );
      expect(interpolation).not.include('}}');
    });

    it('should print a member handler without placed mutants as it was written', async () => {
      const template =
        '<template><button @click="obj.submit"></button></template>';

      const output = await instrument(`${template}\n${SCRIPT_SETUP}`);

      expect(templateOf(output)).eq(template);
    });

    it('should print the wrapper around a member handler when a mutant is placed in it', async () => {
      const output = await instrument(
        '<template><button @click="items[a + b]"></button></template>\n' +
          SCRIPT_SETUP,
      );

      expect(templateOf(output)).eq(
        `<template><button @click="(...args) => items[stryMutAct_9fa48('0') ? a - b : (stryCov_9fa48('0'), a + b)](...args)"></button></template>`,
      );
    });

    it('should strip the parentheses the parser put around an object literal', async () => {
      const rawContent = '<p :class="{ a: b }"></p>';
      const script = createTemplateScript({
        ast: await parseCode('({ a: b })', 'foo.vue', AstFormat.JS),
        range: createRange(11, 19),
        isExpression: true,
        quote: '"',
      });

      const output = print(
        createVueAst({ rawContent, root: { templateScripts: [script] } }),
        contextStub,
      );

      expect(output).eq(rawContent);
    });

    it('should print the original expression when the printed one contains the quote of the attribute', async () => {
      const rawContent = "<p :title='a'></p>";
      const script = createTemplateScript({
        ast: await parseCode("'x'", 'foo.vue', AstFormat.JS),
        range: createRange(11, 12),
        isExpression: true,
        quote: "'",
      });

      const output = print(
        createVueAst({ rawContent, root: { templateScripts: [script] } }),
        contextStub,
      );

      expect(output).eq(rawContent);
    });

    it('should print the original expression when the printed interpolation contains `}}`', async () => {
      const rawContent = '<p>{{ a }}</p>';
      const script = createTemplateScript({
        ast: await parseCode('"}}"', 'foo.vue', AstFormat.JS),
        range: createRange(6, 7),
        isExpression: true,
      });

      const output = print(
        createVueAst({ rawContent, root: { templateScripts: [script] } }),
        contextStub,
      );

      expect(output).eq(rawContent);
    });

    it('should throw when the printed expression is not an expression statement', async () => {
      const script = createTemplateScript({
        ast: await parseCode('if (a) {}', 'foo.vue', AstFormat.JS),
        range: createRange(6, 7),
        isExpression: true,
      });

      expect(() =>
        print(
          createVueAst({
            rawContent: '<p>{{ a }}</p>',
            root: { templateScripts: [script] },
          }),
          contextStub,
        ),
      ).throws('which is not a single expression statement');
    });

    async function instrument(
      text: string,
      excludedMutations: string[] = [],
    ): Promise<string> {
      const vue: VueAst = await parseVue(text, 'foo.vue', {
        parse: parseCode,
      });
      const context = transformerContextStub();
      context.options.excludedMutations = excludedMutations;
      transform(vue, new MutantCollector(), context);
      return printAny(vue);
    }
  });
});

const SCRIPT_SETUP = '<script setup>\nconst x = 1;\n</script>\n';

function templateOf(text: string): string {
  const start = text.indexOf('<template');
  const closing = '</template>';
  return text.slice(start, text.lastIndexOf(closing) + closing.length);
}
