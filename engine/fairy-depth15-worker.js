/* AbilityFish depth-15 browser worker backed by the custom interactive
 * Fairy-Stockfish WASM build produced by build-abilityfish.yml.
 */
const ENGINE_JS = './abilityfish-stockfish.js';
const ENGINE_WASM = './abilityfish-stockfish.wasm';
const ENGINE_WORKER = './abilityfish-stockfish.worker.js';

self.Module = self.Module || {};
self.Module.locateFile = (path) => {
  if (path.endsWith('.wasm')) return ENGINE_WASM;
  if (path.endsWith('.worker.js')) return ENGINE_WORKER;
  return path;
};
importScripts(ENGINE_JS);

let enginePromise = null;
let active = null;

function getEngine() {
  if (!enginePromise) {
    enginePromise = Promise.resolve(
      typeof Stockfish === 'function'
        ? Stockfish({
            locateFile: (path) => {
              if (path.endsWith('.wasm')) return ENGINE_WASM;
              if (path.endsWith('.worker.js')) return ENGINE_WORKER;
              return path;
            }
          })
        : Promise.reject(new Error('Custom AbilityFish WASM module did not load'))
    ).then((engine) => {
      engine.postMessage('uci');
      return engine;
    });
  }
  return enginePromise;
}

function parseInfo(line) {
  const info = { raw: line };
  let m = line.match(/\bdepth\s+(\d+)/); if (m) info.depth = Number(m[1]);
  m = line.match(/\bnodes\s+(\d+)/); if (m) info.nodes = Number(m[1]);
  m = line.match(/\bnps\s+(\d+)/); if (m) info.nps = Number(m[1]);
  m = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  if (m) info.score = { type: m[1], value: Number(m[2]) };
  m = line.match(/\bpv\s+(.+)$/); if (m) info.pv = m[1].trim().split(/\s+/);
  m = line.match(/\bmultipv\s+(\d+)/); if (m) info.multipv = Number(m[1]);
  return info;
}

function decodeAbilityAction(packed) {
  const v = packed >>> 0;
  return {
    kind: v & 0x1f,
    from: (v >>> 5) & 0x7f,
    to: (v >>> 12) & 0x7f,
    aux: (v >>> 19) & 0x3f,
    flags: (v >>> 25) & 0x7f
  };
}

function abilityCommands(job) {
  const state = job.abilityState || {};
  const whitePoints = Number(state.whitePoints ?? state.points?.w ?? 0) || 0;
  const blackPoints = Number(state.blackPoints ?? state.points?.b ?? 0) || 0;
  return [
    'abilityfish on',
    `abilitypoints ${Math.max(0, whitePoints)} ${Math.max(0, blackPoints)}`
  ];
}

async function analyze(job) {
  const engine = await getEngine();
  if (active) {
    try { engine.postMessage('stop'); } catch {}
    active.reject(new Error('Superseded by a newer AbilityFish search'));
    active = null;
  }

  return new Promise((resolve, reject) => {
    const lines = new Map();
    let bestAbilityAction = null;
    const requestedDepth = Math.max(1, Math.min(40, Number(job.depth || 15)));
    const multiPV = Math.max(1, Math.min(8, Number(job.multiPV || 3)));
    const listener = (line) => {
      if (typeof line !== 'string') return;
      if (line.startsWith('info string abilityaction ')) {
        const m = line.match(/^info string abilityaction\s+(\d+)(?:\s+score\s+(cp|mate)\s+(-?\d+))?(?:\s+depth\s+(\d+))?/);
        if (m) {
          bestAbilityAction = {
            packed: Number(m[1]),
            action: decodeAbilityAction(Number(m[1])),
            score: m[2] ? { type: m[2], value: Number(m[3]) } : null,
            depth: m[4] ? Number(m[4]) : null
          };
          self.postMessage({ id: job.id, type: 'abilityinfo', ability: bestAbilityAction });
        }
        return;
      }
      if (line.startsWith('info ')) {
        const info = parseInfo(line);
        const key = info.multipv || 1;
        if (info.pv?.length) lines.set(key, info);
        self.postMessage({ id: job.id, type: 'info', info });
        return;
      }
      if (line.startsWith('bestmove ')) {
        cleanup();
        const bestmove = line.split(/\s+/)[1] || null;
        const ordered = [...lines.entries()].sort((a,b)=>a[0]-b[0]).map(([,v])=>v);
        resolve({ bestmove: bestmove === '0000' && bestAbilityAction ? null : bestmove, abilityAction: bestAbilityAction, depth: requestedDepth, lines: ordered });
      }
    };
    const cleanup = () => {
      try { engine.removeMessageListener?.(listener); } catch {}
      if (active?.id === job.id) active = null;
    };
    active = { id: job.id, reject, cleanup };
    engine.addMessageListener(listener);
    try {
      engine.postMessage('setoption name UCI_Variant value chess');
      engine.postMessage(`setoption name MultiPV value ${multiPV}`);
      engine.postMessage('isready');
      engine.postMessage(job.fen === 'startpos' ? 'position startpos' : `position fen ${job.fen}`);
      for (const command of abilityCommands(job)) engine.postMessage(command);
      engine.postMessage(`go depth ${requestedDepth}`);
    } catch (err) {
      cleanup(); reject(err);
    }
  });
}

self.onmessage = async (event) => {
  const job = event.data || {};
  if (job.type === 'stop') {
    try { (await getEngine()).postMessage('stop'); } catch {}
    return;
  }
  try {
    if (!job.fen) throw new Error('Missing FEN');
    const result = await analyze(job);
    self.postMessage({ id: job.id, type: 'result', result });
  } catch (error) {
    self.postMessage({ id: job.id, type: 'error', error: String(error?.stack || error) });
  }
};
