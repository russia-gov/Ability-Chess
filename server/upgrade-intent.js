'use strict';
/**
 * Pure, server-side Upgrade purchase. Does not accept any replacement board,
 * number of points, price, or upgrade definition from the client.
 * An upgrade purchase consumes the mover's turn; a trusted turn transition
 * must run before the state may be persisted.
 */
const R=require('./generated/board-rules.js');
function applyUpgradeIntent(state,intent){
 if(!state||!state.board||!['w','b'].includes(state.turn))
  throw new Error('Invalid game state');
 if(!intent||intent.type!=='upgrade'||typeof intent.id!=='string')
  throw new Error('Invalid upgrade intent');
 if(Object.keys(intent).some(k=>!['type','id','replaceType'].includes(k)))
  throw new Error('Untrusted upgrade metadata');
 if(state.over||state.upgradesEnabled===false||state.abilityUsed||
    state.awaitingAbilityTarget||state.activeAbility||state.movesRemaining<=0)
  throw new Error('Upgrade unavailable this turn');
 const def=R.upgradeDefinition(intent.id);
 if(!def)throw new Error('Unknown upgrade');
 const who=state.turn,owned=state.upgrades?.[who]||{};
 const count=Object.keys(owned).length;
 const limit=Number(state.upgradeLimit??3);
 if(!Number.isInteger(limit)||limit<=0||limit>20)
  throw new Error('Invalid upgrade slot count');
 if(owned[def.type]===def.id)throw new Error('Upgrade already owned');
 if(!Number.isSafeInteger(state.points?.[who])||state.points[who]<def.cost)
  throw new Error('Not enough points');
 const candidates=owned[def.type]?[def.type]:
   count>=limit?Object.keys(owned):[];
 if(candidates.length){
  if(!candidates.includes(intent.replaceType))
   throw new Error('Must select a valid owned upgrade to replace');
 }else if(intent.replaceType!=null){
  throw new Error('Unnecessary upgrade replacement');
 }
 const s=R.cloneState(state);
 if(intent.replaceType)delete s.upgrades[who][intent.replaceType];
 s.upgrades[who][def.type]=def.id;
 s.points[who]-=def.cost;
 return {state:s,endsTurn:true,upgradeId:def.id,spent:def.cost};
}
module.exports={applyUpgradeIntent};
