-- Chat reporting references the exact stored chat message, verified server-side.
create or replace function public.ability_chess_report_chat_message(
  p_kind text,
  p_message_id bigint,
  p_reason text,
  p_details text default ''
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  reporter uuid := auth.uid();
  target uuid;
  room uuid;
  tournament uuid;
  message_text text;
  result uuid;
  reason_text text := trim(coalesce(p_reason,''));
begin
  if reporter is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if length(reason_text)<3 or length(reason_text)>80 then raise exception 'Provide a reason (3 to 80 characters)'; end if;
  if p_kind='game' then
    select m.user_id,m.room_id,m.message into target,room,message_text
    from public.ability_chess_game_chat m where m.id=p_message_id;
    if target is null or not exists (
      select 1 from public.ability_chess_rooms r
      where r.id=room and reporter in(r.host_user_id,r.guest_user_id)
    ) then raise exception 'Message not found in your game' using errcode='42501'; end if;
  elsif p_kind='tournament' then
    select m.user_id,m.tournament_id,m.message into target,tournament,message_text
    from public.ability_chess_tournament_chat m where m.id=p_message_id;
    if target is null or not exists (
      select 1 from public.ability_chess_tournament_entries e
      where e.tournament_id=tournament and e.user_id=reporter
    ) then raise exception 'Message not found in your tournament' using errcode='42501'; end if;
  else
    raise exception 'Unsupported chat type';
  end if;
  if target=reporter then raise exception 'Cannot report your own message'; end if;
  insert into public.ability_chess_moderation_reports
    (reporter_id,target_user_id,room_id,tournament_id,category,details)
  values (
    reporter,target,room,tournament,
    case when p_kind='game' then 'game_chat' else 'tournament_chat' end,
    left('Message # '||p_message_id::text||' ('||p_kind||'):'||E'\n'||coalesce(message_text,'')||E'\nReason: '||reason_text||E'\nDetails: '||left(coalesce(p_details,''),700),1500)
  ) returning id into result;
  return result;
end $$;
revoke all on function public.ability_chess_report_chat_message(text,bigint,text,text) from public,anon;
grant execute on function public.ability_chess_report_chat_message(text,bigint,text,text) to authenticated;