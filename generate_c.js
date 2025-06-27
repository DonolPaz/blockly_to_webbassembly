// generate_c.js
import { readFileSync, writeFileSync } from 'fs';
import { programToC }                  from './ast_to_c.js';
import { JSDOM }                       from 'jsdom';
import path                            from 'path';
import { fileURLToPath }               from 'url';

// Convert import.meta.url to filesystem path
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Point directly at workspace.xml in the same folder
const xmlPath       = path.join(__dirname, 'workspace.xml');
const workspaceXml  = readFileSync(xmlPath, 'utf8');

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