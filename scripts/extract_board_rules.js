#!/usr/bin/env node
'use strict';
// Generate a reusable deterministic board-move rules module directly from the
// existing browser implementation. The extracted functions are not forked or
// edited: CI compares source hashes and runs representative rule tests.
// It does NOT yet handle ability purchases, ability costs, or turn finalization.
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync('index.html','utf8');
function between(startMarker,endMarker,label){
 const a=source.indexOf(startMarker),b=source.indexOf(endMarker,a+startMarker.length);
 if(a<0||b<=a||source.indexOf(startMarker,a+1)>=0)
  throw new Error('Cannot uniquely extract '+label);
 return source.slice(a,b);
}
const abilities=between('  const ABILITIES = [','  const PIECE_NAMES=', 'ability definitions');
const terminal=between('  function isInsufficientMaterial(state){','  function normalizeFinishedResult(){','material and repetition rules');
const escape=between('  function findImmediateAbilityEscapeAction(state,color){','  function evaluateGameStatus(){','ability-aware checkmate escapes');
const teleportHelpers=between('  function pawnOnOwnSide(color,r){','  function attemptTeleportStep(r,c){','teleport helper legality');
const upgrades=between('  const UPGRADES=[','  function upgradeTooltipText(', 'upgrade definitions');
const board=between('  function cloneState(state){','  function humanPremoveColor(', 'pure board rules');
const exportedFunctions=[
 'cloneState','inBounds','other','algebraic','parseSq','pieceAt','colorOf',
 'typeOf','isPromotionRank','upgradeFor','upgradeDefinition','upgradeCount',
 'pseudoMoves','findKing','isSquareAttacked','inCheck','revokeCastlingRights',
 'sameSquare','squareInFortify','isFortifiedAgainstAbility','isFrozenPiece',
 'portalExit','applyMoveToState','legalMovesFor','allLegalMoves',
 'isInsufficientMaterial','positionKey','recordPosition',
 'findImmediateAbilityEscapeAction','abilityCanProduceLegalContinuation','hasAnyTurnAction'
];
const output=[
 "'use strict';",
 '// GENERATED from the existing browser game by scripts/extract_board_rules.js.',
 '// This module only validates/applies individual board moves, NOT whole turns,',
 '// paid abilities, rating results, or online security.',
 abilities,upgrades,board,terminal,teleportHelpers,escape,
 'module.exports={'+exportedFunctions.join(',')+'};',''
].join('\n');
const dest='server/generated/board-rules.js';
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,output);
console.log('Extracted '+exportedFunctions.length+' pure rule functions; '+output.length+' bytes');
