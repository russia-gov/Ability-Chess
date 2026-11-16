#!/usr/bin/env node
'use strict';
const fs=require('node:fs');let s=fs.readFileSync('index.html','utf8');
function replaceOne(a,b,label){
 const n=s.split(a).length-1;
 if(n!==1)throw Error(label+' expected one anchor; got '+n);
 s=s.replace(a,b);
}
if(s.includes('Tournament seat color is the server-assigned color')){
 console.log('Verified UI follow-up safeguards already applied');process.exit(0);
}
if(!process.argv.includes('--apply'))throw Error('Use --apply');
replaceOne(
 "    const keepColor=onlineSession?.role==='host' ? hostColor : other(hostColor);",
 "    // Tournament seat color is the server-assigned color, not the host/guest label.\n"+
 "    const keepColor=onlineSession?.mode==='tournament' && ['w','b'].includes(onlineSession.color)\n"+
 "      ? onlineSession.color\n"+
 "      : onlineSession?.role==='host' ? hostColor : other(hostColor);",
 'tournament seat ownership');
replaceOne(
 '    // Double Move is "armed" when purchased, but it has no board effect until',
 "    // A verified Double Move has already spent points on the server and cannot\n"+
 "    // be refunded by editing browser-side state.\n"+
 "    if(verifiedOnlineGame()&&game.doubleMoveActive&&game.abilityUsed\n"+
 "       &&Number(game.movesRemaining)===2){\n"+
 "      game.lastMessage='Double Move is already committed to the server.';\n"+
 "      render();return;\n"+
 "    }\n"+
 '    // Double Move is "armed" when purchased, but it has no board effect until',
 'prevent client-only Double Move refund');
fs.writeFileSync('index.html',s);
console.log('Corrected verified tournament color and committed Double Move cancellation');
