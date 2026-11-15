-- Standalone PostgreSQL fixture for staged verified result finalization.
-- No connection to the production Ability Chess database.
create role anon;
create role authenticated;
create role service_role;
create table public.ability_chess_profiles (
 id uuid primary key,
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
 status text,
 host_color text,
 host_user_id uuid,
 guest_user_id uuid,
 settings jsonb
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
