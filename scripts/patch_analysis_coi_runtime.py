#!/usr/bin/env python3
from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
s = path.read_text(encoding='utf-8').replace('\r\n','\n')

# Correct UCI score orientation: UCI scores are from the root side-to-move's
# perspective, while the Analysis evaluation bar is white-positive.
s = s.replace(
    "return rootTurn==='b'?rootValue:-rootValue;",
    "return rootTurn==='b'?-rootValue:rootValue;",
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
  navigator.serviceWorker.register('./abilityfish-coi-serviceworker.js',{scope:'./'}).then(reg=>{
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

# Do not try to instantiate the threaded engine until isolation has taken effect.
old = """  function requestAbilityFishAnalysis(state,options={}){\n    return new Promise((resolve,reject)=>{\n      let worker;\n"""
new = """  function requestAbilityFishAnalysis(state,options={}){\n    return new Promise((resolve,reject)=>{\n      if(!window.crossOriginIsolated){reject(new Error('AbilityFish Analysis is preparing its browser engine. Reload once if it does not start automatically.'));return;}\n      let worker;\n"""
if old in s:
    s=s.replace(old,new,1)
elif "AbilityFish Analysis is preparing its browser engine" not in s:
    raise SystemExit('analysis request isolation anchor changed')

if "return rootTurn==='b'?-rootValue:rootValue;" not in s:
    raise SystemExit('score orientation correction did not apply')
if marker not in s:
    raise SystemExit('COI bootstrap did not apply')

path.write_text(s, encoding='utf-8', newline='')
print('Added AbilityFish Analysis cross-origin isolation bootstrap')
