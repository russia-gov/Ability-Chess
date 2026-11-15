#!/usr/bin/env node
'use strict';
// Pure source-to-source bundler: wrap local CommonJS reducers as ordinary ESM
// functions so Deno Edge can import them without eval(), npm, or filesystem
// access at runtime. No externally downloaded packages.
const fs=require('node:fs');
const path=require('node:path');
const mods=[
 ['generated/board-rules.js','server/generated/board-rules.js'],
 ['game-state-schema.js','server/game-state-schema.js'],
 ['board-move-intent.js','server/board-move-intent.js'],
 ['ability-intent.js','server/ability-intent.js'],
 ['upgrade-intent.js','server/upgrade-intent.js'],
 ['turn-reducer.js','server/turn-reducer.js'],
 ['viewer-state.js','server/viewer-state.js']
];
const out=[
 '// AUTOMATICALLY GENERATED: node scripts/build_verified_edge_module.js',
 '// Never modify this bundled module by hand.',
 'const factories=Object.create(null);',
 ...mods.map(([id,file])=>{
  const contents=fs.readFileSync(file,'utf8');
  return 'factories['+JSON.stringify('./'+id)+'] = function(module,require){\n'+contents+'\n};';
 }),
 'const cache=Object.create(null);',
 'function requireModule(name){',
 ' const key=name.startsWith("./")?name:"./"+name;',
 ' if(!factories[key])throw Error("Unknown trusted module: "+key);',
 ' if(cache[key])return cache[key].exports;',
 ' const module={exports:{}};cache[key]=module;',
 ' factories[key](module,requireModule);return module.exports;',
 '}',
 'const trusted=requireModule("./turn-reducer.js");',
 'export const applyGameAction=trusted.applyGameAction;',
 'export const finishTurn=trusted.finishTurn;',
 'export const adjudicate=trusted.adjudicate;',
 'export const viewerState=requireModule("./viewer-state.js").viewerState;',
 ''
].join('\n');
const dest='supabase/functions/verified-game/rules.mjs';
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,out);
console.log('Built self-contained verified-game module: '+out.length+' bytes');
