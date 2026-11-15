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
