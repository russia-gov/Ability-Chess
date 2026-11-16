-- Staged: existing room/challenge/seek/tournament RPC signatures preserved.
-- REQUIRES database/canonical_initial_game_state_staged.sql first.
-- The p_game_state argument remains for compatibility but is deliberately IGNORED.
-- For tournament rooms, settings are exclusively drawn from the official tournament record.
-- Test separately against a disposable database before cutover.

begin;
-- Canonicalize existing public RPC: ability_chess_create_or_match_seek
CREATE OR REPLACE FUNCTION public.ability_chess_create_or_match_seek(p_queue_key text, p_game_state jsonb, p_settings jsonb)
 RETURNS TABLE(seek_id uuid, seek_token uuid, matched boolean, room_id uuid, seat_token uuid, assigned_color text, state jsonb, room_settings jsonb, room_version bigint, opponent_rating integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare target_seek public.ability_chess_live_seeks%rowtype; target_room public.ability_chess_rooms%rowtype; new_guest_token uuid:=gen_random_uuid(); alphabet constant text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; candidate text; host_token_value uuid; i integer; my_rating integer:=1200; is_rated boolean:=coalesce((p_settings->>'rated')::boolean,false); cat text:=case when coalesce((p_settings->>'base')::integer,10)*60 + 40*coalesce((p_settings->>'increment')::integer,0) < 180 then 'bullet' when coalesce((p_settings->>'base')::integer,10)*60 + 40*coalesce((p_settings->>'increment')::integer,0) < 600 then 'blitz' else 'rapid' end; updated_settings jsonb;
begin
 if cat not in('bullet','blitz','rapid') then cat:='rapid'; end if;
 if auth.uid() is not null then if cat='bullet' then select coalesce(p.bullet_rating,1200) into my_rating from public.ability_chess_profiles p where p.id=auth.uid(); elsif cat='blitz' then select coalesce(p.blitz_rating,1200) into my_rating from public.ability_chess_profiles p where p.id=auth.uid(); else select coalesce(p.rapid_rating,1200) into my_rating from public.ability_chess_profiles p where p.id=auth.uid(); end if; end if;
 if is_rated and auth.uid() is null then raise exception 'Sign in required for rated games'; end if;
 update public.ability_chess_live_seeks set status='expired' where status='waiting' and expires_at<=now();
 select * into target_seek from public.ability_chess_live_seeks s where s.queue_key=p_queue_key and s.status='waiting' and s.expires_at>now() and s.rated=is_rated and (auth.uid() is null or s.seeker_id is distinct from auth.uid()) order by abs(s.seeker_rating-my_rating),s.created_at limit 1 for update skip locked;
 if found then select * into target_room from public.ability_chess_rooms r where r.id=target_seek.room_id for update;
  if found and target_room.status='waiting' and target_room.guest_token is null and target_room.expires_at>now() then cat:=coalesce(target_room.settings->>'ratingCategory',cat); updated_settings:=coalesce(target_room.settings,'{}'::jsonb)||jsonb_build_object('hostRating',target_seek.seeker_rating,'guestRating',my_rating,'rated',is_rated,'ratingCategory',cat);
   update public.ability_chess_rooms set guest_token=new_guest_token,guest_user_id=auth.uid(),status='active',settings=updated_settings,game_state=target_room.game_state||jsonb_build_object('onlineStarted',true,'hostColor',target_room.host_color,'mode','online','rated',is_rated,'ratingCategory',cat),version=version+1 where id=target_room.id returning * into target_room;
   update public.ability_chess_live_seeks set status='matched',matched_user_id=auth.uid() where id=target_seek.id;
   return query select target_seek.id,target_seek.seeker_token,true,target_room.id,new_guest_token,case when target_room.host_color='w' then 'b' else 'w' end,target_room.game_state,target_room.settings,target_room.version,target_seek.seeker_rating; return;
  else update public.ability_chess_live_seeks set status='expired' where id=target_seek.id; end if;
 end if;
 for attempt in 1..20 loop candidate:=''; for i in 1..6 loop candidate:=candidate||substr(alphabet,1+floor(random()*length(alphabet))::int,1); end loop;
  begin insert into public.ability_chess_rooms(room_code,host_color,game_state,settings,host_user_id) values(candidate,'w',public.ability_chess_initial_state(p_settings),coalesce(p_settings,'{}'::jsonb)||jsonb_build_object('hostRating',my_rating,'rated',is_rated,'ratingCategory',cat),auth.uid()) returning * into target_room; exit; exception when unique_violation then null; end;
 end loop;
 if target_room.id is null then raise exception 'Could not create matchmaking room'; end if;
 host_token_value:=target_room.host_token;
 insert into public.ability_chess_live_seeks(queue_key,room_id,host_seat_token,seeker_id,seeker_rating,rated) values(p_queue_key,target_room.id,host_token_value,auth.uid(),my_rating,is_rated) returning * into target_seek;
 return query select target_seek.id,target_seek.seeker_token,false,target_room.id,host_token_value,'w',target_room.game_state,target_room.settings,target_room.version,null::integer;
end$function$
;

-- Canonicalize existing public RPC: ability_chess_tournament_claim_game
CREATE OR REPLACE FUNCTION public.ability_chess_tournament_claim_game(p_tournament_id uuid, p_game_state jsonb, p_settings jsonb)
 RETURNS TABLE(matched boolean, room_id uuid, seat_token uuid, assigned_color text, state jsonb, room_settings jsonb, room_version bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 me public.ability_chess_tournament_entries%rowtype;
 opp public.ability_chess_tournament_entries%rowtype;
 t public.ability_chess_tournaments%rowtype;
 r public.ability_chess_rooms%rowtype;
 candidate text;
 alphabet constant text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
 hosttok uuid:=gen_random_uuid(); guesttok uuid:=gen_random_uuid(); i integer;
 mycolor text; oppcolor text; white_user uuid; black_user uuid;
 active_games integer; round_ready boolean; target_round integer; my_score numeric;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into t from public.ability_chess_tournaments where id=p_tournament_id for update;
 if not found then raise exception 'Tournament not found'; end if;
 if t.starts_at is not null and now()<t.starts_at then raise exception 'Tournament has not started'; end if;
 if t.ends_at is not null and now()>=t.ends_at then update public.ability_chess_tournaments set status='finished' where id=t.id; raise exception 'Tournament has ended'; end if;
 update public.ability_chess_tournaments set status='active' where id=t.id and status='open';
 select * into me from public.ability_chess_tournament_entries where tournament_id=t.id and user_id=auth.uid() for update;
 if not found then raise exception 'Join the tournament first'; end if;
 my_score:=me.score;
 if me.current_room_id is not null then
   select * into r from public.ability_chess_rooms where id=me.current_room_id;
   if found and r.status in('waiting','active') then raise exception 'You already have an active tournament game'; end if;
   update public.ability_chess_tournament_entries set current_room_id=null,seat_token=null,assigned_color=null,pairing_status='idle' where tournament_id=t.id and user_id=auth.uid();
   select * into me from public.ability_chess_tournament_entries where tournament_id=t.id and user_id=auth.uid() for update;
 end if;
 if t.format='swiss' then
   if me.games_started>=coalesce(t.rounds,1) then raise exception 'You have completed all Swiss rounds'; end if;
   target_round:=me.games_started+1;
   select count(*) into active_games from public.ability_chess_tournament_games g where g.tournament_id=t.id and g.status='active' and coalesce(g.round_number,target_round)=target_round-1;
   select not exists(select 1 from public.ability_chess_tournament_entries e where e.tournament_id=t.id and e.games_started<target_round-1) into round_ready;
   if active_games>0 or not round_ready then raise exception 'The current Swiss round must finish before the next round begins'; end if;
 else target_round:=null; end if;

 select * into opp from public.ability_chess_tournament_entries e
 where e.tournament_id=t.id and e.user_id<>auth.uid() and e.pairing_status='waiting' and e.current_room_id is null
 and (t.format='arena' or e.games_started=me.games_started)
 and not exists(
   select 1 from public.ability_chess_tournament_games g
   where g.tournament_id=t.id and ((g.white_id=auth.uid() and g.black_id=e.user_id) or (g.white_id=e.user_id and g.black_id=auth.uid()))
   and (t.format='swiss' or g.started_at>now()-interval '10 minutes')
 )
 order by case when t.format='swiss' then abs(e.score-my_score) else 0 end asc,e.last_pairing_at nulls first,e.joined_at
 limit 1 for update skip locked;

 if not found then
   select * into opp from public.ability_chess_tournament_entries e
   where e.tournament_id=t.id and e.user_id<>auth.uid() and e.pairing_status='waiting' and e.current_room_id is null
   and (t.format='arena' or e.games_started=me.games_started)
   order by case when t.format='swiss' then abs(e.score-my_score) else 0 end asc,e.last_pairing_at nulls first,e.joined_at
   limit 1 for update skip locked;
 end if;

 if not found then
   update public.ability_chess_tournament_entries set pairing_status='waiting',last_pairing_at=now() where tournament_id=t.id and user_id=auth.uid();
   return query select false,null::uuid,null::uuid,null::text,null::jsonb,null::jsonb,null::bigint; return;
 end if;
 for attempt in 1..20 loop
   candidate:=''; for i in 1..6 loop candidate:=candidate||substr(alphabet,1+floor(random()*length(alphabet))::int,1); end loop;
   begin
     insert into public.ability_chess_rooms(room_code,host_token,guest_token,host_color,status,game_state,settings,host_user_id,guest_user_id)
     values(candidate,hosttok,guesttok,'w','active',public.ability_chess_initial_state(jsonb_build_object('base',t.base_minutes,'increment',t.increment_seconds,'startingPoints',t.starting_points,'upgradeLimit',t.max_upgrades,'abilitiesEnabled',t.abilities_enabled,'upgradesEnabled',t.upgrades_enabled,'rated',t.rated)),jsonb_build_object('base',t.base_minutes,'increment',t.increment_seconds,'startingPoints',t.starting_points,'upgradeLimit',t.max_upgrades,'abilitiesEnabled',t.abilities_enabled,'upgradesEnabled',t.upgrades_enabled,'rated',t.rated,'tournamentId',t.id,'tournamentName',t.name,'tournamentFormat',t.format,'tournamentRound',target_round,'ratingCategory',case when t.base_minutes*60+40*t.increment_seconds<180 then 'bullet' when t.base_minutes*60+40*t.increment_seconds<600 then 'blitz' else 'rapid' end),auth.uid(),opp.user_id)
     returning * into r; exit;
   exception when unique_violation then null; end;
 end loop;
 if r.id is null then raise exception 'Could not create tournament game'; end if;
 if random()<0.5 then mycolor:='w';oppcolor:='b'; else mycolor:='b';oppcolor:='w'; end if;
 white_user:=case when mycolor='w' then auth.uid() else opp.user_id end; black_user:=case when mycolor='b' then auth.uid() else opp.user_id end;
 update public.ability_chess_rooms set host_color=mycolor,host_user_id=auth.uid(),guest_user_id=opp.user_id,game_state=r.game_state||jsonb_build_object('onlineStarted',true,'hostColor',mycolor,'mode','online','rated',t.rated,'ratingCategory',case when t.base_minutes*60+40*t.increment_seconds<180 then 'bullet' when t.base_minutes*60+40*t.increment_seconds<600 then 'blitz' else 'rapid' end) where id=r.id;
 update public.ability_chess_tournament_entries set pairing_status='paired',current_room_id=r.id,seat_token=hosttok,assigned_color=mycolor,games_started=games_started+1,last_pairing_at=now() where tournament_id=t.id and user_id=auth.uid();
 update public.ability_chess_tournament_entries set pairing_status='paired',current_room_id=r.id,seat_token=guesttok,assigned_color=oppcolor,games_started=games_started+1,last_pairing_at=now() where tournament_id=t.id and user_id=opp.user_id;
 insert into public.ability_chess_tournament_games(tournament_id,room_id,white_id,black_id,round_number,white_score_before,black_score_before)
 values(t.id,r.id,white_user,black_user,target_round,case when white_user=auth.uid() then me.score else opp.score end,case when black_user=auth.uid() then me.score else opp.score end);
 insert into public.ability_chess_notifications(user_id,type,title,body,href,data)
 values(opp.user_id,'tournament_pairing','Tournament game ready',t.name||' paired you with '||(select username from public.ability_chess_profiles where id=auth.uid()),'/game',jsonb_build_object('roomId',r.id,'tournamentId',t.id))
 on conflict do nothing;
 return query select true,r.id,case when mycolor='w' then hosttok else guesttok end,mycolor,r.game_state,r.settings,r.version;
end$function$
;

-- Canonicalize existing public RPC: create_ability_chess_room
CREATE OR REPLACE FUNCTION public.create_ability_chess_room(p_game_state jsonb, p_settings jsonb, p_host_color text DEFAULT 'w'::text)
 RETURNS TABLE(room_id uuid, room_code text, seat_token uuid, assigned_color text, state jsonb, room_settings jsonb, room_version bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare alphabet constant text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; candidate text; new_room public.ability_chess_rooms%rowtype; i integer;
begin
 if p_host_color not in('w','b') then raise exception 'Invalid host color'; end if;
 for attempt in 1..20 loop candidate:=''; for i in 1..6 loop candidate:=candidate||substr(alphabet,1+floor(random()*length(alphabet))::int,1); end loop;
  begin insert into public.ability_chess_rooms(room_code,host_color,game_state,settings,host_user_id) values(candidate,p_host_color,public.ability_chess_initial_state(p_settings),coalesce(p_settings,'{}'::jsonb)||jsonb_build_object('ratingCategory',case when coalesce((p_settings->>'base')::integer,10)*60 + 40*coalesce((p_settings->>'increment')::integer,0) < 180 then 'bullet' when coalesce((p_settings->>'base')::integer,10)*60 + 40*coalesce((p_settings->>'increment')::integer,0) < 600 then 'blitz' else 'rapid' end),auth.uid()) returning * into new_room;
   return query select new_room.id,new_room.room_code,new_room.host_token,new_room.host_color,new_room.game_state,new_room.settings,new_room.version; return;
  exception when unique_violation then null; end;
 end loop;
 raise exception 'Could not generate room code';
end$function$
;

commit;
