#!/usr/bin/env python3
from pathlib import Path
import sys

path=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
s=path.read_text(encoding='utf-8').replace('\r\n','\n')

old_cancel="""  function cancelAbility(){
    if (!game || game.over) return;
    if (game.abilityUsed && game.movesRemaining !== 1) return;
    game.activeAbility = null;
    game.awaitingAbilityTarget = false;
    game.selected = null;
    game.legalMoves = [];
    game.lastMessage = `${game.turn==='w'?'White':'Black'} to move.`;
    render();
  }
"""
new_cancel="""  function cancelAbility(){
    if (!game || game.over) return;

    // Targeted abilities have not taken effect until their final target is
    // confirmed, so canceling simply abandons the pending selection.
    if(game.awaitingAbilityTarget || game.activeAbility){
      game.activeAbility = null;
      game.awaitingAbilityTarget = false;
      game.abilitySelection = null;
      game.selected = null;
      game.selectedAsPremove = false;
      game.legalMoves = [];
      game.lastMessage = `${game.turn==='w'?'White':'Black'} to move. Ability canceled.`;
      render();
      return;
    }

    // Double Move is "armed" when purchased, but it has no board effect until
    // the first move is actually played. While both moves remain, allow the
    // player to back out and restore the spent points/ability allowance.
    if(game.doubleMoveActive && game.abilityUsed && Number(game.movesRemaining)===2){
      const def=ABILITIES.find(a=>a.id==='double');
      game.points[game.turn]+=Number(def?.cost||6);
      game.doubleMoveActive=false;
      game.abilityUsed=false;
      game.movesRemaining=1;
      game.activeAbility=null;
      game.awaitingAbilityTarget=false;
      game.abilitySelection=null;
      game.selected=null;
      game.selectedAsPremove=false;
      game.legalMoves=[];
      const expected=`${game.turn==='w'?'White':'Black'} used Double Move.`;
      const idx=Array.isArray(game.log)?game.log.findIndex(entry=>String(entry).replace(HIDDEN_AMBUSH_LOG,'')===expected):-1;
      if(idx>=0)game.log.splice(idx,1);
      game.lastMessage='Double Move canceled. Points refunded.';
      if(game.mode==='online'){markOnlineMutation();queueMicrotask(syncOnlineState);}
      render();
      return;
    }

    // Once an ability has actually changed the position/status, it is committed.
    if(game.abilityUsed){
      game.lastMessage='That ability has already taken effect and can no longer be canceled.';
      render();
      return;
    }

    game.lastMessage='No pending ability to cancel.';
    render();
  }
"""
if old_cancel in s:
    s=s.replace(old_cancel,new_cancel,1)
elif new_cancel not in s:
    raise SystemExit('cancelAbility anchor differs from both expected versions')

old_render="""      el.disabled = false;
      if(disabled && !active) el.setAttribute('aria-disabled','true'); else el.removeAttribute('aria-disabled');
    });
  }

  function formatClock(seconds){
"""
new_render="""      el.disabled = false;
      if(disabled && !active) el.setAttribute('aria-disabled','true'); else el.removeAttribute('aria-disabled');
    });
    if(cancelAbilityBtn){
      const pendingTarget=!!(game?.awaitingAbilityTarget||game?.activeAbility);
      const pendingDouble=!!(game?.doubleMoveActive&&game?.abilityUsed&&Number(game?.movesRemaining)===2);
      cancelAbilityBtn.disabled=!(pendingTarget||pendingDouble);
      cancelAbilityBtn.textContent=pendingDouble?'Cancel Double Move':'Cancel ability';
      cancelAbilityBtn.title=pendingDouble?'Cancel before the first move is played and refund the 6 points.':'Cancel the selected ability before it takes effect.';
    }
  }

  function formatClock(seconds){
"""
if old_render in s:
    s=s.replace(old_render,new_render,1)
elif new_render not in s:
    raise SystemExit('cancel button render anchor differs from both expected versions')

old_poll="async function pollNotifications(){if(!memberSession)return;try{const rows=await memberRpc('ability_chess_list_notifications',{p_after_id:notificationLastId});if(rows?.length){notificationRows.push(...rows);notificationLastId=Math.max(notificationLastId,...rows.map(x=>Number(x.id)||0));notificationRows=notificationRows.slice(-100);renderNotifications();}}catch{} }"
new_poll="async function pollNotifications(){if(!memberSession)return;try{const rows=await memberRpc('ability_chess_list_notifications',{p_after_id:-1});notificationRows=Array.isArray(rows)?rows.slice(-100):[];notificationLastId=notificationRows.length?Math.max(...notificationRows.map(x=>Number(x.id)||0)):0;renderNotifications();}catch{} }"
if old_poll in s:
    s=s.replace(old_poll,new_poll,1)
elif new_poll not in s:
    raise SystemExit('notification polling anchor differs from both expected versions')

for required in [
  'Double Move canceled. Points refunded.',
  "cancelAbilityBtn.textContent=pendingDouble?'Cancel Double Move':'Cancel ability'",
  "p_after_id:-1",
  'ANALYSIS_ABILITYFISH_WORKER',
  'ABILITYFISH_ANALYSIS_COI_V1',
]:
    if required not in s:
        raise SystemExit(f'missing required combined-site marker: {required}')

path.write_text(s,encoding='utf-8',newline='')
print('Applied current main site patch without disturbing AbilityFish Analysis integration')
