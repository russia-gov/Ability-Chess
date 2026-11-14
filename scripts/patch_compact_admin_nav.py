#!/usr/bin/env python3
"""Keep account navigation compact; put moderation destinations inside Admin.

This patch deliberately leaves the login/member initialization and game logic alone.
Run after the earlier navigation scripts until those scripts can be retired.
"""
from pathlib import Path
import sys

path=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
s=path.read_text(encoding='utf-8')
marker='ABILITY_CHESS_COMPACT_ADMIN_NAV_V1'
anchor='  const originalUpdateSidebarAccounts=updateSidebarAccounts;'
if marker in s:
    print('Compact admin navigation already installed')
    raise SystemExit(0)
if s.count(anchor)!=1:
    raise SystemExit(f'Expected one sidebar hook, found {s.count(anchor)}')

# The previous two patches append independent wrappers immediately before the
# sidebar account updater. Delete those wrappers without changing the updater.
first='  // ABILITY_CHESS_ADMIN_DIRECTORY_NAV_V1'
second='  // ABILITY_CHESS_DM_SAFETY_NAV_V1'
if first in s:
    begin=s.index(first)
    finish=s.index(anchor,begin)
    region=s[begin:finish]
    if 'const baseInstallSpecialNav=installSpecialNav;' not in region:
        raise SystemExit('Unexpected legacy Admin navigation; refusing unsafe change')
    s=s[:begin]+s[finish:]
elif second in s:
    begin=s.index(second)
    finish=s.index(anchor,begin)
    region=s[begin:finish]
    if 'const baseInstallDmSafetyNav=installSpecialNav;' not in region:
        raise SystemExit('Unexpected legacy DM navigation; refusing unsafe change')
    s=s[:begin]+s[finish:]

# Extend the already access-controlled Admin screen, not the site-wide sidebar.
old='ensureAdminFoundationCards();loadModerationFoundation();}'
new='ensureAdminFoundationCards();loadModerationFoundation();ensureCompactAdminTools();}'
if s.count(old)!=1:
    raise SystemExit(f'Expected exactly one Admin initialization hook, found {s.count(old)}')
s=s.replace(old,new,1)

extras=r'''  // ABILITY_CHESS_COMPACT_ADMIN_NAV_V1
  function ensureCompactAdminTools(){
    const root=document.getElementById('adminScreen');
    const grid=root?.querySelector('.admin-grid');
    if(!grid || !memberProfile || !(memberProfile.is_owner || memberProfile.is_staff)) return;
    if(root.querySelector('#compactAdminTools'))return;
    const card=document.createElement('section');
    card.className='admin-card';
    card.id='compactAdminTools';
    card.style.gridColumn='1 / -1';
    const heading=document.createElement('h2');
    heading.textContent='Member management';
    const intro=document.createElement('p');
    intro.textContent='Directory and reported private messages';
    const controls=document.createElement('div');
    controls.className='history-actions';
    const frame=document.createElement('iframe');
    frame.title='Admin management tool';
    frame.style.cssText='display:none;width:100%;min-height:540px;height:70vh;border:1px solid #465363;border-radius:10px;background:#11171d;margin-top:12px';
    const close=document.createElement('button');
    close.type='button';
    close.textContent='Close tool';
    close.hidden=true;
    close.addEventListener('click',()=>{
      frame.removeAttribute('src');
      frame.style.display='none';
      close.hidden=true;
    });
    const tools=[
      ['Member directory','admin-directory.html?embedded=1'],
      ['DM reports','dm-safety.html?embedded=1#reports']
    ];
    for(const [label,url] of tools){
      const b=document.createElement('button');
      b.type='button';
      b.textContent=label;
      b.addEventListener('click',()=>{
        frame.src=url;
        frame.title=label;
        frame.style.display='block';
        close.hidden=false;
      });
      controls.appendChild(b);
    }
    card.append(heading,intro,controls,close,frame);
    grid.appendChild(card);
    // Display the whole management frame without a cramped grid column.
    frame.style.maxWidth='100%';
  }
'''
s=s.replace(anchor,extras+anchor,1)
# A bare JS anchor is safer than rewriting the large static layout or login paths.
path.write_text(s,encoding='utf-8')
print('Removed report/directory sidebar links; added tools inside Admin')
