#!/usr/bin/env python3
from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
s = path.read_text(encoding='utf-8')
if 'ANALYSIS_SESSION_CACHE_UPGRADES_V2' in s:
    print('Analysis session cache/upgrades already patched')
    raise SystemExit(0)
if 'ANALYSIS_ABILITY_INTERACTIONS_V1' not in s or 'ANALYSIS_ABILITYFISH_WORKER' not in s:
    raise SystemExit('Analysis V1/runtime patches must be applied first')

css_anchor = '</style>'
css = r'''
/* ANALYSIS_SESSION_CACHE_UPGRADES_V2 */
.analysis-upgrade-wrap{border-top:1px solid #2d3742;padding-top:9px;display:grid;gap:7px}.analysis-upgrade-title{font-size:11px;color:#b9c4cf;display:flex;justify-content:space-between;gap:8px}.analysis-upgrade-buttons{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.analysis-upgrade-btn{padding:7px 5px;font-size:10px;line-height:1.15}.analysis-upgrade-btn.owned{border-color:#6f9f77;box-shadow:inset 0 0 0 1px rgba(111,159,119,.35)}.analysis-upgrade-btn .ability-cost{display:block;color:#f0b84d;font-size:9px;margin-top:2px}
@media(max-width:760px){.analysis-upgrade-buttons{grid-template-columns:repeat(2,minmax(0,1fr))}}
'''
if css_anchor not in s: raise SystemExit('style anchor missing')
s = s.replace(css_anchor, css + '\n' + css_anchor, 1)

html_anchor = '''            <button class="analysis-ability-btn" data-analysis-ability="double" type="button">Double Move<span class="ability-cost">6 points</span></button>\n          </div>\n        </div>'''
html_repl = '''            <button class="analysis-ability-btn" data-analysis-ability="double" type="button">Double Move<span class="ability-cost">6 points</span></button>\n          </div>\n          <div class="analysis-upgrade-wrap">\n            <div class="analysis-upgrade-title"><strong>Permanent upgrades</strong><span id="analysisUpgradeStatus"></span></div>\n            <div class="analysis-upgrade-buttons">\n              <button class="analysis-upgrade-btn" data-analysis-upgrade="vanguard" type="button">Pawn: Vanguard<span class="ability-cost">4</span></button>\n              <button class="analysis-upgrade-btn" data-analysis-upgrade="reverse_gear" type="button">Pawn: Reverse Gear<span class="ability-cost">4</span></button>\n              <button class="analysis-upgrade-btn" data-analysis-upgrade="veteran" type="button">Pawn: Veteran<span class="ability-cost">6</span></button>\n              <button class="analysis-upgrade-btn" data-analysis-upgrade="lancer" type="button">Knight: Lancer<span class="ability-cost">5</span></button>\n              <button class="analysis-upgrade-btn" data-analysis-upgrade="charger" type="button">Knight: Charger<span class="ability-cost">6</span></button>\n              <button class="analysis-upgrade-btn" data-analysis-upgrade="cardinal" type="button">Bishop: Cardinal<span class="ability-cost">6</span></button>\n              <button class="analysis-upgrade-btn" data-analysis-upgrade="color_shift" type="button">Bishop: Color Shift<span class="ability-cost">5</span></button>\n              <button class="analysis-upgrade-btn" data-analysis-upgrade="archbishop" type="button">Bishop: Archbishop<span class="ability-cost">8</span></button>\n              <button class="analysis-upgrade-btn" data-analysis-upgrade="bastion" type="button">Rook: Bastion<span class="ability-cost">6</span></button>\n              <button class="analysis-upgrade-btn" data-analysis-upgrade="turret" type="button">Rook: Turret<span class="ability-cost">6</span></button>\n              <button class="analysis-upgrade-btn" data-analysis-upgrade="chancellor" type="button">Rook: Chancellor<span class="ability-cost">9</span></button>\n              <button class="analysis-upgrade-btn" data-analysis-upgrade="phase_step" type="button">Queen: Phase Step<span class="ability-cost">7</span></button>\n              <button class="analysis-upgrade-btn" data-analysis-upgrade="royal_step" type="button">King: Royal Step<span class="ability-cost">7</span></button>\n              <button class="analysis-upgrade-btn" data-analysis-upgrade="escape_route" type="button">King: Escape Route<span class="ability-cost">6</span></button>\n            </div>\n          </div>\n        </div>'''
if html_anchor not in s: raise SystemExit('upgrade HTML anchor missing')
s = s.replace(html_anchor, html_repl, 1)

js_anchor = "  const ANALYSIS_ABILITY_INSTRUCTIONS={shield:'Choose one of your pieces to shield.',freeze:'Choose an enemy non-king piece to freeze.',ambush:'Choose one of your non-king piece to trap.',teleport:'Choose one of your non-king pieces, then an empty destination.',reinforce:'Choose one of your pawns beyond halfway.',portal:'Choose two empty portal squares.',fortify:'Choose a square in the 2×2 area containing your king.',double:'Two normal moves this turn.'};\n"
if js_anchor not in s:
    js_anchor = "  const ANALYSIS_ABILITY_INSTRUCTIONS={shield:'Choose one of your pieces to shield.',freeze:'Choose an enemy non-king piece to freeze.',ambush:'Choose one of your non-king pieces to trap.',teleport:'Choose one of your non-king pieces, then an empty destination.',reinforce:'Choose one of your pawns beyond halfway.',portal:'Choose two empty portal squares.',fortify:'Choose a square in the 2×2 area containing your king.',double:'Two normal moves this turn.'};\n"
js_add = r'''  const ANALYSIS_UPGRADES={
    vanguard:{piece:'p',cost:4,label:'Vanguard'},reverse_gear:{piece:'p',cost:4,label:'Reverse Gear'},veteran:{piece:'p',cost:6,label:'Veteran'},
    lancer:{piece:'n',cost:5,label:'Lancer'},charger:{piece:'n',cost:6,label:'Charger'},
    cardinal:{piece:'b',cost:6,label:'Cardinal'},color_shift:{piece:'b',cost:5,label:'Color Shift'},archbishop:{piece:'b',cost:8,label:'Archbishop'},
    bastion:{piece:'r',cost:6,label:'Bastion'},turret:{piece:'r',cost:6,label:'Turret'},chancellor:{piece:'r',cost:9,label:'Chancellor'},
    phase_step:{piece:'q',cost:7,label:'Phase Step'},royal_step:{piece:'k',cost:7,label:'Royal Step'},escape_route:{piece:'k',cost:6,label:'Escape Route'}
  };
  function analysisPurchaseUpgrade(id){
    const spec=ANALYSIS_UPGRADES[id];if(!spec||!analysisState)return false;
    const parent=normalizeAnalysisState(analysisState),side=parent.turn,points=Number(parent.points?.[side]||0);
    if(parent.upgradesEnabled===false||parent.abilityUsed||points<spec.cost)return false;
    const current={...(parent.upgrades?.[side]||{})},ownedTypes=Object.keys(current).filter(k=>current[k]);
    const limit=Math.max(0,Number(parent.upgradeLimit??3));if(!current[spec.piece]&&ownedTypes.length>=limit)return false;
    const next=normalizeAnalysisState(parent);next.upgrades=next.upgrades||{w:{},b:{}};next.upgrades[side]={...(next.upgrades[side]||{}),[spec.piece]:id};
    next.points=next.points||{w:0,b:0};next.points[side]=Math.max(0,points-spec.cost);next.abilityUsed=true;
    const finished=analysisFinishTurnState(next,side);analysisState=normalizeAnalysisState(finished);analysisSelected=null;analysisLegal=[];analysisAbilityMode=null;analysisAbilitySelection=[];
    const pieceName={p:'Pawn',n:'Knight',b:'Bishop',r:'Rook',q:'Queen',k:'King'}[spec.piece]||spec.piece;
    analysisPushHistory({type:'upgrade',upgradeId:id,pieceType:spec.piece},`${pieceName} upgrade: ${spec.label}`);renderAnalysis();scheduleAnalysisEngine();return true;
  }
  function renderAnalysisUpgradeControls(){
    const side=analysisState?.turn||'w',points=Number(analysisState?.points?.[side]||0),current=analysisState?.upgrades?.[side]||{},limit=Math.max(0,Number(analysisState?.upgradeLimit??3));
    const owned=Object.keys(current).filter(k=>current[k]).length,status=document.getElementById('analysisUpgradeStatus');if(status)status.textContent=`${owned}/${limit} piece types`;
    document.querySelectorAll('[data-analysis-upgrade]').forEach(btn=>{const id=btn.dataset.analysisUpgrade,spec=ANALYSIS_UPGRADES[id];if(!spec)return;const replacement=!!current[spec.piece],atLimit=!replacement&&owned>=limit;btn.classList.toggle('owned',current[spec.piece]===id);btn.disabled=!analysisState||analysisState.upgradesEnabled===false||!!analysisState.abilityUsed||points<spec.cost||atLimit;});
  }
'''
if js_anchor not in s: raise SystemExit('ability instruction anchor missing')
s = s.replace(js_anchor, js_anchor + js_add, 1)

render_anchor = '''    if(cancel)cancel.hidden=!analysisAbilityMode;\n    if(help){const prefix=`${side==='w'?'White':'Black'}: ${points} point${points===1?'':'s'}. `;const target=analysisAbilityMode?ANALYSIS_ABILITY_INSTRUCTIONS[analysisAbilityMode]:'Choose an ability, then choose its target on the board.';help.textContent=prefix+target+(analysisAbilitySelection.length?' First target selected.':'');}\n  }'''
render_repl = '''    if(cancel)cancel.hidden=!analysisAbilityMode;\n    if(help){const prefix=`${side==='w'?'White':'Black'}: ${points} point${points===1?'':'s'}. `;const target=analysisAbilityMode?ANALYSIS_ABILITY_INSTRUCTIONS[analysisAbilityMode]:'Choose an ability, then choose its target on the board.';help.textContent=prefix+target+(analysisAbilitySelection.length?' First target selected.':'');}\n    renderAnalysisUpgradeControls();\n  }'''
if render_anchor not in s: raise SystemExit('upgrade render anchor missing')
s = s.replace(render_anchor, render_repl, 1)

raw_bridge = "window.__ABILITYFISH_ANALYSIS_INTERACTIONS_TEST__={analysisMoveFromUci,analysisEvalText,startAbility:analysisStartAbility,targetAbility:analysisAbilityTargetClick};"
if raw_bridge in s:
    s=s.replace(raw_bridge,"window.__ABILITYFISH_ANALYSIS_INTERACTIONS_TEST__={analysisMoveFromUci,analysisEvalText,startAbility:analysisStartAbility,targetAbility:analysisAbilityTargetClick,purchaseUpgrade:analysisPurchaseUpgrade};",1)
elif 'ANALYSIS_BROWSER_TEST_BRIDGE_V1' in s:
    bridge_member='    startAbility:analysisStartAbility,targetAbility:analysisAbilityTargetClick,'
    if bridge_member not in s: raise SystemExit('existing browser-test bridge member anchor missing')
    s=s.replace(bridge_member,bridge_member+'\n    purchaseUpgrade:analysisPurchaseUpgrade,',1)
else:
    raise SystemExit('interaction test bridge anchor missing')

wiring_anchor = "    const ability=event.target.closest?.('[data-analysis-ability]');if(ability){analysisStartAbility(ability.dataset.analysisAbility);return;}\n    if(event.target.closest?.('#analysisAbilityCancel'))analysisCancelAbilityMode();"
wiring_repl = "    const ability=event.target.closest?.('[data-analysis-ability]');if(ability){analysisStartAbility(ability.dataset.analysisAbility);return;}\n    const upgrade=event.target.closest?.('[data-analysis-upgrade]');if(upgrade){analysisPurchaseUpgrade(upgrade.dataset.analysisUpgrade);return;}\n    if(event.target.closest?.('#analysisAbilityCancel'))analysisCancelAbilityMode();"
if wiring_anchor not in s: raise SystemExit('Analysis event wiring anchor missing')
s = s.replace(wiring_anchor, wiring_repl, 1)

old_request = r'''  function requestAbilityFishAnalysis(state,options={}){
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
new_request = r'''  const analysisSessionCache=new Map();
  const analysisSessionPending=new Map();
  let analysisSessionWorker=null;
  const ANALYSIS_SESSION_CACHE_LIMIT=160;
  function analysisStableValue(value){
    if(Array.isArray(value))return value.map(analysisStableValue);if(!value||typeof value!=='object')return value;
    const out={};for(const key of Object.keys(value).sort())out[key]=analysisStableValue(value[key]);return out;
  }
  function analysisSessionCacheKey(state,multiPV,abilityFishEnabled){return JSON.stringify([analysisStateFen(state),analysisStableValue(analysisAbilityPayload(state)),Number(multiPV),abilityFishEnabled!==false]);}
  function analysisRememberResult(key,result){
    const prior=analysisSessionCache.get(key);if(prior&&Number(prior.depth||0)>Number(result.depth||0))return;
    analysisSessionCache.delete(key);analysisSessionCache.set(key,result);while(analysisSessionCache.size>ANALYSIS_SESSION_CACHE_LIMIT)analysisSessionCache.delete(analysisSessionCache.keys().next().value);
  }
  function analysisResetSessionWorker(error){
    const worker=analysisSessionWorker;analysisSessionWorker=null;if(worker){analysisWorkers.delete(worker);try{worker.terminate();}catch{}}
    for(const [id,pending] of analysisSessionPending){clearTimeout(pending.timeout);pending.reject(error instanceof Error?error:new Error(String(error||'AbilityFish worker reset')));analysisSessionPending.delete(id);}
  }
  function ensureAnalysisSessionWorker(){
    if(analysisSessionWorker)return analysisSessionWorker;
    const worker=new Worker(ANALYSIS_ABILITYFISH_WORKER);analysisSessionWorker=worker;analysisWorkers.add(worker);
    worker.addEventListener('message',e=>{
      const id=e.data?.id,pending=analysisSessionPending.get(id);if(!pending)return;if(e.data?.type==='info'||e.data?.type==='abilityinfo')return;
      clearTimeout(pending.timeout);analysisSessionPending.delete(id);
      if(e.data?.type==='error'||e.data?.error){pending.reject(new Error(e.data?.error||'AbilityFish worker failed'));return;}
      if(e.data?.type==='result'||e.data?.result){const result=convertWasmAnalysisResult(pending.state,e.data.result);analysisRememberResult(pending.cacheKey,result);pending.resolve(result);}
    });
    worker.addEventListener('error',e=>analysisResetSessionWorker(new Error(e.message||'AbilityFish WASM worker failed')));return worker;
  }
  function requestAbilityFishAnalysis(state,options={}){
    const depth=Math.max(1,Math.min(15,Number(options.depth||15))),multiPV=Math.max(1,Math.min(3,Number(options.multiPV??(depth>5?1:3)))),abilityFishEnabled=options.abilityFishEnabled!==false;
    const cacheKey=analysisSessionCacheKey(state,multiPV,abilityFishEnabled),cached=analysisSessionCache.get(cacheKey);
    if(cached&&Number(cached.depth||0)>=depth)return Promise.resolve({...cached,cached:true,requestedDepth:depth});
    return new Promise((resolve,reject)=>{
      let worker;try{worker=ensureAnalysisSessionWorker();}catch(e){reject(e);return;}
      const id=`analysis-${++analysisWorkerRequestSeq}-${Date.now()}`,timeoutMs=depth>=15?90000:45000;
      const timeout=setTimeout(()=>{const pending=analysisSessionPending.get(id);if(!pending)return;analysisSessionPending.delete(id);analysisResetSessionWorker(new Error(`AbilityFish depth ${depth} search timed out`));},timeoutMs);
      analysisSessionPending.set(id,{state:normalizeAnalysisState(state),cacheKey,resolve,reject,timeout});
      worker.postMessage({id,fen:analysisStateFen(state),depth,multiPV,maxTimeMs:options.maxTimeMs,abilityFishEnabled,abilityState:analysisAbilityPayload(state)});
    });
  }
'''
if old_request not in s: raise SystemExit('persistent Analysis worker request anchor missing')
s = s.replace(old_request, new_request, 1)

meta_anchor = "meta.textContent=`${refined?'Refined':'Quick'} AbilityFish${result?.wasm?' WASM':''} · depth ${result?.depth??1}${result?.capped&&result?.requestedDepth?`/${result.requestedDepth}`:''} · ${nodes} nodes${note?` · ${note}`:''}`;"
meta_repl = "meta.textContent=`${refined?'Refined':'Quick'} AbilityFish${result?.wasm?' WASM':''}${result?.cached?' · session cache':''} · depth ${result?.depth??1}${result?.capped&&result?.requestedDepth?`/${result.requestedDepth}`:''} · ${nodes} nodes${note?` · ${note}`:''}`;"
if meta_anchor in s:s=s.replace(meta_anchor,meta_repl,1)
path.write_text(s,encoding='utf-8')
print('Patched Analysis with persistent session engine/cache and permanent upgrades')
