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
-- Revoke the legacy whole-board action endpoint: otherwise it remains a
-- bypass around the trusted per-action validator.
revoke execute on function public.ability_chess_update_room_action(
 uuid,uuid,bigint,jsonb,text,text,text,jsonb)
 from public,anon,authenticated;

-- Initial positions/settings must also be minted by the trusted handler,
-- not accepted from a custom browser request. These revocations REQUIRE
-- moving game/challenge/tournament creation to the new endpoint first.
revoke execute on function public.create_ability_chess_room(jsonb,jsonb,text)
 from public,anon,authenticated;
revoke execute on function public.ability_chess_create_or_match_seek(text,jsonb,jsonb)
 from public,anon,authenticated;
revoke execute on function public.ability_chess_create_member_challenge(jsonb,jsonb,uuid)
 from public,anon,authenticated;
revoke execute on function public.ability_chess_tournament_claim_game(uuid,jsonb,jsonb)
 from public,anon,authenticated;
commit;

-- Verification (run separately):
-- SELECT proname,
--   has_function_privilege('anon',oid,'EXECUTE') AS anon_execute,
--   has_function_privilege('authenticated',oid,'EXECUTE') AS authenticated_execute
-- FROM pg_proc WHERE pronamespace='public'::regnamespace
-- AND proname IN ('ability_chess_apply_rating_result',
--  'ability_chess_apply_category_rating_result',
--  'ability_chess_tournament_report_result','ability_chess_save_game_history');
-- Every revoked legacy RPC must be false for anon and authenticated.
