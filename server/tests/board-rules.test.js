'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const rules=require('../generated/board-rules.js');
const {validateGameStateStructure}=require('../game-state-schema.js');
const empty=()=>Array.from({length:8},()=>Array(8).fill(null));
const base=()=>{
 const b=empty();b[7][4]='wk';b[0][4]='bk';
 return {board:b,turn:'w',points:{w:0,b:0},upgrades:{w:{},b:{}},
  castlingRights:{w:{k:false,q:false},b:{k:false,q:false}},
  shielded:{w:null,b:null},frozen:{w:null,b:null},
  ambushed:{w:null,b:null},fortified:{w:null,b:null},
  portals:{w:null,b:null},enPassant:null,movesRemaining:1,abilityUsed:false,
  doubleMoveActive:false,over:false,winner:null};
};
const sq=(r,c)=>({r,c});
test('pure rules generate and apply a legal ordinary pawn move',()=>{
 const s=base();s.board[6][4]='wp';
 const moves=rules.legalMovesFor(s,6,4);
 const m=moves.find(x=>x.to.r===4&&x.to.c===4);
 assert.ok(m,'two-square pawn start must be legal');
 const next=rules.applyMoveToState(s,{...m});
 assert.equal(next.board[4][4],'wp');assert.equal(next.board[6][4],null);
 assert.equal(next.enPassant.r,5);assert.equal(next.enPassant.c,4);
 assert.equal(s.board[6][4],'wp','applying a move must not mutate source');
 assert.deepEqual(validateGameStateStructure(next),[]);
});
test('check disallows moves that leave own king exposed',()=>{
 const s=base();s.board[0][4]=null;s.board[0][0]='bk';
 s.board[2][4]='br';s.board[6][4]='wr';
 const moves=rules.legalMovesFor(s,6,4);
 assert.equal(moves.some(x=>x.to.c===3),false);
});
test('Bastion friendly jump cannot capture an enemy beyond blocker',()=>{
 const s=base();s.board[7][0]='wr';s.board[6][0]='wp';
 s.board[4][0]='bn';s.upgrades.w.r='bastion';
 const moves=rules.legalMovesFor(s,7,0);
 assert.equal(moves.some(x=>x.to.r===4&&x.to.c===0),false);
 assert.equal(moves.some(x=>x.to.r===5&&x.to.c===0),true);
});
test('Phase Step friendly jump cannot capture beyond blocker',()=>{
 const s=base();s.board[6][0]='wq';s.board[5][1]='wp';
 s.board[3][3]='bn';s.upgrades.w.q='phase_step';
 const moves=rules.legalMovesFor(s,6,0);
 assert.equal(moves.some(x=>x.to.r===3&&x.to.c===3),false);
 assert.equal(moves.some(x=>x.to.r===4&&x.to.c===2),true);
});
test('Ambush destroys a capturing pawn before promotion',()=>{
 const s=base();s.board[1][0]='wp';s.board[0][1]='bn';
 s.board[0][4]=null;s.board[0][7]='bk';
 s.ambushed.b={r:0,c:1};
 const m=rules.legalMovesFor(s,1,0).find(x=>x.to.r===0&&x.to.c===1);
 assert.ok(m,'capture on back rank should be legal');
 const next=rules.applyMoveToState(s,{...m,promotion:'q'});
 assert.equal(next.board[0][1],null,'ambushed pawn must not reappear as queen');
});
