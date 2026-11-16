'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {applyGameAction}=require('../turn-reducer.js');
const sq=(r,c)=>({r,c});
const move=(fr,fc,tr,tc,extra={})=>({type:'move',from:sq(fr,fc),to:sq(tr,tc),...extra});
function base(){
 const b=Array.from({length:8},()=>Array(8).fill(null));
 b[7][4]='wk';b[0][4]='bk';b[6][0]='wp';b[1][3]='bp';
 return {board:b,turn:'w',points:{w:12,b:12},
  upgrades:{w:{},b:{}},upgradeLimit:3,
  movesRemaining:1,abilityUsed:false,doubleMoveActive:false,over:false,
  winner:null,abilitiesEnabled:true,upgradesEnabled:true,
  castlingRights:{w:{k:false,q:false},b:{k:false,q:false}},
  shielded:{w:null,b:null},frozen:{w:null,b:null},ambushed:{w:null,b:null},
  fortified:{w:null,b:null},portals:{w:null,b:null},
  lastMoveByColor:{w:null,b:null},lastMove:null,halfmoveClock:0,
  positionCounts:{},clocks:null,increment:0,enPassant:null};
}
test('valid board move updates state and switches turn',()=>{
 const s=base(),out=applyGameAction(s,move(6,0,4,0));
 assert.equal(out.endsTurn,true);assert.equal(out.state.turn,'b');
 assert.equal(out.state.board[4][0],'wp');
 assert.equal(out.state.movesRemaining,1);assert.equal(s.turn,'w');
});
test('cannot invent captured pieces or capture points',()=>{
 const s=base();
 assert.throws(()=>applyGameAction(s,{...move(6,0,4,0),capture:true}),/Untrusted/);
 const out=applyGameAction(s,move(6,0,4,0));
 assert.equal(out.state.points.w,12);
});
test('capture awards correct material points',()=>{
 const s=base();s.board[5][1]='bn';
 const out=applyGameAction(s,move(6,0,5,1));
 assert.equal(out.state.points.w,15);
 assert.equal(out.state.board[5][1],'wp');
});
test('ability leaves move available and consumes ability allowance',()=>{
 const s=base();
 const out=applyGameAction(s,{type:'ability',id:'shield',target:sq(6,0)});
 assert.equal(out.endsTurn,false);assert.equal(out.state.turn,'w');
 assert.equal(out.state.points.w,9);assert.equal(out.state.abilityUsed,true);
 assert.throws(()=>applyGameAction(out.state,{type:'ability',id:'freeze',target:sq(1,3)}),/Ability unavailable/);
});
test('double move requires two moves before changing turns',()=>{
 const s=base();
 const one=applyGameAction(s,{type:'ability',id:'double'});
 assert.equal(one.state.movesRemaining,2);
 const two=applyGameAction(one.state,move(6,0,5,0));
 assert.equal(two.state.movesRemaining,1);
 assert.equal(two.state.turn,'w');
 const three=applyGameAction(two.state,move(7,4,6,4));
 assert.equal(three.state.turn,'b');
 assert.equal(three.state.doubleMoveActive,false);
});
test('upgrade costs points and consumes full turn',()=>{
 const s=base();
 const out=applyGameAction(s,{type:'upgrade',id:'vanguard'});
 assert.equal(out.state.points.w,8);assert.equal(out.state.turn,'b');
 assert.equal(out.state.upgrades.w.p,'vanguard');
});
test('shield expires at start of protected player next turn',()=>{
 const s=base();
 const armed=applyGameAction(s,{type:'ability',id:'shield',target:sq(6,0)});
 const moved=applyGameAction(armed.state,move(7,4,6,4));
 assert.equal(moved.state.shielded.w.r,6);
 const black=applyGameAction(moved.state,move(1,3,2,3));
 assert.equal(black.state.shielded.w,null);
});
test('portal duration decrements only after the owner turns',()=>{
 const s=base();
 const placed=applyGameAction(s,{type:'ability',id:'portal',from:sq(5,5),to:sq(4,6)});
 assert.equal(placed.state.portals.w.turnsRemaining,3);
 const first=applyGameAction(placed.state,move(6,0,5,0));
 assert.equal(first.state.portals.w.turnsRemaining,2);
 const second=applyGameAction(first.state,move(1,3,2,3));
 assert.equal(second.state.portals.w.turnsRemaining,2);
});

test('online room metadata survives ordinary, ability and upgrade transitions',()=>{
 const initial=base();
 Object.assign(initial,{onlineStarted:true,mode:'online',hostColor:'b',
  rated:true,ratingCategory:'blitz',initialTime:600,startingPoints:4});
 const a=applyGameAction(initial,move(6,0,4,0));
 const b=applyGameAction(a.state,move(1,3,2,3));
 const c=applyGameAction(b.state,{type:'ability',id:'shield',target:sq(4,0)});
 const d=applyGameAction(c.state,move(7,4,6,4));
 const e=applyGameAction(d.state,{type:'upgrade',id:'vanguard'});
 for(const result of [a,b,c,d,e]){
  const state=result.state;
  assert.equal(state.onlineStarted,true);
  assert.equal(state.mode,'online');
  assert.equal(state.hostColor,'b');
  assert.equal(state.rated,true);
  assert.equal(state.ratingCategory,'blitz');
  assert.equal(state.initialTime,600);
  assert.equal(state.startingPoints,4);
 }
});
