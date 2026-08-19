#!/usr/bin/env python3
"""Add AbilityFish root-action result transport to pinned Fairy-Stockfish."""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: apply_fairy_root_hooks.py PATH_TO_FAIRY_STOCKFISH")
root = Path(sys.argv[1]).resolve()
search_h = root / "src" / "search.h"
thread_h = root / "src" / "thread.h"
thread_cpp = root / "src" / "thread.cpp"
search_cpp = root / "src" / "search.cpp"
for p in (search_h, thread_h, thread_cpp, search_cpp):
    if not p.exists():
        raise SystemExit(f"not a Fairy-Stockfish checkout: missing {p}")

def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"{label}: expected one anchor, found {n}")
    return text.replace(old, new, 1)

s = search_h.read_text()
if "ABILITYFISH_ROOT_TRANSPORT_V1" not in s:
    s = replace_once(s, '#include "types.h"\n', '#include "types.h"\n#include "abilityfish/ability_action.h"\n#define ABILITYFISH_ROOT_TRANSPORT_V1 1\n', "search.h include")
    s = replace_once(s, '''typedef std::vector<RootMove> RootMoves;\n\n\n/// LimitsType struct''', '''typedef std::vector<RootMove> RootMoves;\n\nstruct AbilityRootResult {\n  bool valid = false;\n  abilityfish::AbilityAction action{};\n  Value score = -VALUE_INFINITE;\n  int selDepth = 0;\n  std::vector<Move> pv;\n  void clear() { valid=false; action={}; score=-VALUE_INFINITE; selDepth=0; pv.clear(); }\n};\n\n\n/// LimitsType struct''', "AbilityRootResult")
    search_h.write_text(s)

s = thread_h.read_text()
if "Search::AbilityRootResult rootAbility" not in s:
    s = replace_once(s, '  Search::RootMoves rootMoves;\n', '  Search::RootMoves rootMoves;\n  Search::AbilityRootResult rootAbility;\n', "thread root carrier")
    thread_h.write_text(s)

s = thread_cpp.read_text()
if "ABILITYFISH_ROOT_THREAD_COPY_V2" not in s:
    s = replace_once(s, '''      th->rootMoves = rootMoves;\n      th->rootPos.set(pos.variant(), pos.fen(), pos.is_chess960(), &th->rootState, th);\n      th->rootState = setupStates->back();\n''', '''      th->rootMoves = rootMoves;\n      th->rootAbility.clear();\n      th->rootPos.set(pos.variant(), pos.fen(), pos.is_chess960(), &th->rootState, th);\n      th->rootState = setupStates->back();\n      // ABILITYFISH_ROOT_THREAD_COPY_V2\n      th->rootPos.set_abilityfish_active(pos.abilityfish_active());\n      if (pos.abilityfish_active())\n          th->rootPos.ability_state() = pos.ability_state();\n''', "thread root copy")
    thread_cpp.write_text(s)

s = search_cpp.read_text()
if "ABILITYFISH_ROOT_SEARCH_V5" not in s:
    s = replace_once(s, '''  trend = SCORE_ZERO;\n\n  int searchAgainCounter = 0;\n''', '''  trend = SCORE_ZERO;\n  rootAbility.clear();\n\n  int searchAgainCounter = 0;\n''', "root ability clear")

    anchor = '''      if (!Threads.stop)\n          completedDepth = rootDepth;\n'''
    hook = r'''      // ABILITYFISH_ROOT_SEARCH_V5
      if (!Threads.stop && rootPos.abilityfish_active())
      {
          Search::AbilityRootResult iterationAbility;
          auto abilityActions = rootPos.ability_actions();
          for (const auto& abilityAction : abilityActions)
          {
              StateInfo abilitySt;
              ASSERT_ALIGNED(&abilitySt, Eval::NNUE::CacheLineSize);
              abilityfish::ActionUndo abilityUndo;
              const Color abilityUs = rootPos.side_to_move();
              if (!rootPos.do_ability_action(abilityAction, abilitySt, abilityUndo))
                  continue;

              const bool sideChanged = rootPos.side_to_move() != abilityUs;
              const bool consumesMove = abilityAction.consumes_board_move();
              Value abilityValue = -VALUE_INFINITE;
              std::vector<Move> bestAbilityPv;

              if (!sideChanged && !consumesMove)
              {
                  bool foundBoardMove = false;
                  // Stack is intentionally heap-backed. Stockfish's normal root
                  // search already owns a MAX_PLY Stack array; adding another one
                  // to Thread::search's stack frame can overflow native/WASM stacks.
                  std::vector<Stack> childStack(MAX_PLY + 10);
                  Stack* childSs = childStack.data() + 7;
                  Move childPv[MAX_PLY + 1];

                  for (const auto& boardMove : MoveList<LEGAL>(rootPos))
                  {
                      foundBoardMove = true;
                      StateInfo moveSt;
                      ASSERT_ALIGNED(&moveSt, Eval::NNUE::CacheLineSize);
                      rootPos.do_move(boardMove, moveSt, rootPos.gives_check(boardMove));

                      std::memset(childStack.data(), 0, childStack.size() * sizeof(Stack));
                      for (int i = 7; i > 0; --i)
                          (childSs-i)->continuationHistory = &continuationHistory[0][0][NO_PIECE][0];
                      for (int i = 0; i <= MAX_PLY + 2; ++i)
                          (childSs+i)->ply = 1 + i;
                      childPv[0] = MOVE_NONE;
                      childSs->pv = childPv;
                      childSs->currentMove = boardMove;
                      childSs->continuationHistory = &continuationHistory[0][0][NO_PIECE][0];

                      const Depth remainingDepth = std::max(Depth(0), rootDepth - 1);
                      Value boardValue = -Stockfish::search<PV>(rootPos, childSs,
                                                                -VALUE_INFINITE, VALUE_INFINITE,
                                                                remainingDepth, false);
                      rootPos.undo_move(boardMove);
                      if (Threads.stop) break;

                      if (boardValue > abilityValue)
                      {
                          abilityValue = boardValue;
                          bestAbilityPv.clear();
                          bestAbilityPv.push_back(boardMove);
                          for (Move* m = childPv; *m != MOVE_NONE; ++m)
                              bestAbilityPv.push_back(*m);
                      }
                  }
                  if (!foundBoardMove)
                      abilityValue = rootPos.checkers() ? rootPos.checkmate_value(0) : rootPos.stalemate_value();
              }
              else
              {
                  std::vector<Stack> abilityStack(MAX_PLY + 10);
                  Stack* abilitySs = abilityStack.data() + 7;
                  Move abilityPv[MAX_PLY + 1];
                  std::memset(abilityStack.data(), 0, abilityStack.size() * sizeof(Stack));
                  for (int i = 7; i > 0; --i)
                      (abilitySs-i)->continuationHistory = &continuationHistory[0][0][NO_PIECE][0];
                  for (int i = 0; i <= MAX_PLY + 2; ++i)
                      (abilitySs+i)->ply = 1 + i;
                  abilityPv[0] = MOVE_NONE;
                  abilitySs->pv = abilityPv;
                  abilitySs->currentMove = MOVE_NONE;
                  abilitySs->continuationHistory = &continuationHistory[0][0][NO_PIECE][0];

                  const Depth childDepth = std::max(Depth(0), rootDepth - 1);
                  abilityValue = sideChanged
                      ? -Stockfish::search<PV>(rootPos, abilitySs, -VALUE_INFINITE, VALUE_INFINITE, childDepth, false)
                      :  Stockfish::search<PV>(rootPos, abilitySs, -VALUE_INFINITE, VALUE_INFINITE, childDepth, false);
                  for (Move* m = abilityPv; *m != MOVE_NONE; ++m)
                      bestAbilityPv.push_back(*m);
              }

              rootPos.undo_ability_action(abilityUndo);
              if (Threads.stop) break;

              if (!iterationAbility.valid || abilityValue > iterationAbility.score)
              {
                  iterationAbility.valid = true;
                  iterationAbility.action = abilityAction;
                  iterationAbility.score = abilityValue;
                  iterationAbility.selDepth = selDepth;
                  iterationAbility.pv = std::move(bestAbilityPv);
              }
          }

          if (!Threads.stop && iterationAbility.valid)
          {
              rootAbility = std::move(iterationAbility);
              if (rootMoves.empty() || rootAbility.score > rootMoves[0].score)
                  bestValue = rootAbility.score;
              if (mainThread && (rootMoves.empty() || rootAbility.score > rootMoves[0].score))
                  sync_cout << "info string abilityaction " << abilityfish::encode_action(rootAbility.action)
                            << " score " << UCI::value(rootAbility.score)
                            << " depth " << rootDepth << sync_endl;
          }
      }

      if (!Threads.stop)
          completedDepth = rootDepth;
'''
    s = replace_once(s, anchor, hook, "root search insertion")

    s = replace_once(s, '''      && rootMoves[0].pv[0] != MOVE_NONE)\n      bestThread = Threads.get_best_thread();\n\n  bestPreviousScore = bestThread->rootMoves[0].score;\n''', '''      && rootMoves[0].pv[0] != MOVE_NONE\n      && !rootPos.abilityfish_active())\n      bestThread = Threads.get_best_thread();\n\n  const bool abilityBest = bestThread->rootPos.abilityfish_active()\n                        && bestThread->rootAbility.valid\n                        && (bestThread->rootMoves.empty()\n                            || bestThread->rootAbility.score > bestThread->rootMoves[0].score);\n\n  bestPreviousScore = abilityBest ? bestThread->rootAbility.score\n                                  : bestThread->rootMoves[0].score;\n''', "best-thread ability selection")

    s = replace_once(s, '''  sync_cout << "bestmove " << UCI::move(rootPos, bestThread->rootMoves[0].pv[0]);\n\n  if (bestThread->rootMoves[0].pv.size() > 1 || bestThread->rootMoves[0].extract_ponder_from_tt(rootPos))\n      std::cout << " ponder " << UCI::move(rootPos, bestThread->rootMoves[0].pv[1]);\n\n  std::cout << sync_endl;\n''', '''  if (abilityBest)\n  {\n      sync_cout << "info string abilityaction "\n                << abilityfish::encode_action(bestThread->rootAbility.action)\n                << " score " << UCI::value(bestThread->rootAbility.score)\n                << " depth " << bestThread->completedDepth << sync_endl;\n      sync_cout << "bestmove 0000" << sync_endl;\n      return;\n  }\n\n  sync_cout << "bestmove " << UCI::move(rootPos, bestThread->rootMoves[0].pv[0]);\n\n  if (bestThread->rootMoves[0].pv.size() > 1 || bestThread->rootMoves[0].extract_ponder_from_tt(rootPos))\n      std::cout << " ponder " << UCI::move(rootPos, bestThread->rootMoves[0].pv[1]);\n\n  std::cout << sync_endl;\n''', "bestmove ability output")

    search_cpp.write_text(s)

print("Applied AbilityFish root/PV transport hooks")
