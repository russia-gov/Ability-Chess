'use strict';
/**
 * Deterministic AbilityChess game transition from trusted persisted state and
 * one typed action. No RPC, user IDs, clock elapsed, or browser objects here.
 *
 * This reducer must only be called after authenticated seat/turn checks and
 * must be committed with an expected-version guard in the same RPC workflow.
 * Timer expiration and draw agreement must be handled by the trusted handler.
 */
const R=require('./generated/board-rules.js');
const {applyLegalBoardMoveGeometry}=require('./board-move-intent.js');
const {applyAbilityIntent}=require('./ability-intent.js');
const {applyUpgradeIntent}=require('./upgrade-intent.js');
const {validateGameStateStructure}=require('./game-state-schema.js');
const VALUES={p:1,n:3,b:3,r:5,q:9,k:0};
const requireLegal=(v,msg)=>{if(!v)throw new Error(msg)};
function copyMetadata(state){
 const s=R.cloneState(state);
 s.lastRecordedPositionKey=state.lastRecordedPositionKey??null;
 s.positionCounts={...(state.positionCounts||{})};
 return s;
}
function finishTurn(state){
 const s=copyMetadata(state),was=s.turn,next=R.other(was);
 if(s.clocks)s.clocks[was]+=s.increment||0;
 if(s.frozen?.[was])s.frozen[was]=null;
 s.turn=next;
 if(s.shielded?.[next])s.shielded[next]=null;
 if(s.ambushed?.[next])s.ambushed[next]=null;
 if(s.fortified?.[next])s.fortified[next]=null;
 if(s.portals?.[was]){
  s.portals[was].turnsRemaining=Number(s.portals[was].turnsRemaining??1)-1;
  if(s.portals[was].turnsRemaining<=0)s.portals[was]=null;
 }
 s.abilityUsed=false;s.movesRemaining=1;s.doubleMoveActive=false;
 s.activeAbility=null;s.awaitingAbilityTarget=false;s.abilitySelection=null;
 return s;
}
function adjudicate(state){
 const s=state;
 if(s.over)return s;
 const wk=R.findKing(s,'w'),bk=R.findKing(s,'b');
 if(!wk||!bk){
  s.over=true;s.winner=wk?'w':bk?'b':null;s.resultReason='king capture';return s;
 }
 const moves=R.allLegalMoves(s,s.turn);
 const abilityEscape=R.abilityCanProduceLegalContinuation(s,s.turn);
 if(moves.length===0&&!abilityEscape){
  s.over=true;s.winner=R.inCheck(s,s.turn)?R.other(s.turn):null;
  s.resultReason=s.winner?'checkmate':'stalemate';return s;
 }
 if(R.isInsufficientMaterial(s)){
  s.over=true;s.winner=null;s.resultReason='insufficient material';return s;
 }
 if(Number(s.halfmoveClock||0)>=100){
  s.over=true;s.winner=null;s.resultReason='fifty-move rule';return s;
 }
 if(R.recordPosition(s)>=3){
  s.over=true;s.winner=null;s.resultReason='threefold repetition';return s;
 }
 return s;
}
function applyGameAction(trustedState,action){
 const before=validateGameStateStructure(trustedState);
 requireLegal(before.length===0,'Invalid authoritative state: '+before.join('; '));
 requireLegal(!trustedState.over,'Game already complete');
 requireLegal(action&&typeof action==='object'&&typeof action.type==='string','Invalid action');
 const who=trustedState.turn;
 let s,endsTurn=false;
 switch(action.type){
  case 'move':{
   const {move,boardState}=applyLegalBoardMoveGeometry(trustedState,action);
   const piece=R.pieceAt(trustedState.board,move.from.r,move.from.c);
   const at=move.enPassant?move.capturedAt:move.to;
   const taken=R.pieceAt(trustedState.board,at.r,at.c);
   s=Object.assign(copyMetadata(trustedState),boardState);
   s.points[who]+=taken?VALUES[taken[1]]||0:0;
   s.halfmoveClock=(piece[1]==='p'||taken)?0:Number(trustedState.halfmoveClock||0)+1;
   const actualTo=move.portalExit||move.to;
   s.lastMove={from:{...move.from},to:{...actualTo}};
   s.lastMoveByColor=s.lastMoveByColor||{w:null,b:null};
   s.lastMoveByColor[who]={
    piece,from:{...move.from},to:{...actualTo},
    resultPiece:piece[1]==='p'&&R.isPromotionRank(who,move.to.r)
      ?who+(move.promotion||'q'):piece
   };
   s.movesRemaining=Number(trustedState.movesRemaining)-1;
   if(taken?.[1]==='k'){
    s.over=true;s.winner=who;s.resultReason='king capture';
   }else if(s.movesRemaining<=0)endsTurn=true;
   break;
  }
  case 'ability':
   s=applyAbilityIntent(trustedState,action);
   s.lastRecordedPositionKey=trustedState.lastRecordedPositionKey??null;
   s.positionCounts={...(trustedState.positionCounts||{})};
   endsTurn=action.id==='teleport';
   break;
  case 'upgrade':{
   const result=applyUpgradeIntent(trustedState,action);
   s=result.state;
   s.lastRecordedPositionKey=trustedState.lastRecordedPositionKey??null;
   s.positionCounts={...(trustedState.positionCounts||{})};
   endsTurn=true;break;
  }
  default:throw new Error('Unsupported gameplay action: '+action.type);
 }
 if(endsTurn)s=finishTurn(s);
 if(endsTurn||s.over)adjudicate(s);
 const after=validateGameStateStructure(s);
 requireLegal(after.length===0,'Reducer produced invalid state: '+after.join('; '));
 return {state:s,endsTurn,terminal:s.over,actionType:action.type};
}
module.exports={applyGameAction,finishTurn,adjudicate};
