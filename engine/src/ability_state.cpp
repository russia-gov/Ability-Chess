#include "ability_state.h"
#include <algorithm>

namespace abilityfish {
namespace {
uint64_t mix(uint64_t x) {
  x += 0x9e3779b97f4a7c15ULL;
  x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9ULL;
  x = (x ^ (x >> 27)) * 0x94d049bb133111ebULL;
  return x ^ (x >> 31);
}
int bit_count(uint16_t x) {
#if defined(__GNUC__) || defined(__clang__)
  return __builtin_popcount(static_cast<unsigned>(x));
#else
  int count = 0;
  while (x) {
    x &= static_cast<uint16_t>(x - 1);
    ++count;
  }
  return count;
#endif
}
void age(TimedSquare& x) {
  if (!x.active) return;
  if (x.ownerTurnsRemaining > 0) --x.ownerTurnsRemaining;
  if (!x.ownerTurnsRemaining) x = {};
}
}

int AbilityState::ability_cost(Ability a) {
  static constexpr int costs[] = {3,3,4,4,4,4,4,5,5,4,6};
  return costs[static_cast<size_t>(a)];
}
int AbilityState::upgrade_cost(Upgrade u) {
  static constexpr int costs[] = {4,4,6,5,6,6,5,8,6,6,9,7,7,6};
  return costs[static_cast<size_t>(u)];
}
bool AbilityState::can_afford(Side s, Ability a) const {
  return abilitiesEnabled && !side[side_index(s)].abilityUsedThisTurn && side[side_index(s)].points >= ability_cost(a);
}
bool AbilityState::can_afford(Side s, Upgrade u) const {
  return upgradesEnabled && side[side_index(s)].points >= upgrade_cost(u);
}
int AbilityState::upgrades_on(Square sq) const {
  if (!sq.valid()) return 0;
  return bit_count(squareUpgrades[sq.index]);
}
bool AbilityState::can_buy_upgrade(Side s, Square sq, Upgrade u) const {
  if (!sq.valid() || !can_afford(s,u)) return false;
  const uint16_t bit = uint16_t(1u << static_cast<unsigned>(u));
  return !(squareUpgrades[sq.index] & bit) && upgrades_on(sq) < upgradeLimit;
}

void AbilityState::begin_turn(Side owner, bool inCheck) {
  turn = owner;
  boardMovesRemaining = 1;
  doubleMoveActive = false;
  beganTurnInCheck = inCheck;
  auto& ss = side[side_index(owner)];
  ss.abilityUsedThisTurn = false;
  ss.pending = {};
  age(ss.shield);
  age(ss.ambush);
  if (ss.fortify.active) {
    if (ss.fortify.ownerTurnsRemaining > 0) --ss.fortify.ownerTurnsRemaining;
    if (!ss.fortify.ownerTurnsRemaining) ss.fortify = {};
  }
  for (auto& p : portals) {
    if (!p.active || p.owner != owner) continue;
    if (p.ownerTurnsRemaining > 0) --p.ownerTurnsRemaining;
    if (!p.ownerTurnsRemaining) p = {};
  }
  recompute_key();
}

void AbilityState::finish_board_move() {
  if (boardMovesRemaining > 1) {
    --boardMovesRemaining;
  } else {
    boardMovesRemaining = 1;
    doubleMoveActive = false;
    begin_turn(other(turn), false);
    return;
  }
  recompute_key();
}

void AbilityState::move_piece_state(Square from, Square to) {
  if (!from.valid() || !to.valid()) return;
  squareUpgrades[to.index] = squareUpgrades[from.index];
  squareUpgrades[from.index] = 0;
  for (auto& ss : side) {
    if (ss.shield.active && ss.shield.square.index == from.index)
      ss.shield = {};
    if (ss.ambush.active && ss.ambush.square.index == from.index)
      ss.ambush.square = to;
  }
  recompute_key();
}

void AbilityState::recompute_key() {
  uint64_t k = 0xAB1117F15AULL;
  k ^= mix(uint64_t(turn) | (uint64_t(boardMovesRemaining)<<8) | (uint64_t(doubleMoveActive)<<16) | (uint64_t(beganTurnInCheck)<<17));
  for (size_t s=0;s<2;s++) {
    const auto& x=side[s];
    k ^= mix((s<<24) ^ x.points);
    k ^= mix((s<<25) ^ (uint64_t(x.abilityUsedThisTurn)<<16));
    if (x.shield.active) k ^= mix(0x10000000ULL | (s<<8) | x.shield.square.index | (uint64_t(x.shield.ownerTurnsRemaining)<<16));
    if (x.frozenEnemy.active) k ^= mix(0x20000000ULL | (s<<8) | x.frozenEnemy.square.index | (uint64_t(x.frozenEnemy.ownerTurnsRemaining)<<16));
    if (x.ambush.active) k ^= mix(0x30000000ULL | (s<<8) | x.ambush.square.index | (uint64_t(x.ambush.ownerTurnsRemaining)<<16));
    if (x.fortify.active) {
      uint64_t v=0x40000000ULL|(s<<8)|(uint64_t(x.fortify.ownerTurnsRemaining)<<16);
      for(size_t i=0;i<4;i++) v ^= uint64_t(x.fortify.squares[i].index) << (24 + 6*i);
      k ^= mix(v);
    }
    if (x.lastMove.valid) k ^= mix(0x60000000ULL | (s<<8) | x.lastMove.from.index | (uint64_t(x.lastMove.to.index)<<8) | (uint64_t(x.lastMove.pieceCode)<<16));
    if (x.pending.kind != PendingKind::None) k ^= mix(0x70000000ULL | (s<<8) | uint64_t(x.pending.kind) | (uint64_t(x.pending.first.index)<<16));
  }
  for(size_t sq=0;sq<64;sq++) if(squareUpgrades[sq])
    k ^= mix(0x80000000ULL ^ (uint64_t(sq)<<16) ^ squareUpgrades[sq]);
  for(size_t i=0;i<portals.size();i++) if(portals[i].active)
    k ^= mix(0x50000000ULL | (i<<8) | portals[i].a.index | (uint64_t(portals[i].b.index)<<8) | (uint64_t(portals[i].ownerTurnsRemaining)<<20) | (uint64_t(portals[i].owner)<<28));
  k ^= mix(uint64_t(upgradeLimit) << 48 | uint64_t(abilitiesEnabled) << 56 | uint64_t(upgradesEnabled) << 57);
  variantKey = k;
}
}
