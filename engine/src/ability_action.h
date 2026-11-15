#pragma once
#include <cstdint>

namespace abilityfish {

enum class ActionKind : uint8_t {
  NormalMove = 0,
  Shield,
  Freeze,
  Bomb,
  SwapBegin,
  SwapFinish,
  Recall,
  Ambush,
  Teleport,
  Reinforce,
  PortalBegin,
  PortalFinish,
  Fortify,
  DoubleMove,
  Upgrade,
};

// Deterministic tactical-first ordering. Every legal action is still searched;
// ordering only helps alpha-beta discover cutoffs earlier. Initial priorities
// are intentionally coarse until benchmark evidence supports finer heuristics.
constexpr int action_order_priority(ActionKind kind) {
  switch (kind) {
    case ActionKind::Bomb: return 0;
    case ActionKind::Freeze: return 1;
    case ActionKind::Recall: return 2;
    case ActionKind::SwapFinish: return 3;
    case ActionKind::Teleport: return 4;
    case ActionKind::Reinforce: return 5;
    case ActionKind::Shield: return 6;
    case ActionKind::DoubleMove: return 7;
    case ActionKind::Upgrade: return 8;
    case ActionKind::Ambush: return 9;
    case ActionKind::Fortify: return 10;
    case ActionKind::PortalFinish: return 11;
    default: return 12;
  }
}

struct AbilityAction {
  ActionKind kind = ActionKind::NormalMove;
  uint8_t from = 64;
  uint8_t to = 64;
  uint8_t aux = 0;
  uint8_t flags = 0;

  constexpr bool valid_square(uint8_t s) const { return s < 64; }
  constexpr bool is_meta() const { return kind != ActionKind::NormalMove && kind != ActionKind::Teleport; }
  constexpr bool consumes_board_move() const {
    return kind == ActionKind::NormalMove || kind == ActionKind::Teleport;
  }
};

uint32_t encode_action(const AbilityAction& a);
AbilityAction decode_action(uint32_t packed);

}
