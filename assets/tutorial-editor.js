(function(){
'use strict';
const $=id=>document.getElementById(id);
const board=window.AbilityChessTutorialBoard;
const api=window.supabase?.createClient?.('https://cczvdpofddjghqoeiqew.supabase.co','sb_publishable_1j0iGD0GxwBdhac9suyPSw_5CPJGvaM',{auth:{storageKey:'abilityChessMemberSession',storage:window.localStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let lessons=[],selected=null,busy=false,dirty=false,pick='from',snapshot='';
const form=$('tutorialEditForm');
const ids=['tutorialOrder','tutorialTitle','tutorialBody','tutorialFen','tutorialFrom','tutorialTo'];
function status(message,error=false){const el=$('tutorialEditorStatus');el.textContent=message;el.classList.toggle('error',error);}
function setDirty(value){dirty=value;$('studioUnsaved').hidden=!value;window.onbeforeunload=value?()=>true:null;}
function read(){
 const title=$('tutorialTitle').value.trim(),body=$('tutorialBody').value.trim(),fen=$('tutorialFen').value.trim();
 const arrow_from=$('tutorialFrom').value.trim().toLowerCase()||null,arrow_to=$('tutorialTo').value.trim().toLowerCase()||null;
 const sort_order=Number($('tutorialOrder').value);
 if(!title||title.length>140||!body||body.length>3000)throw Error('Enter a title and an explanation (up to 3,000 characters).');
 if(!Number.isInteger(sort_order)||sort_order<1||sort_order>1000)throw Error('Choose a lesson order between 1 and 1000.');
 if((arrow_from&&!arrow_to)||(!arrow_from&&arrow_to))throw Error('Choose both arrow squares, or leave both blank.');
 if((arrow_from&&board.idx(arrow_from)<0)||(arrow_to&&board.idx(arrow_to)<0))throw Error('Use valid squares such as e2 and e4.');
 board.decode(fen);
 return {sort_order,title,body,board_fen:fen,arrow_from,arrow_to,updated_at:new Date().toISOString()};
}
function currentBoard(){return {board_fen:$('tutorialFen').value.trim()||board.initial,arrow_from:$('tutorialFrom').value.trim().toLowerCase(),arrow_to:$('tutorialTo').value.trim().toLowerCase()};}
function draw(){
 try{
  board.makeBoard($('tutorialEditorBoard'),currentBoard());
  $('tutorialBoardHelp').textContent=pick==='from'?'Click a board square to choose where the arrow begins.':'Click a board square to choose where the arrow ends.';
 }catch(error){$('tutorialBoardHelp').textContent='Board preview: '+error.message;}
 $('studioPreviewText').textContent=$('tutorialBody').value.trim()||'Your lesson explanation will appear here.';
}
function mode(value){
 pick=value;
 for(const key of ['from','to']){
  const el=$(key==='from'?'tutorialPickFrom':'tutorialPickTo');
  el.classList.toggle('active',value===key);el.setAttribute('aria-pressed',String(value===key));
 }
 $('tutorialBoardHelp').textContent=value==='from'?'Click a square to start the arrow.':'Click a square to finish the arrow.';
}
function list(){
 const host=$('tutorialLessonList');host.replaceChildren();
 if(!lessons.length){const msg=document.createElement('p');msg.className='studio-hint';msg.textContent='No lessons yet. Create the first one.';host.appendChild(msg);return;}
 for(const step of lessons){
  const button=document.createElement('button');button.type='button';button.className='studio-lesson';
  button.classList.toggle('selected',step.id===selected);
  const number=document.createElement('span');number.className='studio-lesson-number';number.textContent=String(step.sort_order).padStart(2,'0');
  const label=document.createElement('span');label.className='studio-lesson-name';label.textContent=step.title;
  button.append(number,label);button.addEventListener('click',()=>choose(step));host.appendChild(button);
 }
}
function choose(item,force=false){
 if(!force&&dirty&&!window.confirm('Discard unsaved changes to this lesson?'))return;
 selected=item?.id||null;
 $('tutorialOrder').value=item?.sort_order??(lessons.length+1);
 $('tutorialTitle').value=item?.title||'';
 $('tutorialBody').value=item?.body||'';
 $('tutorialFen').value=item?.board_fen||board.initial;
 $('tutorialFrom').value=item?.arrow_from||'';
 $('tutorialTo').value=item?.arrow_to||'';
 $('tutorialDelete').hidden=!selected;
 $('studioEditingTitle').textContent=item?'Edit lesson':'New lesson';
 snapshot=JSON.stringify(ids.map(id=>$(id).value));
 setDirty(false);list();mode('from');draw();
}
async function reload(id=selected){
 const {data,error}=await api.from('ability_chess_tutorial_steps').select('*').order('sort_order').order('id');
 if(error)throw error;
 lessons=data||[];choose(lessons.find(x=>x.id===id)||lessons[0]||null,true);
}
async function save(event){
 event.preventDefault();if(busy)return;
 let payload;try{payload=read();}catch(error){status(error.message,true);return;}
 busy=true;$('tutorialSave').disabled=true;status('Saving lesson…');
 try{
  const query=selected?api.from('ability_chess_tutorial_steps').update(payload).eq('id',selected):api.from('ability_chess_tutorial_steps').insert(payload);
  const {data:row,error}=await query.select('id').single();
  if(error)throw error;
  setDirty(false);await reload(row.id);status('Lesson saved. Your changes are now visible in the Tutorial.');
 }catch(error){status('Save failed: '+error.message,true);}
 finally{busy=false;$('tutorialSave').disabled=false;}
}
async function remove(){
 if(!selected||busy||!window.confirm('Permanently delete this lesson?'))return;
 busy=true;status('Deleting lesson…');
 try{
  const {error}=await api.from('ability_chess_tutorial_steps').delete().eq('id',selected);
  if(error)throw error;
  setDirty(false);selected=null;await reload(null);status('Lesson deleted.');
 }catch(error){status('Delete failed: '+error.message,true);}
 finally{busy=false;}
}
function changed(){
 setDirty(JSON.stringify(ids.map(id=>$(id).value))!==snapshot);
 draw();
}
async function begin(){
 if(!api){status('Authentication is unavailable.',true);return;}
 try{
  const {data,error}=await api.auth.getUser();
  if(error||!data?.user)throw Error('Sign in as an administrator to open Tutorial Studio.');
  const check=await api.rpc('ability_chess_is_admin',{p_user_id:data.user.id});
  if(check.error||check.data!==true)throw Error('Administrator access is required.');
  $('tutorialEditorApp').hidden=false;
  $('tutorialAdd').addEventListener('click',()=>{choose(null);status('New lesson — enter the content and select an arrow.');});
  $('tutorialPreview').addEventListener('click',()=>{draw();status('Board preview refreshed.');});
  $('tutorialResetBoard').addEventListener('click',()=>{$('tutorialFen').value=board.initial;changed();});
  $('tutorialClearArrow').addEventListener('click',()=>{$('tutorialFrom').value='';$('tutorialTo').value='';mode('from');changed();});
  $('tutorialPickFrom').addEventListener('click',()=>mode('from'));
  $('tutorialPickTo').addEventListener('click',()=>mode('to'));
  $('tutorialEditorBoard').addEventListener('click',event=>{
    const square=event.target.closest('.tutorial-square');
    if(!square)return;
    const grid=square.parentElement;
    const index=Array.prototype.indexOf.call(grid.children,square);
    if(index<0)return;
    const coord='abcdefgh'[index%8]+(8-Math.floor(index/8));
    $(pick==='from'?'tutorialFrom':'tutorialTo').value=coord;
    if(pick==='from')mode('to');else mode('from');
    changed();
  });
  ids.forEach(id=>$(id).addEventListener('input',changed));
  form.addEventListener('submit',save);
  $('tutorialDelete').addEventListener('click',remove);
  await reload();status('Tutorial Studio ready. Select a lesson to begin editing.');
 }catch(error){status(error.message||'Unable to open the editor.',true);}
}
begin();
})();