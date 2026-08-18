#!/usr/bin/env python3
"""Add reversible AbilityFish Ambush capture semantics to a prepared Fairy tree."""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: apply_fairy_ambush_hooks.py PATH_TO_FAIRY_STOCKFISH")
root = Path(sys.argv[1]).resolve()
h = root / "src" / "position.h"
c = root / "src" / "position.cpp"
if not h.exists() or not c.exists():
    raise SystemExit(f"not a Fairy-Stockfish checkout: {root}")


def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"{label}: expected one anchor, found {n}")
    return text.replace(old, new, 1)

hs = h.read_text()
if "ABILITYFISH_AMBUSH_STATE_V1" not in hs:
    hs = replace_once(
        hs,
        "  Piece      capturedPiece;\n  Square     captureSquare; // when != to_sq, e.g., en passant\n",
        "  Piece      capturedPiece;\n"
        "  Piece      abilityfishAmbushCapturer;\n"
        "  Piece      abilityfishAmbushUnpromotedCapturer;\n"
        "  bool       abilityfishAmbushTriggered;\n"
        "  bool       abilityfishAmbushCapturerPromoted;\n"
        "#define ABILITYFISH_AMBUSH_STATE_V1 1\n"
        "  Square     captureSquare; // when != to_sq, e.g., en passant\n",
        "ambush StateInfo fields",
    )
    h.write_text(hs)

cs = c.read_text()
if "ABILITYFISH_AMBUSH_CPP_V1" not in cs:
    cs = replace_once(
        cs,
        "#define ABILITYFISH_POSITION_CPP_HOOKS_V1 1\n",
        "#define ABILITYFISH_POSITION_CPP_HOOKS_V1 1\n#define ABILITYFISH_AMBUSH_CPP_V1 1\n",
        "ambush cpp marker",
    )

    # StateInfo fields below offsetof(StateInfo, key) are not copied from the
    # parent position, so initialize Ambush bookkeeping for every move node.
    move_init_anchor = """  newSt.previous = st;
  st = &newSt;
  st->move = m;
"""
    move_init_repl = """  newSt.previous = st;
  st = &newSt;
  st->move = m;
  st->abilityfishAmbushTriggered = false;
  st->abilityfishAmbushCapturer = NO_PIECE;
  st->abilityfishAmbushUnpromotedCapturer = NO_PIECE;
  st->abilityfishAmbushCapturerPromoted = false;
"""
    cs = replace_once(cs, move_init_anchor, move_init_repl, "ambush move-state initialization")

    # A king may not capture an ambushed piece because Ambush destroys the capturer.
    legal_anchor = """      if (!abilityfish::normal_move_allowed(st->abilityState, af_side(us), ability_sq(from_sq(m)), abilityCapture))
          return false;
  }
"""
    legal_repl = """      if (!abilityfish::normal_move_allowed(st->abilityState, af_side(us), ability_sq(from_sq(m)), abilityCapture))
          return false;
      const auto& enemyAmbush = st->abilityState.side[abilityfish::side_index(abilityfish::other(af_side(us)))].ambush;
      if (enemyAmbush.active && abilityCapture.valid() && enemyAmbush.square.index == abilityCapture.index
          && type_of(piece_on(from_sq(m))) == KING)
          return false;
  }
"""
    cs = replace_once(cs, legal_anchor, legal_repl, "ambush king-capture legality")

    # After Fairy has completed the board move but before the final key is stored,
    # remove the capturing piece if the captured square carried an enemy Ambush.
    key_anchor = """  // Update the key with the final value
  st->key = k;
"""
    ambush_do = """  if (abilityfishActive && captured)
  {
      Square abilityCaptureSquare = type_of(m) == EN_PASSANT ? st->captureSquare : to;
      const auto& enemyAmbush = st->abilityState.side[abilityfish::side_index(abilityfish::other(af_side(us)))].ambush;
      if (abilityCaptureSquare >= SQ_A1 && abilityCaptureSquare <= SQ_H8
          && enemyAmbush.active && enemyAmbush.square.index == ability_sq(abilityCaptureSquare).index)
      {
          Piece doomed = piece_on(to);
          if (doomed != NO_PIECE && type_of(doomed) != KING)
          {
              st->abilityfishAmbushTriggered = true;
              st->abilityfishAmbushCapturer = doomed;
              st->abilityfishAmbushCapturerPromoted = is_promoted(to);
              st->abilityfishAmbushUnpromotedCapturer = unpromoted_piece_on(to);

              if (type_of(doomed) == PAWN)
                  st->pawnKey ^= Zobrist::psq[doomed][to];
              else
                  st->nonPawnMaterial[us] -= PieceValue[MG][doomed];

              bool doomedPromoted = is_promoted(to);
              remove_piece(to);
              board[to] = NO_PIECE;
              k ^= Zobrist::psq[doomed][to];
              st->materialKey ^= Zobrist::psq[doomed][pieceCount[doomed]];
              if (doomedPromoted)
                  promotedPieces &= ~square_bb(to);
          }
      }
  }

  // Update the key with the final value
  st->key = k;
"""
    cs = replace_once(cs, key_anchor, ambush_do, "ambush capturer removal")

    # State attached to the exploded capturer must disappear too, and Recall must
    # not remember a piece that no longer exists.
    state_anchor = """      if (from >= SQ_A1 && from <= SQ_H8 && to >= SQ_A1 && to <= SQ_H8 && from != to)
          ast.move_piece_state(ability_sq(from), ability_sq(to));
      auto& usState = ast.side[abilityfish::side_index(af_side(us))];
"""
    state_repl = """      if (from >= SQ_A1 && from <= SQ_H8 && to >= SQ_A1 && to <= SQ_H8 && from != to)
          ast.move_piece_state(ability_sq(from), ability_sq(to));
      if (st->abilityfishAmbushTriggered && to >= SQ_A1 && to <= SQ_H8)
          ast.remove_piece_state(ability_sq(to));
      auto& usState = ast.side[abilityfish::side_index(af_side(us))];
"""
    cs = replace_once(cs, state_anchor, state_repl, "ambush AbilityState cleanup")

    last_move_anchor = """      if (from >= SQ_A1 && from <= SQ_H8 && to >= SQ_A1 && to <= SQ_H8 && type_of(pc) != KING)
          usState.lastMove = {ability_sq(from), ability_sq(to), uint8_t(pc), true};
"""
    last_move_repl = """      if (!st->abilityfishAmbushTriggered && from >= SQ_A1 && from <= SQ_H8 && to >= SQ_A1 && to <= SQ_H8 && type_of(pc) != KING)
          usState.lastMove = {ability_sq(from), ability_sq(to), uint8_t(pc), true};
"""
    cs = replace_once(cs, last_move_anchor, last_move_repl, "ambush Recall history")

    # The normal Fairy undo expects the moved piece to be on `to`. Restore the
    # exploded capturer first; the existing undo code then returns it to `from`
    # and restores the captured Ambush piece normally.
    undo_anchor = """  Color us = sideToMove;
  Square from = from_sq(m);
  Square to = to_sq(m);
  Piece pc = piece_on(to);
"""
    undo_repl = """  Color us = sideToMove;
  Square from = from_sq(m);
  Square to = to_sq(m);
  if (abilityfishActive && st->abilityfishAmbushTriggered && piece_on(to) == NO_PIECE)
      put_piece(st->abilityfishAmbushCapturer, to, st->abilityfishAmbushCapturerPromoted,
                st->abilityfishAmbushUnpromotedCapturer);
  Piece pc = piece_on(to);
"""
    cs = replace_once(cs, undo_anchor, undo_repl, "ambush undo restore")

    c.write_text(cs)

print("Applied AbilityFish Ambush capture hooks")
