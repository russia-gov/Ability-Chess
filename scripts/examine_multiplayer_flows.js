#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const lines=fs.readFileSync('index.html','utf8').split('\n');
const windows=[
 ['Online sync',1530,1602],
 ['Ability definitions',982,1000],
 ['Turn reset & transitions',2390,2494],
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
