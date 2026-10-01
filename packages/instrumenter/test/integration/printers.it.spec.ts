import { promises as fsPromises } from 'fs';

import { normalizeWhitespaces } from '@stryker-mutator/util';
import { testInjector } from '@stryker-mutator/test-helpers';
import { expect } from 'chai';

import { createParser } from '../../src/parsers/index.js';
import { print } from '../../src/printers/index.js';
import { transform } from '../../src/transformers/index.js';
import { MutantCollector } from '../../src/transformers/mutant-collector.js';
import {
  createParserOptions,
  createTransformerOptions,
} from '../helpers/factories.js';
import { resolveTestResource } from '../helpers/resolve-test-resource.js';

const resolvePrinterTestResource = resolveTestResource.bind(null, 'printer');

describe('parse and print integration', () => {
  describe('echo', () => {
    it('should leave comments in a typescript file', async () => {
      await actArrangeAndAssert('ts-with-comments.ts');
    });

    async function actArrangeAndAssert(relativeFileName: string) {
      const fileName = resolvePrinterTestResource('echo', relativeFileName);
      const code = await fsPromises.readFile(fileName, 'utf8');
      const parsed = await createParser(createParserOptions())(code, fileName);
      const output = print(parsed);
      expect(normalizeWhitespaces(output)).eq(normalizeWhitespaces(code));
    }
  });
  describe('html', () => {
    it('should be able to print html files with multiple script tags', async () => {
      await actArrangeAndAssert('hello-world');
    });

    async function actArrangeAndAssert(testCase: string) {
      const inputFileName = resolvePrinterTestResource(
        'html',
        `${testCase}.in.html`,
      );
      const outputFileName = resolvePrinterTestResource(
        'html',
        `${testCase}.out.html`,
      );
      const [input, expectedOutput] = await Promise.all([
        fsPromises.readFile(inputFileName, 'utf8'),
        fsPromises.readFile(outputFileName, 'utf8'),
      ]);
      const parsed = await createParser(createParserOptions())(
        input,
        inputFileName,
      );
      const actualOutput = print(parsed);
      expect(normalizeWhitespaces(actualOutput)).eq(
        normalizeWhitespaces(expectedOutput),
      );
    }
  });
  describe('vue', () => {
    it('should only change the template expressions that hold a mutant', async () => {
      const fileName = resolveTestResource(
        'instrumenter',
        'vue-template-expressions.vue',
      );
      const code = await fsPromises.readFile(fileName, 'utf8');
      const parsed = await createParser(createParserOptions())(code, fileName);
      transform(parsed, new MutantCollector(), {
        options: createTransformerOptions(),
        mutateDescription: true,
        logger: testInjector.logger,
        isExpressionContext: false,
      });

      const output = print(parsed);

      const negativeSection = (text: string) =>
        text.slice(text.indexOf('  <section>\n'), text.indexOf('</template>'));
      expect(negativeSection(output)).eq(negativeSection(code));
      /* The member handler is wrapped, so vue keeps calling it while `VueEventHandler` can empty it */
      expect(output).match(
        /<button type="button" @click="\(\.\.\.stryArgs_9fa48\) => stryMutAct_9fa48\('\d+'\) \? undefined : \(stryCov_9fa48\('\d+'\), actions\.reset\(\.\.\.stryArgs_9fa48\)\)">/,
      );
    });
  });
});
