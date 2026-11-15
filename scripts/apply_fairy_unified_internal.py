#!/usr/bin/env python3
"""Route internal AbilityFish choices through Stockfish's ordinary search loop.

Applied after the root integration script. This is an incremental step toward
one action pipeline: abilities and ordinary moves share the exact same node,
alpha/beta, terminal-result handling and transposition-table write.

The ability-specific make/undo and turn semantics remain distinct. No legal
actions are discarded and the engine still searches to the requested depth.
"""
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else "vendor/Fairy-Stockfish")
path=root/"src"/"search.cpp"
s=path.read_text()
marker="// ABILITYFISH_UNIFIED_INTERNAL_V1"
if marker in s:
    print("Internal unified action loop already applied")
    raise SystemExit(0)

start_marker="    // ABILITYFISH_SEARCH_HOOKS_V6\n"
end_marker="    // Indicate PvNodes that will probably fail low"
if s.count(start_marker)!=1 or s.count(end_marker)!=1:
    raise SystemExit("Expected exactly one original inner-search hook and following anchor")
start=s.index(start_marker)
end=s.index(end_marker,start)
old_block=s[start:end]
if "for (const auto& abilityAction : abilityActions)" not in old_block:
    raise SystemExit("Unable to isolate original ability search")
loop_begin=old_block.index("        for (const auto& abilityAction : abilityActions)")
# Keep the body of the existing tested action search; modify only its iteration.
action_loop=old_block[loop_begin:]
action_loop=action_loop.rstrip()+'\n'
if not action_loop.endswith("    }\n"):
    raise SystemExit("Original ability search has changed shape")
# Remove the outer if block and for-loop wrapper; retain the candidate body.
action_loop=action_loop.replace("        for (const auto& abilityAction : abilityActions)\n        {\n","",1)
action_loop=action_loop.rsplit("        }\n    }\n",1)
if len(action_loop)!=2 or action_loop[1]:
    raise SystemExit("Could not identify ability-search loop closing braces")
action_body=action_loop[0]
if "if (!pos.do_ability_action(abilityAction, abilitySt, abilityUndo))" not in action_body:
    raise SystemExit("Ability action application missing")
action_body=action_body.replace(
    "            const bool sideChanged = pos.side_to_move() != abilityUs;",
    "            legalAbilityActionSearched = true;\n            const bool sideChanged = pos.side_to_move() != abilityUs;",1)
if "legalAbilityActionSearched = true;" not in action_body:
    raise SystemExit("Failed to track legal special actions")
# The new dispatch loop owns the next-candidate continue. Keep a separate branch
# for special action application, but no second loop or second search invocation.
s=s[:start]+s[end:]
move_loop="    while ((move = mp.next_move(moveCountPruning)) != MOVE_NONE)\n    {\n"
if s.count(move_loop)!=1:
    raise SystemExit("Unexpected normal-move loop signature")
unified=r"""    // ABILITYFISH_UNIFIED_INTERNAL_V1
    std::vector<abilityfish::AbilityAction> unifiedAbilityActions;
    if (!rootNode && pos.abilityfish_active())
    {
        unifiedAbilityActions = pos.ability_actions();
        std::stable_sort(unifiedAbilityActions.begin(), unifiedAbilityActions.end(),
                         [](const auto& a, const auto& b) {
                             return abilityfish::action_order_priority(a.kind)
                                  < abilityfish::action_order_priority(b.kind);
                         });
    }
    size_t abilityCursor=0;
    bool legalAbilityActionSearched=false;

    // One candidate dispatch loop, one alpha/beta window, one TT result.
    // Special actions are visited first and followed by the MovePicker stream.
    // Every candidate is still searched; no new depth or time cap.
    while (true)
    {
        if (abilityCursor < unifiedAbilityActions.size())
        {
            const auto& abilityAction=unifiedAbilityActions[abilityCursor++];
__ABILITY_BODY__
            continue;
        }
        move = mp.next_move(moveCountPruning);
        if (move == MOVE_NONE) break;
"""
unified=unified.replace("__ABILITY_BODY__",action_body)
s=s.replace(move_loop,unified,1)
# Avoid mistaking positions with no normal moves but valid special actions
# for mate/stalemate (and avoid replacing the root move-list's special check).
old_assert="    assert(moveCount || (rootNode && thisThread->rootAbility.valid) || !ss->inCheck || excludedMove || !MoveList<LEGAL>(pos).size());"
new_assert="    assert(moveCount || legalAbilityActionSearched || (rootNode && thisThread->rootAbility.valid) || !ss->inCheck || excludedMove || !MoveList<LEGAL>(pos).size());"
if s.count(old_assert)!=1:
    raise SystemExit("Unified root assertion missing")
s=s.replace(old_assert,new_assert,1)
old_mate="    if (!moveCount && !(rootNode && thisThread->rootAbility.valid))"
new_mate="    if (!moveCount && !legalAbilityActionSearched && !(rootNode && thisThread->rootAbility.valid))"
if s.count(old_mate)!=1:
    raise SystemExit("Unified root no-moves terminal branch missing")
s=s.replace(old_mate,new_mate,1)
path.write_text(s)
print("Unified nonroot ability/normal-move candidate dispatch installed")
