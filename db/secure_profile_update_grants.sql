-- Restrict direct player self-updates to nonprivileged profile fields.
-- SECURITY DEFINER gameplay/administrative RPCs retain their server-side capabilities.
revoke update on public.ability_chess_profiles from anon, authenticated;
grant update (username, display_name, bio, avatar_url, last_seen_at)
on public.ability_chess_profiles to authenticated;
