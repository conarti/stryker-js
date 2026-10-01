import * as babel from '@babel/core';

import { NodeMutator } from './node-mutator.js';
import { isTemplateExpressionRoot } from '../util/index.js';

const { types } = babel;

/**
 * Replaces the source of `v-for` with an empty array, so nothing is rendered.
 * An array literal is left to `ArrayDeclaration`.
 */
export const vueForSourceMutator: NodeMutator = {
  name: 'VueForSource',

  *mutate(path, { templatePosition }) {
    if (
      templatePosition?.kind === 'for' &&
      isTemplateExpressionRoot(path) &&
      !path.isArrayExpression()
    ) {
      yield types.arrayExpression([]);
    }
  },
};
