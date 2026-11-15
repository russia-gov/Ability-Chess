/* Shared, allowlist-based rich-text rendering for community posts. */
(function(global){
  'use strict';
  const tags=new Set(['P','DIV','H2','H3','H4','B','STRONG','I','EM','U','S','UL','OL','LI','BLOCKQUOTE','BR','SPAN','A','FONT']);
  const fonts=['Arial','Georgia','Verdana','Trebuchet MS','Times New Roman','Courier New'];
  const sizeMap={'1':12,'2':14,'3':16,'4':20,'5':24,'6':30,'7':36};
  function safeUrl(raw){
    try {const u=new URL(String(raw||''));return u.protocol==='https:'?u.href:'';} catch{return '';}
  }
  function color(raw) {
    const v=String(raw||'').trim();
    return (/^#[0-9a-f]{3,8}$/i.test(v)||/^rgba?\([\d\s.,%]+\)$/i.test(v))?v:'';
  }
  function safeFont(raw){
    const s=String(raw||'').replace(/["']/g,'').trim().toLowerCase();
    return fonts.find(f=>f.toLowerCase()===s)||'';
  }
  function safeSize(raw){
    const v=String(raw||'').trim();
    const n=Number(v.replace(/px$/,''));
    return /^\d+(\.\d+)?(px)?$/.test(v)&&n>=12&&n<=36?n+'px':'';
  }
  function clean(html){
    const parsed=new DOMParser().parseFromString('<div id="root">'+String(html||'')+'</div>','text/html');
    const root=parsed.getElementById('root');
    const output=document.createElement('div');
    let visited=0;
    function visit(node,dest,depth){
      if(depth>35||++visited>10000)return;
      if(node.nodeType===Node.TEXT_NODE){dest.appendChild(document.createTextNode(node.textContent||''));return;}
      if(node.nodeType!==Node.ELEMENT_NODE)return;
      const tag=node.tagName.toUpperCase();
      // Do not preserve the contents of executable or embedded elements.
      if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','VIDEO','AUDIO','TEMPLATE'].includes(tag))return;
      if(!tags.has(tag)){for(const c of Array.from(node.childNodes))visit(c,dest,depth+1);return;}
      const normal=tag==='FONT'?'SPAN':tag==='DIV'?'P':tag;
      const el=document.createElement(normal.toLowerCase());
      if(tag==='A'){
        const href=safeUrl(node.getAttribute('href'));
        if(href){el.href=href;el.target='_blank';el.rel='noopener noreferrer';}
      }
      if(tag==='FONT'){
        const c=color(node.getAttribute('color'));if(c)el.style.color=c;
        const f=safeFont(node.getAttribute('face'));if(f)el.style.fontFamily=f;
        const size=sizeMap[node.getAttribute('size')];if(size)el.style.fontSize=size+'px';
      }
      const css=node.style;
      if(css){
        const c=color(css.color),bg=color(css.backgroundColor),f=safeFont(css.fontFamily),sz=safeSize(css.fontSize);
        if(c)el.style.color=c;
        if(bg)el.style.backgroundColor=bg;
        if(f)el.style.fontFamily=f;
        if(sz)el.style.fontSize=sz;
        if(['left','center','right','justify'].includes(css.textAlign))el.style.textAlign=css.textAlign;
      }
      if(tag!=='BR')for(const c of Array.from(node.childNodes))visit(c,el,depth+1);
      dest.appendChild(el);
    }
    for(const n of Array.from(root.childNodes))visit(n,output,0);
    return output.innerHTML;
  }
  global.AbilityChessCommunity=Object.freeze({clean,safeUrl,fonts});
})(window);
