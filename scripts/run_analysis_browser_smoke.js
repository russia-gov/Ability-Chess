#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const indexPath = path.resolve(process.argv[2] || 'index.html');
const depth = Number(process.argv[3] || 5);
if (!fs.existsSync(indexPath)) {
  console.error(`Missing Analysis page: ${indexPath}`);
  process.exit(2);
}

const root = path.dirname(indexPath);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.wasm':'application/wasm','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
function safeFile(urlPath) {
  let rel=decodeURIComponent(String(urlPath||'/').split('?')[0]);
  if(rel==='/') rel='/'+path.basename(indexPath);
  const abs=path.resolve(root,'.'+rel);
  if(!abs.startsWith(root+path.sep)&&abs!==root)return null;
  return abs;
}
const server=http.createServer((req,res)=>{
  const file=safeFile(req.url);
  if(!file||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404,{'Content-Type':'text/plain'});res.end('not found');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
});

function startingBoard(){return [
  ['br','bn','bb','bq','bk','bb','bn','br'],Array(8).fill('bp'),Array(8).fill(null),Array(8).fill(null),
  Array(8).fill(null),Array(8).fill(null),Array(8).fill('wp'),['wr','wn','wb','wq','wk','wb','wn','wr']
];}
function baseState(){return {
  board:startingBoard(),turn:'w',castlingRights:{w:{k:true,q:true},b:{k:true,q:true}},enPassant:null,halfmoveClock:0,
  points:{w:0,b:0},abilityUsed:false,movesRemaining:1,doubleMoveActive:false,beganTurnInCheck:false,
  abilitiesEnabled:true,upgradesEnabled:true,upgradeLimit:3,upgrades:{w:{},b:{}},shielded:{w:null,b:null},
  frozen:{w:null,b:null},ambushed:{w:null,b:null},fortified:{w:null,b:null},portals:{w:null,b:null},lastMoveByColor:{w:null,b:null}
};}
const clone=value=>JSON.parse(JSON.stringify(value));
const squareToRC=sq=>({r:8-Number(sq[1]),c:sq.toLowerCase().charCodeAt(0)-97});
function applyOrdinaryUci(state,uci){
  if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(String(uci||'')))throw new Error(`Smoke test cannot apply non-ordinary UCI move: ${uci}`);
  const next=clone(state),from=squareToRC(uci.slice(0,2)),to=squareToRC(uci.slice(2,4)),moving=next.board[from.r][from.c];
  if(!moving)throw new Error(`No piece on ${uci.slice(0,2)} while applying ${uci}`);
  const side=moving[0];next.board[from.r][from.c]=null;next.board[to.r][to.c]=uci[4]?side+uci[4]:moving;
  next.lastMoveByColor[side]={from,to,piece:moving};next.turn=side==='w'?'b':'w';next.abilityUsed=false;next.movesRemaining=1;
  next.doubleMoveActive=false;next.beganTurnInCheck=false;next.enPassant=null;return next;
}

(async()=>{
  let browser,page=null,settled=false;const pageErrors=[];
  const failTimer=setTimeout(()=>{if(!settled){console.error('Browser AbilityFish smoke test timed out');process.exit(1);}},120000);
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const {port}=server.address();
    browser=await chromium.launch({headless:true});page=await browser.newPage();
    page.on('pageerror',err=>pageErrors.push(String(err&&err.stack||err)));
    page.on('console',msg=>{if(msg.type()==='error')console.error('browser console:',msg.text());});
    await page.goto(`http://127.0.0.1:${port}/${path.basename(indexPath)}`,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>typeof window.__ABILITYFISH_ANALYSIS_TEST__==='function',null,{timeout:15000});
    await page.waitForFunction(()=>typeof window.__ABILITYFISH_ANALYSIS_INTERACTIONS_TEST__==='object',null,{timeout:15000});

    // Prove that the Analysis interaction layer is functional, not merely rendered.
    const interaction=await page.evaluate(()=>{
      analysisCreateTree(freshAnalysisState(),{title:'Browser interaction smoke'});
      analysisState.points.w=10;
      renderAnalysis();
      const api=window.__ABILITYFISH_ANALYSIS_INTERACTIONS_TEST__;
      const mateOne=api.analysisEvalText(-98999);
      const mateFive=api.analysisEvalText(-98995);
      const uciMove=api.analysisMoveFromUci(analysisState,'e2e4');
      const started=api.startAbility('ambush');
      const targeted=api.targetAbility(6,3); // white pawn on d2
      return {
        mateOne,mateFive,
        uciMove:uciMove?{from:uciMove.from,to:uciMove.to}:null,
        started,targeted,
        points:analysisState.points.w,
        ambush:analysisState.ambushed?.w||null,
        buttonCount:document.querySelectorAll('[data-analysis-ability]').length,
        pvClassPresent:!!document.querySelector('style')?.textContent?.includes('analysis-pv-move')
      };
    });
    if(interaction.mateOne!=='M1'||interaction.mateFive!=='M5')throw new Error(`Mate distance formatting failed: ${JSON.stringify(interaction)}`);
    if(!interaction.uciMove||interaction.uciMove.from.r!==6||interaction.uciMove.from.c!==4||interaction.uciMove.to.r!==4||interaction.uciMove.to.c!==4)
      throw new Error(`Clickable-PV UCI resolution failed: ${JSON.stringify(interaction)}`);
    if(!interaction.started||!interaction.targeted||interaction.points!==6||interaction.ambush?.r!==6||interaction.ambush?.c!==3)
      throw new Error(`Analysis Ambush interaction failed: ${JSON.stringify(interaction)}`);
    if(interaction.buttonCount<8||!interaction.pvClassPresent)throw new Error(`Analysis interaction UI incomplete: ${JSON.stringify(interaction)}`);
    console.log(`ANALYSIS_INTERACTIONS_OK ${JSON.stringify(interaction)}`);

    // Reset to a neutral state before engine consistency checks.
    await page.evaluate(()=>{analysisCreateTree(freshAnalysisState(),{title:'Engine smoke'});renderAnalysis();});
    const analyze=async(state,requestedDepth,options={})=>page.evaluate(async({state,requestedDepth,options})=>
      await window.__ABILITYFISH_ANALYSIS_TEST__(state,{depth:requestedDepth,...options}),{state,requestedDepth,options});

    const result=await analyze(baseState(),depth,{multiPV:1});
    const reportedDepth=Number(result?.depth||0),nodes=Number(result?.nodes||0);
    if(!result||result.wasm!==true)throw new Error(`Browser Analysis result was not marked WASM: ${JSON.stringify(result)}`);
    if(reportedDepth<depth)throw new Error(`Browser Analysis stopped at depth ${reportedDepth}; expected ${depth}`);
    if(!(nodes>0))throw new Error(`Browser Analysis reported ${nodes} nodes; expected > 0`);

    const parentState=applyOrdinaryUci(baseState(),'b1c3');
    async function scoreChain(parentDepth,abilityFishEnabled){
      const parent=await analyze(parentState,parentDepth,{multiPV:1,abilityFishEnabled,maxTimeMs:0});
      const topPv=String(parent?.displayLines?.[0]?.pv||'').trim().split(/\s+/).filter(Boolean);const bestMove=topPv[0];
      if(!bestMove)throw new Error(`No principal variation in Nc3 regression: ${JSON.stringify(parent)}`);
      const child=await analyze(applyOrdinaryUci(parentState,bestMove),parentDepth-1,{multiPV:1,abilityFishEnabled,maxTimeMs:0});
      const parentScore=Number(parent?.score),childScore=Number(child?.score),delta=Math.abs(parentScore-childScore);
      return {depth:parentDepth,bestMove,parentScore,childScore,delta,parentNodes:Number(parent?.nodes||0),childNodes:Number(child?.nodes||0)};
    }

    const measurements=[];
    for(const d of [5,7,9]){
      const plain=await scoreChain(d,false);const ability=await scoreChain(d,true);measurements.push({plain,ability});
      console.log(`PLAIN_SCORE_CHAIN_D${d} move=${plain.bestMove} parent=${plain.parentScore} child=${plain.childScore} delta=${plain.delta} nodes=${plain.parentNodes}/${plain.childNodes}`);
      console.log(`ABILITYFISH_SCORE_CHAIN_D${d} move=${ability.bestMove} parent=${ability.parentScore} child=${ability.childScore} delta=${ability.delta} nodes=${ability.parentNodes}/${ability.childNodes}`);
    }
    const high=measurements[measurements.length-1].ability;
    if(!Number.isFinite(high.parentScore)||!Number.isFinite(high.childScore))throw new Error('AbilityFish high-depth score chain returned a non-finite score');
    if(Math.sign(high.parentScore)!==0&&Math.sign(high.childScore)!==0&&Math.sign(high.parentScore)!==Math.sign(high.childScore))
      throw new Error(`AbilityFish still flips fixed-perspective sign at depth ${high.depth}: ${high.parentScore} -> ${high.childScore}`);
    if(high.delta>60)throw new Error(`AbilityFish score remains unstable at depth ${high.depth}: delta=${high.delta} cp`);

    if(pageErrors.length)console.warn('Non-fatal page errors during smoke:',pageErrors.slice(0,5));
    console.log(`ABILITYFISH_BROWSER_DEPTH_${depth}_OK nodes=${nodes}`);
    settled=true;clearTimeout(failTimer);await browser.close();server.close(()=>process.exit(0));
  }catch(error){
    console.error('Embedded AbilityFish browser smoke failed');console.error(error&&error.stack||error);
    if(pageErrors.length)console.error('Browser page errors:',pageErrors.slice(0,5));
    if(page){try{console.error('Browser page diagnostics:',JSON.stringify(await page.evaluate(()=>({title:document.title,engineHook:typeof window.__ABILITYFISH_ANALYSIS_TEST__,interactionHook:typeof window.__ABILITYFISH_ANALYSIS_INTERACTIONS_TEST__,ready:document.readyState}))));}catch{}}
    settled=true;clearTimeout(failTimer);try{if(browser)await browser.close();}catch{}try{server.close();}catch{}process.exit(1);
  }
})();
