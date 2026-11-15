-- Community news and announcements. Apply to Supabase before deploying the frontend.
create table if not exists public.ability_chess_community_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  summary text not null default '' check (char_length(summary) <= 500),
  kind text not null default 'news' check (kind in ('news','announcement','update')),
  body_html text not null default '' check (char_length(body_html) <= 50000),
  thumbnail_url text check (thumbnail_url is null or (char_length(thumbnail_url) <= 2048 and thumbnail_url ~ '^https://')),
  status text not null default 'draft' check (status in ('draft','published')),
  pinned boolean not null default false,
  author_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists ability_chess_community_feed_idx
 on public.ability_chess_community_posts (status, pinned desc, published_at desc);
create or replace function public.ability_chess_community_touch_updated()
 returns trigger language plpgsql set search_path = '' as $$
begin
 new.updated_at = now();
 return new;
end $$;
drop trigger if exists ability_chess_community_touch on public.ability_chess_community_posts;
create trigger ability_chess_community_touch before update on public.ability_chess_community_posts
 for each row execute function public.ability_chess_community_touch_updated();
alter table public.ability_chess_community_posts enable row level security;
drop policy if exists "Community public published read" on public.ability_chess_community_posts;
create policy "Community public published read" on public.ability_chess_community_posts
 for select to anon, authenticated using (
   (status = 'published' and published_at is not null and published_at <= now())
   or (auth.uid() is not null and public.ability_chess_is_admin(auth.uid()))
 );
drop policy if exists "Community admins create" on public.ability_chess_community_posts;
create policy "Community admins create" on public.ability_chess_community_posts
 for insert to authenticated with check (
   author_id = auth.uid() and public.ability_chess_is_admin(auth.uid())
 );
drop policy if exists "Community admins update" on public.ability_chess_community_posts;
create policy "Community admins update" on public.ability_chess_community_posts
 for update to authenticated using (public.ability_chess_is_admin(auth.uid()))
 with check (public.ability_chess_is_admin(auth.uid()));
drop policy if exists "Community admins delete" on public.ability_chess_community_posts;
create policy "Community admins delete" on public.ability_chess_community_posts
 for delete to authenticated using (public.ability_chess_is_admin(auth.uid()));
revoke all on public.ability_chess_community_posts from public, anon, authenticated;
grant select on public.ability_chess_community_posts to anon, authenticated;
grant insert, update, delete on public.ability_chess_community_posts to authenticated;

-- Thumbnail upload bucket. Public image reads, but only verified admins can upload.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 values ('ability-chess-community','ability-chess-community',true,5242880,
 array['image/jpeg','image/png','image/webp','image/gif'])
 on conflict (id) do update set
   public=excluded.public,
   file_size_limit=excluded.file_size_limit,
   allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Community admins upload images" on storage.objects;
create policy "Community admins upload images" on storage.objects
 for insert to authenticated with check (
   bucket_id='ability-chess-community' and public.ability_chess_is_admin(auth.uid())
 );
drop policy if exists "Community admins remove images" on storage.objects;
create policy "Community admins remove images" on storage.objects
 for delete to authenticated using (
   bucket_id='ability-chess-community' and public.ability_chess_is_admin(auth.uid())
 );
