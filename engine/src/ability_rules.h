#pragma once
#include <array>
#include <cstdint>
#include <optional>
#include <vector>
#include "ability_action.h"
#include "ability_state.h"

namespace abilityfish {

enum class PieceType : uint8_t { None, Pawn, Knight, Bishop, Rook, Queen, King };
struct PieceInfo {
  PieceType type = PieceType::None;
  Side side = Side::White;
  uint8_t code = 0;
  constexpr bool present() const { return type != PieceType::None; }
};

class BoardAdapter {
public:
  virtual ~BoardAdapter() = default;
  virtual PieceInfo piece_at(Square s) const = 0;
  virtual bool empty(Square s) const = 0;
  virtual Square king_square(Side s) const = 0;
  virtual bool in_check(Side s) const = 0;
  virtual bool square_attacked_by(Square sq, Side attacker) const = 0;
  virtual bool piece_attacks_square(Square from, Square target) const = 0;

  virtual bool swap_would_be_safe(Square a, Square b, Side s) const = 0;
  virtual bool recall_would_be_safe(Square from, Square to, Side s) const = 0;
  virtual bool teleport_would_be_safe(Square from, Square to, Side s) const = 0;
  virtual bool teleport_would_attack_enemy_king(Square from, Square to, Side s) const = 0;
  virtual bool bomb_would_be_safe(Square center, Side s) const = 0;

  virtual void swap_pieces(Square a, Square b) = 0;
  virtual void move_piece(Square from, Square to) = 0;
  virtual void remove_piece(Square sq) = 0;
  virtual void replace_piece(Square sq, PieceType type, Side side) = 0;
  virtual void set_piece_exact(Square sq, PieceInfo piece) = 0;
};

struct ActionUndo {
  AbilityState state{};
  std::array<PieceInfo,64> board{};
  bool valid = false;
};

struct ApplyResult {
  bool ok = false;
  bool sideChanged = false;
  bool consumeDepth = false;
  const char* error = nullptr;
};

bool square_in_fortification(const AbilityState& st, Side owner, Square sq);
bool protected_from_ability(const AbilityState& st, Side actor, Square sq);
bool pawn_on_own_half(Side s, Square sq);
bool pawn_crossed_half(Side s, Square sq);
bool upgrade_compatible(PieceType piece, Upgrade upgrade);
bool normal_move_allowed(const AbilityState& st, Side mover, Square from, Square captureSquare = {});
std::vector<AbilityAction> generate_meta_actions(const AbilityState& st, const BoardAdapter& board);
ApplyResult apply_action(AbilityState& st, BoardAdapter& board, const AbilityAction& a);
ApplyResult apply_action_reversible(AbilityState& st, BoardAdapter& board, const AbilityAction& a, ActionUndo& undo);
void undo_action(AbilityState& st, BoardAdapter& board, ActionUndo& undo);
ApplyResult transition_after_normal_move(AbilityState& st, bool nextSideInCheck = false);

} // namespace abilityfish
