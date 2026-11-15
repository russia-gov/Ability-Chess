#!/usr/bin/env node
'use strict';
// Read-only scan for exact online mutation and result paths.
const fs=require('node:fs'),lines=fs.readFileSync('index.html','utf8').split('\n');
const terms=[
 /markOnlineMutation\s*\(/,/queueMicrotask\(syncOnlineState\)/,
 /syncOnlineState\s*\(/,
 /ability_chess_(?:apply_rating_result|apply_category_rating_result|tournament_report_result|update_room_action)/,
 /supabaseRpc\(['"](?:ability_chess_|start_|join_|create_)/,
 /endGame\s*\(/,
 /function (?:apply|attempt|complete|tryUse|handleAbility|makeMove|finishTurn|purchaseUpgrade|startConfiguredOnlineGame)/,
 /reportTournament/,/submit.*Result/
];
for(let i=0;i<lines.length;i++){
 const line=lines[i];
 if(terms.some(r=>r.test(line))){
  console.log(String(i+1).padStart(5)+' '+line.slice(0,850));
 }
}
