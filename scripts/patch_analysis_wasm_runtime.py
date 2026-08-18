#!/usr/bin/env python3
from pathlib import Path
import re
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
s = path.read_text(encoding='utf-8')

old_depth = '<select id="analysisDepthSelect"><option value="1">1 — quick</option><option value="2" selected>2 — balanced</option><option value="3">3 — deeper</option></select>'
new_depth = '<select id="analysisDepthSelect"><option value="5">5 — quick</option><option value="10">10 — balanced</option><option value="15" selected>15 — full</option></select>'
if old_depth in s:
    s = s.replace(old_depth, new_depth, 1)
elif new_depth not in s:
    raise SystemExit('analysis depth selector anchor changed')

old_request = """  function requestAbilityFishAnalysis(state,options={}){\n    return new Promise((resolve,reject)=>{\n      let worker;\n      try{worker=new Worker(ensureAbilityFishWorkerUrl());analysisWorkers.add(worker);}catch(e){reject(e);return;}\n      const id=`analysis-${++analysisWorkerRequestSeq}-${Date.now()}`;let settled=false;\n      const cleanup=()=>{clearTimeout(timeout);analysisWorkers.delete(worker);try{worker.terminate();}catch{}};\n      const timeout=setTimeout(()=>{if(settled)return;settled=true;cleanup();reject(new Error('AbilityFish analysis timed out'));},7000);\n      const onMessage=e=>{if(e.data?.id!==id||settled)return;settled=true;cleanup();if(e.data.error)reject(new Error(e.data.error));else resolve(e.data.result);};\n      worker.addEventListener('message',onMessage);\n      worker.addEventListener('error',e=>{if(settled)return;settled=true;cleanup();reject(new Error(e.message||'AbilityFish worker failed'));},{once:true});\n      worker.postMessage({id,state:normalizeAnalysisState(state),options});\n    });\n  }\n"""

new_request = r'''  const ANALYSIS_ABILITYFISH_WORKER='./analysis-engine/abilityfish-worker.js';
  const ANALYSIS_ABILITYFISH_NAMES=['Move','Shield','Freeze','Bomb','Swap','Swap','Recall','Ambush','Teleport','Reinforce','Portal','Portal','Fortify','Double Move','Upgrade'];
  function analysisSquareName(v){
    if(!v||v.r==null||v.c==null)return '-';
    return String.fromCharCode(97+Number(v.c))+String(8-Number(v.r));
  }
  function analysisStateFen(state){
    const rows=[];
    for(let r=0;r<8;r++){
      let row='',empty=0;
      for(let c=0;c<8;c++){
        const p=state.board?.[r]?.[c]||null;
        if(!p){empty++;continue;}
        if(empty){row+=empty;empty=0;}
        const type=String(p[1]||'p');row+=p[0]==='w'?type.toUpperCase():type;
      }
      if(empty)row+=empty;rows.push(row);
    }
    let castling='';
    if(state.castlingRights?.w?.k)castling+='K';if(state.castlingRights?.w?.q)castling+='Q';
    if(state.castlingRights?.b?.k)castling+='k';if(state.castlingRights?.b?.q)castling+='q';
    if(!castling)castling='-';
    const ep=state.enPassant?.r!=null?analysisSquareName(state.enPassant):'-';
    return `${rows.join('/')} ${state.turn==='b'?'b':'w'} ${castling} ${ep} ${Math.max(0,Number(state.halfmoveClock||0))} 1`;
  }
  function analysisPieceCode(piece){
    if(!piece||piece.length<2)return 0;
    const type=piece[1]==='k'?63:({p:1,n:2,b:3,r:4,q:5}[piece[1]]||0);
    return type+(piece[0]==='b'?64:0);
  }
  function analysisTimedMap(value){
    const out={w:null,b:null};
    for(const side of ['w','b']){
      const v=value?.[side];if(!v)continue;
      out[side]={...v,square:{r:v.r,c:v.c},turnsRemaining:Number(v.turnsRemaining??1),active:true};
    }
    return out;
  }
  function analysisFrozenCasterMap(value){
    const targets=analysisTimedMap(value);
    return {w:targets.b,b:targets.w};
  }
  function analysisAbilityPayload(state){
    const turn=state.turn==='b'?'b':'w';
    const last={w:null,b:null};
    for(const side of ['w','b']){
      const m=state.lastMoveByColor?.[side];if(!m)continue;
      last[side]={from:m.from,to:m.to,pieceCode:analysisPieceCode(m.piece),valid:true};
    }
    const fort={w:null,b:null};
    for(const side of ['w','b']){
      const f=state.fortified?.[side];if(f)fort[side]={squares:f.squares||[],turnsRemaining:Number(f.turnsRemaining??1),active:true};
    }
    return {
      whitePoints:Number(state.points?.w||0),blackPoints:Number(state.points?.b||0),turn,
      abilityUsedThisTurn:{w:turn==='w'&&!!state.abilityUsed,b:turn==='b'&&!!state.abilityUsed},
      boardMovesRemaining:Number(state.movesRemaining??1),doubleMoveActive:!!state.doubleMoveActive,
      beganTurnInCheck:state.beganTurnInCheck??(!state.doubleMoveActive&&inCheck(state,turn)),abilitiesEnabled:state.abilitiesEnabled!==false,
      upgradesEnabled:state.upgradesEnabled!==false,upgradeLimit:Number(state.upgradeLimit??3),
      upgrades:state.upgrades||{w:{},b:{}},shields:analysisTimedMap(state.shielded),
      frozen:analysisFrozenCasterMap(state.frozen),ambushes:analysisTimedMap(state.ambushed),
      fortify:fort,portals:state.portals||{w:null,b:null},lastMove:last
    };
  }
  function analysisUciScore(info,rootTurn){
    const sc=info?.score;if(!sc)return 0;
    let rootValue=0;
    if(sc.type==='mate')rootValue=(sc.value>0?1:-1)*(99000-Math.min(999,Math.abs(sc.value)));
    else rootValue=Number(sc.value||0);
    return rootTurn==='b'?rootValue:-rootValue;
  }
  function analysisAbilityLabel(entry){
    const a=entry?.action;if(!a)return 'Ability action';
    const name=ANALYSIS_ABILITYFISH_NAMES[a.kind]||`Ability ${a.kind}`;
    const sq=i=>i>=0&&i<64?String.fromCharCode(97+(i%8))+String(1+Math.floor(i/8)):'';
    const tail=[sq(a.from),sq(a.to)].filter(Boolean).join(' → ');
    return tail?`${name}: ${tail}`:name;
  }
  function convertWasmAnalysisResult(state,result){
    const lines=Array.isArray(result?.lines)?result.lines:[];
    const displayLines=lines.filter(x=>x?.pv?.length).map(x=>({pv:x.pv.join(' '),score:analysisUciScore(x,state.turn)}));
    if(result?.abilityAction){
      displayLines.unshift({pv:analysisAbilityLabel(result.abilityAction),score:analysisUciScore({score:result.abilityAction.score},state.turn)});
    }
    const primary=lines.find(x=>(x.multipv||1)===1)||lines[0]||null;
    const primaryScore=result?.abilityAction&&!result?.bestmove
      ?analysisUciScore({score:result.abilityAction.score},state.turn)
      :analysisUciScore(primary,state.turn);
    return {score:primaryScore,depth:Number(primary?.depth||result?.depth||1),nodes:Number(primary?.nodes||0),displayLines,wasm:true,requestedDepth:Number(result?.requestedDepth||0),capped:!!result?.capped};
  }
  function requestAbilityFishAnalysis(state,options={}){
    return new Promise((resolve,reject)=>{
      let worker;
      try{worker=new Worker(ANALYSIS_ABILITYFISH_WORKER);analysisWorkers.add(worker);}catch(e){reject(e);return;}
      const id=`analysis-${++analysisWorkerRequestSeq}-${Date.now()}`;let settled=false;
      const cleanup=()=>{clearTimeout(timeout);analysisWorkers.delete(worker);try{worker.terminate();}catch{}};
      const timeout=setTimeout(()=>{if(settled)return;settled=true;cleanup();reject(new Error('AbilityFish depth search timed out'));},30000);
      const onMessage=e=>{
        if(e.data?.id!==id||settled)return;
        if(e.data?.type==='info'||e.data?.type==='abilityinfo')return;
        if(e.data?.type==='error'||e.data?.error){settled=true;cleanup();reject(new Error(e.data?.error||'AbilityFish worker failed'));return;}
        if(e.data?.type==='result'||e.data?.result){settled=true;cleanup();resolve(convertWasmAnalysisResult(state,e.data.result));}
      };
      worker.addEventListener('message',onMessage);
      worker.addEventListener('error',e=>{if(settled)return;settled=true;cleanup();reject(new Error(e.message||'AbilityFish WASM worker failed'));},{once:true});
      const depth=Math.max(1,Math.min(15,Number(options.depth||15)));
      const multiPV=Math.max(1,Math.min(3,Number(options.multiPV??(depth>5?1:3))));
      worker.postMessage({id,fen:analysisStateFen(state),depth,multiPV,maxTimeMs:options.maxTimeMs,abilityFishEnabled:options.abilityFishEnabled!==false,abilityState:analysisAbilityPayload(state)});
    });
  }
'''

newline = '\r\n' if '\r\n' in s else '\n'
normalized = s.replace('\r\n','\n')
if old_request in normalized:
    normalized = normalized.replace(old_request, new_request, 1)
elif 'const ANALYSIS_ABILITYFISH_WORKER=' not in normalized:
    raise SystemExit('requestAbilityFishAnalysis anchor changed')
else:
    # Keep existing already-patched pages aligned with the latest adapter.
    normalized = normalized.replace("multiPV:3,abilityState:analysisAbilityPayload(state)", "multiPV,maxTimeMs:options.maxTimeMs,abilityFishEnabled:options.abilityFishEnabled!==false,abilityState:analysisAbilityPayload(state)")
    normalized = normalized.replace("const depth=Math.max(1,Math.min(15,Number(options.depth||15)));\n      worker.postMessage", "const depth=Math.max(1,Math.min(15,Number(options.depth||15)));\n      const multiPV=Math.max(1,Math.min(3,Number(options.multiPV??(depth>5?1:3))));\n      worker.postMessage")

normalized = normalized.replace(
    "const requestedDepth=Math.max(1,Math.min(3,Number(document.getElementById('analysisDepthSelect')?.value||2)));",
    "const requestedDepth=Math.max(1,Math.min(15,Number(document.getElementById('analysisDepthSelect')?.value||15)));",
    1
)
normalized = normalized.replace(
    "const display=analysisLocalCandidateLines(snapshot,result);",
    "const display=Array.isArray(result?.displayLines)&&result.displayLines.length?result.displayLines:analysisLocalCandidateLines(snapshot,result);",
    1
)
normalized = normalized.replace(
    "meta.textContent=`${refined?'Refined':'Quick'} AbilityFish · depth ${result?.depth??1} · ${nodes} nodes${note?` · ${note}`:''}`;",
    "meta.textContent=`${refined?'Refined':'Quick'} AbilityFish${result?.wasm?' WASM':''} · depth ${result?.depth??1}${result?.capped&&result?.requestedDepth?`/${result.requestedDepth}`:''} · ${nodes} nodes${note?` · ${note}`:''}`;",
    1
)
normalized = normalized.replace(
    "meta.textContent=`${refined?'Refined':'Quick'} AbilityFish${result?.wasm?' WASM':''} · depth ${result?.depth??1} · ${nodes} nodes${note?` · ${note}`:''}`;",
    "meta.textContent=`${refined?'Refined':'Quick'} AbilityFish${result?.wasm?' WASM':''} · depth ${result?.depth??1}${result?.capped&&result?.requestedDepth?`/${result.requestedDepth}`:''} · ${nodes} nodes${note?` · ${note}`:''}`;",
    1
)
normalized = normalized.replace(
    "quick=await requestAbilityFishAnalysis(snapshot,{depth:1,useAbilities:false,useComplexAbilities:false});",
    "quick=await requestAbilityFishAnalysis(snapshot,{depth:Math.min(5,requestedDepth),multiPV:3});",
    1
)
normalized = normalized.replace(
    "quick=await requestAbilityFishAnalysis(snapshot,{depth:Math.min(5,requestedDepth)});",
    "quick=await requestAbilityFishAnalysis(snapshot,{depth:Math.min(5,requestedDepth),multiPV:3});",
    1
)
normalized = normalized.replace(
    "meta.textContent='Calculating quick evaluation…';",
    "meta.textContent='Starting AbilityFish WASM…';",
    1
)

if 'ANALYSIS_ABILITYFISH_WORKER' not in normalized or "Math.min(15,Number(document.getElementById('analysisDepthSelect')" not in normalized:
    raise SystemExit('analysis WASM patch did not apply completely')
if "depth>5?1:3" not in normalized:
    raise SystemExit('deep single-PV Analysis request did not install')

path.write_text(normalized.replace('\n', newline), encoding='utf-8', newline='')
print('Patched Analysis board to use custom AbilityFish WASM runtime')
