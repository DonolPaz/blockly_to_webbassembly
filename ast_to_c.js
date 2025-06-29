// ast_to_c.js

/**
 * Convert an array of AST statements into a C source string.
 */
export function programToC(astStatements) {
  const lines = [
    '#include <stdio.h>',
    '',
    'int main(void) {'
  ];

  function genStmt(stmt) {
    switch (stmt.type) {
      case 'VariableDeclaration':
        return `  int ${stmt.name} = ${genExpr(stmt.init)};`;

      case 'ExpressionStatement': {
        const expr = stmt.expression;
        if (expr.type === 'CallExpression') {
          const fn = expr.callee.name;
          const arg = expr.arguments[0];
          const value = genExpr(arg);
          if (fn === 'print_num') {
            return `  printf("%d\\n", ${value});`;
          }
          if (fn === 'print_text') {
            return `  puts(${value});`;
          }
        }
        return `  (void)(${genExpr(expr)});`;
      }

      default:
        throw new Error(`Unhandled stmt: ${stmt.type}`);
    }
  }

  function genExpr(expr) {
    switch (expr.type) {
      case 'Literal':
      case 'LiteralNumber':      // handle numeric literals
        return expr.value.toString();

      case 'LiteralText':        // handle string literals
        // escape backslashes and quotes
        const escaped = expr.value
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"');
        return `"${escaped}"`;

      case 'Identifier':
        return expr.name;

      case 'BinaryExpression':
        return `(${genExpr(expr.left)} + ${genExpr(expr.right)})`;

      default:
        throw new Error(`Unhandled expr: ${expr.type}`);
    }
  }

  for (const stmt of astStatements) {
    lines.push(genStmt(stmt));
  }

  lines.push('  return 0;');
  lines.push('}');
  return lines.join('\n');
}
