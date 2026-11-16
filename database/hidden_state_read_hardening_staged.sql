-- STAGED ONLY. Redact the opponent's private ability state from legacy
-- online reads; use at coordinated cutover. Legacy RPC signatures preserved.
-- The action history may contain full state snapshots/position repetition
-- keys, so hiding the visual Ambush icon alone is not sufficient.
begin;
create or replace function public.ability_chess_viewer_state(
 p_state jsonb, p_viewer_color text
) returns jsonb language plpgsql immutable set search_path = ''
as $$
declare
 visible jsonb;
 hidden_color text;
begin
 if p_viewer_color not in ('w','b') then raise exception 'Invalid viewer color'; end if;
 if jsonb_typeof(p_state)<>'object' then raise exception 'Invalid game state'; end if;
 visible := p_state
   - 'positionCounts' - 'lastRecordedPositionKey'
   - 'historySnapshots' - 'historyGameKey'
   - 'log' - 'lastMessage';
 -- Keep harmless collection shapes for existing browser rendering while
 -- removing actual private keys, replay history and hidden action logs.
 visible:=visible||jsonb_build_object(
   'positionCounts','{}'::jsonb,'lastRecordedPositionKey',null,
   'historySnapshots','[]'::jsonb,'log','[]'::jsonb,
   'lastMessage','');
 if coalesce((visible->>'over')::boolean,false)=false then
   hidden_color:=case when p_viewer_color='w' then 'b' else 'w' end;
   if jsonb_typeof(visible->'ambushed')='object' then
     visible:=jsonb_set(visible,array['ambushed',hidden_color],'null'::jsonb,true);
   end if;
 end if;
 return visible;
end;
$$;
revoke all on function public.ability_chess_viewer_state(jsonb,text)
 from public,anon,authenticated;
grant execute on function public.ability_chess_viewer_state(jsonb,text)
 to service_role;

create or replace function public.ability_chess_get_room_live(
 p_room_id uuid,p_seat_token uuid)
 returns table(state jsonb,room_settings jsonb,room_status text,
   room_version bigint,opponent_joined boolean,
   state_updated_at timestamptz,server_now timestamptz)
 language plpgsql security definer set search_path=''
as $$
declare
 r public.ability_chess_rooms%rowtype;
 viewer text;
 owner_id uuid;
begin
 select * into r from public.ability_chess_rooms
 where id=p_room_id and expires_at>now();
 if not found then raise exception 'Room not found or expired'; end if;
 if p_seat_token=r.host_token then
   viewer:=r.host_color;owner_id:=r.host_user_id;
 elsif p_seat_token=r.guest_token and r.guest_token is not null then
   viewer:=case when r.host_color='w' then 'b' else 'w' end;
   owner_id:=r.guest_user_id;
 else raise exception 'Invalid seat token';end if;
 -- Enforce signed-in account on account-owned competitive seats. The
 -- corresponding client must use authenticated member RPC, not anon RPC.
 if (coalesce((r.settings->>'rated')::boolean,false)
     or r.settings ? 'tournamentId') and
     (owner_id is null or auth.uid() is distinct from owner_id) then
   raise exception 'Account does not own competitive game seat';
 end if;
 return query select public.ability_chess_viewer_state(r.game_state,viewer),
   r.settings,r.status,r.version,(r.guest_token is not null),r.updated_at,now();
end;
$$;

create or replace function public.ability_chess_get_room_actions(
 p_room_id uuid,p_seat_token uuid,p_after_version bigint default 0)
 returns table(action_id bigint,room_version bigint,actor_color text,
  action_type text,action_label text,action_payload jsonb,
  state_snapshot jsonb,created_at timestamptz)
 language plpgsql security definer set search_path=''
as $$
declare
 r public.ability_chess_rooms%rowtype;
 viewer text;
 owner_id uuid;
begin
 select * into r from public.ability_chess_rooms
 where id=p_room_id and expires_at>now();
 if not found then raise exception 'Room not found or expired'; end if;
 if p_seat_token=r.host_token then
   viewer:=r.host_color;owner_id:=r.host_user_id;
 elsif p_seat_token=r.guest_token and r.guest_token is not null then
   viewer:=case when r.host_color='w' then 'b' else 'w' end;
   owner_id:=r.guest_user_id;
 else raise exception 'Invalid seat token';end if;
 if (coalesce((r.settings->>'rated')::boolean,false)
    or r.settings ? 'tournamentId') and
    (owner_id is null or auth.uid() is distinct from owner_id) then
   raise exception 'Account does not own competitive game seat';
 end if;
 return query select a.id,a.room_version,a.actor_color,
   case when a.actor_color is distinct from viewer
       and a.action_type in('ability','upgrade')
        then 'private'::text else a.action_type end,
   case when a.actor_color is distinct from viewer
       and a.action_type in('ability','upgrade')
        then 'Opponent action'::text else a.action_label end,
   case when a.actor_color is distinct from viewer
       and a.action_type in('ability','upgrade')
        then '{}'::jsonb else coalesce(a.action_payload,'{}'::jsonb) end,
   public.ability_chess_viewer_state(a.state_snapshot,viewer),
   a.created_at
 from public.ability_chess_room_actions a
 where a.room_id=p_room_id
   and a.room_version>greatest(0,coalesce(p_after_version,0))
 order by a.room_version limit 100;
end;
$$;
commit;
