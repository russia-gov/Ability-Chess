#!/usr/bin/env node
'use strict';
// Runs the *actual* Deno verified-game Edge handler against a disposable fake
// Supabase REST/Auth service. No external network, credentials or production DB.
const assert=require('node:assert/strict');
const http=require('node:http');
const {spawn}=require('node:child_process');

const BASE='http://127.0.0.1:18973',EDGE='http://127.0.0.1:18974';
const ROOM='00000000-0000-0000-0000-0000000000a9';
const WHITE='00000000-0000-0000-0000-000000000003';
const BLACK='00000000-0000-0000-0000-000000000004';
const TOKENS={w:'00000000-0000-0000-0000-0000000000d1',b:'00000000-0000-0000-0000-0000000000d2'};
const users={'white-session':WHITE,'black-session':BLACK};
const board=()=>[
 ['br','bn','bb','bq','bk','bb','bn','br'],Array(8).fill('bp'),
 ...Array.from({length:4},()=>Array(8).fill(null)),
 Array(8).fill('wp'),['wr','wn','wb','wq','wk','wb','wn','wr']];
const start=()=>({
 board:board(),turn:'w',over:false,winner:null,resultReason:'',mode:'online',
 onlineStarted:true,hostColor:'w',rated:false,
 points:{w:6,b:6},upgrades:{w:{},b:{}},upgradeLimit:3,startingPoints:6,
 abilitiesEnabled:true,upgradesEnabled:true,
 castlingRights:{w:{k:true,q:true},b:{k:true,q:true}},
 shielded:{w:null,b:null},frozen:{w:null,b:null},ambushed:{w:null,b:null},
 fortified:{w:null,b:null},portals:{w:null,b:null},
 enPassant:null,lastMove:null,lastMoveByColor:{w:null,b:null},
 abilityUsed:false,movesRemaining:1,doubleMoveActive:false,
 activeAbility:null,awaitingAbilityTarget:false,abilitySelection:null,
 halfmoveClock:0,positionCounts:{},lastRecordedPositionKey:null,
 log:[],historySnapshots:[],clocks:{w:600,b:600},initialTime:600,increment:0,
 drawOffer:null
});
const settings={base:10,increment:0,startingPoints:6,upgradeLimit:3,
 abilitiesEnabled:true,upgradesEnabled:true,rated:false};
let room;
let rematch;
let commits=[];
function reset(){
 room={id:ROOM,version:1,status:'active',host_token:TOKENS.w,guest_token:TOKENS.b,
  host_color:'w',host_user_id:WHITE,guest_user_id:BLACK,game_state:start(),
  settings:{...settings},updated_at:new Date().toISOString(),
  expires_at:new Date(Date.now()+86400000).toISOString()};
 rematch={status:'none',offeredBy:null,room:null};commits=[];
}
reset();
const respond=(res,status,body)=>{
 res.writeHead(status,{'content-type':'application/json'});
 res.end(JSON.stringify(body));
};
const backend=http.createServer(async(req,res)=>{
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 let payload={};try{payload=JSON.parse(Buffer.concat(chunks).toString()||'{}')}catch{}
 const pathname=new URL(req.url,BASE).pathname;
 if(pathname==='/auth/v1/user'){
  const token=String(req.headers.authorization||'').replace(/^Bearer /i,'');
  return respond(res,users[token]?200:401,users[token]?{id:users[token]}:{error:'Invalid JWT'});
 }
 if(pathname==='/rest/v1/ability_chess_rooms')return respond(res,200,[structuredClone(room)]);
 if(pathname==='/rest/v1/rpc/ability_chess_commit_verified_action'){
  if(payload.p_expected_version!==room.version)
   return respond(res,409,{message:'Version conflict'});
  const color=payload.p_seat_token===TOKENS.w?'w':payload.p_seat_token===TOKENS.b?'b':null;
  if(!color||payload.p_actor_user_id!==users[color==='w'?'white-session':'black-session'])
   return respond(res,403,{message:'Unauthorized seat'});
  if(room.status!=='active')return respond(res,409,{message:'Finished'});
  room.game_state=payload.p_next_state;room.version++;
  room.status=room.game_state.over?'finished':'active';
  room.updated_at=new Date().toISOString();
  commits.push({type:payload.p_action_type,actor:color,version:room.version});
  return respond(res,200,[{new_version:room.version,updated_state:structuredClone(room.game_state)}]);
 }
 if(pathname==='/rest/v1/rpc/ability_chess_verified_rematch'){
  const color=payload.p_seat_token===TOKENS.w?'w':payload.p_seat_token===TOKENS.b?'b':null;
  if(!color)return respond(res,403,{message:'Invalid seat'});
  if(room.status!=='finished')return respond(res,409,{message:'Not finished'});
  if(payload.p_operation==='offer'){
   if(rematch.status==='none'){rematch.status='offered';rematch.offeredBy=color}
   else if(rematch.offeredBy!==color)return respond(res,409,{message:'Accept instead'});
  }
  if(payload.p_operation==='accept'){
   if(rematch.status!=='offered'||rematch.offeredBy===color)
    return respond(res,409,{message:'No opponent offer'});
   rematch.status='ready';
   rematch.room={id:'00000000-0000-0000-0000-0000000000ab',
    version:0,host_color:'b',host_token:'00000000-0000-0000-0000-0000000000e1',
    guest_token:'00000000-0000-0000-0000-0000000000e2',
    game_state:{...start(),hostColor:'b'},settings:{...settings,hostColor:'b'}};
  }
  if(payload.p_operation==='decline'&&rematch.status==='offered')rematch={status:'none',offeredBy:null,room:null};
  return respond(res,200,[{
   rematch_status:rematch.status,offered_by:rematch.offeredBy,
   room_id:rematch.room?.id??null,room_version:rematch.room?.version??null,
   seat_token:rematch.room?(color==='w'?rematch.room.host_token:rematch.room.guest_token):null,
   assigned_color:rematch.room?(color==='w'?'b':'w'):null,
   state:rematch.room?.game_state??null,room_settings:rematch.room?.settings??null
  }]);
 }
 return respond(res,404,{message:'Unexpected mock REST route: '+pathname});
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function request(color,action,version=room.version,seat=TOKENS[color]){
 const token=color==='w'?'white-session':color==='b'?'black-session':'invalid';
 const response=await fetch(EDGE,{method:'POST',headers:{
  'content-type':'application/json','authorization':'Bearer '+token,'apikey':'public-test-key'},
  body:JSON.stringify({roomId:ROOM,seatToken:seat,expectedVersion:version,action})});
 return {status:response.status,body:await response.json()};
}
async function read(color,seat=TOKENS[color]){
 const token=color==='w'?'white-session':color==='b'?'black-session':'invalid';
 const response=await fetch(EDGE+'?roomId='+ROOM+'&seatToken='+seat,{
  headers:{authorization:'Bearer '+token,'apikey':'public-test-key'}});
 return {status:response.status,body:await response.json()};
}
async function ready(){
 for(let i=0;i<90;i++){
  try{const r=await read('w');if(r.status===200)return}catch{}
  await sleep(150);
 }
 throw Error('Actual Deno Edge server did not start');
}
async function run(){
 let checks=0;
 const check=(cond,msg)=>{assert.ok(cond,msg);checks++};
 const preflight=await fetch(EDGE,{method:'OPTIONS',headers:{
  Origin:'https://abilitychess.com',
  'Access-Control-Request-Method':'GET',
  'Access-Control-Request-Headers':'authorization,apikey,content-type,cache-control'
 }});
 const allowedHeaders=(preflight.headers.get('access-control-allow-headers')||'').toLowerCase().split(',').map(s=>s.trim());
 check(preflight.status===204,'Edge CORS preflight succeeds');
 check(['authorization','apikey','content-type','cache-control'].every(h=>allowedHeaders.includes(h)),
  'CORS preflight permits all real browser transport headers');

 let r=await read('w');check(r.status===200,'white authenticated GET');
 r=await read('b');check(r.status===200,'black authenticated GET');
 r=await read('x',TOKENS.w);check(r.status===403,'unidentified caller rejected');
 r=await request('b',{type:'move',from:{r:6,c:4},to:{r:4,c:4}});
 check(r.status===403,'opponent cannot move white pieces');
 r=await request('w',{type:'move',from:{r:6,c:4},to:{r:2,c:4}});
 check(r.status===400,'illegal movement rejected');
 r=await request('w',{type:'move',from:{r:6,c:4},to:{r:4,c:4},points:{w:900}});
 check(r.status===400,'forged points rejected');
 r=await request('w',{type:'move',from:{r:6,c:4},to:{r:4,c:4}});
 check(r.status===200&&r.body.state.turn==='b','actual reducer applied e2-e4');
 check(room.version===2&&commits.length===1,'only legal move committed');
 r=await request('w',{type:'move',from:{r:6,c:3},to:{r:4,c:3}},1);
 check(r.status===409,'stale version rejected');
 const [a,b]=await Promise.all([
  request('b',{type:'move',from:{r:1,c:4},to:{r:3,c:4}}),
  request('b',{type:'move',from:{r:1,c:3},to:{r:3,c:3}})
 ]);
 console.log('CONCURRENT ACTION RESULTS '+JSON.stringify({a,b}));
 check([a.status,b.status].sort().join(',')==='200,409','same-version action race commits only once');
 check(room.version===3&&commits.length===2,'concurrent actions did not duplicate');
 // The next player can offer a draw without asserting a browser-made outcome.
 r=await request('w',{type:'offerDraw'});
 check(r.status===200&&room.game_state.drawOffer==='w','draw offer trusted');
 r=await request('b',{type:'acceptDraw'});
 check(r.status===200&&room.status==='finished'&&room.game_state.winner===null,'draw settlement trusted');
 const original=JSON.stringify(room.game_state),oldVersion=room.version;
 r=await request('w',{type:'offerRematch'});
 check(r.status===200&&r.body.rematch.status==='offered','finished game offers rematch');
 r=await read('b');
 check(r.status===200&&r.body.rematch.offeredBy==='w','opponent observes offer');
 r=await request('w',{type:'acceptRematch'});
 check(r.status>=400,'cannot accept own offer');
 r=await request('b',{type:'acceptRematch'});
 check(r.status===200&&r.body.rematch.status==='ready','opponent accepts rematch');
 check(r.body.rematch.room.color==='w'&&r.body.rematch.room.token!==TOKENS.b,'new seat and reversed color');
 check(JSON.stringify(room.game_state)===original&&room.version===oldVersion,'old room immutable');
 r=await read('w');
 check(r.status===200&&r.body.rematch.room.color==='b','original player recovers own seat');
 // Hidden Ambush coordinates and replay keys cannot leak to the other side.
 reset();room.game_state.ambushed.w={r:6,c:1};
 room.game_state.positionCounts={'private:6,1':2};
 room.game_state.historySnapshots=[{private:'6,1'}];
 r=await read('b');
 check(r.status===200&&r.body.state.ambushed.w===null,'opponent Ambush coordinate hidden');
 check(!JSON.stringify(r.body.state).includes('private:6,1'),'private history/repetition redacted');
 // Expired-turn adjudication must not accept an ordinary move.
 reset();room.updated_at=new Date(Date.now()-610000).toISOString();
 r=await request('w',{type:'move',from:{r:6,c:4},to:{r:4,c:4}});
 check(r.status===409,'expired player cannot move');
 r=await request('b',{type:'claimTimeout'});
 check(r.status===200&&room.game_state.winner==='b','opponent can claim timeout');
 // Exercise every paid ability and a permanent upgrade through the
 // deployed Edge reducer, not merely through the independent Node rule tests.
 const cases=[
  {id:'double',action:{type:'ability',id:'double'}},
  {id:'shield',action:{type:'ability',id:'shield',target:{r:6,c:0}}},
  {id:'ambush',action:{type:'ability',id:'ambush',target:{r:6,c:0}}},
  {id:'freeze',action:{type:'ability',id:'freeze',target:{r:1,c:0}}},
  {id:'swap',action:{type:'ability',id:'swap',from:{r:7,c:0},to:{r:7,c:1}}},
  {id:'recall',action:{type:'ability',id:'recall'},
   setup:s=>{s.board[5][0]='wp';s.board[6][0]=null;
     s.lastMoveByColor.w={piece:'wp',from:{r:6,c:0},to:{r:5,c:0},resultPiece:'wp'};}},
  {id:'reinforce',action:{type:'ability',id:'reinforce',
    target:{r:3,c:0},promoteTo:'n'},
   setup:s=>{s.board[3][0]='wp';s.board[6][0]=null;}},
  {id:'portal',action:{type:'ability',id:'portal',from:{r:5,c:5},to:{r:4,c:6}}},
  {id:'fortify',action:{type:'ability',id:'fortify',target:{r:6,c:4}}},
  {id:'teleport',action:{type:'ability',id:'teleport',from:{r:7,c:1},to:{r:5,c:2}}},
  {id:'bomb',action:{type:'ability',id:'bomb',target:{r:6,c:0}}},
  {id:'vanguard',action:{type:'upgrade',id:'vanguard'}}
 ];
 for(const scenario of cases){
  reset();room.game_state.points={w:30,b:30};
  if(scenario.setup)scenario.setup(room.game_state);
  const result=await request('w',scenario.action);
  check(result.status===200,
    'Edge '+scenario.id+' accepted: '+result.status+' '+JSON.stringify(result.body).slice(0,220));
  check(room.version===2,'Edge '+scenario.id+' committed exactly once');
  check(room.game_state.points.w<30,'Edge '+scenario.id+' used authoritative points');
  check(room.game_state.onlineStarted===true,'Edge '+scenario.id+' preserved online session');
 }
 reset();
 room.game_state.board=Array.from({length:8},()=>Array(8).fill(null));
 room.game_state.board[7][4]='wk';room.game_state.board[0][4]='bk';
 room.game_state.board[1][0]='wp';
 let promoted=await request('w',{type:'move',from:{r:1,c:0},
  to:{r:0,c:0},promotion:'q'});
 check(promoted.status===200&&room.game_state.board[0][0]==='wq',
  'Edge validates and applies explicit promotion');
 console.log('PASS: '+checks+' actual Deno Edge/Auth/REST integration assertions (all local mocks)');
}
(async()=>{
 await new Promise(resolve=>backend.listen(18973,'127.0.0.1',resolve));
 const edge=spawn('deno',['run','--allow-net','--allow-env',
   'supabase/functions/verified-game/index.ts'],{
  env:{...process.env,SUPABASE_URL:BASE,SUPABASE_SERVICE_ROLE_KEY:'test-service-key',
   DENO_SERVE_ADDRESS:'127.0.0.1:18974'},
  stdio:['ignore','pipe','pipe']});
 let stderr='';
 edge.stderr.on('data',b=>{stderr+=b.toString()});
 // Deno.serve defaults to :8000; configure via DENO_DEPLOYMENT_ID is not
 // supported locally, so use the standard 8000 port for the integration test.
 const originalFetch=globalThis.fetch;
 globalThis.fetch=(url,options)=>originalFetch(String(url).replace('http://127.0.0.1:18974','http://127.0.0.1:8000'),options);
 try{await ready();await run()}
 finally{
  globalThis.fetch=originalFetch;
  edge.kill('SIGTERM');await new Promise(r=>edge.once('exit',r));
  await new Promise(r=>backend.close(r));
  if(process.exitCode)console.error(stderr.slice(-2000));
 }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
