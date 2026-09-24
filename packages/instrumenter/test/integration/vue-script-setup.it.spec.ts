import { promises as fsPromises } from 'fs';

import { testInjector } from '@stryker-mutator/test-helpers';
import { Mutant } from '@stryker-mutator/api/core';
import { expect } from 'chai';
import {
  compileScript,
  compileTemplate,
  parse,
  SFCParseResult,
} from 'vue/compiler-sfc';

import { createInstrumenter, Instrumenter } from '../../src/index.js';
import { createInstrumenterOptions } from '../helpers/factories.js';
import { resolveTestResource } from '../helpers/resolve-test-resource.js';

/**
 * Every SFC with a `<script setup>` block, so that each of them is put through the vue
 * compiler. An SFC of which the `lang` doesn't match between its script blocks, or of which
 * a compiler macro lost its static argument, doesn't make it past `compileScript`.
 */
const scriptSetupFixtures = Object.freeze([
  'vue-script-setup.vue',
  'vue-script-setup-ts.vue',
  'vue-script-setup-macros.vue',
  'vue-script-setup-and-module-script.vue',
  'vue-script-setup-header-per-block.vue',
  'vue-script-setup-bare-define-props.vue',
  'vue-script-setup-bare-define-emits.vue',
  'vue-script-setup-bare-with-defaults.vue',
  'vue-script-setup-first.vue',
  'vue-template-expressions.vue',
  'vue-template-expressions-generic.vue',
  'vue-issue-define-model.vue',
  'vue-issue-define-options.vue',
  'vue-issue-define-props.vue',
]);

type MutantPosition = [
  mutatorName: string,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
];

/**
 * The placed script mutants of the three components of issue #6178, as they were before the template was mutated.
 */
const scriptMutantsBeforeTemplateMutation: Readonly<
  Record<string, MutantPosition[]>
> = Object.freeze({
  'vue-issue-define-model.vue': [
    ['ObjectLiteral', 11, 42, 11, 60],
    ['BooleanLiteral', 11, 53, 11, 58],
    ['StringLiteral', 13, 14, 13, 32],
    ['StringLiteral', 14, 13, 14, 48],
  ],
  'vue-issue-define-options.vue': [
    ['ObjectLiteral', 9, 14, 9, 37],
    ['BooleanLiteral', 9, 30, 9, 35],
    ['StringLiteral', 11, 14, 11, 30],
    ['BooleanLiteral', 12, 17, 12, 21],
    ['StringLiteral', 13, 14, 13, 24],
  ],
  'vue-issue-define-props.vue': [
    ['ObjectLiteral', 8, 26, 12, 1],
    ['ObjectLiteral', 9, 9, 9, 51],
    ['StringLiteral', 9, 34, 9, 49],
    ['ObjectLiteral', 10, 9, 10, 37],
    ['ObjectLiteral', 11, 12, 11, 45],
    ['BooleanLiteral', 11, 38, 11, 43],
  ],
});

describe('vue script setup integration', () => {
  let sut: Instrumenter;

  beforeEach(() => {
    sut = testInjector.injector.injectFunction(createInstrumenter);
  });

  for (const fixture of scriptSetupFixtures) {
    describe(`the instrumented ${fixture}`, () => {
      let parsed: SFCParseResult;

      beforeEach(async () => {
        parsed = parse(await instrument(fixture), { filename: fixture });
      });

      it('should be parsed by the vue compiler without errors', () => {
        expect(parsed.errors).lengthOf(0);
        expect(parsed.descriptor.scriptSetup).ok;
      });

      for (const inlineTemplate of [true, false]) {
        it(`should be compiled by the vue compiler with inlineTemplate ${inlineTemplate}`, () => {
          compileScript(parsed.descriptor, { id: fixture, inlineTemplate });

          expect(parsed.errors).lengthOf(0);
        });
      }

      it('should have a template that is compiled by the vue compiler without errors', () => {
        const { descriptor } = parsed;
        const script = compileScript(descriptor, {
          id: fixture,
          inlineTemplate: false,
        });
        if (!descriptor.template) {
          return;
        }

        const { errors } = compileTemplate({
          id: fixture,
          filename: fixture,
          source: descriptor.template.content,
          compilerOptions: { bindingMetadata: script.bindings },
        });

        expect(errors).lengthOf(0);
      });
    });
  }

  for (const [fixture, expectedMutants] of Object.entries(
    scriptMutantsBeforeTemplateMutation,
  )) {
    it(`should place the same script mutants in ${fixture} as before the template was mutated`, async () => {
      const content = await fsPromises.readFile(
        resolveTestResource('instrumenter', fixture),
        'utf-8',
      );
      const { mutants } = await instrumentFile(fixture);
      const templateEndLine = content
        .slice(0, content.indexOf('</template>'))
        .split('\n').length;

      /* Ignored mutants are left out, only placed mutants are compared with the baseline. */
      const scriptMutants = mutants
        .filter(
          ({ location, status }) =>
            status !== 'Ignored' && location.start.line >= templateEndLine,
        )
        .map(positionOf);

      expect(scriptMutants).deep.eq(expectedMutants);
    });
  }

  describe('the instrumented vue-script-setup-macros.vue', () => {
    let parsed: SFCParseResult;

    beforeEach(async () => {
      parsed = parse(await instrument('vue-script-setup-macros.vue'), {
        filename: 'vue-script-setup-macros.vue',
      });
    });

    it('should hold the instrumentation header in a module level script', () => {
      expect(parsed.descriptor.script).ok;
    });

    for (const inlineTemplate of [true, false]) {
      it(`should keep the model contract of \`defineModel\` with inlineTemplate ${inlineTemplate}`, () => {
        const { content } = compileScript(parsed.descriptor, {
          id: 'vue-script-setup-macros',
          inlineTemplate,
        });

        expect(declaredPropNames(content)).deep.eq(['open', 'openModifiers']);
        expect(content).include('emits: ["update:open"]');
        /* The default of the model is mutation switched, but still defaults to false */
        expect(content).match(
          /default: stryMutAct_9fa48\("\d+"\) \? true : \(stryCov_9fa48\("\d+"\), false\)/,
        );
      });
    }
  });

  for (const [fixture, declaration] of [
    ['vue-script-setup-bare-define-props.vue', 'props:'],
    ['vue-script-setup-bare-define-emits.vue', 'emits:'],
    ['vue-script-setup-bare-with-defaults.vue', 'props:'],
  ]) {
    for (const inlineTemplate of [true, false]) {
      it(`should keep the bare macro statement of the instrumented ${fixture} with inlineTemplate ${inlineTemplate}`, async () => {
        const parsed = parse(await instrument(fixture), { filename: fixture });

        const { content } = compileScript(parsed.descriptor, {
          id: fixture,
          inlineTemplate,
        });

        expect(content).include(declaration);
      });
    }
  }

  it('should instrument vue-script-setup-first.vue byte for byte like the html parser would', async () => {
    const fixture = resolveTestResource(
      'instrumenter',
      'vue-script-setup-first.vue',
    );
    const content = await fsPromises.readFile(fixture, 'utf-8');
    const asHtml = fixture.replace(/\.vue$/, '.html');

    const vueResult = await sut.instrument(
      [{ name: fixture, mutate: true, content }],
      createInstrumenterOptions(),
    );
    const htmlResult = await sut.instrument(
      [{ name: asHtml, mutate: true, content }],
      createInstrumenterOptions(),
    );

    expect(vueResult.files[0].content).eq(htmlResult.files[0].content);
    expect(
      vueResult.mutants.map(({ id, location }) => ({ id, location })),
    ).deep.eq(htmlResult.mutants.map(({ id, location }) => ({ id, location })));
  });

  async function instrument(fileName: string): Promise<string> {
    const { files } = await instrumentFile(fileName);
    return files[0].content;
  }

  async function instrumentFile(fileName: string) {
    const name = resolveTestResource('instrumenter', fileName);
    return sut.instrument(
      [
        {
          name,
          mutate: true,
          content: await fsPromises.readFile(name, 'utf-8'),
        },
      ],
      createInstrumenterOptions(),
    );
  }
});

/**
 * The names of the props the compiler declared, in the order it declared them.
 */
function declaredPropNames(compiledScript: string): string[] {
  return [...compiledScript.matchAll(/^\s*"([\w$]+)":/gm)].map(
    ([, name]) => name,
  );
}

function positionOf({ mutatorName, location }: Mutant): MutantPosition {
  return [
    mutatorName,
    location.start.line,
    location.start.column,
    location.end.line,
    location.end.column,
  ];
}
