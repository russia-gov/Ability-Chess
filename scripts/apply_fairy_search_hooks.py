#!/usr/bin/env python3
"""Patch pinned Fairy-Stockfish alpha-beta with AbilityFish meta-action search."""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: apply_fairy_search_hooks.py PATH_TO_FAIRY_STOCKFISH")
root = Path(sys.argv[1]).resolve()
p = root / "src" / "search.cpp"
if not p.exists():
    raise SystemExit(f"not a Fairy-Stockfish checkout: {root}")

s = p.read_text()
if "ABILITYFISH_SEARCH_HOOKS_V1" in s:
    print("AbilityFish search hooks already applied")
    raise SystemExit(0)

anchor = """    value = bestValue;\n    singularQuietLMR = moveCountPruning = false;\n    bool doubleExtension = false;\n"""
if s.count(anchor) != 1:
    raise SystemExit(f"search prelude anchor: expected one match, found {s.count(anchor)}")

hook = r'''    value = bestValue;
    singularQuietLMR = moveCountPruning = false;
    bool doubleExtension = false;

    // ABILITYFISH_SEARCH_HOOKS_V1
    if (!rootNode && pos.abilityfish_active())
    {
        auto abilityActions = pos.ability_actions();
        for (const auto& abilityAction : abilityActions)
        {
            StateInfo abilitySt;
            ASSERT_ALIGNED(&abilitySt, Eval::NNUE::CacheLineSize);
            abilityfish::ActionUndo abilityUndo;
            const Color abilityUs = pos.side_to_move();

            if (!pos.do_ability_action(abilityAction, abilitySt, abilityUndo))
                continue;

            const bool sideChanged = pos.side_to_move() != abilityUs;
            const Depth abilityDepth = depth - (abilityAction.consumes_board_move() ? 1 : 0);
            (ss+1)->currentMove = MOVE_NONE;
            (ss+1)->continuationHistory = &thisThread->continuationHistory[0][0][NO_PIECE][0];
            (ss+1)->pv = nullptr;

            Value abilityValue;
            if (sideChanged)
                abilityValue = -search<NonPV>(pos, ss+1, -beta, -alpha,
                                               std::max(Depth(0), abilityDepth), false);
            else
                abilityValue = search<NonPV>(pos, ss+1, alpha, beta,
                                              std::max(Depth(0), abilityDepth), false);

            pos.undo_ability_action(abilityUndo);

            if (Threads.stop.load(std::memory_order_relaxed))
                return VALUE_ZERO;

            if (abilityValue > bestValue)
            {
                bestValue = abilityValue;
                if (abilityValue > alpha)
                {
                    if (PvNode && abilityValue < beta)
                        alpha = abilityValue;
                    else if (abilityValue >= beta)
                    {
                        tte->save(posKey, value_to_tt(abilityValue, ss->ply), ss->ttPv,
                                  BOUND_LOWER, depth, MOVE_NONE, ss->staticEval);
                        return abilityValue;
                    }
                }
            }
        }
    }
'''
s = s.replace(anchor, hook, 1)
p.write_text(s)
print("Applied AbilityFish alpha-beta search hooks")
