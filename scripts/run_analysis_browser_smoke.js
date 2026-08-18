#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const indexPath = path.resolve(process.argv[2] || 'index.html');
const depth = Number(process.argv[3] || 5);
if (!fs.existsSync(indexPath)) {
  console.error(`Missing Analysis page: ${indexPath}`);
  process.exit(2);
}

const root = path.dirname(indexPath);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function safeFile(urlPath) {
  let rel = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  if (rel === '/') rel = '/' + path.basename(indexPath);
  const abs = path.resolve(root, '.' + rel);
  if (!abs.startsWith(root + path.sep) && abs !== root) return null;
  return abs;
}

const server = http.createServer((req, res) => {
  const file = safeFile(req.url);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
});

function startingBoard() {
  const rows = [
    ['br','bn','bb','bq','bk','bb','bn','br'],
    Array(8).fill('bp'),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill('wp'),
    ['wr','wn','wb','wq','wk','wb','wn','wr'],
  ];
  return rows;
}

(async () => {
  let browser;
  let settled = false;
  const failTimer = setTimeout(() => {
    if (settled) return;
    console.error('Browser AbilityFish smoke test timed out');
    process.exit(1);
  }, 90000);

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(String(err && err.stack || err)));
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('browser console:', msg.text());
    });

    await page.goto(`http://127.0.0.1:${port}/${path.basename(indexPath)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForFunction(() =>
      typeof requestAbilityFishAnalysis === 'function' &&
      typeof ensureEmbeddedAnalysisAbilityFishWorkerUrl === 'function',
      null,
      { timeout: 15000 }
    );

    const state = {
      board: startingBoard(),
      turn: 'w',
      castlingRights: {w:{k:true,q:true},b:{k:true,q:true}},
      enPassant: null,
      halfmoveClock: 0,
      points: {w:0,b:0},
      abilityUsed: false,
      movesRemaining: 1,
      doubleMoveActive: false,
      beganTurnInCheck: false,
      abilitiesEnabled: true,
      upgradesEnabled: true,
      upgradeLimit: 3,
      upgrades: {w:{},b:{}},
      shielded: {w:null,b:null},
      frozen: {w:null,b:null},
      ambushed: {w:null,b:null},
      fortified: {w:null,b:null},
      portals: {w:null,b:null},
      lastMoveByColor: {w:null,b:null},
    };

    const result = await page.evaluate(async ({ state, depth }) => {
      return await requestAbilityFishAnalysis(state, { depth });
    }, { state, depth });

    const reportedDepth = Number(result && result.depth || 0);
    const nodes = Number(result && result.nodes || 0);
    if (!result || result.wasm !== true) {
      throw new Error(`Browser Analysis result was not marked WASM: ${JSON.stringify(result)}`);
    }
    if (reportedDepth < depth) {
      throw new Error(`Browser Analysis stopped at depth ${reportedDepth}; expected ${depth}`);
    }
    if (!(nodes > 0)) {
      throw new Error(`Browser Analysis reported ${nodes} nodes; expected > 0`);
    }
    if (pageErrors.length) {
      console.warn('Non-fatal page errors during smoke:', pageErrors.slice(0,3));
    }

    console.log(`ABILITYFISH_BROWSER_DEPTH_${depth}_OK nodes=${nodes}`);
    settled = true;
    clearTimeout(failTimer);
    await browser.close();
    server.close(() => process.exit(0));
  } catch (error) {
    console.error('Embedded AbilityFish browser smoke failed');
    console.error(error && error.stack || error);
    settled = true;
    clearTimeout(failTimer);
    try { if (browser) await browser.close(); } catch {}
    try { server.close(); } catch {}
    process.exit(1);
  }
})();
