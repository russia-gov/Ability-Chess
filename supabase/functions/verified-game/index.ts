// STAGED Edge endpoint. Do not deploy before the online UI migration and the
// coordinated removal of legacy state/result RPCs.
// The generated rules.mjs is produced by scripts/build_verified_edge_module.js.
import {applyGameAction,viewerState} from './rules.mjs';

type GameState = Record<string, any>;
type Seat = {color:'w'|'b';userId:string|null};
type RoomRecord = {
 id:string; status:string; version:number; expires_at:string;updated_at:string;
 host_token:string;guest_token:string|null;host_color:'w'|'b';
 host_user_id:string|null;guest_user_id:string|null;
 settings:Record<string, any>;game_state:GameState;
};

const URL_BASE=Deno.env.get('SUPABASE_URL')||'';
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,cache-control',
 'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
 'Cache-Control':'no-store',
 'Vary':'Origin'
};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{...cors,'Content-Type':'application/json'}
});
const fail=(status:number,message:string)=>reply({error:message},status);
const authHeaders={
 apikey:SERVICE_KEY,Authorization:'Bearer '+SERVICE_KEY,
 'Content-Type':'application/json'
};
async function rest(url:string,options:RequestInit={}):Promise<any>{
 const response=await fetch(URL_BASE+url,{...options,headers:{...authHeaders,...(options.headers as Record<string,string>||{})}});
 const text=await response.text();
 let data;
 try{data=text?JSON.parse(text):null;}catch{data={message:'Invalid server JSON response'};}
 if(!response.ok)throw new Error('Database operation failed ('+response.status+'): '
  +(data?.message||data?.error||'Unknown'));
 return data;
}
async function readRoom(roomId:string):Promise<RoomRecord>{
 const rows=await rest('/rest/v1/ability_chess_rooms?select=*&id=eq.'+encodeURIComponent(roomId));
 if(!Array.isArray(rows)||rows.length!==1)throw new Error('Room not found');
 return rows[0];
}
async function currentUser(req:Request):Promise<string|null>{
 const header=req.headers.get('Authorization')||'';
 const match=header.match(/^Bearer\s+(\S+)$/i);
 if(!match)return null;
 // JWT is verified against Supabase Auth, not decoded/trusted locally.
 const response=await fetch(URL_BASE+'/auth/v1/user',{
  headers:{apikey:SERVICE_KEY,Authorization:'Bearer '+match[1]}
 });
 if(response.status===401||response.status===403)return null;
 if(!response.ok)throw new Error('Authentication service unavailable');
 const user=await response.json();return UUID.test(user?.id||'')?user.id:null;
}
function seatFor(room:RoomRecord,token:string):Seat|null{
 if(token===room.host_token)return {color:room.host_color,userId:room.host_user_id};
 if(token===room.guest_token && room.guest_token)return {
  color:room.host_color==='w'?'b':'w',userId:room.guest_user_id
 };
 return null;
}
function protectedRoom(room:RoomRecord):boolean{
 return room.settings?.rated===true || !!room.settings?.tournamentId;
}
function authorize(room:RoomRecord,token:string,userId:string|null):Seat{
 const seat=seatFor(room,token);
 if(!seat)throw new Error('Invalid seat token');
 if(seat.userId!=null && seat.userId!==userId)
  throw new Error('This account does not own the room seat');
 if(protectedRoom(room)&&(!seat.userId||!room.host_user_id||!room.guest_user_id))
  throw new Error('Competitive games require two authenticated seats');
 return seat;
}
function estimateClock(row:RoomRecord,state:GameState):number|null{
 if(!state.clocks||!Number.isFinite(Number(state.clocks[state.turn])))
  return null;
 const age=Math.max(0,(Date.now()-new Date(row.updated_at).getTime())/1000);
 return Number(state.clocks[state.turn])-age;
}
function enforceClock(row:RoomRecord,state:GameState):GameState{
 const remaining=estimateClock(row,state);
 if(remaining===null)return state;
 const out=structuredClone(state);
 out.clocks[out.turn]=Math.max(0,remaining);
 return out;
}
async function commit(room:RoomRecord,seat:Seat,userId:string|null,token:string,expectedVersion:number,state:GameState,actionType:string,action:Record<string,unknown>){
 const rows=await rest('/rest/v1/rpc/ability_chess_commit_verified_action',{
  method:'POST',
  body:JSON.stringify({
   p_room_id:room.id,p_seat_token:token,p_actor_user_id:userId,
   p_expected_version:expectedVersion,p_next_state:state,
   p_action_type:actionType,p_action_payload:action
  })
 });
 if(!Array.isArray(rows)||rows.length!==1)throw new Error('Action commit returned no state');
 return {version:rows[0].new_version,
  state:viewerState(rows[0].updated_state,seat.color),
  status:rows[0].updated_state?.over?'finished':'active'};
}
// Rematches are negotiated in a service-only, transactionally locked RPC.
 // Only the caller's new seat token is returned; the completed room is immutable.
async function rematchAction(room:RoomRecord,token:string,userId:string|null,operation:string){
 const rows=await rest('/rest/v1/rpc/ability_chess_verified_rematch',{
  method:'POST',body:JSON.stringify({
   p_room_id:room.id,p_seat_token:token,
   p_actor_user_id:userId,p_operation:operation
  })
 });
 if(!Array.isArray(rows)||rows.length!==1)throw new Error('Invalid rematch response');
 const r=rows[0];
 const rematch:any={status:r.rematch_status,offeredBy:r.offered_by};
 if(r.rematch_status==='ready'){
  rematch.room={id:r.room_id,token:r.seat_token,
   color:r.assigned_color,version:Number(r.room_version),
   settings:r.room_settings,state:r.state};
 }
 return rematch;
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(!SERVICE_KEY||!URL_BASE)return fail(503,'Trusted gameplay service is not configured');
 if(!['GET','POST'].includes(req.method))return fail(405,'Unsupported method');
 try{
  const userId=await currentUser(req);
  let input:any;
  if(req.method==='GET'){
   const url=new URL(req.url);
   input={roomId:url.searchParams.get('roomId'),seatToken:url.searchParams.get('seatToken')};
  }else{
   const raw=await req.text();
   if(raw.length>4096)return fail(413,'Action request too large');
   try{input=JSON.parse(raw);}catch{return fail(400,'Invalid JSON');}
  }
  if(!UUID.test(input?.roomId||'')||!UUID.test(input?.seatToken||''))
   return fail(400,'Invalid room or seat identifier');
  const room=await readRoom(input.roomId);
  if(new Date(room.expires_at).getTime()<=Date.now())return fail(410,'Room expired');
  const seat=authorize(room,input.seatToken,userId);
  if(req.method==='GET'){
   const viewed=enforceClock(room,room.game_state);
   const rematch=room.status==='finished'&&room.game_state?.over===true
     &&!protectedRoom(room)
     ?await rematchAction(room,input.seatToken,userId,'status'):null;
   return reply({roomVersion:room.version,roomStatus:room.status,
     opponentJoined:!!room.guest_token,serverNow:new Date().toISOString(),
     stateUpdatedAt:room.updated_at,
     state:viewerState(viewed,seat.color),settings:room.settings,rematch});
  }
  if(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)
   return fail(400,'Expected game version is required');
  if(room.version!==input.expectedVersion)
   return fail(409,'Game version conflict: refresh authoritative state');
  const action=input.action;
  if(!action||typeof action!=='object'||typeof action.type!=='string')
   return fail(400,'Typed action is required');
  if(['offerRematch','acceptRematch','declineRematch'].includes(action.type)){
   if(room.status!=='finished'||room.game_state?.over!==true
      ||protectedRoom(room))return fail(409,'Only finished casual games can rematch');
   // The RPC locks the finished source room and the offer row, enforcing
   // seat/account ownership, consent and single-room creation under races.
   const operation=action.type==='offerRematch'?'offer':
     action.type==='acceptRematch'?'accept':'decline';
   const rematch=await rematchAction(room,input.seatToken,userId,operation);
   return reply({version:room.version,status:'finished',
      state:viewerState(room.game_state,seat.color),rematch});
  }
  if(action.type==='configureRoom'){
   if(room.host_token!==input.seatToken)
    return fail(403,'Only the host can configure a room');
   if(!room.guest_token||room.status!=='active')
    return fail(409,'Waiting for a second player');
   if(room.game_state?.onlineStarted===true)
    return fail(409,'Game has already started');
   if(action.settings?.tournamentId) return fail(403,'Tournament settings cannot be changed');
   const rows=await rest('/rest/v1/rpc/ability_chess_start_verified_room',{
    method:'POST',body:JSON.stringify({
     p_room_id:room.id,p_host_token:input.seatToken,
     p_actor_user_id:userId,p_expected_version:input.expectedVersion,
     p_settings:action.settings,p_host_color:action.hostColor
    })
   });
   if(!Array.isArray(rows)||rows.length!==1)throw new Error('Room start returned no state');
   const assigned=action.hostColor;
   return reply({version:rows[0].new_version,
      state:viewerState(rows[0].updated_state,assigned),status:'active',
      settings:rows[0].room_settings});
  }
  if(room.status!=='active')return fail(409,'Game is no longer active');
  if(room.game_state?.onlineStarted!==true)
   return fail(409,'Game has not been started');

  const current=structuredClone(room.game_state);
  const remaining=estimateClock(room,current);
  if(remaining!==null){
   current.clocks[current.turn]=Math.max(0,remaining);
  }
  let next:GameState,actionType:string;
  if(action.type==='claimTimeout'){
   if(remaining===null||remaining>0)return fail(409,'No player has timed out');
   if(seat.color===current.turn)return fail(403,'Cannot claim own timeout');
   next={...current,over:true,winner:seat.color,resultReason:'timeout'};
   actionType='timeout';
  }else if(action.type==='resign'){
   next={...current,over:true,winner:seat.color==='w'?'b':'w',
    resultReason:'resignation'};
   actionType='resign';
  }else if(action.type==='offerDraw'){
   if(seat.color!==current.turn)return fail(403,'Not your turn');
   if(current.drawOffer===seat.color)return fail(409,'Draw already offered');
   next={...current,drawOffer:seat.color};actionType='draw';
  }else if(action.type==='acceptDraw'){
   if(current.drawOffer!==(seat.color==='w'?'b':'w'))
    return fail(409,'No opponent draw offer');
   next={...current,over:true,winner:null,resultReason:'agreement',
    drawOffer:null};actionType='draw';
  }else if(action.type==='cancelDraw'){
   if(current.drawOffer!==seat.color)return fail(409,'No own draw offer to cancel');
   next={...current,drawOffer:null};actionType='draw';
  }else if(action.type==='declineDraw'){
   if(current.drawOffer!==(seat.color==='w'?'b':'w'))
    return fail(409,'No opponent draw offer to decline');
   next={...current,drawOffer:null};actionType='draw';
  }else{
   if(remaining!==null&&remaining<=0)return fail(409,'Clock expired');
   if(seat.color!==current.turn)return fail(403,'Not your turn');
   const result=applyGameAction(current,action);
   next=result.state;actionType=result.actionType;
  }
  const updated=await commit(room,seat,userId,input.seatToken,
   input.expectedVersion,next,actionType,action);
  return reply(updated,200);
 }catch(error){
  const message=String((error as Error)?.message||'Operation failed');
  if(/version conflict/i.test(message))return fail(409,'Game version conflict');
  if(/(Invalid seat|does not own|Not your turn|cannot claim)/i.test(message))
   return fail(403,message);
  if(/(Database operation failed|Authentication service unavailable)/.test(message)){
   console.error('Trusted gameplay database failure',message);
   return fail(503,'The game service is temporarily unavailable');
  }
  return fail(400,message.slice(0,250));
 }
});
