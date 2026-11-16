#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
let s=fs.readFileSync('index.html','utf8');
const marker='  async function supabaseRpc(name,body){';
const sentinel='  async function verifiedRoomReadLegacyShape(body){';
if(s.includes(sentinel)){console.log('Verified room read wrapper already installed');process.exit(0);}
if(!process.argv.includes('--apply'))throw Error('Use --apply to modify index.html');
if(s.split(marker).length!==2)throw Error('Could not uniquely locate online RPC');
const insert=[
"  // Compatibility wrapper for old room/lobby callers. They now receive a",
"  // per-seat filtered, authenticated server read instead of a raw snapshot.",
"  async function verifiedRoomReadLegacyShape(body){",
"    if(memberSession?.refresh_token&&Date.now()/1000>Number(memberSession.expires_at||0)-45)",
"      await refreshMemberToken();",
"    const query='?roomId='+encodeURIComponent(body.p_room_id)",
"      +'&seatToken='+encodeURIComponent(body.p_seat_token);",
"    const response=await fetch(SUPABASE_URL+'/functions/v1/verified-game'+query,{",
"      headers:{apikey:SUPABASE_KEY,",
"        Authorization:'Bearer '+(memberSession?.access_token||SUPABASE_KEY)},",
"      cache:'no-store'",
"    });",
"    const data=await response.json().catch(()=>({error:'Invalid verified server response'}));",
"    if(!response.ok)throw Error(data.error||'Verified room read failed');",
"    return [{state:data.state,room_settings:data.settings,",
"      room_status:data.roomStatus,room_version:data.roomVersion,",
"      opponent_joined:data.opponentJoined,",
"      state_updated_at:data.stateUpdatedAt,server_now:data.serverNow}];",
"  }",
""
].join('\n');
s=s.replace(marker,insert+marker+"\n    if(VERIFIED_ONLINE_GAMEPLAY&&name==='ability_chess_get_room_live')\n      return verifiedRoomReadLegacyShape(body);");
fs.writeFileSync('index.html',s);
console.log('Migrated all room reads and resumes through verified Edge GET');
