#!/usr/bin/env python3
"""Add minimal UCI controls needed to exercise AbilityFish search."""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: apply_fairy_protocol_hooks.py PATH_TO_FAIRY_STOCKFISH")
root=Path(sys.argv[1]).resolve(); p=root/'src'/'uci.cpp'
if not p.exists(): raise SystemExit(f"not a Fairy-Stockfish checkout: {root}")
s=p.read_text()
if 'ABILITYFISH_UCI_HOOKS_V1' in s:
    print('AbilityFish UCI hooks already applied'); raise SystemExit(0)
anchor='''      else if (token == "setoption")  setoption(is);\n      // UCCI-specific banmoves command\n'''
hook='''      else if (token == "setoption")  setoption(is);\n      // ABILITYFISH_UCI_HOOKS_V1\n      else if (token == "abilityfish")\n      {\n          std::string mode; is >> mode;\n          pos.set_abilityfish_active(mode != "off" && mode != "0" && mode != "false");\n          sync_cout << "info string abilityfish " << (pos.abilityfish_active() ? "on" : "off") << sync_endl;\n      }\n      else if (token == "abilitypoints")\n      {\n          int white = 0, black = 0; is >> white >> black;\n          pos.set_abilityfish_active(true);\n          auto& ast = pos.ability_state();\n          ast.side[abilityfish::side_index(abilityfish::Side::White)].points = uint8_t(std::clamp(white, 0, 255));\n          ast.side[abilityfish::side_index(abilityfish::Side::Black)].points = uint8_t(std::clamp(black, 0, 255));\n          ast.recompute_key();\n          sync_cout << "info string abilitypoints " << white << " " << black << sync_endl;\n      }\n      // UCCI-specific banmoves command\n'''
if s.count(anchor)!=1: raise SystemExit(f'uci anchor expected once, found {s.count(anchor)}')
s=s.replace(anchor,hook,1); p.write_text(s)
print('Applied AbilityFish UCI hooks')
