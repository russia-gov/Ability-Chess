#!/usr/bin/env python3
from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
s = path.read_text(encoding='utf-8')
marker = 'ANALYSIS_BROWSER_TEST_BRIDGE_V1'
if marker in s:
    print('Analysis browser-test bridge already patched')
    raise SystemExit(0)

old_candidates = [
    "window.__ABILITYFISH_ANALYSIS_INTERACTIONS_TEST__={analysisMoveFromUci,analysisEvalText,startAbility:analysisStartAbility,targetAbility:analysisAbilityTargetClick,purchaseUpgrade:analysisPurchaseUpgrade};",
    "window.__ABILITYFISH_ANALYSIS_INTERACTIONS_TEST__={analysisMoveFromUci,analysisEvalText,startAbility:analysisStartAbility,targetAbility:analysisAbilityTargetClick};",
]
old = next((candidate for candidate in old_candidates if candidate in s), None)
if old is None:
    raise SystemExit('Analysis interactions test-hook anchor missing')

purchase = ',purchaseUpgrade:analysisPurchaseUpgrade' if 'analysisPurchaseUpgrade' in s else ''
new = f"""// ANALYSIS_BROWSER_TEST_BRIDGE_V1\n  window.__ABILITYFISH_ANALYSIS_INTERACTIONS_TEST__={{\n    analysisMoveFromUci,analysisEvalText,\n    startAbility:analysisStartAbility,targetAbility:analysisAbilityTargetClick{purchase},\n    reset(points=0,title='Browser smoke'){{\n      analysisCreateTree(freshAnalysisState(),{{title}});\n      analysisState.points=analysisState.points||{{w:0,b:0}};\n      analysisState.points.w=Number(points)||0;\n      analysisState.points.b=Number(points)||0;\n      renderAnalysis();\n      return normalizeAnalysisState(analysisState);\n    }},\n    snapshot(){{return normalizeAnalysisState(analysisState);}}\n  }};"""

s = s.replace(old, new, 1)
path.write_text(s, encoding='utf-8')
print('Exposed stable Analysis browser-test bridge with upgrades')
