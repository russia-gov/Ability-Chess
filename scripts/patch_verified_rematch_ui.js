#!/usr/bin/env node
'use strict';
// Applies secure casual-rematch controls to the staged verified online client.
// CI commits only to the security draft branch, never to production.
const fs=require('node:fs');
let html=fs.readFileSync('index.html','utf8');
const once=(from,to,label)=>{
 const n=html.split(from).length-1;
 if(n!==1)throw Error(label+' expected one anchor, found '+n);
 html=html.replace(from,to);
};
if(html.includes('function renderVerifiedRematchPanel(){')){
 console.log('Secure rematch UI already installed');process.exit(0);
}
if(!process.argv.includes('--apply'))throw Error('Use --apply');

const helpers=[
"  let verifiedRematch=null;",
"  function renderVerifiedRematchPanel(){",
"    const screen=document.getElementById('gameScreen');",
"    if(!screen)return;",
"    let panel=document.getElementById('verifiedRematchPanel');",
"    if(!verifiedOnlineGame()||!game?.over||!verifiedRematch){panel?.remove();return;}",
"    if(!panel){panel=document.createElement('div');panel.id='verifiedRematchPanel';",
"      panel.style.cssText='position:fixed;bottom:16px;right:16px;z-index:1200;max-width:min(92vw,360px);padding:14px 18px;border-radius:12px;border:1px solid var(--border,#777);background:var(--card,#222);color:var(--text,#fff);box-shadow:0 8px 25px #0005';",
"      screen.appendChild(panel);}",
"    panel.replaceChildren();",
"    const msg=document.createElement('div');msg.style.marginBottom='10px';",
"    const offered=verifiedRematch.status==='offered';",
"    const own=verifiedRematch.offeredBy===game.playerColor;",
"    msg.textContent=offered?(own?'Rematch offered. Waiting for your opponent.':'Your opponent offers a casual rematch with colors reversed.'):",
"      'Play another casual game with the same opponent?';",
"    panel.appendChild(msg);",
"    const add=(label,action)=>{const button=document.createElement('button');",
"      button.textContent=label;button.type='button';button.style.cssText='margin:0 8px 4px 0;padding:8px 12px;border-radius:7px';",
"      button.onclick=()=>{button.disabled=true;verifiedOnlineSubmit({type:action}).finally(()=>{button.disabled=false;});};",
"      panel.appendChild(button);};",
"    if(offered){",
"      if(!own)add('Accept rematch','acceptRematch');",
"      add(own?'Cancel offer':'Decline','declineRematch');",
"    }else add('Offer rematch','offerRematch');",
"  }",
"  function handleVerifiedRematch(info){",
"    if(info?.status==='ready'&&info.room?.id&&info.room?.token&&info.room?.state){",
"      const next=info.room;",
"      if(onlineSession?.id===next.id)return;",
"      onlineSession={...onlineSession,id:next.id,token:next.token,",
"        color:next.color,version:next.version,waiting:false};",
"      localStorage.setItem('abilityChessOnline',JSON.stringify(onlineSession));",
"      verifiedRematch=null;",
"      game.playerColor=next.color;",
"      game.hostColor=next.settings?.hostColor||next.color;",
"      restoreOnlineState(next.state);",
"      document.getElementById('verifiedRematchPanel')?.remove();",
"      return;",
"    }",
"    verifiedRematch=info;",
"    renderVerifiedRematchPanel();",
"  }",
""
].join('\n');
once('  let verifiedOnlineBusy=false;','  let verifiedOnlineBusy=false;\n'+helpers,'insert verified rematch state and UI');
once("          if(state?.over&&memberSession?.access_token)loadMyProfile().catch(()=>{});",
"          if(state?.over&&memberSession?.access_token)loadMyProfile().catch(()=>{});\n          renderVerifiedRematchPanel();",
'render controls after terminal snapshot');
once("        },\n      });\n    }\n    return verifiedOnlineTransport;",
"        },\n        onRematch:(info)=>handleVerifiedRematch(info),\n      });\n    }\n    return verifiedOnlineTransport;",
'listen for rematch status');
once("      game.lastMessage='Start a new verified game from the online lobby.';render();return;",
"      verifiedOnlineSubmit({type:'acceptRematch'});return;",
'enable accepting a rematch');
once("      game.lastMessage='Start a new verified game from the online lobby.';render();return;",
"      verifiedOnlineSubmit({type:'offerRematch'});return;",
'enable offering a rematch');
fs.writeFileSync('index.html',html,'utf8');
console.log('Applied staged secure rematch UI');
