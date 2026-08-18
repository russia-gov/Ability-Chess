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
  return [
    ['br','bn','bb','bq','bk','bb','bn','br'],
    Array(8).fill('bp'),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill('wp'),
    ['wr','wn','wb','wq','wk','wb','wn','wr'],
  ];
}

function baseState() {
  return {
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
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function squareToRC(sq) {
  return {r: 8 - Number(sq[1]), c: sq.toLowerCase().charCodeAt(0) - 97};
}

function applyOrdinaryUci(state, uci) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(String(uci || ''))) {
    throw new Error(`Smoke test cannot apply non-ordinary UCI move: ${uci}`);
  }
  const next = clone(state);
  const from = squareToRC(uci.slice(0,2));
  const to = squareToRC(uci.slice(2,4));
  const moving = next.board[from.r][from.c];
  if (!moving) throw new Error(`No piece on ${uci.slice(0,2)} while applying ${uci}`);
  const side = moving[0];
  next.board[from.r][from.c] = null;
  next.board[to.r][to.c] = uci[4] ? side + uci[4] : moving;
  next.lastMoveByColor[side] = {from, to, piece:moving};
  next.turn = side === 'w' ? 'b' : 'w';
  next.abilityUsed = false;
  next.movesRemaining = 1;
  next.doubleMoveActive = false;
  next.beganTurnInCheck = false;
  next.enPassant = null;
  return next;
}

(async () => {
  let browser;
  let page = null;
  let settled = false;
  const pageErrors = [];
  const failTimer = setTimeout(() => {
    if (settled) return;
    console.error('Browser AbilityFish smoke test timed out');
    process.exit(1);
  }, 120000);

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    page.on('pageerror', err => pageErrors.push(String(err && err.stack || err)));
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('browser console:', msg.text());
    });

    await page.goto(`http://127.0.0.1:${port}/${path.basename(indexPath)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForFunction(
      () => typeof window.__ABILITYFISH_ANALYSIS_TEST__ === 'function',
      null,
      { timeout: 15000 }
    );

    const analyze = async (state, requestedDepth) => page.evaluate(async ({ state, requestedDepth }) => {
      return await window.__ABILITYFISH_ANALYSIS_TEST__(state, { depth: requestedDepth });
    }, { state, requestedDepth });

    const state = baseState();
    const result = await analyze(state, depth);

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

    // Regression for the exact class of problem seen in the UI: a depth-N root
    // score should agree closely with the same best-move child searched to N-1.
    // The adapter stores scores in one fixed (black-positive) perspective, so
    // parent and child should have the same sign and nearly the same value.
    if (depth >= 5) {
      const parentState = applyOrdinaryUci(baseState(), 'b1c3');
      const parent = await analyze(parentState, 5);
      const topPv = String(parent?.displayLines?.[0]?.pv || '').trim().split(/\s+/).filter(Boolean);
      const bestMove = topPv[0];
      if (!bestMove) throw new Error(`No principal variation in Nc3 regression: ${JSON.stringify(parent)}`);
      const childState = applyOrdinaryUci(parentState, bestMove);
      const child = await analyze(childState, 4);
      const parentScore = Number(parent?.score);
      const childScore = Number(child?.score);
      const delta = Math.abs(parentScore - childScore);
      console.log(`ABILITYFISH_SCORE_CHAIN move=${bestMove} parent=${parentScore} child=${childScore} delta=${delta}`);
      if (!Number.isFinite(parentScore) || !Number.isFinite(childScore)) {
        throw new Error('AbilityFish score chain returned a non-finite score');
      }
      if (Math.sign(parentScore) !== 0 && Math.sign(childScore) !== 0 && Math.sign(parentScore) !== Math.sign(childScore)) {
        throw new Error(`AbilityFish fixed-perspective score flipped after its own best move: ${parentScore} -> ${childScore}`);
      }
      if (delta > 40) {
        throw new Error(`AbilityFish best-move score changed by ${delta} cp between depth 5 root and depth 4 child`);
      }
    }

    if (pageErrors.length) {
      console.warn('Non-fatal page errors during smoke:', pageErrors.slice(0,5));
    }

    console.log(`ABILITYFISH_BROWSER_DEPTH_${depth}_OK nodes=${nodes}`);
    settled = true;
    clearTimeout(failTimer);
    await browser.close();
    server.close(() => process.exit(0));
  } catch (error) {
    console.error('Embedded AbilityFish browser smoke failed');
    console.error(error && error.stack || error);
    if (pageErrors.length) {
      console.error('Browser page errors:', pageErrors.slice(0,5));
    }
    if (page) {
      try {
        const diag = await page.evaluate(() => ({
          title: document.title,
          hook: typeof window.__ABILITYFISH_ANALYSIS_TEST__,
          ready: document.readyState,
        }));
        console.error('Browser page diagnostics:', JSON.stringify(diag));
      } catch {}
    }
    settled = true;
    clearTimeout(failTimer);
    try { if (browser) await browser.close(); } catch {}
    try { server.close(); } catch {}
    process.exit(1);
  }
})();
