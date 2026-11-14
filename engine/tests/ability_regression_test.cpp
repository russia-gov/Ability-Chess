#include "../src/ability_rules.h"
#include <array>
#include <cassert>
using namespace abilityfish;

// A deterministic state-transition fixture. Integrated chess legality is
// tested separately by the Fairy-Stockfish UCI matrices.
struct Board : BoardAdapter {
  std::array<PieceInfo,64> pieces{};
  bool checked=false;
  bool safe=true;
  PieceInfo piece_at(Square q) const override { return q.valid()?pieces[q.index]:PieceInfo{}; }
  bool empty(Square q) const override { return !piece_at(q).present(); }
  Square king_square(Side s) const override {
    for(int i=0;i<64;i++) if(pieces[i].present()&&pieces[i].side==s&&pieces[i].type==PieceType::King) return Square{uint8_t(i)};
    return {};
  }
  bool in_check(Side) const override { return checked; }
  bool square_attacked_by(Square,Side) const override { return false; }
  bool piece_attacks_square(Square,Square) const override { return false; }
  bool swap_would_be_safe(Square,Square,Side) const override { return safe; }
  bool recall_would_be_safe(Square,Square,Side) const override { return safe; }
  bool teleport_would_be_safe(Square,Square,Side) const override { return safe; }
  bool teleport_would_attack_enemy_king(Square,Square,Side) const override { return false; }
  bool bomb_would_be_safe(Square,Side) const override { return safe; }
  void swap_pieces(Square a,Square b) override { auto old=pieces[a.index];pieces[a.index]=pieces[b.index];pieces[b.index]=old; }
  void move_piece(Square a,Square b) override { pieces[b.index]=pieces[a.index];pieces[a.index]={}; }
  void remove_piece(Square q) override { pieces[q.index]={}; }
  void replace_piece(Square q,PieceType p,Side s) override { pieces[q.index]={p,s,uint8_t(20+int(p))}; }
  void set_piece_exact(Square q,PieceInfo p) override { pieces[q.index]=p; }
};
PieceInfo w(PieceType p,int code=1){return {p,Side::White,uint8_t(code)};}
PieceInfo b(PieceType p,int code=2){return {p,Side::Black,uint8_t(code)};}
Board board(){Board x;x.pieces[4]=w(PieceType::King);x.pieces[60]=b(PieceType::King);return x;}
AbilityState state(){AbilityState s;s.turn=Side::White;s.side[0].points=30;s.recompute_key();return s;}
AbilityAction action(ActionKind kind,int from=64,int to=64,int aux=0) {
  return {kind,uint8_t(from),uint8_t(to),uint8_t(aux),0};
}

int main(){
  {
    auto bd=board();auto s=state();bd.pieces[8]=w(PieceType::Pawn,3);
    auto r=apply_action(s,bd,action(ActionKind::Shield,8));
    assert(r.ok&&!r.sideChanged&&!r.consumeDepth);
    assert(s.side[0].points==27&&s.side[0].shield.active);
    assert(!normal_move_allowed(s,Side::Black,Square{48},Square{8}));
    s.begin_turn(Side::Black); assert(s.side[0].shield.active);
    s.begin_turn(Side::White); assert(!s.side[0].shield.active);
  }
  {
    auto bd=board();auto s=state();bd.pieces[48]=b(PieceType::Knight,5);
    auto r=apply_action(s,bd,action(ActionKind::Freeze,48));
    assert(r.ok&&s.side[1].frozenEnemy.active);
    assert(!normal_move_allowed(s,Side::Black,Square{48}));
    s.begin_turn(Side::Black); assert(s.side[1].frozenEnemy.active);
    s.begin_turn(Side::White); assert(!s.side[1].frozenEnemy.active);
  }
  {
    auto bd=board();auto s=state();
    bd.pieces[27]=w(PieceType::Pawn,3);bd.pieces[28]=b(PieceType::Rook,4);
    bd.pieces[19]=w(PieceType::Knight,5);
    auto r=apply_action(s,bd,action(ActionKind::Bomb,27));
    assert(r.ok&&!bd.pieces[27].present()&&!bd.pieces[28].present()&&!bd.pieces[19].present());
    assert(s.side[0].points==31); // 30 - 4 + captured rook (5)
  }
  {
    auto bd=board();auto s=state();bd.pieces[12]=w(PieceType::Bishop,3);bd.pieces[21]=w(PieceType::Knight,4);
    s.side[0].ambush={Square{12},1,true};
    auto r=apply_action(s,bd,action(ActionKind::SwapFinish,12,21));
    assert(r.ok&&bd.pieces[12].type==PieceType::Knight&&bd.pieces[21].type==PieceType::Bishop);
    assert(s.side[0].ambush.active&&s.side[0].ambush.square.index==21);
    s=state();s.side[0].frozenEnemy={Square{12},1,true};
    r=apply_action(s,bd,action(ActionKind::SwapFinish,12,21));assert(!r.ok);
  }
  {
    auto bd=board();auto s=state();bd.pieces[20]=w(PieceType::Knight,3);
    s.side[0].lastMove={Square{12},Square{20},3,true};
    auto r=apply_action(s,bd,action(ActionKind::Recall));
    assert(r.ok&&!bd.pieces[20].present()&&bd.pieces[12].present());
    s=state();s.side[0].lastMove={Square{12},Square{20},3,true};
    r=apply_action(s,bd,action(ActionKind::Recall));assert(!r.ok);
  }
  {
    auto bd=board();auto s=state();bd.pieces[8]=w(PieceType::Pawn,3);
    auto r=apply_action(s,bd,action(ActionKind::Ambush,8));
    assert(r.ok&&s.side[0].ambush.active&&s.side[0].points==26);
    s=state();r=apply_action(s,bd,action(ActionKind::PortalFinish,16,24));
    assert(r.ok&&s.portals[0].active&&s.portals[0].ownerTurnsRemaining==3);
    s=state();r=apply_action(s,bd,action(ActionKind::Fortify,3));
    assert(r.ok&&s.side[0].fortify.active&&s.side[0].fortify.squares[0].index==3);
  }
  {
    auto bd=board();auto s=state();bd.pieces[20]=w(PieceType::Knight,3);
    auto r=apply_action(s,bd,action(ActionKind::Teleport,20,28));
    assert(r.ok&&r.sideChanged&&r.consumeDepth&&s.turn==Side::Black);
    assert(bd.pieces[28].type==PieceType::Knight&&!bd.pieces[20].present());
  }
  {
    auto bd=board();auto s=state();bd.pieces[36]=w(PieceType::Pawn,3);
    auto r=apply_action(s,bd,action(ActionKind::Reinforce,36,64,int(PieceType::Bishop)));
    assert(r.ok&&!r.sideChanged&&!r.consumeDepth&&s.turn==Side::White);
    assert(s.side[0].abilityUsedThisTurn&&s.side[0].points==25);
    assert(bd.pieces[36].type==PieceType::Bishop);
  }
  {
    auto bd=board();auto s=state();
    auto r=apply_action(s,bd,action(ActionKind::DoubleMove));
    assert(r.ok&&s.boardMovesRemaining==2&&s.turn==Side::White);
    transition_after_normal_move(s,false);
    assert(s.boardMovesRemaining==1&&s.turn==Side::White);
    transition_after_normal_move(s,false);
    assert(s.turn==Side::Black&&!s.doubleMoveActive);
  }
  {
    const std::array<Upgrade,14> all={
      Upgrade::Vanguard,Upgrade::ReverseGear,Upgrade::Veteran,
      Upgrade::Lancer,Upgrade::Charger,Upgrade::Cardinal,
      Upgrade::ColorShift,Upgrade::Archbishop,Upgrade::Bastion,
      Upgrade::Turret,Upgrade::Chancellor,Upgrade::PhaseStep,
      Upgrade::RoyalStep,Upgrade::EscapeRoute
    };
    for(auto up:all){
      auto bd=board();auto s=state();
      int compatible=0;
      for(int piece=1;piece<=6;piece++){
        if(!upgrade_compatible(PieceType(piece),up))continue;
        compatible++;
        const int original=s.side[0].points;
        auto r=apply_action(s,bd,action(ActionKind::Upgrade,piece,64,int(up)));
        assert(r.ok&&r.sideChanged&&r.consumeDepth&&s.turn==Side::Black);
        assert(s.side[0].points==original-AbilityState::upgrade_cost(up));
        assert(s.upgrade_for(Side::White,uint8_t(piece-1))==up);
      }
      assert(compatible==1);
    }
    auto s=state();s.upgradeLimit=1;s.set_upgrade(Side::White,0,Upgrade::Vanguard);
    assert(s.can_buy_upgrade(Side::White,0,Upgrade::Veteran));
    assert(!s.can_buy_upgrade(Side::White,0,Upgrade::Vanguard));
    assert(!s.can_buy_upgrade(Side::White,1,Upgrade::Lancer));
    s.upgradesEnabled=false;
    assert(!s.can_buy_upgrade(Side::White,0,Upgrade::Veteran));
  }
  {
    // Undo of an ability must restore board, points and all variant state.
    auto bd=board();auto s=state();bd.pieces[20]=w(PieceType::Knight,3);
    const auto before=s.variantKey;ActionUndo undo;
    auto r=apply_action_reversible(s,bd,action(ActionKind::Teleport,20,28),undo);
    assert(r.ok&&s.turn==Side::Black);
    undo_action(s,bd,undo);
    assert(s.turn==Side::White&&s.side[0].points==30&&s.variantKey==before);
    assert(bd.pieces[20].type==PieceType::Knight&&!bd.pieces[28].present());
  }
}
