// main.js
import { programToWat } from './ast_to_wat.js';
import { programToC } from './ast_to_c.js';

const variableTypes = new Map();
let workspace;

function printToOutput(text) {
  const area = document.getElementById('outputArea');
  area.textContent += text + '\n';
}
function readFromInput() {
  return document.getElementById('inputField').value;
}

function clearOutput() {
  document.getElementById('outputArea').textContent = '';
}

window.compileAndRun = async function compileAndRun() {
  clearOutput();

  try {
    const topBlocks = workspace.getTopBlocks(true);
    if (topBlocks.length === 0) {
      throw new Error("Programmet är tomt - lägg till block!");
    }

    const ast = [];
    for (const topBlock of topBlocks) {
      const blockChain = blockChainToAST(topBlock);
      ast.push(...blockChain);
    }

    const watSource = programToWat(ast, variableTypes);
    document.getElementById('output').textContent = watSource;

    const wabt = await window.WabtModule();
    const wasmModule = wabt.parseWat('generated.wat', watSource);
    const { buffer } = wasmModule.toBinary({ log: true });

    const importObject = {
      env: {
        print_text: (ptr, len) => {
          const memory = instance.exports.memory;
          const bytes = new Uint8Array(memory.buffer, ptr, len);
          const text = new TextDecoder('utf8').decode(bytes);
          printToOutput(text);
        },
        print_num: num => printToOutput(num.toString()),
        read_input: () => {
          const text = readFromInput();
          const n = parseInt(text, 10);
          if (Number.isNaN(n)) {
            throw new Error("Ogiltig input - skriv ett heltal.");
          }
          return n;
        }
      }
    };

    const { instance } = await WebAssembly.instantiate(buffer, importObject);

    const t0 = performance.now();
    instance.exports.main?.();
    const t1 = performance.now();
    console.log("WASM time run in ms: " + (t1 - t0));
  } catch (err) {
    printToOutput("🚨 Fel: " + err.message);
    console.error(err);
  }
};



window.compileCAndRun = async function compileCAndRun() {
  // 1) Generera C-koden från Blockly
  const ast     = workspace.getTopBlocks(true).map(blockToAST);
  const cSource = programToC(ast);
  console.log('Generated C:\n', cSource);

  // 2) Ladda clang.js (Emscripten-modul)
  const clangModule = await createClangModule();  // skapar clang instans (anpassa efter din setup)
  
  // 3) Kör clang för att generera LLVM IR (.ll) från C-kod
  // Spara C-koden i clangs virtuella FS:
  clangModule.FS.writeFile('input.c', cSource);

  // Kör clang med flaggor att generera IR i textformat:
  const clangArgs = ['clang', '-S', '-emit-llvm', 'input.c', '-o', 'output.ll'];
  clangModule.callMain(clangArgs);

  // Läs ut LLVM IR:
  const llvmIR = clangModule.FS.readFile('output.ll', { encoding: 'utf8' });
  console.log('LLVM IR:\n', llvmIR);

  // 4) Ladda llc.js (Emscripten-modul)
  const llcModule = await createLlcModule();

  // Skriv LLVM IR till llc virtuella FS:
  llcModule.FS.writeFile('input.ll', llvmIR);

  // Kör llc för att generera wasm:
  // Flagga: -march=wasm32 -filetype=obj (objektfil)
  const llcArgs = ['llc', '-march=wasm32', '-filetype=obj', 'input.ll', '-o', 'output.o'];
  llcModule.callMain(llcArgs);

  // Läs ut objektfilen (wasm objekt):
  const wasmObject = llcModule.FS.readFile('output.o');

  // 5) Här behöver du länka objektfilen till en körbar wasm-fil.
  // Det kan göras med wasm-ld.js eller emscripten linker i browsern.
  // För enkelhet, anta vi har wasm-ld.js:
  const wasmLdModule = await createWasmLdModule();

  // Skriv objektfil till linker FS:
  wasmLdModule.FS.writeFile('input.o', wasmObject);

  // Kör länkaren:
  wasmLdModule.callMain(['wasm-ld', 'input.o', '-o', 'final.wasm']);

  // Läs ut slutgiltiga wasm binärfilen:
  const wasmBinary = wasmLdModule.FS.readFile('final.wasm');

  // 6) Instantierea och kör wasm
  const memory = new WebAssembly.Memory({ initial: 256 });
  const importObject = {
    env: {
      memory,
      // ev fler importfunktioner du behöver
      abort: () => { throw new Error('WASM abort'); },
    }
  };

  const { instance } = await WebAssembly.instantiate(wasmBinary.buffer, importObject);

  // Kör entrypoint, vanligtvis _main eller main:
  const entry = instance.exports._main || instance.exports.main;
  if (typeof entry === 'function') {
    entry();
  } else {
    console.warn('No _main or main export found');
  }
};


function isNumericExpression(expr) {
  return (
    expr.type === 'LiteralNumber' ||
    expr.type === 'BinaryExpression' ||
    (expr.type === 'Identifier' && expr.varType === 'number') ||
    (expr.type === 'CallExpression' &&
      (expr.callee.name === 'read_input' || expr.callee.name === 'is_prime'))
  );
}

function blockChainToAST(startBlock) {
  const statements = [];
  let currentBlock = startBlock;
  
  while (currentBlock) {
    const ast = blockToAST(currentBlock);
    if (ast) {
      statements.push(ast);
    }
    currentBlock = currentBlock.getNextBlock(); // Move to next connected block
  }
  
  return statements;
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
    case 'math_change': {
      const varId = block.getFieldValue('VAR');
      const variable = workspace.getVariableMap().getVariableById(varId);
      const name = variable?.name || 'unnamed';
      const delta = blockToAST(block.getInputTargetBlock('DELTA'));

      variableTypes.set(name, 'number'); // assume variable becomes number
      return {
        type: 'ChangeStatement',
        name,
        delta
      };
    }
    case 'read_input':
      return {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'read_input' },
        arguments: []
    };

    case 'is_prime': {
    const input = blockToAST(block.getInputTargetBlock('NUM'));
    return {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: 'is_prime' },
      arguments: [input]
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

      const left = blockToAST(block.getInputTargetBlock('A'));
      const right = blockToAST(block.getInputTargetBlock('B'));

      // kontrollera om båda är nummer
      const leftType = left.varType || left.type;
      const rightType = right.varType || right.type;

      const isText = (t) => t === 'text' || t === 'LiteralText';

      if (isText(leftType) || isText(rightType)) {
        throw new Error(`Jämförelseoperatorer (${op}) kan bara användas med nummer - du försöker jämföra text.`);
      }

      return {
        type: 'BinaryExpression',
        operator: opMap[op],
        left,
        right,
      };
    }
    case 'math_number':
      return {
        type: 'LiteralNumber',
        value: Number(block.getFieldValue('NUM'))
      };

    default:
      return { type: 'Unknown', blockType: block.type };
      
    case 'variables_set': {
      const varId = block.getFieldValue('VAR');
      const variable = workspace.getVariableMap().getVariableById(varId);
      const name = variable?.name || 'unnamed';

      const value = blockToAST(block.getInputTargetBlock('VALUE'));

      let inferredType = 'unknown';
      if (value.type === 'LiteralNumber') inferredType = 'number';
      else if (value.type === 'BinaryExpression') inferredType = 'number';
      else if (value.type === 'LiteralText') inferredType = 'text';
      else if (value.type === 'Identifier' && value.varType) inferredType = value.varType;
      else if (
        value.type === 'CallExpression' &&
        value.callee?.name === 'read_input'
      ) {
        inferredType = 'number';
      }

      const existingType = variableTypes.get(name);
      if (existingType && existingType !== inferredType) {
        throw new Error(`Typkonflikt: variabeln "${name}" är av typen "${existingType}", men du försöker sätta ett värde av typen "${inferredType}".`);
      }

      variableTypes.set(name, inferredType);

      return {
        type: 'VariableDeclaration',
        name,
        value,
        varType: inferredType,
      };
    }

    case 'variables_get': {
      const varId = block.getFieldValue('VAR');
      const variable = workspace.getVariableMap().getVariableById(varId);
      const name = variable?.name || 'unnamed';

      const varType = variableTypes.get(name) || 'unknown';
      console.log(varType);

      return {
        type: 'Identifier',
        name,
        varType,
      };
    }
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
  document.getElementById('clearOutput')
          .addEventListener('click', clearOutput);
          
  workspace = Blockly.inject('blocklyDiv', {
    toolbox: document.getElementById('toolbox')
  });
});

//custom block input
Blockly.defineBlocksWithJsonArray([
  {
    "type": "read_input",
    "message0": "read input",
    "output": "Number", 
    "colour": 290,
    "tooltip": "Reads input from the text field",
    "helpUrl": ""
  },
  {
    "type": "is_prime",
    "message0": "%1 is prime",
    "args0": [
      {
        "type": "input_value",
        "name": "NUM",
        "check": "Number"
      }
    ],
    "output": "Boolean",
    "colour": 230,
    "tooltip": "Returns true if the number is a prime",
    "helpUrl": ""
  }
  
]);
