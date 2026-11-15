#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const file = process.argv[2] || 'index.html';
let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

function replaceOnce(oldText, newText, label) {
  if (source.includes(newText)) return;
  const first = source.indexOf(oldText);
  const last = source.lastIndexOf(oldText);
  if (first < 0 || first !== last) throw new Error(`${label} anchor changed`);
  source = source.slice(0, first) + newText + source.slice(first + oldText.length);
}

function replaceRange(startText, endText, replacement, label) {
  if (source.includes(replacement)) return;
  const start = source.indexOf(startText);
  const endStart = source.indexOf(endText, start + startText.length);
  if (start < 0 || endStart < 0) throw new Error(`${label} anchors changed`);
  source = source.slice(0, start) + replacement + source.slice(endStart + endText.length);
}

if (!source.includes('<link rel="stylesheet" href="assets/account.css">')) {
  replaceRange(
    '  .member-modal{position:fixed;',
    '@media(max-width:640px){.member-auth,.profile-edit{grid-template-columns:1fr}.member-row{grid-template-columns:1fr}.member-actions{justify-content:flex-start}}',
    '</style>\n<link rel="stylesheet" href="assets/account.css">\n<link rel="stylesheet" href="assets/admin.css">\n<style>\n',
    'account stylesheet'
  );
}

if (source.includes('  .members-nav-btn{display:none!important}')) {
  replaceRange(
    '  .members-nav-btn{display:none!important}',
    '  .sidebar-avatar{width:34px;height:34px;border-radius:7px;display:grid;place-items:center;background:#394552;font-weight:900}.sidebar-profile-name{font-size:12px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sidebar-profile-meta{font-size:10px;color:#9eabb8}',
    '',
    'account rail stylesheet'
  );
}

replaceOnce(
  '<title>Ability Chess</title>\n',
  '<title>Ability Chess</title>\n<script src="assets/account-auth.js"></script>\n<script src="assets/admin.js"></script>\n',
  'module scripts'
);

replaceOnce(
  '<section id="adminManagementPanel" class="admin-card" style="margin:18px 0">\n      <h2>Member management</h2>\n      <p class="history-meta">Manage member accounts and review reported private messages.</p>\n      <div class="history-actions">',
  '<section id="adminManagementPanel" class="admin-card">\n      <h2>Member management</h2>\n      <p class="history-meta">Manage member accounts and review reported private messages.</p>\n      <div class="history-actions admin-management-actions">',
  'admin management markup'
);
replaceOnce(
  'style="display:none;width:100%;height:min(75vh,850px);min-height:540px;margin-top:12px;border:1px solid #465363;border-radius:10px;background:#11171d"></iframe>',
  'hidden></iframe>',
  'admin frame markup'
);

replaceRange(
  '  function authHeaders(){',
  '  async function memberRpc(name,body={},retried=false){',
  `  const {authHeaders,authRequest,appRedirectUrl,clearAuthRedirectArtifacts,importAuthRedirectSession}=\n    window.AbilityChessAccountAuth.createAccountAuth({\n      supabaseUrl:SUPABASE_URL,\n      supabaseKey:SUPABASE_KEY,\n      getSession:()=>memberSession,\n      saveSession:session=>saveMemberSession(session)\n    });\n  async function memberRpc(name,body={},retried=false){`,
  'account auth helpers'
);

replaceOnce(
  '  const notifiedChallengeStatuses=new Set();\n',
  '  const notifiedChallengeStatuses=new Set();\n  let adminUi=null;\n',
  'admin module state'
);

replaceOnce(
  'ensureAdminFoundationCards();loadModerationFoundation();}',
  "if(typeof ensureAdminFoundationCards==='function')ensureAdminFoundationCards();if(typeof loadModerationFoundation==='function')loadModerationFoundation();}",
  'optional legacy admin hooks'
);

replaceRange(
  '  function rebuildCanonicalSidebars(){',
  '  const originalUpdateSidebarAccounts=updateSidebarAccounts;updateSidebarAccounts=function(){originalUpdateSidebarAccounts();document.querySelectorAll(\'.sidebar-avatar\').forEach(a=>{if(memberProfile?.avatar_url)a.innerHTML=`<img src="${escapeHtml(memberProfile.avatar_url)}" alt="">`;});installSpecialNav();};',
  `  function rebuildCanonicalSidebars(){\n    adminUi??=window.AbilityChessAdmin.createAdminUi({\n      getMemberProfile:()=>memberProfile,\n      currentRoute,\n      showScreen,\n      updateNotificationBadge,\n      openNotifications:openNotificationsFromSidebar\n    });\n    adminUi.rebuildCanonicalSidebars();\n  }\n  function installSpecialNav(){rebuildCanonicalSidebars();}\n  document.querySelectorAll('.tournaments-nav-btn').forEach(b=>b.addEventListener('click',()=>showScreen('tournaments')));\n  document.querySelectorAll('.admin-nav-btn').forEach(b=>b.addEventListener('click',()=>showScreen('admin')));\n  installSpecialNav();\n  // ABILITY_CHESS_ADMIN_MANAGEMENT_STATIC_V2\n  adminUi.installManagementPanel();\n  updateSidebarAccounts=adminUi.wrapUpdateSidebarAccounts(updateSidebarAccounts);`,
  'admin controller'
);

for (const marker of ['assets/account-auth.js', 'assets/admin.js', 'assets/account.css', 'assets/admin.css', 'createAccountAuth', 'adminUi.installManagementPanel()', 'id="adminManagementFrame"']) {
  if (!source.includes(marker)) throw new Error(`missing extracted module marker: ${marker}`);
}

fs.writeFileSync(file, source);
console.log('Extracted account/auth and admin modules');

