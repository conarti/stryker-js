import type { NodePath } from '@babel/core';

/**
 * Whether the node is the whole expression of a vue template position, rather than a part of it.
 * A template expression is parsed as a program with a single expression statement.
 */
export function isTemplateExpressionRoot(path: NodePath): boolean {
  return Boolean(
    path.parentPath?.isExpressionStatement() &&
    path.parentPath.parentPath?.isProgram(),
  );
}
