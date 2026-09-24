import { expect } from 'chai';
import {
  expectMetricsJsonToMatchSnapshot,
  readMutationTestingJsonResult,
} from '../../../helpers.js';

/**
 * The number of mutants expected inside the `<template>` block of each component.
 */
const expectedTemplateMutants = Object.freeze({
  'src/TemplatePositions.vue': 21,
  'src/TemplateSkipped.vue': 0,
  'src/EventHandlers.vue': 8,
});

/**
 * @param {string} source
 * @returns {{ start: number, end: number }} the lines of the opening and closing tag of the template block
 */
function templateLines(source) {
  const lines = source.split('\n');
  return {
    start: lines.findIndex((line) => line.startsWith('<template>')) + 1,
    end: lines.findLastIndex((line) => line.startsWith('</template>')) + 1,
  };
}

describe('Verify stryker has ran correctly', () => {
  it('should report correct score', async () => {
    await expectMetricsJsonToMatchSnapshot();
  });

  it('should mutate the expressions of the template', async () => {
    const report = await readMutationTestingJsonResult();
    for (const [fileName, expected] of Object.entries(
      expectedTemplateMutants,
    )) {
      const file = Object.entries(report.files).find(([name]) =>
        name.endsWith(fileName),
      )?.[1];
      expect(file, fileName).ok;
      const { start, end } = templateLines(file.source);
      const templateMutants = file.mutants.filter(
        ({ location }) =>
          location.start.line > start && location.end.line < end,
      );
      expect(templateMutants, fileName).lengthOf(expected);
      for (const mutant of templateMutants) {
        const description = `${fileName} ${mutant.mutatorName} at ${mutant.location.start.line}:${mutant.location.start.column}`;
        expect(mutant.status, description).not.oneOf([
          'RuntimeError',
          'CompileError',
        ]);
        /* A static mutant is covered without a test being known, see the coverage section of the vue guide */
        if (mutant.status !== 'NoCoverage' && !mutant.static) {
          expect(mutant.coveredBy, description).not.empty;
        }
      }
    }
  });
});
