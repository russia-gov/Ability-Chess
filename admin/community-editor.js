(function(){
  'use strict';
  const URL='https://cczvdpofddjghqoeiqew.supabase.co';
  const KEY='sb_publishable_1j0iGD0GxwBdhac9suyPSw_5CPJGvaM';
  const lib=window.AbilityChessCommunity;
  const api=window.supabase?.createClient?.(URL,KEY,{auth:{
    storageKey:'abilityChessMemberSession',storage:window.localStorage,
    persistSession:true,autoRefreshToken:true,detectSessionInUrl:false
  }});
  const $=id=>document.getElementById(id);
  const status=(message,error=false)=>{$('editorStatus').textContent=message;$('editorStatus').classList.toggle('error',error);};
  let user=null,posts=[],selected=null,busy=false,savedRange=null;
  const editor=$('postBody');
  const date=v=>v?new Date(v).toLocaleDateString():'';
  function cleanPost(post){
    if(!lib)return '';
    return lib.clean(post||'');
  }
  function thumb(){
    const raw=$('postThumbnail').value.trim();
    return raw?lib.safeUrl(raw):'';
  }
  function updateThumb(){
    const src=thumb();
    const img=$('thumbnailPreview');
    if(src){img.src=src;img.hidden=false;}
    else{img.removeAttribute('src');img.hidden=true;}
  }
  function displayList(){
    $('postList').replaceChildren();
    if(!posts.length){$('postList').textContent='No posts yet.';return;}
    for(const p of posts){
      const b=document.createElement('button');b.type='button';b.classList.toggle('selected',p.id===selected);
      const t=document.createElement('strong');t.textContent=p.title;
      const sm=document.createElement('small');
      sm.textContent=(p.status==='published'?'Published':'Draft')+' · '+p.kind+' · '+date(p.published_at||p.created_at);
      b.append(t,sm);b.addEventListener('click',()=>choose(p));$('postList').appendChild(b);
    }
  }
  function reset(){
    selected=null;$('postTitle').value='';$('postKind').value='news';
    $('postSummary').value='';$('postPinned').checked=false;$('postThumbnail').value='';
    $('thumbnailFile').value='';editor.replaceChildren();
    $('deletePostBtn').hidden=true;$('unpublishBtn').hidden=true;
    $('editorPreview').hidden=true;updateThumb();displayList();status('New draft. Save it or publish when ready.');
  }
  function choose(p){
    selected=p.id;
    $('postTitle').value=p.title;$('postSummary').value=p.summary||'';
    $('postKind').value=p.kind;$('postPinned').checked=!!p.pinned;
    $('postThumbnail').value=p.thumbnail_url||'';
    editor.innerHTML=cleanPost(p.body_html);
    $('deletePostBtn').hidden=false;$('unpublishBtn').hidden=p.status!=='published';
    $('editorPreview').hidden=true;updateThumb();displayList();
    status('Editing '+(p.status==='published'?'published post.':'draft.'));
  }
  async function reload(selectId=selected){
    const {data,error}=await api.from('ability_chess_community_posts').select('*')
      .order('created_at',{ascending:false}).limit(100);
    if(error)throw error;
    posts=data||[];
    const found=posts.find(p=>p.id===selectId);
    if(found)choose(found);else reset();
  }
  function payload(nextStatus){
    const title=$('postTitle').value.trim(),summary=$('postSummary').value.trim();
    if(!title||title.length>160)throw Error('Enter a headline (1–160 characters).');
    const rawThumb=$('postThumbnail').value.trim();
    const image=thumb();
    if(rawThumb&&!image)throw Error('Thumbnail must be an HTTPS image URL.');
    const body=cleanPost(editor.innerHTML);
    if(body.length>50000)throw Error('Article is too long (maximum 50,000 characters).');
    const current=posts.find(p=>p.id===selected);
    return {
      title,summary,kind:$('postKind').value,body_html:body,
      thumbnail_url:image||null,pinned:$('postPinned').checked,
      status:nextStatus,
      published_at:nextStatus==='published'?(current?.published_at||new Date().toISOString()):null
    };
  }
  async function save(nextStatus){
    if(busy)return;
    let row;try{row=payload(nextStatus);}catch(e){status(e.message,true);return;}
    busy=true;status(nextStatus==='published'?'Publishing…':'Saving draft…');
    try{
      let result;
      if(selected)result=await api.from('ability_chess_community_posts')
        .update(row).eq('id',selected).select().single();
      else result=await api.from('ability_chess_community_posts')
        .insert({...row,author_id:user.id}).select().single();
      if(result.error)throw result.error;
      selected=result.data.id;await reload(selected);
      status(nextStatus==='published'?'Published! The article is visible in Community.':'Draft saved.');
    }catch(e){status('Unable to save: '+(e.message||e),true);}
    finally{busy=false;}
  }
  async function remove(){
    if(!selected||busy)return;
    if(!confirm('Permanently delete this community post?'))return;
    busy=true;status('Deleting…');
    try{
      const {error}=await api.from('ability_chess_community_posts').delete().eq('id',selected);
      if(error)throw error;
      selected=null;await reload(null);status('Post deleted.');
    }catch(e){status('Unable to delete: '+e.message,true);}
    finally{busy=false;}
  }
  function preview(){
    let post;
    try{post=payload('published');}catch(e){status(e.message,true);return;}
    const box=$('editorPreview');box.replaceChildren();
    if(post.thumbnail_url){
      const img=document.createElement('img');img.src=post.thumbnail_url;img.alt='';
      box.appendChild(img);
    }
    const content=document.createElement('div');content.className='post-detail-content';
    const title=document.createElement('h1');title.textContent=post.title;content.append(title);
    const sm=document.createElement('p');sm.className='summary';sm.textContent=post.summary;content.append(sm);
    const body=document.createElement('div');body.className='rich-body';
    body.innerHTML=cleanPost(post.body_html);content.append(body);
    box.append(content);box.hidden=false;
    box.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function rememberSelection(){
    const selection=window.getSelection();
    if(selection?.rangeCount&&editor.contains(selection.anchorNode))
      savedRange=selection.getRangeAt(0).cloneRange();
  }
  function runCommand(name,value){
    editor.focus();
    if(savedRange){
      const s=window.getSelection();s.removeAllRanges();
      try{s.addRange(savedRange);}catch{}
    }
    document.execCommand(name,false,value||null);
    rememberSelection();
  }
  // Keep the current text selection when formatting buttons take focus.
  document.querySelectorAll('[data-command],[data-block]').forEach(b=>{
    b.addEventListener('mousedown',e=>e.preventDefault());
    b.addEventListener('click',()=>{
      if(b.dataset.block)runCommand('formatBlock','<'+b.dataset.block.toLowerCase()+'>');
      else runCommand(b.dataset.command);
    });
  });
  document.addEventListener('selectionchange',rememberSelection);
  $('editorFont').addEventListener('change',e=>runCommand('fontName',e.target.value));
  $('editorSize').addEventListener('change',e=>runCommand('fontSize',e.target.value));
  $('editorColor').addEventListener('input',e=>runCommand('foreColor',e.target.value));
  $('editorHighlight').addEventListener('input',e=>runCommand('hiliteColor',e.target.value));
  $('editorLink').addEventListener('click',()=>{
    const url=prompt('Enter a secure (https://) link:');
    if(url===null)return;
    const checked=lib.safeUrl(url);
    if(!checked){status('Links must use HTTPS.',true);return;}
    runCommand('createLink',checked);
  });
  $('editorClear').addEventListener('click',()=>runCommand('removeFormat'));
  $('postThumbnail').addEventListener('input',updateThumb);
  $('postForm').addEventListener('submit',e=>e.preventDefault());
  $('saveDraftBtn').addEventListener('click',()=>save('draft'));
  $('publishBtn').addEventListener('click',()=>save('published'));
  $('unpublishBtn').addEventListener('click',()=>save('draft'));
  $('deletePostBtn').addEventListener('click',remove);
  $('previewPostBtn').addEventListener('click',preview);
  $('newPostBtn').addEventListener('click',reset);
  $('refreshPostsBtn').addEventListener('click',()=>reload().catch(e=>status(e.message,true)));
  $('uploadThumbnailBtn').addEventListener('click',async()=>{
    if(!user)return;
    const file=$('thumbnailFile').files[0];
    if(!file){status('Choose an image to upload.',true);return;}
    const allowed={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
    if(!allowed[file.type]||file.size>5*1024*1024){
      status('Select a JPG, PNG, WebP or GIF under 5 MB.',true);return;
    }
    const button=$('uploadThumbnailBtn');button.disabled=true;status('Uploading thumbnail…');
    try{
      const path=user.id+'/'+crypto.randomUUID()+'.'+allowed[file.type];
      const {error}=await api.storage.from('ability-chess-community').upload(path,file,
        {contentType:file.type,cacheControl:'3600',upsert:false});
      if(error)throw error;
      const {data}=api.storage.from('ability-chess-community').getPublicUrl(path);
      const url=lib.safeUrl(data?.publicUrl);
      if(!url)throw Error('Unable to retrieve uploaded thumbnail URL.');
      $('postThumbnail').value=url;updateThumb();status('Thumbnail uploaded. Save the post to keep it.');
    }catch(e){status('Thumbnail upload failed: '+(e.message||e),true);}
    finally{button.disabled=false;}
  });
  async function start(){
    if(!api||!lib){status('Unable to load the editor. Refresh this page.',true);return;}
    try{
      const {data,error}=await api.auth.getUser();
      if(error||!data?.user)throw Error('Sign in on Ability Chess to use the editor.');
      user=data.user;
      const {data:isAdmin,error:roleError}=await api.rpc('ability_chess_is_admin',{p_user_id:user.id});
      if(roleError)throw roleError;
      if(!isAdmin)throw Error('Only Ability Chess administrators can publish community posts.');
      $('editorApp').hidden=false;
      await reload(null);
      status('Ready to write. Drafts are visible only to administrators.');
    }catch(e){status(e.message||String(e),true);}
  }
  start();
})();
