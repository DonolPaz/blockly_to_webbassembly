/**
 * Convert an array of AST statements into a full WAT module.
 * @param {Array<Object>} astStatements – list of AST nodes (statements).
 * @returns {string} A complete WAT module as a string.
 */
export function programToWat(astStatements) {
  const lines = [
    '(module',
    '  (import "env" "print_text" (func $print_text (param i32 i32)))',
    '  (import "env" "print_num" (func $print_num (param i32)))',
    '  (memory (export "memory") 1)',
    ''
  ];

  const dataSegments = [];
  const stringTable = new Map();
  const memoryOffsetRef = { value: 0 };

  // Generate code from statements
  const mainBody = ['  (func $main (export "main")'];
  for (const stmt of astStatements) {
    const instrLines = generateStatement(stmt, {
      stringTable,
      dataSegments,
      memoryOffsetRef
    });
    mainBody.push(...instrLines.map(line => '    ' + line));
  }
  mainBody.push('  )');

  // Emit data segments for string literals
  for (const { offset, value } of dataSegments) {
    lines.push(`  (data (i32.const ${offset}) "${escapeWatString(value)}")`);
  }

  lines.push(...mainBody, ')');
  return lines.join('\n');
}

/**
 * Generate WAT instructions for a single AST statement.
 * @param {Object} stmt – An AST statement node.
 * @param {Object} ctx – Compilation context.
 * @returns {Array<string>} WAT lines
 */
function generateStatement(stmt, ctx) {
  switch (stmt.type) {
    case 'ExpressionStatement':
      return generateExpression(stmt.expression, ctx);
    default:
      throw new Error(`Unknown statement type: ${stmt.type}`);
  }
}

/**
 * Generate WAT instructions for an expression AST node.
 * @param {Object} expr – An AST expression node.
 * @param {Object} ctx – Compilation context.
 * @returns {Array<string>} List of WAT instruction lines.
 */
function generateExpression(expr, ctx) {
  switch (expr.type) {
    case 'LiteralNumber':
      return [`i32.const ${expr.value}`];

    case 'LiteralText': {
      const { stringTable, dataSegments, memoryOffsetRef } = ctx;
      if (!stringTable.has(expr.value)) {
        const offset = memoryOffsetRef.value;
        stringTable.set(expr.value, offset);
        dataSegments.push({ offset, value: expr.value });
        memoryOffsetRef.value += expr.value.length;
      }
      const offset = stringTable.get(expr.value);
      return [`i32.const ${offset}\n    i32.const ${expr.value.length}`]; // pointer to string in memory
    }

    case 'CallExpression': {
      const code = [];
      for (const arg of expr.arguments) {
        code.push(...generateExpression(arg, ctx));
      }
      code.push(`call $${expr.callee.name}`);
      return code;
    }
    case 'BinaryExpression': {
      const opMap = {
        'add': 'i32.add',
        'sub': 'i32.sub',
        'mul': 'i32.mul',
        'div': 'i32.div_s'
      };

      const opInstr = opMap[expr.operator];
      if (!opInstr) {
        throw new Error(`Unsupported binary operator: ${expr.operator}`);
      }

      return [
        ...generateExpression(expr.left, ctx),
        ...generateExpression(expr.right, ctx),
        opInstr
      ];
    }
  }
}

/**
 * Escape special characters in a WAT string literal.
 * @param {string} str
 * @returns {string}
 */
function escapeWatString(str) {
  return str
    .replace(/\\/g, '\\5c')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\0a')
    .replace(/\r/g, '\\0d');
}
