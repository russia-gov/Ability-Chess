// AUTOMATICALLY GENERATED: node scripts/build_verified_edge_module.js
// Never modify this bundled module by hand.
const factories=Object.create(null);
factories["./generated/board-rules.js"] = function(module,require){
'use strict';
// GENERATED from the existing browser game by scripts/extract_board_rules.js.
// This module only validates/applies individual board moves, NOT whole turns,
// paid abilities, rating results, or online security.
  const ABILITIES = [
    { id:'shield', name:'Shield', cost:3, desc:'Protect one of your pieces from ordinary capture until the beginning of your next turn.' },
    { id:'freeze', name:'Freeze', cost:3, desc:'Choose an enemy non-king piece. It cannot move during its owner’s next turn.' },
    { id:'bomb', name:'Bomb', cost:4, desc:'Destroy every piece in a 3×3 zone, including the initiating piece. Neither king may be in the blast.' },
    { id:'swap', name:'Swap', cost:4, desc:'Choose two of your non-king pieces and exchange their squares, provided your king remains safe.' },
    { id:'recall', name:'Recall', cost:4, desc:'Return your most recently moved non-king piece to its previous square, if that square is empty.' },
    { id:'ambush', name:'Ambush', cost:4, desc:'Trap one of your non-king pieces. If captured before your next turn, the capturing piece is destroyed too.' },
    { id:'teleport', name:'Teleport', cost:4, consumesMove:true, desc:'Move one non-king piece instantly to an empty square. Pawns may teleport only from their own half to another square on their own half. Teleport counts as your move and ends your turn. It cannot expose your king or immediately attack the enemy king.' },
    { id:'reinforce', name:'Reinforce', cost:5, desc:'Promote one pawn that has crossed the halfway line immediately to a knight or bishop.' },
    { id:'portal', name:'Portal', cost:5, desc:'Choose two empty squares. The pair lasts for three of your turns, including this one. Any piece from either side entering either portal exits from the other if the exit is empty. Both directions work. You still make a normal move after placing it.' },
    { id:'fortify', name:'Fortify', cost:4, desc:'Choose a 2×2 area containing your king. Enemy abilities cannot affect your pieces in that area until your next turn.' },
    { id:'double', name:'Double Move', cost:6, consumesMove:true, desc:'Make two normal chess moves this turn. If you begin in check, the first move may leave your king in check as long as the second move resolves it. Neither move may capture the opposing king.' }
  ];


  const UPGRADES=[
    {id:'vanguard',name:'Vanguard',type:'p',cost:4,rule:'Pawns may move one square diagonally forward into an empty square without capturing.',restrictions:'Cannot capture; normal forward direction applies.'},
    {id:'reverse_gear',name:'Reverse Gear',type:'p',cost:4,rule:'Pawns may move one square directly backward into an empty square.',restrictions:'Cannot capture or move two squares backward; promotion direction is unchanged.'},
    {id:'veteran',name:'Veteran',type:'p',cost:6,rule:'Pawns may move one empty square and capture diagonally in either forward direction.',restrictions:'Two-square movement and en passant remain only in the original forward direction; promotion rank is unchanged.'},
    {id:'lancer',name:'Lancer',type:'n',cost:5,rule:'Knights may additionally move or capture one square diagonally.',restrictions:'Standard knight movement remains unchanged.'},
    {id:'charger',name:'Charger',type:'n',cost:6,rule:'Knights may additionally move or capture one square in the owner’s normal forward direction.',restrictions:'This is one move, not an extra step.'},
    {id:'cardinal',name:'Cardinal',type:'b',cost:6,rule:'Bishops may additionally move or capture one square orthogonally.',restrictions:'Normal diagonal movement remains unchanged.'},
    {id:'color_shift',name:'Color Shift',type:'b',cost:5,rule:'Bishops may additionally move exactly one square orthogonally into an empty square.',restrictions:'This movement cannot capture.'},
    {id:'archbishop',name:'Archbishop',type:'b',cost:8,rule:'Bishops may additionally move and capture like knights.',restrictions:'Normal diagonal movement remains unchanged.'},
    {id:'bastion',name:'Bastion',type:'r',cost:6,rule:'Rooks may pass through exactly one friendly piece on a normal rook line and then move to an empty square or capture an enemy piece beyond it.',restrictions:'Cannot jump an enemy or pass more than one piece.'},
    {id:'turret',name:'Turret',type:'r',cost:6,rule:'Rooks may additionally move or capture one square diagonally.',restrictions:'Normal rook movement remains unchanged.'},
    {id:'chancellor',name:'Chancellor',type:'r',cost:9,rule:'Rooks may additionally move and capture like knights.',restrictions:'Normal orthogonal movement remains unchanged.'},
    {id:'phase_step',name:'Phase Step',type:'q',cost:7,rule:'Queens may pass through exactly one friendly piece on a normal queen line and then move to an empty square or capture an enemy piece beyond it.',restrictions:'Cannot jump an enemy or pass more than one piece.'},
    {id:'royal_step',name:'Royal Step',type:'k',cost:7,rule:'The king may additionally move and capture like a knight.',restrictions:'The destination must be safe; this is not castling.'},
    {id:'escape_route',name:'Escape Route',type:'k',cost:6,rule:'The king may additionally move exactly two squares horizontally, vertically, or diagonally.',restrictions:'Cannot begin in attack; the empty intermediate square and destination must be safe; this is not castling.'}
  ];
  function ensureUpgradeState(state){
    if(!state.upgrades) state.upgrades={w:{},b:{}};
    if(!state.upgrades.w) state.upgrades.w={};
    if(!state.upgrades.b) state.upgrades.b={};
    return state.upgrades;
  }
  function upgradeFor(state,color,type){ return ensureUpgradeState(state)[color]?.[type]||null; }
  function upgradeDefinition(id){ return UPGRADES.find(u=>u.id===id)||null; }
  function upgradeCount(state,color){ return Object.keys(ensureUpgradeState(state)[color]||{}).length; }

  function cloneState(state){
    const safe=state||{};
    return {
      board:(safe.board||makeInitialBoard()).map(r=>r.slice()),
      turn:safe.turn||'w',
      shielded:{w:safe.shielded?.w?{...safe.shielded.w}:null,b:safe.shielded?.b?{...safe.shielded.b}:null},
      points:{w:Number(safe.points?.w||0),b:Number(safe.points?.b||0)},
      upgrades:{w:{...(safe.upgrades?.w||{})},b:{...(safe.upgrades?.b||{})}},
      upgradeLimit:Number(safe.upgradeLimit??3),
      abilitiesEnabled:safe.abilitiesEnabled!==false,
      upgradesEnabled:safe.upgradesEnabled!==false,
      startingPoints:Number(safe.startingPoints||0),
      castlingRights:{w:{...(safe.castlingRights?.w||{k:false,q:false})},b:{...(safe.castlingRights?.b||{k:false,q:false})}},
      enPassant:safe.enPassant?{...safe.enPassant}:null,
      frozen:{w:safe.frozen?.w?{...safe.frozen.w}:null,b:safe.frozen?.b?{...safe.frozen.b}:null},
      ambushed:{w:safe.ambushed?.w?{...safe.ambushed.w}:null,b:safe.ambushed?.b?{...safe.ambushed.b}:null},
      fortified:{w:safe.fortified?.w?{squares:(safe.fortified.w.squares||[]).map(x=>({...x}))}:null,b:safe.fortified?.b?{squares:(safe.fortified.b.squares||[]).map(x=>({...x}))}:null},
      portals:{w:safe.portals?.w?{a:{...safe.portals.w.a},b:{...safe.portals.w.b},turnsRemaining:Number(safe.portals.w.turnsRemaining??1)}:null,b:safe.portals?.b?{a:{...safe.portals.b.a},b:{...safe.portals.b.b},turnsRemaining:Number(safe.portals.b.turnsRemaining??1)}:null},
      lastMoveByColor:{w:safe.lastMoveByColor?.w?JSON.parse(JSON.stringify(safe.lastMoveByColor.w)):null,b:safe.lastMoveByColor?.b?JSON.parse(JSON.stringify(safe.lastMoveByColor.b)):null},
      lastMove:safe.lastMove?JSON.parse(JSON.stringify(safe.lastMove)):null,
      activeAbility:safe.activeAbility||null,
      awaitingAbilityTarget:!!safe.awaitingAbilityTarget,
      abilitySelection:safe.abilitySelection?JSON.parse(JSON.stringify(safe.abilitySelection)):null,
      abilityUsed:!!safe.abilityUsed,
      movesRemaining:Number(safe.movesRemaining??1),
      doubleMoveActive:!!safe.doubleMoveActive,
      halfmoveClock:Number(safe.halfmoveClock||0),
      positionCounts:{...(safe.positionCounts||{})},
      log:Array.isArray(safe.log)?safe.log.slice():[],
      over:!!safe.over,
      winner:safe.winner??null,
      resultReason:safe.resultReason||'',
      resultDetail:safe.resultDetail||'',
      lastMessage:safe.lastMessage||'',
      clocks:safe.clocks?{w:Number(safe.clocks.w||0),b:Number(safe.clocks.b||0)}:null,
      initialTime:Number(safe.initialTime||0),
      increment:Number(safe.increment||0),
      move:safe.move?JSON.parse(JSON.stringify(safe.move)):null
    };
  }

  function inBounds(r,c){ return r>=0 && r<8 && c>=0 && c<8; }
  function other(color){ return color==='w' ? 'b' : 'w'; }
  function algebraic(r,c){ return 'abcdefgh'[c] + (8-r); }
  function parseSq(s){ return { c:'abcdefgh'.indexOf(s[0]), r:8-Number(s[1]) }; }

  function pieceAt(board,r,c){ return inBounds(r,c) ? board[r][c] : null; }
  function colorOf(piece){ return piece ? piece[0] : null; }
  function typeOf(piece){ return piece ? piece[1] : null; }
  function isPromotionRank(color, r){ return (color==='w' && r===0) || (color==='b' && r===7); }

  function isShieldedAgainstCapture(state, r, c, byColor){
    const target = state.shielded[other(byColor)];
    return !!target && target.r === r && target.c === c;
  }

  function pseudoMoves(state, r, c, forAttack=false){
    ensureUpgradeState(state);
    const piece=pieceAt(state.board,r,c); if(!piece) return [];
    const color=colorOf(piece), type=typeOf(piece), up=upgradeFor(state,color,type), dir=color==='w'?-1:1;
    const moves=[], seen=new Set();
    const addMove=(move)=>{ if(!inBounds(move.to.r,move.to.c)) return; const key=`${move.to.r},${move.to.c}:${move.castle||''}:${move.enPassant?'e':''}`; if(seen.has(key)) return; seen.add(key); if(type==='p' && isPromotionRank(color, move.to.r)) move.promotionRequired=true; moves.push(move); };
    const addStep=(dr,dc,{emptyOnly=false,captureOnly=false,tag=null}={})=>{ const rr=r+dr,cc=c+dc;if(!inBounds(rr,cc))return;const tgt=pieceAt(state.board,rr,cc);if(emptyOnly&&tgt)return;if(captureOnly&&!tgt)return;if(tgt&&colorOf(tgt)===color)return;addMove({from:{r,c},to:{r:rr,c:cc},capture:!!tgt,upgradeMove:tag}); };
    const addSlide=(dirs)=>{ for(const[dr,dc]of dirs){let rr=r+dr,cc=c+dc;while(inBounds(rr,cc)){const tgt=pieceAt(state.board,rr,cc);if(!tgt)addMove({from:{r,c},to:{r:rr,c:cc}});else{if(colorOf(tgt)!==color)addMove({from:{r,c},to:{r:rr,c:cc},capture:true});break;}rr+=dr;cc+=dc;} } };
    const addFriendlyJumpSlide=(dirs,tag)=>{ for(const[dr,dc]of dirs){let rr=r+dr,cc=c+dc,passed=false;while(inBounds(rr,cc)){const tgt=pieceAt(state.board,rr,cc);if(!passed){if(!tgt){rr+=dr;cc+=dc;continue;}if(colorOf(tgt)!==color)break;passed=true;rr+=dr;cc+=dc;continue;}if(!tgt){addMove({from:{r,c},to:{r:rr,c:cc},upgradeMove:tag,jumpedFriendly:true});rr+=dr;cc+=dc;continue;}// Jump moves cannot capture; an enemy piece blocks further jump destinations.
        break;} } };
    const knightSteps=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    if(type==='p'){
      const attackDirs=up==='veteran'?[dir,-dir]:[dir];
      if(forAttack){ for(const d of attackDirs) for(const dc of[-1,1]) addStep(d,dc,{tag:up==='veteran'?'veteran':null}); }
      else{
        const one=r+dir;if(inBounds(one,c)&&!pieceAt(state.board,one,c)){addMove({from:{r,c},to:{r:one,c}});const start=color==='w'?6:1,two=r+dir*2;if(r===start&&!pieceAt(state.board,two,c))addMove({from:{r,c},to:{r:two,c},doublePawn:true});}
        for(const dc of[-1,1]){const rr=r+dir,cc=c+dc;if(!inBounds(rr,cc))continue;const tgt=pieceAt(state.board,rr,cc);if(tgt&&colorOf(tgt)!==color)addMove({from:{r,c},to:{r:rr,c:cc},capture:true});const ep=state.enPassant;if(!tgt&&ep&&ep.r===rr&&ep.c===cc&&ep.color===other(color)&&pieceAt(state.board,ep.pawnR,ep.pawnC)===other(color)+'p')addMove({from:{r,c},to:{r:rr,c:cc},capture:true,enPassant:true,capturedAt:{r:ep.pawnR,c:ep.pawnC}});}
        if(up==='vanguard')for(const dc of[-1,1])addStep(dir,dc,{emptyOnly:true,tag:'vanguard'});
        if(up==='reverse_gear')addStep(-dir,0,{emptyOnly:true,tag:'reverse_gear'});
        if(up==='veteran'){addStep(-dir,0,{emptyOnly:true,tag:'veteran'});for(const dc of[-1,1]){const rr=r-dir,cc=c+dc,tgt=pieceAt(state.board,rr,cc);if(tgt&&colorOf(tgt)!==color)addMove({from:{r,c},to:{r:rr,c:cc},capture:true,upgradeMove:'veteran'});}}
      }
    }else if(type==='n'){
      for(const[d1,d2]of knightSteps)addStep(d1,d2);
      if(up==='lancer')for(const dr of[-1,1])for(const dc of[-1,1])addStep(dr,dc,{tag:'lancer'});
      if(up==='charger')addStep(dir,0,{tag:'charger'});
    }else if(type==='b'){
      addSlide([[-1,-1],[-1,1],[1,-1],[1,1]]);
      if(up==='cardinal')for(const[d1,d2]of[[-1,0],[1,0],[0,-1],[0,1]])addStep(d1,d2,{tag:'cardinal'});
      if(up==='color_shift'&&!forAttack)for(const[d1,d2]of[[-1,0],[1,0],[0,-1],[0,1]])addStep(d1,d2,{emptyOnly:true,tag:'color_shift'});
      if(up==='archbishop')for(const[d1,d2]of knightSteps)addStep(d1,d2,{tag:'archbishop'});
    }else if(type==='r'){
      const dirs=[[-1,0],[1,0],[0,-1],[0,1]];addSlide(dirs);
      if(up==='bastion')addFriendlyJumpSlide(dirs,'bastion');
      if(up==='turret')for(const dr of[-1,1])for(const dc of[-1,1])addStep(dr,dc,{tag:'turret'});
      if(up==='chancellor')for(const[d1,d2]of knightSteps)addStep(d1,d2,{tag:'chancellor'});
    }else if(type==='q'){
      const dirs=[[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];addSlide(dirs);if(up==='phase_step')addFriendlyJumpSlide(dirs,'phase_step');
    }else if(type==='k'){
      for(const dr of[-1,0,1])for(const dc of[-1,0,1])if(dr||dc)addStep(dr,dc);
      if(up==='royal_step')for(const[d1,d2]of knightSteps)addStep(d1,d2,{tag:'royal_step'});
      if(up==='escape_route'){
        for(const dr of[-1,0,1])for(const dc of[-1,0,1])if(dr||dc){const mr=r+dr,mc=c+dc,rr=r+2*dr,cc=c+2*dc;if(!inBounds(rr,cc)||pieceAt(state.board,mr,mc))continue;const tgt=pieceAt(state.board,rr,cc);if(tgt&&colorOf(tgt)===color)continue;if(forAttack)addMove({from:{r,c},to:{r:rr,c:cc},capture:!!tgt,upgradeMove:'escape_route'});else if(!inCheck(state,color)&&!isSquareAttacked(state,mr,mc,other(color))&&!isSquareAttacked(state,rr,cc,other(color)))addMove({from:{r,c},to:{r:rr,c:cc},capture:!!tgt,upgradeMove:'escape_route'});}
      }
      if(!forAttack){const home=color==='w'?7:0,rights=state.castlingRights?.[color]||{};if(r===home&&c===4&&!inCheck(state,color)){if(rights.k&&pieceAt(state.board,home,7)===color+'r'&&!pieceAt(state.board,home,5)&&!pieceAt(state.board,home,6)&&!isSquareAttacked(state,home,5,other(color))&&!isSquareAttacked(state,home,6,other(color)))addMove({from:{r,c},to:{r:home,c:6},castle:'k'});if(rights.q&&pieceAt(state.board,home,0)===color+'r'&&!pieceAt(state.board,home,1)&&!pieceAt(state.board,home,2)&&!pieceAt(state.board,home,3)&&!isSquareAttacked(state,home,3,other(color))&&!isSquareAttacked(state,home,2,other(color)))addMove({from:{r,c},to:{r:home,c:2},castle:'q'});}}
    }
    return moves;
  }

  function findKing(state, color){
    for(let r=0;r<8;r++) for(let c=0;c<8;c++) if (state.board[r][c]===color+'k') return {r,c};
    return null;
  }

  function isSquareAttacked(state, r, c, byColor){
    for(let rr=0;rr<8;rr++){
      for(let cc=0;cc<8;cc++){
        const p = state.board[rr][cc];
        if (!p || colorOf(p)!==byColor) continue;
        if(isFrozenPiece(state,rr,cc,byColor)) continue;
        const moves = pseudoMoves(state, rr, cc, true);
        if (moves.some(m => m.to.r===r && m.to.c===c)) return true;
      }
    }
    return false;
  }

  function inCheck(state, color){
    const k = findKing(state, color);
    if (!k) return true;
    return isSquareAttacked(state, k.r, k.c, other(color));
  }

  function revokeCastlingRights(state, piece, from, captured=null, capturedAt=null){
    if (!state.castlingRights) return;
    const color = colorOf(piece);
    if (typeOf(piece)==='k') state.castlingRights[color] = {k:false,q:false};
    if (typeOf(piece)==='r') {
      const homeRow = color==='w' ? 7 : 0;
      if (from.r===homeRow && from.c===0) state.castlingRights[color].q=false;
      if (from.r===homeRow && from.c===7) state.castlingRights[color].k=false;
    }
    if (captured && typeOf(captured)==='r' && capturedAt) {
      const capturedColor=colorOf(captured), homeRow=capturedColor==='w'?7:0;
      if (capturedAt.r===homeRow && capturedAt.c===0) state.castlingRights[capturedColor].q=false;
      if (capturedAt.r===homeRow && capturedAt.c===7) state.castlingRights[capturedColor].k=false;
    }
  }

  function sameSquare(a,b){ return !!a && !!b && a.r===b.r && a.c===b.c; }
  function squareInFortify(state,color,r,c){ return !!state.fortified?.[color]?.squares?.some(s=>s.r===r&&s.c===c); }
  function isFortifiedAgainstAbility(state,r,c,byColor){ return squareInFortify(state,other(byColor),r,c); }
  function isFrozenPiece(state,r,c,color){ const f=state.frozen?.[color]; return !!f&&f.r===r&&f.c===c; }
  function portalExit(state,color,to){
    // Either player may use either active portal pair, in either direction.
    // `color` is retained in the signature for compatibility with bot-worker code.
    for(const owner of ['w','b']){
      const pair=state.portals?.[owner];
      if(!pair || Number(pair.turnsRemaining ?? 1)<=0) continue;
      if(sameSquare(pair.a,to)) return {...pair.b, portalOwner:owner};
      if(sameSquare(pair.b,to)) return {...pair.a, portalOwner:owner};
    }
    return null;
  }

  function applyMoveToState(state, move){
    const s = cloneState(state);
    const piece = s.board[move.from.r][move.from.c];
    if (!piece) return null;
    if (isFrozenPiece(s, move.from.r, move.from.c, colorOf(piece))) return null;
    const capturedAt = move.enPassant ? (move.capturedAt || {r:move.from.r,c:move.to.c}) : {r:move.to.r,c:move.to.c};
    const captured = s.board[capturedAt.r][capturedAt.c];
    if (captured && isShieldedAgainstCapture(s, capturedAt.r, capturedAt.c, colorOf(piece))) return null;

    revokeCastlingRights(s, piece, move.from, captured, capturedAt);
    s.board[move.to.r][move.to.c] = piece;
    s.board[move.from.r][move.from.c] = null;
    if (move.enPassant) s.board[capturedAt.r][capturedAt.c] = null;

    const capturedColor=captured?colorOf(captured):null;
    const ambushTriggered=!!(capturedColor && s.ambushed?.[capturedColor] && sameSquare(s.ambushed[capturedColor],capturedAt));
    if (ambushTriggered) { s.board[move.to.r][move.to.c]=null; s.ambushed[capturedColor]=null; }

    if (move.castle) {
      const rookFromC = move.castle==='k' ? 7 : 0;
      const rookToC = move.castle==='k' ? 5 : 3;
      s.board[move.to.r][rookToC] = s.board[move.to.r][rookFromC];
      s.board[move.to.r][rookFromC] = null;
    }

    if (piece[1] === 'p' && s.board[move.to.r][move.to.c] === piece && isPromotionRank(piece[0], move.to.r)) {
      const promotion = ['q','r','b','n'].includes(move.promotion) ? move.promotion : 'q';
      s.board[move.to.r][move.to.c] = piece[0] + promotion;
    }

    // A shield protects a stationary piece only. Moving that piece consumes the shield.
    if (s.shielded[colorOf(piece)]?.r===move.from.r && s.shielded[colorOf(piece)]?.c===move.from.c) {
      s.shielded[colorOf(piece)]=null;
    }
    // Castling also moves the rook; a shielded rook loses its shield.
    if (move.castle) {
      const rookFromC = move.castle==='k' ? 7 : 0;
      if (s.shielded[colorOf(piece)]?.r===move.from.r && s.shielded[colorOf(piece)]?.c===rookFromC) {
        s.shielded[colorOf(piece)]=null;
      }
    }
    if (s.ambushed[colorOf(piece)]?.r===move.from.r && s.ambushed[colorOf(piece)]?.c===move.from.c) {
      s.ambushed[colorOf(piece)]={r:move.to.r,c:move.to.c};
    }

    const exit=portalExit(s,colorOf(piece),move.to);
    if(exit && !s.board[exit.r][exit.c] && s.board[move.to.r][move.to.c]){
      s.board[exit.r][exit.c]=s.board[move.to.r][move.to.c]; s.board[move.to.r][move.to.c]=null;
      if(s.ambushed[colorOf(piece)]?.r===move.to.r&&s.ambushed[colorOf(piece)]?.c===move.to.c) s.ambushed[colorOf(piece)]={...exit};
      move.portalExit={...exit};
    }
    s.enPassant = null;
    if (piece[1]==='p' && Math.abs(move.to.r-move.from.r)===2) {
      s.enPassant={r:(move.from.r+move.to.r)/2,c:move.from.c,pawnR:move.to.r,pawnC:move.to.c,color:colorOf(piece)};
    }
    return s;
  }

  function legalMovesFor(state, r, c){
    const piece = pieceAt(state.board, r, c);
    if (!piece || colorOf(piece)!==state.turn) return [];
    return pseudoMoves(state, r, c, false).filter(m => {
      // Double Move may reposition pieces and make ordinary captures, but it
      // cannot be the action that captures the opposing king on either move.
      const capturedAt = m.enPassant ? (m.capturedAt || {r:m.from.r,c:m.to.c}) : m.to;
      const target = pieceAt(state.board, capturedAt.r, capturedAt.c);
      if (state.doubleMoveActive && target && typeOf(target)==='k') return false;
      const next = applyMoveToState(state, m);
      if (!next) return false;
      const firstDoubleMoveWhileChecked = !!(state.doubleMoveActive && Number(state.movesRemaining)===2 && inCheck(state,state.turn));
      if (firstDoubleMoveWhileChecked) {
        next.turn=state.turn;
        next.doubleMoveActive=true;
        next.movesRemaining=1;
        // The first action may leave the king attacked, but only when at least
        // one legal second action completes the sequence and resolves check.
        return allLegalMoves(next,state.turn).length>0;
      }
      return !inCheck(next, state.turn);
    });
  }

  function allLegalMoves(state, color=state.turn){
    const temp = { ...state, turn: color };
    const out = [];
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const p = temp.board[r][c];
      if (p && colorOf(p)===color) out.push(...legalMovesFor(temp,r,c));
    }
    return out;
  }

  function addPoints(color, piece){
    if (!piece) return;
    game.points[color] += VALUES[typeOf(piece)] || 0;
  }


  function isInsufficientMaterial(state){
    const pieces=[];
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const p=state.board[r][c];
      if(p && typeOf(p)!=='k') pieces.push({p,r,c,type:typeOf(p)});
    }
    // A surviving movement-upgraded king or minor piece may have mating
    // potential beyond ordinary chess. Captured upgraded types have no effect.
    if(state.upgradesEnabled!==false){
      for(const color of ['w','b'])if(upgradeFor(state,color,'k'))return false;
      if(pieces.some(x=>upgradeFor(state,colorOf(x.p),x.type)))return false;
    }
    if(pieces.length===0) return true;
    if(pieces.some(x=>['p','r','q'].includes(x.type))) return false;
    if(pieces.length===1 && ['b','n'].includes(pieces[0].type)) return true;
    if(pieces.every(x=>x.type==='b')){
      const colors=new Set(pieces.map(x=>(x.r+x.c)%2));
      return colors.size===1;
    }
    return false;
  }

  function positionKey(state){
    const upgrades=JSON.stringify(state.upgrades||{});
    const statuses=JSON.stringify({shielded:state.shielded,frozen:state.frozen,ambushed:state.ambushed,fortified:state.fortified,portals:state.portals});
    return `${state.board.map(r=>r.map(x=>x||'--').join('')).join('/')}|${state.turn}|${JSON.stringify(state.castlingRights||{})}|${JSON.stringify(state.enPassant||null)}|${upgrades}|${statuses}`;
  }

  function recordPosition(state){
    state.positionCounts=state.positionCounts||{};
    const key=positionKey(state);
    // Status checks may run more than once for the same unchanged position.
    // Only a newly reached position counts toward threefold repetition.
    if(state.lastRecordedPositionKey===key) return state.positionCounts[key]||1;
    state.lastRecordedPositionKey=key;
    state.positionCounts[key]=(state.positionCounts[key]||0)+1;
    return state.positionCounts[key];
  }


  function pawnOnOwnSide(color,r){ return color==='w' ? r>=4 : r<=3; }
  function teleportPawnRestriction(piece,from,to){
    if(typeOf(piece)!=='p') return null;
    const color=colorOf(piece);
    if(!pawnOnOwnSide(color,from.r)) return 'Pawns can only teleport while they are on their own side of the board.';
    if(!pawnOnOwnSide(color,to.r)) return 'Pawns can only teleport to another square on their own side of the board.';
    return null;
  }

  function teleportWouldAttackEnemyKing(state, from, to){
    const temp = cloneState(state);
    const movingPiece = temp.board[from.r][from.c];
    if (!movingPiece || typeOf(movingPiece)==='k' || temp.board[to.r][to.c]) return false;
    temp.board[to.r][to.c] = movingPiece;
    temp.board[from.r][from.c] = null;
    const enemyKing = findKing(temp, other(colorOf(movingPiece)));
    if (!enemyKing) return false;
    return pseudoMoves(temp, to.r, to.c, true).some(move => move.to.r===enemyKing.r && move.to.c===enemyKing.c);
  }


  function findImmediateAbilityEscapeAction(state,color){
    if(!state || state.abilitiesEnabled===false || state.abilityUsed) return null;
    const points=Number(state.points?.[color]||0), enemy=other(color);
    const affordable=id=>{const d=ABILITIES.find(a=>a.id===id);return !!d&&points>=d.cost;};
    const followMove=t=>{t.turn=color;const moves=allLegalMoves(t,color);return moves[0]||null;};

    // Double Move: the first move may leave the king attacked only when an
    // actual legal second move completes the sequence and resolves check.
    if(affordable('double')){
      const probe=cloneState(state);probe.turn=color;probe.doubleMoveActive=true;probe.movesRemaining=2;
      const firsts=allLegalMoves(probe,color);
      for(const first of firsts){
        const next=applyMoveToState(probe,{...first});if(!next)continue;
        next.turn=color;next.doubleMoveActive=true;next.movesRemaining=1;
        const seconds=allLegalMoves(next,color);
        if(seconds.length)return {type:'double',first,second:seconds[0]};
      }
    }

    // Freeze can remove the attack of a non-king checker.
    if(affordable('freeze')){
      for(let r=0;r<8;r++)for(let c=0;c<8;c++){
        const piece=pieceAt(state.board,r,c);
        if(!piece||colorOf(piece)!==enemy||typeOf(piece)==='k'||isFortifiedAgainstAbility(state,r,c,color))continue;
        const t=cloneState(state);t.turn=color;t.frozen=t.frozen||{w:null,b:null};t.frozen[enemy]={r,c};
        if(inCheck(t,color))continue;
        const move=followMove(t);if(move)return {type:'freeze',r,c,move};
      }
    }

    // Bomb may destroy a checking piece or open an escape square.
    if(affordable('bomb')){
      for(let r=0;r<8;r++)for(let c=0;c<8;c++){
        const center=pieceAt(state.board,r,c);if(!center||colorOf(center)!==color)continue;
        let kingInBlast=false,fortified=false;
        for(let rr=r-1;rr<=r+1;rr++)for(let cc=c-1;cc<=c+1;cc++)if(inBounds(rr,cc)){
          const q=pieceAt(state.board,rr,cc);if(q&&typeOf(q)==='k')kingInBlast=true;
          if(q&&isFortifiedAgainstAbility(state,rr,cc,color))fortified=true;
        }
        if(kingInBlast||fortified)continue;
        const t=cloneState(state);t.turn=color;
        for(let rr=r-1;rr<=r+1;rr++)for(let cc=c-1;cc<=c+1;cc++)if(inBounds(rr,cc))t.board[rr][cc]=null;
        if(inCheck(t,color))continue;
        const move=followMove(t);if(move)return {type:'bomb',r,c,move};
      }
    }

    // Swap can interpose a piece or move the king's attacker/blocker geometry.
    if(affordable('swap')){
      const own=[];
      for(let r=0;r<8;r++)for(let c=0;c<8;c++){
        const piece=pieceAt(state.board,r,c);if(piece&&colorOf(piece)===color&&typeOf(piece)!=='k')own.push({r,c});
      }
      for(let i=0;i<own.length;i++)for(let j=i+1;j<own.length;j++){
        const a=own[i],b=own[j],t=cloneState(state);t.turn=color;
        [t.board[a.r][a.c],t.board[b.r][b.c]]=[t.board[b.r][b.c],t.board[a.r][a.c]];
        if(inCheck(t,color))continue;
        const move=followMove(t);if(move)return {type:'swap',a,b,move};
      }
    }

    // Recall may restore a piece to a blocking square.
    if(affordable('recall')){
      const m=state.lastMoveByColor?.[color];
      if(m&&typeOf(m.piece)!=='k'){
        const current=pieceAt(state.board,m.to.r,m.to.c);
        if(current===m.resultPiece&&!pieceAt(state.board,m.from.r,m.from.c)){
          const t=cloneState(state);t.turn=color;t.board[m.from.r][m.from.c]=current;t.board[m.to.r][m.to.c]=null;
          if(!inCheck(t,color)){const move=followMove(t);if(move)return {type:'recall',move};}
        }
      }
    }

    // Reinforce may create a new blocking/capturing move.
    if(affordable('reinforce')){
      for(let r=0;r<8;r++)for(let c=0;c<8;c++){
        const p=pieceAt(state.board,r,c);const crossed=p&&p===color+'p'&&((color==='w'&&r<=3)||(color==='b'&&r>=4));
        if(!crossed)continue;
        for(const promoteTo of ['n','b']){
          const t=cloneState(state);t.turn=color;t.board[r][c]=color+promoteTo;
          if(inCheck(t,color))continue;
          const move=followMove(t);if(move)return {type:'reinforce',r,c,promoteTo,move};
        }
      }
    }

    // Teleport consumes the move, so the resulting position itself must be safe.
    if(affordable('teleport')){
      for(let r=0;r<8;r++)for(let c=0;c<8;c++){
        const p=pieceAt(state.board,r,c);if(!p||colorOf(p)!==color||typeOf(p)==='k'||isFrozenPiece(state,r,c,color))continue;
        const from={r,c};if(typeOf(p)==='p'&&!pawnOnOwnSide(color,r))continue;
        for(let rr=0;rr<8;rr++)for(let cc=0;cc<8;cc++){
          const to={r:rr,c:cc};if(pieceAt(state.board,rr,cc)||isFortifiedAgainstAbility(state,rr,cc,color))continue;
          if(teleportPawnRestriction(p,from,to)||teleportWouldAttackEnemyKing(state,from,to))continue;
          const t=cloneState(state);t.turn=color;t.board[rr][cc]=p;t.board[r][c]=null;
          if(!inCheck(t,color))return {type:'teleport',from,to};
        }
      }
    }
    return null;
  }

  function abilityCanProduceLegalContinuation(state,color){
    return !!findImmediateAbilityEscapeAction(state,color);
  }

  function hasAnyTurnAction(state,color){
    return allLegalMoves(state,color).length>0 || abilityCanProduceLegalContinuation(state,color);
  }


module.exports={cloneState,inBounds,other,algebraic,parseSq,pieceAt,colorOf,typeOf,isPromotionRank,upgradeFor,upgradeDefinition,upgradeCount,pseudoMoves,findKing,isSquareAttacked,inCheck,revokeCastlingRights,sameSquare,squareInFortify,isFortifiedAgainstAbility,isFrozenPiece,portalExit,applyMoveToState,legalMovesFor,allLegalMoves,isInsufficientMaterial,positionKey,recordPosition,findImmediateAbilityEscapeAction,abilityCanProduceLegalContinuation,hasAnyTurnAction};

};
factories["./game-state-schema.js"] = function(module,require){
'use strict';

// Structural validation ONLY. This does not establish that a position was reached
// by legal moves or abilities. The future trusted action reducer must apply that
// stronger check before accepting any game state.
const PIECE = /^(w|b)[pnbrqk]$/;
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const isSquare = x => isObject(x) && Number.isInteger(x.r) && Number.isInteger(x.c)
  && x.r >= 0 && x.r < 8 && x.c >= 0 && x.c < 8;

function validateGameStateStructure(state) {
  const errors = [];
  if (!isObject(state)) return ['Game state must be an object'];
  if (!Array.isArray(state.board) || state.board.length !== 8) {
    errors.push('Board must contain eight ranks');
  } else {
    const kings = {w:0,b:0};
    for (let r=0;r<8;r++) {
      if (!Array.isArray(state.board[r]) || state.board[r].length !== 8) {
        errors.push('Invalid rank '+r);
        continue;
      }
      for (let c=0;c<8;c++) {
        const piece=state.board[r][c];
        if (piece==null) continue;
        if (typeof piece !== 'string' || !PIECE.test(piece)) {
          errors.push('Invalid piece on '+r+','+c);
          continue;
        }
        if (piece[1]==='k') kings[piece[0]]++;
      }
    }
    for (const color of ['w','b']) {
      if (kings[color]>1 || (!state.over && kings[color]!==1))
        errors.push('Invalid '+color+' king count');
    }
  }
  if (!['w','b'].includes(state.turn)) errors.push('Invalid turn');
  if (typeof state.over !== 'boolean') errors.push('Invalid game-over flag');
  if (state.winner !== undefined && state.winner !== null
      && !['w','b'].includes(state.winner)) errors.push('Invalid winner');
  if (!isObject(state.points)) errors.push('Missing ability points');
  else for(const color of ['w','b'])
    if (!Number.isSafeInteger(state.points[color]) || state.points[color]<0)
      errors.push('Invalid '+color+' ability points');
  if (!isObject(state.upgrades) || !isObject(state.upgrades.w)
      || !isObject(state.upgrades.b)) errors.push('Invalid upgrade inventory');
  if (!Number.isInteger(state.movesRemaining) || state.movesRemaining<0
      || state.movesRemaining>2) errors.push('Invalid moves remaining');
  for(const field of ['abilityUsed','doubleMoveActive'])
    if (typeof state[field] !== 'boolean') errors.push('Invalid '+field);
  for(const field of ['abilitiesEnabled','upgradesEnabled'])
    if (field in state && typeof state[field] !== 'boolean')
      errors.push('Invalid '+field);
  if (state.enPassant !== undefined && state.enPassant !== null
      && (!isSquare(state.enPassant)
        || !Number.isInteger(state.enPassant.pawnR)
        || !Number.isInteger(state.enPassant.pawnC)))
    errors.push('Invalid en passant state');
  return errors;
}

module.exports = { validateGameStateStructure };

};
factories["./board-move-intent.js"] = function(module,require){
'use strict';
/**
 * Canonicalize a client move intent against the exact browser game's legal
 * board-move generator. Client flags (capture, en passant, castle, portal
 * routing, upgradeMove) are NOT trusted and are reconstructed here.
 *
 * This is a building block, NOT the complete server game reducer: it does not
 * award capture points, apply turn expiry, decide game results or authorize a
 * room seat. Never accept its result as a complete online turn.
 */
const rules=require('./generated/board-rules.js');
const {validateGameStateStructure}=require('./game-state-schema.js');
const isObject=x=>x!==null && typeof x==='object' && !Array.isArray(x);
const validSquare=x=>isObject(x)&&Number.isInteger(x.r)&&x.r>=0&&x.r<8
  &&Number.isInteger(x.c)&&x.c>=0&&x.c<8;
const PROMOTIONS=new Set(['q','r','b','n']);
function resolveLegalBoardMove(state,intent){
 const issues=validateGameStateStructure(state);
 if(issues.length)throw new Error('Invalid game state: '+issues.join('; '));
 if(state.over)throw new Error('Game already finished');
 if(state.movesRemaining<=0)throw new Error('No board moves remaining');
 if(state.awaitingAbilityTarget||state.activeAbility)
   throw new Error('Finish selecting the ability before moving');
 if(!isObject(intent)||intent.type!=='move'
     ||!validSquare(intent.from)||!validSquare(intent.to))
   throw new Error('Invalid board move request');
 // Do not trust any extra request fields that purport to decide move effects.
 if(Object.keys(intent).some(k=>!['type','from','to','promotion'].includes(k)))
   throw new Error('Untrusted move metadata');
 if(Object.keys(intent.from).some(k=>!['r','c'].includes(k))
   ||Object.keys(intent.to).some(k=>!['r','c'].includes(k)))
   throw new Error('Untrusted square metadata');
 const piece=rules.pieceAt(state.board,intent.from.r,intent.from.c);
 if(!piece||rules.colorOf(piece)!==state.turn)
   throw new Error('Not a piece belonging to the side to move');
 const moves=rules.legalMovesFor(state,intent.from.r,intent.from.c);
 const canonical=moves.find(m=>m.to.r===intent.to.r&&m.to.c===intent.to.c);
 if(!canonical)throw new Error('Illegal board move');
 const promotionNeeded=piece[1]==='p'
   &&rules.isPromotionRank(piece[0],intent.to.r);
 const p=intent.promotion;
 if(promotionNeeded && !PROMOTIONS.has(p))
   throw new Error('An explicit promotion choice is required');
 if(!promotionNeeded && p!==undefined)
   throw new Error('Promotion not allowed on this move');
 return {...canonical,...(promotionNeeded?{promotion:p}:{})};
}
function applyLegalBoardMoveGeometry(state,intent){
 const move=resolveLegalBoardMove(state,intent);
 const result=rules.applyMoveToState(state,{...move});
 if(!result)throw new Error('Legal move unexpectedly rejected by rules core');
 return {move,boardState:result};
}
module.exports={resolveLegalBoardMove,applyLegalBoardMoveGeometry};

};
factories["./ability-intent.js"] = function(module,require){
'use strict';
// Single ability effect validation, extracted behavior from the current browser.
// This intentionally does NOT finalize a turn or accept clients as authoritative.
const R=require('./generated/board-rules.js');
const sq=x=>x&&Number.isInteger(x.r)&&Number.isInteger(x.c)&&R.inBounds(x.r,x.c);
const eq=(a,b)=>!!a&&!!b&&a.r===b.r&&a.c===b.c;
const piece=(s,x)=>R.pieceAt(s.board,x.r,x.c);
const demand=(condition,message)=>{if(!condition)throw new Error(message)};
const costs=Object.freeze({teleport:4,bomb:4,shield:3,freeze:3,swap:4,recall:4,reinforce:5,portal:5,ambush:4,fortify:4,double:6});
const values={p:1,n:3,b:3,r:5,q:9,k:0};
function applyAbilityIntent(state,intent){
 demand(state&&state.board&&['w','b'].includes(state.turn),'Invalid game state');
 demand(intent&&typeof intent==='object'&&!Array.isArray(intent),'Invalid intent');
 const id=intent.id,cost=costs[id],who=state.turn;
 demand(cost!==undefined,'Unknown ability');
 demand(state.abilitiesEnabled!==false,'Abilities disabled');
 demand(!state.over&&!state.abilityUsed&&!state.activeAbility&&!state.awaitingAbilityTarget,'Ability unavailable');
 demand(Number.isSafeInteger(state.points?.[who])&&state.points[who]>=cost,'Insufficient points');
 demand(state.movesRemaining>0,'Turn already complete');
 const s=R.cloneState(state),from=intent.from,to=intent.to,target=intent.target;
 const ensure=x=>demand(sq(x),'Invalid square');
 const isOwn=x=>piece(s,x)?.[0]===who;
 const isEnemy=x=>piece(s,x)&&piece(s,x)[0]!==who;
 const commit=()=>{s.points[who]-=cost;s.abilityUsed=true;s.activeAbility=null;s.awaitingAbilityTarget=false;s.abilitySelection=null;};
 switch(id){
  case 'double':
   demand(s.movesRemaining===1&&!s.doubleMoveActive,'Double Move must precede the move');
   s.movesRemaining=2;s.doubleMoveActive=true;commit();break;
  case 'shield':case 'ambush':
   ensure(target);demand(isOwn(target),'Target must be friendly');
   if(id==='ambush')demand(piece(s,target)[1]!=='k','Cannot ambush king');
   s[id==='shield'?'shielded':'ambushed'][who]={...target};
   commit();break;
  case 'freeze':
   ensure(target);
   demand(isEnemy(target)&&piece(s,target)[1]!=='k','Requires enemy non-king');
   demand(!R.isFortifiedAgainstAbility(s,target.r,target.c,who),'Fortify protected');
   s.frozen[R.other(who)]={...target};commit();break;
  case 'reinforce':
   ensure(target);
   demand(piece(s,target)===who+'p'&&(who==='w'?target.r<=3:target.r>=4),'Pawn not eligible');
   demand(['n','b'].includes(intent.promoteTo),'Must choose knight or bishop');
   s.board[target.r][target.c]=who+intent.promoteTo;
   demand(R.allLegalMoves(s,who).length>0,'No legal follow-up move');
   commit();break;
  case 'swap':
   ensure(from);ensure(to);
   demand(!eq(from,to)&&isOwn(from)&&isOwn(to)
     &&piece(s,from)[1]!=='k'&&piece(s,to)[1]!=='k','Invalid swap');
   [s.board[from.r][from.c],s.board[to.r][to.c]]
     =[s.board[to.r][to.c],s.board[from.r][from.c]];
   demand(!R.inCheck(s,who),'Swap leaves king in check');
   if(eq(s.shielded[who],from)||eq(s.shielded[who],to))s.shielded[who]=null;
   if(eq(s.ambushed[who],from))s.ambushed[who]={...to};
   else if(eq(s.ambushed[who],to))s.ambushed[who]={...from};
   commit();break;
  case 'recall':{
   const m=s.lastMoveByColor?.[who];
   demand(m&&m.piece?.[1]!=='k','No eligible recall');
   ensure(m.from);ensure(m.to);
   demand(piece(s,m.to)===m.resultPiece&&!piece(s,m.from),'Recall piece missing or start occupied');
   s.board[m.from.r][m.from.c]=piece(s,m.to);s.board[m.to.r][m.to.c]=null;
   demand(!R.inCheck(s,who),'Recall leaves king in check');
   if(eq(s.shielded[who],m.to))s.shielded[who]=null;
   commit();break;
  }
  case 'portal':
   ensure(from);ensure(to);
   demand(!eq(from,to)&&!piece(s,from)&&!piece(s,to),'Portals require distinct empty squares');
   demand(!R.isFortifiedAgainstAbility(s,from.r,from.c,who)
     &&!R.isFortifiedAgainstAbility(s,to.r,to.c,who),'Fortify protected');
   s.portals[who]={a:{...from},b:{...to},turnsRemaining:3};commit();break;
  case 'fortify':{
   ensure(target);const king=R.findKing(s,who);
   demand(king,'Missing king');
   const candidates=[];
   for(const top of [target.r-1,target.r])for(const left of [target.c-1,target.c]){
    const area=[{r:top,c:left},{r:top,c:left+1},{r:top+1,c:left},{r:top+1,c:left+1}];
    if(area.every(sq)&&area.some(x=>eq(x,king)))candidates.push(area);
   }
   demand(candidates.length>0,'Area must contain king');
   s.fortified[who]={squares:candidates[0]};commit();break;
  }
  case 'teleport':{
   ensure(from);ensure(to);const moving=piece(s,from);
   demand(moving&&moving[0]===who&&moving[1]!=='k','Teleport requires friendly non-king');
   demand(!piece(s,to),'Teleport destination occupied');
   demand(!R.isFortifiedAgainstAbility(s,to.r,to.c,who),'Fortify protected');
   if(moving[1]==='p')demand(who==='w'?(from.r>=4&&to.r>=4):(from.r<=3&&to.r<=3),'Pawn teleport restricted');
   const trial=R.cloneState(s);
   trial.board[to.r][to.c]=moving;trial.board[from.r][from.c]=null;
   const king=R.findKing(trial,R.other(who));
   demand(!king||!R.pseudoMoves(trial,to.r,to.c,true).some(x=>eq(x.to,king)),
     'Teleport cannot immediately attack opposing king');
   R.revokeCastlingRights(s,moving,from);
   s.board[to.r][to.c]=moving;s.board[from.r][from.c]=null;
   if(eq(s.shielded[who],from))s.shielded[who]=null;
   demand(!R.inCheck(s,who),'Teleport leaves king in check');
   // Match existing client behavior: teleport does not clear en passant state.
   s.lastMove={from:{...from},to:{...to}};
   s.movesRemaining=0;commit();break;
  }
  case 'bomb':{
   ensure(target);demand(isOwn(target),'Bomb center must be friendly');
   let gains=0;
   for(let r=target.r-1;r<=target.r+1;r++)for(let c=target.c-1;c<=target.c+1;c++){
    if(!R.inBounds(r,c))continue;
    const p=s.board[r][c];
    demand(!p||p[1]!=='k','Cannot bomb king');
    demand(!p||!R.isFortifiedAgainstAbility(s,r,c,who),'Fortify protected');
   }
   for(let r=target.r-1;r<=target.r+1;r++)for(let c=target.c-1;c<=target.c+1;c++){
    if(!R.inBounds(r,c))continue;const p=s.board[r][c];if(!p)continue;
    if(p[0]!==who)gains+=values[p[1]];
    R.revokeCastlingRights(s,p,{r,c});s.board[r][c]=null;
   }
   demand(!R.inCheck(s,who),'Bomb leaves king in check');
   commit();s.points[who]+=gains;break;
  }
  default:throw new Error('Unsupported ability');
 }
 demand(s.points[who]>=0,'Negative ability points');
 return s;
}
module.exports={costs,applyAbilityIntent};

};
factories["./upgrade-intent.js"] = function(module,require){
'use strict';
/**
 * Pure, server-side Upgrade purchase. Does not accept any replacement board,
 * number of points, price, or upgrade definition from the client.
 * An upgrade purchase consumes the mover's turn; a trusted turn transition
 * must run before the state may be persisted.
 */
const R=require('./generated/board-rules.js');
function applyUpgradeIntent(state,intent){
 if(!state||!state.board||!['w','b'].includes(state.turn))
  throw new Error('Invalid game state');
 if(!intent||intent.type!=='upgrade'||typeof intent.id!=='string')
  throw new Error('Invalid upgrade intent');
 if(Object.keys(intent).some(k=>!['type','id','replaceType'].includes(k)))
  throw new Error('Untrusted upgrade metadata');
 if(state.over||state.upgradesEnabled===false||state.abilityUsed||
    state.awaitingAbilityTarget||state.activeAbility||state.movesRemaining<=0)
  throw new Error('Upgrade unavailable this turn');
 const def=R.upgradeDefinition(intent.id);
 if(!def)throw new Error('Unknown upgrade');
 const who=state.turn,owned=state.upgrades?.[who]||{};
 const count=Object.keys(owned).length;
 const limit=Number(state.upgradeLimit??3);
 if(!Number.isInteger(limit)||limit<=0||limit>20)
  throw new Error('Invalid upgrade slot count');
 if(owned[def.type]===def.id)throw new Error('Upgrade already owned');
 if(!Number.isSafeInteger(state.points?.[who])||state.points[who]<def.cost)
  throw new Error('Not enough points');
 const candidates=owned[def.type]?[def.type]:
   count>=limit?Object.keys(owned):[];
 if(candidates.length){
  if(!candidates.includes(intent.replaceType))
   throw new Error('Must select a valid owned upgrade to replace');
 }else if(intent.replaceType!=null){
  throw new Error('Unnecessary upgrade replacement');
 }
 const s=R.cloneState(state);
 if(intent.replaceType)delete s.upgrades[who][intent.replaceType];
 s.upgrades[who][def.type]=def.id;
 s.points[who]-=def.cost;
 return {state:s,endsTurn:true,upgradeId:def.id,spent:def.cost};
}
module.exports={applyUpgradeIntent};

};
factories["./turn-reducer.js"] = function(module,require){
'use strict';
/**
 * Deterministic AbilityChess game transition from trusted persisted state and
 * one typed action. No RPC, user IDs, clock elapsed, or browser objects here.
 *
 * This reducer must only be called after authenticated seat/turn checks and
 * must be committed with an expected-version guard in the same RPC workflow.
 * Timer expiration and draw agreement must be handled by the trusted handler.
 */
const R=require('./generated/board-rules.js');
const {applyLegalBoardMoveGeometry}=require('./board-move-intent.js');
const {applyAbilityIntent}=require('./ability-intent.js');
const {applyUpgradeIntent}=require('./upgrade-intent.js');
const {validateGameStateStructure}=require('./game-state-schema.js');
const VALUES={p:1,n:3,b:3,r:5,q:9,k:0};
const requireLegal=(v,msg)=>{if(!v)throw new Error(msg)};
// The extracted browser cloneState intentionally omits some online-room fields.
// They are authoritative database metadata and must survive every action and
// every finishTurn clone. Otherwise the server rejects the second game move.
const ROOM_FIELDS=['onlineStarted','mode','hostColor','rated',
 'ratingCategory','initialTime','startingPoints'];
function preserveRoomFields(source,target){
 for(const key of ROOM_FIELDS){
  if(Object.prototype.hasOwnProperty.call(source,key))
   target[key]=structuredClone(source[key]);
 }
 return target;
}
function copyMetadata(state){
 const s=R.cloneState(state);
 s.lastRecordedPositionKey=state.lastRecordedPositionKey??null;
 s.positionCounts={...(state.positionCounts||{})};
 return s;
}
function finishTurn(state){
 const s=copyMetadata(state),was=s.turn,next=R.other(was);
 if(s.clocks)s.clocks[was]+=s.increment||0;
 if(s.frozen?.[was])s.frozen[was]=null;
 s.turn=next;
 if(s.shielded?.[next])s.shielded[next]=null;
 if(s.ambushed?.[next])s.ambushed[next]=null;
 if(s.fortified?.[next])s.fortified[next]=null;
 if(s.portals?.[was]){
  s.portals[was].turnsRemaining=Number(s.portals[was].turnsRemaining??1)-1;
  if(s.portals[was].turnsRemaining<=0)s.portals[was]=null;
 }
 s.abilityUsed=false;s.movesRemaining=1;s.doubleMoveActive=false;
 s.activeAbility=null;s.awaitingAbilityTarget=false;s.abilitySelection=null;
 return s;
}
function adjudicate(state){
 const s=state;
 if(s.over)return s;
 const wk=R.findKing(s,'w'),bk=R.findKing(s,'b');
 if(!wk||!bk){
  s.over=true;s.winner=wk?'w':bk?'b':null;s.resultReason='king capture';return s;
 }
 const moves=R.allLegalMoves(s,s.turn);
 const abilityEscape=R.abilityCanProduceLegalContinuation(s,s.turn);
 if(moves.length===0&&!abilityEscape){
  s.over=true;s.winner=R.inCheck(s,s.turn)?R.other(s.turn):null;
  s.resultReason=s.winner?'checkmate':'stalemate';return s;
 }
 if(R.isInsufficientMaterial(s)){
  s.over=true;s.winner=null;s.resultReason='insufficient material';return s;
 }
 if(Number(s.halfmoveClock||0)>=100){
  s.over=true;s.winner=null;s.resultReason='fifty-move rule';return s;
 }
 if(R.recordPosition(s)>=3){
  s.over=true;s.winner=null;s.resultReason='threefold repetition';return s;
 }
 return s;
}
function applyGameAction(trustedState,action){
 const before=validateGameStateStructure(trustedState);
 requireLegal(before.length===0,'Invalid authoritative state: '+before.join('; '));
 requireLegal(!trustedState.over,'Game already complete');
 requireLegal(action&&typeof action==='object'&&typeof action.type==='string','Invalid action');
 const who=trustedState.turn;
 let s,endsTurn=false;
 switch(action.type){
  case 'move':{
   const {move,boardState}=applyLegalBoardMoveGeometry(trustedState,action);
   const piece=R.pieceAt(trustedState.board,move.from.r,move.from.c);
   const at=move.enPassant?move.capturedAt:move.to;
   const taken=R.pieceAt(trustedState.board,at.r,at.c);
   s=Object.assign(copyMetadata(trustedState),boardState);
   s.points[who]+=taken?VALUES[taken[1]]||0:0;
   s.halfmoveClock=(piece[1]==='p'||taken)?0:Number(trustedState.halfmoveClock||0)+1;
   const actualTo=move.portalExit||move.to;
   s.lastMove={from:{...move.from},to:{...actualTo}};
   s.lastMoveByColor=s.lastMoveByColor||{w:null,b:null};
   s.lastMoveByColor[who]={
    piece,from:{...move.from},to:{...actualTo},
    resultPiece:piece[1]==='p'&&R.isPromotionRank(who,move.to.r)
      ?who+(move.promotion||'q'):piece
   };
   s.movesRemaining=Number(trustedState.movesRemaining)-1;
   if(taken?.[1]==='k'){
    s.over=true;s.winner=who;s.resultReason='king capture';
   }else if(s.movesRemaining<=0)endsTurn=true;
   break;
  }
  case 'ability':
   s=applyAbilityIntent(trustedState,action);
   s.lastRecordedPositionKey=trustedState.lastRecordedPositionKey??null;
   s.positionCounts={...(trustedState.positionCounts||{})};
   endsTurn=action.id==='teleport';
   break;
  case 'upgrade':{
   const result=applyUpgradeIntent(trustedState,action);
   s=result.state;
   s.lastRecordedPositionKey=trustedState.lastRecordedPositionKey??null;
   s.positionCounts={...(trustedState.positionCounts||{})};
   endsTurn=true;break;
  }
  default:throw new Error('Unsupported gameplay action: '+action.type);
 }
 if(endsTurn)s=finishTurn(s);
 preserveRoomFields(trustedState,s);
 if(endsTurn||s.over)adjudicate(s);
 const after=validateGameStateStructure(s);
 requireLegal(after.length===0,'Reducer produced invalid state: '+after.join('; '));
 return {state:s,endsTurn,terminal:s.over,actionType:action.type};
}
module.exports={applyGameAction,finishTurn,adjudicate};

};
factories["./viewer-state.js"] = function(module,require){
'use strict';
/**
 * Returns a privacy-safe board state for one seat. In particular positionCounts
 * and embedded replay snapshots disclose hidden Ambush square coordinates.
 * Never return raw trusted state to clients, even in an action acknowledgement.
 */
function viewerState(state,viewerColor) {
 if(!state||typeof state!=='object'||Array.isArray(state))
  throw new Error('Invalid trusted state');
 if(!['w','b'].includes(viewerColor))
  throw new Error('Unknown viewer side');
 const visible=structuredClone(state);
 for(const key of [
   'historyGameKey','historySaved',
   'syncActionId','syncSentAt'
 ])delete visible[key];
 // Preserve collection shapes expected by existing render/log/history code
 // while ensuring no hidden coordinates or private action names survive.
 visible.positionCounts={};
 visible.lastRecordedPositionKey=null;
 visible.historySnapshots=[];
 visible.log=[];
 visible.lastMessage='';
 if(!visible.over&&visible.ambushed){
  const opponent=viewerColor==='w'?'b':'w';
  visible.ambushed[opponent]=null;
 }
 return visible;
}
module.exports={viewerState};

};
const cache=Object.create(null);
function requireModule(name){
 const key=name.startsWith("./")?name:"./"+name;
 if(!factories[key])throw Error("Unknown trusted module: "+key);
 if(cache[key])return cache[key].exports;
 const module={exports:{}};cache[key]=module;
 factories[key](module,requireModule);return module.exports;
}
const trusted=requireModule("./turn-reducer.js");
export const applyGameAction=trusted.applyGameAction;
export const finishTurn=trusted.finishTurn;
export const adjudicate=trusted.adjudicate;
export const viewerState=requireModule("./viewer-state.js").viewerState;
