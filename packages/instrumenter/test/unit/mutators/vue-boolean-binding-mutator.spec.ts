import { expect } from 'chai';

import { vueBooleanBindingMutator as sut } from '../../../src/mutators/vue-boolean-binding-mutator.js';
import { allMutators } from '../../../src/mutators/index.js';
import type { NodeMutatorContext } from '../../../src/mutators/index.js';
import {
  expectJSMutation,
  expectNoDuplicateMutations,
} from '../../helpers/expect-mutation.js';

function binding(argument?: string): NodeMutatorContext {
  return {
    isExpressionContext: true,
    templatePosition: { kind: 'bind', argument },
  };
}

describe(sut.name, () => {
  it('should have name "VueBooleanBinding"', () => {
    expect(sut.name).eq('VueBooleanBinding');
  });

  for (const attribute of [
    'itemscope',
    'allowfullscreen',
    'formnovalidate',
    'ismap',
    'nomodule',
    'novalidate',
    'readonly',
    'async',
    'autofocus',
    'autoplay',
    'controls',
    'default',
    'defer',
    'disabled',
    'inert',
    'loop',
    'open',
    'required',
    'reversed',
    'scoped',
    'seamless',
    'checked',
    'muted',
    'multiple',
    'selected',
    'hidden',
  ]) {
    it(`should replace the value of :${attribute} with true and false`, () => {
      expectJSMutation(sut, 'busy', binding(attribute), 'true', 'false');
    });
  }

  for (const attribute of ['readonly', 'readOnly', 'read-only']) {
    it(`should match :${attribute} without regard to case and hyphens`, () => {
      expectJSMutation(sut, 'busy', binding(attribute), 'true', 'false');
    });
  }

  for (const attribute of ['title', 'value', 'class', 'aria-disabled']) {
    it(`should not mutate the value of :${attribute}`, () => {
      expectJSMutation(sut, 'busy', binding(attribute));
    });
  }

  it('should not mutate a binding without an argument', () => {
    expectJSMutation(sut, 'busy', binding());
  });

  it('should not mutate a directive other than v-bind', () => {
    expectJSMutation(sut, 'busy', {
      isExpressionContext: true,
      templatePosition: { kind: 'on', argument: 'disabled' },
    });
  });

  it('should not mutate without a template position', () => {
    expectJSMutation(sut, 'busy', { isExpressionContext: true });
  });

  it('should not mutate a nested node', () => {
    expectJSMutation(sut, 'const a = busy;', binding('disabled'));
  });

  it('should leave a comparison to ConditionalExpression', () => {
    expectJSMutation(sut, 'count === 0', binding('disabled'));
  });

  it('should not mutate a boolean literal, which BooleanLiteral already mutates', () => {
    expectJSMutation(sut, 'false', binding('disabled'));
  });

  for (const value of ['busy', '!valid', 'count === 0', 'true', 'isBusy()']) {
    it(`should not duplicate a mutation of another mutator for \`${value}\``, () => {
      expectNoDuplicateMutations(allMutators, value, binding('disabled'));
    });
  }
});
