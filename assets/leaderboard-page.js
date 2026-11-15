(function(){
'use strict';
const status=document.getElementById('leaderStatus'),tbody=document.getElementById('leaderRows'),category=document.getElementById('leaderCategory');
const search=document.getElementById('leaderSearch'),dialog=document.getElementById('leaderPreview');
let members=[],userId=null,lastFocus=null;
const client=window.supabase?.createClient?.('https://cczvdpofddjghqoeiqew.supabase.co','sb_publishable_1j0iGD0GxwBdhac9suyPSw_5CPJGvaM',{auth:{storageKey:'abilityChessMemberSession',storage:window.localStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const number=x=>Number.isFinite(Number(x))?Number(x):0;
const avatar=(player,size='small')=>{
 const wrap=document.createElement('span');wrap.className='leader-avatar '+size;
 const url=String(player.avatar_url||'');
 if(/^https:\/\//i.test(url)){
   const img=document.createElement('img');img.src=url;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>{img.remove();wrap.textContent=(player.display_name||player.username||'?').slice(0,1).toUpperCase();},{once:true});wrap.appendChild(img);
 }else wrap.textContent=(player.display_name||player.username||'?').slice(0,1).toUpperCase();
 return wrap;
};
const cell=(tr,text,cls='')=>{const td=document.createElement('td');td.textContent=String(text);if(cls)td.className=cls;tr.appendChild(td);return td;};
const profileLink=p=>'./profile.html?user='+encodeURIComponent(p.username||'');
function openPreview(p){
 lastFocus=document.activeElement;
 const container=document.getElementById('leaderPreviewContent');container.replaceChildren();
 const head=document.createElement('div');head.className='leader-preview-head';head.appendChild(avatar(p,'large'));
 const info=document.createElement('div');
 const title=document.createElement('a');title.className='leader-preview-name';title.href=profileLink(p);title.textContent=p.display_name||p.username||'Player';info.appendChild(title);
 const handle=document.createElement('p');handle.className='leader-handle';handle.textContent='@'+(p.username||'unknown')+(p.id===userId?' · You':'');info.appendChild(handle);head.appendChild(info);container.appendChild(head);
 const stats=document.createElement('div');stats.className='leader-preview-stats';
 for(const [label,key] of [['Rapid','rapid_rating'],['Blitz','blitz_rating'],['Bullet','bullet_rating']]){
   const item=document.createElement('div');const strong=document.createElement('strong');strong.textContent=number(p[key]).toLocaleString();const labelEl=document.createElement('span');labelEl.textContent=label;item.append(strong,labelEl);stats.appendChild(item);
 }
 container.appendChild(stats);
 const bio=document.createElement('p');bio.className='leader-preview-bio';bio.textContent=p.bio||'No bio yet.';container.appendChild(bio);
 const details=document.createElement('p');details.className='leader-preview-summary';details.textContent=number(p.games_played)+' games · '+number(p.wins)+' wins · '+number(p.losses)+' losses · '+number(p.draws)+' draws';container.appendChild(details);
 const note=document.createElement('p');note.className='learning-note';note.textContent='Select the player name above to open the full profile.';container.appendChild(note);
 if(typeof dialog.showModal==='function')dialog.showModal();else dialog.hidden=false;
}
dialog.addEventListener('close',()=>lastFocus?.focus?.());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
document.getElementById('leaderPreviewClose').addEventListener('click',()=>dialog.close());
function render(){
 tbody.replaceChildren();
 const key=category.value,term=(search.value||'').trim().toLowerCase();
 const filtered=members.filter(p=>(p.display_name||'').toLowerCase().includes(term)||(p.username||'').toLowerCase().includes(term));
 const sorted=filtered.sort((a,b)=>number(b[key])-number(a[key])||String(a.username||'').localeCompare(String(b.username||'')));
 sorted.forEach((p,i)=>{
   const tr=document.createElement('tr');if(p.id===userId)tr.classList.add('leader-self-row');
   cell(tr,i+1,'leader-rank');
   const player= document.createElement('td'),identity=document.createElement('div');identity.className='leader-player';
   identity.appendChild(avatar(p));
   const block=document.createElement('div');block.className='leader-player-label';
   const button=document.createElement('button');button.type='button';button.className='leader-player-button';button.textContent=p.display_name||p.username||'Player';button.addEventListener('click',()=>openPreview(p));block.appendChild(button);
   const meta=document.createElement('span');meta.className='leader-handle';meta.textContent='@'+(p.username||'unknown')+(p.id===userId?' · You':'');block.appendChild(meta);
   identity.appendChild(block);player.appendChild(identity);tr.appendChild(player);
   cell(tr,number(p[key]).toLocaleString(),'leader-score');cell(tr,number(p.games_played),'leader-games');
   tbody.appendChild(tr);
 });
 status.textContent=sorted.length?sorted.length+' player'+(sorted.length===1?'':'s')+' shown':'No players match this search.';
}
category.addEventListener('change',load);
search.addEventListener('input',render);
async function load(){
 if(!client){status.textContent='Unable to load ratings.';return;}
 status.textContent='Loading rankings…';
 try{
   const {data:userInfo,error:userError}=await client.auth.getUser();
   if(userError||!userInfo?.user){status.textContent='Sign in to Ability Chess to view the leaderboard.';tbody.replaceChildren();return;}
   userId=userInfo.user.id;
   const key=category.value;
   const {data,error}=await client.from('ability_chess_profiles').select('id,username,display_name,avatar_url,bio,rating,bullet_rating,blitz_rating,rapid_rating,games_played,wins,losses,draws').order(key,{ascending:false,nullsFirst:false}).limit(100);
   if(error)throw error;
   members=data||[];render();
 }catch(error){status.textContent='Unable to load rankings. Please try again later.';console.warn('Leaderboard load failed',error);}
}
load();
})();