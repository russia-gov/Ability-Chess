\set ON_ERROR_STOP on
insert into public.ability_chess_rooms (
 id,status,host_color,host_user_id,guest_user_id,settings,game_state
) values (
 '00000000-0000-0000-0000-0000000000a4','active','w',
 '00000000-0000-0000-0000-000000000003',
 '00000000-0000-0000-0000-000000000004',
 '{"rated":false}'::jsonb,
 ('{"turn":"w","over":false,"ambushed":{"w":null,"b":{"r":3,"c":4}},'
 || '"lastMessage":"Black set ambush at e5",'
 || '"log":["Black set ambush at e5"],'
 || '"positionCounts":{"ambush 3 4":1},'
 || '"lastRecordedPositionKey":"hidden 3 4",'
 || '"historySnapshots":[{"ambushed":{"b":{"r":3,"c":4}}}]}')::jsonb
);
insert into public.ability_chess_room_actions (
 room_id,room_version,actor_color,action_type,action_label,action_payload,state_snapshot
) values (
 '00000000-0000-0000-0000-0000000000a4',1,'b','ability',
 'Black ambush at e5','{"target":{"r":3,"c":4}}'::jsonb,
 (select game_state from public.ability_chess_rooms where id='00000000-0000-0000-0000-0000000000a4')
);
do $$
declare visible jsonb; a record; hosttoken uuid:='00000000-0000-0000-0000-0000000000d1';
begin
 select state into visible from public.ability_chess_get_room_live(
   '00000000-0000-0000-0000-0000000000a4',hosttoken);
 if visible#>'{ambushed,b}' <> 'null'::jsonb then
   raise exception 'Opponent Ambush leaked in live read';
 end if;
 if visible->'positionCounts'<>'{}'::jsonb
    or visible->'historySnapshots'<>'[]'::jsonb
    or visible->'log'<>'[]'::jsonb
    or visible->>'lastMessage'<>''
    or visible->'lastRecordedPositionKey'<>'null'::jsonb then
   raise exception 'Private metadata leaked through live read';
 end if;
 select * into a from public.ability_chess_get_room_actions(
   '00000000-0000-0000-0000-0000000000a4',hosttoken,0);
 if a.action_type<>'private' or a.action_label<>'Opponent action'
   or a.action_payload <> '{}'::jsonb then
   raise exception 'Opponent private action metadata leaked';
 end if;
 if a.state_snapshot#>'{ambushed,b}' <> 'null'::jsonb
    or a.state_snapshot->'positionCounts' <> '{}'::jsonb
    or a.state_snapshot->'historySnapshots' <> '[]'::jsonb then
   raise exception 'Hidden state leaked through action snapshot';
 end if;
 begin
   perform 1 from public.ability_chess_get_room_live(
    '00000000-0000-0000-0000-0000000000a4',
    '00000000-0000-0000-0000-0000000000ff');
   raise exception 'Unknown seat token accepted';
 exception when raise_exception then
  if sqlerrm='Unknown seat token accepted' then raise; end if;
  if sqlerrm<>'Invalid seat token' then raise; end if;
 end;
 -- Adding rated mode must require the actual authenticated seat owner.
 update public.ability_chess_rooms set settings='{"rated":true}'::jsonb
 where id='00000000-0000-0000-0000-0000000000a4';
 begin
   perform 1 from public.ability_chess_get_room_live(
    '00000000-0000-0000-0000-0000000000a4',hosttoken);
   raise exception 'Anon could view rated room';
 exception when raise_exception then
  if sqlerrm='Anon could view rated room' then raise; end if;
  if sqlerrm<>'Account does not own competitive game seat' then raise; end if;
 end;
end $$;
select 'Hidden ability and rated seat read security tests passed' as result;
