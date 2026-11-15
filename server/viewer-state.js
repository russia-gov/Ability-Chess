'use strict';
/**
 * Returns a privacy-safe board state for one seat. In particular positionCounts
 * and embedded replay snapshots disclose hidden Ambush square coordinates.
 * Never return raw trusted state to clients, even in an action acknowledgement.
 */
function viewerState(state,viewerColor) {
 if(!state||typeof state!=='object'||Array.isArray(state))
  throw new Error('Invalid trusted state');
 if(!['w','b'].includes(viewerColor))
  throw new Error('Unknown viewer side');
 const visible=structuredClone(state);
 for(const key of [
   'positionCounts','lastRecordedPositionKey','historySnapshots',
   'historyGameKey','log','lastMessage','historySaved',
   'syncActionId','syncSentAt'
 ])delete visible[key];
 if(!visible.over&&visible.ambushed){
  const opponent=viewerColor==='w'?'b':'w';
  visible.ambushed[opponent]=null;
 }
 return visible;
}
module.exports={viewerState};
