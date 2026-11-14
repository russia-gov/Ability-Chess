(function (global) {
  'use strict';

  function createAdminUi({ getMemberProfile, currentRoute, showScreen, updateNotificationBadge, openNotifications }) {
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
    }

    function installManagementPanel() {
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

