// generate_c.js

/**
 * Node.js build script: headless Blockly → AST → C code generation
 */
import { readFileSync, writeFileSync } from 'fs';
import path                          from 'path';
import { fileURLToPath }             from 'url';
// Headless Blockly core modules
import BlocklyCore                   from 'blockly/core';
import 'blockly/blocks';

import { programToC }                from '../ast_to_c.js';

// Resolve this script's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Read workspace XML
const xmlPath      = path.join(__dirname, 'workspace.xml');
const workspaceXml = readFileSync(xmlPath, 'utf8');
console.log(`Loaded workspace XML from ${xmlPath}`);

// 1) Create headless Workspace
const { Workspace, Xml } = BlocklyCore;
const workspace = new Workspace();

// 2) Parse XML into the workspace model
const xmlDom = Xml.textToDom(workspaceXml);
Xml.domToWorkspace(xmlDom, workspace);
console.log('Blockly workspace populated with', workspace.getAllBlocks().length, 'blocks');

// 3) Build AST
function blockToAST(block) {
  if (!block) return null;
  switch (block.type) {
    case 'text_print': {
      const argBlock = block.getInputTargetBlock('TEXT');
      const argAST   = blockToAST(argBlock);
      const callee   = (argAST.type === 'LiteralNumber' || argAST.type === 'BinaryExpression')
                        ? 'print_num' : 'print_text';
      return { type: 'ExpressionStatement', expression: { type: 'CallExpression', callee: { type: 'Identifier', name: callee }, arguments: [argAST] } };
    }
    case 'math_number':
      return { type: 'LiteralNumber', value: Number(block.getFieldValue('NUM')) };
    case 'math_arithmetic': {
      const opMap = { ADD: 'add', MINUS: 'sub', MULTIPLY: 'mul', DIVIDE: 'div' };
      const op    = opMap[block.getFieldValue('OP')];
      return { type: 'BinaryExpression', operator: op, left: blockToAST(block.getInputTargetBlock('A')), right: blockToAST(block.getInputTargetBlock('B')) };
    }
    case 'custom_add':
      return { type: 'BinaryExpression', operator: 'add', left: blockToAST(block.getInputTargetBlock('A')), right: blockToAST(block.getInputTargetBlock('B')) };
    case 'variables_set':
      return { type: 'VariableDeclaration', name: block.getFieldValue('VAR'), init: blockToAST(block.getInputTargetBlock('VALUE')) };
    case 'variables_get':
      return { type: 'Identifier', name: block.getFieldValue('VAR') };
    default:
      return { type: 'Unknown', blockType: block.type };
  }
}

const topBlocks = workspace.getTopBlocks(true);
const ast       = topBlocks.map(blockToAST);
console.log('AST generated with', ast.length, 'top-level statements');

// 4) Generate C source and write it
const cSource = programToC(ast);
const outDir  = path.join(__dirname, 'src');
const outPath = path.join(outDir, 'generated.c');
writeFileSync(outPath, cSource, 'utf8');
console.log(`Wrote generated C to ${outPath}`);