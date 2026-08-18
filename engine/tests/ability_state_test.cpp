#include "../src/ability_state.h"
#include <cassert>
using namespace abilityfish;
int main() {
  AbilityState s;
  s.side[0].points = 9;
  s.recompute_key();
  const auto k0 = s.variantKey;
  assert(s.can_afford(Side::White, Ability::DoubleMove));
  assert(s.can_buy_upgrade(Side::White, Square{8}, Upgrade::Vanguard));
  s.squareUpgrades[8] |= 1u << unsigned(Upgrade::Vanguard);
  s.recompute_key();
  assert(s.variantKey != k0);
  const auto k1 = s.variantKey;
  s.side[0].ambush = {Square{8}, 1, true};
  s.move_piece_state(Square{8}, Square{16});
  assert(s.squareUpgrades[8] == 0 && s.squareUpgrades[16] != 0);
  assert(s.side[0].ambush.active && s.side[0].ambush.square.index == 16);
  assert(s.variantKey != k1);

  s.side[0].shield = {Square{16}, 1, true};
  s.side[1].frozenEnemy = {Square{16}, 1, true};
  s.remove_piece_state(Square{16});
  assert(s.squareUpgrades[16] == 0);
  assert(!s.side[0].shield.active);
  assert(!s.side[0].ambush.active);
  assert(!s.side[1].frozenEnemy.active);

  s.turn = Side::White;
  s.boardMovesRemaining = 2;
  s.doubleMoveActive = true;
  s.finish_board_move();
  assert(s.turn == Side::White && s.boardMovesRemaining == 1);
  s.finish_board_move();
  assert(s.turn == Side::Black && s.boardMovesRemaining == 1 && !s.doubleMoveActive);
}
