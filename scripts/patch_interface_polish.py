#!/usr/bin/env python3
"""Conservative interface polish for the existing one-file Ability Chess UI.

Generated-page patch: no gameplay logic or Analysis engine behavior changes.
Run from the repository root: python3 scripts/patch_interface_polish.py index.html
"""
from pathlib import Path
import sys

page = Path(sys.argv[1] if len(sys.argv) > 1 else "index.html")
html = page.read_text(encoding="utf-8")
marker = "ABILITY_CHESS_INTERFACE_POLISH_V1"
if marker in html:
    print("Interface polish already applied")
    raise SystemExit(0)

def once(before: str, after: str, title: str) -> None:
    global html
    count = html.count(before)
    if count != 1:
        raise SystemExit(f"{title}: expected exactly one anchor, got {count}")
    html = html.replace(before, after, 1)

once(
    '<h1>Chess, with another layer of strategy.</h1>',
    '<div class="home-preview-kicker">In development · Playable preview</div>\n'
    '        <h1>Chess, with another layer of strategy.</h1>',
    "homepage preview context",
)
once(
    '<p>Choose a quick preset, challenge a friend, or build a custom game. The three numbers represent time control, starting points, and maximum simultaneous upgrades.</p>',
    '<p>Choose a quick preset, challenge a friend, or build a custom game. Each preset shows the minutes per side, starting points, and the maximum number of upgraded piece types.</p>',
    "play preset explanation",
)
once(
    '<input id="playFriendSearch" class="play-input" placeholder="Search accepted friends">',
    '<input id="playFriendSearch" class="play-input" placeholder="Search accepted friends" aria-label="Search accepted friends" autocomplete="off">',
    "friend search accessible label",
)
once(
    '<input id="customFriendSearch" class="play-input" placeholder="Optional: search a specific player">',
    '<input id="customFriendSearch" class="play-input" placeholder="Optional: search a specific player" aria-label="Search a player for a custom challenge" autocomplete="off">',
    "custom challenge search accessible label",
)
once(
    '<div id="analysisEngineMeta" class="analysis-engine-meta">Engine is off.</div>',
    '<p class="analysis-wip-note" role="note"><strong>Experimental Analysis (WIP).</strong> Evaluations can be slow, change during search, or require recalculation. Game results are unaffected.</p>\n'
    '          <div id="analysisEngineMeta" class="analysis-engine-meta">Engine is off.</div>',
    "analysis disclosure",
)

css = r"""
/* ABILITY_CHESS_INTERFACE_POLISH_V1
   Limited to presentation, accessibility, and responsive layout.
   Do not change board state, abilities, clocks, or engine behavior here. */
:root{color-scheme:dark}
.home-preview-kicker{
  display:inline-flex;align-items:center;gap:8px;
  padding:7px 11px;border:1px solid #52643b;border-radius:999px;
  background:#263020;color:#d4e9b2;font-size:12px;font-weight:800;
  letter-spacing:.025em
}
.proper-home-hero h1{max-width:14ch;text-wrap:balance}
.proper-home-hero>p{max-width:64ch}
.home-action-card,.play-section,.play-hub-preview{
  border-color:#43505c;
  box-shadow:0 6px 24px rgba(0,0,0,.17)
}
.home-action-card h2,.play-section h2{letter-spacing:-.015em}
.home-action-card p,.play-section p{font-size:14px;line-height:1.55;color:#bdc9d5}
.bot-difficulty{min-height:68px}
.bot-difficulty.selected{
  border-color:#b5d47f;
  box-shadow:inset 0 0 0 1px rgba(181,212,127,.35)
}
.play-section input[type="text"],
.play-section input:not([type]),.play-section select,
.bot-settings-grid input{font-size:16px;min-width:0}
.play-section .game-rule-row label,.home-bot-options .game-rule-row label{
  display:inline-flex;align-items:center;gap:7px;
  min-height:38px;padding:4px 8px;border-radius:8px;
}
.home-action-card button:focus-visible,
.play-section button:focus-visible,
.home-nav-item:focus-visible,
.proper-home-actions button:focus-visible,
.bot-difficulty:focus-visible,
.play-section input:focus-visible,
.play-section select:focus-visible,
.home-bot-options summary:focus-visible{
  outline:3px solid #c6e48d;outline-offset:3px
}
.analysis-wip-note{
  margin:0 0 10px;padding:10px 12px;
  border-left:3px solid #e2b557;border-radius:8px;
  background:#28271e;color:#e2dbc8;font-size:12px;line-height:1.5
}
.analysis-wip-note strong{color:#ffdc88}
@media(max-width:900px){
  /* Keep navigation visible on small Play screens, where it was hidden. */
  .play-hub-screen.active>.site-ribbon{
    display:flex;position:relative!important;height:auto!important;min-height:auto!important;
    flex-direction:row;align-items:center;gap:12px;
    padding:10px 12px;border-right:0;border-bottom:1px solid #35414d;
  }
  .play-hub-screen.active>.site-ribbon .home-nav{
    display:flex;overflow-x:auto;gap:6px;min-width:0
  }
  .play-hub-screen.active>.site-ribbon .home-nav-item{
    width:auto;white-space:nowrap;padding:10px 12px
  }
  .play-hub-main{padding:14px}
  .play-hub-shell{min-width:0}
  .play-control-panel{min-width:0}
}
@media(max-width:640px){
  .proper-home-main{padding:22px 15px 40px!important}
  .proper-home-hero{padding:4px 0 22px}
  .proper-home-hero h1{font-size:clamp(36px,10vw,52px);letter-spacing:-1.4px}
  .proper-home-hero>p{font-size:16px;line-height:1.5}
  .proper-home-actions>button{flex:1 1 180px;min-height:46px}
  .proper-home-grid{min-width:0}
  .home-action-card{min-width:0}
  .play-section{padding:16px}
  .play-section p{font-size:14px}
  .play-section button,.proper-card-link{min-height:44px}
  .play-hub-screen.active>.site-ribbon{flex-wrap:wrap}
  .play-hub-screen.active>.site-ribbon .home-nav{width:100%}
  .play-hub-screen.active>.site-ribbon .home-nav-item{flex:0 0 auto}
}
@media(prefers-reduced-motion:reduce){
  .home-action-card,.play-card,.bot-difficulty,.home-nav-item{
    transition:none!important;animation:none!important
  }
  .home-action-card:hover,.play-card:hover{transform:none}
}
"""
if html.count("</style>") != 1:
    raise SystemExit("Expected a single stylesheet closing tag")
html = html.replace("</style>", css + "\n</style>", 1)
page.write_text(html, encoding="utf-8")
print("Applied conservative Ability Chess interface polish")
