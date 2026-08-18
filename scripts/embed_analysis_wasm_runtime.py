#!/usr/bin/env python3
"""Embed the portable AbilityFish JS/WASM runtime into index.html.

The live site can then create the Analysis engine from a blob worker without
requiring the host to publish analysis-engine/* as separate files. This is
intentionally Analysis-only; the rest of the site's worker paths are untouched.
"""
from __future__ import annotations

import base64
from pathlib import Path
import sys

if len(sys.argv) != 5:
    raise SystemExit(
        "usage: embed_analysis_wasm_runtime.py INDEX STOCKFISH_JS STOCKFISH_WASM WRAPPER_WORKER"
    )

index_path = Path(sys.argv[1])
engine_js_path = Path(sys.argv[2])
engine_wasm_path = Path(sys.argv[3])
wrapper_path = Path(sys.argv[4])

html = index_path.read_text(encoding="utf-8")
engine_js = engine_js_path.read_text(encoding="utf-8")
worker = wrapper_path.read_text(encoding="utf-8")
wasm_b64 = base64.b64encode(engine_wasm_path.read_bytes()).decode("ascii")
engine_js_b64 = base64.b64encode(engine_js.encode("utf-8")).decode("ascii")

old_boot = """const ENGINE_JS = './abilityfish-stockfish.js';
const ENGINE_WASM = './abilityfish-stockfish.wasm';
const ENGINE_WORKER = './abilityfish-stockfish.worker.js';

self.Module = self.Module || {};
self.Module.locateFile = locateEngineFile;
importScripts(ENGINE_JS);
"""
new_boot = """const ENGINE_WASM_B64 = __ABILITYFISH_WASM_B64__;
let engineWasmBinary = null;
function embeddedEngineWasm() {
  if (engineWasmBinary) return engineWasmBinary;
  const raw = atob(ENGINE_WASM_B64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  engineWasmBinary = bytes;
  return engineWasmBinary;
}
"""
if old_boot not in worker:
    raise SystemExit("AbilityFish wrapper bootstrap anchor changed")
worker = worker.replace(old_boot, new_boot, 1)

old_engine = "Stockfish({ locateFile: locateEngineFile })"
new_engine = "Stockfish({ wasmBinary: embeddedEngineWasm() })"
if old_engine not in worker:
    raise SystemExit("AbilityFish wrapper Stockfish() anchor changed")
worker = worker.replace(old_engine, new_engine, 1)
worker = worker.replace(
    "function locateEngineFile(path) {",
    "const ENGINE_WASM=''; const ENGINE_WORKER='';\nfunction locateEngineFile(path) {",
    1,
)

worker_template_b64 = base64.b64encode(worker.encode("utf-8")).decode("ascii")

old = "const ANALYSIS_ABILITYFISH_WORKER='./analysis-engine/abilityfish-worker.js';"
embedded = f"""// ANALYSIS_ABILITYFISH_EMBEDDED_V1
  const ANALYSIS_ABILITYFISH_WORKER='./analysis-engine/abilityfish-worker.js';
  const ANALYSIS_ABILITYFISH_ENGINE_JS_B64='{engine_js_b64}';
  const ANALYSIS_ABILITYFISH_ENGINE_WASM_B64='{wasm_b64}';
  const ANALYSIS_ABILITYFISH_WRAPPER_B64='{worker_template_b64}';
  let analysisAbilityFishEmbeddedWorkerUrl=null;
  function analysisDecodeUtf8Base64(value){{
    const raw=atob(value),bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }}
  function ensureEmbeddedAnalysisAbilityFishWorkerUrl(){{
    if(analysisAbilityFishEmbeddedWorkerUrl)return analysisAbilityFishEmbeddedWorkerUrl;
    const engineSource=analysisDecodeUtf8Base64(ANALYSIS_ABILITYFISH_ENGINE_JS_B64);
    let wrapperSource=analysisDecodeUtf8Base64(ANALYSIS_ABILITYFISH_WRAPPER_B64);
    wrapperSource=wrapperSource.replace('__ABILITYFISH_WASM_B64__',JSON.stringify(ANALYSIS_ABILITYFISH_ENGINE_WASM_B64));
    analysisAbilityFishEmbeddedWorkerUrl=URL.createObjectURL(new Blob([engineSource,'\\n',wrapperSource],{{type:'text/javascript'}}));
    return analysisAbilityFishEmbeddedWorkerUrl;
  }}"""

if "ANALYSIS_ABILITYFISH_EMBEDDED_V1" in html:
    start = html.index("// ANALYSIS_ABILITYFISH_EMBEDDED_V1")
    end_marker = "  const ANALYSIS_ABILITY_NAMES="
    end = html.index(end_marker, start)
    html = html[:start] + embedded + "\n" + html[end:]
elif old in html:
    html = html.replace(old, embedded, 1)
else:
    raise SystemExit("Analysis worker constant anchor changed")

old_ctor = "worker=new Worker(ANALYSIS_ABILITYFISH_WORKER);analysisWorkers.add(worker);"
new_ctor = "worker=new Worker(ensureEmbeddedAnalysisAbilityFishWorkerUrl());analysisWorkers.add(worker);"
if old_ctor in html:
    html = html.replace(old_ctor, new_ctor, 1)
elif new_ctor not in html:
    raise SystemExit("Analysis Worker constructor anchor changed")

hook = "  window.__ABILITYFISH_ANALYSIS_TEST__=(state,options={})=>requestAbilityFishAnalysis(state,options);\n"
if "window.__ABILITYFISH_ANALYSIS_TEST__" not in html:
    marker = "  async function runAnalysisEngine(){"
    if marker not in html:
        raise SystemExit("runAnalysisEngine anchor changed")
    html = html.replace(marker, hook + marker, 1)

if (
    "ANALYSIS_ABILITYFISH_EMBEDDED_V1" not in html
    or new_ctor not in html
    or "window.__ABILITYFISH_ANALYSIS_TEST__" not in html
):
    raise SystemExit("embedded Analysis runtime did not install")

index_path.write_text(html, encoding="utf-8", newline="")
print(
    f"Embedded AbilityFish Analysis runtime: JS={len(engine_js)} bytes, "
    f"WASM={engine_wasm_path.stat().st_size} bytes"
)
