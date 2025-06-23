// ast_to_wat.js

/**
 * Convert an array of AST statements into a full WAT module.
 * @param {Array<Object>} astStatements – list of AST nodes (statements).
 * @returns {string} A complete WAT module as a string.
 */
export function programToWat(astStatements) {
  // 1) Module header / prolog
  const lines = [
    '(module',
    '  ;; import the host print function',
    '  (import "env" "print" (func $print (param i32)))',
    '',
    '  ;; main entry point',
    '  (func $main (export "main")'
  ];

  // 2) Insert generated instructions here
  for (const stmt of astStatements) {
    const instrLines = generateStatement(stmt);
    for (const instr of instrLines) {
      lines.push('    ' + instr);
    }
  }

  // 3) Close main and module
  lines.push('  )', ')');
  return lines.join('\n');
}

/**
 * Generate WAT instructions for a single AST statement.
 * @param {Object} stmt – An AST statement node.
 * @returns {Array<string>} List of WAT instruction lines (no indentation).
 */
function generateStatement(stmt) {
  switch (stmt.type) {
    case 'ExpressionStatement':
      // Delegate to expression generator
      return generateExpression(stmt.expression);
    default:
      throw new Error(`Unknown statement type: ${stmt.type}`);
  }
}

/**
 * Generate WAT instructions for an expression AST node.
 * @param {Object} expr – An AST expression node.
 * @returns {Array<string>} List of WAT instruction lines.
 */
function generateExpression(expr) {
  switch (expr.type) {
    case 'Literal':
      // Numeric literal -> push constant on the stack
      return [`i32.const ${expr.value}`];

    case 'CallExpression':
      // Generate code for each argument (they push their values)
      const code = [];
      for (const arg of expr.arguments) {
        code.push(...generateExpression(arg));
      }
      // Call the function (callee.name must match an exported func name)
      code.push(`call $${expr.callee.name}`);
      return code;

    case 'BinaryExpression':
      // first evaluate left & right
      return [
        ...generateExpression(expr.left),
        ...generateExpression(expr.right),
        'i32.add'            
      ];

    default:
      throw new Error(`Unknown expression type: ${expr.type}`);
  }
}
