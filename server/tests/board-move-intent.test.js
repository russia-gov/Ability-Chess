'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {resolveLegalBoardMove,applyLegalBoardMoveGeometry}=require('../board-move-intent.js');
const board=()=>Array.from({length:8},()=>Array(8).fill(null));
const fixture=()=>{
 const b=board();b[7][4]='wk';b[0][4]='bk';b[6][4]='wp';
 return {board:b,turn:'w',over:false,points:{w:0,b:0},
 upgrades:{w:{},b:{}},movesRemaining:1,abilityUsed:false,
 doubleMoveActive:false,shielded:{w:null,b:null},
 frozen:{w:null,b:null},ambushed:{w:null,b:null},
 fortified:{w:null,b:null},portals:{w:null,b:null},
 castlingRights:{w:{k:false,q:false},b:{k:false,q:false}}};
};
const square=(r,c)=>({r,c});
const mv=(from,to,extra={})=>({type:'move',from:square(...from),to:square(...to),...extra});
test('legal action is derived from trusted board state',()=>{
 const s=fixture();const action=mv([6,4],[4,4]);
 const {move,boardState}=applyLegalBoardMoveGeometry(s,action);
 assert.equal(move.doublePawn,true);
 assert.equal(boardState.board[4][4],'wp');
 assert.equal(s.board[6][4],'wp');
});
test('arbitrary teleports, opponent moves and missing pieces rejected',()=>{
 const s=fixture();
 assert.throws(()=>resolveLegalBoardMove(s,mv([6,4],[2,4])),/Illegal board move/);
 assert.throws(()=>resolveLegalBoardMove(s,mv([0,4],[1,4])),/Not a piece/);
 assert.throws(()=>resolveLegalBoardMove(s,mv([5,5],[4,5])),/Not a piece/);
});
test('malicious metadata cannot invent en passant, castling or captures',()=>{
 const s=fixture();
 assert.throws(()=>resolveLegalBoardMove(s,{...mv([6,4],[4,4]),castle:'k'}),/Untrusted/);
 assert.throws(()=>resolveLegalBoardMove(s,mv([6,4],[4,4],{promotion:'q'})),/Promotion not allowed/);
});
test('reject moves after turn or game is finished',()=>{
 const s=fixture();s.movesRemaining=0;
 assert.throws(()=>resolveLegalBoardMove(s,mv([6,4],[4,4])),/No board moves/);
 s.movesRemaining=1;s.over=true;
 assert.throws(()=>resolveLegalBoardMove(s,mv([6,4],[4,4])),/already finished/);
});
test('promotion must be an explicit legal choice',()=>{
 const s=fixture();s.board[6][4]=null;s.board[1][0]='wp';
 assert.throws(()=>resolveLegalBoardMove(s,mv([1,0],[0,0])),/explicit promotion/);
 const ok=resolveLegalBoardMove(s,mv([1,0],[0,0],{promotion:'n'}));
 assert.equal(ok.promotion,'n');
});
