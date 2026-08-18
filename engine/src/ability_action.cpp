#include "ability_action.h"

namespace abilityfish {
uint32_t encode_action(const AbilityAction& a) {
  return (uint32_t(a.kind) & 0x1Fu)
       | ((uint32_t(a.from) & 0x7Fu) << 5)
       | ((uint32_t(a.to) & 0x7Fu) << 12)
       | ((uint32_t(a.aux) & 0x3Fu) << 19)
       | ((uint32_t(a.flags) & 0x7Fu) << 25);
}
AbilityAction decode_action(uint32_t p) {
  AbilityAction a;
  a.kind = ActionKind(p & 0x1Fu);
  a.from = uint8_t((p >> 5) & 0x7Fu);
  a.to = uint8_t((p >> 12) & 0x7Fu);
  a.aux = uint8_t((p >> 19) & 0x3Fu);
  a.flags = uint8_t((p >> 25) & 0x7Fu);
  return a;
}
}
