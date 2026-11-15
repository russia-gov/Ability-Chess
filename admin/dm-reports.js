(() => {
'use strict';
const url='https://cczvdpofddjghqoeiqew.supabase.co';
const key='sb_publishable_1j0iGD0GxwBdhac9suyPSw_5CPJGvaM';
// DM review shares the same authenticated Supabase session as Ability-Chess.
const client=window.supabase?.createClient?.(url,key,{
  auth:{
    storageKey:'abilityChessMemberSession',
    storage:window.localStorage,
    detectSessionInUrl:false,
    persistSession:true,
    autoRefreshToken:true
  }
});
const $=id=>document.getElementById(id);
const status=(message,error=false)=>{$('status').textContent=message;$('status').className=error?'error':'';};
const el=(tag,value,cls='')=>{const x=document.createElement(tag);x.textContent=String(value||'');x.className=cls;return x;};
async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw Error(error.message);return data;}
let userId=null,role='member',reportId=null,reports=[];
async function boot(){
  if(!client){status('Could not load the secure sign-in library.',true);return;}
  try{
    const {data,error}=await client.auth.getUser();
    if(error||!data.user)throw Error('Sign in on the Ability-Chess homepage first.');
    userId=data.user.id;
    const isAdmin=await rpc('ability_chess_is_admin',{p_user_id:userId});
    if(isAdmin){role=await rpc('ability_chess_is_owner',{p_user_id:userId})?'owner':'staff';$('adminArea').hidden=false;}
    const adminFrame=location.hash==='#reports'&&isAdmin;
    $('memberArea').hidden=!!adminFrame;
    if(!adminFrame)await loadMine();
    if(isAdmin)await loadReports();
  }catch(e){status(e.message,true);}
}
async function loadMine(){
  const rows=await rpc('ability_chess_dm_my_recent',{p_limit:100});
  const list=$('messages');list.replaceChildren();
  if(!rows.length){list.append(el('p','No recent direct messages.'));return;}
  for(const m of rows){
    const row=el('div','','record');
    row.append(el('p','From @'+m.sender_username+' to @'+m.recipient_username+' · '+new Date(m.created_at).toLocaleString(),'meta'));
    row.append(el('p',m.body,'body'));
    const button=el('button','Report message');
    button.addEventListener('click',()=>submitReport(m.id));
    row.append(button);list.append(row);
  }
}
async function submitReport(messageId){
  const reason=prompt('Reason for reporting this message (3–80 characters):');
  if(reason===null)return;
  if(reason.trim().length<3||reason.trim().length>80){status('Please enter a reason between 3 and 80 characters.',true);return;}
  const details=prompt('Optional details (do not include passwords or other secrets):','');
  if(details===null)return;
  if(!confirm('Submit this message to Ability-Chess moderators for review?'))return;
  try{
    await rpc('ability_chess_dm_report_message',{p_message_id:messageId,p_reason:reason.trim(),p_details:details.slice(0,1500)});
    status('Report received. Only authorized moderators can review it.');
  }catch(e){status('Could not submit report: '+e.message,true);}
}
async function loadReports(){
  const filter=$('statusFilter').value;
  reports=await rpc('ability_chess_dm_admin_reports',{p_status:filter});
  const list=$('reports');list.replaceChildren();
  if(!reports.length){list.append(el('p','No reports in this category.'));return;}
  for(const r of reports){
    const item=el('div','','record');
    item.append(el('p','Report '+r.id+' · '+r.status,'meta'));
    item.append(el('strong',r.reason));
    item.append(el('p','Reported by @'+r.reporter_username+' · User @'+r.target_username,'meta'));
    if(r.details)item.append(el('p',r.details));
    item.append(el('p',new Date(r.created_at).toLocaleString(),'meta'));
    const b=el('button','Review report');
    b.addEventListener('click',()=>review(r.id,false));
    item.append(b);list.append(item);
  }
}
async function review(id,expanded){
  let reason='';
  if(expanded){
    reason=prompt('Document the necessity of expanded owner review (15+ characters):');
    if(reason===null)return;
    if(reason.trim().length<15){status('A justification of at least 15 characters is required.',true);return;}
  }
  try{
    const rows=await rpc('ability_chess_dm_admin_review',{p_report_id:id,p_expanded:expanded,p_reason:reason});
    reportId=id;
    $('reviewArea').hidden=false;
    $('reviewTitle').textContent=expanded?'Expanded conversation review (100 messages maximum)':'Limited reported-message context';
    const list=$('context');list.replaceChildren();
    if(!rows.length)list.append(el('p','No messages found.'));
    for(const m of rows){
      const item=el('div','',m.is_reported?'record reported':'record');
      item.append(el('p','@'+m.sender_username+' → @'+m.recipient_username+' · '+new Date(m.created_at).toLocaleString(),'meta'));
      item.append(el('p',m.body,'body'));
      if(m.is_reported)item.append(el('strong','Reported message'));
      list.append(item);
    }
    $('expand').hidden=role!=='owner';
    $('audit').hidden=role!=='owner';
    $('reviewArea').scrollIntoView({behavior:'smooth'});
    status('Review access has been recorded in the moderation audit log.');
  }catch(e){status('Review failed: '+e.message,true);}
}
async function resolve(next){
  if(!reportId)return;
  if(!confirm('Mark this DM report as '+next+'?'))return;
  try{
    await rpc('ability_chess_dm_admin_resolve',{p_report_id:reportId,p_status:next});
    $('reviewArea').hidden=true;reportId=null;
    await loadReports();status('Report updated and action logged.');
  }catch(e){status('Could not update report: '+e.message,true);}
}
async function audit(){
  if(role!=='owner')return;
  try{
    const rows=await rpc('ability_chess_dm_owner_access_log',{p_report_id:reportId});
    const list=$('auditEntries');list.replaceChildren();
    if(!rows.length)list.append(el('p','No audit entries.'));
    for(const a of rows){
      const item=el('p',new Date(a.created_at).toLocaleString()+' · @'+a.admin_username+' · '+a.access_type+' · '+a.reason,'meta');
      list.append(item);
    }
  }catch(e){status('Could not load access audit: '+e.message,true);}
}
$('refreshMessages').addEventListener('click',()=>loadMine().catch(e=>status(e.message,true)));
$('refreshReports').addEventListener('click',()=>loadReports().catch(e=>status(e.message,true)));
$('statusFilter').addEventListener('change',()=>loadReports().catch(e=>status(e.message,true)));
$('expand').addEventListener('click',()=>review(reportId,true));
$('resolve').addEventListener('click',()=>resolve('resolved'));
$('dismiss').addEventListener('click',()=>resolve('dismissed'));
$('audit').addEventListener('click',audit);
boot();
})();