#!/usr/bin/env python3
"""Validate AbilityFish board moves against the final post-ability board."""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: apply_fairy_post_effect_legality_hooks.py PATH_TO_FAIRY_STOCKFISH")
root = Path(sys.argv[1]).resolve()
p = root / "src" / "position.cpp"
if not p.exists():
    raise SystemExit(f"not a Fairy-Stockfish checkout: {root}")

s = p.read_text()
if "ABILITYFISH_POST_EFFECT_LEGALITY_V1" in s:
    print("AbilityFish post-effect legality hooks already applied")
    raise SystemExit(0)

anchor = """  Bitboard occupied = (type_of(m) != DROP ? pieces() ^ from : pieces()) | to;

  // Flying general rule and bikjang
"""
if s.count(anchor) != 1:
    raise SystemExit(f"post-effect legality anchor: expected one match, found {s.count(anchor)}")

hook = r'''  // ABILITYFISH_POST_EFFECT_LEGALITY_V1
  // Portal routing and Ambush retaliation happen after the ordinary board move.
  // Their final board can therefore have different king safety from the normal
  // chess destination. For affected moves, use AbilityFish's reversible
  // make/unmake path and judge the actual final position.
  if (abilityfishActive && type_of(m) != DROP && type_of(m) != CASTLING)
  {
      bool postEffect = false;
      Square captureSq = type_of(m) == EN_PASSANT ? capture_square(to) : to;

      const auto& enemyAmbush = st->abilityState.side[
          abilityfish::side_index(abilityfish::other(af_side(us)))].ambush;
      if (capture(m) && captureSq >= SQ_A1 && captureSq <= SQ_H8
          && enemyAmbush.active && enemyAmbush.square.valid()
          && enemyAmbush.square.index == uint8_t(captureSq))
          postEffect = true;

      if (!postEffect && to >= SQ_A1 && to <= SQ_H8)
          for (const auto& portal : st->abilityState.portals)
          {
              if (!portal.active || !portal.a.valid() || !portal.b.valid()
                  || portal.ownerTurnsRemaining == 0)
                  continue;
              Square exit = SQ_NONE;
              if (portal.a.index == uint8_t(to)) exit = Square(portal.b.index);
              else if (portal.b.index == uint8_t(to)) exit = Square(portal.a.index);
              if (exit != SQ_NONE && empty(exit))
              {
                  postEffect = true;
                  break;
              }
          }

      if (postEffect)
      {
          Position* self = const_cast<Position*>(this);
          StateInfo finalSt;
          ASSERT_ALIGNED(&finalSt, Eval::NNUE::CacheLineSize);
          self->do_move(m, finalSt, false);
          bool safe = true;
          if (self->count<KING>(us))
          {
              Square ownKing = self->square<KING>(us);
              safe = !self->attackers_to(ownKing, self->side_to_move());
          }
          self->undo_move(m);
          return safe;
      }
  }

  Bitboard occupied = (type_of(m) != DROP ? pieces() ^ from : pieces()) | to;

  // Flying general rule and bikjang
'''
s = s.replace(anchor, hook, 1)
p.write_text(s)
print("Applied AbilityFish post-effect king-safety legality hooks")
