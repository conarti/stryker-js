import { expect } from 'chai';

import { vueDirectiveConditionMutator as sut } from '../../../src/mutators/vue-directive-condition-mutator.js';
import { allMutators } from '../../../src/mutators/index.js';
import type { NodeMutatorContext } from '../../../src/mutators/index.js';
import {
  expectJSMutation,
  expectNoDuplicateMutations,
} from '../../helpers/expect-mutation.js';

function positionOf(
  kind: NonNullable<NodeMutatorContext['templatePosition']>['kind'],
): NodeMutatorContext {
  return { isExpressionContext: true, templatePosition: { kind } };
}

describe(sut.name, () => {
  it('should have name "VueDirectiveCondition"', () => {
    expect(sut.name).eq('VueDirectiveCondition');
  });

  for (const kind of ['if', 'else-if', 'show'] as const) {
    it(`should replace the condition of v-${kind} with true and false`, () => {
      expectJSMutation(sut, 'flag', positionOf(kind), 'true', 'false');
    });
  }

  it('should replace a call with true and false', () => {
    expectJSMutation(sut, 'isOpen(item)', positionOf('if'), 'true', 'false');
  });

  it('should replace a negation with true and false', () => {
    expectJSMutation(sut, '!hidden', positionOf('show'), 'true', 'false');
  });

  for (const kind of ['for', 'html', 'text', 'interpolation', 'on'] as const) {
    it(`should not mutate the expression of ${kind}`, () => {
      expectJSMutation(sut, 'flag', positionOf(kind));
    });
  }

  it('should not mutate a bound attribute', () => {
    expectJSMutation(sut, 'flag', {
      isExpressionContext: true,
      templatePosition: { kind: 'bind', argument: 'disabled' },
    });
  });

  it('should not mutate without a template position', () => {
    expectJSMutation(sut, 'flag', { isExpressionContext: true });
    expectJSMutation(sut, 'flag', { isExpressionContext: false });
  });

  it('should only mutate the root of the expression', () => {
    expectJSMutation(sut, 'a + b', positionOf('if'), 'true', 'false');
    expectJSMutation(sut, 'isOpen(flag)', positionOf('if'), 'true', 'false');
  });

  it('should not mutate a nested node', () => {
    expectJSMutation(sut, 'const a = flag;', positionOf('if'));
  });

  for (const condition of ['a && b', 'a || b', 'a === b', 'a > b']) {
    it(`should leave \`${condition}\` to ConditionalExpression`, () => {
      expectJSMutation(sut, condition, positionOf('if'));
    });
  }

  it('should not mutate a boolean literal, which BooleanLiteral already mutates', () => {
    expectJSMutation(sut, 'true', positionOf('if'));
  });

  for (const condition of ['flag', '!flag', 'a && b', 'true', 'a + b']) {
    it(`should not duplicate a mutation of another mutator for \`${condition}\``, () => {
      expectNoDuplicateMutations(allMutators, condition, positionOf('if'));
    });
  }
});
