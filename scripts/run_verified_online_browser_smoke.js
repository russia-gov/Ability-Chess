#!/usr/bin/env node
'use strict';
// Disposable two-browser test: no real Supabase or accounts are contacted.
// Verify that both sides can move using typed Edge requests without the
// legacy browser endpoint accepting replacement boards or ratings.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve('.');
const roomId='00000000-0000-0000-0000-0000000000a9';
const tokens={
 w:'00000000-0000-0000-0000-0000000000d1',
 b:'00000000-0000-0000-0000-0000000000d2'
};
const b=Array.from({length:8},()=>Array(8).fill(null));
b[0]=['br','bn','bb','bq','bk','bb','bn','br'];
b[1]=Array(8).fill('bp');b[6]=Array(8).fill('wp');
b[7]=['wr','wn','wb','wq','wk','wb','wn','wr'];
const state={board:b,turn:'w',over:false,winner:null,mode:'online',
 onlineStarted:true,hostColor:'w',playerColor:'w',
 rated:false,abilitiesEnabled:true,upgradesEnabled:true,upgradeLimit:3,
 points:{w:6,b:6},upgrades:{w:{},b:{}},startingPoints:6,
 castlingRights:{w:{k:true,q:true},b:{k:true,q:true}},
 shielded:{w:null,b:null},frozen:{w:null,b:null},ambushed:{w:null,b:null},
 fortified:{w:null,b:null},portals:{w:null,b:null},enPassant:null,
 lastMoveByColor:{w:null,b:null},lastMove:null,
 halfmoveClock:0,positionCounts:{},log:[],historySnapshots:[],
 abilityUsed:false,movesRemaining:1,doubleMoveActive:false,
 activeAbility:null,awaitingAbilityTarget:false,abilitySelection:null,
 clocks:{w:1200,b:1200},initialTime:1200,increment:0,drawOffer:null};
const initialState=structuredClone(state);
const serverState={version:1,state,actions:[],legacyUpdates:[]};
const newRoomId='00000000-0000-0000-0000-0000000000aa';
const newTokens={
 w:'00000000-0000-0000-0000-0000000000e1',
 b:'00000000-0000-0000-0000-0000000000e2'
};
const rematch={offeredBy:null,ready:false,newState:null,requests:[]};
function rematchInfo(color){
 if(!serverState.state.over)return null;
 if(rematch.ready){
  return {status:'ready',offeredBy:rematch.offeredBy,
   room:{id:newRoomId,token:newTokens[color],color:color==='w'?'b':'w',
    version:0,state:structuredClone(rematch.newState),
    settings:{...settings,hostColor:'b'}}};
 }
 return {status:rematch.offeredBy?'offered':'none',
  offeredBy:rematch.offeredBy};
}
const settings={base:20,increment:0,startingPoints:6,hostColor:'w',
 abilitiesEnabled:true,upgradesEnabled:true,upgradeLimit:3,rated:false};
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript',
 '.css':'text/css','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const name=decodeURIComponent((req.url||'/').split('?')[0]);
 const p=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!p.startsWith(root+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){
  res.writeHead(404).end('not found');return;
 }
 res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});
 fs.createReadStream(p).pipe(res);
});
const json=(route,data,status=200)=>route.fulfill({
 status,contentType:'application/json',body:JSON.stringify(data)
});
async function routes(page){
 await page.route('**/rest/v1/rpc/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').pop();
  const req=route.request().postDataJSON()||{};
  if(name==='ability_chess_get_room_live'){
   return json(route,[{
    state:structuredClone(serverState.state),room_settings:settings,
    room_status:'active',room_version:serverState.version,
    opponent_joined:true,state_updated_at:new Date().toISOString(),
    server_now:new Date().toISOString()
   }]);
  }
  if(['ability_chess_update_room_action','update_ability_chess_room',
      'ability_chess_apply_rating_result','ability_chess_apply_category_rating_result',
      'ability_chess_tournament_report_result'].includes(name)){
    serverState.legacyUpdates.push({name,req});
    return json(route,{message:'Unsafe legacy RPC attempted'},403);
  }
  return json(route,[]);
 });
 await page.route('**/functions/v1/verified-game**',async route=>{
  const method=route.request().method();
  if(method==='OPTIONS')return json(route,{});
  if(method==='GET'){
   const u=new URL(route.request().url());
   const seat=u.searchParams.get('seatToken');
   if(u.searchParams.get('roomId')===newRoomId){
    if(!Object.values(newTokens).includes(seat))
     return json(route,{error:'Invalid rematch seat'},403);
    return json(route,{roomVersion:0,roomStatus:'active',
     state:structuredClone(rematch.newState),settings:{...settings,hostColor:'b'},rematch:null});
   }
   const color=seat===tokens.w?'w':seat===tokens.b?'b':null;
   if(!color)return json(route,{error:'Invalid seat'},403);
   return json(route,{roomVersion:serverState.version,
    roomStatus:serverState.state.over?'finished':'active',
    state:structuredClone(serverState.state),settings,
    rematch:rematchInfo(color)});
  }
  const req=route.request().postDataJSON();
  if(!req||req.roomId!==roomId||req.expectedVersion!==serverState.version)
    return json(route,{error:'Game version conflict'},409);
  const color=req.seatToken===tokens.w?'w':req.seatToken===tokens.b?'b':null;
  if(['offerRematch','acceptRematch','declineRematch'].includes(req.action?.type)){
   if(!color||!serverState.state.over)return json(route,{error:'Rematch not allowed'},403);
   rematch.requests.push(req.action.type);
   if(req.action.type==='offerRematch'){
    if(rematch.offeredBy&&rematch.offeredBy!==color)
     return json(route,{error:'Accept existing offer'},409);
    rematch.offeredBy=color;
   }else if(req.action.type==='acceptRematch'){
    if(!rematch.offeredBy||rematch.offeredBy===color)
     return json(route,{error:'No opponent offer'},409);
    rematch.ready=true;
    rematch.newState=structuredClone(initialState);
    rematch.newState.hostColor='b';
    delete rematch.newState.playerColor;
   }else rematch.offeredBy=null;
   return json(route,{version:serverState.version,status:'finished',
    state:structuredClone(serverState.state),rematch:rematchInfo(color)});
  }
  if(req.action?.type!=='move')return json(route,{error:'Only moves mocked'},400);
  // Simulate a slow server to ensure the drag snaps before confirmation.
  if(serverState.actions.length===0)await new Promise(resolve=>setTimeout(resolve,1100));
  if(!color||color!==serverState.state.turn)return json(route,{error:'Wrong seat or turn'},403);
  if(req.board||req.game_state||req.action.board||req.action.state||req.action.winner)
    return json(route,{error:'Browser submitted forged state'},400);
  const from=req.action.from,to=req.action.to;
  const piece=serverState.state.board[from.r][from.c];
  if(!piece||piece[0]!==color)return json(route,{error:'Wrong piece'},400);
  serverState.state.board[from.r][from.c]=null;
  serverState.state.board[to.r][to.c]=piece;
  serverState.state.lastMoveByColor[color]={piece,from,to,resultPiece:piece};
  serverState.state.lastMove={from,to};
  serverState.state.turn=color==='w'?'b':'w';
  serverState.state.movesRemaining=1;serverState.version++;
  serverState.actions.push(req);
  return json(route,{version:serverState.version,status:'active',
   state:structuredClone(serverState.state)});
 });
 await page.route('**/auth/v1/**',async route=>json(route,{error:'Not signed in'},401));
}
const timeout=18000;
async function makePlayer(browser,color,port){
 const context=await browser.newContext();
 await context.addInitScript(({roomId,token,color})=>{
  const session={id:roomId,token,color,role:color==='w'?'host':'guest',
    version:1,waiting:false};
  localStorage.setItem('abilityChessOnline',JSON.stringify(session));
  localStorage.setItem('abilityChessActiveGameV2',JSON.stringify({
    version:2,mode:'online',onlineSession:session,
    state:{board:[],turn:'w',over:false}
  }));
 },{roomId,token:tokens[color],color});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{
  if(['warning','error'].includes(m.type()))
   console.log('BROWSER CONSOLE '+color+' '+m.type()+': '+m.text().slice(0,500));
 });
 await routes(page);
 await page.goto('http://127.0.0.1:'+port+'/index.html?page=game',{waitUntil:'domcontentloaded'});
 if(!await page.locator('#gameScreen.active').isVisible()){
  await page.locator('#welcomeMorePlayBtn').click();
  const hub=await page.evaluate(()=>[...document.querySelectorAll('button')].filter(x=>x.offsetParent!==null)
    .map(x=>({id:x.id,text:x.textContent.trim().slice(0,65)})).slice(0,40));
  console.log('ONLINE PLAY HUB '+JSON.stringify({color,hub}));
 }
 try{await page.locator('#gameScreen.active').waitFor({timeout:8000});}
 catch(error){
  const info=await page.evaluate(()=>({
   currentURL:location.href,
   storedRoom:localStorage.getItem('abilityChessOnline'),
   visibleScreens:[...document.querySelectorAll('.screen')].filter(x=>x.classList.contains('active')).map(x=>x.id),
   buttons:[...document.querySelectorAll('button')].filter(x=>x.offsetParent!==null)
     .map(x=>({id:x.id,text:x.textContent.trim().slice(0,48)})).slice(0,25)
  }));
  console.error('ONLINE RESUME DEBUG '+JSON.stringify({color,info,errors}));
  throw error;
 }
 if(errors.length)throw Error('Browser runtime errors: '+errors.join('; '));
 return {page,context,errors};
}
(async()=>{
 let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  browser=await chromium.launch({headless:true});
  const white=await makePlayer(browser,'w',port);
  const black=await makePlayer(browser,'b',port);
  async function waitForActions(expected){
   const until=Date.now()+12000;
   while(Date.now()<until){
    if(serverState.actions.length>=expected)return;
    await new Promise(resolve=>setTimeout(resolve,200));
   }
   console.error('ONLINE MOVE DEBUG '+JSON.stringify({
    expected,actions:serverState.actions,legacy:serverState.legacyUpdates,
    whiteErrors:white.errors,blackErrors:black.errors,
    whiteBoard:await white.page.locator('#board').count(),
    blackBoard:await black.page.locator('#board').count()
   }));
   throw Error('Online move was not sent to verified action endpoint');
  }
  async function click(page,r,c){
   await page.locator('#board [data-r="'+r+'"][data-c="'+c+'"]').click({timeout:timeout});
  }
  await click(white.page,6,4);
  console.log('AFTER E2 '+JSON.stringify(await white.page.evaluate(()=>({
   from:document.querySelector('#board [data-r="6"][data-c="4"]')?.className,
   targets:[...document.querySelectorAll('#board .legal,#board .legal-move,#board .selected')]
     .map(x=>({r:x.dataset.r,c:x.dataset.c,className:x.className})).slice(0,10),
   status:document.querySelector('#gameMessage')?.textContent||''
  }))));
  await click(white.page,4,4);
  console.log('AFTER E4 '+JSON.stringify(await white.page.evaluate(()=>({
   from:document.querySelector('#board [data-r="6"][data-c="4"]')?.className,
   to:document.querySelector('#board [data-r="4"][data-c="4"]')?.className,
   status:document.querySelector('#gameMessage')?.textContent||''
  }))));
  // Before server acknowledgement, the DOM should already show e4.
  if(serverState.actions.length!==0)throw Error('Delayed route completed before snap assertion');
  const preview=await white.page.evaluate(()=>({
    src:!!document.querySelector('#board [data-r="6"][data-c="4"] .piece-svg'),
    dest:!!document.querySelector('#board [data-r="4"][data-c="4"] .piece-svg')
  }));
  if(preview.src||!preview.dest)
    throw Error('Verified move did not snap visually before server acknowledgement: '+JSON.stringify(preview));
  await waitForActions(1);
  if(serverState.actions.length!==1||serverState.actions[0].action.type!=='move')
    throw Error('White move was not sent through the verified action endpoint');
  if(serverState.actions[0].action.from.r!==6||serverState.actions[0].action.to.r!==4)
    throw Error('Incorrect white move intent');
  await black.page.waitForTimeout(1600);
  await click(black.page,1,4);
  await click(black.page,3,4);
  await waitForActions(2);
  if(serverState.actions.length!==2||serverState.version!==3)
    throw Error('Black reply failed to commit with expected version');
  // Complete the original game in the mocked authoritative service.
  serverState.state.over=true;serverState.state.winner='w';
  serverState.state.resultReason='test-finish';serverState.version++;
  await white.page.locator('#verifiedRematchPanel button').filter({hasText:'Offer rematch'})
   .waitFor({timeout:16000});
  await white.page.evaluate(()=>{
   [...document.querySelectorAll('#verifiedRematchPanel button')]
    .find(b=>b.textContent==='Offer rematch').click();
  });
  await black.page.locator('#verifiedRematchPanel button').filter({hasText:'Accept rematch'})
   .waitFor({timeout:16000});
  await black.page.evaluate(()=>{
   [...document.querySelectorAll('#verifiedRematchPanel button')]
    .find(b=>b.textContent==='Accept rematch').click();
  });
  await white.page.waitForFunction(expected=>{
   const session=JSON.parse(localStorage.getItem('abilityChessOnline')||'{}');
   return session.id===expected;
  },newRoomId,{timeout:16000});
  await black.page.waitForFunction(expected=>{
   const session=JSON.parse(localStorage.getItem('abilityChessOnline')||'{}');
   return session.id===expected;
  },newRoomId,{timeout:16000});
  if(rematch.requests.join(',')!=='offerRematch,acceptRematch')
   throw Error('Rematch did not require mutual consent');
  const resultSessions=await Promise.all([white.page,black.page].map(
   page=>page.evaluate(()=>JSON.parse(localStorage.getItem('abilityChessOnline')))));
  if(resultSessions[0].token===resultSessions[1].token
     ||resultSessions.some(x=>Object.values(tokens).includes(x.token)))
    throw Error('Replacement room did not rotate seat tokens');
  if(serverState.legacyUpdates.length)throw Error('Legacy game mutation or rating API called');
  if(white.errors.length||black.errors.length)
    throw Error('Page errors during play: '+[...white.errors,...black.errors].join('; '));
  await white.context.close();await black.context.close();
  console.log('PASS: two browsers played moves, accepted a fresh-room rematch and rotated seats without legacy writes');
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
