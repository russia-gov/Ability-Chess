#include "../src/ability_state.h"
#include <cassert>
using namespace abilityfish;
int main() {
  AbilityState s;
  s.side[0].points = 20;
  s.recompute_key();
  const auto k0 = s.variantKey;
  assert(s.can_afford(Side::White, Ability::DoubleMove));
  assert(s.can_buy_upgrade(Side::White, 0, Upgrade::Vanguard));
  s.set_upgrade(Side::White, 0, Upgrade::Vanguard);
  assert(s.upgrade_for(Side::White,0) && *s.upgrade_for(Side::White,0)==Upgrade::Vanguard);
  assert(s.owned_upgrade_types(Side::White)==1);
  assert(s.variantKey != k0);

  // Upgrade ownership is attached to a piece type, not a square, and therefore
  // survives movement and complete loss of all current pieces of that type.
  const auto k1 = s.variantKey;
  s.side[0].ambush = {Square{8}, 1, true};
  s.move_piece_state(Square{8}, Square{16});
  assert(s.upgrade_for(Side::White,0) && *s.upgrade_for(Side::White,0)==Upgrade::Vanguard);
  assert(s.side[0].ambush.active && s.side[0].ambush.square.index == 16);
  assert(s.variantKey != k1);

  s.side[0].shield = {Square{16}, 1, true};
  s.side[1].frozenEnemy = {Square{16}, 1, true};
  s.remove_piece_state(Square{16});
  assert(s.upgrade_for(Side::White,0) && *s.upgrade_for(Side::White,0)==Upgrade::Vanguard);
  assert(!s.side[0].shield.active);
  assert(!s.side[0].ambush.active);
  assert(!s.side[1].frozenEnemy.active);

  // Replacing an already-owned piece-type upgrade is legal at the type limit,
  // but adding a new piece type beyond the selected limit is not.
  s.upgradeLimit=1;
  assert(s.can_buy_upgrade(Side::White,0,Upgrade::Veteran));
  assert(!s.can_buy_upgrade(Side::White,1,Upgrade::Lancer));
  s.set_upgrade(Side::White,0,Upgrade::Veteran);
  assert(*s.upgrade_for(Side::White,0)==Upgrade::Veteran);

  s = AbilityState{};
  s.turn = Side::White;
  s.boardMovesRemaining = 2;
  s.doubleMoveActive = true;
  s.side[0].frozenEnemy = {Square{16}, 1, true};
  s.finish_board_move();
  assert(s.turn == Side::White && s.boardMovesRemaining == 1);
  assert(s.side[0].frozenEnemy.active);
  s.finish_board_move();
  assert(s.turn == Side::Black && s.boardMovesRemaining == 1 && !s.doubleMoveActive);
  assert(!s.side[0].frozenEnemy.active);

  // A portal created by White is usable on the creation turn and White's next
  // two turns. It ages only when a new White turn begins, not on Black turns.
  s = AbilityState{};
  s.turn = Side::White;
  s.portals[0] = {Square{8}, Square{35}, Side::White, 3, true};
  s.begin_turn(Side::Black,false);
  assert(s.portals[0].active && s.portals[0].ownerTurnsRemaining==3);
  s.begin_turn(Side::White,false);
  assert(s.portals[0].active && s.portals[0].ownerTurnsRemaining==2);
  s.begin_turn(Side::Black,false);
  assert(s.portals[0].ownerTurnsRemaining==2);
  s.begin_turn(Side::White,false);
  assert(s.portals[0].active && s.portals[0].ownerTurnsRemaining==1);
  s.begin_turn(Side::Black,false);
  assert(s.portals[0].ownerTurnsRemaining==1);
  s.begin_turn(Side::White,false);
  assert(!s.portals[0].active);
}
