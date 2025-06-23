// main.js
import { programToWat } from './ast_to_wat.js';

let workspace;

window.compileAndRun = async function compileAndRun() {
  // 1) Build AST and generate WAT
  const topBlocks = workspace.getTopBlocks(true);
  const ast       = topBlocks.map(blockToAST);
  const watSource = programToWat(ast);

  // 2) Show WAT in the <pre>
  document.getElementById('output').textContent = watSource;

  // 3) Load WABT 
  const wabt = await window.WabtModule();

  // 4) Parse WAT → binary
  const wasmModule = wabt.parseWat('generated.wat', watSource);
  const { buffer } = wasmModule.toBinary({ log: true });

  // 5) Instantiate with our 'print' import
  const importObject = {
    env: {
      print: value => console.log('WASM print:', value)
    }
  };
  const { instance } = await WebAssembly.instantiate(buffer, importObject);

  // 6) Call the exported 'main'
  instance.exports.main?.();
};

function blockToAST(block) {
  if (!block) return null;

  switch (block.type) {
    case 'text_print':
      return {
        type: 'ExpressionStatement',
        expression: {
          type: 'CallExpression',
          callee: { type: 'Identifier', name: 'print' },
          arguments: [blockToAST(block.getInputTargetBlock('TEXT'))]
        }
      };

    case 'text':
      return {
        type: 'Literal',
        value: block.getFieldValue('TEXT')
      };

    case 'math_number':
      return {
        type: 'Literal',
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
