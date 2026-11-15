#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const file='index.html';
let source=fs.readFileSync(file,'utf8'),changed=0;
function replaceOnce(before,after,label){
 const first=source.indexOf(before);
 if(first<0 || source.indexOf(before,first+1)>=0)throw Error('Cannot apply '+label+': source missing or ambiguous');
 source=source.slice(0,first)+after+source.slice(first+before.length);
 changed++;console.log('Patched: '+label);
}
replaceOnce(
 "if(colorOf(tgt)!==color)addMove({from:{r,c},to:{r:rr,c:cc},capture:true,upgradeMove:tag,jumpedFriendly:true});break;",
 "// Jump moves cannot capture; an enemy piece blocks further jump destinations.\n        break;",
 'Non-capturing Bastion and Phase Step jump');
replaceOnce(
 "if (piece[1] === 'p' && isPromotionRank(piece[0], move.to.r)) {\n      const promotion",
 "if (piece[1] === 'p' && s.board[move.to.r][move.to.c] === piece && isPromotionRank(piece[0], move.to.r)) {\n      const promotion",
 'Ambush pawn removed before promotion');
replaceOnce(
 "    if(pieces.length===0) return true;\n    if(pieces.some(x=>['p','r','q'].includes(x.type))) return false;",
 "    // A surviving movement-upgraded king or minor piece may have mating\n    // potential beyond ordinary chess. Captured upgraded types have no effect.\n    if(state.upgradesEnabled!==false){\n      for(const color of ['w','b'])if(upgradeFor(state,color,'k'))return false;\n      if(pieces.some(x=>upgradeFor(state,colorOf(x.p),x.type)))return false;\n    }\n    if(pieces.length===0) return true;\n    if(pieces.some(x=>['p','r','q'].includes(x.type))) return false;",
 'Insufficient material accounts for movement upgrades');
replaceOnce(
 "const ans=window.prompt('Reinforce to knight or bishop? Enter N or B.','N'); const t=String(ans||'N').trim().toLowerCase()[0]; game.board[r][c]=game.turn+(t==='b'?'b':'n');",
 "const ans=window.prompt('Reinforce to knight or bishop? Enter N or B.','N'); if(ans===null)return; const t=String(ans).trim().toLowerCase(); if(t!=='n'&&t!=='b'){game.lastMessage='Choose N for knight or B for bishop.';return;} const next=cloneState(game);next.board[r][c]=game.turn+t; if(!allLegalMoves(next,game.turn).length){playFailureSound();game.lastMessage='Reinforce must leave a legal follow-up move.';return;} game.board=next.board;",
 'Reinforce cancel, validation and follow-up legality');
replaceOnce(
 "    const t=action.promoteTo==='b'?'b':'n';\n    game.board[r][c]=game.turn+t;",
 "    const t=action.promoteTo==='b'?'b':'n';\n    const next=cloneState(game);next.board[r][c]=game.turn+t;\n    if(!allLegalMoves(next,game.turn).length)return false;\n    game.board=next.board;",
 'Bot Reinforce follows the same continuation rule');
if(changed!==5)throw Error('Expected exactly five source edits');
fs.writeFileSync(file,source);
console.log('Applied '+changed+' fixes to '+file);
