#!/usr/bin/env python3
"""Disable Fairy's early chess fast-move return while AbilityFish is active."""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: apply_fairy_ability_fastpath_hooks.py PATH_TO_FAIRY_STOCKFISH")
root = Path(sys.argv[1]).resolve()
p = root / "src" / "position.h"
if not p.exists():
    raise SystemExit(f"not a Fairy-Stockfish checkout: {root}")

s = p.read_text()
marker = "ABILITYFISH_EXTENSIBLE_MOVE_PATH_V1"
if marker in s:
    print("AbilityFish extensible movement path already applied")
    raise SystemExit(0)

attacks_old = """  if (var->fastAttacks || var->fastAttacks2)
      return attacks_bb(c, pt, s, byTypeBB[ALL_PIECES]) & board_bb();
"""
attacks_new = """  // ABILITYFISH_EXTENSIBLE_MOVE_PATH_V1
  // Normal chess uses Fairy's fast return. AbilityFish must continue through
  // the extensible path below so permanent movement upgrades are added.
  if (!abilityfishActive && (var->fastAttacks || var->fastAttacks2))
      return attacks_bb(c, pt, s, byTypeBB[ALL_PIECES]) & board_bb();
"""
moves_old = """  if (var->fastAttacks || var->fastAttacks2)
      return moves_bb(c, pt, s, byTypeBB[ALL_PIECES]) & board_bb();
"""
moves_new = """  if (!abilityfishActive && (var->fastAttacks || var->fastAttacks2))
      return moves_bb(c, pt, s, byTypeBB[ALL_PIECES]) & board_bb();
"""
for old, new, label in ((attacks_old, attacks_new, "attacks_from"), (moves_old, moves_new, "moves_from")):
    n = s.count(old)
    if n != 1:
        raise SystemExit(f"{label}: expected one fast-path anchor, found {n}")
    s = s.replace(old, new, 1)

p.write_text(s)
print("Applied AbilityFish extensible movement fast-path hooks")
