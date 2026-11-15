'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {applyUpgradeIntent}=require('../upgrade-intent.js');
const fixture=()=>{
 const board=Array.from({length:8},()=>Array(8).fill(null));
 board[7][4]='wk';board[0][4]='bk';
 return {board,turn:'w',points:{w:20,b:10},
  upgrades:{w:{},b:{}},upgradeLimit:2,
  movesRemaining:1,abilityUsed:false,doubleMoveActive:false,
  activeAbility:null,awaitingAbilityTarget:false,over:false,upgradesEnabled:true};
};
test('legal upgrade costs correct points without altering prior state',()=>{
 const s=fixture();
 const x=applyUpgradeIntent(s,{type:'upgrade',id:'archbishop'});
 assert.equal(x.state.points.w,12);assert.equal(x.state.upgrades.w.b,'archbishop');
 assert.equal(s.points.w,20);assert.equal(x.endsTurn,true);
});
test('cannot purchase same upgrade twice',()=>{
 const s=fixture();s.upgrades.w.b='archbishop';
 assert.throws(()=>applyUpgradeIntent(s,{type:'upgrade',id:'archbishop'}),/already owned/);
});
test('cannot bypass upgrade price using extra metadata',()=>{
 const s=fixture();
 assert.throws(()=>applyUpgradeIntent(s,{type:'upgrade',id:'archbishop',cost:0}),/Untrusted/);
 s.points.w=0;
 assert.throws(()=>applyUpgradeIntent(s,{type:'upgrade',id:'archbishop'}),/Not enough/);
});
test('full slot limit requires actual replacement',()=>{
 const s=fixture();s.upgrades.w={p:'vanguard',n:'lancer'};
 assert.throws(()=>applyUpgradeIntent(s,{type:'upgrade',id:'royal_step'}),/Must select/);
 const x=applyUpgradeIntent(s,{type:'upgrade',id:'royal_step',replaceType:'n'});
 assert.deepEqual(x.state.upgrades.w,{p:'vanguard',k:'royal_step'});
});
test('replacing same piece-type upgrade is mandatory',()=>{
 const s=fixture();s.upgrades.w.p='vanguard';
 assert.throws(()=>applyUpgradeIntent(s,{type:'upgrade',id:'veteran'}),/Must select/);
 const x=applyUpgradeIntent(s,{type:'upgrade',id:'veteran',replaceType:'p'});
 assert.equal(x.state.upgrades.w.p,'veteran');
});
test('cannot replace nonexistent or arbitrary upgrade',()=>{
 const s=fixture();
 assert.throws(()=>applyUpgradeIntent(s,{type:'upgrade',id:'turret',replaceType:'q'}),/Unnecessary/);
});
test('disabled upgrades and mid-ability purchases rejected',()=>{
 const s=fixture();s.upgradesEnabled=false;
 assert.throws(()=>applyUpgradeIntent(s,{type:'upgrade',id:'turret'}),/unavailable/);
 s.upgradesEnabled=true;s.abilityUsed=true;
 assert.throws(()=>applyUpgradeIntent(s,{type:'upgrade',id:'turret'}),/unavailable/);
});
