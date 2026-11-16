#!/usr/bin/env node
'use strict';
// Read-only inventory of the monolithic game code for server-authority extraction.
// Runs in GitHub Actions where the full index.html is available.
const fs=require('node:fs');
const src=fs.readFileSync('index.html','utf8');
const terms=[
  'allLegalMoves','applyMove','makeMove','applyAbility','applyBotAbility',
  'updateRoomAction','ability_chess_update_room_action','ability_chess_apply_category_rating_result',
  'ability_chess_tournament_report_result','game.board','getLegalMoves','useAbility',
  'performAbility','cloneState','applyUpgrade','handleBot','abilityPoints','isInsufficientMaterial','recordPosition','positionKey','function pawnOnOwnSide','function updateClockNow'
];
function lineOf(at) {let l=1;for(let i=0;i<at;i++)if(src.charCodeAt(i)===10)l++;return l;}
function snippet(at,n=260){
  return src.slice(Math.max(0,at-110),Math.min(src.length,at+n))
    .replace(/\s+/g,' ').slice(0,380);
}
console.log('SOURCE bytes='+src.length+' lines='+src.split('\n').length);
for(const term of terms){
  let pos=0,found=[],count=0;
  while((pos=src.indexOf(term,pos))!==-1){
    count++;
    if(found.length<4)found.push({line:lineOf(pos),context:snippet(pos)});
    pos+=term.length;
  }
  console.log('TERM '+term+' TOTAL '+count);
  for(const row of found)console.log('  LINE '+row.line+' '+row.context);
}
const declarations=/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
const funcs=[];let m;
while((m=declarations.exec(src)))funcs.push([m[1],lineOf(m.index)]);
console.log('FUNCTION_COUNT '+funcs.length);
console.log('RULE_CANDIDATES '+JSON.stringify(funcs.filter(([n])=>/legal|move|abil|upgrad|turn|capture|apply|rating|game|room|bot|check|state|attack|replay/i.test(n)).slice(0,240)));
