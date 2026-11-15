(function(){
  'use strict';
  const SUPABASE_URL='https://cczvdpofddjghqoeiqew.supabase.co';
  const KEY='sb_publishable_1j0iGD0GxwBdhac9suyPSw_5CPJGvaM';
  const api=window.supabase?.createClient?.(SUPABASE_URL,KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const clean=window.AbilityChessCommunity;
  const feed=document.getElementById('communityFeed'),detail=document.getElementById('communityDetail'),status=document.getElementById('communityStatus');
  let posts=[],filter='all';
  const make=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x;};
  const date=t=>t?new Date(t).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}):'';
  function meta(post){
    const m=make('div','post-meta');
    m.append(make('span','pill',post.kind==='announcement'?'Announcement':post.kind==='update'?'Update':'News'));
    m.append(make('span','',date(post.published_at)));
    if(post.pinned)m.append(make('span','pinned','Featured'));
    return m;
  }
  function picture(post){
    const url=clean.safeUrl(post.thumbnail_url);
    if(!url)return null;
    const image=document.createElement('img');image.loading='lazy';image.src=url;image.alt='';image.referrerPolicy='no-referrer';return image;
  }
  function drawFeed(){
    detail.hidden=true;feed.hidden=false;
    document.querySelector('.filters').hidden=false;feed.replaceChildren();
    const shown=posts.filter(p=>filter==='all'||p.kind===filter);
    if(!shown.length){feed.append(make('p','empty','No announcements yet. Check back soon.'));return;}
    for(const post of shown){
      const card=make('article','post-card'),img=picture(post);if(img)card.append(img);
      const inside=make('div','post-body');inside.append(meta(post),make('h2','',post.title));
      if(post.summary)inside.append(make('p','',post.summary));
      const b=make('button','','Read article');
      b.type='button';b.addEventListener('click',()=>openPost(post.id));inside.append(b);card.append(inside);feed.append(card);
    }
  }
  function openPost(id,updateAddress=true){
    const post=posts.find(p=>p.id===id);
    if(!post){history.replaceState(null,'','community.html');drawFeed();return;}
    feed.hidden=true;detail.hidden=false;
    document.querySelector('.filters').hidden=true;detail.replaceChildren();
    const back=make('button','action','Back to news');
    back.type='button';back.addEventListener('click',()=>{history.pushState(null,'','community.html');drawFeed();});
    const article=make('article','post-detail'),img=picture(post);if(img)article.append(img);
    const content=make('div','post-detail-content');
    content.append(meta(post),make('h1','',post.title));
    if(post.summary)content.append(make('p','summary',post.summary));
    const body=make('div','rich-body');body.innerHTML=clean.clean(post.body_html);content.append(body);
    article.append(content);detail.append(back,article);
    back.style.marginBottom='18px';
    if(updateAddress){const u=new URL(location.href);u.searchParams.set('post',id);history.pushState(null,'',u);}
  }
  async function load(){
    if(!api||!clean){status.textContent='Unable to load the Community page.';return;}
    try {
      const {data,error}=await api.from('ability_chess_community_posts')
        .select('id,title,summary,kind,body_html,thumbnail_url,pinned,published_at')
        .eq('status','published').lte('published_at',new Date().toISOString())
        .order('pinned',{ascending:false}).order('published_at',{ascending:false}).limit(100);
      if(error)throw error;
      posts=data||[];status.textContent='';
      const selected=new URLSearchParams(location.search).get('post');
      if(selected)openPost(selected,false);else drawFeed();
    }catch(err){
      feed.replaceChildren(make('p','empty','News is temporarily unavailable.'));
      status.textContent=err.message||'Unable to load posts.';
    }
  }
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
    filter=b.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});
    drawFeed();
  }));
  window.addEventListener('popstate',()=>{
    const id=new URLSearchParams(location.search).get('post');
    if(id)openPost(id,false);else drawFeed();
  });
  load();
})();
