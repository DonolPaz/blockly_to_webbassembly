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

    case 'math_number':
      return {
        type: 'LiteralNumber',
        value: Number(block.getFieldValue('NUM'))
      };
    case 'custom_add':
      return {
        type: 'BinaryExpression',
        operator: 'add',
        left:  blockToAST(block.getInputTargetBlock('A')),
        right: blockToAST(block.getInputTargetBlock('B'))
      };

    default:
      return { type: 'Unknown', blockType: block.type };
  }
}

// Define custom blocks first
function defineBlocks() {
  Blockly.Blocks['custom_add'] = {
    init: function() {
      this.appendValueInput("A")
          .setCheck("Number")
          .appendField("lägg ihop");
      this.appendValueInput("B")
          .setCheck("Number")
          .appendField("och");
      this.setInputsInline(true);
      this.setOutput(true, "Number");
      this.setColour(230);
    }
  };
}

// Initialize on page load
window.addEventListener('load', function() {
  defineBlocks(); // Define blocks first
  workspace = Blockly.inject('blocklyDiv', {
    toolbox: document.getElementById('toolbox')
  });
});
