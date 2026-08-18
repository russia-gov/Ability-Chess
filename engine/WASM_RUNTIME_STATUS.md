# WASM runtime status

The CI Emscripten gate compiles the fully patched Fairy-Stockfish source tree,
including Position/StateInfo, AbilityAction search recursion and root-result
transport. This proves the integration is accepted by the WASM compiler.

However, upstream `Makefile_js` produces the Embind `ffish.js` library API, not
the interactive `stockfish.js` worker API used by the current browser worker.
Therefore the compiled artifact is **not yet wired into `fairy-depth15-worker.js`**.
The worker intentionally remains on the official CDN engine until a search entry
point is exported from the custom WASM module or a dedicated UCI WASM wrapper is
built. Shipping the compiled file while silently continuing to analyze with the
CDN engine would give false confidence that AbilityFish search was live.
