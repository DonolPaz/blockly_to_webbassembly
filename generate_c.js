// generate_c.js
import { readFileSync, writeFileSync } from 'fs';
import { programToC }      from './ast_to_c.js';
import { JSDOM }           from 'jsdom';

// 1) Load an HTML file that contains your Blockly workspace XML
//    or read a saved `.xml` workspace export. For example:
const workspaceXml = readFileSync('workspace.xml', 'utf8');

// 2) Create a headless DOM and inject Blockly to parse the XML  
const dom = new JSDOM(`<!DOCTYPE html><body>
  <div id="blocklyDiv"></div>
  <xml id="toolbox" style="display:none">${workspaceXml}</xml>
</body>`, { runScripts: 'outside-only' });
global.window = dom.window;
global.document = dom.window.document;

// 3) Inject Blockly and define blocks (as in your browser code)
const Blockly = require('blockly');
// (re-implement your defineBlocks() here)
defineBlocks();
const workspace = Blockly.inject('blocklyDiv', {
  toolbox: dom.window.document.getElementById('toolbox')
});

// 4) Build the AST using your same blockToAST
const topBlocks = workspace.getTopBlocks(true);
const ast       = topBlocks.map(blockToAST);

// 5) Generate C source
const cSource = programToC(ast);

// 6) Write it out for your LLVM build
writeFileSync('llvm/src/generated.c', cSource, 'utf8');
console.log('Wrote C source to llvm/src/generated.c');