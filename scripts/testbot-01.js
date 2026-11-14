#!/usr/bin/env node
'use strict';

// TestBot-01: a manually launched, single-account, UNRATED test opponent.
// This deliberately uses the app's real member auth, challenge acceptance,
// online room polling, legal moves and move submission paths.
//
// No accounts or games are created automatically. No service_role key is used.
// Do not run against a shared/production backend without explicit permission.

const {chromium} = require('playwright');

const URL = process.env.ABILITY_CHESS_URL || 'http://127.0.0.1:4173/';
const EMAIL = process.env.TESTBOT_EMAIL;
const PASSWORD = process.env.TESTBOT_PASSWORD;
const ALLOWED_USER = (process.env.TESTBOT_ALLOWED_USERNAME || '').replace(/^@/, '').toLowerCase();
const SLOW_MS = Math.max(500, Number(process.env.TESTBOT_MOVE_DELAY_MS || 2000));
const MAX_MOVES = Math.min(150, Math.max(1, Number(process.env.TESTBOT_MAX_MOVES || 80)));
const MAX_MINUTES = Math.min(120, Math.max(1, Number(process.env.TESTBOT_MAX_MINUTES || 25)));
const HEADLESS = process.env.TESTBOT_HEADLESS !== '0';

const url = new URL(URL);
const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
if (!local && process.env.TESTBOT_ALLOW_REMOTE !== 'YES') {
  throw new Error('Remote test disabled. Use TESTBOT_ALLOW_REMOTE=YES only for an approved test environment.');
}
if (!EMAIL || !PASSWORD || !ALLOWED_USER) {
  throw new Error('Set TESTBOT_EMAIL, TESTBOT_PASSWORD and TESTBOT_ALLOWED_USERNAME. Never commit credentials.');
}
if (!Number.isFinite(SLOW_MS) || !Number.isFinite(MAX_MOVES) || !Number.isFinite(MAX_MINUTES)) {
  throw new Error('Invalid timing configuration.');
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = (event, data={}) => console.log(JSON.stringify({time:new Date().toISOString(),event,...data}));

async function logIn(page) {
  await page.waitForFunction(() => typeof authRequest === 'function' &&
    typeof saveMemberSession === 'function' && typeof memberRpc === 'function');
  return page.evaluate(async ({email,password}) => {
    const data = await authRequest('token?grant_type=password', {email,password});
    if (!data?.access_token) throw new Error('Test account authentication returned no token');
    saveMemberSession(data);
    await loadMyProfile();
    return {username:memberProfile?.username || null};
  }, {email:EMAIL,password:PASSWORD});
}

async function findPermittedChallenge(page) {
  return page.evaluate(async allowedUsername => {
    const rows = await memberRpc('ability_chess_list_member_challenges');
    const pending = (rows||[]).filter(c => c.status==='pending' && c.direction==='incoming');
    const approved = pending.find(c =>
      String(c.other_username||'').toLowerCase() === allowedUsername &&
      c.settings?.rated === false
    );
    return {
      candidate:approved ? {id:approved.challenge_id,from:approved.other_username} : null,
      ignored:pending.length-(approved?1:0)
    };
  }, ALLOWED_USER);
}

async function accept(page,id) {
  return page.evaluate(async id => {
    const ok=await acceptMemberChallenge(id);
    if(!ok)throw new Error('Challenge acceptance failed: '+(memberStatus?.textContent||'unknown'));
    return {
      room:onlineSession?.id||null,
      color:game?.playerColor||null,
      started:!!game?.onlineStarted
    };
  },id);
}

async function state(page) {
  return page.evaluate(() => {
    if (!game || !onlineSession || game.mode !== 'online') return {connected:false};
    const mine=game.playerColor;
    const turn=game.turn;
    return {
      connected:true,room:onlineSession.id,version:Number(onlineSession.version),
      mine,turn,started:!!game.onlineStarted,over:!!game.over,
      waiting:!!onlineSession.waiting,dirty:!!hasUncommittedOnlineMutation(),
      syncing:!!onlineSyncing,
      legal:game.onlineStarted && !game.over && turn===mine
        ? allLegalMoves(game,turn).length : null,
      board:JSON.stringify(game.board),
      points:JSON.stringify(game.points),
      syncActionId:game.syncActionId||null
    };
  });
}

async function makeTestMove(page) {
  return page.evaluate(() => {
    if(!game||!onlineSession||game.mode!=='online'||!game.onlineStarted||game.over) return {moved:false,why:'no active online game'};
    if(game.playerColor!==game.turn)return {moved:false,why:'not my turn'};
    if(onlineSyncing||hasUncommittedOnlineMutation())return {moved:false,why:'pending synchronization'};
    const moves=allLegalMoves(game,game.turn);
    if(!moves.length)return {moved:false,why:'no legal moves'};
    // Prefer a deterministic move in repeated test runs; no analysis engine is needed.
    const m=moves[0];
    const before=Number(onlineSession.version);
    const from=String.fromCharCode(97+m.from.c)+(8-m.from.r);
    const to=String.fromCharCode(97+m.to.c)+(8-m.to.r);
    makeMove({...m,promotion:m.promotion||'q'},{animate:false,source:'testbot'});
    return {moved:true,move:from+to,beforeVersion:before};
  });
}

async function authoritativeCheck(page) {
  return page.evaluate(async () => {
    if(!onlineSession||!game)return {ok:false,reason:'no active session'};
    const rows=await supabaseRpc('ability_chess_get_room_live',{
      p_room_id:onlineSession.id,p_seat_token:onlineSession.token
    });
    const row=rows?.[0];
    if(!row)return {ok:false,reason:'missing room'};
    const v=Number(row.room_version);
    const sameBoard=JSON.stringify(row.state?.board)===JSON.stringify(game.board);
    const samePoints=JSON.stringify(row.state?.points)===JSON.stringify(game.points);
    const localVersion=Number(onlineSession.version);
    return {
      ok:v!==localVersion||(sameBoard&&samePoints),
      deferred:v!==localVersion,
      remoteVersion:v,localVersion,
      sameBoard,samePoints,
      // These are meaningful only after local pending changes settle.
      dirty:hasUncommittedOnlineMutation()||onlineSyncing
    };
  });
}

async function main() {
  const browser=await chromium.launch({headless:HEADLESS});
  const context=await browser.newContext();
  const page=await context.newPage();
  page.on('pageerror',e=>report('page_error',{message:e.message}));
  page.on('console',m=>{if(m.type()==='error')report('console_error',{message:m.text().slice(0,300)});});
  let completed=0,activeRoom=null,lastVersion=null;
  const deadline=Date.now()+MAX_MINUTES*60000;
  try {
    await page.goto(URL,{waitUntil:'domcontentloaded',timeout:45000});
    const identity=await logIn(page);
    report('signed_in',{username:identity.username});
    while(Date.now()<deadline&&completed<MAX_MOVES){
      const current=await state(page);
      if(!current.connected || !current.started){
        const challenges=await findPermittedChallenge(page);
        if(challenges.candidate){
          const accepted=await accept(page,challenges.candidate.id);
          activeRoom=accepted.room;
          report('challenge_accepted',{room:activeRoom,from:challenges.candidate.from,color:accepted.color});
        }
        await pause(2000);
        continue;
      }
      if(!activeRoom){activeRoom=current.room;report('resumed_game',{room:activeRoom});}
      if(current.room!==activeRoom){
        report('room_changed',{from:activeRoom,to:current.room});activeRoom=current.room;
      }
      if(current.over){report('game_finished',{room:current.room,moves:completed});break;}
      if(current.version!==lastVersion && !current.dirty && !current.syncing){
        const check=await authoritativeCheck(page);
        if(check.deferred){await pause(750);continue;}
        if(!check.ok&&!check.dirty){
          report('state_mismatch',check);
          throw new Error('Local and authoritative board/points disagree after synchronization');
        }
        lastVersion=current.version;
        report('state_verified',{version:current.version,room:current.room});
      }
      if(current.turn===current.mine && !current.dirty && !current.syncing){
        await pause(SLOW_MS);
        const result=await makeTestMove(page);
        if(result.moved){completed++;report('move_played',{room:current.room,ply:completed,...result});}
      }
      await pause(750);
    }
    report('stopped',{moves:completed,reason:completed>=MAX_MOVES?'move_limit':'time_limit_or_finished'});
  }finally{
    await context.close();
    await browser.close();
  }
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
