#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const file='index.html';
let s=fs.readFileSync(file,'utf8');
const anchor='  function makeMove(originalMove, {animate=true, source=\'normal\'} = {}){';
const helper=`  // Visual-only optimistic snap. The canonical board, turn and clock are untouched.
  function snapVerifiedMovePreview(move){
    const origin=boardEl.querySelector(\`.sq[data-r="\${move.from.r}"][data-c="\${move.from.c}"]\`);
    const dest=boardEl.querySelector(\`.sq[data-r="\${move.to.r}"][data-c="\${move.to.c}"]\`);
    const svg=origin?.querySelector('.piece-svg');
    if(!svg||!dest)return;
    dest.querySelector('.piece-svg')?.remove();
    if(move.enPassant){
      const capturedAt=move.capturedAt||{r:move.from.r,c:move.to.c};
      boardEl.querySelector(\`.sq[data-r="\${capturedAt.r}"][data-c="\${capturedAt.c}"] .piece-svg\`)?.remove();
    }
    svg.classList.add('no-transition');
    svg.style.transform='';
    dest.appendChild(svg);
    boardEl.querySelectorAll('.sq.selected,.sq.drag-origin,.sq.pointer-drag-origin,.sq.legal,.sq.capture')
      .forEach(sq=>sq.classList.remove('selected','drag-origin','pointer-drag-origin','legal','capture'));
  }

`;
const before=`    if(verifiedOnlineGame()){
      verifiedOnlineSubmit({type:'move',from:{r:move.from.r,c:move.from.c},
        to:{r:move.to.r,c:move.to.c},
        ...(piece[1]==='p'&&isPromotionRank(piece[0],move.to.r)
          ?{promotion:move.promotion||'q'}:{})});
      return;
    }`;
const after=`    if(verifiedOnlineGame()){
      if(verifiedOnlineBusy)return; // No unsubmitted second-move preview.
      snapVerifiedMovePreview(move);
      game.selected=null; game.selectedAsPremove=false; game.legalMoves=[];
      verifiedOnlineSubmit({type:'move',from:{r:move.from.r,c:move.from.c},
        to:{r:move.to.r,c:move.to.c},
        ...(piece[1]==='p'&&isPromotionRank(piece[0],move.to.r)
          ?{promotion:move.promotion||'q'}:{})});
      return;
    }`;
if(s.includes('function snapVerifiedMovePreview(')){
 console.log('Drag snap already patched');process.exit(0);
}
if(s.split(anchor).length!==2||s.split(before).length!==2)
 throw Error('Expected drag snap anchors absent or ambiguous');
s=s.replace(anchor,helper+anchor).replace(before,after);
fs.writeFileSync(file,s);
console.log('Added visual-only verified move snap');
