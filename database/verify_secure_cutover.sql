-- Read-only post-cutover audit. Run on the AbilityChess database *after*
-- production application + revocation migration have been deployed together.
-- Fails if any anonymous/authenticated legacy mutation bypass remains.
do $$
declare
  f regprocedure;
  names text[]:=array[
   'public.ability_chess_update_room_action(uuid,uuid,bigint,jsonb,text,text,text,jsonb)',
   'public.update_ability_chess_room(uuid,uuid,bigint,jsonb,text)',
   'public.ability_chess_apply_rating_result(text,text,integer)',
   'public.ability_chess_apply_category_rating_result(text,text,integer,text)',
   'public.ability_chess_tournament_report_result(uuid,text,text)',
   'public.ability_chess_save_game_history(text,text,text,text,text,text,jsonb,jsonb)'
  ];
  name text;
  protected_table text;
begin
 foreach name in array names loop
  f:=to_regprocedure(name);
  if f is null then
    raise exception 'Expected legacy RPC signature missing: %',name;
  end if;
  if has_function_privilege('anon',f,'EXECUTE')
    or has_function_privilege('authenticated',f,'EXECUTE') then
    raise exception 'Untrusted client still allowed to execute %',name;
  end if;
 end loop;
 -- The public creation functions must remain callable for matchmaking,
 -- but may no longer use client-supplied p_game_state as the official board.
 foreach name in array array[
  'public.create_ability_chess_room(jsonb,jsonb,text)',
  'public.ability_chess_create_or_match_seek(text,jsonb,jsonb)',
  'public.ability_chess_tournament_claim_game(uuid,jsonb,jsonb)'
 ] loop
   f:=to_regprocedure(name);
   if f is null or
    position('ability_chess_initial_state' in pg_get_functiondef(f::oid))=0 then
    raise exception 'Matchmaking creation RPC not using trusted genesis: %',name;
   end if;
 end loop;
 foreach protected_table in array array[
   'public.ability_chess_rating_results',
   'public.ability_chess_room_actions',
   'public.ability_chess_tournament_games',
   'public.ability_chess_tournament_entries'
 ] loop
  if has_table_privilege('anon',protected_table,'INSERT')
    or has_table_privilege('anon',protected_table,'UPDATE')
    or has_table_privilege('authenticated',protected_table,'INSERT')
    or has_table_privilege('authenticated',protected_table,'UPDATE') then
    raise exception 'Direct client write grant remains on %',protected_table;
  end if;
 end loop;
end $$;

-- Also manually verify API policies and all Edge function routes. A passing
-- catalog audit does not prove legality or user identity checks in JavaScript.
select 'Legacy client mutation endpoints and direct score writes denied' as result;
