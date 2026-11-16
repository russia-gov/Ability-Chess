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
