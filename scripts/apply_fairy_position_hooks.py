#!/usr/bin/env python3
"""Patch pinned Fairy-Stockfish with AbilityFish Position/StateInfo hooks."""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: apply_fairy_position_hooks.py PATH_TO_FAIRY_STOCKFISH")
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
if "ABILITYFISH_POSITION_HOOKS_V1" not in hs:
    hs = replace_once(hs,
        '#include "movegen.h"\n',
        '#include "movegen.h"\n#include "abilityfish/ability_rules.h"\n#define ABILITYFISH_POSITION_HOOKS_V1 1\n',
        "position.h include")
    hs = replace_once(hs,
        '  Bitboard gatesBB[COLOR_NB];\n\n  // Not copied when making a move',
        '  Bitboard gatesBB[COLOR_NB];\n\n  abilityfish::AbilityState abilityState{};\n\n  // Not copied when making a move',
        "StateInfo copied prefix")
    hs = replace_once(hs,
        '  void undo_null_move();\n\n  // Static Exchange Evaluation',
        '''  void undo_null_move();\n\n  void set_abilityfish_active(bool active);\n  bool abilityfish_active() const;\n  abilityfish::AbilityState& ability_state();\n  const abilityfish::AbilityState& ability_state() const;\n  std::vector<abilityfish::AbilityAction> ability_actions();\n  bool do_ability_action(const abilityfish::AbilityAction& a, StateInfo& newSt, abilityfish::ActionUndo& undo);\n  void undo_ability_action(abilityfish::ActionUndo& undo);\n\n  // Static Exchange Evaluation''',
        "Position public ability API")
    hs = replace_once(hs,
        '  bool chess960;\n',
        '  bool chess960;\n  bool abilityfishActive;\n',
        "Position active flag")
    hs = replace_once(hs,
        """inline Key Position::key() const {
  return st->rule50 < 14 ? st->key
                         : st->key ^ make_key((st->rule50 - 14) / 8);
}
""",
        """inline Key Position::key() const {
  Key k = st->rule50 < 14 ? st->key
                          : st->key ^ make_key((st->rule50 - 14) / 8);
  return abilityfishActive ? k ^ Key(st->abilityState.variantKey) : k;
}
""",
        "Position TT key")
    h.write_text(hs)

cs = c.read_text()
if "ABILITYFISH_POSITION_CPP_HOOKS_V1" not in cs:
    cs = replace_once(cs,
        '#include "syzygy/tbprobe.h"\n',
        '#include "syzygy/tbprobe.h"\n#define ABILITYFISH_POSITION_CPP_HOOKS_V1 1\n',
        "position.cpp include marker")

    adapter = r'''
namespace {

abilityfish::Side af_side(Color c) {
    return c == WHITE ? abilityfish::Side::White : abilityfish::Side::Black;
}
Color af_color(abilityfish::Side s) {
    return s == abilityfish::Side::White ? WHITE : BLACK;
}
int af_capture_points(PieceType pt) {
    switch (pt) {
    case PAWN: return 1;
    case KNIGHT: return 3;
    case BISHOP: return 3;
    case ROOK: return 5;
    case QUEEN: return 9;
    default: return 0;
    }
}
abilityfish::PieceType af_piece_type(PieceType pt) {
    switch (pt) {
    case PAWN: return abilityfish::PieceType::Pawn;
    case KNIGHT: return abilityfish::PieceType::Knight;
    case BISHOP: return abilityfish::PieceType::Bishop;
    case ROOK: return abilityfish::PieceType::Rook;
    case QUEEN: return abilityfish::PieceType::Queen;
    case KING: return abilityfish::PieceType::King;
    default: return abilityfish::PieceType::None;
    }
}
PieceType fairy_piece_type(abilityfish::PieceType pt) {
    switch (pt) {
    case abilityfish::PieceType::Pawn: return PAWN;
    case abilityfish::PieceType::Knight: return KNIGHT;
    case abilityfish::PieceType::Bishop: return BISHOP;
    case abilityfish::PieceType::Rook: return ROOK;
    case abilityfish::PieceType::Queen: return QUEEN;
    case abilityfish::PieceType::King: return KING;
    default: return NO_PIECE_TYPE;
    }
}
Square af_sq(abilityfish::Square s) { return s.valid() ? Square(s.index) : SQ_NONE; }
abilityfish::Square ability_sq(Square s) { return s >= SQ_A1 && s <= SQ_H8 ? abilityfish::Square{uint8_t(s)} : abilityfish::Square{}; }

class AbilityFishBoardAdapter final : public abilityfish::BoardAdapter {
  Position& p;

  bool king_safe(abilityfish::Side s) const {
      Color c = af_color(s);
      Square k = p.square<KING>(c);
      return k == SQ_NONE || !(p.attackers_to(k, ~c) & p.pieces(~c));
  }

  template<class Fn>
  bool simulate(Fn&& fn, abilityfish::Side s) {
      std::array<abilityfish::PieceInfo, 64> before{};
      for (int i = 0; i < 64; ++i) before[i] = piece_at(abilityfish::Square{uint8_t(i)});
      fn();
      bool safe = king_safe(s);
      for (int i = 0; i < 64; ++i) set_piece_exact(abilityfish::Square{uint8_t(i)}, before[i]);
      return safe;
  }

public:
  explicit AbilityFishBoardAdapter(Position& pos) : p(pos) {}

  abilityfish::PieceInfo piece_at(abilityfish::Square s) const override {
      Square q = af_sq(s);
      if (q == SQ_NONE) return {};
      Piece pc = p.piece_on(q);
      if (pc == NO_PIECE) return {};
      return {af_piece_type(type_of(pc)), af_side(color_of(pc)), uint8_t(pc)};
  }
  bool empty(abilityfish::Square s) const override { return p.empty(af_sq(s)); }
  abilityfish::Square king_square(abilityfish::Side s) const override { return ability_sq(p.square<KING>(af_color(s))); }
  bool in_check(abilityfish::Side s) const override {
      Color c = af_color(s); Square k = p.square<KING>(c);
      return k != SQ_NONE && bool(p.attackers_to(k, ~c) & p.pieces(~c));
  }
  bool square_attacked_by(abilityfish::Square s, abilityfish::Side a) const override {
      Color c = af_color(a); return bool(p.attackers_to(af_sq(s), c) & p.pieces(c));
  }
  bool piece_attacks_square(abilityfish::Square f, abilityfish::Square t) const override {
      auto pi = piece_at(f); if (!pi.present()) return false;
      return bool(p.attacks_from(af_color(pi.side), fairy_piece_type(pi.type), af_sq(f)) & af_sq(t));
  }

  bool swap_would_be_safe(abilityfish::Square a, abilityfish::Square b, abilityfish::Side s) const override {
      auto* self = const_cast<AbilityFishBoardAdapter*>(this);
      return self->simulate([&]{ self->swap_pieces(a,b); }, s);
  }
  bool recall_would_be_safe(abilityfish::Square f, abilityfish::Square t, abilityfish::Side s) const override {
      auto* self = const_cast<AbilityFishBoardAdapter*>(this);
      return self->simulate([&]{ self->move_piece(f,t); }, s);
  }
  bool teleport_would_be_safe(abilityfish::Square f, abilityfish::Square t, abilityfish::Side s) const override {
      auto* self = const_cast<AbilityFishBoardAdapter*>(this);
      return self->simulate([&]{ self->move_piece(f,t); }, s);
  }
  bool teleport_would_attack_enemy_king(abilityfish::Square f, abilityfish::Square t, abilityfish::Side s) const override {
      auto* self = const_cast<AbilityFishBoardAdapter*>(this);
      bool attacks = false;
      self->simulate([&]{ self->move_piece(f,t); Color them = ~af_color(s); Square k = p.square<KING>(them); attacks = k != SQ_NONE && self->piece_attacks_square(t, ability_sq(k)); }, s);
      return attacks;
  }
  bool bomb_would_be_safe(abilityfish::Square c, abilityfish::Side s) const override {
      auto* self = const_cast<AbilityFishBoardAdapter*>(this);
      int cr = int(c.index) / 8, cf = int(c.index) % 8;
      return self->simulate([&]{
          for (int i=0;i<64;i++) if (std::abs(i/8-cr)<=1 && std::abs(i%8-cf)<=1 && self->piece_at(abilityfish::Square{uint8_t(i)}).present()) self->remove_piece(abilityfish::Square{uint8_t(i)});
      }, s);
  }

  void swap_pieces(abilityfish::Square a, abilityfish::Square b) override {
      auto pa = piece_at(a), pb = piece_at(b); set_piece_exact(a,pb); set_piece_exact(b,pa);
  }
  void move_piece(abilityfish::Square f, abilityfish::Square t) override {
      auto pc = piece_at(f); set_piece_exact(f,{}); set_piece_exact(t,pc);
  }
  void remove_piece(abilityfish::Square s) override { set_piece_exact(s,{}); }
  void replace_piece(abilityfish::Square s, abilityfish::PieceType pt, abilityfish::Side side) override {
      set_piece_exact(s,{pt,side,uint8_t(make_piece(af_color(side),fairy_piece_type(pt)))});
  }
  void set_piece_exact(abilityfish::Square s, abilityfish::PieceInfo pi) override {
      Square q = af_sq(s); if (q == SQ_NONE) return;
      if (p.piece_on(q) != NO_PIECE) p.remove_piece(q);
      if (pi.present()) {
          Piece pc = make_piece(af_color(pi.side), fairy_piece_type(pi.type));
          p.put_piece(pc, q);
      }
  }
};

} // namespace
'''
    cs = replace_once(cs, 'namespace Stockfish {\n', 'namespace Stockfish {\n' + adapter + '\n', "adapter insertion")

    cs = replace_once(cs,
        '  var = v;\n  ss >> std::noskipws;\n',
        '  var = v;\n  abilityfishActive = false;\n  ss >> std::noskipws;\n',
        "Position set active init")

    anchor = '  set_state(si);\n\n  assert(pos_is_ok());\n'
    if anchor in cs:
        cs = replace_once(cs, anchor,
            '  si->abilityState = {};\n  si->abilityState.turn = af_side(sideToMove);\n  si->abilityState.recompute_key();\n  set_state(si);\n\n  assert(pos_is_ok());\n',
            "initial AbilityState")

    cs = replace_once(cs,
        '  sideToMove = ~sideToMove;\n  if (counting_rule())\n',
        '''  if (abilityfishActive)\n  {\n      auto& ast = st->abilityState;\n      if (captured && st->captureSquare >= SQ_A1 && st->captureSquare <= SQ_H8)\n          ast.squareUpgrades[uint8_t(st->captureSquare)] = 0;\n      if (from >= SQ_A1 && from <= SQ_H8 && to >= SQ_A1 && to <= SQ_H8 && from != to)\n          ast.move_piece_state(ability_sq(from), ability_sq(to));\n      auto& usState = ast.side[abilityfish::side_index(af_side(us))];\n      if (captured)\n          usState.points = uint8_t(std::min(255, int(usState.points) + af_capture_points(type_of(captured))));\n      if (from >= SQ_A1 && from <= SQ_H8 && to >= SQ_A1 && to <= SQ_H8 && type_of(pc) != KING)\n          usState.lastMove = {ability_sq(from), ability_sq(to), uint8_t(pc), true};\n      auto transition = abilityfish::transition_after_normal_move(ast, false);\n      sideToMove = transition.sideChanged ? ~sideToMove : sideToMove;\n      if (!transition.sideChanged)\n      {\n          st->key ^= Zobrist::side;\n          st->checkersBB = count<KING>(sideToMove) ? attackers_to(square<KING>(sideToMove), ~sideToMove) & pieces(~sideToMove) : Bitboard(0);\n      }\n  }\n  else\n      sideToMove = ~sideToMove;\n  if (counting_rule())\n''',
        "normal move side transition")

    cs = replace_once(cs,
        '  sideToMove = ~sideToMove;\n\n  Color us = sideToMove;\n',
        '  sideToMove = abilityfishActive && st->previous ? af_color(st->previous->abilityState.turn) : ~sideToMove;\n\n  Color us = sideToMove;\n',
        "undo side restore")

    methods = r'''

void Position::set_abilityfish_active(bool active) {
    abilityfishActive = active;
    if (active) {
        st->abilityState.turn = af_side(sideToMove);
        st->abilityState.recompute_key();
    }
}

bool Position::abilityfish_active() const { return abilityfishActive; }
abilityfish::AbilityState& Position::ability_state() { return st->abilityState; }
const abilityfish::AbilityState& Position::ability_state() const { return st->abilityState; }

std::vector<abilityfish::AbilityAction> Position::ability_actions() {
    if (!abilityfishActive) return {};
    AbilityFishBoardAdapter board(*this);
    return abilityfish::generate_meta_actions(st->abilityState, board);
}

bool Position::do_ability_action(const abilityfish::AbilityAction& a, StateInfo& newSt, abilityfish::ActionUndo& undo) {
    if (!abilityfishActive || &newSt == st) return false;
    std::memcpy(static_cast<void*>(&newSt), static_cast<void*>(st), offsetof(StateInfo, key));
    newSt.previous = st;
    st = &newSt;
    AbilityFishBoardAdapter board(*this);
    auto r = abilityfish::apply_action_reversible(st->abilityState, board, a, undo);
    if (!r.ok) { st = newSt.previous; return false; }
    if (r.sideChanged) sideToMove = ~sideToMove;
    set_state(st);
    st->previous = newSt.previous;
    set_check_info(st);
    return true;
}

void Position::undo_ability_action(abilityfish::ActionUndo& undo) {
    if (!abilityfishActive || !st->previous) return;
    StateInfo* child = st;
    AbilityFishBoardAdapter board(*this);
    abilityfish::undo_action(child->abilityState, board, undo);
    sideToMove = af_color(child->previous->abilityState.turn);
    st = child->previous;
}
'''
    cs = cs.replace('\n} // namespace Stockfish\n', methods + '\n} // namespace Stockfish\n', 1)
    c.write_text(cs)

print("Applied AbilityFish Position/StateInfo hooks")
