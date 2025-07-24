/**
 * Convert an array of AST statements into a full WAT module.
 * @param {Array<Object>} astStatements – list of AST nodes (statements).
 * @returns {string} A complete WAT module as a string.
 */
  export function programToWat(astStatements) {
    const usedFeatures = {
      print_text: false,
      print_num: false,
      i32_pow: false,
    };

    const dataSegments = [];
    const stringTable = new Map();
    const memoryOffsetRef = { value: 0 };

    const ctx = {
      stringTable,
      dataSegments,
      memoryOffsetRef,
      usedFeatures,
      locals: new Set(), 
    };

    const lines = ['(module'];

    // Generate code from statements
    const mainBody = ['  (func $main (export "main")'];
    for (const stmt of astStatements) {
      const instrLines = generateStatement(stmt, ctx);
      mainBody.push(...instrLines.map(line => '    ' + line));
    }
    mainBody.push('  )');

    // Add imports only if used
    if (usedFeatures.print_text) {
      lines.push('  (import "env" "print_text" (func $print_text (param i32 i32)))');
    }
    if (usedFeatures.print_num) {
      lines.push('  (import "env" "print_num" (func $print_num (param i32)))');
    }
    if (usedFeatures.i32_pow) {
      lines.push(`
    (func $i32_pow (param $base i32) (param $exp i32) (result i32)
      (local $result i32)
      i32.const 1
      local.set $result
      block
        loop
          local.get $exp
          i32.eqz
          br_if 1
          local.get $result
          local.get $base
          i32.mul
          local.set $result
          local.get $exp
          i32.const 1
          i32.sub
          local.set $exp
          br 0
        end
      end
      local.get $result
    )`);
    }

    lines.push('  (memory (export "memory") 1)');

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
    case 'IfStatement': {
      const lines = [];

      // Generate condition
      lines.push(...generateExpression(stmt.test, ctx));

      lines.push('(if');
      lines.push('  (then');
      for (const innerStmt of stmt.consequent) {
        const innerLines = generateStatement(innerStmt, ctx);
        lines.push(...innerLines.map(line => '    ' + line));
      }
      lines.push('  )');

      if (stmt.alternate) {
        lines.push('  (else');
        for (const innerStmt of stmt.alternate) {
          const innerLines = generateStatement(innerStmt, ctx);
          lines.push(...innerLines.map(line => '    ' + line));
        }
        lines.push('  )');
      }

      lines.push(')'); // close (if ...)
      return lines;
    }
    case 'VariableDeclaration': {
      ctx.locals.add(stmt.name); // track defined variables
      console.log( "variable dec:" + stmt.name);
      const lines = [];
      lines.push(`(local $${stmt.name} i32)`);
      lines.push(...generateExpression(stmt.value, ctx));
      lines.push(`local.set $${stmt.name}`);
      return lines;
    }

    case 'RepeatStatement': {
      const lines = [];
      // Declare a local counter variable (i32)
      lines.push('(local $counter i32)');
      // Initialize counter to 0
      lines.push('i32.const 0');
      lines.push('local.set $counter');

      // Outer block for break
      lines.push('(block $break');
      // Loop label
      lines.push('  (loop $loop');

      // Get current counter and times, compare counter < times
      lines.push('    local.get $counter');
      lines.push(...generateExpression(stmt.times, ctx));
      lines.push('    i32.ge_s');      // condition: counter < times
      lines.push('    br_if $break');  // break if counter >= times

      // Loop body
      for (const innerStmt of stmt.body) {
        const innerLines = generateStatement(innerStmt, ctx);
        lines.push(...innerLines.map(line => '    ' + line));
      }

      // Increment counter
      lines.push('    local.get $counter');
      lines.push('    i32.const 1');
      lines.push('    i32.add');
      lines.push('    local.set $counter');

      // Jump back to start of loop
      lines.push('    br $loop');

      // Close loop and block
      lines.push('  )');
      lines.push(')');

      return lines;
    }

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
      if (expr.callee.name === "print_text") {
        ctx.usedFeatures.print_text = true;
      } else if (expr.callee.name === "print_num") {
        ctx.usedFeatures.print_num = true;
      }
      for (const arg of expr.arguments) {
        code.push(...generateExpression(arg, ctx));
      }
      code.push(`call $${expr.callee.name}`);
      return code;
    }
    case 'Identifier': {
      console.log( "variable identifier:" + expr.name);
      if (!ctx.locals.has(expr.name)) {
        throw new Error(`Undefined variable ${expr.name}`);
      }
      return [`local.get $${expr.name}`];
    }

    case 'BinaryExpression': {
      const opMap = {
        add: 'i32.add',
        sub: 'i32.sub',
        mul: 'i32.mul',
        div: 'i32.div_s',
        eq: 'i32.eq',
        ne: 'i32.ne',
        lt_s: 'i32.lt_s',
        gt_s: 'i32.gt_s',
        le_s: 'i32.le_s',
        ge_s: 'i32.ge_s',
        and: 'i32.and',   // and
        or: 'i32.or',     // or
      };
      if (expr.operator === 'pow') {
        ctx.usedFeatures.i32_pow = true;
        return [
          ...generateExpression(expr.left, ctx),
          ...generateExpression(expr.right, ctx),
          'call $i32_pow'
        ];
    }
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
