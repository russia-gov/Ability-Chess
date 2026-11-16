-- Disposable PostgreSQL regression for alternate read routes. Never run on production.
begin;
create or replace function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('test.user_id',true),'')::uuid
$$;
alter table public.ability_chess_profiles add column if not exists avatar_url text;
alter table public.ability_chess_tournament_entries add column if not exists last_pairing_at timestamptz;
create table if not exists public.ability_chess_live_seeks(
 id uuid primary key, seeker_token uuid, seeker_id uuid, status text,
 expires_at timestamptz, room_id uuid, host_seat_token uuid);
create table if not exists public.ability_chess_tournaments(id uuid primary key, name text);
insert into public.ability_chess_profiles(id,username,display_name)
values ('00000000-0000-0000-0000-000000000091','white','White'),
('00000000-0000-0000-0000-000000000092','black','Black'),
('00000000-0000-0000-0000-000000000093','spectator','Spectator')
on conflict(id) do nothing;
insert into public.ability_chess_rooms(
 id,status,host_color,host_user_id,guest_user_id,
 host_token,guest_token,settings,game_state)
values (
 '00000000-0000-0000-0000-000000000094','active','w',
 '00000000-0000-0000-0000-000000000091',
 '00000000-0000-0000-0000-000000000092',
 '00000000-0000-0000-0000-000000000095',
 '00000000-0000-0000-0000-000000000096',
 '{"rated":true,"tournamentId":"00000000-0000-0000-0000-000000000098"}',
 '{"turn":"w","over":false,"ambushed":{"w":{"r":4,"c":3},"b":{"r":5,"c":2}},"positionCounts":{"secret":2},"log":["hidden"]}'
 );
insert into public.ability_chess_rooms(
 id,status,host_color,host_user_id,guest_user_id,
 host_token,guest_token,settings,game_state)
values (
 '00000000-0000-0000-0000-000000000097','waiting','w',null,null,
 '00000000-0000-0000-0000-00000000009a',null,'{"rated":false}',
 '{"turn":"w","over":false,"ambushed":{"w":null,"b":{"r":5,"c":2}}}'
 );
insert into public.ability_chess_tournaments(id,name)
values ('00000000-0000-0000-0000-000000000098','Test tournament');
insert into public.ability_chess_tournament_entries(
 tournament_id,user_id,score,pairing_status,current_room_id,seat_token,assigned_color)
values
('00000000-0000-0000-0000-000000000098','00000000-0000-0000-0000-000000000091',0,'paired','00000000-0000-0000-0000-000000000094','00000000-0000-0000-0000-000000000095','w'),
('00000000-0000-0000-0000-000000000098','00000000-0000-0000-0000-000000000092',0,'paired','00000000-0000-0000-0000-000000000094','00000000-0000-0000-0000-000000000096','b'),
('00000000-0000-0000-0000-000000000098','00000000-0000-0000-0000-000000000093',0,'idle',null,null,null);
insert into public.ability_chess_tournament_games(
 id,tournament_id,room_id,white_id,black_id,status)
values (
 '00000000-0000-0000-0000-000000000099',
 '00000000-0000-0000-0000-000000000098',
 '00000000-0000-0000-0000-000000000094',
 '00000000-0000-0000-0000-000000000091',
 '00000000-0000-0000-0000-000000000092','active');
insert into public.ability_chess_live_seeks(
 id,seeker_token,seeker_id,status,expires_at,room_id,host_seat_token)
values (
 '00000000-0000-0000-0000-00000000009b',
 '00000000-0000-0000-0000-00000000009c',
 '00000000-0000-0000-0000-000000000091',
 'matched',now()+interval '1 day',
 '00000000-0000-0000-0000-000000000094',
 '00000000-0000-0000-0000-000000000095');
do $test$
declare s jsonb; denied boolean;
begin
 perform set_config('test.user_id','00000000-0000-0000-0000-000000000091',true);
 select state into s from public.get_ability_chess_room(
  '00000000-0000-0000-0000-000000000094','00000000-0000-0000-0000-000000000095');
 if s#>>'{ambushed,w,r}' <> '4' or s#>'{ambushed,b}' <> 'null'::jsonb
   or s ? 'secret' or s->'positionCounts'<>'{}'::jsonb
 then raise exception 'Main legacy room read leaks hidden opponent details'; end if;
end $test$;
-- Attach a valid code after the baseline fixtures are set up.
alter table public.ability_chess_rooms add column if not exists room_code text;
update public.ability_chess_rooms
set room_code='TESTROOM' where id='00000000-0000-0000-0000-000000000094';
do $test$
declare s jsonb; denied boolean;
begin
 perform set_config('test.user_id','00000000-0000-0000-0000-000000000091',true);
 select state into s from public.reconnect_ability_chess_room(
  'TESTROOM','00000000-0000-0000-0000-000000000095');
 if s#>'{ambushed,b}' <> 'null'::jsonb then raise exception 'Reconnect leaks Ambush'; end if;
 select state into s from public.ability_chess_resume_my_active_room();
 if s#>'{ambushed,b}' <> 'null'::jsonb then raise exception 'Resume leaks Ambush'; end if;
 select state into s from public.ability_chess_poll_seek(
  '00000000-0000-0000-0000-00000000009b','00000000-0000-0000-0000-00000000009c');
 if s#>'{ambushed,b}' <> 'null'::jsonb then raise exception 'Seek poll leaks Ambush'; end if;
 select state into s from public.ability_chess_my_active_tournament_game();
 if s#>'{ambushed,b}' <> 'null'::jsonb then raise exception 'Tournament resume leaks Ambush'; end if;
 select state into s from public.ability_chess_tournament_game_context(
  '00000000-0000-0000-0000-000000000094');
 if s#>'{ambushed,b}' <> 'null'::jsonb then raise exception 'Tournament context leaks Ambush'; end if;
 perform set_config('test.user_id','00000000-0000-0000-0000-000000000093',true);
 select state into s from public.ability_chess_tournament_spectate(
  '00000000-0000-0000-0000-000000000099');
 if s#>'{ambushed,w}' <> 'null'::jsonb or s#>'{ambushed,b}' <> 'null'::jsonb
 then raise exception 'Spectator sees private Ambush'; end if;
 select state into s from public.ability_chess_tournament_game_context(
  '00000000-0000-0000-0000-000000000094');
 if s#>'{ambushed,w}' <> 'null'::jsonb or s#>'{ambushed,b}' <> 'null'::jsonb
 then raise exception 'Tournament context leaks Ambush to spectator'; end if;
 perform set_config('test.user_id','',true);
 denied:=false;
 begin
  perform state from public.get_ability_chess_room(
   '00000000-0000-0000-0000-000000000097',null);
 exception when others then denied:=true; end;
 if not denied then raise exception 'Null token grants unauthorized legacy room read'; end if;
 denied:=false;
 begin
  perform state from public.get_ability_chess_room(
   '00000000-0000-0000-0000-000000000094',
   '00000000-0000-0000-0000-000000000095');
 exception when others then denied:=true; end;
 if not denied then raise exception 'Known competitive seat accepted without account'; end if;
 denied:=false;
 begin
  perform state from public.ability_chess_poll_seek(
   '00000000-0000-0000-0000-00000000009b',
   '00000000-0000-0000-0000-00000000009c');
 exception when others then denied:=true; end;
 if not denied then raise exception 'Competitive seek accepted without account'; end if;
end $test$;
rollback;
select 'PASS: seven auxiliary reads preserve private Ambush and reject unauthorized seats' as result;
