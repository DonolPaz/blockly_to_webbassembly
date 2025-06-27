// ast_to_c.js

/**
 * Convert an array of AST statements into a C source file.
 * @param {Array<Object>} astStatements} – list of AST nodes (statements).
 * @returns {string} Complete C source code as a string.
 */
export function programToC(astStatements) {
  const lines = [];

  // 1) File prolog: includes and declarations
  lines.push('#include <stdint.h>');
  lines.push('#include <stdio.h>');
  lines.push('');

  // 2) Forward declarations for generated functions or main
  lines.push('// Forward declarations');
  lines.push('int32_t generated_main();');
  lines.push('');

  // 3) Generate generated_main function
  lines.push('int32_t generated_main() {');

  // 4) Declare local variables if any
  const varSet = new Set();
  collectVariables(astStatements, varSet);
  for (const name of varSet) {
    lines.push(`    int32_t ${name} = 0;`);
  }
  if (varSet.size) lines.push('');

  // 5) Generate code for each statement
  for (const stmt of astStatements) {
    const stmtLines = generateStatementC(stmt);
    for (const l of stmtLines) {
      lines.push('    ' + l);
    }
  }

  // 6) Return zero by default
  lines.push('    return 0;');
  lines.push('}');
  lines.push('');

  // 7) main() to call generated_main and print return value
  lines.push('int main() {');
  lines.push('    int32_t result = generated_main();');
  lines.push('    printf("Result: %d\n", result);');
  lines.push('    return 0;');
  lines.push('}');

  return lines.join('\n');
}

/**
 * Collect variable names from AST statements
 */
function collectVariables(stmts, varSet) {
  for (const stmt of stmts) {
    if (stmt.type === 'VariableDeclaration') {
      varSet.add(stmt.name);
      collectVariables([stmt.init], varSet);
    } else if (stmt.type === 'ExpressionStatement') {
      collectVariablesFromExpr(stmt.expression, varSet);
    }
  }
}

function collectVariablesFromExpr(expr, varSet) {
  switch (expr.type) {
    case 'Identifier':
      varSet.add(expr.name);
      break;
    case 'BinaryExpression':
      collectVariablesFromExpr(expr.left, varSet);
      collectVariablesFromExpr(expr.right, varSet);
      break;
    case 'CallExpression':
      expr.arguments.forEach(arg => collectVariablesFromExpr(arg, varSet));
      break;
    // Literals: nothing to do
  }
}

/**
 * Generate C statements for a single AST statement.
 */
function generateStatementC(stmt) {
  switch (stmt.type) {
    case 'VariableDeclaration': {
      const initCode = generateExpressionC(stmt.init);
      return [`${stmt.name} = ${initCode};`];
    }
    case 'ExpressionStatement': {
      const expr = stmt.expression;
      if (expr.type === 'CallExpression' && expr.callee.name === 'print') {
        // assume single numeric argument
        const argCode = generateExpressionC(expr.arguments[0]);
        return [`printf("%d\n", ${argCode});`];
      }
      // other expressions as standalone
      return [`${generateExpressionC(expr)};`];
    }
    default:
      throw new Error(`Unknown statement type: ${stmt.type}`);
  }
}

/**
 * Generate a C expression string from an AST expression node.
 */
function generateExpressionC(expr) {
  switch (expr.type) {
    case 'Literal':
      return expr.value.toString();
    case 'Identifier':
      return expr.name;
    case 'BinaryExpression': {
      const left = generateExpressionC(expr.left);
      const right = generateExpressionC(expr.right);
      const opMap = { 'add': '+', 'sub': '-', 'mul': '*', 'div': '/' };
      const op = opMap[expr.operator] || expr.operator;
      return `(${left} ${op} ${right})`;
    }
    case 'CallExpression':
      // assume other calls map to C functions
      const args = expr.arguments.map(a => generateExpressionC(a)).join(', ');
      return `${expr.callee.name}(${args})`;
    default:
      throw new Error(`Unknown expression type: ${expr.type}`);
  }
}
