# Trusted multiplayer transition (work in progress)

This branch is a **staging branch**, not a production deployment. Do not merge or execute
the fail-closed SQL until the rollout gates below are satisfied.

## Findings verified against the connected live database (2026-11-15)

* `ability_chess_update_room_action` verifies seat token and expected version but
  accepts `p_game_state` without server-side rule legality, points, turn or
  player-account validation.
* `ability_chess_apply_rating_result` and
  `ability_chess_apply_category_rating_result` trust supplied result, game key
  and opponent rating.
* `ability_chess_tournament_report_result` trusts a participating player's
  self-reported result and can overwrite the tournament game's result.
* `ability_chess_save_game_history` accepts unverified replay and result.
* Existing RLS is enabled, and authenticated profile UPDATE column grants correctly
  deny direct edits to ratings and owner/staff flags.

## API contract for authoritative games

A client must submit a typed action and expected room version, **never** a replacement
game state or winner claim. Actions include board moves (with promotion), ability uses
(with targets), upgrade purchases, draw offers/acceptance, resignation and timeout claims.
The server must:

1. Authenticate the caller for rated/tournament matches and bind it to the stored seat.
2. Lock the room row and ensure game is active, turn owner is correct, and submitted
   `expected_version` matches the authoritative room version.
3. Reconstruct legal actions from the last stored state using the **same pure game
   rules** as the client. Reject invalid moves, abilities, upgrades, point costs,
   check evasion, frozen/shielded/portal/ambush interactions, and illegal sequences.
4. Apply exactly one legal action, update resources/timers/turn stage, detect terminal
   outcome, and append the authoritative action and state snapshot, atomically.
5. At terminal state, finalize both players' category ratings from database-held
   player identities/ratings and tournament scores once, in the same transaction or
   under a unique immutable finalization key.
6. Reject any legacy calls that supply state/results directly once the new path is
   enabled. Preserve replay history server-side. Permit explicit admin corrections
   only through audited privileged operations.

## Tests required before merge and deployment

- Legal normal chess, promotions (including Ambush), castling with Portal,
  en passant, check/mate/stalemate, draw claims
- Every ability and movement upgrade, insufficient material, expiry timing,
  reinforcements, double moves and remaining points
- Bot-vs-human rule parity for each test scenario
- Two-account online play with racing requests, repeated request, stale version,
  wrong account, leaked seat token and a forged position/result
- Rated result applied once to *both* players; fabricated game key, opponent
  rating and outcome rejected
- Tournament win/draw/loss applied once to *both* entries; contradictory or
  subsequent reports rejected; immutable final game result
- Verify under the `anon` and `authenticated` database roles using negative tests.
  Executing SQL as the privileged database owner does not prove client permissions.

## Deployment gates

1. Complete rules extraction and differential testing against the current browser.
2. Add and test authoritative action RPC/Edge Function. Where using an Edge Function,
   ensure a privileged client key is never exposed to the browser and database
   transactions/locking are enforced server-side.
3. Migrate browser online play and rated/tournament resolution to the new API;
   keep Analysis/AbilityFish changes entirely out of scope.
4. Rehearse end-to-end with two test accounts. Deploy code and database changes
   together with a rollback plan and no active competitive matches.
5. Apply `database/competitive_outcome_fail_closed.sql` at the cutover and confirm
   untrusted callers cannot invoke the old outcome APIs.
6. Disable or revoke legacy direct room-state mutation for competitive matches.
   The existing `ability_chess_update_room_action` must NOT remain an escape hatch.

## Why not apply the SQL now?

The live site currently calls legacy result RPCs. Immediately revoking them would
make apparently completed games fail to update ratings/history and could interrupt
tournaments. Staging the revocations in GitHub preserves live play until a coordinated
cutover; it does **not** yet secure production.


## Additional staged implementation on this branch

- `database/verified_room_finalization_staged.sql` creates a service-only,
  immutable, transactionally applied result finalization primitive. It locks
  both profiles and snapshots *both* Elo inputs before any rating changes,
  awards category-rated results to both participants, and updates both
  tournament entries. This SQL is not deployed and must not be considered
  secure until the trusted action handler produces the result.
- `server/game-state-schema.js` is a reusable validation layer that rejects
  malformed boards, missing kings during active games, invalid points, and
  invalid turn/move counters. Its tests live in `server/tests/`.
  **Structural validation is not move legality validation.** A plausible
  board can still be fabricated by a cheating client.
- `scripts/inventory_multiplayer_rules.js` and
  `scripts/examine_multiplayer_flows.js` inventory the 7MB `index.html`
  on a GitHub runner without splitting or rewriting production source.

The game-rule extraction / server-side action reducer remains the release
blocker. No existing gameplay RPC may be labeled authoritative until the
reducer validates and applies all move/ability/upgrade actions.

## Latest staged runtime components (2026-11-15)

- All eleven single-ability intents: \`server/ability-intent.js\`; no client-provided
  costs or effects are accepted. Corresponding security and transition tests pass.
- All movement-upgrade purchases: \`server/upgrade-intent.js\`; server verifies
  prices, ownership, slot limits and replacements. Tests pass.
- Full deterministic *game action* transitions: \`server/turn-reducer.js\`.
  Includes capture rewards, turn switching, effect duration, Double Move
  sequencing, and the browser's extracted checkmate/draw adjudication helpers.
  It is not a complete server clock or network security implementation.
- \`scripts/build_verified_edge_module.js\` creates the self-contained, dependency-free
  ESM module \`supabase/functions/verified-game/rules.mjs\`. CI imports and tests
  it successfully; the generated module is committed to the draft branch.
- \`supabase/functions/verified-game/index.ts\` is a **staged**, unaudited Edge
  endpoint that validates Auth identity and seat ownership, loads the current
  persisted state using a server-only credential, calls the deterministic
  reducer, and commits by expected version. It is not deployed or linked from
  the production UI.
- Terminal action settlement is now invoked from the staged, service-role-only
  action-commit RPC in the same PostgreSQL transaction; isolated tests verify
  ratings are awarded to both participants exactly once.

### Cutover blockers still open

1. Migrate all browser online actions, polling and result handling to the typed
   endpoint. Current \`index.html\` still calls legacy RPCs.
2. Server-create/validate **all** official starting states and tournament settings;
   the current room creation RPCs still accept arbitrary player-submitted JSON.
3. Revoke direct access to all legacy position, action snapshot, room creation,
   rating and tournament-result RPCs at cutover. In particular, the existing
   \`ability_chess_get_room_actions\` snapshot route leaks private hidden Ambush
   state and cannot remain active.
4. Complete authoritative timed-game behavior, draw offers, disconnect handling,
   full two-account adversarial tests, and browser parity checks.
5. Audit and repair any gameplay rule inconsistencies found in those tests.

Do not deploy this draft Edge endpoint or SQL independently: it is **not** safe
as a replacement until the legacy bypasses, initial-state authorization and
client integration are completed.

## Further staged work (November 15, 2026)

- Found a second full-board mutation bypass, public.update_ability_chess_room. The cutover revocation SQL now includes it, alongside ability_chess_update_room_action.
- Created canonical server-owned starting positions and a staged migration that replaces client game_state in existing room, matchmaking and tournament creation RPCs. Tournament genesis uses official tournament settings. Activation and setup still require testing.
- Added redaction of hidden Ambush targets, private log text, replay snapshots and repetition keys in staged live-room read functions and the Edge response projector, with automated tests.
- Patched draft index.html so a rejected move cannot award material points or change halfmove state before move legality succeeds. The patch ran in GitHub Actions and is on this draft branch.
- Added client/verified-online-transport.js: a typed, serialized, version-aware client request transport that never sends replacement board state or client-claimed results. Its tests passed, but live UI integration is not complete.
- Prepared explicit RLS-defense table grant revocations and a post-cutover SQL audit for legacy RPC access.

### Critical remaining integration work

1. Replace every live online action, ability, upgrade, room setup, rematch, draw, resign, poll and result RPC path in the 7MB browser game with typed verified actions.
2. Make room activation and authoritative clocks consistent for casual waiting rooms, direct challenges, seeks and tournaments.
3. Run two-account browser and adversarial tests, including account-bound seats and private abilities.
4. Coordinate Edge deployment, hardened genesis and read RPC deployment, client release and legacy revocations. Do not deploy any piece in isolation.

No staged SQL was applied to the live Supabase project. This PR remains a draft.

## Latest staged verification

- Browser online gameplay now submits typed legal actions via verified Edge transport; two isolated Chromium sessions successfully played e2–e4 and e7–e5 without legacy board or rating mutation RPCs.
- Deno verified-game Edge runtime type check passes.
- Disposable PostgreSQL tests pass for canonical room startup, ratings, tournament points, seat identity, hidden Ambush, and verified per-player history from server action snapshots.
- Adversarial room genesis PostgreSQL tests pass across direct room creation, accepted challenges, rated matchmaking and randomly colored tournament pairings, rejecting player-forged starting boards.
- Tournament token-return and SQL function quoting issues caught in CI were fixed in this draft.

These checks are necessary but insufficient for live launch: the full mixed-ability two-account integration, authoritative clocks, rematch replacement, Supabase staging deployment and coordinated legacy endpoint revocation remain release gates. The production Supabase project has not been changed.

## Secure casual rematch implementation (staged, November 15)

- `database/verified_rematch_staged.sql` adds an RLS-protected, service-only
  per-finished-room rematch offer record and a transactionally locked
  `ability_chess_verified_rematch` RPC. The finished game's board, outcome,
  recorded actions, rating and history are **never** rewritten for a rematch.
- The first player offers; the opponent alone may accept. Declining or
  cancelling removes a pending offer. Concurrent accepts cannot create two rooms.
- Acceptance creates a new server-generated, **unrated** casual room containing
  the official initial position, original mutually accepted settings, reversed
  player colors and completely fresh tokens. Only the caller's new token is
  returned. Both sides can recover their new room by polling the original room.
- Rated and tournament rematches are refused by this protocol. Players must
  use normal rated matchmaking or tournament pairing for another competitive game.
- The verified Edge endpoint handles `offerRematch`, `acceptRematch` and
  `declineRematch`; its GET returns the offer's status even when the
  original game version has not changed.
- The browser transport handles rematch metadata independently of the game's
  version and ignores late poll responses from the previous room.
- The draft game's rematch controls call the verified endpoint and switch
  to the newly assigned room/seat after acceptance.
- Disposable PostgreSQL tests cover authorization, offer/accept/decline,
  fresh state and colors, token rotation, immutable completed game, rated
  rejection and duplicate acceptance. A Chromium two-client rematch test
  was added; consult the latest CI result before considering it verified.
- The post-cutover audit now checks the rematch RPC and table privileges.

### Required coordinated deployment order (NOT executed)

1. Confirm there are no active rated games/tournament matches to interrupt;
   provide users with a maintenance window and ensure rollback assets are saved.
2. Apply the tested `canonical_initial_game_state_staged.sql`, finalizer,
   verified history, verified room start, action commit, hidden-state reads,
   hardened room genesis/challenge activation, **and**
   `verified_rematch_staged.sql` in their tested dependency order.
3. Deploy the matching `verified-game` Edge function and browser assets.
   Never publish the Edge service-role key to a client.
4. Atomically cut over the site and revoke legacy mutation, rating, history
   and unsafe read RPCs with the documented fail-closed migrations.
5. Run `database/verify_secure_cutover.sql` and authenticated adversarial
   move/rematch checks. Confirm the old APIs return permission denied and
   neither player can observe the opponent's hidden Ambush or seat token.
6. If an issue appears, **fail closed** for competitive play. Do not restore
   the vulnerable browser rating or whole-state mutation endpoints as a rollback.

**Still a release blocker:** Real Supabase end-to-end authentication,
clock/timeout/draw and full ability regression with two accounts has not
been performed. No production change is authorized by this document.
