import { expect } from 'chai';

import { vueEventHandlerMutator as sut } from '../../../src/mutators/vue-event-handler-mutator.js';
import { allMutators } from '../../../src/mutators/index.js';
import type { NodeMutatorContext } from '../../../src/mutators/index.js';
import {
  expectJSMutation,
  expectNoDuplicateMutations,
} from '../../helpers/expect-mutation.js';

const handler: NodeMutatorContext = {
  isExpressionContext: true,
  templatePosition: { kind: 'on', argument: 'click' },
};

describe(sut.name, () => {
  it('should have name "VueEventHandler"', () => {
    expect(sut.name).eq('VueEventHandler');
  });

  describe('inline statements', () => {
    for (const statement of [
      'x++',
      'select(id)',
      'handle($event)',
      'a && b()',
      'count = 0',
    ]) {
      it(`should empty \`${statement}\` at its root`, () => {
        expectJSMutation(sut, statement, handler, 'undefined');
      });
    }

    it('should not mutate an `undefined` handler', () => {
      expectJSMutation(sut, 'undefined', handler);
    });
  });

  describe('functions', () => {
    it('should replace the expression body of an arrow function, not the function', () => {
      expectJSMutation(sut, '() => x++', handler, '() => undefined');
    });

    it('should replace the expression body of an async arrow function', () => {
      expectJSMutation(
        sut,
        'async () => await save()',
        handler,
        'async () => undefined',
      );
    });

    it('should replace the expression body of an arrow function with parameters', () => {
      expectJSMutation(
        sut,
        '(event) => select(event)',
        handler,
        '(event) => undefined',
      );
    });

    it('should replace the expression body of a parenthesized arrow function', () => {
      expectJSMutation(sut, '(() => x++)', handler, '(() => undefined)');
    });

    it('should leave a block body to BlockStatement', () => {
      expectJSMutation(sut, '() => { x++ }', handler);
      expectJSMutation(sut, '(function () { x++ })', handler);
    });

    it('should not mutate a body that already is `undefined`', () => {
      expectJSMutation(sut, '() => undefined', handler);
    });

    it('should not mutate the body of an arrow function inside an inline statement', () => {
      expectJSMutation(
        sut,
        'items.forEach((item) => item.remove())',
        handler,
        'undefined',
      );
    });
  });

  describe('member handlers', () => {
    it('should replace the call in the body of the synthesized wrapper', () => {
      expectJSMutation(
        sut,
        '(...stryArgs_9fa48) => obj.submit(...stryArgs_9fa48)',
        handler,
        '(...stryArgs_9fa48) => undefined',
      );
    });

    it('should replace the optional call in the body of the synthesized wrapper', () => {
      expectJSMutation(
        sut,
        '(...stryArgs_9fa48) => obj?.handler(...stryArgs_9fa48)',
        handler,
        '(...stryArgs_9fa48) => undefined',
      );
    });

    for (const member of [
      'submit',
      'obj.submit',
      'obj?.handler',
      'obj!.handler',
      'obj.submit as Handler',
    ]) {
      it(`should never replace the root of the member handler \`${member}\``, () => {
        expectJSMutation(sut, member, handler);
      });
    }
  });

  it('should not mutate a directive other than v-on', () => {
    expectJSMutation(sut, 'x++', {
      isExpressionContext: true,
      templatePosition: { kind: 'bind', argument: 'click' },
    });
  });

  it('should not mutate without a template position', () => {
    expectJSMutation(sut, 'x++', { isExpressionContext: true });
    expectJSMutation(sut, '() => x++', { isExpressionContext: true });
  });

  it('should not mutate a nested node', () => {
    expectJSMutation(sut, 'const a = () => x++;', handler);
  });

  for (const code of [
    'x++',
    'select(id)',
    '() => x++',
    '() => { x++ }',
    '(...stryArgs_9fa48) => obj.submit(...stryArgs_9fa48)',
  ]) {
    it(`should not duplicate a mutation of another mutator for \`${code}\``, () => {
      expectNoDuplicateMutations(allMutators, code, handler);
    });
  }
});
