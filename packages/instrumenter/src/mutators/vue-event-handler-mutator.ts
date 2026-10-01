import * as babel from '@babel/core';
import { type NodePath } from '@babel/core';

import { NodeMutator } from './node-mutator.js';
import { isTemplateExpressionRoot } from '../util/index.js';

const { types } = babel;

/* The TypeScript expressions vue looks through before it classifies a handler */
const TS_WRAPPER_TYPES: ReadonlyArray<babel.types.Node['type']> = Object.freeze(
  [
    'TSAsExpression',
    'TSInstantiationExpression',
    'TSNonNullExpression',
    'TSSatisfiesExpression',
    'TSTypeAssertion',
  ],
);

/**
 * Empties the handler of `v-on`, without changing the way vue classifies it.
 * - An inline statement, like `count++`, is replaced at its root.
 * - A function, like `() => count++`, keeps its root, its expression body is replaced. A block body is left to `BlockStatement`.
 * - A member handler, like `submit`, is wrapped in `(...stryArgs_9fa48) => submit(...stryArgs_9fa48)` by the parser,
 *   which makes it a function, the call in the body is replaced.
 * The root of a function or member handler is never replaced, vue would no longer call the handler.
 */
export const vueEventHandlerMutator: NodeMutator = {
  name: 'VueEventHandler',

  *mutate(path, { templatePosition }) {
    if (templatePosition?.kind !== 'on' || isUndefined(path.node)) {
      return;
    }
    if (isTemplateExpressionRoot(path)) {
      if (isInlineStatement(path.node)) {
        yield types.identifier('undefined');
      }
    } else if (isExpressionBodyOfHandler(path)) {
      yield types.identifier('undefined');
    }
  },
};

function isUndefined(node: babel.types.Node): boolean {
  return types.isIdentifier(node) && node.name === 'undefined';
}

/* The same classification vue does, see `isMemberExpression` and `isFnExpression` of `@vue/compiler-core` */
function isInlineStatement(node: babel.types.Node): boolean {
  const handler = unwrapTSNode(node);
  return !(
    types.isFunction(handler) ||
    types.isMemberExpression(handler) ||
    types.isOptionalMemberExpression(handler) ||
    (types.isIdentifier(handler) && !isUndefined(handler))
  );
}

function isExpressionBodyOfHandler(path: NodePath): boolean {
  const { parentPath } = path;
  if (
    !parentPath?.isArrowFunctionExpression() ||
    parentPath.node.body !== path.node ||
    types.isBlockStatement(path.node)
  ) {
    return false;
  }
  let root: NodePath = parentPath;
  while (root.parentPath && TS_WRAPPER_TYPES.includes(root.parentPath.type)) {
    root = root.parentPath;
  }
  return isTemplateExpressionRoot(root);
}

function unwrapTSNode(node: babel.types.Node): babel.types.Node {
  let current = node;
  while (TS_WRAPPER_TYPES.includes(current.type)) {
    current = (current as babel.types.TSAsExpression).expression;
  }
  return current;
}
