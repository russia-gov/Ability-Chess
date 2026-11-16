'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {viewerState}=require('../viewer-state.js');
test('opponent ambush cannot leak through repetition keys, logs or snapshots',()=>{
 const state={
  board:[],over:false,ambushed:{w:{r:3,c:1},b:{r:4,c:2}},
  positionCounts:{'ambush at 4,2':3},
  lastRecordedPositionKey:'ambush at 4,2',
  historySnapshots:[{ambushed:{b:{r:4,c:2}}}],
  historyGameKey:'private',log:['Black used Ambush at e4'],
  lastMessage:'Black used Ambush at e4',
  syncActionId:'private'
 };
 const view=viewerState(state,'w');
 assert.deepEqual(view.ambushed.w,{r:3,c:1});
 assert.equal(view.ambushed.b,null);
 assert.deepEqual(view.positionCounts,{});
 assert.equal(view.lastRecordedPositionKey,null);
 assert.deepEqual(view.historySnapshots,[]);
 assert.deepEqual(view.log,[]);
 assert.equal(view.lastMessage,'');
 for(const key of ['historyGameKey','syncActionId']){
  assert.equal(key in view,false,'must not disclose '+key);
 }
 assert.deepEqual(state.ambushed.b,{r:4,c:2},'input must remain unchanged');
 assert.equal(JSON.stringify(view).includes('ambush at 4,2'),false);
});
test('game-over viewer may see the revealed ambush destination',()=>{
 const state={board:[],over:true,ambushed:{w:{r:3,c:1},b:{r:4,c:2}}};
 assert.deepEqual(viewerState(state,'w').ambushed.b,{r:4,c:2});
});
test('invalid viewer color is rejected',()=>{
 assert.throws(()=>viewerState({board:[]},'admin'),/Unknown viewer/);
});
