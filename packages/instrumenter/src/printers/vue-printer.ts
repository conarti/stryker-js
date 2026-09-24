import { notEmpty } from '@stryker-mutator/util';

import generate from '@babel/generator';
import { types } from '@babel/core';

import { TemplateScript, VueAst } from '../syntax/index.js';

import { Printer } from './index.js';

export const print: Printer<VueAst> = ({ root, rawContent }, context) => {
  let currentIndex = 0;
  let outputText = '';

  const sortedScripts = [
    root.moduleScript,
    ...root.additionalScripts,
    ...root.templateScripts,
  ]
    .filter(notEmpty)
    .sort((a, b) => a.range.start - b.range.start);
  for (const script of sortedScripts) {
    outputText += rawContent.substring(currentIndex, script.range.start);
    if (script.isExpression) {
      outputText +=
        printExpression(script) ??
        rawContent.substring(script.range.start, script.range.end);
    } else {
      outputText += '\n';
      outputText += context.print(script.ast, context);
      outputText += '\n';
    }
    currentIndex = script.range.end;
  }

  outputText += rawContent.substring(currentIndex);

  return outputText;
};

/**
 * Prints a template expression on a single line, with new string literals quoted differently than the attribute value.
 * @returns the code, or `undefined` when it cannot be put back in the template safely
 */
function printExpression({ ast, quote }: TemplateScript): string | undefined {
  const { code } = generate(ast.root, {
    sourceMaps: false,
    concise: true,
    ...(quote && {
      jsescOption: { quotes: quote === '"' ? 'single' : 'double' },
    }),
  });
  if (!code.endsWith(';')) {
    throw new Error(
      `Printing the template expression of ${ast.originFileName} resulted in "${code}", which is not a single expression statement.`,
    );
  }
  let expression = code.slice(0, -1);
  const [statement] = ast.root.program.body;
  /* The parser wrapped an object literal in parentheses, the template doesn't need them */
  if (
    types.isExpressionStatement(statement) &&
    types.isObjectExpression(statement.expression) &&
    expression.startsWith('(') &&
    expression.endsWith(')')
  ) {
    expression = expression.slice(1, -1);
  }
  const forbidden = quote ?? '}}';
  return expression.includes(forbidden) ? undefined : expression;
}
