#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const runtimeDir = path.resolve(process.argv[2] || '.');
const depth = Number(process.argv[3] || 15);
const jsPath = path.join(runtimeDir, 'stockfish.js');
const wasmPath = path.join(runtimeDir, 'stockfish.wasm');
const workerPath = path.join(runtimeDir, 'stockfish.worker.js');

if (!fs.existsSync(jsPath) || !fs.existsSync(wasmPath) || !fs.existsSync(workerPath)) {
  console.error(`Missing interactive Fairy runtime files in ${runtimeDir}`);
  process.exit(2);
}

const Stockfish = require(jsPath);
let maxDepth = 0;
let sawAbilityFish = false;
let sawBestmove = false;
let settled = false;

function fail(message, error) {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  console.error(message);
  if (error) console.error(error);
  process.exit(1);
}

const timer = setTimeout(() => fail(`WASM UCI search timed out at reported depth ${maxDepth}`), 60000);

Promise.resolve(Stockfish({
  wasmBinary: fs.readFileSync(wasmPath),
  locateFile: (file) => file.endsWith('stockfish.worker.js') ? workerPath : file
})).then((engine) => {
  engine.addMessageListener((line) => {
    if (typeof line !== 'string') return;
    console.log(line);

    if (line === 'uciok') {
      engine.postMessage('position fen 4k3/8/8/8/8/8/8/1N2K3 w - - 0 1');
      engine.postMessage('abilityfish on');
      engine.postMessage('abilitypoints 3 0');
      engine.postMessage(`go depth ${depth}`);
      return;
    }

    if (line === 'info string abilityfish on') sawAbilityFish = true;
    const match = line.match(/^info depth (\d+)\b/);
    if (match) maxDepth = Math.max(maxDepth, Number(match[1]));

    if (line.startsWith('bestmove ')) {
      sawBestmove = true;
      if (!sawAbilityFish) return fail('WASM runtime never acknowledged AbilityFish mode');
      if (maxDepth < depth) return fail(`WASM runtime stopped at depth ${maxDepth}; expected ${depth}`);
      settled = true;
      clearTimeout(timer);
      console.log(`ABILITYFISH_WASM_DEPTH_${depth}_OK`);
      process.exit(0);
    }
  });
  engine.postMessage('uci');
}).catch((error) => fail('Failed to instantiate interactive AbilityFish WASM runtime', error));
