// server.js
import express from 'express';
import cors from 'cors';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const app = express();

// Enable CORS and JSON bodies
app.use(cors());
app.use(express.json());

// Serve your client files
app.use(express.static('.'));

// Path to your emcc.bat (adjust as needed)
const EMCC = 'C:\\Users\\danie\\emsdk\\upstream\\emscripten\\emcc.bat';

app.post('/api/compile-c', async (req, res) => {
  try {
    const { code } = req.body;
    const buildDir = path.resolve('build');
    await fs.rm(buildDir, { recursive: true, force: true });
    await fs.mkdir(buildDir, { recursive: true });

    const srcPath  = path.join(buildDir, 'program.c');
    const wasmPath = path.join(buildDir, 'program.wasm');

    // Write out the generated C
    await fs.writeFile(srcPath, code, 'utf8');

    // Invoke emcc to produce a standalone .wasm
    execFile(EMCC, [
      srcPath,
      '-O3',
      '-s', 'WASM=1',
      '-s', 'STANDALONE_WASM=0',       // Not standalone—use the normal “web” glue
      '-s', 'ENVIRONMENT="web"',       // Force web environment
      '-o', wasmPath
    ], (err, stdout, stderr) => {
      if (err) {
        console.error('⚠️ emcc failed:', stderr || err);
        return res.status(500).send(stderr || err.toString());
      }
      // Send the .wasm binary back
      res.sendFile(wasmPath);
    });

  } catch (e) {
    console.error('Server error:', e);
    res.status(500).send(e.toString());
  }
});

// Start on port 3000
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Dev server listening at http://localhost:${port}`);
});
