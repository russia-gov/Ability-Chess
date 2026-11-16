#!/usr/bin/env node
'use strict';
// Guarded online-only client migration, never applied to main or live site.
// No client-supplied state may pass through the new action transport.
const fs=require('node:fs');
let html=fs.readFileSync('index.html','utf8');
const changes=[];
function swap(oldText,newText,label){
 const n=html.split(oldText).length-1;
 if(n!==1)throw Error(label+': expected one anchor, found '+n);
 html=html.replace(oldText,newText);changes.push(label);
}
if(html.includes('const VERIFIED_ONLINE_GAMEPLAY = true;')){
 console.log('Verified online action adapter is already installed');process.exit(0);
}
if(!process.argv.includes('--apply'))throw Error('Use --apply to modify index.html');

swap('</head>','  <script src="client/verified-online-transport.js"></script>\n</head>','load browser action transport');

const bootstrap=[
"  // The browser requests legal actions but never supplies the resulting position.",
"  const VERIFIED_ONLINE_GAMEPLAY = true;",
"  let verifiedOnlineTransport=null;",
"  let verifiedOnlineBusy=false;",
"  function verifiedOnlineGame(){",
"    return VERIFIED_ONLINE_GAMEPLAY && game?.mode==='online' && !!onlineSession?.id;",
"  }",
"  function getVerifiedTransport(){",
"    if(!verifiedOnlineTransport){",
"      const Transport=window.AbilityChessVerifiedOnlineTransport?.Transport;",
"      if(!Transport)throw Error('Verified online gameplay transport unavailable');",
"      verifiedOnlineTransport=new Transport({",
"        endpoint:SUPABASE_URL+'/functions/v1/verified-game',apiKey:SUPABASE_KEY,",
"        getAccessToken:()=>memberSession?.access_token||null,",
"        getSession:()=>onlineSession,",
"        onState:(state,result)=>{",
"          if(!onlineSession||!game||game.mode!=='online')return;",
"          onlineSession.version=Number(result.version??result.roomVersion);",
"          onlineSession.waiting=result.status==='waiting'||result.roomStatus==='waiting';",
"          if(result.settings?.hostColor)game.hostColor=result.settings.hostColor;",
"          localStorage.setItem('abilityChessOnline',JSON.stringify(onlineSession));",
"          restoreOnlineState(state);",
"          if(state?.over&&memberSession?.access_token)loadMyProfile().catch(()=>{});",
"        }",
"      });",
"    }",
"    return verifiedOnlineTransport;",
"  }",
"  async function verifiedOnlineSubmit(action){",
"    if(!verifiedOnlineGame())return;",
"    if(verifiedOnlineBusy){game.lastMessage='Waiting for server confirmation.';render();return;}",
"    verifiedOnlineBusy=true;",
"    try{",
"      if(memberSession?.refresh_token&&Date.now()/1000>Number(memberSession.expires_at||0)-45)",
"        await refreshMemberToken();",
"      await getVerifiedTransport().submit(action);",
"      onlineLastSuccess=Date.now();setOnlineConnectionStatus('connected');",
"    }catch(e){",
"      console.warn('Server did not accept the online action',e);",
"      if(game)game.lastMessage=e.message||'Action was not accepted.';",
"      setOnlineConnectionStatus('reconnecting');render();",
"    }finally{verifiedOnlineBusy=false;}",
"  }",
"  async function verifiedOnlinePoll(){",
"    if(!verifiedOnlineGame()||verifiedOnlineBusy||onlinePollInFlight)return;",
"    onlinePollInFlight=true;",
"    try{",
"      if(memberSession?.refresh_token&&Date.now()/1000>Number(memberSession.expires_at||0)-45)",
"        await refreshMemberToken();",
"      await getVerifiedTransport().refresh();",
"      onlineLastSuccess=Date.now();setOnlineConnectionStatus('connected');",
"    }catch(e){setOnlineConnectionStatus('reconnecting');}",
"    finally{onlinePollInFlight=false;}",
"  }",
""
].join('\n');

swap('  function markOnlineMutation(){',bootstrap+'\n  function markOnlineMutation(){','initialize verified action client');

swap("  async function syncOnlineState(){\n    if(!onlineSession||!game||game.mode!=='online') return;",
"  async function syncOnlineState(){\n    if(VERIFIED_ONLINE_GAMEPLAY)return;\n    if(!onlineSession||!game||game.mode!=='online') return;",
'disable legacy board-state writes');

swap("  async function pollOnlineRoom(){\n    if(!onlineSession||onlinePollInFlight) return;",
"  async function pollOnlineRoom(){\n    if(VERIFIED_ONLINE_GAMEPLAY&&game?.onlineStarted===true){await verifiedOnlinePoll();return;}\n    if(!onlineSession||onlinePollInFlight) return;",
'poll official game state');

swap("      await syncOnlineState();\n      gameModeLabel.innerHTML=",
"      if(VERIFIED_ONLINE_GAMEPLAY){\n"+
"        const result=await getVerifiedTransport().submit({type:'configureRoom',hostColor,\n"+
"          settings:{base,increment,startingPoints,upgradeLimit,abilitiesEnabled,upgradesEnabled}});\n"+
"        onlineSession.waiting=false;onlineSession.color=hostColor;\n"+
"        restoreOnlineState(result.state);\n"+
"      }else await syncOnlineState();\n      gameModeLabel.innerHTML=",
'start casual room from server-generated board');

swap("  function makeMove(originalMove, {animate=true, source='normal'} = {}){\n    const piece = pieceAt(game.board, originalMove.from.r, originalMove.from.c);\n    if (!piece) return;\n    const move = choosePromotion(originalMove, piece);",
"  function makeMove(originalMove, {animate=true, source='normal'} = {}){\n"+
"    const piece = pieceAt(game.board, originalMove.from.r, originalMove.from.c);\n"+
"    if (!piece) return;\n"+
"    const move = choosePromotion(originalMove, piece);\n"+
"    if(verifiedOnlineGame()){\n"+
"      verifiedOnlineSubmit({type:'move',from:{r:move.from.r,c:move.from.c},\n"+
"        to:{r:move.to.r,c:move.to.c},\n"+
"        ...(piece[1]==='p'&&isPromotionRank(piece[0],move.to.r)\n"+
"          ?{promotion:move.promotion||'q'}:{})});\n"+
"      return;\n"+
"    }",
'server moves');

swap("    if(id==='double'){\n      game.points[game.turn]-=def.cost;",
"    if(id==='double'){\n      if(verifiedOnlineGame()){\n"+
"        game.activeAbility=null;game.awaitingAbilityTarget=false;\n"+
"        verifiedOnlineSubmit({type:'ability',id:'double'});return;\n"+
"      }\n      game.points[game.turn]-=def.cost;",
'server Double Move');

swap("    } else if(id==='recall') {\n      applyRecall();",
"    } else if(id==='recall') {\n"+
"      if(verifiedOnlineGame()){verifiedOnlineSubmit({type:'ability',id:'recall'});return;}\n"+
"      applyRecall();",
'server Recall');

swap("  function completeUpgradePurchase(up,color,replacedType=null){\n    ensureUpgradeState(game);",
"  function completeUpgradePurchase(up,color,replacedType=null){\n"+
"    if(verifiedOnlineGame()){\n"+
"      closeUpgradeReplaceDialog();\n"+
"      verifiedOnlineSubmit({type:'upgrade',id:up.id,\n"+
"        ...(replacedType?{replaceType:replacedType}:{})});return;\n"+
"    }\n    ensureUpgradeState(game);",
'server upgrades');

swap("  function handleAbilityClick(r,c){\n    const id=game.activeAbility;",
"  function handleAbilityClick(r,c){\n"+
"    const id=game.activeAbility;\n"+
"    if(verifiedOnlineGame()){\n"+
"      const target={r,c};\n"+
"      if(id==='teleport'&&!game.selected)return attemptTeleportStep(r,c),render();\n"+
"      if(id==='swap'&&!game.abilitySelection)return applySwap(r,c),render();\n"+
"      if(id==='portal'&&!game.abilitySelection)return applyPortal(r,c),render();\n"+
"      if(id==='reinforce')return applyReinforce(r,c),render();\n"+
"      const action={type:'ability',id};\n"+
"      if(id==='teleport'){action.from={...game.selected};action.to=target;}\n"+
"      else if(id==='swap'||id==='portal'){\n"+
"        action.from={...game.abilitySelection};action.to=target;\n"+
"      }else action.target=target;\n"+
"      verifiedOnlineSubmit(action);return;\n"+
"    }",
'server all targeted abilities');

swap("const next=cloneState(game);next.board[r][c]=game.turn+t; if(!allLegalMoves(next,game.turn).length)",
"if(verifiedOnlineGame()){\n"+
"      verifiedOnlineSubmit({type:'ability',id:'reinforce',target:{r,c},promoteTo:t});return;\n"+
"    }\n    const next=cloneState(game);next.board[r][c]=game.turn+t; if(!allLegalMoves(next,game.turn).length)",
'server Reinforce choice');

swap("  async function saveFinishedGameToHistory(){\n    if(!memberSession?.access_token||!game?.over||game.historySaved)return;",
"  async function saveFinishedGameToHistory(){\n"+
"    if(verifiedOnlineGame()){\n"+
"      if(game?.over){game.historySaved=true;if(memberSession?.access_token)loadMyProfile().catch(()=>{});}\n"+
"      return;\n"+
"    }\n"+
"    if(!memberSession?.access_token||!game?.over||game.historySaved)return;",
'disable client-submitted rated results');

swap("  function endGame(winner, reason, detail){",
"  function endGame(winner, reason, detail){\n"+
"    if(verifiedOnlineGame()){\n"+
"      if(reason==='timeout'&&winner===game.playerColor)\n"+
"        verifiedOnlineSubmit({type:'claimTimeout'});\n"+
"      else if(game)game.lastMessage='Waiting for verified result confirmation.';\n"+
"      return;\n"+
"    }",
'server-confirm match endings');

swap("  function beginOnlineRematch(){\n    if(!game || game.mode!=='online' || !onlineSession) return;",
"  function beginOnlineRematch(){\n"+
"    if(verifiedOnlineGame()){\n"+
"      game.lastMessage='Start a new verified game from the online lobby.';render();return;\n"+
"    }\n    if(!game || game.mode!=='online' || !onlineSession) return;",
'forbid old same-room rematch reset');

swap("  function offerOnlineRematch(){\n    if(!game || game.mode!=='online' || !game.over || game.rematchChallenge) return;",
"  function offerOnlineRematch(){\n"+
"    if(verifiedOnlineGame()){\n"+
"      game.lastMessage='Start a new verified game from the online lobby.';render();return;\n"+
"    }\n    if(!game || game.mode!=='online' || !game.over || game.rematchChallenge) return;",
'forbid rematch state claims');

swap("  offerDrawBtn.addEventListener('click',()=>{\n    if(!game || game.over || game.mode==='bot') return;",
"  offerDrawBtn.addEventListener('click',()=>{\n"+
"    if(!game || game.over || game.mode==='bot') return;\n"+
"    if(verifiedOnlineGame()){\n"+
"      verifiedOnlineSubmit({type:game.drawOffer===game.playerColor?'cancelDraw':'offerDraw'});return;\n"+
"    }",
'server draw offer');

swap("  acceptDrawBtn.addEventListener('click',()=>{\n    if(!game || game.over || !game.drawOffer) return;",
"  acceptDrawBtn.addEventListener('click',()=>{\n"+
"    if(!game || game.over || !game.drawOffer) return;\n"+
"    if(verifiedOnlineGame()){verifiedOnlineSubmit({type:'acceptDraw'});return;}",
'server draw acceptance');

swap("  declineDrawBtn.addEventListener('click',()=>{\n    if(!game || game.over || !game.drawOffer) return;",
"  declineDrawBtn.addEventListener('click',()=>{\n"+
"    if(!game || game.over || !game.drawOffer) return;\n"+
"    if(verifiedOnlineGame()){verifiedOnlineSubmit({type:'declineDraw'});return;}",
'server draw refusal');

swap("  resignBtn.addEventListener('click',()=>{\n    if(!game || game.over) return;",
"  resignBtn.addEventListener('click',()=>{\n"+
"    if(!game || game.over) return;\n"+
"    if(verifiedOnlineGame()){verifiedOnlineSubmit({type:'resign'});return;}",
'server resignation');

fs.writeFileSync('index.html',html,'utf8');
console.log('Applied '+changes.length+' guarded verified gameplay integration points: '+changes.join(', '));
