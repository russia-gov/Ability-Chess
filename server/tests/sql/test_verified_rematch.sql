\set ON_ERROR_STOP on
do $$
begin
 if has_function_privilege('anon',
  'public.ability_chess_verified_rematch(uuid,uuid,uuid,text)','EXECUTE')
  or has_function_privilege('authenticated',
  'public.ability_chess_verified_rematch(uuid,uuid,uuid,text)','EXECUTE')
 then raise exception 'Rematch RPC publicly callable'; end if;
end $$;

insert into public.ability_chess_rooms
 (id,status,host_color,host_user_id,guest_user_id,settings,game_state)
 values ('00000000-0000-0000-0000-0000000000c1','finished','w',
 '00000000-0000-0000-0000-000000000003',
 '00000000-0000-0000-0000-000000000004',
 '{"rated":false,"base":10,"increment":2,"startingPoints":3,"upgradeLimit":3}'::jsonb,
 '{"turn":"b","over":true,"winner":"w","resultReason":"checkmate","points":{"w":20,"b":0}}'::jsonb);

do $$
declare
 result record;
 original jsonb;
 old_code text;
 new_id uuid;
begin
 select game_state,room_code into original,old_code
  from public.ability_chess_rooms where id='00000000-0000-0000-0000-0000000000c1';
 begin
  perform public.ability_chess_verified_rematch(
   '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000004','offer');
  raise exception 'Wrong account offered a rematch';
 exception when raise_exception then
  if sqlerrm='Wrong account offered a rematch' then raise;end if;
  if sqlerrm<>'Rematch seat account mismatch' then raise;end if;
 end;
 select * into result from public.ability_chess_verified_rematch(
   '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000003','offer');
 if result.rematch_status<>'offered' or result.offered_by<>'w'
 then raise exception 'Rematch offer not recorded';end if;
 select * into result from public.ability_chess_verified_rematch(
   '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000d2',
   '00000000-0000-0000-0000-000000000004','status');
 if result.rematch_status<>'offered' or result.offered_by<>'w'
 then raise exception 'Guest cannot observe opponent offer';end if;
 begin
  perform public.ability_chess_verified_rematch(
   '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000003','accept');
  raise exception 'Player accepted own offer';
 exception when raise_exception then
  if sqlerrm='Player accepted own offer' then raise;end if;
  if sqlerrm<>'No opponent rematch offer to accept' then raise;end if;
 end;
 select * into result from public.ability_chess_verified_rematch(
   '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000d2',
   '00000000-0000-0000-0000-000000000004','accept');
 new_id:=result.room_id;
 if result.rematch_status<>'ready' or new_id is null
   or new_id='00000000-0000-0000-0000-0000000000c1'
   or result.assigned_color<>'w'
   or result.seat_token='00000000-0000-0000-0000-0000000000d2'
 then raise exception 'Guest did not receive independent rematch seat';end if;
 if result.state->>'onlineStarted'<>'true'
  or result.state->>'mode'<>'online'
  or result.state->>'turn'<>'w'
  or result.state->'points'->>'w'<>'3'
  or result.state->'points'->>'b'<>'3'
  or result.state->'board'->0->0<>'"br"'
 then raise exception 'Rematch did not start from canonical state';end if;
 if (select host_color from public.ability_chess_rooms where id=new_id)<>'b'
  or (select room_code from public.ability_chess_rooms where id=new_id)=old_code
 then raise exception 'Rematch did not create a fresh room with swapped colors';end if;
 if (select game_state from public.ability_chess_rooms
     where id='00000000-0000-0000-0000-0000000000c1') is distinct from original
 then raise exception 'Original finished game was modified';end if;
 select * into result from public.ability_chess_verified_rematch(
   '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000003','status');
 if result.room_id<>new_id or result.assigned_color<>'b'
 then raise exception 'Host cannot recover rematch room';end if;
 if result.seat_token=(select guest_token from public.ability_chess_rooms where id=new_id)
 then raise exception 'Guest token leaked to host';end if;
 if (select count(*) from public.ability_chess_rooms
     where id=new_id)<>1 then raise exception 'Multiple rematch rooms';end if;
 begin
  perform public.ability_chess_verified_rematch(
   '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000d2',
   '00000000-0000-0000-0000-000000000004','accept');
  raise exception 'Duplicate rematch acceptance succeeded';
 exception when raise_exception then
  if sqlerrm='Duplicate rematch acceptance succeeded' then raise;end if;
  if sqlerrm<>'No opponent rematch offer to accept' then raise;end if;
 end;
end $$;

insert into public.ability_chess_rooms
 (id,status,host_color,host_user_id,guest_user_id,settings,game_state)
 values ('00000000-0000-0000-0000-0000000000c2','finished','w',
 '00000000-0000-0000-0000-000000000003',
 '00000000-0000-0000-0000-000000000004',
 '{"rated":true}'::jsonb,'{"turn":"b","over":true}'::jsonb);

do $$
begin
 begin
  perform public.ability_chess_verified_rematch(
   '00000000-0000-0000-0000-0000000000c2',
   '00000000-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000003','offer');
  raise exception 'Rated rematch bypassed matchmaking';
 exception when raise_exception then
  if sqlerrm='Rated rematch bypassed matchmaking' then raise;end if;
  if sqlerrm<>'Rated and tournament rematches require separate matchmaking' then raise;end if;
 end;
end $$;

insert into public.ability_chess_rooms
 (id,status,host_color,host_user_id,guest_user_id,settings,game_state)
 values ('00000000-0000-0000-0000-0000000000c3','finished','w',
 '00000000-0000-0000-0000-000000000003',
 '00000000-0000-0000-0000-000000000004',
 '{}'::jsonb,'{"turn":"b","over":true}'::jsonb);

do $$
declare result record;
begin
 perform public.ability_chess_verified_rematch(
  '00000000-0000-0000-0000-0000000000c3',
  '00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-000000000003','offer');
 select * into result from public.ability_chess_verified_rematch(
  '00000000-0000-0000-0000-0000000000c3',
  '00000000-0000-0000-0000-0000000000d2',
  '00000000-0000-0000-0000-000000000004','decline');
 if result.rematch_status<>'none' then raise exception 'Decline did not cancel offer';end if;
end $$;
select 'Verified rematch tests passed' as result;
