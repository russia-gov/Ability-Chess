'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {applyAbilityIntent,costs}=require('../ability-intent.js');
function fixture(){
 const b=Array.from({length:8},()=>Array(8).fill(null));
 b[7][4]='wk';b[0][4]='bk';b[6][0]='wp';b[1][3]='bp';
 return {board:b,turn:'w',points:{w:30,b:30},upgrades:{w:{},b:{}},
  movesRemaining:1,abilityUsed:false,doubleMoveActive:false,over:false,
  activeAbility:null,awaitingAbilityTarget:false,abilitiesEnabled:true,
  shielded:{w:null,b:null},frozen:{w:null,b:null},ambushed:{w:null,b:null},
  fortified:{w:null,b:null},portals:{w:null,b:null},
  castlingRights:{w:{k:false,q:false},b:{k:false,q:false}},
  lastMoveByColor:{w:null,b:null},lastMove:null};
}
const at=(r,c)=>({r,c});
test('all eleven ability IDs have nonzero configured costs',()=>{
 assert.deepEqual(Object.keys(costs).sort(),[
  'ambush','bomb','double','fortify','freeze','portal','recall',
  'reinforce','shield','swap','teleport'].sort());
 for(const value of Object.values(costs))assert.ok(value>0);
});
test('shield, freeze and ambush correctly charge once and set effect',()=>{
 for(const [id,target,field,side] of [
  ['shield',at(6,0),'shielded','w'],
  ['freeze',at(1,3),'frozen','b'],
  ['ambush',at(6,0),'ambushed','w']]){
  const s=fixture(),n=applyAbilityIntent(s,{id,target});
  assert.equal(n.points.w,30-costs[id]);assert.equal(n.abilityUsed,true);
  assert.deepEqual(n[field][side],target);assert.equal(s.points.w,30);
  assert.throws(()=>applyAbilityIntent(n,{id,target}),/Ability unavailable/);
 }
});
test('a bomb removes pieces in blast without touching kings',()=>{
 const s=fixture();s.board[5][1]='bn';s.board[5][0]='wp';
 const n=applyAbilityIntent(s,{id:'bomb',target:at(6,0)});
 assert.equal(n.board[5][1],null);
 assert.equal(n.points.w,30-4+3);
 assert.equal(s.board[5][1],'bn');
});
test('bomb cannot touch either king',()=>{
 const s=fixture();s.board[6][4]='wp';
 assert.throws(()=>applyAbilityIntent(s,{id:'bomb',target:at(6,4)}),/Cannot bomb king/);
});
test('portal requires distinct empty squares and costs 5',()=>{
 const s=fixture();
 assert.throws(()=>applyAbilityIntent(s,{id:'portal',from:at(5,1),to:at(5,1)}),/Portals require/);
 const n=applyAbilityIntent(s,{id:'portal',from:at(5,1),to:at(3,2)});
 assert.equal(n.portals.w.turnsRemaining,3);
 assert.equal(n.points.w,25);
});
test('swap rejects king swaps and permits two allied non-kings',()=>{
 const s=fixture();s.board[6][1]='wn';
 assert.throws(()=>applyAbilityIntent(s,{id:'swap',from:at(7,4),to:at(6,1)}),/Invalid swap/);
 const n=applyAbilityIntent(s,{id:'swap',from:at(6,0),to:at(6,1)});
 assert.equal(n.board[6][0],'wn');assert.equal(n.board[6][1],'wp');
});
test('reinforce requires advanced pawn and explicit choice',()=>{
 const s=fixture();
 assert.throws(()=>applyAbilityIntent(s,{id:'reinforce',target:at(6,0),promoteTo:'n'}),/Pawn not eligible/);
 s.board[6][0]=null;s.board[3][0]='wp';
 const n=applyAbilityIntent(s,{id:'reinforce',target:at(3,0),promoteTo:'n'});
 assert.equal(n.board[3][0],'wn');assert.equal(n.points.w,25);
});
test('double move grants two normal actions and costs six',()=>{
 const n=applyAbilityIntent(fixture(),{id:'double'});
 assert.equal(n.movesRemaining,2);assert.equal(n.doubleMoveActive,true);assert.equal(n.points.w,24);
});
test('teleport ends board actions and enforces pawn restriction',()=>{
 const s=fixture();
 assert.throws(()=>applyAbilityIntent(s,{id:'teleport',from:at(6,0),to:at(3,0)}),/Pawn teleport restricted/);
 const n=applyAbilityIntent(s,{id:'teleport',from:at(6,0),to:at(6,1)});
 assert.equal(n.board[6][1],'wp');assert.equal(n.board[6][0],null);
 assert.equal(n.movesRemaining,0);
});
test('recall restores last friendly non-king piece',()=>{
 const s=fixture();s.board[6][0]=null;s.board[5][0]='wp';
 s.lastMoveByColor.w={piece:'wp',resultPiece:'wp',from:at(6,0),to:at(5,0)};
 const n=applyAbilityIntent(s,{id:'recall'});
 assert.equal(n.board[6][0],'wp');assert.equal(n.board[5][0],null);
});
test('fortify protects a 2 by 2 containing own king',()=>{
 const n=applyAbilityIntent(fixture(),{id:'fortify',target:at(7,4)});
 assert.equal(n.fortified.w.squares.length,4);
 assert.ok(n.fortified.w.squares.some(x=>x.r===7&&x.c===4));
});
test('insufficient points and disabled abilities are rejected',()=>{
 const s=fixture();s.points.w=0;
 assert.throws(()=>applyAbilityIntent(s,{id:'bomb',target:at(6,0)}),/Insufficient points/);
 s.points.w=10;s.abilitiesEnabled=false;
 assert.throws(()=>applyAbilityIntent(s,{id:'bomb',target:at(6,0)}),/Abilities disabled/);
});
