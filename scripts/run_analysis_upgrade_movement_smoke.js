#!/usr/bin/env node
'use strict';
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('playwright');
const indexPath=path.resolve(process.argv[2]||'index.html'),root=path.dirname(indexPath);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.wasm':'application/wasm'};
function safe(url){let rel=decodeURIComponent(String(url||'/').split('?')[0]);if(rel==='/')rel='/'+path.basename(indexPath);const abs=path.resolve(root,'.'+rel);return abs.startsWith(root+path.sep)?abs:null;}
const server=http.createServer((req,res)=>{const f=safe(req.url);if(!f||!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(f).pipe(res);});
(async()=>{let browser;try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
  browser=await chromium.launch({headless:true});const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/${path.basename(indexPath)}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>typeof window.__ABILITYFISH_ANALYSIS_INTERACTIONS_TEST__?.reset==='function',null,{timeout:15000});
  const result=await page.evaluate(()=>{
    const api=window.__ABILITYFISH_ANALYSIS_INTERACTIONS_TEST__;
    api.reset(10,'Upgrade movement smoke');
    const white=api.purchaseUpgrade('vanguard');
    const black=api.purchaseUpgrade('vanguard');
    const state=api.snapshot();
    const diagonal=api.analysisMoveFromUci(state,'e2f3');
    return {white,black,turn:state.turn,whiteUpgrade:state.upgrades?.w?.p,blackUpgrade:state.upgrades?.b?.p,diagonal:diagonal?{from:diagonal.from,to:diagonal.to}:null};
  });
  if(!result.white||!result.black||result.turn!=='w'||result.whiteUpgrade!=='vanguard'||result.blackUpgrade!=='vanguard')throw new Error(`Upgrade purchase/turn cycle failed: ${JSON.stringify(result)}`);
  if(!result.diagonal||result.diagonal.from.r!==6||result.diagonal.from.c!==4||result.diagonal.to.r!==5||result.diagonal.to.c!==5)throw new Error(`Vanguard upgraded move is not playable on Analysis board: ${JSON.stringify(result)}`);
  console.log(`ANALYSIS_UPGRADE_MOVEMENT_OK ${JSON.stringify(result)}`);
  await browser.close();server.close();
}catch(e){console.error(e&&e.stack||e);try{if(browser)await browser.close();}catch{}try{server.close();}catch{}process.exit(1);}})();
