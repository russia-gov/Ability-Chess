'use strict';
// Single ability effect validation, extracted behavior from the current browser.
// This intentionally does NOT finalize a turn or accept clients as authoritative.
const R=require('./generated/board-rules.js');
const sq=x=>x&&Number.isInteger(x.r)&&Number.isInteger(x.c)&&R.inBounds(x.r,x.c);
const eq=(a,b)=>!!a&&!!b&&a.r===b.r&&a.c===b.c;
const piece=(s,x)=>R.pieceAt(s.board,x.r,x.c);
const demand=(condition,message)=>{if(!condition)throw new Error(message)};
const costs=Object.freeze({teleport:4,bomb:4,shield:3,freeze:3,swap:4,recall:4,reinforce:5,portal:5,ambush:4,fortify:4,double:6});
const values={p:1,n:3,b:3,r:5,q:9,k:0};
function applyAbilityIntent(state,intent){
 demand(state&&state.board&&['w','b'].includes(state.turn),'Invalid game state');
 demand(intent&&typeof intent==='object'&&!Array.isArray(intent),'Invalid intent');
 const id=intent.id,cost=costs[id],who=state.turn;
 demand(cost!==undefined,'Unknown ability');
 demand(state.abilitiesEnabled!==false,'Abilities disabled');
 demand(!state.over&&!state.abilityUsed&&!state.activeAbility&&!state.awaitingAbilityTarget,'Ability unavailable');
 demand(Number.isSafeInteger(state.points?.[who])&&state.points[who]>=cost,'Insufficient points');
 demand(state.movesRemaining>0,'Turn already complete');
 const s=R.cloneState(state),from=intent.from,to=intent.to,target=intent.target;
 const ensure=x=>demand(sq(x),'Invalid square');
 const isOwn=x=>piece(s,x)?.[0]===who;
 const isEnemy=x=>piece(s,x)&&piece(s,x)[0]!==who;
 const commit=()=>{s.points[who]-=cost;s.abilityUsed=true;s.activeAbility=null;s.awaitingAbilityTarget=false;s.abilitySelection=null;};
 switch(id){
  case 'double':
   demand(s.movesRemaining===1&&!s.doubleMoveActive,'Double Move must precede the move');
   s.movesRemaining=2;s.doubleMoveActive=true;commit();break;
  case 'shield':case 'ambush':
   ensure(target);demand(isOwn(target),'Target must be friendly');
   if(id==='ambush')demand(piece(s,target)[1]!=='k','Cannot ambush king');
   s[id==='shield'?'shielded':'ambushed'][who]={...target};
   commit();break;
  case 'freeze':
   ensure(target);
   demand(isEnemy(target)&&piece(s,target)[1]!=='k','Requires enemy non-king');
   demand(!R.isFortifiedAgainstAbility(s,target.r,target.c,who),'Fortify protected');
   s.frozen[R.other(who)]={...target};commit();break;
  case 'reinforce':
   ensure(target);
   demand(piece(s,target)===who+'p'&&(who==='w'?target.r<=3:target.r>=4),'Pawn not eligible');
   demand(['n','b'].includes(intent.promoteTo),'Must choose knight or bishop');
   s.board[target.r][target.c]=who+intent.promoteTo;
   demand(R.allLegalMoves(s,who).length>0,'No legal follow-up move');
   commit();break;
  case 'swap':
   ensure(from);ensure(to);
   demand(!eq(from,to)&&isOwn(from)&&isOwn(to)
     &&piece(s,from)[1]!=='k'&&piece(s,to)[1]!=='k','Invalid swap');
   [s.board[from.r][from.c],s.board[to.r][to.c]]
     =[s.board[to.r][to.c],s.board[from.r][from.c]];
   demand(!R.inCheck(s,who),'Swap leaves king in check');
   if(eq(s.shielded[who],from)||eq(s.shielded[who],to))s.shielded[who]=null;
   if(eq(s.ambushed[who],from))s.ambushed[who]={...to};
   else if(eq(s.ambushed[who],to))s.ambushed[who]={...from};
   commit();break;
  case 'recall':{
   const m=s.lastMoveByColor?.[who];
   demand(m&&m.piece?.[1]!=='k','No eligible recall');
   ensure(m.from);ensure(m.to);
   demand(piece(s,m.to)===m.resultPiece&&!piece(s,m.from),'Recall piece missing or start occupied');
   s.board[m.from.r][m.from.c]=piece(s,m.to);s.board[m.to.r][m.to.c]=null;
   demand(!R.inCheck(s,who),'Recall leaves king in check');
   if(eq(s.shielded[who],m.to))s.shielded[who]=null;
   commit();break;
  }
  case 'portal':
   ensure(from);ensure(to);
   demand(!eq(from,to)&&!piece(s,from)&&!piece(s,to),'Portals require distinct empty squares');
   demand(!R.isFortifiedAgainstAbility(s,from.r,from.c,who)
     &&!R.isFortifiedAgainstAbility(s,to.r,to.c,who),'Fortify protected');
   s.portals[who]={a:{...from},b:{...to},turnsRemaining:3};commit();break;
  case 'fortify':{
   ensure(target);const king=R.findKing(s,who);
   demand(king,'Missing king');
   const candidates=[];
   for(const top of [target.r-1,target.r])for(const left of [target.c-1,target.c]){
    const area=[{r:top,c:left},{r:top,c:left+1},{r:top+1,c:left},{r:top+1,c:left+1}];
    if(area.every(sq)&&area.some(x=>eq(x,king)))candidates.push(area);
   }
   demand(candidates.length>0,'Area must contain king');
   s.fortified[who]={squares:candidates[0]};commit();break;
  }
  case 'teleport':{
   ensure(from);ensure(to);const moving=piece(s,from);
   demand(moving&&moving[0]===who&&moving[1]!=='k','Teleport requires friendly non-king');
   demand(!piece(s,to),'Teleport destination occupied');
   demand(!R.isFortifiedAgainstAbility(s,to.r,to.c,who),'Fortify protected');
   if(moving[1]==='p')demand(who==='w'?(from.r>=4&&to.r>=4):(from.r<=3&&to.r<=3),'Pawn teleport restricted');
   const trial=R.cloneState(s);
   trial.board[to.r][to.c]=moving;trial.board[from.r][from.c]=null;
   const king=R.findKing(trial,R.other(who));
   demand(!king||!R.pseudoMoves(trial,to.r,to.c,true).some(x=>eq(x.to,king)),
     'Teleport cannot immediately attack opposing king');
   R.revokeCastlingRights(s,moving,from);
   s.board[to.r][to.c]=moving;s.board[from.r][from.c]=null;
   if(eq(s.shielded[who],from))s.shielded[who]=null;
   demand(!R.inCheck(s,who),'Teleport leaves king in check');
   // Match existing client behavior: teleport does not clear en passant state.
   s.lastMove={from:{...from},to:{...to}};
   s.movesRemaining=0;commit();break;
  }
  case 'bomb':{
   ensure(target);demand(isOwn(target),'Bomb center must be friendly');
   let gains=0;
   for(let r=target.r-1;r<=target.r+1;r++)for(let c=target.c-1;c<=target.c+1;c++){
    if(!R.inBounds(r,c))continue;
    const p=s.board[r][c];
    demand(!p||p[1]!=='k','Cannot bomb king');
    demand(!p||!R.isFortifiedAgainstAbility(s,r,c,who),'Fortify protected');
   }
   for(let r=target.r-1;r<=target.r+1;r++)for(let c=target.c-1;c<=target.c+1;c++){
    if(!R.inBounds(r,c))continue;const p=s.board[r][c];if(!p)continue;
    if(p[0]!==who)gains+=values[p[1]];
    R.revokeCastlingRights(s,p,{r,c});s.board[r][c]=null;
   }
   demand(!R.inCheck(s,who),'Bomb leaves king in check');
   commit();s.points[who]+=gains;break;
  }
  default:throw new Error('Unsupported ability');
 }
 demand(s.points[who]>=0,'Negative ability points');
 return s;
}
module.exports={costs,applyAbilityIntent};
