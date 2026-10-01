import { expect } from 'chai';

import { vueForSourceMutator as sut } from '../../../src/mutators/vue-for-source-mutator.js';
import { allMutators } from '../../../src/mutators/index.js';
import type { NodeMutatorContext } from '../../../src/mutators/index.js';
import {
  expectJSMutation,
  expectNoDuplicateMutations,
} from '../../helpers/expect-mutation.js';

const forSource: NodeMutatorContext = {
  isExpressionContext: true,
  templatePosition: { kind: 'for' },
};

describe(sut.name, () => {
  it('should have name "VueForSource"', () => {
    expect(sut.name).eq('VueForSource');
  });

  it('should replace the source with an empty array', () => {
    expectJSMutation(sut, 'items', forSource, '[]');
  });

  it('should replace a computed source with an empty array', () => {
    expectJSMutation(sut, 'items.filter(isVisible)', forSource, '[]');
  });

  it('should replace a range with an empty array', () => {
    expectJSMutation(sut, '10', forSource, '[]');
  });

  it('should leave an array literal to ArrayDeclaration', () => {
    expectJSMutation(sut, '[1, 2]', forSource);
  });

  for (const kind of ['if', 'show', 'interpolation', 'on'] as const) {
    it(`should not mutate the expression of ${kind}`, () => {
      expectJSMutation(sut, 'items', {
        isExpressionContext: true,
        templatePosition: { kind },
      });
    });
  }

  it('should not mutate without a template position', () => {
    expectJSMutation(sut, 'items', { isExpressionContext: true });
  });

  it('should not mutate a nested node', () => {
    expectJSMutation(sut, 'const a = items;', forSource);
  });

  for (const source of ['items', '[1, 2]', '[]', 'Array(3)', 'list.slice(1)']) {
    it(`should not duplicate a mutation of another mutator for \`${source}\``, () => {
      expectNoDuplicateMutations(allMutators, source, forSource);
    });
  }
});
