(function(){
'use strict';
const user=new URLSearchParams(location.search).get('user');
const $=id=>document.getElementById(id);
const status=$('profilePageStatus');
const client=window.supabase?.createClient?.('https://cczvdpofddjghqoeiqew.supabase.co','sb_publishable_1j0iGD0GxwBdhac9suyPSw_5CPJGvaM',{auth:{storageKey:'abilityChessMemberSession',storage:window.localStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const fmt=v=>Number(v||0).toLocaleString();
async function load(){
 if(!user||user.length>80){status.textContent='Select a player from the leaderboard.';return;}
 if(!client){status.textContent='Profiles are unavailable right now.';return;}
 try{
   const {data,error}=await client.rpc('ability_chess_profile_extras',{p_username:user});
   if(error)throw error;
   const p=Array.isArray(data)?data[0]:data;
   if(!p){status.textContent='Player not found.';return;}
   document.title=(p.display_name||p.username)+' · Ability Chess';
   $('profilePageTitle').textContent='Player profile';
   $('profilePageDisplay').textContent=p.display_name||p.username;
   $('profilePageHandle').textContent='@'+p.username;
   $('profilePageBio').textContent=p.bio||'No bio yet.';
   const avatar=$('profilePageAvatar');avatar.className='leader-avatar large';
   if(/^https:\/\//i.test(p.avatar_url||'')){
     const img=document.createElement('img');img.src=p.avatar_url;img.alt='';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>{img.remove();avatar.textContent=(p.display_name||p.username).slice(0,1).toUpperCase();},{once:true});avatar.appendChild(img);
   }else avatar.textContent=(p.display_name||p.username).slice(0,1).toUpperCase();
   const ratings=$('profilePageRatings');
   for(const [name,key] of [['Bullet','bullet_rating'],['Blitz','blitz_rating'],['Rapid','rapid_rating']]){
     const cell=document.createElement('div'),value=document.createElement('strong'),label=document.createElement('span');
     value.textContent=fmt(p[key]);label.textContent=name;cell.append(value,label);ratings.appendChild(cell);
   }
   const record=$('profilePageRecord');
   for(const [name,key] of [['Games','games_played'],['Wins','wins'],['Losses','losses'],['Draws','draws']]){
     const item=document.createElement('div'),label=document.createElement('span'),value=document.createElement('strong');
     label.textContent=name;value.textContent=fmt(p[key]);item.append(value,label);record.appendChild(item);
   }
   status.textContent='';$('profilePageContent').hidden=false;
 }catch(error){status.textContent='Unable to load the player profile.';console.warn('Profile load failed:',error);}
}
load();
})();