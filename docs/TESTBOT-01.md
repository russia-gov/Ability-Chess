# TestBot-01 — restricted multiplayer test opponent

**Status:** developer tool, not a hosted or always-on account. It is launched
manually and deliberately does not create accounts, rooms, or challenges.

The test runner opens a real Chromium browser, signs into a dedicated member
account using the app's existing Supabase Auth flow, watches for a **direct,
unrated** incoming challenge from exactly one permitted username, accepts it
through the site's own challenge handler, and plays ordinary legal moves using
the same `allLegalMoves` and `makeMove` functions as the main browser game.
It checks that the settled local board and points match the authoritative room
snapshot, and prints JSON event logs. This does not use the WIP Analysis engine.

## Before running

1. Use a **staging Supabase project and staging deployment**, not the public
   database, whenever possible. Merely serving the production `index.html`
   from localhost **does not** change the embedded Supabase backend URL.
2. Manually create a dedicated, verified member account for TestBot-01 through
   the normal signup interface. Do not make it a staff or owner account.
3. Install the project's Playwright dependency and Chromium in your dev
   environment (`npm install --no-save playwright`, then
   `npx playwright install chromium`). Do not commit passwords or keys.
4. Set the required environment variables locally:

   - `TESTBOT_EMAIL`: dedicated TestBot-01 member email
   - `TESTBOT_PASSWORD`: that member's password
   - `TESTBOT_ALLOWED_USERNAME`: the *single* player allowed to challenge it
   - `ABILITY_CHESS_URL`: URL of the **staging** site (defaults to
     `http://127.0.0.1:4173/`)

5. When testing a non-local URL, set `TESTBOT_ALLOW_REMOTE=YES` **only after
   verifying** that the deployment points at a test database. The tool does
   not itself know how to distinguish the staging and production database.
6. Run `node scripts/testbot-01.js`, then use the permitted account to issue
   a **direct unrated challenge** to TestBot-01.

For a local static test page, start a separate server, e.g.
`python3 -m http.server 4173`, but do not assume local serving makes
the database local.

Optional settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `TESTBOT_MOVE_DELAY_MS` | `2000` | Time before a bot move (minimum 500 ms) |
| `TESTBOT_MAX_MOVES` | `80` | Maximum bot moves per run (up to 150) |
| `TESTBOT_MAX_MINUTES` | `25` | Maximum run time (up to 120) |
| `TESTBOT_HEADLESS` | `1` | Set `0` to watch its browser |

The process exits after the game finishes or one of the limits is reached.
Closing the bot browser does not end or delete the game.

## What is and is not tested

- **Covered in this first version:** existing member password sign-in, direct
  challenge acceptance, real room polling and versioning, ordinary legal moves,
  normal online move submission, and board/point reconciliation after
  synchronization.
- **Not yet covered:** automated challenge creation, purchases, targeted
  abilities, promotions requiring interaction, load testing, rapid concurrent
  games, reconnection simulations, or production-capacity estimates.
- **Known limitation:** the bot runs only while the command is active, and its
  strategy is intentionally simple (first legal move). It is not a strong
  chess opponent, and it does not prove that real-world concurrency works.
- **Safety restriction:** rated challenges and unknown challengers are never
  accepted. Only one browser/account and one game are operated per run.

The website's multiplayer implementation uses
`ability_chess_list_member_challenges`,
`ability_chess_accept_member_challenge`,
`ability_chess_get_room_live` and
`ability_chess_update_room_action`. The runner calls the actual site's
application functions, rather than bypassing online move validation with
direct database writes.

## Future work

Once a single staging game has been observed successfully, add a second
independent browser session and scripted reconnect test, followed by a
separate staging-only, rate-limited multiple-game test. Do **not** multiply
bot instances against the live Supabase project until capacity and cost
limits have been reviewed.
