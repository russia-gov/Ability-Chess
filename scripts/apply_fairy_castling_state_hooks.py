#!/usr/bin/env python3
"""Make Fairy castling rights follow AbilityFish board mutations."""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: apply_fairy_castling_state_hooks.py PATH_TO_FAIRY_STOCKFISH")

root = Path(sys.argv[1]).resolve()
path = root / "src" / "position.cpp"
if not path.exists():
    raise SystemExit(f"not a Fairy-Stockfish checkout: missing {path}")

s = path.read_text()
marker = "ABILITYFISH_CASTLING_STATE_SYNC_V1"
if marker in s:
    print("AbilityFish castling-state synchronization already applied")
    raise SystemExit(0)

old = """    auto r = abilityfish::apply_action_reversible(st->abilityState, board, a, undo);\n    if (!r.ok) { st = newSt.previous; return false; }\n    if (r.sideChanged) sideToMove = ~sideToMove;\n    set_state(st);\n"""
new = """    auto r = abilityfish::apply_action_reversible(st->abilityState, board, a, undo);\n    if (!r.ok) { st = newSt.previous; return false; }\n\n    // ABILITYFISH_CASTLING_STATE_SYNC_V1\n    // Ability actions can move/remove rooks (or otherwise alter a king/rook\n    // home square) without going through Position::do_move().  Clear every\n    // castling right whose watched square changed, exactly as ordinary Fairy\n    // moves do.  The previous StateInfo retains the original rights for undo.\n    if (st->castlingRights)\n        for (int i = 0; i < 64; ++i)\n        {\n            const auto before = undo.board[i];\n            const auto after = board.piece_at(abilityfish::Square{uint8_t(i)});\n            const bool changed = before.type != after.type\n                              || (before.present() && after.present() && before.side != after.side);\n            if (changed && castlingRightsMask[Square(i)])\n                st->castlingRights &= ~castlingRightsMask[Square(i)];\n        }\n\n    if (r.sideChanged) sideToMove = ~sideToMove;\n    set_state(st);\n"""

count = s.count(old)
if count != 1:
    raise SystemExit(f"ability castling-state anchor changed: expected 1, found {count}")

path.write_text(s.replace(old, new, 1))
print("Applied AbilityFish castling-state synchronization")
