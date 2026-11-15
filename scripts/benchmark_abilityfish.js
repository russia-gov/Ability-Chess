#!/usr/bin/env node
'use strict';
/*
 * Repeatable UCI timing harness for native AbilityFish builds.
 * This is NOT an engine time budget: go depth N always requests full depth.
 * The watchdog only fails the benchmark if the engine hangs.
 *
 * Usage: node scripts/benchmark_abilityfish.js /path/to/stockfish --depth 5 --timeout 180
 * Compare baseline and candidate builds by running this script against each.
 */
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const args=process.argv.slice(2);
const binary=args[0];
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:Number(args[i+1]);};
const depth=option('--depth',5), timeoutSeconds=option('--timeout',180);
const wanted=args.includes('--scenario')?args[args.indexOf('--scenario')+1]:null;
if(!binary||!fs.existsSync(binary)||!Number.isInteger(depth)||depth<1||depth>30||timeoutSeconds<1){
  console.error('Usage: node scripts/benchmark_abilityfish.js ENGINE_PATH [--depth 5] [--timeout 180] [--scenario NAME]');
  process.exit(2);
}
const scenarios=[
  {name:'ordinary_midgame',fen:'r1bqk2r/pppp1ppp/2n2n2/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 5',points:[0,0],abilities:false},
  {name:'ability_tactical',fen:'4k3/2p2pp1/3n4/3q4/3R4/2N5/5PPP/4K3 w - - 0 1',points:[9,8],abilities:true},
  {name:'ability_open_board',fen:'4k3/8/2n5/8/4R3/8/8/4K3 w - - 0 1',points:[12,12],abilities:true},
  {name:'upgraded_knight',fen:'4k3/8/2n5/8/3N4/8/8/4K3 w - - 0 1',points:[0,0],abilities:true,upgrades:['abilityupgrade w 1 5','abilityupgrade b 1 4']}
];
async function run(test){
  return new Promise((resolve,reject)=>{
    const proc=spawn(binary,[],{stdio:['pipe','pipe','pipe']});
    let buffer='',errorBuffer='',reached=0,nodes=0,nps=0,engineTime=0,bestmove=null;
    let infoCount=0,abilityActionCount=0;
    let started=0,ready=false,finished=false;
    const finish=(err)=>{
      if(finished)return; finished=true;clearTimeout(watchdog);
      try{proc.kill();}catch{}
      if(err)return reject(err);
      resolve({scenario:test.name,depthRequested:depth,depthReached:reached,wallMs:Date.now()-started,engineMs:engineTime,nodes,nps,bestmove});
    };
    const watchdog=setTimeout(()=>finish(new Error(test.name+' exceeded watchdog '+timeoutSeconds+'s at depth '+reached+'; nodes='+nodes+'; info='+infoCount+'; abilityActions='+abilityActionCount+'; stderr='+errorBuffer.slice(-1000))),timeoutSeconds*1000);
    proc.on('error',finish);
    proc.on('exit',code=>{if(!finished)finish(new Error(test.name+' exited '+code+': '+errorBuffer.slice(-1000)));});
    proc.stderr.on('data',x=>{errorBuffer+=String(x);});
    proc.stdout.on('data',chunk=>{
      buffer+=String(chunk);let i;
      while((i=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);
        if(line==='uciok'){
          proc.stdin.write('setoption name UCI_Variant value chess\n');
          proc.stdin.write('isready\n');
        }else if(line==='readyok'&&!ready){
          ready=true;
          proc.stdin.write('position fen '+test.fen+'\n');
          proc.stdin.write('abilityfish '+(test.abilities?'on':'off')+'\n');
          if(test.abilities)proc.stdin.write('abilitypoints '+test.points.join(' ')+'\n');
          for(const upgrade of test.upgrades||[])proc.stdin.write(upgrade+'\n');
          started=Date.now();
          proc.stdin.write('go depth '+depth+'\n');
        }else if(line.startsWith('info ')){
          infoCount++;
          if(line.startsWith('info string abilityaction '))abilityActionCount++;
          const d=line.match(/^info depth (\d+)\b/);
          if(d)reached=Math.max(reached,Number(d[1]));
          const n=line.match(/\bnodes (\d+)/);if(n)nodes=Number(n[1]);
          const t=line.match(/\btime (\d+)/);if(t)engineTime=Number(t[1]);
          const p=line.match(/\bnps (\d+)/);if(p)nps=Number(p[1]);
        }else if(line.startsWith('bestmove ')){
          bestmove=line.split(/\s+/)[1]||null;
          if(reached<depth)return finish(new Error(test.name+' stopped at depth '+reached+' < '+depth));
          finish();
        }
      }
    });
    proc.stdin.write('uci\n');
  });
}
(async()=>{
  const results=[];
  const selected=scenarios.filter(x=>!wanted || x.name===wanted);
  if(!selected.length)throw new Error('Unknown --scenario '+wanted+'. Valid: '+scenarios.map(x=>x.name).join(', '));
  for(const test of selected){const r=await run(test);results.push(r);console.error(test.name+': depth='+r.depthReached+' nodes='+r.nodes+' time='+r.wallMs+'ms');}
  console.log(JSON.stringify({benchmark:'abilityfish-v1',engine:binary,depth,results},null,2));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
