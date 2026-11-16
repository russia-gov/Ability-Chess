'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Transport}=require('../../client/verified-online-transport.js');
const room={id:'r',token:'t',version:0};
const json=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
test('only typed actions sent, never client-computed position or rating',async()=>{
 const calls=[],states=[];
 const transport=new Transport({
  endpoint:'https://example.test/functions/v1/verified-game',
  apiKey:'public-key',getSession:()=>room,
  onState:(s)=>states.push(s),
  fetchImpl:async(url,opts)=>{
   calls.push({url,opts,body:JSON.parse(opts.body)});
   return json(200,{version:1,state:{turn:'b'}});
  }
 });
 await transport.submit({type:'move',from:{r:6,c:4},to:{r:4,c:4}});
 assert.equal(calls.length,1);
 assert.deepEqual(Object.keys(calls[0].body).sort(),
  ['action','expectedVersion','roomId','seatToken']);
 assert.equal(room.version,1);
 assert.equal(states[0].turn,'b');
 assert.ok(!JSON.stringify(calls[0].body).includes('game_state'));
 assert.ok(!JSON.stringify(calls[0].body).includes('rating'));
});
test('serializes multiple queued submissions and advances game version',async()=>{
 const session={id:'r',token:'t',version:0},versions=[];
 const client=new Transport({
  endpoint:'https://example.test/game',apiKey:'pub',
  getSession:()=>session,onState:()=>{},
  fetchImpl:async(url,opts)=>{
   const body=JSON.parse(opts.body);versions.push(body.expectedVersion);
   return json(200,{version:body.expectedVersion+1,state:{turn:'w'}});
  }
 });
 await Promise.all([client.submit({type:'offerDraw'}),client.submit({type:'resign'})]);
 assert.deepEqual(versions,[0,1]);assert.equal(session.version,2);
});
test('stale version refreshes authoritative state without replay',async()=>{
 const session={id:'r',token:'t',version:2},calls=[],states=[];
 const client=new Transport({
  endpoint:'https://example.test/game',apiKey:'pub',
  getSession:()=>session,onState:(s)=>states.push(s),
  fetchImpl:async(url,opts)=>{
   calls.push(opts.method);
   if(opts.method==='POST')return json(409,{error:'Game version conflict'});
   return json(200,{roomVersion:3,state:{board:[],turn:'b'}});
  }
 });
 await assert.rejects(client.submit({type:'move',from:{r:6,c:4},to:{r:5,c:4}}),/conflict/);
 assert.deepEqual(calls,['POST','GET']);
 assert.equal(session.version,3);assert.equal(states[0].turn,'b');
});
test('rejects forged client state and unrecognized actions locally',async()=>{
 const client=new Transport({
  endpoint:'https://example.test/game',apiKey:'pub',
  getSession:()=>room,onState:()=>{},
  fetchImpl:async()=>{throw Error('No requests expected');}
 });
 await assert.rejects(client.submit({type:'move',board:[]}),/not accepted/);
 await assert.rejects(client.submit({type:'cheat'}),/Unsupported/);
});

test('delayed poll cannot revert a newer committed move',async()=>{
 const session={id:'r',token:'t',version:1},states=[];
 let releasePoll;
 const pollResponse=new Promise(resolve=>{releasePoll=resolve});
 const client=new Transport({
  endpoint:'https://example.test/game',apiKey:'pub',
  getSession:()=>session,onState:(state)=>states.push(state),
  fetchImpl:async(url,opts)=>{
   if(opts.method==='GET')return pollResponse;
   return json(200,{version:2,state:{turn:'b',move:'e4'}});
  }
 });
 const pendingPoll=client.refresh();
 await client.submit({type:'move',from:{r:6,c:4},to:{r:4,c:4}});
 assert.equal(session.version,2);
 releasePoll(json(200,{roomVersion:1,state:{turn:'w',move:'stale'}}));
 await pendingPoll;
 assert.equal(session.version,2);
 assert.deepEqual(states,[{turn:'b',move:'e4'}]);
});
test('delayed move response cannot revert a newer room refresh',async()=>{
 const session={id:'r',token:'t',version:1},states=[];
 let releaseMove;
 const moveResponse=new Promise(resolve=>{releaseMove=resolve});
 const client=new Transport({
  endpoint:'https://example.test/game',apiKey:'pub',
  getSession:()=>session,onState:(state)=>states.push(state),
  fetchImpl:async(url,opts)=>{
   if(opts.method==='POST')return moveResponse;
   return json(200,{roomVersion:3,state:{turn:'w',move:'newer'}});
  }
 });
 const pendingMove=client.submit({type:'move',from:{r:6,c:4},to:{r:4,c:4}});
 // Allow the queued action to start before refreshing.
 await Promise.resolve();
 await Promise.resolve();
 await client.refresh();
 assert.equal(session.version,3);
 releaseMove(json(200,{version:2,state:{turn:'b',move:'older'}}));
 await pendingMove;
 assert.equal(session.version,3);
 assert.deepEqual(states,[{turn:'w',move:'newer'}]);
});

test('a rematch offer is visible despite unchanged finished-game version',async()=>{
 const session={id:'old',token:'old-seat',version:9},updates=[],rematches=[];
 let phase=0;
 const client=new Transport({
  endpoint:'https://example.test/game',apiKey:'pub',
  getSession:()=>session,onState:(s)=>updates.push(s),onRematch:(r)=>rematches.push(r),
  fetchImpl:async(url,opts)=>{
   if(opts.method==='GET')return json(200,{roomVersion:9,state:{over:true},
    rematch:phase===0?{status:'none',offeredBy:null}:{status:'offered',offeredBy:'b'}});
   if(opts.method==='POST')return json(200,{version:9,state:{over:true},
    rematch:{status:'offered',offeredBy:'b'}});
  }
 });
 await client.refresh();
 assert.equal(rematches[0].status,'none');
 phase=1;
 await client.refresh();
 assert.equal(rematches[1].offeredBy,'b');
 assert.equal(updates.length,0);
 await client.submit({type:'acceptRematch'});
 assert.equal(session.version,9);
});
test('rematch room handoff cannot be undone by the old poll response',async()=>{
 const session={id:'old',token:'seat',version:9},applied=[],events=[];
 let release;
 const gate=new Promise(resolve=>{release=resolve});
 const replacement={id:'fresh',token:'new-seat',color:'b',version:0,state:{over:false}};
 const client=new Transport({
  endpoint:'https://example.test/game',apiKey:'pub',getSession:()=>session,
  onState:(s)=>applied.push(s),
  onRematch:(r)=>{
   events.push(r.status);
   if(r.status==='ready'){
    Object.assign(session,{id:r.room.id,token:r.room.token,version:r.room.version});
   }
  },
  fetchImpl:async()=>gate
 });
 const oldPoll=client.refresh();
 release(json(200,{roomVersion:9,state:{over:true},
  rematch:{status:'ready',offeredBy:'w',room:replacement}}));
 await oldPoll;
 assert.deepEqual(events,['ready']);
 assert.equal(session.id,'fresh');
 assert.equal(session.token,'new-seat');
 assert.equal(session.version,0);
 assert.deepEqual(applied,[]);
});
