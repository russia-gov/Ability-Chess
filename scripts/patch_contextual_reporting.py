#!/usr/bin/env python3
"""Embed admin tools in Admin, and place report actions on individual messages."""
from pathlib import Path
import sys

path=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
s=path.read_text(encoding='utf-8')
marker='ABILITY_CHESS_CONTEXTUAL_MESSAGE_REPORTS_V1'
if marker in s:
    print('Contextual reporting already integrated')
    raise SystemExit(0)

def swap(needle,replacement,count=1):
    global s
    found=s.count(needle)
    if found!=count:
        raise RuntimeError(f'Expected {count} occurrences of {needle[:95]!r}, found {found}')
    s=s.replace(needle,replacement,count)

# Remove the separate page links added by the two earlier releases.
# They are re-injected by their packaging scripts in a reproducible build.
start='  // ABILITY_CHESS_ADMIN_DIRECTORY_NAV_V1'
end='  const originalUpdateSidebarAccounts=updateSidebarAccounts;'
if start in s:
    left=s.index(start)
    right=s.index(end,left)
    s=s[:left]+s[right:]

# Keep all management tools under Admin rather than adding site-wide sidebar links.
swap('ensureAdminFoundationCards();loadModerationFoundation();}',
     'ensureAdminFoundationCards();loadModerationFoundation();ensureAdminManagementTabs();}')
# A report is attached to the original message ID, never a conversation-wide menu.
swap('thread.appendChild(bubble);',
     "if(m.id && String(m.sender_id)!==String(memberProfile?.id))bubble.appendChild(makeMessageReportButton('dm',m.id));thread.appendChild(bubble);")
swap("  async function refreshTournamentChat(){",
     """    if(m.id && String(m.username||'').toLowerCase()!==String(memberProfile?.username||'').toLowerCase()){
      messages.lastElementChild?.appendChild(makeMessageReportButton('tournament',m.id));
    }
  }
  async function refreshTournamentChat(){""")
# Previous substitution inserts an extra closing brace into the original function.
swap('  function appendTournamentChatMessage(messages,m){\n', '  function appendTournamentChatMessage(messages,m){\n')
# Restore one, rather than two, closing braces before refreshTournamentChat.
swap('    }\n  }\n  async function refreshTournamentChat(){','    }\n  async function refreshTournamentChat(){')
swap('gameChatLastId=Math.max(gameChatLastId,Number(m.id)||0);',
     """if(m.id && String(m.username||'').toLowerCase()!==String(memberProfile?.username||'').toLowerCase()){
        box.lastElementChild?.appendChild(makeMessageReportButton('game',m.id));
      }
      gameChatLastId=Math.max(gameChatLastId,Number(m.id)||0);""")
# Function declarations are hoisted; existing game/chat functions can call these.
anchor='  const originalUpdateSidebarAccounts=updateSidebarAccounts;'
if s.count(anchor)!=1:raise RuntimeError('Missing sidebar integration anchor')
extra=r'''  // ABILITY_CHESS_CONTEXTUAL_MESSAGE_REPORTS_V1
  function makeMessageReportButton(kind,messageId){
    const button=document.createElement('button');
    button.type='button';
    button.className='message-report-btn';
    button.textContent='Report';
    button.title='Report this specific message to moderators';
    button.setAttribute('aria-label','Report this message');
    button.addEventListener('click',async event=>{
      event.preventDefault();event.stopPropagation();
      if(!memberSession){openMemberLobby();return;}
      const reason=prompt('Why are you reporting this message? (3–80 characters)');
      if(reason===null)return;
      const clean=reason.trim();
      if(clean.length<3||clean.length>80){alert('Please enter a reason between 3 and 80 characters.');return;}
      const details=prompt('Additional context (optional; max 700 characters):','');
      if(details===null)return;
      if(!confirm('Send this message to Ability-Chess moderators for review?'))return;
      button.disabled=true;
      const old=button.textContent;
      button.textContent='Reporting…';
      try{
        if(kind==='dm')await memberRpc('ability_chess_dm_report_message',{
          p_message_id:Number(messageId),p_reason:clean,p_details:details.slice(0,700)
        });
        else await memberRpc('ability_chess_report_chat_message',{
          p_kind:kind,p_message_id:Number(messageId),p_reason:clean,p_details:details.slice(0,700)
        });
        button.textContent='Reported';
        button.title='Message reported to moderators';
      }catch(error){
        button.disabled=false;button.textContent=old;
        alert('Unable to report this message: '+(error.message||error));
      }
    });
    return button;
  }
  function ensureAdminManagementTabs(){
    const root=document.getElementById('adminScreen');
    if(!root||!memberProfile||(memberProfile.is_owner!==true&&memberProfile.is_staff!==true))return;
    const main=root.querySelector('.admin-main');
    const grid=main?.querySelector('.admin-grid');
    if(!main||!grid||main.querySelector('#adminManagementTabs'))return;
    const tabs=document.createElement('div');
    tabs.id='adminManagementTabs';tabs.className='admin-management-tabs';
    const panels={};
    const existing=grid;
    const members=document.createElement('section');
    members.className='admin-embedded-section';
    members.hidden=true;
    const memberFrame=document.createElement('iframe');
    memberFrame.title='Admin member directory';
    memberFrame.loading='lazy';
    memberFrame.dataset.src='admin-directory.html?embedded=1';
    members.appendChild(memberFrame);
    const reports=document.createElement('section');
    reports.className='admin-embedded-section';
    reports.hidden=true;
    const reportFrame=document.createElement('iframe');
    reportFrame.title='Direct message reports';
    reportFrame.loading='lazy';
    reportFrame.dataset.src='dm-safety.html?embedded=1#reports';
    reports.appendChild(reportFrame);
    panels.overview=existing;panels.members=members;panels.reports=reports;
    main.insertBefore(tabs,grid);
    grid.after(members,reports);
    const buttons={};
    const activate=name=>{
      for(const [id,panel] of Object.entries(panels))panel.hidden=id!==name;
      for(const [id,button] of Object.entries(buttons)){
        button.classList.toggle('active',id===name);
        button.setAttribute('aria-selected',id===name?'true':'false');
      }
      const frame=name==='members'?memberFrame:name==='reports'?reportFrame:null;
      if(frame&&!frame.src)frame.src=frame.dataset.src;
    };
    for(const [id,label] of [['overview','Overview & moderation'],['members','Member directory'],['reports','DM reports']]){
      const button=document.createElement('button');
      button.type='button';
      button.textContent=label;
      button.setAttribute('role','tab');
      button.setAttribute('aria-controls',id==='overview'?'':id);
      button.addEventListener('click',()=>activate(id));
      buttons[id]=button;tabs.appendChild(button);
    }
    tabs.setAttribute('role','tablist');
    activate('overview');
  }
'''
s=s.replace(anchor,extra+anchor,1)
style="""<style id="contextual-message-report-style">
.message-report-btn{font:inherit;font-size:11px;line-height:1.3;padding:3px 7px;margin:5px 0 0;border:1px solid #53667a;border-radius:6px;background:transparent;color:#b5c7d9;cursor:pointer}
.message-report-btn:hover{background:#394757;color:white}
.message-report-btn:disabled{opacity:.65;cursor:default}
.admin-management-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}
.admin-management-tabs button{padding:10px 13px;border:1px solid #465665;border-radius:9px;background:#242d37;color:#e9eff6}
.admin-management-tabs button.active{background:#485e36;border-color:#9ab978}
.admin-embedded-section{min-width:0}
.admin-embedded-section[hidden]{display:none!important}
.admin-embedded-section iframe{display:block;width:100%;height:min(78vh,900px);min-height:540px;border:1px solid #374a61;border-radius:12px;background:#121b25}
</style>
"""
swap('</head>',style+'</head>')
path.write_text(s,encoding='utf-8')
print('Integrated admin tabs and per-message report actions')
