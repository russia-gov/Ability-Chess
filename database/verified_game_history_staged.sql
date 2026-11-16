-- STAGED: trusted online history derived from server-recorded action snapshots.
-- Must be installed before the verified finalization RPC is invoked.
-- Players cannot forge or overwrite history via this function.
begin;
create or replace function public.ability_chess_record_verified_history(
 p_room_id uuid
) returns void
language plpgsql security definer set search_path=''
as $$
declare
 r public.ability_chess_rooms%rowtype;
 result public.ability_chess_verified_room_results%rowtype;
 history_snapshots jsonb;
 entry record;
 rating record;
 current_result text;
 opponent_name text;
 key text;
begin
 select * into r from public.ability_chess_rooms
   where id=p_room_id and status='finished';
 if not found then raise exception 'Game must be finished to record history';end if;
 select * into result from public.ability_chess_verified_room_results
   where room_id=p_room_id;
 if not found then raise exception 'Verified result missing';end if;
 key:='room:'||p_room_id::text;
 select coalesce(jsonb_agg(
   a.state_snapshot||jsonb_build_object('move',a.action_payload)
   order by a.room_version
 ),'[]'::jsonb) into history_snapshots
 from public.ability_chess_room_actions a where a.room_id=p_room_id;
 for entry in
  select result.white_id as player_id,'w'::text as color,result.black_id as opponent_id
  union all
  select result.black_id,'b'::text,result.white_id
 loop
  current_result:=case when result.winner='draw' then 'draw'
   when result.winner=entry.color then 'win' else 'loss' end;
  select coalesce(nullif(display_name,''),nullif(username,''),'Online opponent')
   into opponent_name from public.ability_chess_profiles where id=entry.opponent_id;
  select rating_before,rating_after,rating_change into rating
   from public.ability_chess_rating_results
   where player_id=entry.player_id and game_key=key;
  insert into public.ability_chess_game_history(
   player_id,game_key,mode,player_color,result,result_reason,opponent_name,
   settings,replay,rating_before,rating_after,rating_change
  ) values(
   entry.player_id,key,'online',entry.color,current_result,result.result_reason,
   coalesce(opponent_name,'Online opponent'),r.settings,
   jsonb_build_object('version',1,'historySnapshots',history_snapshots,
     'settings',r.settings,'playerColor',entry.color,'mode','online',
     'final',jsonb_build_object('clocks',r.game_state->'clocks',
       'winner',r.game_state->'winner','resultReason',result.result_reason)),
   rating.rating_before,rating.rating_after,rating.rating_change
  ) on conflict(player_id,game_key) do nothing;
 end loop;
end;
$$;
revoke all on function public.ability_chess_record_verified_history(uuid)
 from public,anon,authenticated;
grant execute on function public.ability_chess_record_verified_history(uuid)
 to service_role;
commit;
