-- Staged canonical starting state. No browser-provided board, resources or
-- game result may become the official initial state.
-- This can be installed before browser integration, but do not apply the
-- accompanying legacy RPC replacements until tested against live setup flows.
create or replace function public.ability_chess_initial_state(p_settings jsonb)
returns jsonb language plpgsql stable set search_path = ''
as $$
declare
  cfg jsonb := coalesce(p_settings, '{}'::jsonb);
  starting_points integer;
  upgrade_limit integer;
  base_minutes integer;
  increment_seconds integer;
begin
  -- Values come from official room settings, not the claimed game state.
  -- Reject noninteger JSON and extreme values rather than silently clamping
  -- malformed client input. UI-supported limits can be tightened at cutover.
  if jsonb_typeof(cfg) <> 'object' then raise exception 'Invalid game settings'; end if;
  if (cfg ? 'startingPoints') and jsonb_typeof(cfg->'startingPoints')<>'number' then
    raise exception 'Invalid starting points';
  end if;
  if (cfg ? 'upgradeLimit') and jsonb_typeof(cfg->'upgradeLimit')<>'number' then
    raise exception 'Invalid upgrade limit';
  end if;
  starting_points := coalesce((cfg->>'startingPoints')::integer,0);
  upgrade_limit := coalesce((cfg->>'upgradeLimit')::integer,3);
  base_minutes := coalesce((cfg->>'base')::integer,(cfg->>'baseMinutes')::integer,10);
  increment_seconds := coalesce((cfg->>'increment')::integer,(cfg->>'incrementSeconds')::integer,0);
  if starting_points not between 0 and 100 or upgrade_limit not between 0 and 10
    or base_minutes not between 1 and 180 or increment_seconds not between 0 and 120 then
    raise exception 'Game settings outside supported range';
  end if;
  return jsonb_build_object(
    'board',jsonb_build_array(
      jsonb_build_array('br','bn','bb','bq','bk','bb','bn','br'),
      jsonb_build_array('bp','bp','bp','bp','bp','bp','bp','bp'),
      jsonb_build_array(null,null,null,null,null,null,null,null),
      jsonb_build_array(null,null,null,null,null,null,null,null),
      jsonb_build_array(null,null,null,null,null,null,null,null),
      jsonb_build_array(null,null,null,null,null,null,null,null),
      jsonb_build_array('wp','wp','wp','wp','wp','wp','wp','wp'),
      jsonb_build_array('wr','wn','wb','wq','wk','wb','wn','wr')
    ),
    'turn','w','over',false,'winner',null,'resultReason','',
    'points',jsonb_build_object('w',starting_points,'b',starting_points),
    'upgrades',jsonb_build_object('w','{}'::jsonb,'b','{}'::jsonb),
    'upgradeLimit',upgrade_limit,
    'abilitiesEnabled',coalesce((cfg->>'abilitiesEnabled')::boolean,true),
    'upgradesEnabled',coalesce((cfg->>'upgradesEnabled')::boolean,true),
    'startingPoints',starting_points,
    'castlingRights',jsonb_build_object(
      'w',jsonb_build_object('k',true,'q',true),
      'b',jsonb_build_object('k',true,'q',true)),
    'shielded',jsonb_build_object('w',null,'b',null),
    'frozen',jsonb_build_object('w',null,'b',null),
    'ambushed',jsonb_build_object('w',null,'b',null),
    'fortified',jsonb_build_object('w',null,'b',null),
    'portals',jsonb_build_object('w',null,'b',null),
    'lastMoveByColor',jsonb_build_object('w',null,'b',null),
    'lastMove',null,'enPassant',null,
    'abilityUsed',false,'movesRemaining',1,'doubleMoveActive',false,
    'halfmoveClock',0,'positionCounts','{}'::jsonb,
    'lastRecordedPositionKey',null,
    'activeAbility',null,'awaitingAbilityTarget',false,'abilitySelection',null,
    'log','[]'::jsonb,
    'clocks',jsonb_build_object('w',base_minutes*60,'b',base_minutes*60),
    'initialTime',base_minutes*60,'increment',increment_seconds,
    'onlineStarted',false
  );
end;
$$;
revoke all on function public.ability_chess_initial_state(jsonb)
  from public,anon,authenticated;
grant execute on function public.ability_chess_initial_state(jsonb)
  to service_role;
