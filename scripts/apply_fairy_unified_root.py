#!/usr/bin/env python3
"""Experimental unified AbilityFish root search.

Move the special-action phase from Thread::search's post-iteration pass into
Stockfish::search<Root>'s own alpha-beta search. This shares the position,
window, iteration and transposition-table context with ordinary root moves.

Every legal action remains eligible; no search-time budget is introduced.
"""
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else "vendor/Fairy-Stockfish")
path=root/"src"/"search.cpp"
s=path.read_text()
marker="// ABILITYFISH_UNIFIED_ROOT_V1"
if marker in s:
    print("Unified AbilityFish root patch already installed")
    raise SystemExit(0)

old_start="      // ABILITYFISH_ROOT_SEARCH_V5\n"
old_end="      if (!Threads.stop)\n          completedDepth = rootDepth;\n"
if s.count(old_start)!=1:
    raise SystemExit("Expected exactly one legacy root special-action pass")
start=s.index(old_start)
end=s.index(old_end,start)
s=s[:start]+"      // Special actions are now searched within the shared Root search.\n"+s[end:]

anchor="    // ABILITYFISH_SEARCH_HOOKS_V6\n    if (!rootNode && pos.abilityfish_active())"
if s.count(anchor)!=1:
    raise SystemExit("Expected exactly one alpha-beta ability-action hook")

# Use Root's existing alpha/beta bounds, not a second unrestricted search.
# The ordinary move loop below this insertion continues at the updated alpha.
root_hook=r'''    // ABILITYFISH_UNIFIED_ROOT_V1
    if (rootNode && thisThread->pvIdx == 0 && pos.abilityfish_active())
    {
        // Keep the prior iteration's best special action as an ordering hint.
        auto previous = thisThread->rootAbility;
        thisThread->rootAbility.clear();
        auto actions = pos.ability_actions();
        const auto sameAction = [&](const abilityfish::AbilityAction& a) {
            const auto& b=previous.action;
            return previous.valid && a.kind==b.kind && a.from==b.from
                   && a.to==b.to && a.aux==b.aux && a.flags==b.flags;
        };
        std::stable_sort(actions.begin(), actions.end(),
                         [&](const auto& a, const auto& b) {
            if (sameAction(a)!=sameAction(b)) return sameAction(a);
            return abilityfish::action_order_priority(a.kind)
                 < abilityfish::action_order_priority(b.kind);
        });
        if (thisThread == Threads.main())
            sync_cout << "info string abilityfish rootactions depth "
                      << depth << " count " << actions.size() << sync_endl;

        for (const auto& action : actions)
        {
            StateInfo abilitySt;
            ASSERT_ALIGNED(&abilitySt, Eval::NNUE::CacheLineSize);
            abilityfish::ActionUndo abilityUndo;
            const Color actionSide=pos.side_to_move();
            if (!pos.do_ability_action(action, abilitySt, abilityUndo))
                continue;

            const bool changesSide=pos.side_to_move()!=actionSide;
            const bool consumesMove=action.consumes_board_move();
            Value actionValue=-VALUE_INFINITE;
            std::vector<Move> candidatePv;
            // Separate child stack: the parent Root search must retain its own
            // move ordering/history arrays when the synthetic child returns.
            std::vector<Stack> synthetic(MAX_PLY+10);
            Stack* child=synthetic.data()+7;
            Move pvMoves[MAX_PLY+1];
            auto initChild=[&](Move firstMove) {
                std::memset(synthetic.data(),0,synthetic.size()*sizeof(Stack));
                for(int k=7;k>0;--k)
                    (child-k)->continuationHistory=
                        &thisThread->continuationHistory[0][0][NO_PIECE][0];
                for(int k=0;k<=MAX_PLY+2;++k) (child+k)->ply=k+1;
                child->continuationHistory=
                    &thisThread->continuationHistory[0][0][NO_PIECE][0];
                child->currentMove=firstMove;
                child->pv=pvMoves;
                pvMoves[0]=MOVE_NONE;
            };

            if (!changesSide && !consumesMove)
            {
                bool found=false;
                for(const auto& boardMove : MoveList<LEGAL>(pos))
                {
                    found=true;
                    StateInfo moveSt;
                    ASSERT_ALIGNED(&moveSt, Eval::NNUE::CacheLineSize);
                    const Color beforeMove=pos.side_to_move();
                    pos.do_move(boardMove,moveSt,pos.gives_check(boardMove));
                    const bool boardChangesSide=pos.side_to_move()!=beforeMove;
                    initChild(boardMove);

                    const Depth remaining=std::max(Depth(0),depth-1);
                    const Value floor=std::max(alpha,actionValue);
                    const Value boardValue=boardChangesSide
                        ? -search<PV>(pos,child,-beta,-floor,remaining,false)
                        :  search<PV>(pos,child,floor,beta,remaining,false);
                    pos.undo_move(boardMove);
                    if (Threads.stop.load(std::memory_order_relaxed)) break;
                    if(boardValue>actionValue)
                    {
                        actionValue=boardValue;
                        candidatePv.clear();
                        candidatePv.push_back(boardMove);
                        for(Move* m=pvMoves;*m!=MOVE_NONE;++m)
                            candidatePv.push_back(*m);
                    }
                    if(actionValue>=beta) break;
                }
                if(!found)
                    actionValue=pos.checkers() ? pos.checkmate_value(ss->ply)
                                               : pos.stalemate_value(ss->ply);
            }
            else
            {
                initChild(MOVE_NONE);
                // Upgrade ends the turn even though it is not a board move.
                // Its successor must cost one ply, just as Teleport does.
                const Depth remaining=std::max(Depth(0),depth-(changesSide?1:0));
                actionValue=changesSide
                    ? -search<PV>(pos,child,-beta,-alpha,remaining,false)
                    :  search<PV>(pos,child,alpha,beta,remaining,false);
                for(Move* m=pvMoves;*m!=MOVE_NONE;++m)
                    candidatePv.push_back(*m);
            }
            pos.undo_ability_action(abilityUndo);
            if (Threads.stop.load(std::memory_order_relaxed))
                return VALUE_ZERO;

            if(actionValue>bestValue)
            {
                bestValue=actionValue;
                if(!thisThread->rootAbility.valid
                   || actionValue>thisThread->rootAbility.score)
                {
                    thisThread->rootAbility.valid=true;
                    thisThread->rootAbility.action=action;
                    thisThread->rootAbility.score=actionValue;
                    thisThread->rootAbility.selDepth=thisThread->selDepth;
                    thisThread->rootAbility.pv=std::move(candidatePv);
                }
                if(actionValue>alpha)
                {
                    if(actionValue>=beta)
                        return actionValue; // root aspiration window will retry
                    alpha=actionValue;
                }
            }
        }
    }

'''
# Finish Stockfish's ordinary root candidates first, then use the *same*
# alpha/beta window for the special-action candidates, all inside search<Root>.
# In particular, no ability undo should affect the ordinary root move loop.
post_anchor="    // The following condition would detect a stop only after move loop has been"
if s.count(post_anchor)!=1:
    raise SystemExit("Expected exactly one end-of-root move-loop anchor")
s=s.replace(post_anchor,root_hook+post_anchor,1)
# Upgrades end the turn and must consume a ply in non-root search too.
old_depth="depth - (consumesMove ? 1 : 0)"
new_depth="depth - (sideChanged ? 1 : 0)"
if s.count(old_depth)!=1:
    raise SystemExit("Expected exactly one old synthetic child depth expression")
s=s.replace(old_depth,new_depth,1)

# At the root a special action may legally evade check even when there is
# no ordinary king escape, so adjust Stockfish's move-count assertion as well.
old_assert="    assert(moveCount || !ss->inCheck || excludedMove || !MoveList<LEGAL>(pos).size());"
new_assert="    assert(moveCount || (rootNode && thisThread->rootAbility.valid) || !ss->inCheck || excludedMove || !MoveList<LEGAL>(pos).size());"
if s.count(old_assert)!=1: raise SystemExit("Move-count assertion anchor changed")
s=s.replace(old_assert,new_assert,1)

# A position with special-only actions must not be marked checkmate/stalemate.
old="    if (!moveCount)\n        bestValue = excludedMove ? alpha :"
new="    if (!moveCount && !(rootNode && thisThread->rootAbility.valid))\n        bestValue = excludedMove ? alpha :"
if s.count(old)!=1: raise SystemExit("Mate/stalemate anchor changed")
s=s.replace(old,new,1)
# The upstream MainThread::search() declares mate/stalemate immediately if
# there are no ordinary root moves. An AbilityChess player can be able to
# Freeze an attacker or buy an upgrade at such a position. Seed the single
# root search with a sentinel ordinary move so it can consider real abilities.
main_root="  if (rootMoves.empty() || (CurrentProtocol == XBOARD && rootPos.is_optional_game_end()))"
if s.count(main_root)!=1:
    raise SystemExit("MainThread terminal-search root anchor changed")
s=s.replace(main_root,\
    "  const bool abilityOnlyRoot = rootMoves.empty() && rootPos.abilityfish_active()\\n"
    "                           && !rootPos.ability_actions().empty();\\n"
    "  if ((rootMoves.empty() && !abilityOnlyRoot) || (CurrentProtocol == XBOARD && rootPos.is_optional_game_end()))",1)
main_start="      Threads.start_searching(); // start non-main threads"
if s.count(main_start)!=1:
    raise SystemExit("MainThread search dispatch anchor changed")
s=s.replace(main_start,\
    "      if (abilityOnlyRoot) rootMoves.emplace_back(MOVE_NONE);\\n"
    "      Threads.start_searching(); // start non-main threads",1)

# Preserve the variant root best score when regular moves have inferior scores.
# Existing final bestmove transport uses rootAbility, so no protocol changes.
path.write_text(s)
print("Installed unified AbilityFish Root search")
