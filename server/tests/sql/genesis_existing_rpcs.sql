-- Test-fixture snapshots of existing room/challenge RPCs (not a deployment).
-- join_ability_chess_room
CREATE OR REPLACE FUNCTION public.join_ability_chess_room(p_room_code text)
 RETURNS TABLE(room_id uuid, seat_token uuid, assigned_color text, state jsonb, room_settings jsonb, room_version bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare target public.ability_chess_rooms%rowtype; token uuid:=gen_random_uuid();
begin
 select * into target from public.ability_chess_rooms r where r.room_code=upper(trim(p_room_code)) and r.expires_at>now() for update;
 if not found then raise exception 'Room not found or expired'; end if;
 if target.status<>'waiting' or target.guest_token is not null then raise exception 'Room is full'; end if;
 update public.ability_chess_rooms set guest_token=token,guest_user_id=auth.uid(),status='active',version=version+1 where id=target.id returning * into target;
 return query select target.id,token,case when target.host_color='w' then 'b' else 'w' end,target.game_state,target.settings,target.version;
end$function$
;

-- ability_chess_create_member_challenge
CREATE OR REPLACE FUNCTION public.ability_chess_create_member_challenge(p_game_state jsonb, p_settings jsonb, p_challenged_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(challenge_id uuid, challenge_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
  c public.ability_chess_challenges%rowtype;
  challenger public.ability_chess_profiles%rowtype;
  requested_color text := coalesce(p_settings->>'hostColor','w');
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_challenged_id is null then raise exception 'A recipient is required for a direct member challenge'; end if;
  if p_challenged_id=auth.uid() then raise exception 'You cannot challenge yourself'; end if;
  if requested_color not in ('w','b') then raise exception 'Invalid host color'; end if;
  if not exists(select 1 from public.ability_chess_profiles where id=p_challenged_id) then raise exception 'Member not found'; end if;
  select * into challenger from public.ability_chess_profiles where id=auth.uid();

  update public.ability_chess_challenges
    set status='expired',updated_at=now()
    where status='pending' and expires_at<=now();

  select * into r from public.create_ability_chess_room(
    coalesce(p_game_state,'{}'::jsonb),
    coalesce(p_settings,'{}'::jsonb),
    requested_color
  );

  insert into public.ability_chess_challenges(
    challenger_id,challenged_id,room_id,room_code,challenger_token,settings
  ) values(
    auth.uid(),p_challenged_id,r.room_id,r.room_code,r.seat_token,coalesce(p_settings,'{}'::jsonb)
  ) returning * into c;

  insert into public.ability_chess_challenge_notifications(challenge_id,recipient_id)
  values(c.id,p_challenged_id)
  on conflict do nothing;

  insert into public.ability_chess_notifications(user_id,type,title,body,href,data)
  values(
    p_challenged_id,
    'challenge',
    'Challenge from '||coalesce(challenger.display_name,challenger.username),
    coalesce(challenger.display_name,challenger.username)||' challenged you to a game.',
    '/profile/'||challenger.username,
    jsonb_build_object('challenge_id',c.id,'challenger_id',challenger.id,'challenger_username',challenger.username)
  );

  return query select c.id,'direct'::text;
end
$function$
;
