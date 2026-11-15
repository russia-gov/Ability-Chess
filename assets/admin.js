(function (global) {
  'use strict';

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
    function rebuildCanonicalSidebars() {
      const memberProfile = getMemberProfile();
      const canAdmin = !!(memberProfile && (memberProfile.is_owner || memberProfile.is_staff));
      const items = [
        { className: 'page-play-btn', icon: '▶', label: 'Play', route: 'play', action: () => showScreen('play') },
        { className: 'abilities-nav-btn', icon: '★', label: 'Abilities Guide', route: 'abilities', action: () => showScreen('abilities') },
        { className: 'analysis-nav-btn', icon: '◩', label: 'Analysis', route: 'analysis', action: () => showScreen('analysis') },
        { className: 'settings-nav-btn', icon: '⚙', label: 'Settings', route: 'settings', action: () => showScreen('settings') },
        { className: 'history-nav-btn', icon: '◫', label: 'Game history', route: 'history', action: () => showScreen('history') },
        { className: 'tournaments-nav-btn', icon: '♜', label: 'Tournaments', route: 'tournaments', action: () => showScreen('tournaments') },
        { className: 'community-nav-btn', icon: '◈', label: 'Community', action: () => global.location.assign('community.html') },
        { className: 'sidebar-notification-btn', icon: '●', label: 'Notifications', action: openNotifications, notification: true }
      ];
      if (canAdmin) {
        items.push({ className: 'admin-nav-btn', icon: '⚑', label: 'Admin', route: 'admin', action: () => showScreen('admin') });
      }

      document.querySelectorAll('.home-nav').forEach(nav => {
        nav.replaceChildren();
        for (const item of items) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `home-nav-item ${item.className}${item.route === currentRoute() ? ' active' : ''}`;
          button.innerHTML = `<span class="home-nav-icon">${item.icon}</span>${item.label}${item.notification ? ' <span class="notification-badge" hidden></span>' : ''}`;
          button.addEventListener('click', item.action);
          nav.appendChild(button);
        }
      });
      updateNotificationBadge();
      restoreCommunityDestination();
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
        rebuildCanonicalSidebars();
      };
    }

    return { rebuildCanonicalSidebars, installManagementPanel, wrapUpdateSidebarAccounts };
  }

  function escapeAttribute(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  global.AbilityChessAdmin = Object.freeze({ createAdminUi, escapeAttribute });
})(window);

