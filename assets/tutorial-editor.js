(function(){
'use strict';
const $=id=>document.getElementById(id);
const board=window.AbilityChessTutorialBoard;
const api=window.supabase?.createClient?.('https://cczvdpofddjghqoeiqew.supabase.co','sb_publishable_1j0iGD0GxwBdhac9suyPSw_5CPJGvaM',{auth:{storageKey:'abilityChessMemberSession',storage:window.localStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let lessons=[],selected=null,busy=false;
function status(message,error=false){$('tutorialEditorStatus').textContent=message;$('tutorialEditorStatus').classList.toggle('error',error);}
function data(){
 const title=$('tutorialTitle').value.trim(),body=$('tutorialBody').value.trim(),fen=$('tutorialFen').value.trim();
 const arrow_from=$('tutorialFrom').value.trim().toLowerCase()||null,arrow_to=$('tutorialTo').value.trim().toLowerCase()||null;
 const sort_order=Number($('tutorialOrder').value);
 if(!title||title.length>140||!body||body.length>3000)throw Error('Enter a title and explanation.');
 if(!Number.isInteger(sort_order)||sort_order<1||sort_order>1000)throw Error('Order must be between 1 and 1000.');
 if((arrow_from&&!arrow_to)||(!arrow_from&&arrow_to))throw Error('Set both arrow squares, or neither.');
 if((arrow_from&&board.idx(arrow_from)<0)||(arrow_to&&board.idx(arrow_to)<0))throw Error('Arrow squares must be like e2 and e4.');
 board.decode(fen);
 return {sort_order,title,body,board_fen:fen,arrow_from,arrow_to,updated_at:new Date().toISOString()};
}
function preview(){try{board.makeBoard($('tutorialEditorBoard'),data());status('Board preview updated. Save when ready.');}catch(error){status(error.message,true);}}
function choose(item){
 selected=item?.id||null;
 $('tutorialOrder').value=item?.sort_order??(lessons.length+1);
 $('tutorialTitle').value=item?.title||'';
 $('tutorialBody').value=item?.body||'';
 $('tutorialFen').value=item?.board_fen||board.initial;
 $('tutorialFrom').value=item?.arrow_from||'';
 $('tutorialTo').value=item?.arrow_to||'';
 $('tutorialDelete').hidden=!selected;
 list();
 try{board.makeBoard($('tutorialEditorBoard'),item||{board_fen:board.initial});}catch(error){status(error.message,true);}
}
function list(){
 const host=$('tutorialLessonList');host.replaceChildren();
 if(!lessons.length)host.textContent='No lessons yet.';
 for(const step of lessons){
   const button=document.createElement('button');button.type='button';button.classList.toggle('selected',selected===step.id);
   button.textContent=step.sort_order+'. '+step.title;button.addEventListener('click',()=>choose(step));host.appendChild(button);
 }
}
async function reload(id=selected){
 const {data,error}=await api.from('ability_chess_tutorial_steps').select('*').order('sort_order').order('id');
 if(error)throw error;lessons=data||[];choose(lessons.find(x=>x.id===id)||lessons[0]||null);
}
async function save(e){
 e.preventDefault();if(busy)return;
 let payload;try{payload=data();}catch(error){status(error.message,true);return;}
 busy=true;status('Saving lesson…');
 try{
   const query=selected?api.from('ability_chess_tutorial_steps').update(payload).eq('id',selected):api.from('ability_chess_tutorial_steps').insert(payload);
   const {data:result,error}=await query.select('id').single();
   if(error)throw error;
   await reload(result.id);status('Lesson saved. Changes are live on the tutorial page.');
 }catch(error){status('Save failed: '+error.message,true);}
 finally{busy=false;}
}
async function remove(){
 if(!selected||busy||!confirm('Delete this tutorial lesson permanently?'))return;
 busy=true;status('Deleting lesson…');
 try{
   const {error}=await api.from('ability_chess_tutorial_steps').delete().eq('id',selected);
   if(error)throw error;selected=null;await reload(null);status('Lesson deleted.');
 }catch(error){status('Deletion failed: '+error.message,true);}
 finally{busy=false;}
}
async function begin(){
 if(!api){status('Authentication is unavailable.',true);return;}
 try{
   const {data,error}=await api.auth.getUser();
   if(error||!data?.user)throw Error('Sign in as an administrator first.');
   // Display gate only; database RLS independently enforces permissions.
   const check=await api.rpc('ability_chess_is_admin',{p_user_id:data.user.id});
   if(check.error||check.data!==true)throw Error('Administrator access is required.');
   $('tutorialEditorApp').hidden=false;
   $('tutorialAdd').addEventListener('click',()=>{choose(null);status('New lesson. Fill the form and save.');});
   $('tutorialPreview').addEventListener('click',preview);
   $('tutorialEditForm').addEventListener('submit',save);
   $('tutorialDelete').addEventListener('click',remove);
   await reload();status('Ready to edit lessons.');
 }catch(error){status(error.message||'Administrator access is unavailable.',true);}
}
begin();
})();