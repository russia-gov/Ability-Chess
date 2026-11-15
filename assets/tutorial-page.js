(function(){
'use strict';
const api=window.AbilityChessTutorialBoard;
const progress=document.getElementById('tutorialProgress'),heading=document.getElementById('tutorialHeading'),body=document.getElementById('tutorialText');
const prev=document.getElementById('tutorialBack'),next=document.getElementById('tutorialNext');
const board=document.getElementById('tutorialBoard'),toggle=document.getElementById('tutorialShowMove'),help=document.getElementById('tutorialBoardHelp'),status=document.getElementById('tutorialStatus');
let lessons=[],i=0,shown=false;
const client=window.supabase?.createClient?.('https://cczvdpofddjghqoeiqew.supabase.co','sb_publishable_1j0iGD0GxwBdhac9suyPSw_5CPJGvaM',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
function render(){
 if(!lessons.length)return;
 const step=lessons[i];shown=false;
 progress.textContent='Step '+(i+1)+' of '+lessons.length;
 heading.textContent=step.title;body.textContent=step.body;
 prev.disabled=i===0;next.textContent=i===lessons.length-1?'Start again':'Next step';
 toggle.disabled=!(step.arrow_from&&step.arrow_to);
 toggle.textContent='Show the move';
 help.textContent=toggle.disabled?'Study this board position.':'The gold arrow illustrates the move. Select Show the move to see the pieces after it.';
 try{api.makeBoard(board,step);}catch(error){board.textContent='Unable to display this board.';console.warn(error);}
}
prev.addEventListener('click',()=>{if(i>0){i--;render();}});
next.addEventListener('click',()=>{i=(i+1)%lessons.length;render();});
toggle.addEventListener('click',()=>{
 if(!lessons.length)return;
 shown=!shown;
 try{api.makeBoard(board,lessons[i],shown);toggle.textContent=shown?'Show arrow':'Show the move';help.textContent=shown?'Resulting position (for this annotated move).':'The gold arrow illustrates the move.';}catch(error){help.textContent=error.message;}
});
async function load(){
 if(!client){status.textContent='Unable to load the tutorial.';return;}
 const {data,error}=await client.from('ability_chess_tutorial_steps').select('id,sort_order,title,body,board_fen,arrow_from,arrow_to').order('sort_order',{ascending:true}).order('id');
 if(error){status.textContent='Unable to load tutorial lessons right now.';console.warn('Tutorial load failed',error);return;}
 lessons=Array.isArray(data)?data:[];
 status.textContent=lessons.length?'': 'No tutorial steps have been published yet.';
 if(lessons.length)render();
}
load();
})();