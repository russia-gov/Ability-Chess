#include "../src/ability_rules.h"
#include <array>
#include <cassert>
using namespace abilityfish;

struct MockBoard : BoardAdapter {
  std::array<PieceInfo,64> p{};
  bool whiteCheck=false, blackCheck=false;
  PieceInfo piece_at(Square s) const override { return s.valid()?p[s.index]:PieceInfo{}; }
  bool empty(Square s) const override { return !piece_at(s).present(); }
  Square king_square(Side s) const override { for(int i=0;i<64;i++) if(p[i].present()&&p[i].side==s&&p[i].type==PieceType::King) return Square{uint8_t(i)}; return {}; }
  bool in_check(Side s) const override { return s==Side::White?whiteCheck:blackCheck; }
  bool square_attacked_by(Square,Side) const override { return false; }
  bool piece_attacks_square(Square,Square) const override { return false; }
  bool swap_would_be_safe(Square,Square,Side) const override { return true; }
  bool recall_would_be_safe(Square,Square,Side) const override { return true; }
  bool teleport_would_be_safe(Square,Square,Side) const override { return true; }
  bool teleport_would_attack_enemy_king(Square,Square,Side) const override { return false; }
  bool bomb_would_be_safe(Square,Side) const override { return true; }
  void swap_pieces(Square a,Square b) override { std::swap(p[a.index],p[b.index]); }
  void move_piece(Square a,Square b) override { p[b.index]=p[a.index]; p[a.index]={}; }
  void remove_piece(Square s) override { p[s.index]={}; }
  void replace_piece(Square s,PieceType t,Side side) override { p[s.index]={t,side,uint8_t(10+int(t))}; }
  void set_piece_exact(Square s,PieceInfo x) override { p[s.index]=x; }
};

static PieceInfo W(PieceType t,uint8_t code){ return {t,Side::White,code}; }
static PieceInfo B(PieceType t,uint8_t code){ return {t,Side::Black,code}; }

int main(){
  MockBoard b;
  b.p[4]=W(PieceType::King,1); b.p[60]=B(PieceType::King,2);
  b.p[12]=W(PieceType::Pawn,3); b.p[10]=B(PieceType::Knight,4);
  AbilityState s; s.turn=Side::White; s.side[0].points=20; s.recompute_key();

  auto acts=generate_meta_actions(s,b);
  bool sawFreeze=false,sawShield=false,sawDouble=false,sawUpgrade=false;
  for(auto a:acts){
    sawFreeze |= a.kind==ActionKind::Freeze && a.from==10;
    sawShield |= a.kind==ActionKind::Shield && a.from==12;
    sawDouble |= a.kind==ActionKind::DoubleMove;
    sawUpgrade |= a.kind==ActionKind::Upgrade && a.from==12;
  }
  assert(sawFreeze&&sawShield&&sawDouble&&sawUpgrade);

  auto r=apply_action(s,b,{ActionKind::Freeze,10,64,0,0});
  assert(r.ok&&!r.sideChanged&&!r.consumeDepth);
  assert(s.side[0].points==17 && s.side[1].frozenEnemy.active);

  s.begin_turn(Side::White,false); s.side[0].points=20;
  r=apply_action(s,b,{ActionKind::DoubleMove,64,64,0,0});
  assert(r.ok && s.doubleMoveActive && s.boardMovesRemaining==2 && s.turn==Side::White);
  r=transition_after_normal_move(s,false);
  assert(r.ok&&!r.sideChanged&&r.consumeDepth&&s.turn==Side::White&&s.boardMovesRemaining==1);
  r=transition_after_normal_move(s,false);
  assert(r.ok&&r.sideChanged&&s.turn==Side::Black&&!s.doubleMoveActive);

  s.begin_turn(Side::White,false); s.side[0].points=20; b.p[12]=W(PieceType::Knight,3); b.p[20]={};
  const auto keyBefore=s.variantKey; ActionUndo u;
  r=apply_action_reversible(s,b,{ActionKind::Teleport,12,20,0,0},u);
  assert(r.ok&&b.p[20].present()); undo_action(s,b,u);
  assert(b.p[12].type==PieceType::Knight&&!b.p[20].present()&&s.turn==Side::White&&s.variantKey==keyBefore);

  s.begin_turn(Side::White,false); s.side[0].points=20;
  b.p[12]=W(PieceType::Knight,3); b.p[20]={};
  r=apply_action(s,b,{ActionKind::Teleport,12,20,0,0});
  assert(r.ok&&r.sideChanged&&r.consumeDepth&&s.turn==Side::Black&&b.p[20].type==PieceType::Knight);

  s.begin_turn(Side::White,false); s.side[0].points=20; b.p[36]=W(PieceType::Pawn,9);
  r=apply_action(s,b,{ActionKind::Reinforce,36,64,uint8_t(PieceType::Bishop),0});
  assert(r.ok&&b.p[36].type==PieceType::Bishop&&s.side[0].points==15);
}
