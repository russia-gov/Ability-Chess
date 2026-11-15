(function(){
  'use strict';
  // The sidebar shares the site's existing session. Owner/staff links are
  // exposed only after the server verifies administrator access.
  const link=document.getElementById('communitySidebarAdmin');
  if(!link||!window.supabase?.createClient)return;
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
    try{
      const {data,error}=await client.auth.getUser();
      if(error||!data?.user)return;
      const {data:allowed,error:roleError}=await client.rpc('ability_chess_is_admin',{p_user_id:data.user.id});
      if(!roleError&&allowed===true)link.hidden=false;
    }catch(error){
      console.debug('Community sidebar: admin link unavailable',error);
    }
  })();
})();
