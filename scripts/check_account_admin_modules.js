#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
for (const marker of [
  'assets/account-auth.js', 'assets/admin.js', 'assets/account.css', 'assets/admin.css',
  'window.AbilityChessAccountAuth.createAccountAuth', 'window.AbilityChessAdmin.createAdminUi',
  "typeof ensureAdminFoundationCards==='function'", "typeof loadModerationFoundation==='function'",
  'data-admin-management="directory"', 'data-admin-management="reports"'
]) {
  if (!html.includes(marker)) throw new Error(`Missing modular account/admin marker: ${marker}`);
}
if (html.includes('function authRequest(path,body)')) throw new Error('Legacy inline auth transport remains in index.html.');
const inlinePattern = new RegExp('<script(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)<\\/script>', 'gi');
for (const [index, match] of [...html.matchAll(inlinePattern)].entries()) {
  new vm.Script(match[1], { filename: `inline-${index}.js` });
}

const local = new Map();
const session = new Map();
const context = {
  URL, URLSearchParams,
  window: { location: { origin: 'https://example.test', pathname: '/Ability-Chess/', search: '', hash: '', href: 'https://example.test/Ability-Chess/' } },
  history: { state: null, replaceState() {} },
  localStorage: { getItem: key => local.get(key) || null, setItem: (key, value) => local.set(key, value) },
  sessionStorage: { getItem: key => session.get(key) || null, setItem: (key, value) => session.set(key, value) },
  fetch: async () => ({ ok: true, json: async () => ({ access_token: 'ok' }) }),
  console
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(fs.readFileSync('assets/account-auth.js', 'utf8'), context);
const account = context.window.AbilityChessAccountAuth.createAccountAuth({
  supabaseUrl: 'https://supabase.test', supabaseKey: 'public-key', getSession: () => ({ access_token: 'member-token' }), saveSession() {}
});
if (account.authHeaders().Authorization !== 'Bearer member-token') throw new Error('Account auth headers lost the member token.');
if (account.appRedirectUrl() !== 'https://example.test/Ability-Chess/') throw new Error('Account redirect URL changed.');

console.log('Account/auth and admin module checks passed');

