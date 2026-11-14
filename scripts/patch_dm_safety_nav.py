#!/usr/bin/env python3
"""Install the private-message safety navigation in the legacy SPA."""
from pathlib import Path
import sys
path=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
s=path.read_text(encoding='utf-8')
marker='ABILITY_CHESS_DM_SAFETY_NAV_V1'
if 'ABILITY_CHESS_ADMIN_MANAGEMENT_STATIC_V2' in s:
    print('DM reports are already provided inside the modular Admin screen')
    raise SystemExit(0)
if marker in s:
    print('DM safety nav already present')
    raise SystemExit(0)
anchor='  const originalUpdateSidebarAccounts=updateSidebarAccounts;'
if s.count(anchor)!=1:
    raise SystemExit(f'Expected exactly one sidebar hook, got {s.count(anchor)}')
snippet=r'''  // ABILITY_CHESS_DM_SAFETY_NAV_V1
  const baseInstallDmSafetyNav=installSpecialNav;
  installSpecialNav=function(){
    baseInstallDmSafetyNav();
    if(!memberProfile)return;
    document.querySelectorAll('.home-nav').forEach(nav=>{
      if(nav.querySelector('.dm-safety-nav-btn'))return;
      const link=document.createElement('a');
      link.className='home-nav-item dm-safety-nav-btn';
      link.href='dm-safety.html';
      link.textContent='Report a message';
      nav.appendChild(link);
      if(memberProfile.is_owner===true||memberProfile.is_staff===true){
        const admin=document.createElement('a');
        admin.className='home-nav-item dm-moderation-nav-btn';
        admin.href='dm-safety.html#reports';
        admin.textContent='DM reports';
        nav.appendChild(admin);
      }
    });
  };
'''
s=s.replace(anchor,snippet+anchor,1)
path.write_text(s,encoding='utf-8')
print('DM safety navigation installed')

