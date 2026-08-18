#!/usr/bin/env python3
from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
s = path.read_text(encoding='utf-8')
marker = 'ANALYSIS_BROWSER_TEST_BRIDGE_V1'
if marker in s:
    print('Analysis browser-test bridge already patched')
    raise SystemExit(0)

old = "window.__ABILITYFISH_ANALYSIS_INTERACTIONS_TEST__={analysisMoveFromUci,analysisEvalText,startAbility:analysisStartAbility,targetAbility:analysisAbilityTargetClick};"
new = """// ANALYSIS_BROWSER_TEST_BRIDGE_V1\n  window.__ABILITYFISH_ANALYSIS_INTERACTIONS_TEST__={\n    analysisMoveFromUci,analysisEvalText,\n    startAbility:analysisStartAbility,targetAbility:analysisAbilityTargetClick,\n    reset(points=0,title='Browser smoke'){\n      analysisCreateTree(freshAnalysisState(),{title});\n      analysisState.points=analysisState.points||{w:0,b:0};\n      analysisState.points.w=Number(points)||0;\n      renderAnalysis();\n      return normalizeAnalysisState(analysisState);\n    },\n    snapshot(){return normalizeAnalysisState(analysisState);}\n  };"""

if old not in s:
    raise SystemExit('Analysis interactions test-hook anchor missing')
s = s.replace(old, new, 1)
path.write_text(s, encoding='utf-8')
print('Exposed stable Analysis browser-test bridge')
