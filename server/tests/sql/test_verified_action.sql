\set ON_ERROR_STOP on
do $$
begin
 if has_function_privilege('anon',
     'public.ability_chess_commit_verified_action(uuid,uuid,uuid,bigint,jsonb,text,jsonb)',
     'EXECUTE') or has_function_privilege('authenticated',
     'public.ability_chess_commit_verified_action(uuid,uuid,uuid,bigint,jsonb,text,jsonb)',
     'EXECUTE') then
  raise exception 'Untrusted client can commit a verified action';
 end if;
end $$;
insert into public.ability_chess_profiles(id) values
 ('00000000-0000-0000-0000-000000000003'),
 ('00000000-0000-0000-0000-000000000004');
insert into public.ability_chess_rooms
 (id,status,host_color,host_user_id,guest_user_id,settings,game_state) values
 ('00000000-0000-0000-0000-0000000000a2','active','w',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '{"rated":true,"ratingCategory":"rapid"}'::jsonb,
  '{"turn":"w","over":false}'::jsonb);
-- Simulate a player whose current turn began well before this commit.
update public.ability_chess_rooms set updated_at=now()-interval '90 seconds'
 where id='00000000-0000-0000-0000-0000000000a2';
do $
declare ver bigint;aid bigint;
begin
 begin
  perform public.ability_chess_commit_verified_action(
   '00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000004',0,
   '{"turn":"b","over":false}'::jsonb,'move');
  raise exception 'Wrong account forged a seat';
 exception when raise_exception then
  if sqlerrm='Wrong account forged a seat' then raise; end if;
  if sqlerrm <> 'Authenticated caller does not own this seat' then raise; end if;
 end;
 select new_version,action_id into ver,aid
  from public.ability_chess_commit_verified_action(
   '00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000003',0,
   '{"turn":"b","over":false}'::jsonb,'move');
 if ver<>1 or aid is null then raise exception 'Expected one verified version'; end if;
 -- A verified action must reset the timestamp used by the server's
 -- remaining-clock calculation; otherwise the next turn loses old elapsed time.
 if (select updated_at from public.ability_chess_rooms
     where id='00000000-0000-0000-0000-0000000000a2')
    < now() - interval '5 seconds' then
   raise exception 'Verified action left a stale clock baseline';
 end if;
 if (select count(*) from public.ability_chess_room_actions
     where room_id='00000000-0000-0000-0000-0000000000a2')<>1 then
    raise exception 'Expected exactly one authoritative action event';
 end if;
 begin
  perform public.ability_chess_commit_verified_action(
   '00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000003',0,
   '{"turn":"b","over":false}'::jsonb,'move');
  raise exception 'Stale version was accepted';
 exception when raise_exception then
  if sqlerrm='Stale version was accepted' then raise; end if;
  if sqlerrm <> 'Version conflict' then raise; end if;
 end;
 begin
  perform public.ability_chess_commit_verified_action(
   '00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000003',1,
   '{"turn":"b","over":false}'::jsonb,'move');
  raise exception 'Moving out of turn was accepted';
 exception when raise_exception then
  if sqlerrm='Moving out of turn was accepted' then raise; end if;
  if sqlerrm <> 'Wrong player turn' then raise; end if;
 end;
end $$;

-- Settlement must be atomic with the terminal transition.
-- Use a fresh competitive room and both player profiles from the fixture.
insert into public.ability_chess_rooms
 (id,status,host_color,host_user_id,guest_user_id,settings,game_state) values
 ('00000000-0000-0000-0000-0000000000a3','active','w',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '{"rated":true,"ratingCategory":"rapid"}'::jsonb,
  '{"turn":"w","over":false}'::jsonb);

do $$
declare n bigint;
begin
 select new_version into n from public.ability_chess_commit_verified_action(
  '00000000-0000-0000-0000-0000000000a3',
  '00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-000000000003',0,
  '{"turn":"w","over":true,"winner":"w","resultReason":"checkmate"}'::jsonb,
  'move');
 if n<>1 then raise exception 'Wrong terminal version'; end if;
 if (select count(*) from public.ability_chess_verified_room_results
     where room_id='00000000-0000-0000-0000-0000000000a3')<>1
 then raise exception 'Terminal game missing verified result'; end if;
 if (select count(*) from public.ability_chess_rating_results
     where game_key='room:00000000-0000-0000-0000-0000000000a3')<>2
 then raise exception 'Ratings did not settle atomically'; end if;
 if (select status from public.ability_chess_rooms
     where id='00000000-0000-0000-0000-0000000000a3')<>'finished'
 then raise exception 'Terminal status not saved'; end if;
end $$;
select 'Verified action persistence and atomic settlement tests passed' as result;
