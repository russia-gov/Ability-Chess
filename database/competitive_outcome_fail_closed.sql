-- Stage 1 fail-closed gate for client-reported competitive outcomes.
-- DO NOT apply until the frontend explicitly marks rated games/tournaments unavailable,
-- or the replacement server-authoritative action/result pipeline is deployed.
-- This migration intentionally does not modify existing rows or ratings.
--
-- Risk: the current browser invokes these RPCs to award ratings/report tournament
-- scores. After revocation, those calls fail rather than accepting forged claims.
begin;
revoke execute on function public.ability_chess_apply_rating_result(text,text,integer)
  from public, anon, authenticated;
revoke execute on function public.ability_chess_apply_category_rating_result(text,text,integer,text)
  from public, anon, authenticated;
revoke execute on function public.ability_chess_tournament_report_result(uuid,text,text)
  from public, anon, authenticated;
-- Client-supplied replay/result is unverified too. Keep only private history
-- written through the eventual trusted game finalization path.
revoke execute on function public.ability_chess_save_game_history(text,text,text,text,text,text,jsonb,jsonb)
  from public, anon, authenticated;
commit;

-- Verification (run separately):
-- SELECT proname,
--   has_function_privilege('anon',oid,'EXECUTE') AS anon_execute,
--   has_function_privilege('authenticated',oid,'EXECUTE') AS authenticated_execute
-- FROM pg_proc WHERE pronamespace='public'::regnamespace
-- AND proname IN ('ability_chess_apply_rating_result',
--  'ability_chess_apply_category_rating_result',
--  'ability_chess_tournament_report_result','ability_chess_save_game_history');
-- All four must be false for anon and authenticated.
