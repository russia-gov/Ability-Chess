#!/usr/bin/env python3
from pathlib import Path
import sys

path=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
s=path.read_text(encoding='utf-8')
marker='ANALYSIS_SESSION_CACHE_HARDENING_V1'
if marker in s:
    print('Analysis session cache hardening already applied')
    raise SystemExit(0)
old="const timeout=setTimeout(()=>{const pending=analysisSessionPending.get(id);if(!pending)return;analysisSessionPending.delete(id);analysisResetSessionWorker(new Error(`AbilityFish depth ${depth} search timed out`));},timeoutMs);"
new="const timeout=setTimeout(()=>{const pending=analysisSessionPending.get(id);if(!pending)return;analysisResetSessionWorker(new Error(`AbilityFish depth ${depth} search timed out`));},timeoutMs);"
if old not in s:
    raise SystemExit('Analysis session timeout anchor missing')
s=s.replace(old,new,1)
anchor='/* ANALYSIS_SESSION_CACHE_UPGRADES_V2 */'
if anchor not in s:
    raise SystemExit('Analysis session cache marker missing')
s=s.replace(anchor,anchor+'\n/* '+marker+' */',1)
path.write_text(s,encoding='utf-8')
print('Hardened Analysis session cache cancellation')
