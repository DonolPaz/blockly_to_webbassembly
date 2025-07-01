// main.js
import { programToWat } from './ast_to_wat.js';

let workspace;

window.compileAndRun = async function compileAndRun() {
  // 1) Build AST and generate WAT
  const topBlocks = workspace.getTopBlocks(true);
  const ast       = topBlocks.map(blockToAST);
  const watSource = programToWat(ast);

  console.log('Generated WAT:\n', watSource);

  // 2) Show WAT in the <pre>
  document.getElementById('output').textContent = watSource;

  // 3) Load WABT 
  const wabt = await window.WabtModule();

  // 4) Parse WAT → binary
  const wasmModule = wabt.parseWat('generated.wat', watSource);
  const { buffer } = wasmModule.toBinary({ log: true });


  const importObject = {
    env: {
      print_text: (ptr, len) => {
        const memory = instance.exports.memory; // use the real memory
        const bytes = new Uint8Array(memory.buffer, ptr, len);
        const text = new TextDecoder('utf8').decode(bytes);
        alert('WASM print: ' + text);
      },
      print_num: (num) => {
        alert('WASM print: ' + num);
      }
    }
  };
  const { instance } = await WebAssembly.instantiate(buffer, importObject);

  // 6) Call the exported 'main'
  instance.exports.main?.();
};
function isNumericExpression(expr) {
  return (
    expr.type === 'LiteralNumber' ||
    expr.type === 'BinaryExpression' // all math is numeric for now
  );
}

function blockToAST(block) {
  if (!block) return null;

  switch (block.type) {
    case 'text_print': {
      const argBlock = block.getInputTargetBlock('TEXT');
      const argAST = blockToAST(argBlock);

      // Pick correct print function based on argument type
      const calleeName = isNumericExpression(argAST) ? 'print_num' : 'print_text';

      return {
        type: 'ExpressionStatement',
        expression: {
          type: 'CallExpression',
          callee: { type: 'Identifier', name: calleeName },
          arguments: [argAST]
        }
      };
    }
    case 'math_arithmetic': {
      const opToken = block.getFieldValue('OP');

      const opMap = {
        // Arithmetic
        ADD: 'add',
        MINUS: 'sub',
        MULTIPLY: 'mul',
        DIVIDE: 'div',
        POWER: 'pow'
      };

      return {
        type: 'BinaryExpression',
        operator: opMap[opToken],
        left:  blockToAST(block.getInputTargetBlock('A')),
        right: blockToAST(block.getInputTargetBlock('B')),
      };
    }
    case 'text':
      return {
        type: 'LiteralText',
        value: block.getFieldValue('TEXT')
      };
    case 'controls_if': {
      const testBlock = block.getInputTargetBlock('IF0');
      const test = blockToAST(testBlock);

      const thenBlock = block.getInputTargetBlock('DO0');
      const elseBlock = block.getInputTargetBlock('ELSE');

      // Helper to gather a sequence of statements
      function blockListToStatements(firstBlock) {
        const stmts = [];
        let current = firstBlock;
        while (current) {
          const ast = blockToAST(current);
          if (ast) stmts.push(ast);
          current = current.getNextBlock();
        }
        return stmts;
      }

      return {
        type: 'IfStatement',
        test,
        consequent: blockListToStatements(thenBlock),
        alternate: elseBlock ? blockListToStatements(elseBlock) : []
      };
    }
    case 'logic_compare': {
      const op = block.getFieldValue('OP'); // EQ, NEQ, LT, LTE, GT, GTE
      const opMap = {
        EQ: 'eq',
        NEQ: 'ne',
        LT: 'lt_s',
        LTE: 'le_s',
        GT: 'gt_s',
        GTE: 'ge_s'
      };

      return {
        type: 'BinaryExpression',
        operator: opMap[op],
        left: blockToAST(block.getInputTargetBlock('A')),
        right: blockToAST(block.getInputTargetBlock('B')),
      };
    }
    case 'math_number':
      return {
        type: 'LiteralNumber',
        value: Number(block.getFieldValue('NUM'))
      };

    default:
      return { type: 'Unknown', blockType: block.type };

    case 'logic_operation': {
      const op = block.getFieldValue('OP'); // AND or OR
      const opMap = {
        AND: 'and',
        OR: 'or'
      };

      return {
        type: 'BinaryExpression',
        operator: opMap[op],
        left: blockToAST(block.getInputTargetBlock('A')),
        right: blockToAST(block.getInputTargetBlock('B'))
      };
    }
    case 'controls_repeat_ext': {
      const timesExpr = blockToAST(block.getInputTargetBlock('TIMES'));
      const bodyBlock = block.getInputTargetBlock('DO');

      function blockListToStatements(firstBlock) {
        const stmts = [];
        let current = firstBlock;
        while (current) {
          const ast = blockToAST(current);
          if (ast) stmts.push(ast);
          current = current.getNextBlock();
        }
        return stmts;
      }

      return {
        type: 'RepeatStatement',
        times: timesExpr,
        body: blockListToStatements(bodyBlock),
      };
    }
  }
}

// Initialize on page load
window.addEventListener('load', function() {
  workspace = Blockly.inject('blocklyDiv', {
    toolbox: document.getElementById('toolbox')
  });
});
