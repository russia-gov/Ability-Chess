(function(global){
'use strict';
const pieces={K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const initial='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
function decode(fen){
 const rows=String(fen||'').trim().split(' ')[0].split('/');
 if(rows.length!==8)throw Error('A FEN must have eight ranks.');
 const squares=[];
 for(const row of rows){let rank=[];
   for(const ch of row){if(/[1-8]/.test(ch))rank.push(...Array(Number(ch)).fill(''));else if(pieces[ch])rank.push(ch);else throw Error('FEN contains an invalid piece.');}
   if(rank.length!==8)throw Error('Each FEN rank must contain eight squares.');
   squares.push(...rank);
 }
 if(squares.filter(x=>x==='K').length!==1||squares.filter(x=>x==='k').length!==1)throw Error('A board needs both kings.');
 return squares;
}
function idx(square){if(!/^[a-h][1-8]$/.test(square||''))return -1;return (8-Number(square[1]))*8+square.charCodeAt(0)-97;}
function makeBoard(host,lesson,showMove=false){
 const squares=decode(lesson.board_fen||initial);
 const a=idx(lesson.arrow_from),b=idx(lesson.arrow_to);
 if(a<0!== (b<0))throw Error('An arrow needs both start and destination squares.');
 if(showMove&&a>=0&&b>=0){
   squares[b]=squares[a];squares[a]='';
   // Kingside or queenside castling shifts the rook too.
   if((squares[b]==='K'||squares[b]==='k')&&Math.abs((a%8)-(b%8))===2){
     const rank=Math.floor(a/8),right=b>a,from=rank*8+(right?7:0),to=rank*8+(right?5:3);
     squares[to]=squares[from];squares[from]='';
   }
 }
 const shell=document.createElement('div');shell.className='tutorial-board';
 const grid=document.createElement('div');grid.className='tutorial-board-squares';
 for(let j=0;j<64;j++){
   const cell=document.createElement('div');cell.className='tutorial-square '+(((Math.floor(j/8)+j%8)%2===0)?'light':'dark');
   if(!showMove&&(j===a||j===b))cell.classList.add(j===a?'arrow-start':'arrow-end');
   const piece=document.createElement('span');piece.className='tutorial-piece '+(squares[j]&&squares[j]===squares[j].toUpperCase()?'white':'black');
   piece.textContent=pieces[squares[j]]||'';cell.appendChild(piece);
   if(j%8===0){const coord=document.createElement('small');coord.className='tutorial-rank';coord.textContent=String(8-Math.floor(j/8));cell.appendChild(coord);}
   if(j>=56){const coord=document.createElement('small');coord.className='tutorial-file';coord.textContent=String.fromCharCode(97+j%8);cell.appendChild(coord);}
   grid.appendChild(cell);
 }
 shell.appendChild(grid);
 if(a>=0&&b>=0&&!showMove){
   const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
   svg.setAttribute('viewBox','0 0 800 800');svg.setAttribute('class','tutorial-board-arrows');svg.setAttribute('aria-hidden','true');
   const defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker');
   marker.setAttribute('id','tip-'+(Math.random().toString(36).slice(2)));marker.setAttribute('markerWidth','5');marker.setAttribute('markerHeight','5');marker.setAttribute('refX','4');marker.setAttribute('refY','2.5');marker.setAttribute('orient','auto');
   const head=document.createElementNS(ns,'path');head.setAttribute('d','M 0 0 L 5 2.5 L 0 5 z');head.setAttribute('fill','#e0ad46');marker.appendChild(head);defs.appendChild(marker);svg.appendChild(defs);
   const arrow=document.createElementNS(ns,'line');
   const x1=(a%8)*100+50,y1=Math.floor(a/8)*100+50,x2=(b%8)*100+50,y2=Math.floor(b/8)*100+50;
   const dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy)||1;
   arrow.setAttribute('x1',x1);arrow.setAttribute('y1',y1);arrow.setAttribute('x2',x2-dx/length*24);arrow.setAttribute('y2',y2-dy/length*24);
   arrow.setAttribute('stroke','#e0ad46');arrow.setAttribute('stroke-width','17');arrow.setAttribute('stroke-linecap','round');arrow.setAttribute('opacity','.88');arrow.setAttribute('marker-end','url(#'+marker.id+')');svg.appendChild(arrow);
   shell.appendChild(svg);
 }
 host.replaceChildren(shell);
}
global.AbilityChessTutorialBoard=Object.freeze({decode,makeBoard,initial,idx});
})(window);
