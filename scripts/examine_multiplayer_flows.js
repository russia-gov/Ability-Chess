#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const lines=fs.readFileSync('index.html','utf8').split('\n');
const windows=[
 ['Online sync',1530,1602],
 ['State normalization',1935,1998],
 ['Rule transitions',2090,2190],
 ['Endgame & report',2608,2652],
 ['Ability legality',2810,2915],
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
