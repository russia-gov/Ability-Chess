-- STAGED: privileged room activation for code-based casual and rated games.
-- This is called by trusted Edge code only after verifying the browser's JWT.
-- Sets room settings and resets the official board IN ONE TRANSACTION.
begin;
create or replace function public.ability_chess_start_verified_room(
  p_room_id uuid,p_host_token uuid,p_actor_user_id uuid,
  p_expected_version bigint,p_settings jsonb,p_host_color text
) returns table(new_version bigint,updated_state jsonb,room_settings jsonb)
language plpgsql security definer set search_path=''
as $$
declare
  r public.ability_chess_rooms%rowtype;
  cfg jsonb;
  official jsonb;
  rated boolean;
  base_minutes integer;
  increment_seconds integer;
  category text;
begin
 if p_host_color not in('w','b') then raise exception 'Invalid host color'; end if;
 select * into r from public.ability_chess_rooms where id=p_room_id for update;
 if not found or r.expires_at<=now() then raise exception 'Room not found or expired'; end if;
 if r.host_token is distinct from p_host_token or p_host_token is null
    then raise exception 'Only the host may start the room'; end if;
 if r.host_user_id is distinct from p_actor_user_id
    then raise exception 'Host account mismatch'; end if;
 if r.guest_token is null or r.status<>'active'
    then raise exception 'Waiting for opponent to join'; end if;
 if r.version<>p_expected_version then raise exception 'Version conflict'; end if;
 if coalesce((r.game_state->>'onlineStarted')::boolean,false)
    then raise exception 'Room already started'; end if;
 cfg:=coalesce(p_settings,'{}'::jsonb);
 if jsonb_typeof(cfg)<>'object' then raise exception 'Invalid settings';end if;
 rated:=coalesce((cfg->>'rated')::boolean,false);
 -- A casual room host cannot unilaterally turn an accepted game into a
 -- rated match. Rated games must originate from a dedicated consensual
 -- matchmaking or member challenge flow.
 if rated then raise exception 'Rated matches must use rated matchmaking'; end if;
 if rated and (r.host_user_id is null or r.guest_user_id is null) then
    raise exception 'Rated games require two signed-in players';
 end if;
 if cfg ? 'tournamentId' then raise exception 'Tournament settings require tournament pairing'; end if;
 official:=public.ability_chess_initial_state(cfg);
 base_minutes:=coalesce((cfg->>'base')::integer,10);
 increment_seconds:=coalesce((cfg->>'increment')::integer,0);
 category:=case when base_minutes*60+40*increment_seconds<180 then 'bullet'
                when base_minutes*60+40*increment_seconds<600 then 'blitz'
                else 'rapid' end;
 cfg:=cfg || jsonb_build_object('hostColor',p_host_color,'rated',rated,
   'ratingCategory',category,'base',base_minutes,'increment',increment_seconds);
 official:=official||jsonb_build_object(
   'onlineStarted',true,'hostColor',p_host_color,'mode','online',
   'rated',rated,'ratingCategory',category
 );
 update public.ability_chess_rooms set
   host_color=p_host_color,settings=cfg,game_state=official,
   version=version+1,updated_at=now()
 where id=r.id returning * into r;
 insert into public.ability_chess_room_actions(
   room_id,room_version,actor_id,actor_color,action_type,action_label,
   action_payload,state_snapshot
 ) values(r.id,r.version,r.host_user_id,p_host_color,'setup','Room started',
   '{}'::jsonb,r.game_state);
 return query select r.version,r.game_state,r.settings;
end $$;
revoke all on function public.ability_chess_start_verified_room(
 uuid,uuid,uuid,bigint,jsonb,text) from public,anon,authenticated;
grant execute on function public.ability_chess_start_verified_room(
 uuid,uuid,uuid,bigint,jsonb,text) to service_role;
commit;
