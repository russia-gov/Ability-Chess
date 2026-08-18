#include "../src/ability_action.h"
#include <cassert>
using namespace abilityfish;
int main() {
  AbilityAction x{ActionKind::Upgrade, 12, 44, 13, 7};
  auto y = decode_action(encode_action(x));
  assert(y.kind == x.kind && y.from == 12 && y.to == 44 && y.aux == 13 && y.flags == 7);
  AbilityAction p{ActionKind::PortalBegin, 18, 64, 0, 0};
  y = decode_action(encode_action(p));
  assert(y.kind == p.kind && y.from == 18);
}
