(function(){
  'use strict';
  // The sidebar shares the site's existing session. Owner/staff links are
  // exposed only after the server verifies administrator access.
  const nav=document.getElementById('communitySidebarNav');
  const activeRoute=document.body.dataset.sidebarRoute||'community';
  const shared=window.AbilityChessAdmin?.mountSidebar;
  if(!shared||!nav)return;
  shared({nav,mode:'community',activeRoute,canAdmin:false});
  document.getElementById('communityProfileLink')?.addEventListener('click',()=>{
    window.location.assign('./?sidebarAction=profile');
  });
  if(!window.supabase?.createClient)return;
  const client=window.supabase.createClient(
    'https://cczvdpofddjghqoeiqew.supabase.co',
    'sb_publishable_1j0iGD0GxwBdhac9suyPSw_5CPJGvaM',
    {auth:{
      storageKey:'abilityChessMemberSession',
      storage:window.localStorage,
      persistSession:true,autoRefreshToken:true,detectSessionInUrl:false
    }}
  );
  (async()=>{
    // Only display cached sidebar account details for the currently signed-in
    // member. The main screen is the authority for names and ratings.
    const name=document.getElementById('communityProfileName');
    const meta=document.getElementById('communityProfileMeta');
    const avatar=document.getElementById('communityProfileAvatar');
    try{
      const {data,error}=await client.auth.getUser();
      if(error||!data?.user){if(meta)meta.textContent='Sign in to view ratings';return;}
      const user=data.user;
      if(name)name.textContent='My profile';
      if(meta)meta.textContent='Open your profile';
      try {
        const cached=JSON.parse(localStorage.getItem('abilityChessSidebarMember')||'null');
        if(cached && cached.userId===user.id && Date.now()-cached.savedAt<86400000){
          if(name&&cached.name)name.textContent=cached.name;
          if(meta&&cached.meta)meta.textContent=cached.meta;
          if(avatar&&cached.avatarUrl){
            const img=document.createElement('img');
            img.src=cached.avatarUrl;img.alt='';img.referrerPolicy='no-referrer';
            avatar.replaceChildren(img);
          }
        }
      }catch(_error){/* Cache is optional; account navigation still works. */}
      const {data:allowed,error:roleError}=await client.rpc('ability_chess_is_admin',{p_user_id:data.user.id});
      if(!roleError&&allowed===true)shared({nav,mode:'community',activeRoute,canAdmin:true});
    }catch(error){
      console.debug('Community sidebar: admin link unavailable',error);
    }
  })();
})();
