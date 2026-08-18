#include "ability_rules.h"
#include <algorithm>

namespace abilityfish {
namespace {
constexpr Square sq(int i){ return Square{static_cast<uint8_t>(i)}; }
int row(Square s){ return int(s.index)/8; }
int col(Square s){ return int(s.index)%8; }
bool adjacent_3x3(Square a, Square c){ return std::abs(row(a)-row(c))<=1 && std::abs(col(a)-col(c))<=1; }

void spend_ability(AbilityState& st, Side s, Ability ab) {
  auto& ss = st.side[side_index(s)];
  ss.points = uint8_t(int(ss.points) - AbilityState::ability_cost(ab));
  ss.abilityUsedThisTurn = true;
}
void spend_upgrade(AbilityState& st, Side s, Upgrade up) {
  auto& ss=st.side[side_index(s)];
  ss.points = uint8_t(int(ss.points) - AbilityState::upgrade_cost(up));
}

bool own_nonking(const BoardAdapter& b, Side s, Square q) {
  auto p=b.piece_at(q); return p.present() && p.side==s && p.type!=PieceType::King;
}
bool own_piece(const BoardAdapter& b, Side s, Square q) {
  auto p=b.piece_at(q); return p.present() && p.side==s;
}
bool enemy_nonking(const BoardAdapter& b, Side s, Square q) {
  auto p=b.piece_at(q); return p.present() && p.side!=s && p.type!=PieceType::King;
}
void clear_removed_piece_state(AbilityState& st, Square q) {
  if(!q.valid()) return;
  st.squareUpgrades[q.index]=0;
  for(auto& ss:st.side) {
    if(ss.shield.active&&ss.shield.square.index==q.index) ss.shield={};
    if(ss.frozenEnemy.active&&ss.frozenEnemy.square.index==q.index) ss.frozenEnemy={};
    if(ss.ambush.active&&ss.ambush.square.index==q.index) ss.ambush={};
  }
}
}

bool square_in_fortification(const AbilityState& st, Side owner, Square q) {
  const auto& f=st.side[side_index(owner)].fortify;
  if(!f.active) return false;
  return std::any_of(f.squares.begin(),f.squares.end(),[&](Square x){return x.valid()&&x.index==q.index;});
}
bool protected_from_ability(const AbilityState& st, Side actor, Square q) {
  return square_in_fortification(st, other(actor), q);
}
bool pawn_on_own_half(Side s, Square q) {
  if(!q.valid()) return false;
  const int r=row(q);
  return s==Side::White ? r<=3 : r>=4;
}
bool pawn_crossed_half(Side s, Square q) {
  if(!q.valid()) return false;
  const int r=row(q);
  return s==Side::White ? r>=4 : r<=3;
}
bool upgrade_compatible(PieceType p, Upgrade up) {
  const unsigned u=unsigned(up);
  switch(p) {
    case PieceType::Pawn: return u<=unsigned(Upgrade::Veteran);
    case PieceType::Knight: return u>=unsigned(Upgrade::Lancer)&&u<=unsigned(Upgrade::Charger);
    case PieceType::Bishop: return u>=unsigned(Upgrade::Cardinal)&&u<=unsigned(Upgrade::Archbishop);
    case PieceType::Rook: return u>=unsigned(Upgrade::Bastion)&&u<=unsigned(Upgrade::Chancellor);
    case PieceType::Queen: return u==unsigned(Upgrade::PhaseStep);
    case PieceType::King: return u>=unsigned(Upgrade::RoyalStep)&&u<=unsigned(Upgrade::EscapeRoute);
    default: return false;
  }
}
bool normal_move_allowed(const AbilityState& st, Side mover, Square from, Square captureSquare) {
  const auto& mine=st.side[side_index(mover)];
  if(mine.frozenEnemy.active&&from.valid()&&mine.frozenEnemy.square.index==from.index) return false;
  const auto& theirs=st.side[side_index(other(mover))];
  if(theirs.shield.active&&captureSquare.valid()&&theirs.shield.square.index==captureSquare.index) return false;
  return true;
}

std::vector<AbilityAction> generate_meta_actions(const AbilityState& st, const BoardAdapter& b) {
  std::vector<AbilityAction> out;
  const Side us=st.turn;
  const auto& ss=st.side[side_index(us)];
  auto push=[&](ActionKind k,Square a=Square{},Square z=Square{},uint8_t aux=0){ out.push_back({k,a.index,z.index,aux,0}); };

  if(st.abilitiesEnabled && !ss.abilityUsedThisTurn) {
    if(st.can_afford(us,Ability::Shield))
      for(int i=0;i<64;i++) if(own_piece(b,us,sq(i))) push(ActionKind::Shield,sq(i));

    if(st.can_afford(us,Ability::Freeze))
      for(int i=0;i<64;i++) if(enemy_nonking(b,us,sq(i))&&!protected_from_ability(st,us,sq(i))) push(ActionKind::Freeze,sq(i));

    if(st.can_afford(us,Ability::Bomb)) {
      for(int c=0;c<64;c++) if(own_piece(b,us,sq(c))) {
        bool king=false,fort=false;
        for(int i=0;i<64;i++) if(adjacent_3x3(sq(i),sq(c))) {
          auto p=b.piece_at(sq(i)); if(p.type==PieceType::King) king=true;
          if(p.present()&&protected_from_ability(st,us,sq(i))) fort=true;
        }
        if(!king&&!fort&&b.bomb_would_be_safe(sq(c),us)) push(ActionKind::Bomb,sq(c));
      }
    }

    if(st.can_afford(us,Ability::Swap))
      for(int a=0;a<64;a++) if(own_nonking(b,us,sq(a)))
        for(int z=a+1;z<64;z++) if(own_nonking(b,us,sq(z))&&b.swap_would_be_safe(sq(a),sq(z),us)) push(ActionKind::SwapFinish,sq(a),sq(z));

    if(st.can_afford(us,Ability::Recall) && ss.lastMove.valid && ss.lastMove.from.valid() && ss.lastMove.to.valid()) {
      auto p=b.piece_at(ss.lastMove.to);
      if(p.present()&&p.side==us&&p.type!=PieceType::King&&p.code==ss.lastMove.pieceCode&&b.empty(ss.lastMove.from)&&b.recall_would_be_safe(ss.lastMove.to,ss.lastMove.from,us))
        push(ActionKind::Recall,ss.lastMove.to,ss.lastMove.from);
    }

    if(st.can_afford(us,Ability::Ambush))
      for(int i=0;i<64;i++) if(own_nonking(b,us,sq(i))) push(ActionKind::Ambush,sq(i));

    if(st.can_afford(us,Ability::Teleport))
      for(int f=0;f<64;f++) if(own_nonking(b,us,sq(f))) {
        auto p=b.piece_at(sq(f));
        if(p.type==PieceType::Pawn&&!pawn_on_own_half(us,sq(f))) continue;
        for(int t=0;t<64;t++) if(b.empty(sq(t))&&!protected_from_ability(st,us,sq(t))) {
          if(p.type==PieceType::Pawn&&!pawn_on_own_half(us,sq(t))) continue;
          if(b.teleport_would_be_safe(sq(f),sq(t),us)&&!b.teleport_would_attack_enemy_king(sq(f),sq(t),us)) push(ActionKind::Teleport,sq(f),sq(t));
        }
      }

    if(st.can_afford(us,Ability::Reinforce))
      for(int i=0;i<64;i++) { auto p=b.piece_at(sq(i)); if(p.present()&&p.side==us&&p.type==PieceType::Pawn&&pawn_crossed_half(us,sq(i))) { push(ActionKind::Reinforce,sq(i),Square{},uint8_t(PieceType::Knight)); push(ActionKind::Reinforce,sq(i),Square{},uint8_t(PieceType::Bishop)); } }

    if(st.can_afford(us,Ability::Portal))
      for(int a=0;a<64;a++) if(b.empty(sq(a))&&!protected_from_ability(st,us,sq(a)))
        for(int z=a+1;z<64;z++) if(b.empty(sq(z))&&!protected_from_ability(st,us,sq(z))) push(ActionKind::PortalFinish,sq(a),sq(z));

    if(st.can_afford(us,Ability::Fortify)) {
      const Square k=b.king_square(us);
      if(k.valid()) {
        const int kr=row(k), kc=col(k);
        for(int tr: {kr-1,kr}) for(int lc:{kc-1,kc}) if(tr>=0&&tr<7&&lc>=0&&lc<7)
          push(ActionKind::Fortify,sq(tr*8+lc),sq((tr+1)*8+(lc+1)));
      }
    }

    if(st.can_afford(us,Ability::DoubleMove) && !st.doubleMoveActive)
      push(ActionKind::DoubleMove);
  }

  if(st.upgradesEnabled)
    for(int i=0;i<64;i++) {
      auto p=b.piece_at(sq(i)); if(!p.present()||p.side!=us) continue;
      for(unsigned u=0;u<unsigned(Upgrade::Count);u++) {
        Upgrade up=Upgrade(u);
        if(upgrade_compatible(p.type,up)&&st.can_buy_upgrade(us,sq(i),up)) push(ActionKind::Upgrade,sq(i),Square{},uint8_t(u));
      }
    }
  return out;
}

ApplyResult apply_action(AbilityState& st, BoardAdapter& b, const AbilityAction& a) {
  const Side us=st.turn;
  auto& ss=st.side[side_index(us)];
  auto bad=[](const char* e){ return ApplyResult{false,false,false,e}; };
  auto ok_same=[](){ return ApplyResult{true,false,false,nullptr}; };

  switch(a.kind) {
    case ActionKind::Shield: {
      Square q{a.from}; if(!st.can_afford(us,Ability::Shield)||!own_piece(b,us,q)) return bad("illegal shield");
      spend_ability(st,us,Ability::Shield); ss.shield={q,1,true}; st.recompute_key(); return ok_same();
    }
    case ActionKind::Freeze: {
      Square q{a.from}; if(!st.can_afford(us,Ability::Freeze)||!enemy_nonking(b,us,q)||protected_from_ability(st,us,q)) return bad("illegal freeze");
      spend_ability(st,us,Ability::Freeze); st.side[side_index(other(us))].frozenEnemy={q,1,true}; st.recompute_key(); return ok_same();
    }
    case ActionKind::Bomb: {
      Square c{a.from}; if(!st.can_afford(us,Ability::Bomb)||!own_piece(b,us,c)) return bad("illegal bomb");
      for(int i=0;i<64;i++) if(adjacent_3x3(sq(i),c)) { auto p=b.piece_at(sq(i)); if(p.type==PieceType::King) return bad("king in blast"); if(p.present()&&protected_from_ability(st,us,sq(i))) return bad("fortified blast target"); }
      if(!b.bomb_would_be_safe(c,us)) return bad("bomb exposes king");
      int gain=0; for(int i=0;i<64;i++) if(adjacent_3x3(sq(i),c)) { auto p=b.piece_at(sq(i)); if(p.present()&&p.side!=us) { static constexpr int v[]={0,1,3,3,5,9,0}; gain+=v[int(p.type)]; } }
      spend_ability(st,us,Ability::Bomb); ss.points=uint8_t(std::min(255,int(ss.points)+gain));
      for(int i=0;i<64;i++) if(adjacent_3x3(sq(i),c)&&b.piece_at(sq(i)).present()) { b.remove_piece(sq(i)); clear_removed_piece_state(st,sq(i)); }
      st.recompute_key(); return ok_same();
    }
    case ActionKind::SwapFinish: {
      Square x{a.from},z{a.to}; if(!st.can_afford(us,Ability::Swap)||x.index==z.index||!own_nonking(b,us,x)||!own_nonking(b,us,z)||!b.swap_would_be_safe(x,z,us)) return bad("illegal swap");
      spend_ability(st,us,Ability::Swap); b.swap_pieces(x,z); std::swap(st.squareUpgrades[x.index],st.squareUpgrades[z.index]);
      if(ss.shield.active&&(ss.shield.square.index==x.index||ss.shield.square.index==z.index)) ss.shield={};
      if(ss.ambush.active) { if(ss.ambush.square.index==x.index) ss.ambush.square=z; else if(ss.ambush.square.index==z.index) ss.ambush.square=x; }
      st.recompute_key(); return ok_same();
    }
    case ActionKind::Recall: {
      if(!st.can_afford(us,Ability::Recall)||!ss.lastMove.valid) return bad("no recall");
      Square from=ss.lastMove.to,to=ss.lastMove.from; auto p=b.piece_at(from);
      if(!p.present()||p.side!=us||p.type==PieceType::King||p.code!=ss.lastMove.pieceCode||!b.empty(to)||!b.recall_would_be_safe(from,to,us)) return bad("illegal recall");
      spend_ability(st,us,Ability::Recall); b.move_piece(from,to); st.move_piece_state(from,to); st.recompute_key(); return ok_same();
    }
    case ActionKind::Ambush: {
      Square q{a.from}; if(!st.can_afford(us,Ability::Ambush)||!own_nonking(b,us,q)) return bad("illegal ambush");
      spend_ability(st,us,Ability::Ambush); ss.ambush={q,1,true}; st.recompute_key(); return ok_same();
    }
    case ActionKind::Teleport: {
      Square f{a.from},t{a.to}; auto p=b.piece_at(f);
      if(!st.can_afford(us,Ability::Teleport)||!p.present()||p.side!=us||p.type==PieceType::King||!b.empty(t)||protected_from_ability(st,us,t)) return bad("illegal teleport");
      if(p.type==PieceType::Pawn&&(!pawn_on_own_half(us,f)||!pawn_on_own_half(us,t))) return bad("illegal pawn teleport");
      if(!b.teleport_would_be_safe(f,t,us)||b.teleport_would_attack_enemy_king(f,t,us)) return bad("unsafe teleport");
      spend_ability(st,us,Ability::Teleport); b.move_piece(f,t); st.move_piece_state(f,t);
      st.boardMovesRemaining=1; st.doubleMoveActive=false; st.begin_turn(other(us),false); st.recompute_key();
      return {true,true,true,nullptr};
    }
    case ActionKind::Reinforce: {
      Square q{a.from}; auto p=b.piece_at(q); PieceType nt=PieceType(a.aux);
      if(!st.can_afford(us,Ability::Reinforce)||!p.present()||p.side!=us||p.type!=PieceType::Pawn||!pawn_crossed_half(us,q)||(nt!=PieceType::Knight&&nt!=PieceType::Bishop)) return bad("illegal reinforce");
      spend_ability(st,us,Ability::Reinforce); b.replace_piece(q,nt,us); st.squareUpgrades[q.index]=0; st.recompute_key(); return ok_same();
    }
    case ActionKind::PortalFinish: {
      Square x{a.from},z{a.to}; if(!st.can_afford(us,Ability::Portal)||x.index==z.index||!b.empty(x)||!b.empty(z)||protected_from_ability(st,us,x)||protected_from_ability(st,us,z)) return bad("illegal portal");
      spend_ability(st,us,Ability::Portal); auto it=std::find_if(st.portals.begin(),st.portals.end(),[](const Portal& p){return !p.active;}); if(it==st.portals.end()) it=st.portals.begin(); *it={x,z,us,3,true}; st.recompute_key(); return ok_same();
    }
    case ActionKind::Fortify: {
      Square tl{a.from}; if(!st.can_afford(us,Ability::Fortify)||!tl.valid()) return bad("illegal fortify");
      int r=row(tl),c=col(tl); if(r<0||r>=7||c<0||c>=7) return bad("illegal fortify block");
      std::array<Square,4> q={sq(r*8+c),sq(r*8+c+1),sq((r+1)*8+c),sq((r+1)*8+c+1)}; Square k=b.king_square(us);
      if(std::none_of(q.begin(),q.end(),[&](Square x){return x.index==k.index;})) return bad("king not in fortify");
      spend_ability(st,us,Ability::Fortify); ss.fortify={q,1,true}; st.recompute_key(); return ok_same();
    }
    case ActionKind::DoubleMove: {
      if(!st.can_afford(us,Ability::DoubleMove)||st.doubleMoveActive) return bad("illegal double move");
      spend_ability(st,us,Ability::DoubleMove); st.doubleMoveActive=true; st.boardMovesRemaining=2; st.beganTurnInCheck=b.in_check(us); st.recompute_key(); return ok_same();
    }
    case ActionKind::Upgrade: {
      Square q{a.from}; if(a.aux>=uint8_t(Upgrade::Count)) return bad("bad upgrade id"); Upgrade up=Upgrade(a.aux); auto p=b.piece_at(q);
      if(!p.present()||p.side!=us||!upgrade_compatible(p.type,up)||!st.can_buy_upgrade(us,q,up)) return bad("illegal upgrade");
      spend_upgrade(st,us,up); st.squareUpgrades[q.index] |= uint16_t(1u<<unsigned(up)); st.recompute_key(); return ok_same();
    }
    case ActionKind::NormalMove:
      return bad("normal move belongs to Fairy Position");
    case ActionKind::SwapBegin:
    case ActionKind::PortalBegin:
      return bad("staged UI action is not a search action");
  }
  return bad("unknown action");
}

ApplyResult apply_action_reversible(AbilityState& st, BoardAdapter& board, const AbilityAction& a, ActionUndo& undo) {
  undo.state = st;
  for (int i=0;i<64;i++) undo.board[i] = board.piece_at(Square{uint8_t(i)});
  undo.valid = true;
  auto r = apply_action(st, board, a);
  if (!r.ok) { undo_action(st, board, undo); }
  return r;
}

void undo_action(AbilityState& st, BoardAdapter& board, ActionUndo& undo) {
  if (!undo.valid) return;
  for (int i=0;i<64;i++) {
    Square q{uint8_t(i)};
    auto now=board.piece_at(q);
    const auto before=undo.board[i];
    if (now.type!=before.type || now.side!=before.side || now.code!=before.code || now.present()!=before.present())
      board.set_piece_exact(q,before);
  }
  st = undo.state;
  undo.valid = false;
}

ApplyResult transition_after_normal_move(AbilityState& st, bool nextSideInCheck) {
  const Side before=st.turn;
  st.finish_board_move();
  const bool changed=st.turn!=before;
  if(changed) st.beganTurnInCheck=nextSideInCheck;
  st.recompute_key();
  return {true,changed,true,nullptr};
}

} // namespace abilityfish
