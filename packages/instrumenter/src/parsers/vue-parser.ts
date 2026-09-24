import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

import { types } from '@babel/core';
import { satisfies } from 'semver';

import {
  AstFormat,
  ScriptAst,
  TemplateScript,
  VueAst,
  VueRootNode,
  VueSetupScript,
} from '../syntax/index.js';
import { PositionConverter } from '../util/index.js';

import { collectScriptBlocks } from './html-parser.js';
import { ParserContext } from './parser-context.js';

export const MIN_VUE_VERSION = '>=3.4.0';

/**
 * The part of `vue/compiler-sfc` this parser uses. The types are declared here,
 * because `vue` is not a dependency of this package.
 */
export interface VueCompilerSfc {
  version: string;
  parse(source: string, options: VueParseOptions): VueParseResult;
}

interface VueParseOptions {
  filename: string;
  sourceMap: false;
}

interface VueCompilerError {
  code?: number;
  message: string;
}

interface VueParseResult {
  descriptor: {
    template: {
      lang?: string;
      src?: string;
      ast?: VueTemplateNode;
    } | null;
    scriptSetup: object | null;
  };
  errors: VueCompilerError[];
}

interface VueSourceLocation {
  start: { offset: number };
  end: { offset: number };
}

interface VueExpressionNode {
  content: string;
  isStatic?: boolean;
  loc: VueSourceLocation;
}

interface VueDirectiveNode {
  type: number;
  name: string;
  exp?: VueExpressionNode;
  arg?: VueExpressionNode;
  forParseResult?: { source: VueExpressionNode };
}

interface VueTemplateNode {
  type: number;
  tag?: string;
  props?: VueDirectiveNode[];
  children?: VueTemplateNode[];
  content?: VueExpressionNode;
}

/* The values of `NodeTypes` of `@vue/compiler-core`, which is a const enum */
const NODE_TYPE_ROOT = 0;
const NODE_TYPE_ELEMENT = 1;
const NODE_TYPE_INTERPOLATION = 5;
const NODE_TYPE_DIRECTIVE = 7;

const EXPRESSION_DIRECTIVES = Object.freeze([
  'if',
  'else-if',
  'show',
  'html',
  'text',
]);
const EXCLUDED_BIND_ARGUMENTS = Object.freeze(['key', 'ref']);
const TRANSITION_TAGS = Object.freeze([
  'Transition',
  'transition',
  'TransitionGroup',
  'transition-group',
]);
const TS_WRAPPER_TYPES: ReadonlyArray<types.Node['type']> = Object.freeze([
  'TSAsExpression',
  'TSInstantiationExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
]);
const HTML_ENTITY = /&(?:#\d+|#x[\da-f]+|[a-z][\da-z]*);/i;
const SHAPE_CHECK_SNIPPET =
  '<template><li v-for="item in items"></li></template>';
const INVALID_EXPRESSION_SNIPPET = '<template><p v-if="a +"></p></template>';

interface CompilerLookup {
  compiler?: VueCompilerSfc;
  /**
   * The error code the compiler reports for an expression it cannot parse.
   * Such an expression is skipped on its own, not with the whole template.
   */
  invalidExpressionCode?: number;
  skipReason?: string;
}

const compilersByRoot = new Map<string, Promise<CompilerLookup>>();

/**
 * Parses a Vue SFC. The script blocks are collected like the html parser does,
 * the expressions of the template are collected with `vue/compiler-sfc` of the project.
 */
export async function parse(
  text: string,
  fileName: string,
  context: ParserContext,
): Promise<VueAst> {
  const scriptBlocks = await collectScriptBlocks(text, fileName, context);

  let moduleScript: TemplateScript | undefined;
  let setup: VueSetupScript | undefined;
  const additionalScripts: TemplateScript[] = [];

  for (const block of scriptBlocks) {
    const script: TemplateScript = {
      ast: block.ast,
      range: block.range,
      isExpression: false,
    };
    /* The instrumentation header has to end up in a module level script, so a `<script setup>` can never be one */
    if (!moduleScript && !block.isSetup) {
      moduleScript = script;
    } else {
      additionalScripts.push(script);
    }
    if (block.isSetup && !setup) {
      setup = { script, lang: block.lang };
    }
  }

  const expressionFormat = scriptBlocks.some(
    ({ ast }) => ast?.format === AstFormat.TS || ast?.format === AstFormat.Tsx,
  )
    ? AstFormat.TS
    : AstFormat.JS;
  const template = await collectTemplateScripts(
    text,
    fileName,
    context,
    expressionFormat,
  );

  const root: VueRootNode = {
    moduleScript,
    additionalScripts,
    setup,
    ...template,
  };

  return {
    originFileName: fileName,
    rawContent: text,
    format: AstFormat.Vue,
    root,
  };
}

/**
 * Resolves `vue/compiler-sfc` from the root of the project under test rather than from this package,
 * so the version the project compiles with is the one that is used.
 */
export function loadVueCompiler(
  projectRoot = process.cwd(),
): Promise<CompilerLookup> {
  let lookup = compilersByRoot.get(projectRoot);
  if (!lookup) {
    lookup = importVueCompiler(projectRoot);
    compilersByRoot.set(projectRoot, lookup);
  }
  return lookup;
}

async function importVueCompiler(projectRoot: string): Promise<CompilerLookup> {
  let compiler: VueCompilerSfc;
  try {
    const resolved = createRequire(
      pathToFileURL(path.join(projectRoot, 'package.json')),
    ).resolve('vue/compiler-sfc');
    const module = (await import(pathToFileURL(resolved).href)) as {
      default?: VueCompilerSfc;
    } & VueCompilerSfc;
    compiler = module.default ?? module;
  } catch {
    return {
      skipReason: `vue/compiler-sfc could not be loaded from ${projectRoot}`,
    };
  }
  const skipReason = checkVueCompiler(compiler);
  if (skipReason) {
    return { skipReason };
  }
  const invalidExpressionCode = compiler.parse(
    INVALID_EXPRESSION_SNIPPET,
    parseOptions('invalid-expression-check.vue'),
  ).errors[0]?.code;
  return { compiler, invalidExpressionCode };
}

/**
 * Checks that the compiler is recent enough, both by its version and by the shape of the template AST it produces.
 * @returns the reason the compiler cannot be used, or `undefined` when it can
 */
export function checkVueCompiler(compiler: VueCompilerSfc): string | undefined {
  if (!satisfies(compiler.version, MIN_VUE_VERSION)) {
    return `vue/compiler-sfc ${compiler.version} is not supported, expected ${MIN_VUE_VERSION}`;
  }
  /* Before 3.4 the template AST has no root node and `v-for` has no parsed source */
  const { descriptor } = compiler.parse(
    SHAPE_CHECK_SNIPPET,
    parseOptions('shape-check.vue'),
  );
  const ast = descriptor.template?.ast;
  const forDirective = ast?.children?.[0]?.props?.find(
    (prop) => prop.type === NODE_TYPE_DIRECTIVE && prop.name === 'for',
  );
  if (ast?.type !== NODE_TYPE_ROOT || !forDirective?.forParseResult?.source) {
    return `vue/compiler-sfc ${compiler.version} produces an unsupported template AST`;
  }
  return undefined;
}

/* Built in one place, so the compiler's parse cache is hit when the same file is parsed again */
function parseOptions(filename: string): VueParseOptions {
  return { filename, sourceMap: false };
}

interface CollectedTemplate {
  templateScripts: TemplateScript[];
  templateSkipReason?: string;
  templateExpressionSkipReasons: string[];
}

interface TemplateExpression {
  node: VueExpressionNode;
  /** The offset of the quote around the attribute value, absent for an interpolation */
  quoteOffset?: number;
  isEventHandler: boolean;
  isOnTransition: boolean;
}

async function collectTemplateScripts(
  text: string,
  fileName: string,
  context: ParserContext,
  format: AstFormat.JS | AstFormat.TS,
): Promise<CollectedTemplate> {
  const templateScripts: TemplateScript[] = [];
  const templateExpressionSkipReasons: string[] = [];
  const skipTemplate = (templateSkipReason: string): CollectedTemplate => ({
    templateScripts,
    templateSkipReason,
    templateExpressionSkipReasons,
  });

  const { compiler, invalidExpressionCode, skipReason } =
    await loadVueCompiler();
  if (!compiler) {
    return skipTemplate(skipReason!);
  }
  let result: VueParseResult;
  try {
    result = compiler.parse(text, parseOptions(fileName));
  } catch (error) {
    return skipTemplate(`the SFC could not be parsed: ${String(error)}`);
  }
  const { descriptor } = result;
  const errors = result.errors.filter(
    ({ code }) => code === undefined || code !== invalidExpressionCode,
  );
  if (errors.length) {
    return skipTemplate(`the SFC has parse errors: ${errors[0].message}`);
  }
  const { template } = descriptor;
  if (!template) {
    return { templateScripts, templateExpressionSkipReasons };
  }
  if (!descriptor.scriptSetup) {
    return skipTemplate('the SFC has no <script setup>');
  }
  if (template.lang && template.lang !== 'html') {
    return skipTemplate(
      `the template language "${template.lang}" is not supported`,
    );
  }
  if (template.src || !template.ast) {
    return skipTemplate('the template is loaded from a separate file');
  }

  const positionConverter = new PositionConverter(text);
  const expressions: TemplateExpression[] = [];
  collectExpressions(template.ast, expressions);
  for (const expression of expressions) {
    const outcome = await toTemplateScript(expression);
    if (typeof outcome === 'string') {
      templateExpressionSkipReasons.push(outcome);
    } else {
      templateScripts.push(outcome);
    }
  }
  templateScripts.sort((a, b) => a.range.start - b.range.start);
  return { templateScripts, templateExpressionSkipReasons };

  /**
   * @returns the template script, or the reason the expression was skipped
   */
  async function toTemplateScript({
    node,
    quoteOffset,
    isEventHandler,
    isOnTransition,
  }: TemplateExpression): Promise<TemplateScript | string> {
    const { start, end } = {
      start: node.loc.start.offset,
      end: node.loc.end.offset,
    };
    const where = `${fileName}:${start}`;
    const slice = text.slice(start, end);
    if (slice !== node.content || HTML_ENTITY.test(node.content)) {
      return `${where} the expression contains an html entity`;
    }
    let quote: '"' | "'" | undefined;
    if (quoteOffset !== undefined) {
      const delimiter = text[quoteOffset];
      if (delimiter !== '"' && delimiter !== "'") {
        return `${where} the attribute value is not quoted`;
      }
      quote = delimiter;
    }
    /* An object literal is parsed as a block, the parentheses make it an expression, the offset starts one character earlier to compensate */
    const isObjectLiteral = slice.trimStart().startsWith('{');
    const codeStart = isObjectLiteral ? start - 1 : start;
    let ast: ScriptAst;
    try {
      ast = await context.parse(
        isObjectLiteral ? `(${slice})` : slice,
        fileName,
        format,
      );
    } catch (error) {
      return `${where} the expression could not be parsed: ${String(error)}`;
    }
    const statements = ast.root.program.body;
    const statement = statements[0];
    if (statements.length !== 1 || !types.isExpressionStatement(statement)) {
      return `${where} the expression is not a single expression`;
    }
    let protectedNodes: WeakSet<types.Node> | undefined;
    if (isEventHandler) {
      const original = statement.expression;
      const handler = unwrapTSNode(original);
      if (isMemberHandler(handler)) {
        if (isOnTransition) {
          return `${where} the handler of a transition hook cannot be wrapped`;
        }
        const { arrow, call } = wrapMemberHandler(original, handler);
        statement.expression = arrow;
        protectedNodes = new WeakSet([arrow, call]);
      } else if (types.isFunction(handler)) {
        protectedNodes = new WeakSet([original, handler]);
      }
    }
    return {
      ast: { ...ast, offset: positionConverter.positionFromOffset(codeStart) },
      range: { start, end },
      isExpression: true,
      ...(quote && { quote }),
      ...(protectedNodes && { protectedNodes }),
    };
  }
}

function collectExpressions(
  node: VueTemplateNode,
  expressions: TemplateExpression[],
): void {
  if (node.type === NODE_TYPE_INTERPOLATION && node.content) {
    expressions.push({
      node: node.content,
      isEventHandler: false,
      isOnTransition: false,
    });
  }
  if (node.type === NODE_TYPE_ELEMENT) {
    const isOnTransition = TRANSITION_TAGS.includes(node.tag!);
    for (const prop of node.props ?? []) {
      const expression = directiveExpression(prop);
      if (expression) {
        expressions.push({
          node: expression,
          quoteOffset: prop.exp!.loc.start.offset - 1,
          isEventHandler: prop.name === 'on',
          isOnTransition,
        });
      }
    }
  }
  node.children?.forEach((child) => collectExpressions(child, expressions));
}

/**
 * Picks the expression of a directive that can be mutated, `undefined` for everything else.
 * Directives under `v-pre` are attributes in the AST, so they never get here.
 */
function directiveExpression(
  prop: VueDirectiveNode,
): VueExpressionNode | undefined {
  if (prop.type !== NODE_TYPE_DIRECTIVE || !prop.exp) {
    return undefined;
  }
  if (prop.name === 'for') {
    return prop.forParseResult?.source;
  }
  if (EXPRESSION_DIRECTIVES.includes(prop.name)) {
    return prop.exp;
  }
  if (prop.name === 'bind' || prop.name === 'on') {
    /* `arg` is `undefined` for `v-bind="obj"`, so it's checked before `isStatic` */
    if (prop.arg === undefined || !prop.arg.isStatic) {
      return undefined;
    }
    if (
      prop.name === 'bind' &&
      EXCLUDED_BIND_ARGUMENTS.includes(prop.arg.content)
    ) {
      return undefined;
    }
    return prop.exp;
  }
  return undefined;
}

/* The same unwrapping vue does before it classifies a handler */
function unwrapTSNode(node: types.Expression): types.Expression {
  let current = node;
  while (TS_WRAPPER_TYPES.includes(current.type)) {
    current = (current as types.TSAsExpression).expression;
  }
  return current;
}

function isMemberHandler(node: types.Expression): boolean {
  return (
    types.isMemberExpression(node) ||
    types.isOptionalMemberExpression(node) ||
    (types.isIdentifier(node) && node.name !== 'undefined')
  );
}

/**
 * Builds `(...args) => original(...args)`, so vue keeps calling the handler once a mutation switch is placed around it.
 * The synthesized nodes get the location of the original, mutants in them report the range of the attribute value.
 */
function wrapMemberHandler(
  original: types.Expression,
  handler: types.Expression,
): { arrow: types.ArrowFunctionExpression; call: types.Expression } {
  const spreadArgs = [types.spreadElement(types.identifier('args'))];
  const call = types.isOptionalMemberExpression(handler)
    ? types.optionalCallExpression(original, spreadArgs, false)
    : types.callExpression(original, spreadArgs);
  const arrow = types.arrowFunctionExpression(
    [types.restElement(types.identifier('args'))],
    call,
  );
  for (const node of [arrow, arrow.params[0], call, ...call.arguments]) {
    copyLocation(node, original);
    if (types.isRestElement(node) || types.isSpreadElement(node)) {
      copyLocation(node.argument, original);
    }
  }
  return { arrow, call };
}

function copyLocation(node: types.Node, original: types.Node): void {
  node.loc = original.loc;
  node.start = original.start;
  node.end = original.end;
}
