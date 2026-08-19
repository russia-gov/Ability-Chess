#!/usr/bin/env python3
from pathlib import Path
import sys

path=Path(sys.argv[1] if len(sys.argv)>1 else 'engine/fairy-depth15-worker.js')
s=path.read_text(encoding='utf-8')
marker='ANALYSIS_WORKER_HARDENING_V1'
if marker in s:
    print('Analysis worker hardening already applied')
    raise SystemExit(0)
old="""  if (active) {\n    try { engine.postMessage('stop'); } catch {}\n    active.reject(new Error('Superseded by a newer AbilityFish search'));\n    active = null;\n  }\n"""
new="""  if (active) {\n    const previous = active;\n    try { engine.postMessage('stop'); } catch {}\n    try { previous.cleanup?.(); } catch {}\n    previous.reject(new Error('Superseded by a newer AbilityFish search'));\n    active = null;\n  }\n"""
if old not in s:
    raise SystemExit('active-search cancellation anchor missing')
s=s.replace(old,new,1)
s=s.replace('/* AbilityFish depth-15 browser worker backed by the custom interactive',f'/* {marker} */\n/* AbilityFish depth-15 browser worker backed by the custom interactive',1)
path.write_text(s,encoding='utf-8')
print('Hardened persistent AbilityFish worker search cancellation')
