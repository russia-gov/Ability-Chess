#!/usr/bin/env python3
from pathlib import Path
import re
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
s = path.read_text(encoding='utf-8').replace('\r\n','\n')

# Preserve the corrected Analysis adapter semantics.
s = s.replace(
    "return rootTurn==='b'?-rootValue:rootValue;",
    "return rootTurn==='b'?rootValue:-rootValue;",
    1
)

old_piece = """  function analysisPieceCode(piece){\n    if(!piece||piece.length<2)return 0;\n    const pt={p:1,n:2,b:3,r:4,q:5,k:6}[piece[1]]||0;\n    return pt+(piece[0]==='b'?8:0);\n  }\n"""
new_piece = """  function analysisPieceCode(piece){\n    if(!piece||piece.length<2)return 0;\n    const type=piece[1]==='k'?63:({p:1,n:2,b:3,r:4,q:5}[piece[1]]||0);\n    return type+(piece[0]==='b'?64:0);\n  }\n"""
if old_piece in s:
    s=s.replace(old_piece,new_piece,1)
elif new_piece not in s:
    raise SystemExit('analysis piece-code anchor changed')

old_timed = """  function analysisTimedMap(value){\n    const out={w:null,b:null};\n    for(const side of ['w','b']){\n      const v=value?.[side];if(!v)continue;\n      out[side]={...v,square:{r:v.r,c:v.c},turnsRemaining:Number(v.turnsRemaining??1),active:true};\n    }\n    return out;\n  }\n"""
new_timed = old_timed + """  function analysisFrozenCasterMap(value){\n    const targets=analysisTimedMap(value);\n    return {w:targets.b,b:targets.w};\n  }\n"""
if old_timed in s and 'function analysisFrozenCasterMap' not in s:
    s=s.replace(old_timed,new_timed,1)

s=s.replace(
    "frozen:analysisTimedMap(state.frozen),ambushes:analysisTimedMap(state.ambushed),",
    "frozen:analysisFrozenCasterMap(state.frozen),ambushes:analysisTimedMap(state.ambushed),",
    1
)
s=s.replace(
    "beganTurnInCheck:!!state.beganTurnInCheck,abilitiesEnabled:state.abilitiesEnabled!==false,",
    "beganTurnInCheck:state.beganTurnInCheck??(!state.doubleMoveActive&&inCheck(state,turn)),abilitiesEnabled:state.abilitiesEnabled!==false,",
    1
)

# V1 used a service-worker COOP/COEP shim to satisfy a pthread build. The
# portable runtime is intentionally single-threaded, so remove the registration
# bootstrap and the hard failure on crossOriginIsolated.
s = re.sub(
    r'<script>\n// ABILITYFISH_ANALYSIS_COI_V1\n.*?</script>\n',
    '',
    s,
    count=1,
    flags=re.S,
)
s = s.replace(
    "      if(!window.crossOriginIsolated){reject(new Error('AbilityFish Analysis is preparing its browser engine. Reload once if it does not start automatically.'));return;}\n",
    '',
    1
)

checks = (
    "return rootTurn==='b'?rootValue:-rootValue;",
    "piece[1]==='k'?63",
    "function analysisFrozenCasterMap",
    "frozen:analysisFrozenCasterMap(state.frozen)",
    "beganTurnInCheck:state.beganTurnInCheck??(!state.doubleMoveActive&&inCheck(state,turn))",
)
for check in checks:
    if check not in s:
        raise SystemExit(f'Analysis adapter correction missing: {check}')
if 'ABILITYFISH_ANALYSIS_COI_V1' in s or 'if(!window.crossOriginIsolated)' in s:
    raise SystemExit('legacy cross-origin-isolation gate still present')

path.write_text(s, encoding='utf-8', newline='')
print('Prepared portable AbilityFish Analysis adapter without browser isolation gate')
