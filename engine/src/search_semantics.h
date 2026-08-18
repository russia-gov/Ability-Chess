#pragma once
#include "ability_action.h"

namespace abilityfish {

struct SearchTransition {
  bool sideChanged = false;
  bool consumeDepth = false;
};

constexpr SearchTransition default_transition(ActionKind k) {
  switch (k) {
    case ActionKind::NormalMove:
    case ActionKind::Teleport:
      return {true, true};
    default:
      return {false, false};
  }
}

template<class SearchFn, class Position>
int recurse_variant(SearchFn&& search,
                    Position& pos,
                    int alpha,
                    int beta,
                    int depth,
                    SearchTransition t) {
  const int childDepth = depth - (t.consumeDepth ? 1 : 0);
  if (t.sideChanged)
    return -search(pos, -beta, -alpha, childDepth);
  return search(pos, alpha, beta, childDepth);
}

}
