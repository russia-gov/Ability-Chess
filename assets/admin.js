(function (global) {
  'use strict';


  // Shared sidebar contract used by both the main SPA and standalone Community.
  // Main-site account handlers remain attached to their existing footer nodes.
  const SIDEBAR_DESTINATIONS=Object.freeze([
    {route:'online',screen:'play',icon:'♟',label:'Online',className:'page-play-btn'},
    {route:'bots',screen:'play',icon:'♞',label:'Bots',className:'page-play-btn'},
    {route:'tutorial',icon:'◇',label:'Tutorial',className:'tutorial-nav-btn'},
    {route:'leaderboard',icon:'♛',label:'Leaderboard',className:'leaderboard-nav-btn'},
    {route:'abilities',icon:'★',label:'Abilities Guide',className:'abilities-nav-btn'},
    {route:'analysis',icon:'◩',label:'Analysis',className:'analysis-nav-btn'},
    {route:'settings',icon:'⚙',label:'Settings',className:'settings-nav-btn'},
    {route:'history',icon:'◫',label:'Game history',className:'history-nav-btn'},
    {route:'tournaments',icon:'♜',label:'Tournaments',className:'tournaments-nav-btn'},
    {route:'community',icon:'◈',label:'Community',className:'community-nav-btn'},
    {route:'notifications',icon:'●',label:'Notifications',className:'sidebar-notification-btn'},
    {route:'admin',icon:'⚑',label:'Admin',className:'admin-nav-btn'}
  ]);
  const SIDEBAR_GROUPS=Object.freeze([
    {key:'play',label:'Play',icon:'▶',routes:['online','bots','tournaments','history','leaderboard']},
    {key:'learn',label:'Learn',icon:'▦',routes:['tutorial','abilities']},
    {key:'more',label:'More',icon:'⚙',routes:['settings','notifications','admin']}
  ]);
  const SIDEBAR_PRIMARY=['analysis','community'];
  function ensureSidebarStyles(){
    if(document.querySelector('link[data-ability-sidebar-groups]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='./assets/sidebar-groups.css';
    link.dataset.abilitySidebarGroups='';
    document.head.appendChild(link);
  }
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
    ensureSidebarStyles();
    const makeItem=item=>{
      const active=item.route===activeRoute || ((item.route==='online'||item.route==='bots')&&activeRoute==='play');
      const el=document.createElement(mode==='community'?'a':'button');
      el.className='home-nav-item '+item.className+(active?' active current':'');
      if(mode==='community'){
        el.href=item.route==='community'?'./community.html':item.route==='tutorial'?'./tutorial.html':item.route==='leaderboard'?'./leaderboard.html':'./?communityNav='+encodeURIComponent(item.screen||item.route);
        if(item.route==='admin')el.id='communitySidebarAdmin';
      }else{
        el.type='button';
        el.addEventListener('click',()=>{
          if(item.route==='notifications')onNotifications?.();
          else if(item.route==='community')global.location.assign('community.html');
          else if(item.route==='tutorial'||item.route==='leaderboard')global.location.assign(item.route+'.html');
          else onNavigate?.(item.screen||item.route);
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
      return el;
    };
    nav.replaceChildren();
    for(const group of SIDEBAR_GROUPS){
      const items=group.routes.map(route=>SIDEBAR_DESTINATIONS.find(x=>x.route===route))
        .filter(item=>item&&(item.route!=='admin'||canAdmin));
      if(!items.length)continue;
      const details=document.createElement('details');
      details.className='sidebar-nav-group';
      details.dataset.group=group.key;
      if(items.some(item=>item.route===activeRoute||((item.route==='online'||item.route==='bots')&&activeRoute==='play')))details.classList.add('has-active-route');
      const summary=document.createElement('summary');
      summary.className='sidebar-group-toggle';
      summary.setAttribute('aria-label',group.label+' menu');
      const icon=document.createElement('span');
      icon.className='home-nav-icon';
      icon.textContent=group.icon;
      const label=document.createElement('span');
      label.textContent=group.label;
      const arrow=document.createElement('span');
      arrow.className='sidebar-group-chevron';
      arrow.setAttribute('aria-hidden','true');
      arrow.textContent='›';
      summary.append(icon,label,arrow);
      const contents=document.createElement('div');
      contents.className='sidebar-group-items';
      for(const item of items)contents.appendChild(makeItem(item));
      details.append(summary,contents);
      // The menu is a fixed-position flyout so a scrolling sidebar can't clip it.
      // Native details/summary remains usable by click, tap, and keyboard.
      const positionFlyout=()=>{
        const rect=summary.getBoundingClientRect();
        const narrow=global.matchMedia('(max-width:900px)').matches;
        const width=narrow?Math.min(244,global.innerWidth-16):Math.min(260,global.innerWidth-rect.right-8);
        contents.style.width=Math.max(170,width)+'px';
        contents.style.left=(narrow?Math.min(rect.left,global.innerWidth-Math.max(170,width)-8):rect.right)+'px';
        const desiredTop=narrow?rect.bottom:rect.top;
        const availableHeight=global.innerHeight-16;
        const height=Math.min(contents.scrollHeight||260,availableHeight);
        contents.style.top=Math.max(8,Math.min(desiredTop,global.innerHeight-height-8))+'px';
      };
      summary.addEventListener('click',()=>global.requestAnimationFrame(()=>{if(details.open)positionFlyout();}));
      details.addEventListener('pointerenter',event=>{
        if(event.pointerType!=='mouse')return;
        details.open=true;
        positionFlyout();
      });
      details.addEventListener('pointerleave',event=>{
        if(event.pointerType!=='mouse')return;
        if(!details.contains(document.activeElement))details.open=false;
      });
      details.addEventListener('focusin',()=>{details.open=true;positionFlyout();});
      details.addEventListener('focusout',event=>{
        if(!details.contains(event.relatedTarget)&&!details.matches(':hover'))details.open=false;
      });
      nav.appendChild(details);
      if(group.key==='play'){
        for(const route of SIDEBAR_PRIMARY){
          const item=SIDEBAR_DESTINATIONS.find(x=>x.route===route);
          nav.appendChild(makeItem(item));
        }
      }
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
      // Open the tutorial authoring workspace as a real page instead of a
      // constrained iframe inside the Admin dashboard.
      if(memberTools && !document.getElementById('adminTutorialPanel')){
        const section=document.createElement('section');
        section.className='admin-card admin-community-panel';
        section.id='adminTutorialPanel';
        section.innerHTML='<h2>Tutorial lessons</h2><p>Manage the illustrated tutorial using a full-page lesson editor and interactive board preview.</p><a class="action" href="tutorial-editor.html" id="adminTutorialOpen">Open tutorial editor</a>';
        (document.getElementById('adminCommunityPanel')||memberTools).after(section);
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

