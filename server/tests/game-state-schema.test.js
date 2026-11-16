'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {validateGameStateStructure:check}=require('../game-state-schema');
function start(){
 const board=Array.from({length:8},()=>Array(8).fill(null));
 board[7][4]='wk';board[0][4]='bk';
 return {board,turn:'w',over:false,winner:null,
   points:{w:3,b:1},upgrades:{w:{},b:{}},
   movesRemaining:1,abilityUsed:false,doubleMoveActive:false,
   abilitiesEnabled:true,upgradesEnabled:true};
}
test('minimal valid structural state',()=>assert.deepEqual(check(start()),[]));
test('reject malformed and duplicated pieces',()=>{
 const s=start();s.board[1][0]='wq';s.board[1][1]='wx';s.board[1][2]='wk';
 const errors=check(s).join(';');
 assert.match(errors,/Invalid piece/);assert.match(errors,/king count/);
});
test('reject fraudulent negative or fractional ability points',()=>{
 const s=start();s.points.w=-4;s.points.b=2.5;
 assert.match(check(s).join(';'),/w ability points/);
 assert.match(check(s).join(';'),/b ability points/);
});
test('reject out of range move counters and malformed upgrades',()=>{
 const s=start();s.movesRemaining=99;s.upgrades={w:{},b:[]};
 assert.match(check(s).join(';'),/moves remaining/);
 assert.match(check(s).join(';'),/upgrade inventory/);
});
test('reject active state missing a king but accept finished king-capture state',()=>{
 const s=start();s.board[0][4]=null;
 assert.match(check(s).join(';'),/b king count/);
 s.over=true;
 assert.deepEqual(check(s),[]);
});
test('reject impossible starting turn and unsupported winner code',()=>{
 const s=start();s.turn='blue';s.winner='cheater';
 assert.match(check(s).join(';'),/Invalid turn/);
 assert.match(check(s).join(';'),/Invalid winner/);
});
