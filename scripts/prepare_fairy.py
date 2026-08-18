#!/usr/bin/env python3
"""Prepare the pinned Fairy-Stockfish checkout for AbilityFish development."""
from pathlib import Path
import shutil
import subprocess
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: prepare_fairy.py PATH_TO_FAIRY_STOCKFISH")

repo = Path(sys.argv[1]).resolve()
src = repo / "src"
if not (src / "position.cpp").exists() or not (src / "search.cpp").exists():
    raise SystemExit(f"not a Fairy-Stockfish tree: {repo}")

root = Path(__file__).resolve().parents[1]
kernel = root / "engine" / "src"
dest = src / "abilityfish"
dest.mkdir(exist_ok=True)
for name in (
    "ability_action.cpp", "ability_action.h",
    "ability_state.cpp", "ability_state.h",
    "ability_rules.cpp", "ability_rules.h",
    "search_semantics.h",
):
    shutil.copy2(kernel / name, dest / name)

mk_js = src / "Makefile_js"
js = mk_js.read_text()
js_needle = "search.cpp thread.cpp timeman.cpp tt.cpp uci.cpp ucioption.cpp tune.cpp syzygy/tbprobe.cpp \\\n"
js_add = js_needle + "\tabilityfish/ability_action.cpp abilityfish/ability_state.cpp abilityfish/ability_rules.cpp \\\n"
if "abilityfish/ability_action.cpp" not in js:
    if js_needle not in js:
        raise SystemExit("Makefile_js anchor changed; refusing an unsafe patch")
    js = js.replace(js_needle, js_add, 1)
    mk_js.write_text(js)

mk_native = src / "Makefile"
ns = mk_native.read_text()
native_needle = "search.cpp thread.cpp timeman.cpp tt.cpp uci.cpp ucioption.cpp tune.cpp syzygy/tbprobe.cpp \\\n"
native_add = native_needle + "\tabilityfish/ability_action.cpp abilityfish/ability_state.cpp abilityfish/ability_rules.cpp \\\n"
if "abilityfish/ability_action.cpp" not in ns:
    if native_needle not in ns:
        raise SystemExit("Makefile native source anchor changed; refusing an unsafe patch")
    ns = ns.replace(native_needle, native_add, 1)
if "VPATH = syzygy:nnue:nnue/features:abilityfish" not in ns:
    vpath = "VPATH = syzygy:nnue:nnue/features\n"
    if vpath not in ns:
        raise SystemExit("Makefile VPATH anchor changed; refusing an unsafe patch")
    ns = ns.replace(vpath, "VPATH = syzygy:nnue:nnue/features:abilityfish\n", 1)
mk_native.write_text(ns)

# The pinned Fairy revision has a couple of harmless blank-line differences
# around otherwise stable Position anchors. Normalize only those exact forms so
# the hook scripts can keep strict one-anchor safety checks.
position_cpp = src / "position.cpp"
pos_text = position_cpp.read_text()
normalizations = (
    ("  var = v;\n\n  ss >> std::noskipws;\n",
     "  var = v;\n  ss >> std::noskipws;\n"),
    ("  sideToMove = ~sideToMove;\n\n  if (counting_rule())\n",
     "  sideToMove = ~sideToMove;\n  if (counting_rule())\n"),
)
for old, new in normalizations:
    if old in pos_text and new not in pos_text:
        pos_text = pos_text.replace(old, new, 1)
position_cpp.write_text(pos_text)

(dest / "UPSTREAM_INTEGRATION_STATUS.txt").write_text(
    "AbilityFish kernel installed; Position, frozen attacks, Ambush, recursive search, root transport, and UCI hooks applied.\n"
)

for script in (
    "apply_fairy_position_hooks.py",
    "apply_fairy_freeze_attack_hooks.py",
    "apply_fairy_ambush_hooks.py",
    "apply_fairy_search_hooks.py",
    "apply_fairy_root_hooks.py",
    "apply_fairy_protocol_hooks.py",
):
    subprocess.check_call([sys.executable, str(root / "scripts" / script), str(repo)])

print("Prepared Fairy-Stockfish tree:", repo)
