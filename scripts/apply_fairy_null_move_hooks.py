#!/usr/bin/env python3
"""Keep Fairy's null-move search side synchronized with AbilityFish state.

A null move is a search heuristic, not a real Ability Chess turn: it must flip
which side Fairy searches without aging timed effects, awarding points, or
consuming an ability.  The copied AbilityState therefore changes only `turn`
and its derived variant key; undo_null_move restores the previous StateInfo.
"""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: apply_fairy_null_move_hooks.py PATH_TO_FAIRY_STOCKFISH")

root = Path(sys.argv[1]).resolve()
path = root / "src" / "position.cpp"
if not path.exists():
    raise SystemExit(f"not a Fairy-Stockfish checkout: missing {path}")

s = path.read_text()
marker = "ABILITYFISH_NULL_MOVE_SYNC_V1"
if marker in s:
    print("AbilityFish null-move synchronization already applied")
    raise SystemExit(0)

old = """  sideToMove = ~sideToMove;\n\n  set_check_info(st);\n\n  st->repetition = 0;\n"""
new = """  sideToMove = ~sideToMove;\n\n  // ABILITYFISH_NULL_MOVE_SYNC_V1\n  // Null-move pruning changes the search side only. Keep the copied\n  // AbilityState aligned with Fairy without advancing Ability Chess\n  // lifecycle/timers; undo_null_move restores the previous StateInfo.\n  if (abilityfishActive)\n  {\n      st->abilityState.turn = af_side(sideToMove);\n      st->abilityState.recompute_key();\n  }\n\n  set_check_info(st);\n\n  st->repetition = 0;\n"""

count = s.count(old)
if count != 1:
    raise SystemExit(f"null-move synchronization anchor changed: expected 1, found {count}")

path.write_text(s.replace(old, new, 1))
print("Applied AbilityFish null-move synchronization")
