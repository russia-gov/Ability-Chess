-- STAGED ONLY: mutual-consent casual rematches. Never reset a finished room.
-- Deploy with verified-game Edge and the browser adapter at the same cutover.
begin;
create table if not exists public.ability_chess_verified_rematches (
 source_room_id uuid primary key references public.ability_chess_rooms(id),
 offered_color text not null check (offered_color in ('w','b')),
 new_room_id uuid unique references public.ability_chess_rooms(id),
 created_at timestamptz not null default now()
);
alter table public.ability_chess_verified_rematches enable row level security;
revoke all on public.ability_chess_verified_rematches from public,anon,authenticated;

create or replace function public.ability_chess_verified_rematch(
 p_room_id uuid,p_seat_token uuid,p_actor_user_id uuid,p_operation text
) returns table(
 rematch_status text,offered_by text,room_id uuid,room_version bigint,
 seat_token uuid,assigned_color text,state jsonb,room_settings jsonb
)
language plpgsql security definer set search_path=''
as $rematch$
declare
 old_room public.ability_chess_rooms%rowtype;
 offer_row public.ability_chess_verified_rematches%rowtype;
 new_room public.ability_chess_rooms%rowtype;
 actor_color text;
 actor_user uuid;
 next_host_color text;
 candidate text;
 alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 cfg jsonb;
 official jsonb;
 attempt integer;
 i integer;
begin
 if p_operation not in ('status','offer','accept','decline') then
  raise exception 'Invalid rematch operation';
 end if;
 select * into old_room from public.ability_chess_rooms
  where id=p_room_id for update;
 if not found or old_room.expires_at<=now() then
  raise exception 'Source game missing or expired';
 end if;
 if p_seat_token=old_room.host_token then
  actor_color:=old_room.host_color;
  actor_user:=old_room.host_user_id;
 elsif p_seat_token=old_room.guest_token and old_room.guest_token is not null then
  actor_color:=case when old_room.host_color='w' then 'b' else 'w' end;
  actor_user:=old_room.guest_user_id;
 else
  raise exception 'Invalid rematch seat';
 end if;
 if actor_user is distinct from p_actor_user_id then
  raise exception 'Rematch seat account mismatch';
 end if;
 if old_room.status<>'finished'
    or coalesce((old_room.game_state->>'over')::boolean,false) is not true
    or old_room.guest_token is null then
  raise exception 'Rematch requires a completed two-player game';
 end if;
 if coalesce((old_room.settings->>'rated')::boolean,false)
    or old_room.settings ? 'tournamentId' then
  raise exception 'Rated and tournament rematches require separate matchmaking';
 end if;
 select * into offer_row from public.ability_chess_verified_rematches
  where source_room_id=p_room_id for update;
 if p_operation='offer' then
  if not found then
   insert into public.ability_chess_verified_rematches(source_room_id,offered_color)
    values(p_room_id,actor_color) returning * into offer_row;
  elsif offer_row.new_room_id is null and offer_row.offered_color<>actor_color then
   raise exception 'Accept the opponent rematch offer instead';
  end if;
 elsif p_operation='decline' then
  if found and offer_row.new_room_id is null then
   delete from public.ability_chess_verified_rematches
    where source_room_id=p_room_id;
   offer_row:=null;
  end if;
 elsif p_operation='accept' then
  if not found or offer_row.new_room_id is not null
     or offer_row.offered_color=actor_color then
   raise exception 'No opponent rematch offer to accept';
  end if;
  -- A new room starts with fresh tokens, swapped colors, a canonical board,
  -- zero earned points and no prior-game results or hidden ability state.
  next_host_color:=case when old_room.host_color='w' then 'b' else 'w' end;
  cfg:=jsonb_build_object(
   'base',coalesce((old_room.settings->>'base')::integer,10),
   'increment',coalesce((old_room.settings->>'increment')::integer,0),
   'startingPoints',coalesce((old_room.settings->>'startingPoints')::integer,0),
   'upgradeLimit',coalesce((old_room.settings->>'upgradeLimit')::integer,3),
   'abilitiesEnabled',coalesce((old_room.settings->>'abilitiesEnabled')::boolean,true),
   'upgradesEnabled',coalesce((old_room.settings->>'upgradesEnabled')::boolean,true));
  official:=public.ability_chess_initial_state(cfg);
  cfg:=cfg || jsonb_build_object(
    'rated',false,'hostColor',next_host_color,
    'ratingCategory',case when (cfg->>'base')::integer*60+
       40*(cfg->>'increment')::integer<180 then 'bullet'
      when (cfg->>'base')::integer*60+
       40*(cfg->>'increment')::integer<600 then 'blitz' else 'rapid' end,
    'rematchOf',p_room_id);
  official:=official||jsonb_build_object(
   'onlineStarted',true,'hostColor',next_host_color,'mode','online',
   'rated',false,'ratingCategory',cfg->>'ratingCategory');
  for attempt in 1..20 loop
   candidate:='';
   for i in 1..6 loop
    candidate:=candidate||substr(alphabet,1+floor(random()*length(alphabet))::integer,1);
   end loop;
   begin
    insert into public.ability_chess_rooms(
      room_code,host_token,guest_token,host_color,status,
      game_state,settings,host_user_id,guest_user_id)
    values(
      candidate,gen_random_uuid(),gen_random_uuid(),next_host_color,'active',
      official,cfg,old_room.host_user_id,old_room.guest_user_id)
    returning * into new_room;
    exit;
   exception when unique_violation then null;
   end;
  end loop;
  if new_room.id is null then raise exception 'Cannot allocate rematch room'; end if;
  update public.ability_chess_verified_rematches set new_room_id=new_room.id
   where source_room_id=p_room_id returning * into offer_row;
 end if;
 if offer_row.source_room_id is null then
  return query select 'none'::text,null::text,null::uuid,null::bigint,
     null::uuid,null::text,null::jsonb,null::jsonb;
 elsif offer_row.new_room_id is null then
  return query select 'offered'::text,offer_row.offered_color,null::uuid,
     null::bigint,null::uuid,null::text,null::jsonb,null::jsonb;
 else
  select * into new_room from public.ability_chess_rooms
   where id=offer_row.new_room_id;
  return query select 'ready'::text,offer_row.offered_color,new_room.id,
     new_room.version,
     case when p_seat_token=old_room.host_token
       then new_room.host_token else new_room.guest_token end,
     case when p_seat_token=old_room.host_token
       then new_room.host_color
       else case when new_room.host_color='w' then 'b' else 'w' end end,
     new_room.game_state,new_room.settings;
 end if;
end;
$rematch$;
revoke all on function public.ability_chess_verified_rematch(uuid,uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.ability_chess_verified_rematch(uuid,uuid,uuid,text)
 to service_role;
commit;
