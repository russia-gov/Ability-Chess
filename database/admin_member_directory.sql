-- Read-only paginated staff directory. No email addresses or auth records.
-- Uses the existing server-side owner/staff check, never client metadata.
create or replace function public.ability_chess_admin_member_directory(
  p_search text default '',
  p_status text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  display_name text,
  rating integer,
  rapid_rating integer,
  blitz_rating integer,
  bullet_rating integer,
  games_played integer,
  wins integer,
  losses integer,
  draws integer,
  last_seen_at timestamptz,
  created_at timestamptz,
  is_owner boolean,
  is_staff boolean,
  muted_until timestamptz,
  suspended_until timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  q text := left(trim(coalesce(p_search,'')),80);
  filter text := lower(trim(coalesce(p_status,'all')));
  page_limit integer := least(50,greatest(1,coalesce(p_limit,25)));
  page_offset integer := least(100000,greatest(0,coalesce(p_offset,0)));
begin
  if auth.uid() is null or not public.ability_chess_is_admin(auth.uid()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if filter not in ('all','online','staff','owner','muted','suspended') then
    raise exception 'Invalid directory filter' using errcode = '22023';
  end if;
  return query
    select p.id,p.username,p.display_name,p.rating,p.rapid_rating,
      p.blitz_rating,p.bullet_rating,p.games_played,p.wins,p.losses,p.draws,
      p.last_seen_at,p.created_at,p.is_owner,p.is_staff,p.muted_until,
      p.suspended_until,count(*) over() as total_count
    from public.ability_chess_profiles p
    where (q='' or p.username ilike '%'||q||'%' or p.display_name ilike '%'||q||'%')
      and (
        filter='all'
        or (filter='online' and p.last_seen_at > now()-interval '2 minutes')
        or (filter='staff' and p.is_staff)
        or (filter='owner' and p.is_owner)
        or (filter='muted' and p.muted_until > now())
        or (filter='suspended' and p.suspended_until > now())
      )
    order by p.is_owner desc,p.is_staff desc,p.created_at desc,p.id
    limit page_limit offset page_offset;
end;
$$;
revoke all on function public.ability_chess_admin_member_directory(text,text,integer,integer) from public, anon;
grant execute on function public.ability_chess_admin_member_directory(text,text,integer,integer) to authenticated;
