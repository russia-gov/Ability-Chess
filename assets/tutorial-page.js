(function(){
'use strict';
const steps=[
 {title:'Welcome to Ability Chess',body:'Ability Chess builds on familiar chess. You still use the chessboard and pieces, with abilities adding new decisions to each game.'},
 {title:'Explore the abilities',body:'Open the Abilities Guide to learn what each ability does. Check the game rules and ability details before starting your first match.'},
 {title:'Choose how to play',body:'From Play, choose Online to meet other players or Bots to practice. You can also explore tournaments and your game history from the same menu.'},
 {title:'Play, learn, and review',body:'Start a game, pay attention to the available ability actions, and use Analysis or Game History afterward to review your decisions.'}
];
let i=0;
const progress=document.getElementById('tutorialProgress'),heading=document.getElementById('tutorialHeading'),body=document.getElementById('tutorialText'),prev=document.getElementById('tutorialBack'),next=document.getElementById('tutorialNext');
function render(){const step=steps[i];progress.textContent='Step '+(i+1)+' of '+steps.length;heading.textContent=step.title;body.textContent=step.body;prev.disabled=i===0;next.textContent=i===steps.length-1?'Start again':'Next step';}
prev.addEventListener('click',()=>{if(i>0){i--;render();}});
next.addEventListener('click',()=>{i=(i+1)%steps.length;render();});
render();
})();
