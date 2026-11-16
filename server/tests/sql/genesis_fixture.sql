-- Extends the isolated game test fixture to compile and exercise the
-- production-shaped create/seek/challenge/tournament RPC replacements.
alter table public.ability_chess_rooms add column room_code text unique;
alter table public.ability_chess_rooms alter column id set default gen_random_uuid();
alter table public.ability_chess_tournament_games alter column id set default gen_random_uuid();
alter table public.ability_chess_rooms alter column guest_token drop default;
alter table public.ability_chess_rooms alter column host_token set default gen_random_uuid();
alter table public.ability_chess_rooms alter column status set default 'waiting';
alter table public.ability_chess_rooms alter column host_color set default 'w';
alter table public.ability_chess_tournament_games
 add column round_number integer, add column white_score_before numeric,
 add column black_score_before numeric,
 add column started_at timestamptz not null default now();
alter table public.ability_chess_tournament_games
 alter column status set default 'active';
alter table public.ability_chess_tournament_entries
 add column games_started integer not null default 0,
 add column last_pairing_at timestamptz,
 add column joined_at timestamptz not null default now();
create or replace function auth.uid()
returns uuid language sql stable as $$
select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table public.ability_chess_live_seeks(
 id uuid primary key default gen_random_uuid(),
 queue_key text not null, room_id uuid not null references public.ability_chess_rooms(id),
 seeker_id uuid,seeker_rating integer not null default 1200,
 seeker_token uuid not null default gen_random_uuid(),
 host_seat_token uuid,matched_user_id uuid,
 rated boolean not null default false,status text not null default 'waiting',
 expires_at timestamptz not null default now()+interval '1 day',
 created_at timestamptz not null default now()
);
create table public.ability_chess_tournaments(
 id uuid primary key,name text,format text,status text default 'open',
 starts_at timestamptz,ends_at timestamptz,
 rounds integer,arena_minutes integer,
 base_minutes integer,increment_seconds integer,starting_points integer,
 max_upgrades integer,abilities_enabled boolean,upgrades_enabled boolean,
 rated boolean
);
create table public.ability_chess_challenges(
 id uuid primary key default gen_random_uuid(),
 challenger_id uuid not null,
 challenged_id uuid,
 room_id uuid not null references public.ability_chess_rooms(id),
 room_code text,challenger_token uuid,
 settings jsonb,status text not null default 'pending',
 accepted_by uuid,acceptor_token uuid,
 expires_at timestamptz not null default now()+interval '1 day',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.ability_chess_challenge_notifications(
 challenge_id uuid not null,recipient_id uuid not null,
 unique(challenge_id,recipient_id)
);
create table public.ability_chess_notifications(
 id bigint generated always as identity primary key,
 user_id uuid,type text,title text,body text,href text,data jsonb
);
