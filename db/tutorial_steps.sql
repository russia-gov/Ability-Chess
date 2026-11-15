-- Tutorial lessons are publicly readable; only owner/staff may edit them.
create table if not exists public.ability_chess_tutorial_steps (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null default 0,
  title text not null check (char_length(title) between 1 and 140),
  body text not null check (char_length(body) between 1 and 3000),
  board_fen text not null,
  arrow_from text check (arrow_from is null or arrow_from ~ '^[a-h][1-8]$'),
  arrow_to text check (arrow_to is null or arrow_to ~ '^[a-h][1-8]$'),
  updated_at timestamptz not null default now()
);
alter table public.ability_chess_tutorial_steps enable row level security;
revoke all on public.ability_chess_tutorial_steps from anon, authenticated;
grant select on public.ability_chess_tutorial_steps to anon, authenticated;
grant insert, update, delete on public.ability_chess_tutorial_steps to authenticated;
drop policy if exists tutorial_steps_public_read on public.ability_chess_tutorial_steps;
create policy tutorial_steps_public_read on public.ability_chess_tutorial_steps for select to anon, authenticated using (true);
drop policy if exists tutorial_steps_admin_insert on public.ability_chess_tutorial_steps;
create policy tutorial_steps_admin_insert on public.ability_chess_tutorial_steps for insert to authenticated
with check (exists(select 1 from public.ability_chess_profiles p where p.id=(select auth.uid()) and (p.is_owner or p.is_staff)));
drop policy if exists tutorial_steps_admin_update on public.ability_chess_tutorial_steps;
create policy tutorial_steps_admin_update on public.ability_chess_tutorial_steps for update to authenticated
using (exists(select 1 from public.ability_chess_profiles p where p.id=(select auth.uid()) and (p.is_owner or p.is_staff)))
with check (exists(select 1 from public.ability_chess_profiles p where p.id=(select auth.uid()) and (p.is_owner or p.is_staff)));
drop policy if exists tutorial_steps_admin_delete on public.ability_chess_tutorial_steps;
create policy tutorial_steps_admin_delete on public.ability_chess_tutorial_steps for delete to authenticated
using (exists(select 1 from public.ability_chess_profiles p where p.id=(select auth.uid()) and (p.is_owner or p.is_staff)));
insert into public.ability_chess_tutorial_steps (sort_order,title,body,board_fen,arrow_from,arrow_to)
select v.sort_order,v.title,v.body,v.board_fen,v.arrow_from,v.arrow_to
from (values
 (1,'Control the center','The center squares e4, d4, e5, and d5 shape the opening. This arrow illustrates the pawn move e2 to e4. Select Next to see how the position develops.','rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1','e2','e4'),
 (2,'Develop your pieces','After 1. e4 e5, White can develop the knight from g1 to f3. The knight attacks the e5 pawn and helps control the center.','rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2','g1','f3'),
 (3,'Bring pieces into play','After 1. e4 e5 2. Nf3 Nc6, the white bishop can travel from f1 to c4, aiming toward f7.','r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3','f1','c4'),
 (4,'Protect your king','After both sides develop their bishops, White can castle kingside. The arrow shows the king moving from e1 to g1; the rook also moves to f1. Explore the Abilities Guide to learn Ability Chess-specific mechanics.','r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4','e1','g1')
) as v(sort_order,title,body,board_fen,arrow_from,arrow_to)
where not exists(select 1 from public.ability_chess_tutorial_steps);
