# WASM runtime status

AbilityFish now builds against the official interactive Fairy-Stockfish WASM
port at commit `2e874fd689e35e23253c1ef5cfb5065314c24354`. That merge commit contains the
same pinned Fairy-Stockfish source revision used by the native integration gate:
`c19b5f6c66894fdb0e88d0dd100e3885f744760a`.

CI applies the AbilityFish Position/StateInfo, recursive search, root-result and
UCI state-transport patches to that source tree, then builds the interactive
`Stockfish` runtime (`stockfish.js`, `stockfish.wasm`, `stockfish.worker.js`). The
artifact is renamed to `abilityfish-stockfish.*`; `fairy-depth15-worker.js` loads
those local files rather than a CDN engine.

The generated runtime has been instantiated directly and completed an AbilityFish
`go depth 15` search with AbilityFish mode and points transport enabled. CI also
contains a permanent Node runtime smoke test (`scripts/run_wasm_uci_smoke.js`) that
requires the interactive WASM engine to acknowledge AbilityFish mode, report the
requested depth, and return `bestmove` before the artifact is uploaded.

The browser bridge accepts an Ability Chess state object and transports points,
turn/Double-Move state, per-side ability usage, feature flags, timed Shield,
Freeze and Ambush effects, Fortify, Recall last-move state, Portals and permanent
upgrade masks through dedicated UCI commands.

This development artifact is now a real custom AbilityFish UCI runtime. It is not
merged into or deployed from the production `main` branch by this development PR;
production-site activation remains a separate deployment/integration decision.
