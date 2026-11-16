-- STAGED. Start accepted challenges using the canonical room board.
-- Apply only with the other Genesis and verified-game changes.
begin;
CREATE OR REPLACE FUNCTION public.ability_chess_accept_member_challenge(p_challenge_id uuid)
 RETURNS TABLE(challenge_id uuid, room_id uuid, room_code text, seat_token uuid, assigned_color text, state jsonb, room_settings jsonb, room_version bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c public.ability_chess_challenges%rowtype; j record;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into c from public.ability_chess_challenges where id=p_challenge_id for update;
  if not found or c.status<>'pending' or c.expires_at<=now() then raise exception 'Challenge is no longer available'; end if;
  if c.challenger_id=auth.uid() then raise exception 'You cannot accept your own challenge'; end if;
  if c.challenged_id is not null and c.challenged_id<>auth.uid() then raise exception 'This challenge is for another member'; end if;
  select * into j from public.join_ability_chess_room(c.room_code);
  -- The official state comes from canonical room genesis, not the caller.
  -- Activating the accepted challenge also starts its clock and legal turns.
  update public.ability_chess_rooms r set
    game_state=r.game_state||jsonb_build_object(
      'onlineStarted',true,'hostColor',r.host_color,'mode','online',
      'rated',coalesce((r.settings->>'rated')::boolean,false),
      'ratingCategory',coalesce(r.settings->>'ratingCategory','rapid')
    ),updated_at=now()
  where r.id=j.room_id and r.status='active';
  select game_state into j.state from public.ability_chess_rooms where id=j.room_id;
  update public.ability_chess_challenges set status='accepted',accepted_by=auth.uid(),acceptor_token=j.seat_token,updated_at=now() where id=c.id;
  if c.challenged_id is null then
    update public.ability_chess_challenges set status='cancelled',updated_at=now() where status='pending' and challenged_id is null and challenger_id=auth.uid() and id<>c.id;
  end if;
  return query select c.id,j.room_id,c.room_code,j.seat_token,j.assigned_color,j.state,j.room_settings,j.room_version;
end;
$function$
;
commit;
