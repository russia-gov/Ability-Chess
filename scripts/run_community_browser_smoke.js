#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const posts=[];
const server=http.createServer((req,res)=>{
  let name=decodeURIComponent(String(req.url||'/').split('?')[0]);
  if(name==='/')name='/index.html';
  const filepath=path.resolve(root,'.'+name);
  if(!filepath.startsWith(root+path.sep)||!fs.existsSync(filepath)||fs.statSync(filepath).isDirectory()){
    res.writeHead(404).end('not found');return;
  }
  res.writeHead(200,{'Content-Type':mime[path.extname(filepath)]||'application/octet-stream'});
  fs.createReadStream(filepath).pipe(res);
});
(async()=>{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const home='http://127.0.0.1:'+server.address().port+'/';
    const post={
      id:'11111111-1111-4111-8111-111111111111',kind:'announcement',status:'published',
      title:'First tournament',summary:'Sign up this week.',body_html:'<p><strong>Play</strong> this weekend.</p><img src=x onerror=alert(1)><script>alert(1)</script>',
      pinned:true,published_at:new Date().toISOString(),created_at:new Date().toISOString()
    };
    posts.push(post);
    await page.route('**/rest/v1/ability_chess_community_posts*',async r=>{
      const method=r.request().method();
      if(method==='GET')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(posts)});
      if(method==='POST'){
        const body=JSON.parse(r.request().postData()||'{}');
        const record={...body,id:'22222222-2222-4222-8222-222222222222',created_at:new Date().toISOString()};
        posts.push(record);
        return r.fulfill({status:201,contentType:'application/json',body:JSON.stringify([record])});
      }
      return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([])});
    });
    await page.route('**/auth/v1/user',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      id:'browser-smoke-owner',aud:'authenticated',role:'authenticated',
      email:'editor@example.invalid',app_metadata:{provider:'email'},user_metadata:{}
    })}));
    await page.route('**/rest/v1/rpc/**',async r=>{
      const name=new URL(r.request().url()).pathname.split('/').pop();
      const profile={id:'browser-smoke-owner',username:'smoke_owner',display_name:'Browser Owner',
        is_owner:true,is_staff:false,bullet_rating:1200,blitz_rating:1200,rapid_rating:1200};
      const payload=name==='ability_chess_is_admin'||name==='ability_chess_is_owner'?true
        :name==='ability_chess_get_my_profile_v2'||name==='ability_chess_profile_extras'?[profile]
        :name==='ability_chess_get_my_ratings'?[{bullet_rating:1200,blitz_rating:1200,rapid_rating:1200}]
        :name==='ability_chess_get_my_challenge_inbox_key'?'browser-key':[];
      await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
    });
    await page.goto(home,{waitUntil:'domcontentloaded'});
    await page.locator('.community-nav-btn').first().click();
    await page.waitForURL('**/community.html');
    await page.locator('.community-rail').waitFor({state:'visible'});
    await page.locator('.community-nav a.current[aria-current="page"]').waitFor({state:'visible'});
    if(await page.locator('#communitySidebarAdmin').isVisible())
      throw Error('Admin link visible to guest on Community');
    const gradient=await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundImage);
    if(!gradient.includes('radial-gradient'))throw Error('Community background gradient was lost');
    await page.getByText('First tournament').waitFor();
    await page.locator('.community-nav a[href="./?communityNav=analysis"]').click();
    await page.waitForTimeout(800);
    const routeDebug=await page.evaluate(()=>({
      url:location.href,
      analysisCount:document.querySelectorAll('#analysisScreen,.analysis-screen').length,
      active:[...document.querySelectorAll('.screen.active')].map(el=>el.id),
      selection:[...document.querySelectorAll('.analysis-screen')].map(el=>({id:el.id,classes:el.className})),
      nav:[...document.querySelectorAll('.analysis-nav-btn')].map(el=>el.className)
    }));
    if(!routeDebug.active.some(id=>/analysis/i.test(id))&&!routeDebug.selection.some(el=>/active/.test(el.classes)))
      throw Error('Community → Analysis did not activate Analysis: '+JSON.stringify(routeDebug));
    await page.goto(home+'community.html',{waitUntil:'domcontentloaded'});
    await page.getByText('First tournament').waitFor();
    await page.getByRole('button',{name:'Read article'}).click();
    if(await page.locator('#communityFeed').isVisible()) throw Error('News feed remained visible behind the open article');
    await page.getByText('Play this weekend.').waitFor();
    if(await page.locator('.post-detail script,.post-detail img[src="x"]').count())
      throw Error('Untrusted HTML was not sanitized on published article');
    // Unauthenticated visitors must not see the draft editor.
    const guest=await browser.newPage();
    await guest.goto(home+'community-editor.html',{waitUntil:'domcontentloaded'});
    await guest.getByText('Sign in on Ability Chess to use the editor.').waitFor({timeout:20000});
    if(await guest.locator('#editorApp').isVisible())throw Error('Editor was visible without authentication');
    await guest.close();
    await page.goto(home,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>localStorage.setItem('abilityChessMemberSession',JSON.stringify({
      access_token:'browser-smoke-token',refresh_token:'browser-smoke-refresh',
      token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,
      user:{id:'browser-smoke-owner',aud:'authenticated',role:'authenticated'}
    })));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.admin-nav-btn').first().waitFor();
    await page.goto(home+'community.html',{waitUntil:'domcontentloaded'});
    await page.locator('#communitySidebarAdmin:not([hidden])').waitFor({timeout:20000});
    await page.locator('#communitySidebarAdmin').click();
    await page.locator('#adminScreen.active').waitFor({timeout:20000});
    await page.goto(home,{waitUntil:'domcontentloaded'});
    await page.locator('.admin-nav-btn').first().waitFor();
    await page.locator('.admin-nav-btn').first().click();
    await page.locator('#adminScreen.active').waitFor();
    await page.locator('#adminCommunityEditorToggle').click();
    const editor=page.frameLocator('#adminCommunityEditorFrame');
    await editor.locator('#editorApp:not([hidden])').waitFor({timeout:25000});
    await editor.locator('#newPostBtn').click();
    await editor.locator('#postTitle').fill('New Chess Feature');
    await editor.locator('#postSummary').fill('New abilities are available.');
    await editor.locator('#postKind').selectOption('update');
    await editor.locator('#postPinned').check();
    await editor.locator('#postBody').fill('The chessboard just got better.');
    await editor.locator('#previewPostBtn').click();
    await editor.locator('#editorPreview:not([hidden])').waitFor();
    await editor.locator('#publishBtn').click();
    await editor.getByText('Published! The article is visible in Community.').waitFor({timeout:20000});
    if(!posts.some(p=>p.title==='New Chess Feature'&&p.status==='published'&&p.kind==='update'&&p.pinned))
      throw Error('Publishing failed to save the expected post');
    if(errors.length)throw Error('Page JavaScript errors:\n'+errors.join('\n'));
    console.log('Community navigation, safe rendering, admin editor, preview and publishing smoke passed');
  }finally{await browser.close();await new Promise(ok=>server.close(ok));}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
