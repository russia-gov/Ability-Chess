#!/usr/bin/env python3
"""Make frozen AbilityFish pieces cease attacking for the frozen turn."""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: apply_fairy_freeze_attack_hooks.py PATH_TO_FAIRY_STOCKFISH")
root = Path(sys.argv[1]).resolve()
h = root / "src" / "position.h"
if not h.exists():
    raise SystemExit(f"not a Fairy-Stockfish checkout: {root}")


def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"{label}: expected one anchor, found {n}")
    return text.replace(old, new, 1)

s = h.read_text()
if "ABILITYFISH_FREEZE_ATTACK_HOOKS_V1" not in s:
    marker = '#define ABILITYFISH_POSITION_HOOKS_V1 1\n'
    s = replace_once(s, marker, marker + '#define ABILITYFISH_FREEZE_ATTACK_HOOKS_V1 1\n', "freeze attack marker")

    old = '''inline Bitboard Position::attackers_to(Square s) const {
  return attackers_to(s, pieces());
}

inline Bitboard Position::attackers_to(Square s, Color c) const {
  return attackers_to(s, byTypeBB[ALL_PIECES], c);
}

inline Bitboard Position::attackers_to(Square s, Bitboard occupied, Color c) const {
  return attackers_to(s, occupied, c, byTypeBB[JANGGI_CANNON]);
}
'''
    new = '''inline Bitboard Position::attackers_to(Square s) const {
  Bitboard b = attackers_to(s, pieces());
  if (abilityfishActive)
      for (Color c : {WHITE, BLACK})
      {
          const auto& frozen = st->abilityState.side[abilityfish::side_index(c == WHITE ? abilityfish::Side::White : abilityfish::Side::Black)].frozenEnemy;
          if (frozen.active && frozen.square.valid())
              b &= ~square_bb(Square(frozen.square.index));
      }
  return b;
}

inline Bitboard Position::attackers_to(Square s, Color c) const {
  Bitboard b = attackers_to(s, byTypeBB[ALL_PIECES], c);
  if (abilityfishActive)
  {
      const auto& frozen = st->abilityState.side[abilityfish::side_index(c == WHITE ? abilityfish::Side::White : abilityfish::Side::Black)].frozenEnemy;
      if (frozen.active && frozen.square.valid())
          b &= ~square_bb(Square(frozen.square.index));
  }
  return b;
}

inline Bitboard Position::attackers_to(Square s, Bitboard occupied, Color c) const {
  Bitboard b = attackers_to(s, occupied, c, byTypeBB[JANGGI_CANNON]);
  if (abilityfishActive)
  {
      const auto& frozen = st->abilityState.side[abilityfish::side_index(c == WHITE ? abilityfish::Side::White : abilityfish::Side::Black)].frozenEnemy;
      if (frozen.active && frozen.square.valid())
          b &= ~square_bb(Square(frozen.square.index));
  }
  return b;
}
'''
    s = replace_once(s, old, new, "attackers_to wrappers")

    attack_from = '''inline Bitboard Position::attacks_from(Color c, PieceType pt, Square s) const {
  if (var->fastAttacks || var->fastAttacks2)
'''
    attack_from_new = '''inline Bitboard Position::attacks_from(Color c, PieceType pt, Square s) const {
  if (abilityfishActive)
  {
      const auto& frozen = st->abilityState.side[abilityfish::side_index(c == WHITE ? abilityfish::Side::White : abilityfish::Side::Black)].frozenEnemy;
      if (frozen.active && frozen.square.valid() && Square(frozen.square.index) == s)
          return Bitboard(0);
  }
  if (var->fastAttacks || var->fastAttacks2)
'''
    s = replace_once(s, attack_from, attack_from_new, "attacks_from freeze filter")
    h.write_text(s)

print("Applied AbilityFish frozen-piece attack hooks")
