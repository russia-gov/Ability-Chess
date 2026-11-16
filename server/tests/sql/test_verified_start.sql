\set ON_ERROR_STOP on
do $$
begin
 if has_function_privilege('anon',
  'public.ability_chess_start_verified_room(uuid,uuid,uuid,bigint,jsonb,text)','EXECUTE')
 or has_function_privilege('authenticated',
  'public.ability_chess_start_verified_room(uuid,uuid,uuid,bigint,jsonb,text)','EXECUTE')
 then raise exception 'Client can forge canonical room start'; end if;
end $$;

insert into public.ability_chess_rooms(
 id,status,host_color,host_user_id,guest_user_id,settings,game_state
) values (
 '00000000-0000-0000-0000-0000000000a5','active','w',
 '00000000-0000-0000-0000-000000000003',
 '00000000-0000-0000-0000-000000000004','{}'::jsonb,
 '{"turn":"w","onlineStarted":false,"over":false}'::jsonb
);

do $$
declare res record; initial jsonb;
begin
 begin
  perform * from public.ability_chess_start_verified_room(
   '00000000-0000-0000-0000-0000000000a5',
   '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000004',0,
   '{"base":5,"startingPoints":4}'::jsonb,'b');
  raise exception 'Wrong account started a room';
 exception when raise_exception then
  if sqlerrm='Wrong account started a room' then raise;end if;
  if sqlerrm<>'Host account mismatch' then raise;end if;
 end;
 select * into res from public.ability_chess_start_verified_room(
   '00000000-0000-0000-0000-0000000000a5',
   '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000003',0,
   '{"base":5,"increment":2,"startingPoints":4,"upgradeLimit":2}'::jsonb,
   'b');
 if res.new_version<>1 then raise exception 'Room start version not incremented';end if;
 if res.updated_state->>'onlineStarted'<>'true'
  or res.updated_state#>>'{board,7,4}'<>'wk'
  or res.updated_state#>>'{points,b}'<>'4'
  or res.updated_state->>'hostColor'<>'b' then
   raise exception 'Canonical room start is incorrect';
 end if;
 if (select host_color from public.ability_chess_rooms
      where id='00000000-0000-0000-0000-0000000000a5')<>'b' then
    raise exception 'Room color did not update in same transaction';
 end if;
 if (select count(*) from public.ability_chess_room_actions
      where room_id='00000000-0000-0000-0000-0000000000a5'
        and action_type='setup')<>1 then
   raise exception 'Verified setup was not recorded once';
 end if;
 begin
   perform * from public.ability_chess_start_verified_room(
    '00000000-0000-0000-0000-0000000000a5',
    '00000000-0000-0000-0000-0000000000d1',
    '00000000-0000-0000-0000-000000000003',1,
    '{"base":5,"startingPoints":4}'::jsonb,'b');
   raise exception 'Room could be reset after starting';
 exception when raise_exception then
   if sqlerrm='Room could be reset after starting' then raise;end if;
   if sqlerrm<>'Room already started' then raise;end if;
 end;
end $$;
select 'Verified atomic game activation tests passed' as result;
