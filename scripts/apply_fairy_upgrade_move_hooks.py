#!/usr/bin/env python3
"""Add AbilityFish permanent movement upgrades to Fairy move generation/search."""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: apply_fairy_upgrade_move_hooks.py PATH_TO_FAIRY_STOCKFISH")
root = Path(sys.argv[1]).resolve()
h = root / "src" / "position.h"
c = root / "src" / "position.cpp"
m = root / "src" / "movegen.cpp"
for p in (h,c,m):
    if not p.exists(): raise SystemExit(f"not a Fairy-Stockfish checkout: missing {p}")


def replace_once(text, old, new, label):
    n=text.count(old)
    if n!=1: raise SystemExit(f"{label}: expected one anchor, found {n}")
    return text.replace(old,new,1)

def insert_before_function_end(text, start, next_start, code, label):
    a=text.find(start)
    b=text.find(next_start,a+1)
    if a<0 or b<0: raise SystemExit(f"{label}: function boundary missing")
    segment=text[a:b]
    needle="  return b & board_bb(c, pt);\n}\n"
    pos=segment.rfind(needle)
    if pos<0: raise SystemExit(f"{label}: return anchor missing")
    segment=segment[:pos]+code+segment[pos:]
    return text[:a]+segment+text[b:]

def insert_before_return_b(text,start,next_start,code,label):
    a=text.find(start); b=text.find(next_start,a+1)
    if a<0 or b<0: raise SystemExit(f"{label}: function boundary missing")
    segment=text[a:b]
    needle="  return b;\n}\n"
    pos=segment.rfind(needle)
    if pos<0: raise SystemExit(f"{label}: return anchor missing")
    segment=segment[:pos]+code+segment[pos:]
    return text[:a]+segment+text[b:]

hs=h.read_text()
if "ABILITYFISH_UPGRADE_MOVE_HOOKS_V1" not in hs:
    marker='#define ABILITYFISH_FREEZE_ATTACK_HOOKS_V1 1\n'
    hs=replace_once(hs,marker,marker+'#define ABILITYFISH_UPGRADE_MOVE_HOOKS_V1 1\n',"upgrade marker")
    hs=replace_once(hs,
        '  bool abilityfish_active() const;\n',
        '  bool abilityfish_active() const;\n  int abilityfish_upgrade_code(Color c, PieceType pt) const;\n',
        'upgrade API declaration')

    common_attack=r'''  if (abilityfishActive)
  {
      const int up = abilityfish_upgrade_code(c, pt);
      const int f0 = int(file_of(s)), r0 = int(rank_of(s));
      const int forward = c == WHITE ? 1 : -1;
      auto addStep = [&](int df, int dr) {
          const int f=f0+df, r=r0+dr;
          if (f>=int(FILE_A) && f<=int(max_file()) && r>=int(RANK_1) && r<=int(max_rank()))
              b |= make_square(File(f),Rank(r));
      };
      auto addJumpLine = [&](int df, int dr) {
          bool crossedFriendly=false;
          for (int f=f0+df,r=r0+dr; f>=int(FILE_A)&&f<=int(max_file())&&r>=int(RANK_1)&&r<=int(max_rank()); f+=df,r+=dr)
          {
              Square q=make_square(File(f),Rank(r)); Piece pc=piece_on(q);
              if (!crossedFriendly)
              {
                  if (pc==NO_PIECE) continue;
                  if (color_of(pc)==c) { crossedFriendly=true; continue; }
                  break;
              }
              b |= q;
              if (pc!=NO_PIECE) break;
          }
      };
      auto addEscape = [&](int df,int dr) {
          const int mf=f0+df,mr=r0+dr,tf=f0+2*df,tr=r0+2*dr;
          if (mf<int(FILE_A)||mf>int(max_file())||mr<int(RANK_1)||mr>int(max_rank())||tf<int(FILE_A)||tf>int(max_file())||tr<int(RANK_1)||tr>int(max_rank())) return;
          Square mid=make_square(File(mf),Rank(mr));
          if (empty(mid)) b |= make_square(File(tf),Rank(tr));
      };
      if (pt==PAWN && up==int(abilityfish::Upgrade::Veteran)) { addStep(-1,-forward); addStep(1,-forward); }
      else if (pt==KNIGHT && up==int(abilityfish::Upgrade::Lancer)) { for(int df:{-1,1}) for(int dr:{-1,1}) addStep(df,dr); }
      else if (pt==KNIGHT && up==int(abilityfish::Upgrade::Charger)) addStep(0,forward);
      else if (pt==BISHOP && up==int(abilityfish::Upgrade::Cardinal)) { addStep(-1,0);addStep(1,0);addStep(0,-1);addStep(0,1); }
      else if (pt==BISHOP && up==int(abilityfish::Upgrade::Archbishop)) b |= PseudoAttacks[c][KNIGHT][s];
      else if (pt==ROOK && up==int(abilityfish::Upgrade::Bastion)) { addJumpLine(-1,0);addJumpLine(1,0);addJumpLine(0,-1);addJumpLine(0,1); }
      else if (pt==ROOK && up==int(abilityfish::Upgrade::Turret)) { for(int df:{-1,1}) for(int dr:{-1,1}) addStep(df,dr); }
      else if (pt==ROOK && up==int(abilityfish::Upgrade::Chancellor)) b |= PseudoAttacks[c][KNIGHT][s];
      else if (pt==QUEEN && up==int(abilityfish::Upgrade::PhaseStep)) { for(int df=-1;df<=1;df++) for(int dr=-1;dr<=1;dr++) if(df||dr) addJumpLine(df,dr); }
      else if (pt==KING && up==int(abilityfish::Upgrade::RoyalStep)) b |= PseudoAttacks[c][KNIGHT][s];
      else if (pt==KING && up==int(abilityfish::Upgrade::EscapeRoute)) { for(int df=-1;df<=1;df++) for(int dr=-1;dr<=1;dr++) if(df||dr) addEscape(df,dr); }
  }
'''
    hs=insert_before_function_end(hs,
        'inline Bitboard Position::attacks_from(Color c, PieceType pt, Square s) const {',
        'inline Bitboard Position::moves_from(Color c, PieceType pt, Square s) const {',
        common_attack,'upgrade attacks_from')

    common_moves=r'''  if (abilityfishActive)
  {
      const int up = abilityfish_upgrade_code(c, pt);
      const int f0 = int(file_of(s)), r0 = int(rank_of(s));
      const int forward = c == WHITE ? 1 : -1;
      auto addStep = [&](int df, int dr) {
          const int f=f0+df, r=r0+dr;
          if (f>=int(FILE_A) && f<=int(max_file()) && r>=int(RANK_1) && r<=int(max_rank()))
              b |= make_square(File(f),Rank(r));
      };
      auto addJumpLine = [&](int df, int dr) {
          bool crossedFriendly=false;
          for (int f=f0+df,r=r0+dr; f>=int(FILE_A)&&f<=int(max_file())&&r>=int(RANK_1)&&r<=int(max_rank()); f+=df,r+=dr)
          {
              Square q=make_square(File(f),Rank(r)); Piece pc=piece_on(q);
              if (!crossedFriendly)
              {
                  if (pc==NO_PIECE) continue;
                  if (color_of(pc)==c) { crossedFriendly=true; continue; }
                  break;
              }
              b |= q;
              if (pc!=NO_PIECE) break;
          }
      };
      auto addEscape = [&](int df,int dr) {
          const int mf=f0+df,mr=r0+dr,tf=f0+2*df,tr=r0+2*dr;
          if (mf<int(FILE_A)||mf>int(max_file())||mr<int(RANK_1)||mr>int(max_rank())||tf<int(FILE_A)||tf>int(max_file())||tr<int(RANK_1)||tr>int(max_rank())) return;
          Square mid=make_square(File(mf),Rank(mr));
          if (empty(mid)) b |= make_square(File(tf),Rank(tr));
      };
      if (pt==PAWN && up==int(abilityfish::Upgrade::Vanguard)) { addStep(-1,forward); addStep(1,forward); }
      else if (pt==PAWN && (up==int(abilityfish::Upgrade::ReverseGear)||up==int(abilityfish::Upgrade::Veteran))) addStep(0,-forward);
      else if (pt==KNIGHT && up==int(abilityfish::Upgrade::Lancer)) { for(int df:{-1,1}) for(int dr:{-1,1}) addStep(df,dr); }
      else if (pt==KNIGHT && up==int(abilityfish::Upgrade::Charger)) addStep(0,forward);
      else if (pt==BISHOP && (up==int(abilityfish::Upgrade::Cardinal)||up==int(abilityfish::Upgrade::ColorShift))) { addStep(-1,0);addStep(1,0);addStep(0,-1);addStep(0,1); }
      else if (pt==BISHOP && up==int(abilityfish::Upgrade::Archbishop)) b |= PseudoAttacks[c][KNIGHT][s];
      else if (pt==ROOK && up==int(abilityfish::Upgrade::Bastion)) { addJumpLine(-1,0);addJumpLine(1,0);addJumpLine(0,-1);addJumpLine(0,1); }
      else if (pt==ROOK && up==int(abilityfish::Upgrade::Turret)) { for(int df:{-1,1}) for(int dr:{-1,1}) addStep(df,dr); }
      else if (pt==ROOK && up==int(abilityfish::Upgrade::Chancellor)) b |= PseudoAttacks[c][KNIGHT][s];
      else if (pt==QUEEN && up==int(abilityfish::Upgrade::PhaseStep)) { for(int df=-1;df<=1;df++) for(int dr=-1;dr<=1;dr++) if(df||dr) addJumpLine(df,dr); }
      else if (pt==KING && up==int(abilityfish::Upgrade::RoyalStep)) b |= PseudoAttacks[c][KNIGHT][s];
      else if (pt==KING && up==int(abilityfish::Upgrade::EscapeRoute)) { for(int df=-1;df<=1;df++) for(int dr=-1;dr<=1;dr++) if(df||dr) addEscape(df,dr); }
  }
'''
    hs=insert_before_function_end(hs,
        'inline Bitboard Position::moves_from(Color c, PieceType pt, Square s) const {',
        'inline Bitboard Position::attackers_to(Square s) const {',
        common_moves,'upgrade moves_from')

    extra_all=r'''  if (abilityfishActive)
      for (Color c : {WHITE, BLACK})
          for (Bitboard pcs=pieces(c); pcs; )
          {
              Square q=pop_lsb(pcs); PieceType pt=type_of(piece_on(q));
              if (abilityfish_upgrade_code(c,pt)>=0 && (attacks_from(c,pt,q)&s)) b |= q;
          }
'''
    hs=insert_before_return_b(hs,'inline Bitboard Position::attackers_to(Square s) const {','inline Bitboard Position::attackers_to(Square s, Color c) const {',extra_all,'upgrade attackers_to all')
    extra_color=r'''  if (abilityfishActive)
      for (Bitboard pcs=pieces(c); pcs; )
      {
          Square q=pop_lsb(pcs); PieceType pt=type_of(piece_on(q));
          if (abilityfish_upgrade_code(c,pt)>=0 && (attacks_from(c,pt,q)&s)) b |= q;
      }
'''
    hs=insert_before_return_b(hs,'inline Bitboard Position::attackers_to(Square s, Color c) const {','inline Bitboard Position::attackers_to(Square s, Bitboard occupied, Color c) const {',extra_color,'upgrade attackers_to color')
    # The occupied overload is primarily used for king-safety probes. Leaper and
    # step upgrades are exact here; phase/bastion use current-board blockers, a
    # conservative approximation that is subsequently verified after do_move.
    hs=insert_before_return_b(hs,'inline Bitboard Position::attackers_to(Square s, Bitboard occupied, Color c) const {','inline Bitboard Position::checkers() const {',extra_color,'upgrade attackers_to occupied')
    h.write_text(hs)

cs=c.read_text()
if "ABILITYFISH_UPGRADE_CPP_HOOKS_V1" not in cs:
    cs=replace_once(cs,'#define ABILITYFISH_PORTAL_CPP_V1 1\n','#define ABILITYFISH_PORTAL_CPP_V1 1\n#define ABILITYFISH_UPGRADE_CPP_HOOKS_V1 1\n','upgrade cpp marker')
    cs=replace_once(cs,
        'bool Position::abilityfish_active() const { return abilityfishActive; }\n',
        '''bool Position::abilityfish_active() const { return abilityfishActive; }\nint Position::abilityfish_upgrade_code(Color c, PieceType pt) const {\n    if (!abilityfishActive) return -1;\n    int idx = pt==PAWN?0:pt==KNIGHT?1:pt==BISHOP?2:pt==ROOK?3:pt==QUEEN?4:pt==KING?5:-1;\n    if (idx < 0) return -1;\n    auto up = st->abilityState.upgrade_for(c==WHITE?abilityfish::Side::White:abilityfish::Side::Black, uint8_t(idx));\n    return up ? int(*up) : -1;\n}\n''',
        'upgrade code accessor')

    pawn_old='''      if (   !(pawn_attacks_bb(us, from) & pieces(~us) & to)     // Not a capture
          && !((from + pawn_push(us) == to) && !(pieces() & to)) // Not a single push
          && !(   (from + 2 * pawn_push(us) == to)               // Not a double push
               && (double_step_region(us) & from)
               && !(pieces() & (to | (to - pawn_push(us)))))
          && !(   (from + 3 * pawn_push(us) == to)               // Not a triple push
               && (triple_step_region(us) & from)
               && !(pieces() & (to | (to - pawn_push(us)) | (to - 2 * pawn_push(us))))))
          return false;
'''
    pawn_new='''      bool standardPawnMove =    (pawn_attacks_bb(us, from) & pieces(~us) & to)
                              || ((from + pawn_push(us) == to) && !(pieces() & to))
                              || (   (from + 2 * pawn_push(us) == to)
                                  && (double_step_region(us) & from)
                                  && !(pieces() & (to | (to - pawn_push(us)))))
                              || (   (from + 3 * pawn_push(us) == to)
                                  && (triple_step_region(us) & from)
                                  && !(pieces() & (to | (to - pawn_push(us)) | (to - 2 * pawn_push(us)))));
      bool abilityPawnMove = false;
      if (abilityfishActive)
      {
          const int up=abilityfish_upgrade_code(us,PAWN);
          const int df=int(file_of(to))-int(file_of(from));
          const int dr=int(rank_of(to))-int(rank_of(from));
          const int forward=us==WHITE?1:-1;
          if (up==int(abilityfish::Upgrade::Vanguard)) abilityPawnMove=std::abs(df)==1&&dr==forward&&empty(to);
          else if (up==int(abilityfish::Upgrade::ReverseGear)) abilityPawnMove=df==0&&dr==-forward&&empty(to);
          else if (up==int(abilityfish::Upgrade::Veteran)) abilityPawnMove=(df==0&&dr==-forward&&empty(to))||(std::abs(df)==1&&dr==-forward&&bool(pieces(~us)&to));
      }
      if (!standardPawnMove && !abilityPawnMove) return false;
'''
    cs=replace_once(cs,pawn_old,pawn_new,'upgraded pawn pseudo legality')

    ambush_legal='''      if (enemyAmbush.active && abilityCapture.valid() && enemyAmbush.square.index == abilityCapture.index
          && type_of(piece_on(from_sq(m))) == KING)
          return false;
  }
'''
    escape_legal='''      if (enemyAmbush.active && abilityCapture.valid() && enemyAmbush.square.index == abilityCapture.index
          && type_of(piece_on(from_sq(m))) == KING)
          return false;
      if (type_of(piece_on(from_sq(m))) == KING && abilityfish_upgrade_code(us,KING)==int(abilityfish::Upgrade::EscapeRoute))
      {
          Square afrom=from_sq(m), ato=to_sq(m);
          const int df=int(file_of(ato))-int(file_of(afrom)), dr=int(rank_of(ato))-int(rank_of(afrom));
          if ((std::abs(df)==2||std::abs(dr)==2) && std::max(std::abs(df),std::abs(dr))==2)
          {
              if (checkers()) return false;
              Square mid=make_square(File((int(file_of(afrom))+int(file_of(ato)))/2),Rank((int(rank_of(afrom))+int(rank_of(ato)))/2));
              if (!empty(mid) || attackers_to(mid,pieces()^afrom,~us)) return false;
          }
      }
  }
'''
    cs=replace_once(cs,ambush_legal,escape_legal,'Escape Route legality')

    key_anchor='''  // Update the key with the final value
  st->key = k;
'''
    key_repl='''  if (abilityfishActive && count<KING>(them))
      givesCheck = bool(attackers_to(square<KING>(them), us) & pieces(us));

  // Update the key with the final value
  st->key = k;
'''
    cs=replace_once(cs,key_anchor,key_repl,'post-effect check recomputation')
    c.write_text(cs)

ms=m.read_text()
if "ABILITYFISH_UPGRADE_PAWN_MOVEGEN_V1" not in ms:
    marker='#include "position.h"\n'
    ms=replace_once(ms,marker,marker+'#define ABILITYFISH_UPGRADE_PAWN_MOVEGEN_V1 1\n','movegen marker')
    start='  template<Color Us, GenType Type>\n  ExtMove* generate_pawn_moves(const Position& pos, ExtMove* moveList, Bitboard target) {'
    end='\n\n  template<Color Us, GenType Type>\n  ExtMove* generate_moves'
    a=ms.find(start); b=ms.find(end,a+1)
    if a<0 or b<0: raise SystemExit('pawn movegen function boundary missing')
    seg=ms[a:b]
    pos=seg.rfind('    return moveList;\n  }')
    if pos<0: raise SystemExit('pawn movegen return anchor missing')
    code=r'''    if (pos.abilityfish_active())
    {
        const int up=pos.abilityfish_upgrade_code(Us,PAWN);
        constexpr Direction Down = Us==WHITE ? SOUTH : NORTH;
        constexpr Direction DownRight = Us==WHITE ? SOUTH_EAST : NORTH_WEST;
        constexpr Direction DownLeft = Us==WHITE ? SOUTH_WEST : NORTH_EAST;
        if (up==int(abilityfish::Upgrade::Vanguard) && Type!=CAPTURES && Type!=QUIET_CHECKS)
        {
            Bitboard vr=shift<UpRight>(pawns)&movable&target, vl=shift<UpLeft>(pawns)&movable&target;
            Bitboard vrp=vr&standardPromotionZone, vlp=vl&standardPromotionZone;
            vr&=~standardPromotionZone; vl&=~standardPromotionZone;
            while(vr) { Square to=pop_lsb(vr); moveList=make_move_and_gating<NORMAL>(pos,moveList,Us,to-UpRight,to); }
            while(vl) { Square to=pop_lsb(vl); moveList=make_move_and_gating<NORMAL>(pos,moveList,Us,to-UpLeft,to); }
            while(vrp) moveList=make_promotions<Us,Type,UpRight>(pos,moveList,pop_lsb(vrp));
            while(vlp) moveList=make_promotions<Us,Type,UpLeft>(pos,moveList,pop_lsb(vlp));
        }
        if ((up==int(abilityfish::Upgrade::ReverseGear)||up==int(abilityfish::Upgrade::Veteran)) && Type!=CAPTURES && Type!=QUIET_CHECKS)
        {
            Bitboard back=shift<Down>(pawns)&movable&target;
            while(back) { Square to=pop_lsb(back); moveList=make_move_and_gating<NORMAL>(pos,moveList,Us,to-Down,to); }
        }
        if (up==int(abilityfish::Upgrade::Veteran) && (Type==CAPTURES||Type==EVASIONS||Type==NON_EVASIONS))
        {
            Bitboard br=shift<DownRight>(pawns)&capturable&target, bl=shift<DownLeft>(pawns)&capturable&target;
            while(br) { Square to=pop_lsb(br); moveList=make_move_and_gating<NORMAL>(pos,moveList,Us,to-DownRight,to); }
            while(bl) { Square to=pop_lsb(bl); moveList=make_move_and_gating<NORMAL>(pos,moveList,Us,to-DownLeft,to); }
        }
    }

'''
    seg=seg[:pos]+code+seg[pos:]
    ms=ms[:a]+seg+ms[b:]
    m.write_text(ms)

print("Applied AbilityFish type-wide upgrade movement hooks")
