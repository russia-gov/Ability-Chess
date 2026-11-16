'use strict';
/**
 * Canonicalize a client move intent against the exact browser game's legal
 * board-move generator. Client flags (capture, en passant, castle, portal
 * routing, upgradeMove) are NOT trusted and are reconstructed here.
 *
 * This is a building block, NOT the complete server game reducer: it does not
 * award capture points, apply turn expiry, decide game results or authorize a
 * room seat. Never accept its result as a complete online turn.
 */
const rules=require('./generated/board-rules.js');
const {validateGameStateStructure}=require('./game-state-schema.js');
const isObject=x=>x!==null && typeof x==='object' && !Array.isArray(x);
const validSquare=x=>isObject(x)&&Number.isInteger(x.r)&&x.r>=0&&x.r<8
  &&Number.isInteger(x.c)&&x.c>=0&&x.c<8;
const PROMOTIONS=new Set(['q','r','b','n']);
function resolveLegalBoardMove(state,intent){
 const issues=validateGameStateStructure(state);
 if(issues.length)throw new Error('Invalid game state: '+issues.join('; '));
 if(state.over)throw new Error('Game already finished');
 if(state.movesRemaining<=0)throw new Error('No board moves remaining');
 if(state.awaitingAbilityTarget||state.activeAbility)
   throw new Error('Finish selecting the ability before moving');
 if(!isObject(intent)||intent.type!=='move'
     ||!validSquare(intent.from)||!validSquare(intent.to))
   throw new Error('Invalid board move request');
 // Do not trust any extra request fields that purport to decide move effects.
 if(Object.keys(intent).some(k=>!['type','from','to','promotion'].includes(k)))
   throw new Error('Untrusted move metadata');
 if(Object.keys(intent.from).some(k=>!['r','c'].includes(k))
   ||Object.keys(intent.to).some(k=>!['r','c'].includes(k)))
   throw new Error('Untrusted square metadata');
 const piece=rules.pieceAt(state.board,intent.from.r,intent.from.c);
 if(!piece||rules.colorOf(piece)!==state.turn)
   throw new Error('Not a piece belonging to the side to move');
 const moves=rules.legalMovesFor(state,intent.from.r,intent.from.c);
 const canonical=moves.find(m=>m.to.r===intent.to.r&&m.to.c===intent.to.c);
 if(!canonical)throw new Error('Illegal board move');
 const promotionNeeded=piece[1]==='p'
   &&rules.isPromotionRank(piece[0],intent.to.r);
 const p=intent.promotion;
 if(promotionNeeded && !PROMOTIONS.has(p))
   throw new Error('An explicit promotion choice is required');
 if(!promotionNeeded && p!==undefined)
   throw new Error('Promotion not allowed on this move');
 return {...canonical,...(promotionNeeded?{promotion:p}:{})};
}
function applyLegalBoardMoveGeometry(state,intent){
 const move=resolveLegalBoardMove(state,intent);
 const result=rules.applyMoveToState(state,{...move});
 if(!result)throw new Error('Legal move unexpectedly rejected by rules core');
 return {move,boardState:result};
}
module.exports={resolveLegalBoardMove,applyLegalBoardMoveGeometry};
