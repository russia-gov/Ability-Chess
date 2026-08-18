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
if "ABILITYFISH_SEARCH_HOOKS_V4" in s:
    print("AbilityFish search hooks already applied")
    raise SystemExit(0)

anchor = """    value = bestValue;\n    singularQuietLMR = moveCountPruning = false;\n    bool doubleExtension = false;\n"""
if s.count(anchor) != 1:
    raise SystemExit(f"search prelude anchor: expected one match, found {s.count(anchor)}")

hook = r'''    value = bestValue;
    singularQuietLMR = moveCountPruning = false;
    bool doubleExtension = false;

    // ABILITYFISH_SEARCH_HOOKS_V4
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
            const bool consumesMove = abilityAction.consumes_board_move();
            Value abilityValue = -VALUE_INFINITE;

            if (!sideChanged && !consumesMove)
            {
                // Same-turn abilities are followed by a real board move. Search that
                // move explicitly so meta actions do not recursively re-enter the same
                // node at unchanged board-move depth.
                bool foundBoardMove = false;
                for (const auto& boardMove : MoveList<LEGAL>(pos))
                {
                    foundBoardMove = true;
                    StateInfo moveSt;
                    ASSERT_ALIGNED(&moveSt, Eval::NNUE::CacheLineSize);
                    const Color boardUs = pos.side_to_move();
                    pos.do_move(boardMove, moveSt, pos.gives_check(boardMove));
                    const bool boardSideChanged = pos.side_to_move() != boardUs;

                    (ss+1)->currentMove = boardMove;
                    (ss+1)->continuationHistory = &thisThread->continuationHistory[0][0][NO_PIECE][0];
                    (ss+1)->pv = nullptr;

                    const Depth childDepth = std::max(Depth(0), depth - 1);
                    Value boardValue;
                    // Stockfish's NonPV search is a null-window search and asserts
                    // alpha == beta - 1 in qsearch. A PV parent can have a wide window,
                    // so preserve the parent's node type instead of forcing NonPV.
                    if (PvNode)
                        boardValue = boardSideChanged
                            ? -search<PV>(pos, ss+1, -beta, -alpha, childDepth, false)
                            :  search<PV>(pos, ss+1, alpha, beta, childDepth, false);
                    else
                        boardValue = boardSideChanged
                            ? -search<NonPV>(pos, ss+1, -beta, -alpha, childDepth, false)
                            :  search<NonPV>(pos, ss+1, alpha, beta, childDepth, false);

                    pos.undo_move(boardMove);

                    if (Threads.stop.load(std::memory_order_relaxed))
                    {
                        pos.undo_ability_action(abilityUndo);
                        return VALUE_ZERO;
                    }

                    if (boardValue > abilityValue)
                        abilityValue = boardValue;
                    if (abilityValue >= beta)
                        break;
                }

                if (!foundBoardMove)
                    abilityValue = pos.checkers() ? pos.checkmate_value(ss->ply)
                                                  : pos.stalemate_value();
            }
            else
            {
                // Turn-consuming actions (upgrades and Teleport) already advance the
                // game turn; search the resulting child while preserving PV/NonPV
                // window invariants.
                const Depth abilityDepth = std::max(Depth(0), depth - (consumesMove ? 1 : 0));
                (ss+1)->currentMove = MOVE_NONE;
                (ss+1)->continuationHistory = &thisThread->continuationHistory[0][0][NO_PIECE][0];
                (ss+1)->pv = nullptr;

                if (PvNode)
                    abilityValue = sideChanged
                        ? -search<PV>(pos, ss+1, -beta, -alpha, abilityDepth, false)
                        :  search<PV>(pos, ss+1, alpha, beta, abilityDepth, false);
                else
                    abilityValue = sideChanged
                        ? -search<NonPV>(pos, ss+1, -beta, -alpha, abilityDepth, false)
                        :  search<NonPV>(pos, ss+1, alpha, beta, abilityDepth, false);
            }

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
