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
