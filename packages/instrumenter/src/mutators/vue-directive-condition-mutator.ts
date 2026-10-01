import * as babel from '@babel/core';

import { NodeMutator } from './node-mutator.js';
import {
  isBooleanExpression,
  isTemplateExpressionRoot,
} from '../util/index.js';

const { types } = babel;

const CONDITION_DIRECTIVES = Object.freeze(['if', 'else-if', 'show']);

/**
 * Replaces the condition of `v-if`, `v-else-if` and `v-show` with `true` and `false`.
 */
export const vueDirectiveConditionMutator: NodeMutator = {
  name: 'VueDirectiveCondition',

  *mutate(path, { templatePosition }) {
    if (
      templatePosition &&
      CONDITION_DIRECTIVES.includes(templatePosition.kind) &&
      isTemplateExpressionRoot(path) &&
      !path.isBooleanLiteral() &&
      !isBooleanExpression(path)
    ) {
      yield types.booleanLiteral(true);
      yield types.booleanLiteral(false);
    }
  },
};
