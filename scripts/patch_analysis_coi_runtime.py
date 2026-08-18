#!/usr/bin/env python3
from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
s = path.read_text(encoding='utf-8').replace('\r\n','\n')

# The existing Analysis UI stores engine scores in a black-positive internal
# convention and analysisWhiteEval() negates them for the bar/text. UCI scores
# are root-side-positive, so convert them into that established convention.
s = s.replace(
    "return rootTurn==='b'?-rootValue:rootValue;",
    "return rootTurn==='b'?rootValue:-rootValue;",
    1
)

# Fairy Piece encoding uses 6 piece-type bits: P/N/B/R/Q = 1..5, KING = 63,
# and Black adds 64. Recall transport needs the exact code for lastMove.
old_piece = """  function analysisPieceCode(piece){\n    if(!piece||piece.length<2)return 0;\n    const pt={p:1,n:2,b:3,r:4,q:5,k:6}[piece[1]]||0;\n    return pt+(piece[0]==='b'?8:0);\n  }\n"""
new_piece = """  function analysisPieceCode(piece){\n    if(!piece||piece.length<2)return 0;\n    const type=piece[1]==='k'?63:({p:1,n:2,b:3,r:4,q:5}[piece[1]]||0);\n    return type+(piece[0]==='b'?64:0);\n  }\n"""
if old_piece in s:
    s=s.replace(old_piece,new_piece,1)
elif new_piece not in s:
    raise SystemExit('analysis piece-code anchor changed')

# The site keys frozen state by the color of the TARGET piece. AbilityFish keys
# frozenEnemy by the color of the CASTER. Swap sides at the boundary.
old_timed = """  function analysisTimedMap(value){\n    const out={w:null,b:null};\n    for(const side of ['w','b']){\n      const v=value?.[side];if(!v)continue;\n      out[side]={...v,square:{r:v.r,c:v.c},turnsRemaining:Number(v.turnsRemaining??1),active:true};\n    }\n    return out;\n  }\n"""
new_timed = old_timed + """  function analysisFrozenCasterMap(value){\n    const targets=analysisTimedMap(value);\n    return {w:targets.b,b:targets.w};\n  }\n"""
if old_timed in s and 'function analysisFrozenCasterMap' not in s:
    s=s.replace(old_timed,new_timed,1)

s=s.replace(
    "frozen:analysisTimedMap(state.frozen),ambushes:analysisTimedMap(state.ambushed),",
    "frozen:analysisFrozenCasterMap(state.frozen),ambushes:analysisTimedMap(state.ambushed),",
    1
)

# The page did not previously persist beganTurnInCheck. Before Double Move is
# active, being currently in check is the information the engine needs to reject
# activation; once Double Move is active it necessarily began from a legal state.
s=s.replace(
    "beganTurnInCheck:!!state.beganTurnInCheck,abilitiesEnabled:state.abilitiesEnabled!==false,",
    "beganTurnInCheck:state.beganTurnInCheck??(!state.doubleMoveActive&&inCheck(state,turn)),abilitiesEnabled:state.abilitiesEnabled!==false,",
    1
)

marker = "ABILITYFISH_ANALYSIS_COI_V1"
if marker not in s:
    anchor = '<head>\n'
    if anchor not in s:
        raise SystemExit('head anchor changed')
    boot = r'''<head>
<script>
// ABILITYFISH_ANALYSIS_COI_V1
// The custom Fairy/AbilityFish runtime uses WebAssembly pthreads. Static hosts
// cannot normally set COOP/COEP response headers, so a same-origin service
// worker supplies them and reloads once after taking control.
(()=>{
  if(!('serviceWorker' in navigator))return;
  const key='abilityfish-coi-reload-v1';
  navigator.serviceWorker.register('./abilityfish-coi-serviceworker.js',{scope:'./'}).then(()=>{
    if(window.crossOriginIsolated){sessionStorage.removeItem(key);return;}
    const reload=()=>{
      if(sessionStorage.getItem(key)==='1')return;
      sessionStorage.setItem(key,'1');
      location.reload();
    };
    if(navigator.serviceWorker.controller)reload();
    else navigator.serviceWorker.addEventListener('controllerchange',reload,{once:true});
  }).catch(err=>console.warn('AbilityFish analysis isolation unavailable',err));
})();
</script>
'''
    s = s.replace(anchor, boot, 1)

# Do not instantiate the threaded engine until isolation has taken effect.
old = """  function requestAbilityFishAnalysis(state,options={}){\n    return new Promise((resolve,reject)=>{\n      let worker;\n"""
new = """  function requestAbilityFishAnalysis(state,options={}){\n    return new Promise((resolve,reject)=>{\n      if(!window.crossOriginIsolated){reject(new Error('AbilityFish Analysis is preparing its browser engine. Reload once if it does not start automatically.'));return;}\n      let worker;\n"""
if old in s:
    s=s.replace(old,new,1)
elif "AbilityFish Analysis is preparing its browser engine" not in s:
    raise SystemExit('analysis request isolation anchor changed')

checks = (
    "return rootTurn==='b'?rootValue:-rootValue;",
    "piece[1]==='k'?63",
    "function analysisFrozenCasterMap",
    "frozen:analysisFrozenCasterMap(state.frozen)",
    "beganTurnInCheck:state.beganTurnInCheck??(!state.doubleMoveActive&&inCheck(state,turn))",
    marker,
)
for check in checks:
    if check not in s:
        raise SystemExit(f'Analysis adapter correction missing: {check}')

path.write_text(s, encoding='utf-8', newline='')
print('Added AbilityFish Analysis isolation and corrected state adapter')
