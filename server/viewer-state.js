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
   'historyGameKey','historySaved',
   'syncActionId','syncSentAt'
 ])delete visible[key];
 // Preserve collection shapes expected by existing render/log/history code
 // while ensuring no hidden coordinates or private action names survive.
 visible.positionCounts={};
 visible.lastRecordedPositionKey=null;
 visible.historySnapshots=[];
 visible.log=[];
 visible.lastMessage='';
 if(!visible.over&&visible.ambushed){
  const opponent=viewerColor==='w'?'b':'w';
  visible.ambushed[opponent]=null;
 }
 return visible;
}
module.exports={viewerState};
