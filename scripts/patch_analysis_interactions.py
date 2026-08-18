#!/usr/bin/env python3
from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
s = path.read_text(encoding='utf-8')
if 'ANALYSIS_ABILITY_INTERACTIONS_V1' in s:
    print('Analysis interactions already patched')
    raise SystemExit(0)

# CSS: executable ability controls and clickable PV tokens.
css_anchor = '</style>'
css = r'''
/* ANALYSIS_ABILITY_INTERACTIONS_V1 */
.analysis-ability-panel{margin-top:12px;background:#10151a;border:1px solid #354150;border-radius:11px;padding:11px;display:grid;gap:9px}
.analysis-ability-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.analysis-ability-head strong{font-size:12px}.analysis-ability-help{font-size:11px;color:#9fabb7}
.analysis-ability-buttons{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.analysis-ability-btn{padding:8px 6px;font-size:11px;line-height:1.15}.analysis-ability-btn.active{border-color:#f0c85a;box-shadow:inset 0 0 0 2px rgba(240,200,90,.25)}.analysis-ability-btn .ability-cost{display:block;color:#f0b84d;font-size:10px;margin-top:2px}
.analysis-ability-cancel{padding:6px 9px;font-size:11px}.analysis-line{cursor:default}.analysis-pv-move{appearance:none;border:0;background:transparent;padding:1px 3px;margin:0 1px;border-radius:4px;color:inherit;font:inherit;cursor:pointer}.analysis-pv-move:hover,.analysis-pv-move:focus-visible{background:#344251;filter:none;outline:1px solid #6c8198}.analysis-line-pv{display:flex;gap:2px;flex-wrap:wrap;align-items:center}
@media(max-width:620px){.analysis-ability-buttons{grid-template-columns:repeat(2,minmax(0,1fr))}}
'''
if css_anchor not in s:
    raise SystemExit('style anchor missing')
s = s.replace(css_anchor, css + '\n' + css_anchor, 1)

# UI panel under existing position controls.
html_anchor = '''        </div>\n        <div id="analysisStatus" class="analysis-status">White to move.</div>'''
html = r'''        </div>
        <div id="analysisAbilityPanel" class="analysis-ability-panel">
          <div class="analysis-ability-head"><div><strong>Use an ability</strong><div id="analysisAbilityHelp" class="analysis-ability-help">Choose an ability, then choose its target on the board.</div></div><button id="analysisAbilityCancel" class="analysis-ability-cancel" type="button" hidden>Cancel</button></div>
          <div class="analysis-ability-buttons">
            <button class="analysis-ability-btn" data-analysis-ability="shield" type="button">Shield<span class="ability-cost">3 points</span></button>
            <button class="analysis-ability-btn" data-analysis-ability="freeze" type="button">Freeze<span class="ability-cost">3 points</span></button>
            <button class="analysis-ability-btn" data-analysis-ability="ambush" type="button">Ambush<span class="ability-cost">4 points</span></button>
            <button class="analysis-ability-btn" data-analysis-ability="teleport" type="button">Teleport<span class="ability-cost">4 points</span></button>
            <button class="analysis-ability-btn" data-analysis-ability="reinforce" type="button">Reinforce<span class="ability-cost">5 points</span></button>
            <button class="analysis-ability-btn" data-analysis-ability="portal" type="button">Portal<span class="ability-cost">5 points</span></button>
            <button class="analysis-ability-btn" data-analysis-ability="fortify" type="button">Fortify<span class="ability-cost">4 points</span></button>
            <button class="analysis-ability-btn" data-analysis-ability="double" type="button">Double Move<span class="ability-cost">6 points</span></button>
          </div>
        </div>
        <div id="analysisStatus" class="analysis-status">White to move.</div>'''
if html_anchor not in s:
    raise SystemExit('analysis controls HTML anchor missing')
s = s.replace(html_anchor, html, 1)

# New interaction state.
global_anchor = '''  let analysisSuppressClick=false;\n  let analysisHistory=[];'''
global_repl = '''  let analysisSuppressClick=false;\n  let analysisAbilityMode=null;\n  let analysisAbilitySelection=[];\n  let analysisHistory=[];'''
if global_anchor not in s:
    raise SystemExit('analysis globals anchor missing')
s = s.replace(global_anchor, global_repl, 1)

# Double Move must keep the same side after its first board move.
finish_anchor = '''  function analysisFinishTurnState(next,mover){\n    const incoming=other(mover);'''
finish_repl = '''  function analysisFinishTurnState(next,mover){\n    if(next.doubleMoveActive&&Number(next.movesRemaining||0)>1){\n      next.movesRemaining=Number(next.movesRemaining)-1;next.abilityUsed=true;next.turn=mover;next.activeAbility=null;next.awaitingAbilityTarget=false;next.abilitySelection=null;return next;\n    }\n    const incoming=other(mover);'''
if finish_anchor not in s:
    raise SystemExit('analysis finish-turn anchor missing')
s = s.replace(finish_anchor, finish_repl, 1)

# Insert ability state mutation + engine-PV helpers immediately before board click handling.
board_click_anchor = '''  function analysisBoardClick(r,c){\n    if(!analysisState)return;const p=analysisState.board?.[r]?.[c];'''
helpers = r'''  const ANALYSIS_ABILITY_COSTS={shield:3,freeze:3,ambush:4,teleport:4,reinforce:5,portal:5,fortify:4,double:6};
  const ANALYSIS_ABILITY_INSTRUCTIONS={shield:'Choose one of your pieces to shield.',freeze:'Choose an enemy non-king piece to freeze.',ambush:'Choose one of your non-king pieces to trap.',teleport:'Choose one of your non-king pieces, then an empty destination.',reinforce:'Choose one of your pawns beyond halfway.',portal:'Choose two empty portal squares.',fortify:'Choose a square in the 2×2 area containing your king.',double:'Two normal moves this turn.'};
  function analysisCancelAbilityMode(){analysisAbilityMode=null;analysisAbilitySelection=[];renderAnalysisAbilityControls();}
  function analysisAbilityCommit(parent,next,action,{consumeTurn=false}={}){
    const side=parent.turn,cost=ANALYSIS_ABILITY_COSTS[action.type]||0;
    next.points=next.points||{w:0,b:0};next.points[side]=Math.max(0,Number(next.points[side]||0)-cost);next.abilityUsed=true;
    if(consumeTurn)next=analysisFinishTurnState(next,side);
    analysisState=normalizeAnalysisState(next);analysisSelected=null;analysisLegal=[];analysisAbilityMode=null;analysisAbilitySelection=[];
    analysisPushHistory(action,analysisActionLabel(action,parent));renderAnalysis();scheduleAnalysisEngine();return true;
  }
  function analysisStartAbility(kind){
    if(!analysisState||!ANALYSIS_ABILITY_COSTS[kind])return false;
    const side=analysisState.turn,cost=ANALYSIS_ABILITY_COSTS[kind];
    if(analysisState.abilitiesEnabled===false||analysisState.abilityUsed||Number(analysisState.points?.[side]||0)<cost)return false;
    if(kind==='double'){
      const parent=normalizeAnalysisState(analysisState),next=normalizeAnalysisState(parent);next.doubleMoveActive=true;next.movesRemaining=2;
      return analysisAbilityCommit(parent,next,{type:'double'});
    }
    analysisAbilityMode=kind;analysisAbilitySelection=[];analysisSelected=null;analysisLegal=[];renderAnalysis();return true;
  }
  function analysisMoveAttachedMarker(next,side,from,to){
    for(const key of ['shielded','ambushed'])if(next[key]?.[side]?.r===from.r&&next[key]?.[side]?.c===from.c)next[key][side]={...next[key][side],r:to.r,c:to.c};
  }
  function analysisAbilityTargetClick(r,c){
    const kind=analysisAbilityMode;if(!kind||!analysisState)return false;
    const parent=normalizeAnalysisState(analysisState),side=parent.turn,enemy=other(side),piece=parent.board?.[r]?.[c],pos={r,c};
    const next=normalizeAnalysisState(parent);
    if(kind==='shield'){
      if(!piece||colorOf(piece)!==side)return false;next.shielded=next.shielded||{w:null,b:null};next.shielded[side]={r,c,turnsRemaining:1,active:true};return analysisAbilityCommit(parent,next,{type:'shield',r,c});
    }
    if(kind==='freeze'){
      if(!piece||colorOf(piece)!==enemy||typeOf(piece)==='k')return false;next.frozen=next.frozen||{w:null,b:null};next.frozen[enemy]={r,c,turnsRemaining:1,active:true};return analysisAbilityCommit(parent,next,{type:'freeze',r,c});
    }
    if(kind==='ambush'){
      if(!piece||colorOf(piece)!==side||typeOf(piece)==='k')return false;next.ambushed=next.ambushed||{w:null,b:null};next.ambushed[side]={r,c,turnsRemaining:1,active:true};return analysisAbilityCommit(parent,next,{type:'ambush',r,c});
    }
    if(kind==='reinforce'){
      if(!piece||colorOf(piece)!==side||typeOf(piece)!=='p')return false;
      if(side==='w'?r>3:r<4)return false;
      const promote=(window.prompt('Reinforce pawn to knight or bishop? Enter N or B.','N')||'N').trim().toLowerCase();if(!['n','b'].includes(promote))return false;
      next.board[r][c]=side+promote;return analysisAbilityCommit(parent,next,{type:'reinforce',r,c,promoteTo:promote},{consumeTurn:true});
    }
    if(kind==='fortify'){
      let king=null;for(let rr=0;rr<8;rr++)for(let cc=0;cc<8;cc++)if(next.board?.[rr]?.[cc]===side+'k')king={r:rr,c:cc};if(!king)return false;
      const tops=[];for(const tr of [r-1,r])for(const tc of [c-1,c])if(tr>=0&&tr<7&&tc>=0&&tc<7&&king.r>=tr&&king.r<=tr+1&&king.c>=tc&&king.c<=tc+1)tops.push({r:tr,c:tc});
      if(!tops.length)return false;const t=tops[0],squares=[{r:t.r,c:t.c},{r:t.r,c:t.c+1},{r:t.r+1,c:t.c},{r:t.r+1,c:t.c+1}];next.fortified=next.fortified||{w:null,b:null};next.fortified[side]={squares,turnsRemaining:1,active:true};return analysisAbilityCommit(parent,next,{type:'fortify',squares});
    }
    if(kind==='teleport'){
      if(analysisAbilitySelection.length===0){if(!piece||colorOf(piece)!==side||typeOf(piece)==='k')return false;analysisAbilitySelection=[pos];renderAnalysisAbilityControls();return true;}
      const from=analysisAbilitySelection[0],moving=parent.board?.[from.r]?.[from.c];if(piece||!moving)return false;
      if(typeOf(moving)==='p'){const ownHalf=side==='w'?(x=>x>=4):(x=>x<=3);if(!ownHalf(from.r)||!ownHalf(r))return false;}
      next.board[from.r][from.c]=null;next.board[r][c]=moving;analysisMoveAttachedMarker(next,side,from,pos);
      try{if(inCheck(next,side))return false;}catch{}
      return analysisAbilityCommit(parent,next,{type:'teleport',from,to:pos},{consumeTurn:true});
    }
    if(kind==='portal'){
      if(piece)return false;if(analysisAbilitySelection.length===0){analysisAbilitySelection=[pos];renderAnalysisAbilityControls();return true;}const a=analysisAbilitySelection[0];if(a.r===r&&a.c===c)return false;
      next.portals=next.portals||{w:null,b:null};next.portals[side]={a,b:pos,turnsRemaining:3,active:true};return analysisAbilityCommit(parent,next,{type:'portal',a,b:pos});
    }
    return false;
  }
  function renderAnalysisAbilityControls(){
    const help=document.getElementById('analysisAbilityHelp'),cancel=document.getElementById('analysisAbilityCancel'),side=analysisState?.turn||'w',points=Number(analysisState?.points?.[side]||0);
    document.querySelectorAll('[data-analysis-ability]').forEach(btn=>{const k=btn.dataset.analysisAbility,c=ANALYSIS_ABILITY_COSTS[k]||0;btn.classList.toggle('active',analysisAbilityMode===k);btn.disabled=!analysisState||analysisState.abilitiesEnabled===false||!!analysisState.abilityUsed||points<c;});
    if(cancel)cancel.hidden=!analysisAbilityMode;
    if(help){const prefix=`${side==='w'?'White':'Black'}: ${points} point${points===1?'':'s'}. `;const target=analysisAbilityMode?ANALYSIS_ABILITY_INSTRUCTIONS[analysisAbilityMode]:'Choose an ability, then choose its target on the board.';help.textContent=prefix+target+(analysisAbilitySelection.length?' First target selected.':'');}
  }
  function analysisMoveFromUci(state,uci){
    const m=String(uci||'').toLowerCase().match(/^([a-h])([1-8])([a-h])([1-8])([qrbn])?$/);if(!m)return null;
    const from={r:8-Number(m[2]),c:m[1].charCodeAt(0)-97},to={r:8-Number(m[4]),c:m[3].charCodeAt(0)-97},promotion=m[5]||null;
    return allLegalMoves(state,state.turn).find(x=>x.from.r===from.r&&x.from.c===from.c&&x.to.r===to.r&&x.to.c===to.c&&(!promotion||String(x.promotion||promotion).toLowerCase()===promotion))||null;
  }
  function analysisFollowEnginePv(pv,throughIndex=0){
    const tokens=String(pv||'').trim().split(/\s+/).filter(Boolean);let played=0;
    for(let i=0;i<=throughIndex&&i<tokens.length;i++){const move=analysisMoveFromUci(analysisState,tokens[i]);if(!move)break;if(!playAnalysisMove(move))break;played++;}
    return played;
  }
  window.__ABILITYFISH_ANALYSIS_INTERACTIONS_TEST__={analysisMoveFromUci,analysisEvalText,startAbility:analysisStartAbility,targetAbility:analysisAbilityTargetClick};

  function analysisBoardClick(r,c){
    if(analysisAbilityMode){analysisAbilityTargetClick(r,c);return;}
    if(!analysisState)return;const p=analysisState.board?.[r]?.[c];'''
if board_click_anchor not in s:
    raise SystemExit('analysis board-click anchor missing')
s = s.replace(board_click_anchor, helpers, 1)

# Mate score keeps UCI mate distance instead of generic M.
old_eval = '''  function analysisEvalText(score){\n    if(score==null||!Number.isFinite(Number(score)))return '—';\n    const white=analysisWhiteEval(score);if(Math.abs(white)>90000)return white>0?'M':'−M';const pawns=white/100;return `${pawns>=0?'+':''}${pawns.toFixed(2)}`;\n  }'''
new_eval = '''  function analysisEvalText(score){\n    if(score==null||!Number.isFinite(Number(score)))return '—';\n    const white=analysisWhiteEval(score);if(Math.abs(white)>90000){const mate=Math.max(1,Math.round(99000-Math.abs(white)));return `${white<0?'−':''}M${mate}`;}const pawns=white/100;return `${pawns>=0?'+':''}${pawns.toFixed(2)}`;\n  }'''
if old_eval not in s:
    raise SystemExit('analysis eval-text anchor missing')
s = s.replace(old_eval, new_eval, 1)

# Render PVs as individual clickable UCI moves.
old_render = '''    display.forEach((line,i)=>{const row=document.createElement('div');row.className='analysis-line';row.innerHTML=`<span class=\"analysis-line-rank\">${i+1}</span><span class=\"analysis-line-pv\">${escapeHtml(line.pv)}</span><span class=\"analysis-line-score\">${escapeHtml(analysisEvalText(line.score))}</span>`;linesEl.appendChild(row);});'''
new_render = r'''    display.forEach((line,i)=>{
      const row=document.createElement('div');row.className='analysis-line';const rank=document.createElement('span');rank.className='analysis-line-rank';rank.textContent=String(i+1);const pv=document.createElement('span');pv.className='analysis-line-pv';
      const tokens=String(line.pv||'').trim().split(/\s+/).filter(Boolean),ordinary=tokens.length&&tokens.every(t=>/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(t));
      if(ordinary)tokens.forEach((token,j)=>{const b=document.createElement('button');b.type='button';b.className='analysis-pv-move';b.textContent=token;b.title=`Play through ${token}`;b.addEventListener('click',()=>analysisFollowEnginePv(line.pv,j));pv.appendChild(b);});else pv.textContent=String(line.pv||'');
      const score=document.createElement('span');score.className='analysis-line-score';score.textContent=analysisEvalText(line.score);row.append(rank,pv,score);linesEl.appendChild(row);
    });'''
if old_render not in s:
    raise SystemExit('analysis engine render anchor missing')
s = s.replace(old_render, new_render, 1)

# Render ability buttons whenever the board renders.
render_anchor = '''      if(bp&&document.activeElement!==bp)bp.value=String(analysisState.points?.b??0);'''
render_repl = render_anchor + '''\n      renderAnalysisAbilityControls();'''
if render_anchor not in s:
    raise SystemExit('analysis render controls anchor missing')
s = s.replace(render_anchor, render_repl, 1)

# Wire buttons once during boot near existing Analysis event listeners. Using document-level delegation
# keeps this patch robust if the Analysis screen is re-rendered.
script_end_anchor = '</script>'
wiring = r'''
  document.addEventListener('click',event=>{
    const ability=event.target.closest?.('[data-analysis-ability]');if(ability){analysisStartAbility(ability.dataset.analysisAbility);return;}
    if(event.target.closest?.('#analysisAbilityCancel'))analysisCancelAbilityMode();
  });
'''
if script_end_anchor not in s:
    raise SystemExit('script end anchor missing')
s = s.replace(script_end_anchor, wiring + '\n' + script_end_anchor, 1)

path.write_text(s, encoding='utf-8')
print('Patched Analysis board with executable abilities, clickable PVs, and mate distance display')
