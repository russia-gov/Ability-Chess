#!/usr/bin/env python3
"""Reject king-capture moves in AbilityFish's ordinary chess move generator.

Fairy-Stockfish supports many variants where capturing a royal piece may be
meaningful. AbilityChess does not: kings cannot be captured. The stock search
can otherwise attempt a pseudo-legal capture of KING and abort in do_move.
Restrict this guard to AbilityFish mode to leave upstream variants unaffected.
"""
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else "vendor/Fairy-Stockfish")
p=root/"src"/"position.cpp"
s=p.read_text()
marker="// ABILITYFISH_KING_CAPTURE_GUARD_V1"
if marker in s:
    print("King-capture legality guard already applied")
    raise SystemExit(0)
anchor="""bool Position::legal(Move m) const {

  assert(is_ok(m));
  assert(type_of(m) != DROP || piece_drops());
"""
if s.count(anchor)!=1:
    raise SystemExit("Fairy Position::legal entry anchor changed")
new="""bool Position::legal(Move m) const {

  assert(is_ok(m));
  assert(type_of(m) != DROP || piece_drops());

  // ABILITYFISH_KING_CAPTURE_GUARD_V1
  // AbilityChess follows ordinary chess king safety: a captured king is
  // never a legal destination, even under temporary movement modifiers.
  // Castling may have a friendly rook on the encoded destination square.
  if (abilityfish_active() && type_of(m) != CASTLING
      && type_of(piece_on(to_sq(m))) == KING)
      return false;
"""
s=s.replace(anchor,new,1)
p.write_text(s)
print("Applied AbilityFish-only king capture legality filter")
