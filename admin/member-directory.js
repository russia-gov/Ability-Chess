/* Admin-only member directory. Access is enforced by Supabase RPCs, not this UI. */
(() => {
  'use strict';
  const url='https://cczvdpofddjghqoeiqew.supabase.co';
  const key='sb_publishable_1j0iGD0GxwBdhac9suyPSw_5CPJGvaM';
  const app=window.supabase?.createClient?.(url,key);
  const $=id=>document.getElementById(id);
  const state={page:0,perPage:25,search:'',status:'all',total:0,items:[],busy:false,me:null};
  const date=v=>v?new Date(v).toLocaleString():'—';
  const fmt=n=>Number(n||0).toLocaleString();
  function el(tag,cls,value){
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(value!==undefined)n.textContent=String(value);
    return n;
  }
  function status(message,isError=false){
    const node=$('directoryMessage');
    node.textContent=message||'';
    node.className=isError?'message error':'message';
  }
  async function rpc(name,args={}){
    const {data,error}=await app.rpc(name,args);
    if(error)throw new Error(error.message||'Request failed');
    return data;
  }
  function button(label,fn,cls){
    const n=el('button',cls||'subtle',label);
    n.type='button';n.addEventListener('click',fn);return n;
  }
  async function start(){
    if(!app){status('Supabase failed to load. Refresh this page.',true);return;}
    try{
      const {data,error}=await app.auth.getUser();
      if(error||!data?.user)throw new Error('Sign in on Ability-Chess first, then return to this page.');
      state.me=data.user.id;
      if(!await rpc('ability_chess_is_admin',{p_user_id:state.me}))throw new Error('This page is restricted to site administrators.');
      $('directoryControls').hidden=false;
      $('directoryHeader').hidden=false;
      $('directoryWelcome').hidden=true;
      await load();
    }catch(e){status(e.message,true);}
  }
  async function load(){
    if(state.busy)return;
    state.busy=true;$('directoryReload').disabled=true;status('Loading members…');
    try{
      const results=await rpc('ability_chess_admin_member_directory',{
        p_search:state.search,p_status:state.status,p_limit:state.perPage,p_offset:state.page*state.perPage
      });
      state.items=Array.isArray(results)?results:[];
      state.total=Number(state.items[0]?.total_count||0);
      render();
      status(state.items.length?'':'No members matched your filters.');
    }catch(e){status('Could not load members: '+e.message,true);}
    finally{state.busy=false;$('directoryReload').disabled=false;}
  }
  function render(){
    const list=$('memberTableBody');list.replaceChildren();
    for(const m of state.items){
      const tr=el('tr');
      const identity=el('td');
      const name=el('strong','',m.display_name||m.username);
      const handle=el('small','muted','@'+m.username);
      identity.append(name,handle);
      if(m.is_owner)identity.append(el('span','tag','Owner'));
      else if(m.is_staff)identity.append(el('span','tag','Staff'));
      tr.append(identity);
      tr.append(el('td','numeric',fmt(m.rapid_rating)));
      tr.append(el('td','numeric',fmt(m.games_played)));
      tr.append(el('td','muted',date(m.last_seen_at)));
      const stateCell=el('td');
      const suspended=m.suspended_until&&new Date(m.suspended_until)>new Date();
      const muted=m.muted_until&&new Date(m.muted_until)>new Date();
      stateCell.append(el('span',suspended?'tag warning':muted?'tag warning':'tag',suspended?'Suspended':muted?'Muted':'Active'));
      tr.append(stateCell);
      const actions=el('td');
      actions.append(button('Details',()=>details(m)));
      tr.append(actions);list.append(tr);
    }
    const start=state.total?state.page*state.perPage+1:0;
    const end=Math.min(state.total,(state.page+1)*state.perPage);
    $('directoryCount').textContent=state.total?start+'–'+end+' of '+state.total:'0 members';
    $('directoryPrev').disabled=state.page===0;
    $('directoryNext').disabled=end>=state.total;
  }
  function field(container,label,value){
    const wrap=el('div','detail-field');
    wrap.append(el('span','muted',label),el('strong','',value));
    container.append(wrap);
  }
  async function action(label,fn){
    if(!window.confirm(label))return;
    try{status('Applying action…');await fn();await load();status('Action completed.');$('memberDialog').close();}
    catch(e){status('Action failed: '+e.message,true);}
  }
  async function details(m){
    const dialog=$('memberDialog'),body=$('memberDetail');
    body.replaceChildren();
    body.append(el('h2','',m.display_name||m.username));
    body.append(el('p','muted','@'+m.username));
    const grid=el('div','detail-grid');
    for(const [label,value] of [
      ['Joined',date(m.created_at)],['Last active',date(m.last_seen_at)],
      ['Rapid',fmt(m.rapid_rating)],['Blitz',fmt(m.blitz_rating)],
      ['Bullet',fmt(m.bullet_rating)],['Games',fmt(m.games_played)],
      ['Wins',fmt(m.wins)],['Losses',fmt(m.losses)],['Draws',fmt(m.draws)]
    ])field(grid,label,value);
    body.append(grid);
    if(m.muted_until)body.append(el('p','muted','Mute expires: '+date(m.muted_until)));
    if(m.suspended_until)body.append(el('p','muted','Suspension expires: '+date(m.suspended_until)));
    const controls=el('div','action-row');
    const canModerate=!m.is_owner&&m.id!==state.me;
    if(canModerate){
      for(const [label,kind,hours] of [
        ['Mute 24h','mute',24],['Unmute','unmute',null],
        ['Suspend 24h','suspend',24],['Unsuspend','unsuspend',null]
      ]){
        controls.append(button(label,()=>action(label+' @'+m.username+'?',()=>rpc('ability_chess_admin_moderate_user',{
          p_user_id:m.id,p_action:kind,p_hours:hours,p_note:'Admin directory'
        })),kind==='suspend'?'danger':'subtle'));
      }
    }
    controls.append(button('Send notification',()=>notification(m)));
    controls.append(button('View game history',()=>history(m)));
    body.append(controls);
    dialog.showModal();
  }
  async function notification(m){
    const title=window.prompt('Notification title for @'+m.username+' (max 120 characters):');
    if(title===null||!title.trim())return;
    const message=window.prompt('Notification body (max 800 characters):');
    if(message===null||!message.trim())return;
    await action('Send notification to @'+m.username+'?',()=>rpc('ability_chess_admin_send_notification',{
      p_user_id:m.id,p_title:title.trim().slice(0,120),p_body:message.trim().slice(0,800),p_href:null
    }));
  }
  async function history(m){
    const dialog=$('historyDialog'),container=$('historyContent');container.replaceChildren();
    container.append(el('p','muted','Loading history for @'+m.username+'…'));
    dialog.showModal();
    try{
      const data=await rpc('ability_chess_owner_list_member_history',{p_user_id:m.id});
      container.replaceChildren();
      container.append(el('h2','', 'Game history: @'+m.username));
      if(!data?.length){container.append(el('p','muted','No games recorded.'));return;}
      const list=el('div','history-list');
      for(const g of data.slice(0,200)){
        const row=el('div','history-item');
        row.append(el('strong','',String(g.result||'Unrecorded')));
        row.append(el('span','', ' vs '+String(g.opponent_name||'Unknown')));
        row.append(el('small','muted', date(g.played_at)+' · '+String(g.mode||'')));
        list.append(row);
      }
      container.append(list);
    }catch(e){container.replaceChildren();container.append(el('p','error',e.message));}
  }
  let searchTimer;
  $('directorySearch').addEventListener('input',e=>{
    window.clearTimeout(searchTimer);searchTimer=window.setTimeout(()=>{
      state.search=e.target.value.trim().slice(0,80);state.page=0;load();
    },300);
  });
  $('directoryFilter').addEventListener('change',e=>{state.status=e.target.value;state.page=0;load();});
  $('directoryPrev').addEventListener('click',()=>{if(state.page>0){state.page--;load();}});
  $('directoryNext').addEventListener('click',()=>{if((state.page+1)*state.perPage<state.total){state.page++;load();}});
  $('directoryReload').addEventListener('click',load);
  $('closeMemberDialog').addEventListener('click',()=>$('memberDialog').close());
  $('closeHistoryDialog').addEventListener('click',()=>$('historyDialog').close());
  start();
})();