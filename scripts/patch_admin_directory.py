#!/usr/bin/env python3
"""Add an admin-only Member directory entry without restructuring the legacy page."""
from pathlib import Path
import sys

path=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
s=path.read_text(encoding='utf-8')
marker='ABILITY_CHESS_ADMIN_DIRECTORY_NAV_V1'
if marker in s:
    print('Admin directory navigation already installed')
    raise SystemExit(0)
anchor='  const originalUpdateSidebarAccounts=updateSidebarAccounts;'
if s.count(anchor)!=1:
    raise SystemExit(f'Expected exactly one sidebar hook, found {s.count(anchor)}')
extra=r'''  // ABILITY_CHESS_ADMIN_DIRECTORY_NAV_V1
  // memberProfile comes from the existing authenticated member flow.
  // The directory itself additionally requires a server-verified admin account.
  const baseInstallSpecialNav=installSpecialNav;
  installSpecialNav=function(){
    baseInstallSpecialNav();
    if(!memberProfile||(memberProfile.is_owner!==true&&memberProfile.is_staff!==true))return;
    document.querySelectorAll('.home-nav').forEach(nav=>{
      if(nav.querySelector('.admin-directory-nav-btn'))return;
      const link=document.createElement('a');
      link.className='home-nav-item admin-directory-nav-btn';
      link.href='admin-directory.html';
      link.textContent='Member directory';
      link.setAttribute('aria-label','Open administrator member directory');
      const adminLink=nav.querySelector('.admin-nav-btn');
      if(adminLink)adminLink.insertAdjacentElement('afterend',link);
      else nav.appendChild(link);
    });
  };
'''
s=s.replace(anchor,extra+anchor,1)
path.write_text(s,encoding='utf-8')
print('Installed administrator member-directory navigation')
