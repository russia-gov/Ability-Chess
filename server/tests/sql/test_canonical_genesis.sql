\set ON_ERROR_STOP on
do $$
declare
  initial jsonb;
  white_points integer;
  black_points integer;
  y integer;
  x integer;
begin
 initial:=public.ability_chess_initial_state(
  '{"base":5,"increment":3,"startingPoints":7,"upgradeLimit":2,"abilitiesEnabled":true,"upgradesEnabled":true}'::jsonb);
 if initial->>'turn'<>'w' or initial->>'over'<>'false'
    or initial->>'winner' is not null then
   raise exception 'Initial game status was not server-owned';
 end if;
 if jsonb_array_length(initial->'board')<>8 then
   raise exception 'Initial board missing ranks';
 end if;
 for y in 0..7 loop
  if jsonb_array_length(initial->'board'->y)<>8 then
   raise exception 'Initial rank malformed: %',y;
  end if;
 end loop;
 if initial#>>'{board,7,4}'<>'wk' or initial#>>'{board,0,4}'<>'bk'
    or initial#>>'{board,7,3}'<>'wq'
    or initial#>>'{board,0,3}'<>'bq' then
   raise exception 'Incorrect kings or queens';
 end if;
 if initial#>>'{board,6,0}'<>'wp' or initial#>>'{board,1,7}'<>'bp'
    or initial#>>'{board,3,3}' is not null then
   raise exception 'Incorrect pawn rows or empty ranks';
 end if;
 if initial#>>'{points,w}'<>'7' or initial#>>'{points,b}'<>'7'
    or initial#>>'{clocks,w}'<>'300'
    or initial#>>'{increment}'<>'3' then
   raise exception 'Initial points or clocks are not derived from settings';
 end if;
 if not (initial#>>'{castlingRights,b,q}')::boolean
   or initial#>>'{abilityUsed}'<>'false'
   or initial#>>'{movesRemaining}'<>'1' then
   raise exception 'Initial legal-move flags incorrect';
 end if;
 begin
  perform public.ability_chess_initial_state(
   '{"base":5,"startingPoints":-100}'::jsonb);
  raise exception 'Accepted negative starting points';
 exception when raise_exception then
  if sqlerrm='Accepted negative starting points' then raise; end if;
  if sqlerrm<>'Game settings outside supported range' then raise; end if;
 end;
end $$;

do $$
begin
 if has_function_privilege('anon','public.ability_chess_initial_state(jsonb)','EXECUTE')
  or has_function_privilege('authenticated','public.ability_chess_initial_state(jsonb)','EXECUTE') then
  raise exception 'Untrusted role can create game position';
 end if;
end $$;
select 'Canonical server-owned starting state checks passed' as result;
