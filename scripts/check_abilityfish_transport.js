#!/usr/bin/env node
'use strict';
// Fast, dependency-free regression tests for the JS-to-UCI transport layer.
// Full search correctness is exercised by the engine's separate browser tests.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../engine/fairy-depth15-worker.js'),'utf8');
const ctx={self:{postMessage(){}},importScripts(){},Stockfish(){}};
vm.runInNewContext(source+'\n;self.__transportTest={abilityCommands,upgradeCommands};',ctx);
const {abilityCommands,upgradeCommands}=ctx.self.__transportTest;

const expected=[
 ['p','vanguard',1],['p','reverse_gear',2],['p','veteran',3],
 ['n','lancer',4],['n','charger',5],
 ['b','cardinal',6],['b','color_shift',7],['b','archbishop',8],
 ['r','bastion',9],['r','turret',10],['r','chancellor',11],
 ['q','phase_step',12],['k','royal_step',13],['k','escape_route',14]
];
const pieceIndex={p:0,n:1,b:2,r:3,q:4,k:5};
for(const [piece,id,code] of expected){
  assert.deepEqual(Array.from(upgradeCommands({w:{[piece]:id}})),
    [`abilityupgrade w ${pieceIndex[piece]} ${code}`],id);
  const camel=id.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
  assert.deepEqual(Array.from(upgradeCommands({b:{[piece]:{upgradeId:camel}}})),
    [`abilityupgrade b ${pieceIndex[piece]} ${code}`],camel);
}
assert.deepEqual(Array.from(upgradeCommands({w:{pawn:{id:'Reverse Gear'}},b:{king:{upgrade:'escape-route'}}})),
  ['abilityupgrade w 0 2','abilityupgrade b 5 14']);
assert.deepEqual(Array.from(upgradeCommands({w:{p:'unrecognized_upgrade'}})),[]);
const commands=Array.from(abilityCommands({abilityState:{
  turn:'w',whitePoints:8,blackPoints:2,boardMovesRemaining:1,
  upgrades:{w:{knight:'charger'},b:{bishop:'archbishop'}}
}}));
assert(commands.includes('abilityupgrade w 1 5'));
assert(commands.includes('abilityupgrade b 2 8'));
assert.match(source,/const defaultTimeMs = 0;/);
console.log('AbilityFish upgrade UCI transport and unrestricted default depth checks passed');
