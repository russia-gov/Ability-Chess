-- STAGED ONLY. Hardens alternate room reads which previously exposed hidden Ambush.
-- Apply after hidden_state_read_hardening_staged.sql, at coordinated cutover.
-- Original function signatures preserved from inspected production definitions.
begin;

-- Hardened: ability_chess_my_active_tournament_game
CREATE OR REPLACE FUNCTION public.ability_chess_my_active_tournament_game()
 RETURNS TABLE(tournament_id uuid, tournament_name text, room_id uuid, seat_token uuid, assigned_color text, state jsonb, room_settings jsonb, room_version bigint, room_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
  select
    t.id,
    t.name,
    r.id,
    e.seat_token,
    e.assigned_color,
    public.ability_chess_viewer_state(r.game_state,e.assigned_color),
    r.settings,
    r.version,
    r.status
  from public.ability_chess_tournament_entries e
  join public.ability_chess_tournaments t on t.id=e.tournament_id
  join public.ability_chess_rooms r on r.id=e.current_room_id
  where e.user_id=auth.uid()
    and e.current_room_id is not null
    and e.seat_token is not null
    and e.assigned_color in ('w','b')
    and r.status in ('waiting','active')
  order by e.last_pairing_at desc nulls last
  limit 1;
end
$function$;

-- Hardened: ability_chess_poll_seek
CREATE OR REPLACE FUNCTION public.ability_chess_poll_seek(p_seek_id uuid, p_seek_token uuid)
 RETURNS TABLE(status text, matched boolean, room_id uuid, seat_token uuid, assigned_color text, state jsonb, room_settings jsonb, room_version bigint, opponent_rating integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.ability_chess_live_seeks%rowtype; r public.ability_chess_rooms%rowtype; opp integer;
begin
 select * into s from public.ability_chess_live_seeks where id=p_seek_id and seeker_token=p_seek_token;
 if not found then raise exception 'Seek not found'; end if; if s.seeker_id is not null and auth.uid() is distinct from s.seeker_id then raise exception 'Seek account mismatch'; end if;
 if s.status='waiting' and s.expires_at<=now() then update public.ability_chess_live_seeks set status='expired' where id=s.id returning * into s; end if;
 select * into r from public.ability_chess_rooms where id=s.room_id;
 if s.status='matched' then opp:=nullif(r.settings->>'guestRating','')::integer; end if;
 return query select s.status,(s.status='matched'),r.id,s.host_seat_token,r.host_color,public.ability_chess_viewer_state(r.game_state,r.host_color),r.settings,r.version,opp;
end;$function$;

-- Hardened: ability_chess_resume_my_active_room
CREATE OR REPLACE FUNCTION public.ability_chess_resume_my_active_room()
 RETURNS TABLE(room_id uuid, seat_token uuid, assigned_color text, seat_role text, state jsonb, room_settings jsonb, room_status text, room_version bigint, state_updated_at timestamp with time zone, server_now timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.ability_chess_rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into r
  from public.ability_chess_rooms
  where expires_at>now()
    and status in ('waiting','active')
    and (host_user_id=auth.uid() or guest_user_id=auth.uid())
  order by updated_at desc
  limit 1;
  if not found then return; end if;
  if r.host_user_id=auth.uid() then
    return query select r.id,r.host_token,r.host_color,'host'::text,public.ability_chess_viewer_state(r.game_state,r.host_color),r.settings,r.status,r.version,r.updated_at,now();
  else
    return query select r.id,r.guest_token,case when r.host_color='w' then 'b' else 'w' end,'guest'::text,public.ability_chess_viewer_state(r.game_state,(case when r.host_color='w' then 'b' else 'w' end)),r.settings,r.status,r.version,r.updated_at,now();
  end if;
end;
$function$;

-- Hardened: ability_chess_tournament_game_context
CREATE OR REPLACE FUNCTION public.ability_chess_tournament_game_context(p_room_id uuid)
 RETURNS TABLE(game_id uuid, tournament_id uuid, room_id uuid, room_status text, room_settings jsonb, state jsonb, white_id uuid, white_username text, white_display_name text, white_avatar_url text, white_rating integer, black_id uuid, black_username text, black_display_name text, black_avatar_url text, black_rating integer, can_chat boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare rm public.ability_chess_rooms%rowtype; tg public.ability_chess_tournament_games%rowtype; white_user uuid; black_user uuid; tid uuid; gid uuid; cat text; participant boolean; allowed boolean;
begin
 select * into rm from public.ability_chess_rooms r where r.id=p_room_id;
 if not found then raise exception 'Game not found'; end if;
 select * into tg from public.ability_chess_tournament_games g where g.room_id=p_room_id;
 if found then gid:=tg.id;tid:=tg.tournament_id;white_user:=tg.white_id;black_user:=tg.black_id;
 else gid:=null;tid:=null;white_user:=case when rm.host_color='w' then rm.host_user_id else rm.guest_user_id end;black_user:=case when rm.host_color='b' then rm.host_user_id else rm.guest_user_id end; end if;
 participant:=auth.uid() is not null and auth.uid() in(white_user,black_user);
 allowed:=participant or (tid is not null and exists(select 1 from public.ability_chess_tournament_entries e where e.tournament_id=tid and e.user_id=auth.uid()));
 if not allowed then raise exception 'You do not have access to this game'; end if;
 cat:=lower(coalesce(rm.settings->>'ratingCategory','rapid'));
 return query select gid,tid,rm.id,rm.status,rm.settings,(case when participant then public.ability_chess_viewer_state(rm.game_state,(case when auth.uid()=white_user then 'w' else 'b' end)) else public.ability_chess_viewer_state(public.ability_chess_viewer_state(rm.game_state,'w'),'b') end),wp.id,wp.username,wp.display_name,wp.avatar_url,case cat when 'bullet' then wp.bullet_rating when 'blitz' then wp.blitz_rating else wp.rapid_rating end,bp.id,bp.username,bp.display_name,bp.avatar_url,case cat when 'bullet' then bp.bullet_rating when 'blitz' then bp.blitz_rating else bp.rapid_rating end,participant
 from public.ability_chess_profiles wp,public.ability_chess_profiles bp where wp.id=white_user and bp.id=black_user;
end$function$;

-- Hardened: ability_chess_tournament_spectate
CREATE OR REPLACE FUNCTION public.ability_chess_tournament_spectate(p_game_id uuid)
 RETURNS TABLE(state jsonb, room_settings jsonb, room_status text, room_version bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  tournament_game public.ability_chess_tournament_games%rowtype;
  game_room public.ability_chess_rooms%rowtype;
begin
  select tg.*
  into tournament_game
  from public.ability_chess_tournament_games as tg
  where tg.id = p_game_id;

  if not found then
    raise exception 'Game not found';
  end if;

  if not exists (
    select 1
    from public.ability_chess_tournament_entries as te
    where te.tournament_id = tournament_game.tournament_id
      and te.user_id = auth.uid()
  ) then
    raise exception 'Join the tournament to watch games';
  end if;

  select room.*
  into game_room
  from public.ability_chess_rooms as room
  where room.id = tournament_game.room_id;

  if not found then
    raise exception 'Room not found';
  end if;

  return query
  select public.ability_chess_viewer_state(public.ability_chess_viewer_state(game_room.game_state,'w'),'b'), game_room.settings, game_room.status, game_room.version;
end
$function$;

-- Hardened: get_ability_chess_room
CREATE OR REPLACE FUNCTION public.get_ability_chess_room(p_room_id uuid, p_seat_token uuid)
 RETURNS TABLE(state jsonb, room_settings jsonb, room_status text, room_version bigint, opponent_joined boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare target public.ability_chess_rooms%rowtype;
begin
  select * into target from public.ability_chess_rooms where id=p_room_id and expires_at>now();
  if not found then raise exception 'Room not found or expired'; end if;
  if p_seat_token is null or (p_seat_token is distinct from target.host_token and (target.guest_token is null or p_seat_token is distinct from target.guest_token)) then raise exception 'Invalid seat token'; end if;
 if (coalesce((target.settings->>'rated')::boolean,false) or target.settings ? 'tournamentId')
  and auth.uid() is distinct from (case when p_seat_token=target.host_token then target.host_user_id else target.guest_user_id end)
 then raise exception 'Account does not own competitive seat'; end if;
  return query select public.ability_chess_viewer_state(target.game_state,(case when p_seat_token=target.host_token then target.host_color else (case when target.host_color='w' then 'b' else 'w' end) end)),target.settings,target.status,target.version,(target.guest_token is not null);
end;
$function$;

-- Hardened: reconnect_ability_chess_room
CREATE OR REPLACE FUNCTION public.reconnect_ability_chess_room(p_room_code text, p_seat_token uuid)
 RETURNS TABLE(room_id uuid, assigned_color text, state jsonb, room_settings jsonb, room_status text, room_version bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare target public.ability_chess_rooms%rowtype;
begin
  select * into target from public.ability_chess_rooms
  where room_code=upper(trim(p_room_code)) and expires_at>now();
  if not found then raise exception 'Room not found or expired'; end if;
  if p_seat_token=target.host_token then
    if (coalesce((target.settings->>'rated')::boolean,false) or target.settings ? 'tournamentId') and auth.uid() is distinct from target.host_user_id then raise exception 'Account does not own competitive seat'; end if;
    return query select target.id,target.host_color,public.ability_chess_viewer_state(target.game_state,target.host_color),target.settings,target.status,target.version;
  elsif p_seat_token=target.guest_token then
    if (coalesce((target.settings->>'rated')::boolean,false) or target.settings ? 'tournamentId') and auth.uid() is distinct from target.guest_user_id then raise exception 'Account does not own competitive seat'; end if;
    return query select target.id,(case when target.host_color='w' then 'b' else 'w' end),public.ability_chess_viewer_state(target.game_state,(case when target.host_color='w' then 'b' else 'w' end)),target.settings,target.status,target.version;
  else
    raise exception 'Invalid seat token';
  end if;
end;
$function$;

commit;
