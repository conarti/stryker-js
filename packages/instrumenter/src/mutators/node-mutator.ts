import type { types, NodePath } from '@babel/core';
import { Mutable } from '../mutant.js';
import type { VueTemplatePosition } from '../syntax/index.js';

export interface NodeMutatorContext {
  /** Script source was an expression */
  isExpressionContext: boolean;
  /** Where the expression sits in a vue template, absent everywhere else */
  templatePosition?: VueTemplatePosition;
}

export interface NodeMutator {
  mutate(
    path: NodePath,
    mutateContext: NodeMutatorContext,
  ): Iterable<types.Node>;
  filter?(mutantsInScope: Mutable[]): boolean;
  readonly name: string;
}
