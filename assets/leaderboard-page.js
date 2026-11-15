(function(){
'use strict';
const status=document.getElementById('leaderStatus'),tbody=document.getElementById('leaderRows'),category=document.getElementById('leaderCategory');
let members=[];
function textCell(row,value){const cell=document.createElement('td');cell.textContent=String(value);row.appendChild(cell);return cell;}
function render(){
 tbody.replaceChildren();
 const key=category.value;
 const sorted=[...members].sort((a,b)=>(Number(b[key])||0)-(Number(a[key])||0)||String(a.username||'').localeCompare(String(b.username||'')));
 sorted.forEach((player,i)=>{
   const tr=document.createElement('tr');
   textCell(tr,i+1);
   const name=textCell(tr,player.display_name||player.username||'Player');
   if(player.self)name.appendChild(document.createTextNode(' (you)'));
   textCell(tr,Number(player[key])||0);
   textCell(tr,Number(player.games_played)||0);
   tbody.appendChild(tr);
 });
 status.textContent=sorted.length?sorted.length+' player'+(sorted.length===1?'':'s')+' shown':'No players available.';
}
category.addEventListener('change',render);
async function load(){
 if(!window.supabase?.createClient){status.textContent='Ratings cannot load right now. Please try again later.';return;}
 const client=window.supabase.createClient('https://cczvdpofddjghqoeiqew.supabase.co','sb_publishable_1j0iGD0GxwBdhac9suyPSw_5CPJGvaM',{auth:{storageKey:'abilityChessMemberSession',storage:window.localStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 try{
   const {data:userInfo,error:userError}=await client.auth.getUser();
   if(userError||!userInfo?.user){status.textContent='Sign in to Ability Chess to view the leaderboard.';return;}
   const [others,mine]=await Promise.all([client.rpc('ability_chess_list_members_v2',{p_search:''}),client.rpc('ability_chess_get_my_profile_v2')]);
   if(others.error)throw others.error;
   members=Array.isArray(others.data)?others.data.slice():[];
   const myProfile=Array.isArray(mine.data)?mine.data[0]:mine.data;
   if(!mine.error&&myProfile?.id&&!members.some(p=>p.id===myProfile.id))members.push({...myProfile,self:true});
   render();
 }catch(err){status.textContent='Unable to load rankings. Please try again later.';console.warn('Leaderboard unavailable:',err);}
}
load();
})();
