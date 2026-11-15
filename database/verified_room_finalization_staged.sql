-- STAGED ONLY: server-controlled, atomic competitive game finalization.
-- This must NOT be applied alone: legacy browser rating/tournament RPCs and
-- full-state room updates remain unsafe until the coordinated cutover.
-- Only trusted backend code with the service_role credential may call this RPC.
-- Never expose the service_role credential in the browser or a frontend bundle.

begin;

create table if not exists public.ability_chess_verified_room_results (
  room_id uuid primary key references public.ability_chess_rooms(id) on delete restrict,
  winner text not null check (winner in ('w','b','draw')),
  result_reason text not null default '',
  rating_category text check (rating_category in ('bullet','blitz','rapid')),
  white_id uuid not null references public.ability_chess_profiles(id),
  black_id uuid not null references public.ability_chess_profiles(id),
  finalized_at timestamptz not null default now()
);
alter table public.ability_chess_verified_room_results enable row level security;
revoke all on public.ability_chess_verified_room_results from public,anon,authenticated;
-- Trusted backend operations are via the SECURITY DEFINER RPC below.

create or replace function public.ability_chess_finalize_verified_room(
  p_room_id uuid, p_winner text, p_reason text default ''
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  room_record public.ability_chess_rooms%rowtype;
  white_player uuid;
  black_player uuid;
  category text;
  category_rated boolean;
  already public.ability_chess_verified_room_results%rowtype;
  inserted_id uuid;
  tournament_record public.ability_chess_tournament_games%rowtype;
  player_id uuid;
  opponent_id uuid;
  old_rating integer;
  opponent_rating integer;
  current_score numeric;
  expected_score numeric;
  delta integer;
  next_rating integer;
  score_label text;
  game_key text := 'room:' || p_room_id::text;
begin
  if p_winner not in ('w','b','draw') then
    raise exception 'Invalid verified winner';
  end if;
  if char_length(coalesce(p_reason,'')) > 250 then
    raise exception 'Result reason too long';
  end if;

  select * into room_record
    from public.ability_chess_rooms where id=p_room_id for update;
  if not found or room_record.status <> 'finished' then
    raise exception 'Verified game must be finished';
  end if;
  if room_record.host_user_id is null or room_record.guest_user_id is null
     or room_record.host_user_id=room_record.guest_user_id then
    raise exception 'Verified result requires two distinct authenticated players';
  end if;
  white_player := case when room_record.host_color='w'
    then room_record.host_user_id else room_record.guest_user_id end;
  black_player := case when room_record.host_color='b'
    then room_record.host_user_id else room_record.guest_user_id end;

  select * into already from public.ability_chess_verified_room_results
    where room_id=p_room_id;
  if found then
    if already.winner <> p_winner then
      raise exception 'Conflicting immutable verified result';
    end if;
    return false;
  end if;

  category := lower(coalesce(room_record.settings->>'ratingCategory','rapid'));
  if category not in ('bullet','blitz','rapid') then
    raise exception 'Invalid rating category in official game settings';
  end if;
  category_rated := coalesce((room_record.settings->>'rated')::boolean,false);

  -- Fixed lock order prevents opposite-player concurrent result updates
  -- from deadlocking while both profiles are updated.
  perform 1 from public.ability_chess_profiles
    where id in (white_player,black_player) order by id for update;
  if not found then raise exception 'Player profile not found'; end if;
  if (select count(*) from public.ability_chess_profiles
      where id in (white_player,black_player)) <> 2 then
    raise exception 'One or both player profiles missing';
  end if;

  insert into public.ability_chess_verified_room_results
     (room_id,winner,result_reason,rating_category,white_id,black_id)
  values (p_room_id,p_winner,coalesce(p_reason,''),
    case when category_rated then category else null end,white_player,black_player)
  returning room_id into inserted_id;

  if category_rated then
    for player_id,opponent_id,score_label in
      select white_player,black_player,
        case when p_winner='draw' then 'draw'
             when p_winner='w' then 'win' else 'loss' end
      union all
      select black_player,white_player,
        case when p_winner='draw' then 'draw'
             when p_winner='b' then 'win' else 'loss' end
    loop
      select case category when 'bullet' then bullet_rating
               when 'blitz' then blitz_rating else rapid_rating end
        into old_rating from public.ability_chess_profiles where id=player_id;
      select case category when 'bullet' then bullet_rating
               when 'blitz' then blitz_rating else rapid_rating end
        into opponent_rating from public.ability_chess_profiles where id=opponent_id;
      old_rating := coalesce(old_rating,1200);
      opponent_rating := coalesce(opponent_rating,1200);
      current_score := case score_label when 'win' then 1.0
        when 'draw' then 0.5 else 0.0 end;
      expected_score := 1.0/(1.0+power(10.0,(opponent_rating-old_rating)/400.0));
      delta := round(32.0*(current_score-expected_score));
      next_rating := greatest(100,old_rating+delta);

      update public.ability_chess_profiles
        set bullet_rating=case when category='bullet' then next_rating else bullet_rating end,
            blitz_rating=case when category='blitz' then next_rating else blitz_rating end,
            rapid_rating=case when category='rapid' then next_rating else rapid_rating end,
            games_played=games_played+1,
            wins=wins+case when score_label='win' then 1 else 0 end,
            losses=losses+case when score_label='loss' then 1 else 0 end,
            draws=draws+case when score_label='draw' then 1 else 0 end,
            updated_at=now()
        where id=player_id;
      insert into public.ability_chess_rating_results
        (game_key,player_id,rating_before,rating_after,rating_change,result,rating_category)
      values (game_key,player_id,old_rating,next_rating,delta,score_label,category);
    end loop;
  end if;

  select * into tournament_record from public.ability_chess_tournament_games
     where room_id=p_room_id for update;
  if found then
    if tournament_record.status='finished' then
      raise exception 'Tournament game was already finalized outside trusted pipeline';
    end if;
    if tournament_record.white_id <> white_player
       or tournament_record.black_id <> black_player then
      raise exception 'Tournament participants do not match room seats';
    end if;
    update public.ability_chess_tournament_games
       set status='finished',result=case p_winner
            when 'draw' then 'draw' when 'w' then 'white' else 'black' end,
           result_reason=coalesce(p_reason,''),finished_at=now()
       where id=tournament_record.id;
    update public.ability_chess_tournament_entries
       set score=score+case when p_winner='draw' then 0.5
             when (user_id=white_player and p_winner='w')
               or (user_id=black_player and p_winner='b') then 1 else 0 end,
           pairing_status='idle',current_room_id=null,seat_token=null,
           assigned_color=null
       where tournament_id=tournament_record.tournament_id
         and user_id in(white_player,black_player);
    if not found then raise exception 'Tournament entries missing'; end if;
  end if;
  return true;
end;
$$;

revoke all on function public.ability_chess_finalize_verified_room(uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.ability_chess_finalize_verified_room(uuid,text,text)
  to service_role;

commit;

-- This function is only a *finalization primitive*, not a legal-move validator.
-- The future trusted action handler must authenticate seats, apply legal moves
-- server-side, set the official outcome, and call it exactly once. A forged
-- client-submitted room state must never become a verified result.
