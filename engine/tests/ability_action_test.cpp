#include "../src/ability_action.h"
#include <cassert>
#include <algorithm>
#include <vector>
using namespace abilityfish;
int main() {
  AbilityAction x{ActionKind::Upgrade, 12, 44, 13, 7};
  auto y = decode_action(encode_action(x));
  assert(y.kind == x.kind && y.from == 12 && y.to == 44 && y.aux == 13 && y.flags == 7);
  AbilityAction p{ActionKind::PortalBegin, 18, 64, 0, 0};
  y = decode_action(encode_action(p));
  assert(y.kind == p.kind && y.from == 18);
  std::vector<AbilityAction> actions{
    {ActionKind::PortalFinish, 1, 2, 0, 0},
    {ActionKind::Freeze, 3, 64, 0, 0},
    {ActionKind::Bomb, 4, 64, 0, 0},
    {ActionKind::PortalFinish, 5, 6, 0, 0},
    {ActionKind::Upgrade, 1, 64, 4, 0}
  };
  std::stable_sort(actions.begin(),actions.end(),[](const auto& a,const auto& b){
    return action_order_priority(a.kind)<action_order_priority(b.kind);
  });
  assert(actions.size()==5);
  assert(actions[0].kind==ActionKind::Bomb);
  assert(actions[1].kind==ActionKind::Freeze);
  assert(actions[2].kind==ActionKind::Upgrade);
  assert(actions[3].kind==ActionKind::PortalFinish && actions[3].from==1);
  assert(actions[4].kind==ActionKind::PortalFinish && actions[4].from==5);
}
