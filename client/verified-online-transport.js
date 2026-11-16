'use strict';
/**
 * Browser transport for the server-authoritative AbilityChess action endpoint.
 * Does not send client-computed board state, winner, points, or rating.
 *
 * Game UI migration is deliberately separate. Do not replace the existing
 * online sync with this module until room creation, clocks, reconciliation,
 * and every ability interaction have end-to-end tests.
 */
(function(root,factory){
 const exported=factory();
 if(typeof module==='object'&&module.exports)module.exports=exported;
 if(root)root.AbilityChessVerifiedOnlineTransport=exported;
})(typeof window!=='undefined'?window:null,function(){
 const VALID_TYPES=new Set([
  'move','ability','upgrade','resign','offerDraw','acceptDraw','claimTimeout','configureRoom','cancelDraw','declineDraw','offerRematch','acceptRematch','declineRematch'
 ]);
 class Transport {
  constructor({endpoint,apiKey,getAccessToken,getSession,onState,onRematch,fetchImpl}){
   if(!/^https:\/\//.test(String(endpoint||'')))throw Error('HTTPS endpoint required');
   if(typeof onState!=='function')throw Error('State handler required');
   this.endpoint=endpoint.replace(/\/$/,'');
   this.apiKey=apiKey;
   this.getAccessToken=getAccessToken||(()=>null);
   this.getSession=getSession;
   this.onState=onState;
   this.onRematch=typeof onRematch==='function'?onRematch:null;
   this.lastRematchKey=null;
   // Browser fetch must retain its global receiver; an unbound reference
   // throws 'Illegal invocation' in Chromium during actual online moves.
   this.fetchImpl=fetchImpl||((url,options)=>fetch(url,options));
   this.tail=Promise.resolve();
  }
  async request(method,path,body){
   const token=this.getAccessToken()||this.apiKey;
   const headers={apikey:this.apiKey,Authorization:'Bearer '+token,
    'Content-Type':'application/json','Cache-Control':'no-store'};
   const response=await this.fetchImpl(this.endpoint+path,{
    method,headers,cache:'no-store',
    ...(body===undefined?{}:{body:JSON.stringify(body)})
   });
   const result=await response.json().catch(()=>({error:'Invalid response'}));
   if(!response.ok){
    const error=new Error(result?.error||'Online request failed');
    error.status=response.status;
    throw error;
   }
   return result;
  }
  session(){
   const session=this.getSession();
   if(!session?.id||!session?.token||!Number.isSafeInteger(Number(session.version)))
    throw Error('Active online seat and version required');
   return session;
  }
  async refresh(){
   const session=this.session();
   const query='?roomId='+encodeURIComponent(session.id)
    +'&seatToken='+encodeURIComponent(session.token);
   const answer=await this.request('GET',query);
   const nextVersion=Number(answer.roomVersion);
   // Rematch offers are metadata, not a game-version change. Notify even
   // when the completed source position remains identical.
   if(session.id===this.session().id && Object.prototype.hasOwnProperty.call(answer,'rematch'))
    this.notifyRematch(answer);
   // Unchanged-version polls must not clear the user's in-progress selection
   // of a multi-click ability or restart move animations every 700 ms.
   // A poll can finish after a newer action response. Never roll back the
   // board or the optimistic-concurrency version to that older snapshot.
   if(session.id===this.session().id && Number.isSafeInteger(nextVersion)&&nextVersion>Number(session.version)){
    session.version=nextVersion;
    this.onState(answer.state,answer);
   }
   return answer;
  }
  notifyRematch(answer){
   const info=answer.rematch;
   const key=info?JSON.stringify([
     info.status,info.offeredBy,info.room?.id
   ]):'none';
   if(key===this.lastRematchKey)return;
   this.lastRematchKey=key;
   this.onRematch?.(info,answer);
  }
  submit(action){
   if(!action||typeof action!=='object'||!VALID_TYPES.has(action.type))
    return Promise.reject(new Error('Unsupported verified action'));
   if(['board','game_state','state','winner','points','rating',
       'opponentRating','p_game_state'].some(key=>Object.prototype.hasOwnProperty.call(action,key)))
    return Promise.reject(new Error('Client state and claimed results are not accepted'));
   // Serialize actions. No optimistic whole-board overwrite, and no automatic
   // resubmission on stale versions or ambiguous network failure.
   const send=async()=>{
    const session=this.session();
    try{
     const answer=await this.request('POST','',{
      roomId:session.id,seatToken:session.token,
      expectedVersion:Number(session.version),action
     });
     const returnedVersion=Number(answer.version);
     if(session.id!==this.session().id)return answer;
     if(!Number.isSafeInteger(returnedVersion)||returnedVersion<=Number(session.version)){
      // A concurrent poll may already have supplied an even newer position.
      // Do not replace it with a stale response to this action.
      if(!Number.isSafeInteger(returnedVersion))throw Error('Invalid game version response');
      return answer;
     }
     session.version=returnedVersion;
     this.onState(answer.state,answer);
     if(Object.prototype.hasOwnProperty.call(answer,'rematch'))this.notifyRematch(answer);
     return answer;
    }catch(error){
     // A timeout might mean the server committed but the response was lost.
     // Refresh authoritative state; don't blindly repeat a paid ability.
     try{await this.refresh();}catch{}
     throw error;
    }
   };
   const result=this.tail.then(send);
   this.tail=result.catch(()=>{});
   return result;
  }
 }
 return {Transport,VALID_TYPES};
});
