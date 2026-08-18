#pragma once
#include <array>
#include <cstdint>
#include <optional>
#include "ability_action.h"

namespace abilityfish {

enum class Side : uint8_t { White = 0, Black = 1 };
enum class Ability : uint8_t { Shield, Freeze, Bomb, Swap, Recall, Ambush, Teleport, Reinforce, Portal, Fortify, DoubleMove, Count };
enum class Upgrade : uint8_t { Vanguard, ReverseGear, Veteran, Lancer, Charger, Cardinal, ColorShift, Archbishop, Bastion, Turret, Chancellor, PhaseStep, RoyalStep, EscapeRoute, Count };

struct Square { uint8_t index = 64; constexpr bool valid() const { return index < 64; } };
struct Portal { Square a{}, b{}; Side owner = Side::White; uint8_t ownerTurnsRemaining = 0; bool active = false; };
struct TimedSquare { Square square{}; uint8_t ownerTurnsRemaining = 0; bool active = false; };
struct Fortification { std::array<Square,4> squares{}; uint8_t ownerTurnsRemaining = 0; bool active = false; };
struct LastMove { Square from{}, to{}; uint8_t pieceCode = 0; bool valid = false; };

enum class PendingKind : uint8_t { None, Swap, Portal };
struct PendingAction { PendingKind kind = PendingKind::None; Square first{}; };

struct SideState {
  uint8_t points = 0;
  bool abilityUsedThisTurn = false;
  TimedSquare shield{};
  TimedSquare frozenEnemy{};
  TimedSquare ambush{};
  Fortification fortify{};
  LastMove lastMove{};
  PendingAction pending{};
};

struct AbilityState {
  std::array<SideState,2> side{};
  // Indexed [side][pieceTypeIndex], where pieceTypeIndex is Pawn=0 through King=5.
  // Value 0 means no upgrade; otherwise value is Upgrade enum value + 1.
  std::array<std::array<uint8_t,6>,2> typeUpgrades{};
  std::array<Portal,2> portals{};
  uint8_t upgradeLimit = 3;
  bool abilitiesEnabled = true;
  bool upgradesEnabled = true;
  Side turn = Side::White;
  uint8_t boardMovesRemaining = 1;
  bool doubleMoveActive = false;
  bool beganTurnInCheck = false;
  uint64_t variantKey = 0;

  void begin_turn(Side owner, bool inCheck = false);
  void finish_board_move();
  void move_piece_state(Square from, Square to);
  void remove_piece_state(Square sq);
  void recompute_key();
  bool can_afford(Side s, Ability a) const;
  bool can_afford(Side s, Upgrade u) const;
  bool can_buy_upgrade(Side s, uint8_t pieceTypeIndex, Upgrade u) const;
  std::optional<Upgrade> upgrade_for(Side s, uint8_t pieceTypeIndex) const;
  int owned_upgrade_types(Side s) const;
  void set_upgrade(Side s, uint8_t pieceTypeIndex, Upgrade u);
  void clear_upgrade(Side s, uint8_t pieceTypeIndex);
  static int ability_cost(Ability a);
  static int upgrade_cost(Upgrade u);
};

constexpr size_t side_index(Side s) { return static_cast<size_t>(s); }
constexpr Side other(Side s) { return s == Side::White ? Side::Black : Side::White; }
}
