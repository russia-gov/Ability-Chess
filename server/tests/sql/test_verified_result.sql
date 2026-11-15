-- Fail this test script upon any unexpected condition.
\set ON_ERROR_STOP on
-- Verify browser roles cannot execute finalization.
do $$
begin
 if has_function_privilege('anon',
       'public.ability_chess_finalize_verified_room(uuid,text,text)','EXECUTE')
    or has_function_privilege('authenticated',
       'public.ability_chess_finalize_verified_room(uuid,text,text)','EXECUTE')
 then raise exception 'Untrusted role can finalize a game'; end if;
 if not has_function_privilege('service_role',
       'public.ability_chess_finalize_verified_room(uuid,text,text)','EXECUTE')
 then raise exception 'Trusted service role cannot finalize a game'; end if;
end $$;

insert into public.ability_chess_profiles(id,rapid_rating) values
 ('00000000-0000-0000-0000-000000000001',1200),
 ('00000000-0000-0000-0000-000000000002',1400);
insert into public.ability_chess_rooms
 (id,status,host_color,host_user_id,guest_user_id,settings) values
 ('00000000-0000-0000-0000-0000000000a1','finished','w',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '{"rated":true,"ratingCategory":"rapid"}'::jsonb);
insert into public.ability_chess_tournament_games
 (id,tournament_id,room_id,white_id,black_id,status) values
 ('00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002','active');
insert into public.ability_chess_tournament_entries
 (tournament_id,user_id,score,pairing_status,current_room_id,assigned_color) values
 ('00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-000000000001',0,'paired',
  '00000000-0000-0000-0000-0000000000a1','w'),
 ('00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-000000000002',0,'paired',
  '00000000-0000-0000-0000-0000000000a1','b');

do $$
declare applied boolean;
begin
 select public.ability_chess_finalize_verified_room(
  '00000000-0000-0000-0000-0000000000a1','w','verified checkmate')
  into applied;
 if applied is distinct from true then raise exception 'First finalization failed'; end if;
 if (select rapid_rating from public.ability_chess_profiles
      where id='00000000-0000-0000-0000-000000000001') <> 1224
   or (select rapid_rating from public.ability_chess_profiles
      where id='00000000-0000-0000-0000-000000000002') <> 1376
 then raise exception 'Ratings did not use identical original Elo snapshots'; end if;
 if (select count(*) from public.ability_chess_rating_results) <> 2
 then raise exception 'Both players must get rating records'; end if;
 if (select count(*) from public.ability_chess_profiles
      where games_played=1) <> 2
 then raise exception 'Both players must have one completed game'; end if;
 if (select score from public.ability_chess_tournament_entries
      where user_id='00000000-0000-0000-0000-000000000001') <> 1
   or (select score from public.ability_chess_tournament_entries
      where user_id='00000000-0000-0000-0000-000000000002') <> 0
 then raise exception 'Tournament standings incorrect'; end if;
 if (select result from public.ability_chess_tournament_games
      where room_id='00000000-0000-0000-0000-0000000000a1') <> 'white'
 then raise exception 'Tournament game result incorrect'; end if;
 select public.ability_chess_finalize_verified_room(
  '00000000-0000-0000-0000-0000000000a1','w','verified checkmate')
  into applied;
 if applied is distinct from false then raise exception 'Duplicate result not idempotent'; end if;
 if (select count(*) from public.ability_chess_rating_results) <> 2
 then raise exception 'Duplicate award created'; end if;
 begin
  perform public.ability_chess_finalize_verified_room(
    '00000000-0000-0000-0000-0000000000a1','b','forged conflicting result');
  raise exception 'Conflicting result improperly accepted';
 exception when raise_exception then
  if sqlerrm='Conflicting result improperly accepted' then raise; end if;
  if sqlerrm <> 'Conflicting immutable verified result' then raise; end if;
 end;
end $$;
select 'Verified result tests passed' as result;
