#!/usr/bin/env node
'use strict';
/**
 * Make board-move mutation atomic for the human, online and bot paths.
 * The old implementation credited capture points and reset the halfmove
 * counter before applyMoveToState could reject a frozen/shielded move.
 * Only game states accepted by the rules reducer may change point totals.
 */
const fs=require('node:fs');
const filename='index.html';
let source=fs.readFileSync(filename,'utf8');
const before=[
 '    if (animate) queueMoveAnimation(move);',
 '    else pendingMoveAnimation = null;',
 '    if (target) addPoints(game.turn, target);',
 '',
 "    game.halfmoveClock = (piece[1]==='p' || target) ? 0 : Number(game.halfmoveClock||0)+1;",
 '    const next = applyMoveToState(game, move);',
 '    if (!next) return;'
].join('\n');
const after=[
 '    // Validate the complete move before changing score, clock, or animation.',
 '    const next = applyMoveToState(game, move);',
 '    if (!next) return;',
 '    if (animate) queueMoveAnimation(move);',
 '    else pendingMoveAnimation = null;',
 '    if (target) addPoints(game.turn, target);',
 "    game.halfmoveClock = (piece[1]==='p' || target) ? 0 : Number(game.halfmoveClock||0)+1;"
].join('\n');
function count(text,needle){return text.split(needle).length-1;}
if(count(source,after)===1 && count(source,before)===0){
 console.log('Atomic move transition already applied');
 process.exit(0);
}
if(count(source,before)!==1)throw new Error('Expected exactly one unsafe makeMove sequence; refusing to modify');
if(process.argv.includes('--check')){
 console.error('Unsafe makeMove ordering remains');
 process.exit(1);
}
if(!process.argv.includes('--apply'))throw new Error('Use --apply to modify monolithic game source');
source=source.replace(before,after);
fs.writeFileSync(filename,source,'utf8');
if(count(source,after)!==1)throw new Error('Patched move safety sequence not unique');
console.log('Updated makeMove to calculate legality before side effects');
