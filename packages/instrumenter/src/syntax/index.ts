import type { types as babelTypes } from '@babel/core';
import { Position } from '@stryker-mutator/api/core';

export enum AstFormat {
  Html = 'html',
  JS = 'js',
  TS = 'ts',
  Tsx = 'tsx',
  Svelte = 'svelte',
  Vue = 'vue',
}

export interface AstByFormat {
  [AstFormat.Html]: HtmlAst;
  [AstFormat.JS]: JSAst;
  [AstFormat.TS]: TSAst;
  [AstFormat.Tsx]: TsxAst;
  [AstFormat.Svelte]: SvelteAst;
  [AstFormat.Vue]: VueAst;
}
export type Ast = HtmlAst | JSAst | SvelteAst | TSAst | TsxAst | VueAst;

export type ScriptFormat = AstFormat.JS | AstFormat.TS | AstFormat.Tsx;
export type ScriptAst = JSAst | TSAst | TsxAst;
export interface BaseAst {
  originFileName: string;
  rawContent: string;
  root: Ast['root'];
  offset?: Position;
}

/**
 * Represents an Html AST.
 */
export interface HtmlAst extends BaseAst {
  format: AstFormat.Html;
  root: HtmlRootNode;
}

/**
 * Represents a TS AST
 */
export interface JSAst extends BaseAst {
  format: AstFormat.JS;
  root: babelTypes.File;
}

/**
 * Represents a TS AST
 */
export interface TSAst extends BaseAst {
  format: AstFormat.TS;
  root: babelTypes.File;
}

/**
 * Represents a TS AST
 */
export interface TsxAst extends BaseAst {
  format: AstFormat.Tsx;
  root: babelTypes.File;
}

/**
 * Represents a Svelte AST
 */
export interface SvelteAst extends BaseAst {
  format: AstFormat.Svelte;
  root: SvelteRootNode;
}

/**
 * Represents a Vue AST
 */
export interface VueAst extends BaseAst {
  format: AstFormat.Vue;
  root: VueRootNode;
}

/**
 * Represents the root node of an HTML AST
 * We've taken a shortcut here, instead of representing the entire AST, we're only representing the script tags.
 * We might need to expand this in the future if we would ever want to support mutating the actual HTML (rather than only the JS/TS)
 */
export interface HtmlRootNode {
  scripts: ScriptAst[];
}

export interface SvelteRootNode {
  moduleScript?: TemplateScript;
  additionalScripts: TemplateScript[];
}

export interface VueRootNode {
  moduleScript?: TemplateScript;
  additionalScripts: TemplateScript[];
  /**
   * Only present when the SFC has a parsed `<script setup>` block.
   * That same block is part of `additionalScripts` as well.
   */
  setup?: VueSetupScript;
  /**
   * The expressions of the `<template>`, sorted by `range.start`.
   */
  templateScripts: TemplateScript[];
  /**
   * Why the whole `<template>` was left alone, when it was.
   */
  templateSkipReason?: string;
  /**
   * Why single template expressions were left alone, one entry per expression.
   */
  templateExpressionSkipReasons: string[];
}

/**
 * A `<script setup>` block, together with the raw value of its `lang` attribute.
 * The format of the block is available as `script.ast.format`.
 */
export interface VueSetupScript {
  script: TemplateScript;
  lang?: string;
}

/**
 * Represents a svelte script or binding expression
 * We've taken a shortcut here, instead of representing the entire AST, we're only representing the script tags and expression bindings.
 */
export interface TemplateScript {
  ast: ScriptAst;
  range: Range;
  isExpression: boolean;
  /**
   * The quote that delimits the attribute value of a template directive.
   * Absent for interpolations and scripts.
   */
  quote?: '"' | "'";
  /**
   * Nodes that should never be mutated, for example the root of a `v-on` handler
   * or the nodes that were synthesized around it.
   */
  protectedNodes?: WeakSet<babelTypes.Node>;
}

export interface Range {
  start: number;
  end: number;
}
