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
  'move','ability','upgrade','resign','offerDraw','acceptDraw','claimTimeout','configureRoom','cancelDraw','declineDraw'
 ]);
 class Transport {
  constructor({endpoint,apiKey,getAccessToken,getSession,onState,fetchImpl}){
   if(!/^https:\/\//.test(String(endpoint||'')))throw Error('HTTPS endpoint required');
   if(typeof onState!=='function')throw Error('State handler required');
   this.endpoint=endpoint.replace(/\/$/,'');
   this.apiKey=apiKey;
   this.getAccessToken=getAccessToken||(()=>null);
   this.getSession=getSession;
   this.onState=onState;
   this.fetchImpl=fetchImpl||fetch;
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
   session.version=Number(answer.roomVersion);
   this.onState(answer.state,answer);
   return answer;
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
     session.version=Number(answer.version);
     this.onState(answer.state,answer);
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
