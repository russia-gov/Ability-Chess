#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
CXX="${CXX:-g++}"
FLAGS="-std=c++20 -O2 -Wall -Wextra -pedantic"
mkdir -p .test-bin
$CXX $FLAGS src/ability_action.cpp tests/ability_action_test.cpp -o .test-bin/action
$CXX $FLAGS src/ability_action.cpp src/ability_state.cpp tests/ability_state_test.cpp -o .test-bin/state
$CXX $FLAGS tests/search_semantics_test.cpp -o .test-bin/search
$CXX $FLAGS src/ability_action.cpp src/ability_state.cpp src/ability_rules.cpp tests/ability_rules_test.cpp -o .test-bin/rules
.test-bin/action
.test-bin/state
.test-bin/search
.test-bin/rules
echo "AbilityFish native rule/search tests: PASS"
