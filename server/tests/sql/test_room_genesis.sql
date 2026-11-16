\set ON_ERROR_STOP on
insert into public.ability_chess_profiles(id,username,display_name) values
 ('00000000-0000-0000-0000-000000000001','alice','Alice'),
 ('00000000-0000-0000-0000-000000000002','bob','Bob');
do $$
declare
 r record;
 room public.ability_chess_rooms%rowtype;
 challenge uuid;
 first_seek uuid;
 rated_room uuid;
 tournament_id uuid:='00000000-0000-0000-0000-0000000000e1';
 matched_room uuid;
 caller_color text;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 select * into r from public.create_ability_chess_room(
  '{"board":"FORGED","points":{"w":999999,"b":0},"winner":"w"}'::jsonb,
  '{"base":5,"increment":0,"startingPoints":3,"upgradeLimit":2,"ratingCategory":"bullet"}'::jsonb,
  'b');
 select * into room from public.ability_chess_rooms where id=r.room_id;
 if room.game_state#>>'{board,7,4}'<>'wk'
    or room.game_state#>>'{points,w}'<>'3'
    or room.game_state->>'winner' is not null
    or room.settings->>'ratingCategory'<>'blitz'
 then raise exception 'Direct room accepted fabricated state or rating category';end if;

 select challenge_id into challenge from public.ability_chess_create_member_challenge(
  '{"board":"FORGED","points":{"w":999999}}'::jsonb,
  '{"base":10,"increment":0,"startingPoints":4,"upgradeLimit":3,"rated":true}'::jsonb,
  '00000000-0000-0000-0000-000000000002');
 if challenge is null then raise exception 'Challenge not created';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 select * into r from public.ability_chess_accept_member_challenge(challenge);
 select * into room from public.ability_chess_rooms where id=r.room_id;
 if room.game_state->>'onlineStarted'<>'true'
    or room.game_state#>>'{board,7,4}'<>'wk'
    or room.game_state#>>'{points,w}'<>'4'
 then raise exception 'Challenge did not start from official state';end if;
 if room.host_user_id<>'00000000-0000-0000-0000-000000000001'::uuid
    or room.guest_user_id<>'00000000-0000-0000-0000-000000000002'::uuid
 then raise exception 'Challenge authentication ownership not preserved';end if;

 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 select * into r from public.ability_chess_create_or_match_seek(
  'matching-test','{"board":"FORGED","points":{"w":999}}'::jsonb,
  '{"base":1,"increment":0,"startingPoints":6,"rated":true,"ratingCategory":"rapid"}'::jsonb);
 if r.matched is distinct from false then raise exception 'First seek should wait';end if;
 first_seek:=r.seek_id;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 select * into r from public.ability_chess_create_or_match_seek(
  'matching-test','{"board":"FORGED","points":{"w":999}}'::jsonb,
  '{"base":1,"increment":0,"startingPoints":6,"rated":true,"ratingCategory":"rapid"}'::jsonb);
 if r.matched is distinct from true or r.seek_id<>first_seek then
  raise exception 'Second player did not join waiting seek';
 end if;
 select * into room from public.ability_chess_rooms where id=r.room_id;
 if room.game_state->>'onlineStarted'<>'true'
    or room.game_state#>>'{points,w}'<>'6'
    or room.game_state#>>'{board,0,4}'<>'bk'
    or room.settings->>'ratingCategory'<>'bullet'
 then raise exception 'Live seek accepted forged state or category';end if;

 insert into public.ability_chess_tournaments(
  id,name,format,status,starts_at,ends_at,rounds,arena_minutes,
  base_minutes,increment_seconds,starting_points,max_upgrades,
  abilities_enabled,upgrades_enabled,rated
 ) values (
  tournament_id,'Test Arena','arena','open',
  now()-interval '1 hour',now()+interval '1 hour',
  4,60,3,2,5,2,true,true,true
 );
 insert into public.ability_chess_tournament_entries(tournament_id,user_id,score,pairing_status)
 values
 (tournament_id,'00000000-0000-0000-0000-000000000001',0,'idle'),
 (tournament_id,'00000000-0000-0000-0000-000000000002',0,'idle');
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 select * into r from public.ability_chess_tournament_claim_game(
  tournament_id,'{"board":"FORGED"}'::jsonb,
  '{"base":90,"startingPoints":100,"rated":false}'::jsonb);
 if r.matched is distinct from false then
  raise exception 'First tournament participant should wait';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 select * into r from public.ability_chess_tournament_claim_game(
  tournament_id,'{"board":"FORGED"}'::jsonb,
  '{"base":90,"startingPoints":100,"rated":false}'::jsonb);
 if r.matched is distinct from true then raise exception 'Tournament pairing missing';end if;
 matched_room:=r.room_id;caller_color:=r.assigned_color;
 select * into room from public.ability_chess_rooms where id=matched_room;
 if room.game_state->>'onlineStarted'<>'true'
    or room.game_state#>>'{board,7,4}'<>'wk'
    or room.game_state#>>'{points,w}'<>'5'
    or room.settings->>'rated'<>'true'
    or room.settings->>'ratingCategory'<>'blitz'
 then raise exception 'Tournament client forged official settings';end if;
 if room.host_user_id<>'00000000-0000-0000-0000-000000000002'::uuid
    or room.guest_user_id<>'00000000-0000-0000-0000-000000000001'::uuid
    or room.host_color<>caller_color
    or room.host_token<>r.seat_token
 then raise exception 'Random tournament seat token and account disagree';end if;
 if (select count(*) from public.ability_chess_tournament_games
     where room_id=matched_room)<>1
 then raise exception 'Paired tournament game not recorded';end if;
end $$;
select 'Server-generated direct, challenge, seek and tournament genesis checks passed' as result;
