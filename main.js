// main.js
import { programToWat } from './ast_to_wat.js';
import { programToC } from './ast_to_c.js';


let workspace;

window.compileAndRun = async function compileAndRun() {
  // 1) Build AST and generate WAT
  const topBlocks = workspace.getTopBlocks(true);
  const ast = [];
  for (const topBlock of topBlocks) {
    const blockChain = blockChainToAST(topBlock);
    ast.push(...blockChain);
  }
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
    expr.type === 'Identifier' // all math is numeric for now
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
      
    case 'variables_set': {
      const varId = block.getFieldValue('VAR'); // This is the ID
      const variable = workspace.getVariableMap().getVariableById(varId);
      const name = variable?.name || 'unnamed';

      console.log("Variable set name:", name);

      const value = blockToAST(block.getInputTargetBlock('VALUE'));

      return {
        type: 'VariableDeclaration',
        name,
        value
      };
    }
    case 'variables_get': {
      const varId = block.getFieldValue('VAR');
      const variable = workspace.getVariableMap().getVariableById(varId);
      const name = variable?.name || 'unnamed';
      return {
        type: 'Identifier',
        name
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
  workspace = Blockly.inject('blocklyDiv', {
    toolbox: document.getElementById('toolbox')
  });
});
