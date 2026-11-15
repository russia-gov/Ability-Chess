(function (global) {
  'use strict';


  // Shared sidebar contract used by both the main SPA and standalone Community.
  // Main-site account handlers remain attached to their existing footer nodes.
  const SIDEBAR_DESTINATIONS=Object.freeze([
    {route:'play',icon:'▶',label:'Play',className:'page-play-btn'},
    {route:'abilities',icon:'★',label:'Abilities Guide',className:'abilities-nav-btn'},
    {route:'analysis',icon:'◩',label:'Analysis',className:'analysis-nav-btn'},
    {route:'settings',icon:'⚙',label:'Settings',className:'settings-nav-btn'},
    {route:'history',icon:'◫',label:'Game history',className:'history-nav-btn'},
    {route:'tournaments',icon:'♜',label:'Tournaments',className:'tournaments-nav-btn'},
    {route:'community',icon:'◈',label:'Community',className:'community-nav-btn'},
    {route:'notifications',icon:'●',label:'Notifications',className:'sidebar-notification-btn'},
    {route:'admin',icon:'⚑',label:'Admin',className:'admin-nav-btn'}
  ]);
  function mountSidebar({nav,mode='game',activeRoute='play',canAdmin=false,onNavigate,onNotifications}) {
    if(!nav)return;
    const rail=nav.closest('aside');
    if(rail)rail.classList.add('ability-sidebar');
    // The same component builds brand and footer for a standalone page,
    // while preserving account DOM and event listeners in the main app.
    if(mode==='community'&&rail){
      if(!rail.querySelector('.community-rail-brand')){
        const brand=document.createElement('a');
        brand.className='community-rail-brand brand';
        brand.href='./';
        brand.innerHTML='<span class="brand-mark" aria-hidden="true">♞</span><span class="brand-name">Ability<br>Chess</span>';
        rail.insertBefore(brand,nav);
      }
      if(!rail.querySelector('.sidebar-account')){
        const footer=document.createElement('div');
        footer.className='sidebar-account';
        footer.id='communitySidebarAccount';
        footer.innerHTML='<form class="sidebar-member-search" id="communityMemberSearchForm" role="search" action="./" method="get"><label class="visually-hidden" for="communityMemberSearch">Search members</label><input id="communityMemberSearch" name="sidebarSearch" type="search" placeholder="Search members" maxlength="80" autocomplete="off"></form><button type="button" class="sidebar-profile-link" id="communityProfileLink" aria-label="Open your profile"><span class="sidebar-avatar" id="communityProfileAvatar" aria-hidden="true">♜</span><span><span class="sidebar-profile-name" id="communityProfileName">My profile</span><span class="sidebar-profile-meta" id="communityProfileMeta">Sign in to view ratings</span></span></button>';
        rail.appendChild(footer);
      }
    }
    nav.replaceChildren();
    for(const item of SIDEBAR_DESTINATIONS){
      if(item.route==='admin'&&!canAdmin)continue;
      const active=item.route===activeRoute;
      const el=document.createElement(mode==='community'?'a':'button');
      el.className='home-nav-item '+item.className+(active?' active current':'');
      if(mode==='community'){
        el.href=item.route==='community'?'./community.html':'./?communityNav='+encodeURIComponent(item.route);
        if(item.route==='admin')el.id='communitySidebarAdmin';
      }else{
        el.type='button';
        el.addEventListener('click',()=>{
          if(item.route==='notifications')onNotifications?.();
          else if(item.route==='community')global.location.assign('community.html');
          else onNavigate?.(item.route);
        });
      }
      if(active)el.setAttribute('aria-current','page');
      const icon=document.createElement('span');
      icon.className='home-nav-icon';
      icon.textContent=item.icon;
      el.append(icon,document.createTextNode(item.label));
      if(mode==='game'&&item.route==='notifications'){
        const badge=document.createElement('span');
        badge.className='notification-badge';
        badge.hidden=true;
        el.append(badge);
      }
      nav.appendChild(el);
    }
  }

  function createAdminUi({ getMemberProfile, currentRoute, showScreen, updateNotificationBadge, openNotifications }) {
    let handledCommunityNav=false;
    function restoreCommunityDestination() {
      // Initial router setup can reset the screen; navigate only after load.
      if(handledCommunityNav||global.document.readyState!=='complete')return;
      const url=new URL(global.location.href);
      const destination=url.searchParams.get('communityNav');
      const screens=new Set(['play','abilities','analysis','settings','history','tournaments','admin']);
      if(!destination||(!screens.has(destination)&&destination!=='notifications'))return;
      // Wait until account identity has been loaded before opening Admin.
      if(destination==='admin'&&!getMemberProfile())return;
      handledCommunityNav=true;
      url.searchParams.delete('communityNav');
      global.history.replaceState(global.history.state,'',url.pathname+url.search+url.hash);
      if(destination==='admin'){
        const p=getMemberProfile();
        if(!p.is_owner&&!p.is_staff)return;
      }
      if(destination==='notifications')openNotifications();
      else showScreen(destination);
    }
    global.addEventListener('load',restoreCommunityDestination,{once:true});
    function restoreSidebarAccountDestination() {
      const url=new URL(global.location.href);
      const query=url.searchParams.get('sidebarSearch');
      const action=url.searchParams.get('sidebarAction');
      if(query===null&&action!=='profile')return;
      if(query!==null){
        const input=global.document.querySelector('.sidebar-member-search input');
        if(!input)return;
        input.value=query;
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.focus();
      }else{
        const button=global.document.querySelector('.sidebar-profile-link');
        if(!button)return;
        button.click();
      }
      url.searchParams.delete('sidebarSearch');
      url.searchParams.delete('sidebarAction');
      global.history.replaceState(global.history.state,'',url.pathname+url.search+url.hash);
    }
    function rebuildCanonicalSidebars() {
      const memberProfile = getMemberProfile();
      const canAdmin = !!(memberProfile && (memberProfile.is_owner || memberProfile.is_staff));
      document.querySelectorAll('.home-nav').forEach(nav => {
        mountSidebar({
          nav,mode:'game',activeRoute:currentRoute(),canAdmin,
          onNavigate:showScreen,onNotifications:openNotifications
        });
      });
      updateNotificationBadge();
      restoreCommunityDestination();
      restoreSidebarAccountDestination();
    }

    function installManagementPanel() {
      // Community publishing lives inside Admin, separate from member management.
      const memberTools=document.getElementById('adminManagementPanel');
      if(memberTools && !document.getElementById('adminCommunityPanel')){
        const section=document.createElement('section');
        section.className='admin-card admin-community-panel';
        section.id='adminCommunityPanel';
        section.innerHTML='<h2>Community publishing</h2><p>Write news and announcements, upload thumbnails, and manage drafts.</p><button type="button" id="adminCommunityEditorToggle" class="action">Open news editor</button><iframe id="adminCommunityEditorFrame" title="Community news editor" loading="lazy" hidden></iframe>';
        memberTools.after(section);
        const button=section.querySelector('#adminCommunityEditorToggle');
        const frame=section.querySelector('#adminCommunityEditorFrame');
        button.addEventListener('click',()=>{
          const opening=frame.hidden;
          frame.hidden=!opening;
          if(opening && !frame.hasAttribute('src'))frame.src='community-editor.html?embedded=1';
          button.textContent=opening?'Close news editor':'Open news editor';
        });
      }
      document.addEventListener('click', event => {
        const select = event.target.closest?.('[data-admin-management]');
        const close = event.target.closest?.('#adminManagementClose');
        if (!select && !close) return;
        const panel = document.getElementById('adminManagementPanel');
        const frame = panel?.querySelector('#adminManagementFrame');
        const closeButton = panel?.querySelector('#adminManagementClose');
        if (!frame || !closeButton) return;
        if (close) {
          frame.removeAttribute('src');
          frame.hidden = true;
          closeButton.hidden = true;
          return;
        }
        const kind = select.getAttribute('data-admin-management');
        if (kind !== 'directory' && kind !== 'reports') return;
        frame.src = kind === 'directory' ? 'admin-directory.html?embedded=1' : 'dm-safety.html?embedded=1#reports';
        frame.title = kind === 'directory' ? 'Member directory' : 'Reported direct messages';
        frame.hidden = false;
        closeButton.hidden = false;
      });
    }

    function wrapUpdateSidebarAccounts(updateSidebarAccounts) {
      return function updateSidebarAccountsWithAdminNav() {
        updateSidebarAccounts();
        document.querySelectorAll('.sidebar-avatar').forEach(avatar => {
          const memberProfile = getMemberProfile();
          if (memberProfile?.avatar_url) avatar.innerHTML = `<img src="${global.AbilityChessAdmin.escapeAttribute(memberProfile.avatar_url)}" alt="">`;
        });
        // Share the main site's rendered player identity with standalone pages.
        // This is a display-only cache, not an authorization or rating source.
        const member=getMemberProfile();
        const account=global.document.querySelector('.sidebar-account');
        const name=account?.querySelector('.sidebar-profile-name')?.textContent?.trim();
        const meta=account?.querySelector('.sidebar-profile-meta')?.textContent?.trim();
        if(member?.id && name){
          try {
            global.localStorage.setItem('abilityChessSidebarMember',JSON.stringify({
              userId:member.id,name,meta,avatarUrl:member.avatar_url||'',savedAt:Date.now()
            }));
          }catch(_error){/* Storage unavailable; sidebar still works. */}
        }else{
          try{global.localStorage.removeItem('abilityChessSidebarMember');}catch(_error){}
        }
        rebuildCanonicalSidebars();
      };
    }

    return { rebuildCanonicalSidebars, installManagementPanel, wrapUpdateSidebarAccounts };
  }

  function escapeAttribute(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  global.AbilityChessAdmin = Object.freeze({ createAdminUi, escapeAttribute, mountSidebar });
})(window);

