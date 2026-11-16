-- STAGED ONLY. Trusted persistence boundary for a future server-side rules reducer.
-- It is intentionally service-role-only; DO NOT expose it to browsers.
-- The caller MUST independently validate/apply the move or ability before
-- supplying p_next_state. This function enforces identity/version/turn atomicity,
-- but does not itself decide whether that new board position is legal.

begin;
create or replace function public.ability_chess_commit_verified_action(
 p_room_id uuid,
 p_seat_token uuid,
 p_actor_user_id uuid,
 p_expected_version bigint,
 p_next_state jsonb,
 p_action_type text,
 p_action_payload jsonb default '{}'::jsonb
) returns table(new_version bigint, updated_state jsonb, action_id bigint)
language plpgsql security definer set search_path=''
as $$
declare
 room_row public.ability_chess_rooms%rowtype;
 acting_user uuid;
 acting_color text;
 new_row public.ability_chess_rooms%rowtype;
 new_action_id bigint;
 is_competitive boolean;
 next_over boolean;
begin
 if p_action_type not in ('move','ability','upgrade','resign','draw','timeout') then
   raise exception 'Unrecognized verified action type';
 end if;
 if jsonb_typeof(p_next_state) <> 'object'
   or p_next_state->>'turn' not in('w','b')
   or jsonb_typeof(p_next_state->'over') is distinct from 'boolean' then
   raise exception 'Invalid verified state shape';
 end if;
 next_over := (p_next_state->>'over')::boolean;

 select * into room_row from public.ability_chess_rooms
   where id=p_room_id for update;
 if not found or room_row.expires_at<=now() then
   raise exception 'Room missing or expired';
 end if;
 if room_row.status <> 'active' then
   raise exception 'Room is not active';
 end if;
 if room_row.version <> p_expected_version then
   raise exception 'Version conflict';
 end if;
 if p_seat_token=room_row.host_token then
   acting_user:=room_row.host_user_id;
   acting_color:=room_row.host_color;
 elsif p_seat_token=room_row.guest_token then
   acting_user:=room_row.guest_user_id;
   acting_color:=case when room_row.host_color='w' then 'b' else 'w' end;
 else
   raise exception 'Invalid seat token';
 end if;
 is_competitive:=coalesce((room_row.settings->>'rated')::boolean,false)
   or room_row.settings ? 'tournamentId';

 -- All account-owned seats require a matching authenticated caller. For
 -- competitive rooms both seats must be bound to authenticated profiles.
 if acting_user is distinct from p_actor_user_id then
   raise exception 'Authenticated caller does not own this seat';
 end if;
 if is_competitive and (acting_user is null
    or room_row.host_user_id is null or room_row.guest_user_id is null) then
   raise exception 'Competitive room requires authenticated players';
 end if;
 if p_action_type in('move','ability','upgrade') and
   room_row.game_state->>'turn' <> acting_color then
   raise exception 'Wrong player turn';
 end if;
 if p_action_type in('move','ability','upgrade')
   and coalesce((room_row.game_state->>'over')::boolean,false) then
   raise exception 'Game already finished';
 end if;

 update public.ability_chess_rooms
   set game_state=p_next_state,
       status=case when next_over then 'finished' else 'active' end,
       version=version+1,
       -- Clock accounting in Edge uses this as the current turn's baseline.
       -- Without refreshing it, each new turn is charged for previous turns.
       updated_at=now()
   where id=p_room_id returning * into new_row;

 insert into public.ability_chess_room_actions
   (room_id,room_version,actor_id,actor_color,
    action_type,action_payload,state_snapshot)
 values (new_row.id,new_row.version,acting_user,acting_color,
   p_action_type,coalesce(p_action_payload,'{}'::jsonb),new_row.game_state)
 returning id into new_action_id;

 -- Critical: result settlement happens inside the same locked transaction
 -- as the verified terminal action. No finished-but-unrated intermediate state.
 if next_over and is_competitive then
   if p_next_state->>'winner' not in ('w','b')
      and p_next_state->>'winner' is not null then
      raise exception 'Invalid authoritative game winner';
   end if;
   perform public.ability_chess_finalize_verified_room(
     p_room_id,coalesce(p_next_state->>'winner','draw'),
     left(coalesce(p_next_state->>'resultReason',''),250)
   );
 end if;
 return query select new_row.version,new_row.game_state,new_action_id;
end;
$$;
revoke all on function public.ability_chess_commit_verified_action(
 uuid,uuid,uuid,bigint,jsonb,text,jsonb)
 from public,anon,authenticated;
grant execute on function public.ability_chess_commit_verified_action(
 uuid,uuid,uuid,bigint,jsonb,text,jsonb) to service_role;
commit;

-- Cutover requirement: revoke legacy direct state mutation RPC EXECUTE from
-- public/anon/authenticated after the trusted action handler is fully deployed.
-- Do NOT leave ability_chess_update_room_action as a bypass.
