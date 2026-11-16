-- Standalone PostgreSQL fixture for staged verified result finalization.
-- No connection to the production Ability Chess database.
create role anon;
create role authenticated;
create role service_role;
create table public.ability_chess_profiles (
 id uuid primary key,
 username text,
 display_name text,
 bullet_rating integer default 1200,
 blitz_rating integer default 1200,
 rapid_rating integer default 1200,
 games_played integer not null default 0,
 wins integer not null default 0,
 losses integer not null default 0,
 draws integer not null default 0,
 updated_at timestamptz default now()
);
create table public.ability_chess_rooms (
 id uuid primary key,
 room_code text not null unique default substr(md5(random()::text),1,8),
 status text,
 host_color text,
 host_user_id uuid,
 guest_user_id uuid,
 settings jsonb,
 host_token uuid default '00000000-0000-0000-0000-0000000000d1',
 guest_token uuid default '00000000-0000-0000-0000-0000000000d2',
 version bigint not null default 0,
 game_state jsonb not null default '{"turn":"w","over":false}'::jsonb,
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '1 day'
);
create table public.ability_chess_rating_results (
 game_key text not null,
 player_id uuid not null references public.ability_chess_profiles(id),
 rating_before integer,
 rating_after integer,
 rating_change integer,
 result text,
 rating_category text,
 primary key(game_key,player_id)
);
create table public.ability_chess_tournament_games (
 id uuid primary key,
 tournament_id uuid not null,
 room_id uuid not null unique references public.ability_chess_rooms(id),
 white_id uuid not null references public.ability_chess_profiles(id),
 black_id uuid not null references public.ability_chess_profiles(id),
 status text not null,
 result text,
 result_reason text,
 finished_at timestamptz
);
create table public.ability_chess_tournament_entries (
 tournament_id uuid not null,
 user_id uuid not null references public.ability_chess_profiles(id),
 score numeric not null default 0,
 pairing_status text,
 current_room_id uuid,
 seat_token uuid,
 assigned_color text,
 primary key(tournament_id,user_id)
);

create table public.ability_chess_room_actions (
 id bigint generated always as identity primary key,
 room_id uuid not null references public.ability_chess_rooms(id),
 room_version bigint not null,
 actor_id uuid,
 actor_color text,
 action_type text,
 action_label text,
 action_payload jsonb,
 state_snapshot jsonb,
 created_at timestamptz not null default now(),
 unique(room_id,room_version)
);

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

create table public.ability_chess_game_history(
 id uuid primary key default gen_random_uuid(),
 player_id uuid not null references public.ability_chess_profiles(id),
 game_key text not null,played_at timestamptz not null default now(),
 mode text,player_color text,result text,result_reason text,
 opponent_name text,settings jsonb,replay jsonb,
 rating_before integer,rating_after integer,rating_change integer,
 unique(player_id,game_key)
);
