import { promises as fsPromises } from 'fs';

import { expect } from 'chai';
import { testInjector } from '@stryker-mutator/test-helpers';

import {
  createHtmlAst,
  createJSAst,
  createRange,
  createTemplateScript,
  createTransformerOptions,
  createTSAst,
  createParserOptions,
  createVueAst,
} from '../helpers/factories.js';
import { createParser } from '../../src/parsers/index.js';
import { resolveTestResource } from '../helpers/resolve-test-resource.js';
import { MutantCollector } from '../../src/transformers/mutant-collector.js';
import { transform } from '../../src/transformers/index.js';
import { AstFormat } from '../../src/syntax/index.js';

describe('transformers integration', () => {
  it('should transform an html file', () => {
    const htmlAst = createHtmlAst();
    htmlAst.root.scripts.push(
      createJSAst({ rawContent: 'const foo = 40 + 2' }),
    );
    const mutantCollector = new MutantCollector();
    transform(htmlAst, mutantCollector, {
      options: createTransformerOptions(),
      mutateDescription: true,
      logger: testInjector.logger,
      isExpressionContext: false,
    });
    expect(mutantCollector.mutants).lengthOf(1);
    expect(htmlAst).matchSnapshot();
  });
  it('should transform a vue file', () => {
    const script = 'const foo = 40 + 2';
    const vueAst = createVueAst({
      rawContent: `<script>${script}</script>`,
      root: {
        moduleScript: createTemplateScript({
          ast: createJSAst({ rawContent: script }),
          range: createRange(8, 8 + script.length),
        }),
        additionalScripts: [],
      },
    });
    const mutantCollector = new MutantCollector();
    transform(vueAst, mutantCollector, {
      options: createTransformerOptions(),
      mutateDescription: true,
      logger: testInjector.logger,
      isExpressionContext: false,
    });
    expect(mutantCollector.mutants).lengthOf(1);
  });
  it('should transform the expressions of a vue template', async () => {
    const fileName = resolveTestResource(
      'instrumenter',
      'vue-template-expressions.vue',
    );
    const vueAst = await createParser(createParserOptions())(
      await fsPromises.readFile(fileName, 'utf8'),
      fileName,
      AstFormat.Vue,
    );
    const templateEndLine = vueAst.rawContent
      .slice(0, vueAst.rawContent.indexOf('</template>'))
      .split('\n').length;
    const mutantCollector = new MutantCollector();
    transform(vueAst, mutantCollector, {
      options: createTransformerOptions(),
      mutateDescription: true,
      logger: testInjector.logger,
      isExpressionContext: false,
    });
    const templateMutants = mutantCollector.mutants
      .filter(
        (mutant) => mutant.toApiMutant().location.start.line < templateEndLine,
      )
      .map(
        ({ mutatorName, replacementCode }) =>
          `${mutatorName}: ${replacementCode}`,
      );
    expect(templateMutants).matchSnapshot();
  });
  it('should transform a js file', () => {
    const jsAst = createJSAst({ rawContent: 'const foo = 40 + 2' });
    const mutantCollector = new MutantCollector();
    transform(jsAst, mutantCollector, {
      options: createTransformerOptions(),
      mutateDescription: true,
      logger: testInjector.logger,
      isExpressionContext: false,
    });
    expect(mutantCollector.mutants).lengthOf(1);
    expect(jsAst).matchSnapshot();
  });
  it('should transform a ts file', () => {
    const tsAst = createTSAst({ rawContent: 'const foo: number = 40 + 2' });
    const mutantCollector = new MutantCollector();
    transform(tsAst, mutantCollector, {
      options: createTransformerOptions(),
      mutateDescription: true,
      logger: testInjector.logger,
      isExpressionContext: false,
    });
    expect(mutantCollector.mutants).lengthOf(1);
    expect(tsAst).matchSnapshot();
  });
});
