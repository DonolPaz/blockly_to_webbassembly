// server.js
import express from 'express';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

// Serve your static files (index.html, main.js, ast_to_*.js, etc.)
app.use(express.static('.'));

// API endpoint to compile C → WASM
app.post('/api/compile-c', async (req, res) => {
  try {
    const { code } = req.body;
    const buildDir = path.resolve('build');
    await fs.mkdir(buildDir, { recursive: true });

    const srcPath = path.join(buildDir, 'program.c');
    const wasmPath = path.join(buildDir, 'program.wasm');

    // Write the C source
    await fs.writeFile(srcPath, code, 'utf8');

    // Invoke Emscripten compiler
    execFile('emcc', [
      srcPath,
      '-O3',              // optimize
      '-s', 'WASM=1',     // emit .wasm
      '-s', 'SIDE_MODULE=1', // standalone WASM
      '-o', wasmPath
    ], (err, stdout, stderr) => {
      if (err) {
        console.error('⚠️ emcc failed:', err);
        console.error('stdout:', stdout);
        console.error('stderr:', stderr);
        return res.status(500).send(stderr || err.toString());
      }
      // Send back the binary
      res.sendFile(wasmPath);
    });

  } catch (e) {
    console.error(e);
    res.status(500).send(e.toString());
  }
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Dev server listening at http://localhost:${port}`);
});
