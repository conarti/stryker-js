import * as babel from '@babel/core';

import { NodeMutator } from './node-mutator.js';
import {
  isBooleanExpression,
  isTemplateExpressionRoot,
} from '../util/index.js';

const { types } = babel;

/**
 * The boolean attributes of vue, `isBooleanAttr` of `@vue/shared`.
 */
const BOOLEAN_ATTRIBUTES = Object.freeze([
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
]);

/**
 * Replaces the value bound to a boolean attribute, like `:disabled`, with `true` and `false`.
 */
export const vueBooleanBindingMutator: NodeMutator = {
  name: 'VueBooleanBinding',

  *mutate(path, { templatePosition }) {
    if (
      templatePosition?.kind === 'bind' &&
      templatePosition.argument !== undefined &&
      BOOLEAN_ATTRIBUTES.includes(
        templatePosition.argument.replaceAll('-', '').toLowerCase(),
      ) &&
      isTemplateExpressionRoot(path) &&
      !path.isBooleanLiteral() &&
      !isBooleanExpression(path)
    ) {
      yield types.booleanLiteral(true);
      yield types.booleanLiteral(false);
    }
  },
};
