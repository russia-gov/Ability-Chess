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
