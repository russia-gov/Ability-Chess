#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const lines=fs.readFileSync('index.html','utf8').split('\n');
const windows=[
 ['Critical online setup',1660,1710],
 ['Persisted game resurrection',1850,1930],
 ['Initial route selection',5440,5480],
 ['Critical online restore',1770,1830],
 ['Online result and flags',2500,2525],
 ['Online abilities and effects',2860,2969],
 ['Ability effect finish',3025,3229],
 ['Move action full',3258,3350],
 ['Draw resignation rematch',5030,5118],
 ['Game config slider limits',580,830],
 ['Supabase RPC and authentication',1250,1410],
 ['Online saved state',1460,1533],
 ['Online sync',1530,1678],
 ['Matchmaking preparation',4775,4825],
 ['Tournament integration',5510,5600],
 ['Ability definitions',982,1000],
 ['Turn reset & transitions',2390,2494],
 ['Game init and draw positions',1860,1944],
 ['Legal moves extra and scoring helpers',2187,2204],
 ['Insufficient material and repetition',2655,2700],
 ['Endgame ability escapes',2700,2821],
 ['Upgrade complete conditions',2970,2985],
 ['Endgame & scoring details',2600,2648],
 ['Capture points helpers',2310,2390],
 ['Upgrade definitions',995,1048],
 ['State normalization',1935,1998],
 ['Pure board rules',1999,2090],
 ['Rule transitions',2090,2190],
 ['Endgame & report',2608,2652],
 ['Ability legality',2810,2915],
 ['Upgrade purchase',2916,2980],
 ['Ability effects remainder',3198,3224],
 ['Abilities effects',3070,3220],
 ['Main makeMove',3258,3340]
];
for(const [title,start,end] of windows) {
  console.log('===== '+title+' lines '+start+'-'+end+' =====');
  for(let i=start;i<=end;i++){
    if(!lines[i-1])continue;
    let l=lines[i-1];
    if(l.length>2200)l=l.slice(0,2200)+'…[truncated]';
    console.log(String(i).padStart(5)+' '+l);
  }
}
