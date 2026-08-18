#!/usr/bin/env python3
"""Add reversible AbilityFish Portal routing to normal Fairy moves."""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: apply_fairy_portal_hooks.py PATH_TO_FAIRY_STOCKFISH")
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
if "ABILITYFISH_PORTAL_STATE_V1" not in hs:
    hs = replace_once(
        hs,
        "  bool       abilityfishAmbushCapturerPromoted;\n#define ABILITYFISH_AMBUSH_STATE_V1 1\n",
        "  bool       abilityfishAmbushCapturerPromoted;\n"
        "  bool       abilityfishPortalTriggered;\n"
        "  Square     abilityfishPortalEntry;\n"
        "  Square     abilityfishPortalExit;\n"
        "#define ABILITYFISH_AMBUSH_STATE_V1 1\n"
        "#define ABILITYFISH_PORTAL_STATE_V1 1\n",
        "portal StateInfo fields",
    )
    h.write_text(hs)

cs = c.read_text()
if "ABILITYFISH_PORTAL_CPP_V1" not in cs:
    cs = replace_once(
        cs,
        "#define ABILITYFISH_AMBUSH_CPP_V1 1\n",
        "#define ABILITYFISH_AMBUSH_CPP_V1 1\n#define ABILITYFISH_PORTAL_CPP_V1 1\n",
        "portal cpp marker",
    )

    init_anchor = """  st->abilityfishAmbushUnpromotedCapturer = NO_PIECE;
  st->abilityfishAmbushCapturerPromoted = false;
"""
    init_repl = init_anchor + """  st->abilityfishPortalTriggered = false;
  st->abilityfishPortalEntry = SQ_NONE;
  st->abilityfishPortalExit = SQ_NONE;
"""
    cs = replace_once(cs, init_anchor, init_repl, "portal move-state initialization")

    # Ambush is intentionally already resolved by the preceding hook. If it
    # destroyed the capturer, piece_on(to) is empty and Portal does nothing.
    key_anchor = """  // Update the key with the final value
  st->key = k;
"""
    portal_do = """  if (abilityfishActive && to >= SQ_A1 && to <= SQ_H8 && piece_on(to) != NO_PIECE)
  {
      Square portalExit = SQ_NONE;
      for (const auto& portal : st->abilityState.portals)
      {
          if (!portal.active || !portal.a.valid() || !portal.b.valid() || portal.ownerTurnsRemaining == 0)
              continue;
          if (portal.a.index == uint8_t(to)) portalExit = Square(portal.b.index);
          else if (portal.b.index == uint8_t(to)) portalExit = Square(portal.a.index);
          if (portalExit != SQ_NONE) break;
      }
      if (portalExit != SQ_NONE && empty(portalExit))
      {
          Piece routed = piece_on(to);
          st->abilityfishPortalTriggered = true;
          st->abilityfishPortalEntry = to;
          st->abilityfishPortalExit = portalExit;
          move_piece(to, portalExit);
          k ^= Zobrist::psq[routed][to] ^ Zobrist::psq[routed][portalExit];
          if (type_of(routed) == PAWN)
              st->pawnKey ^= Zobrist::psq[routed][to] ^ Zobrist::psq[routed][portalExit];
      }
  }

  // Update the key with the final value
  st->key = k;
"""
    cs = replace_once(cs, key_anchor, portal_do, "portal routing")

    state_anchor = """      if (st->abilityfishAmbushTriggered && to >= SQ_A1 && to <= SQ_H8)
          ast.remove_piece_state(ability_sq(to));
      auto& usState = ast.side[abilityfish::side_index(af_side(us))];
"""
    state_repl = """      if (st->abilityfishAmbushTriggered && to >= SQ_A1 && to <= SQ_H8)
          ast.remove_piece_state(ability_sq(to));
      if (st->abilityfishPortalTriggered && st->abilityfishPortalEntry != SQ_NONE && st->abilityfishPortalExit != SQ_NONE)
          ast.move_piece_state(ability_sq(st->abilityfishPortalEntry), ability_sq(st->abilityfishPortalExit));
      auto& usState = ast.side[abilityfish::side_index(af_side(us))];
"""
    cs = replace_once(cs, state_anchor, state_repl, "portal attached-state routing")

    last_anchor = """      if (!st->abilityfishAmbushTriggered && from >= SQ_A1 && from <= SQ_H8 && to >= SQ_A1 && to <= SQ_H8 && type_of(pc) != KING)
          usState.lastMove = {ability_sq(from), ability_sq(to), uint8_t(pc), true};
"""
    last_repl = """      if (!st->abilityfishAmbushTriggered && from >= SQ_A1 && from <= SQ_H8 && to >= SQ_A1 && to <= SQ_H8 && type_of(pc) != KING)
      {
          Square finalTo = st->abilityfishPortalTriggered ? st->abilityfishPortalExit : to;
          usState.lastMove = {ability_sq(from), ability_sq(finalTo), uint8_t(pc), true};
      }
"""
    cs = replace_once(cs, last_anchor, last_repl, "portal last-move destination")

    undo_anchor = """  if (abilityfishActive && st->abilityfishAmbushTriggered && piece_on(to) == NO_PIECE)
      put_piece(st->abilityfishAmbushCapturer, to, st->abilityfishAmbushCapturerPromoted,
                st->abilityfishAmbushUnpromotedCapturer);
  Piece pc = piece_on(to);
"""
    undo_repl = """  if (abilityfishActive && st->abilityfishAmbushTriggered && piece_on(to) == NO_PIECE)
      put_piece(st->abilityfishAmbushCapturer, to, st->abilityfishAmbushCapturerPromoted,
                st->abilityfishAmbushUnpromotedCapturer);
  if (abilityfishActive && st->abilityfishPortalTriggered
      && st->abilityfishPortalExit != SQ_NONE && piece_on(st->abilityfishPortalExit) != NO_PIECE
      && piece_on(to) == NO_PIECE)
      move_piece(st->abilityfishPortalExit, to);
  Piece pc = piece_on(to);
"""
    cs = replace_once(cs, undo_anchor, undo_repl, "portal undo restore")

    c.write_text(cs)

print("Applied AbilityFish Portal routing hooks")
