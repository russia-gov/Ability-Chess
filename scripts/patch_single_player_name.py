#!/usr/bin/env python3
"""Present one public name per player without changing stable account identifiers."""
from pathlib import Path
import sys

path=Path(sys.argv[1] if len(sys.argv)>1 else 'index.html')
source=path.read_text(encoding='utf-8')
marker='ABILITY_CHESS_SINGLE_PUBLIC_NAME_V1'
if marker in source:
    print('Single public name already installed')
    raise SystemExit(0)

def replace_once(before,after,label):
    global source
    count=source.count(before)
    if count!=1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    source=source.replace(before,after,1)

# Retain the stable unique username for profile URLs, RPCs and data matching.
# A user only sees and edits the public player name (display_name).
replace_once('<input id="profileUsername" maxlength="20" placeholder="Username">',
             '<input id="profileUsername" type="hidden" maxlength="20">',
             'account technical username field')
replace_once('<input id="profileDisplayName" maxlength="40" placeholder="Display name">',
             '<input id="profileDisplayName" maxlength="40" placeholder="Player name" aria-label="Player name">',
             'player name field')
replace_once('profilePageHandle.innerHTML=`<span class="player-username" data-player-username="${escapeHtml(m.username||\'\')}">@${escapeHtml(m.username||\'\')}</span>`;',
             "profilePageHandle.textContent='';",
             'profile duplicate handle')
replace_once("profilePageHandle.textContent=requested?`@${requested}`:'Sign in to view this profile';",
             "profilePageHandle.textContent=requested?'':'Sign in to view this profile';",
             'profile fallback handle')
replace_once('${escapeHtml(m.display_name)} (@${escapeHtml(m.username)})${roleTagHtml(m)}',
             '${escapeHtml(m.display_name||m.username)}${roleTagHtml(m)}',
             'play member search')
replace_once('<div class="sidebar-search-name">${roleTagHtml(m)}${escapeHtml(m.display_name)}</div><div class="sidebar-search-meta"><span class="sidebar-search-username">@${escapeHtml(m.username)}</span> · ${m.rating}</div>',
             '<div class="sidebar-search-name">${roleTagHtml(m)}${escapeHtml(m.display_name||m.username)}</div><div class="sidebar-search-meta">Rating ${m.rating}</div>',
             'sidebar member search')
replace_once('meta.innerHTML=`<span class="player-username" data-player-username="${escapeHtml(memberProfile.username)}">@${escapeHtml(memberProfile.username)}</span> · B ${memberProfile.bullet_rating??1200} · Z ${memberProfile.blitz_rating??1200} · R ${memberProfile.rapid_rating??1200}`',
             'meta.innerHTML=`B ${memberProfile.bullet_rating??1200} · Z ${memberProfile.blitz_rating??1200} · R ${memberProfile.rapid_rating??1200}`',
             'account sidebar handle')
replace_once('<div class="member-meta"><span class="player-username" data-player-username="${escapeHtml(f.username)}">@${escapeHtml(f.username)}</span> · ${f.status}</div>',
             '<div class="member-meta">${f.status}</div>',
             'friends list handle')
replace_once('b.textContent=`${m.display_name} (@${m.username})`;',
             'b.textContent=m.display_name||m.username;',
             'award member picker')
replace_once('<div class="player-preview-handle">@${escapeHtml(m.username)}</div>',
             '',
             'player hovercard handle')
replace_once('<div class="history-meta">@${escapeHtml(member.username||\'\')}</div><div class="direct-message-thread"',
             '<div class="direct-message-thread"',
             'direct message header')
replace_once('sub:`@${p.username} · B ${p.bullet_rating??1200} · Z ${p.blitz_rating??1200} · R ${p.rapid_rating??1200}`',
             'sub:`B ${p.bullet_rating??1200} · Z ${p.blitz_rating??1200} · R ${p.rapid_rating??1200}`',
             'global player search')
replace_once('memberIdentity.innerHTML=`${escapeHtml(memberProfile.display_name)} (<span class="player-username" data-player-username="${escapeHtml(memberProfile.username)}">@${escapeHtml(memberProfile.username)}</span>)${roleTagHtml(memberProfile)}`',
             'memberIdentity.innerHTML=`${escapeHtml(memberProfile.display_name||memberProfile.username)}${roleTagHtml(memberProfile)}`',
             'account modal identity')
replace_once('memberChallengeSetupTarget.textContent=member?`Challenge ${member.display_name} (@${member.username}). Choose the rules before sending.`',
             'memberChallengeSetupTarget.textContent=member?`Challenge ${member.display_name||member.username}. Choose the rules before sending.`',
             'challenge dialog')
replace_once('memberRow(`${m.display_name} (@${m.username})`',
             'memberRow(`${m.display_name||m.username}`',
             'member browse list')
replace_once('`${c.other_display_name} (@${c.other_username})`',
             '`${c.other_display_name}`',
             'challenge list name')
replace_once('`@${challenge.other_username||\'A member\'}`',
             '`${challenge.other_username||\'A member\'}`',
             'incoming challenge fallback')
replace_once("const mine=memberProfile?.username?`@${memberProfile.username}`:'';",
             "const mine=memberProfile?.display_name||memberProfile?.username||'';",
             'game player status name')
# Incoming and outgoing challenge toasts both previously repeated the handle.
needle='`${challenge.other_display_name} (@${challenge.other_username})`'
if source.count(needle)!=2:
    raise SystemExit(f'challenge toasts: expected two, found {source.count(needle)}')
source=source.replace(needle,'`${challenge.other_display_name}`')
# Leave the admin/role/access system intact; it continues to use the UUID
# and unique username behind the scenes.
source=source.replace('</head>','<!-- '+marker+' -->\n</head>',1)
path.write_text(source,encoding='utf-8')
print('Installed single visible player name')
