-- DM reports: participant-submitted only, with limited, audited administrator review.
create table if not exists public.ability_chess_dm_reports (
 id uuid primary key default gen_random_uuid(),
 message_id bigint not null references public.ability_chess_direct_messages(id) on delete cascade,
 reporter_id uuid not null references public.ability_chess_profiles(id),
 target_user_id uuid not null references public.ability_chess_profiles(id),
 reason text not null check (char_length(reason) between 3 and 80),
 details text not null default '',
 status text not null default 'open' check (status in ('open','resolved','dismissed')),
 created_at timestamptz not null default now(),
 reviewed_by uuid references public.ability_chess_profiles(id),
 reviewed_at timestamptz,
 unique (message_id, reporter_id)
);
create index if not exists ability_chess_dm_reports_status_date on public.ability_chess_dm_reports (status,created_at desc);
alter table public.ability_chess_dm_reports enable row level security;
revoke all on public.ability_chess_dm_reports from public, anon, authenticated;

create table if not exists public.ability_chess_dm_review_audit (
 id bigint generated always as identity primary key,
 report_id uuid not null references public.ability_chess_dm_reports(id) on delete cascade,
 admin_id uuid not null references public.ability_chess_profiles(id),
 access_type text not null check(access_type in ('limited','expanded','resolved','dismissed')),
 reason text not null default '',
 created_at timestamptz not null default now()
);
create index if not exists ability_chess_dm_review_audit_report_date on public.ability_chess_dm_review_audit (report_id,created_at desc);
alter table public.ability_chess_dm_review_audit enable row level security;
revoke all on public.ability_chess_dm_review_audit from public, anon, authenticated;

-- Show only messages involving the caller; never reveal someone else's conversations.
create or replace function public.ability_chess_dm_my_recent(p_limit integer default 100)
returns table(id bigint, sender_id uuid, recipient_id uuid, sender_username text, recipient_username text, body text, created_at timestamptz)
language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return query
 select m.id,m.sender_id,m.recipient_id,s.username,r.username,m.body,m.created_at
 from public.ability_chess_direct_messages m
 join public.ability_chess_profiles s on s.id=m.sender_id
 join public.ability_chess_profiles r on r.id=m.recipient_id
 where m.sender_id=auth.uid() or m.recipient_id=auth.uid()
 order by m.id desc limit least(greatest(coalesce(p_limit,100),1),100);
end
$$;

create or replace function public.ability_chess_dm_report_message(
 p_message_id bigint,p_reason text,p_details text default ''
)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare m public.ability_chess_direct_messages%rowtype; result uuid; target uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into m from public.ability_chess_direct_messages where id=p_message_id;
 if not found or auth.uid() not in(m.sender_id,m.recipient_id) then
   raise exception 'Message not found' using errcode='42501';
 end if;
 if length(trim(coalesce(p_reason,'')))<3 or length(trim(p_reason))>80 then raise exception 'Choose a valid reason'; end if;
 target:=case when m.sender_id=auth.uid() then m.recipient_id else m.sender_id end;
 insert into public.ability_chess_dm_reports(message_id,reporter_id,target_user_id,reason,details)
 values(m.id,auth.uid(),target,trim(p_reason),left(trim(coalesce(p_details,'')),1500))
 on conflict(message_id,reporter_id) do update
 set reason=excluded.reason,details=excluded.details,status='open',reviewed_at=null,reviewed_by=null
 returning id into result;
 return result;
end
$$;

create or replace function public.ability_chess_dm_admin_reports(p_status text default 'open')
returns table(id uuid,message_id bigint,reason text,details text,status text,created_at timestamptz,reporter_username text,target_username text)
language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not public.ability_chess_is_admin(auth.uid()) then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_status not in('open','resolved','dismissed','all') then raise exception 'Invalid status'; end if;
 return query
 select r.id,r.message_id,r.reason,r.details,r.status,r.created_at,reporter.username,target.username
 from public.ability_chess_dm_reports r
 join public.ability_chess_profiles reporter on reporter.id=r.reporter_id
 join public.ability_chess_profiles target on target.id=r.target_user_id
 where p_status='all' or r.status=p_status
 order by (r.status='open') desc,r.created_at desc limit 100;
end
$$;

-- A review is always tied to a real report. The owner may request up to 100
-- chronological messages from that reported pair, with a documented reason.
-- Staff receive at most 11 messages centered on the reported message.
create or replace function public.ability_chess_dm_admin_review(
 p_report_id uuid,p_expanded boolean default false,p_reason text default ''
)
returns table(id bigint,sender_username text,recipient_username text,body text,created_at timestamptz,is_reported boolean)
language plpgsql security definer set search_path=''
as $$
declare rep public.ability_chess_dm_reports%rowtype; msg public.ability_chess_direct_messages%rowtype;
begin
 if auth.uid() is null or not public.ability_chess_is_admin(auth.uid()) then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into rep from public.ability_chess_dm_reports where ability_chess_dm_reports.id=p_report_id;
 if not found then raise exception 'Report not found' using errcode='42501'; end if;
 if p_expanded then
   if not public.ability_chess_is_owner(auth.uid()) then raise exception 'Owner access required' using errcode='42501'; end if;
   if length(trim(coalesce(p_reason,'')))<15 then raise exception 'Explain why expanded access is necessary (15+ characters)'; end if;
 end if;
 select * into msg from public.ability_chess_direct_messages where ability_chess_direct_messages.id=rep.message_id;
 if not found then raise exception 'Reported message no longer exists'; end if;
 insert into public.ability_chess_dm_review_audit(report_id,admin_id,access_type,reason)
 values(p_report_id,auth.uid(),case when p_expanded then 'expanded' else 'limited' end,
 case when p_expanded then left(trim(p_reason),500) else 'Reported-message context' end);
 return query
 select m.id,s.username,r.username,m.body,m.created_at,(m.id=rep.message_id)
 from public.ability_chess_direct_messages m
 join public.ability_chess_profiles s on s.id=m.sender_id
 join public.ability_chess_profiles r on r.id=m.recipient_id
 where ((m.sender_id=msg.sender_id and m.recipient_id=msg.recipient_id)
    or (m.sender_id=msg.recipient_id and m.recipient_id=msg.sender_id))
 and (p_expanded or m.id between greatest(0,msg.id-5) and msg.id+5)
 order by m.id desc
 limit case when p_expanded then 100 else 11 end;
end
$$;

create or replace function public.ability_chess_dm_admin_resolve(
 p_report_id uuid,p_status text
)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare target uuid;
begin
 if auth.uid() is null or not public.ability_chess_is_admin(auth.uid()) then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_status not in ('resolved','dismissed','open') then raise exception 'Invalid report status'; end if;
 update public.ability_chess_dm_reports set status=p_status,reviewed_by=auth.uid(),reviewed_at=now()
 where id=p_report_id returning target_user_id into target;
 if not found then raise exception 'Report not found'; end if;
 insert into public.ability_chess_dm_review_audit(report_id,admin_id,access_type,reason)
 values(p_report_id,auth.uid(),case when p_status='dismissed' then 'dismissed' else 'resolved' end,'Status: '||p_status);
 return true;
end
$$;

create or replace function public.ability_chess_dm_owner_access_log(p_report_id uuid default null)
returns table(id bigint,report_id uuid,admin_username text,access_type text,reason text,created_at timestamptz)
language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not public.ability_chess_is_owner(auth.uid()) then raise exception 'Owner access required' using errcode='42501'; end if;
 return query
 select a.id,a.report_id,p.username,a.access_type,a.reason,a.created_at
 from public.ability_chess_dm_review_audit a
 join public.ability_chess_profiles p on p.id=a.admin_id
 where p_report_id is null or a.report_id=p_report_id
 order by a.created_at desc limit 250;
end
$$;

revoke all on function public.ability_chess_dm_my_recent(integer) from public,anon;
revoke all on function public.ability_chess_dm_report_message(bigint,text,text) from public,anon;
revoke all on function public.ability_chess_dm_admin_reports(text) from public,anon;
revoke all on function public.ability_chess_dm_admin_review(uuid,boolean,text) from public,anon;
revoke all on function public.ability_chess_dm_admin_resolve(uuid,text) from public,anon;
revoke all on function public.ability_chess_dm_owner_access_log(uuid) from public,anon;
grant execute on function public.ability_chess_dm_my_recent(integer) to authenticated;
grant execute on function public.ability_chess_dm_report_message(bigint,text,text) to authenticated;
grant execute on function public.ability_chess_dm_admin_reports(text) to authenticated;
grant execute on function public.ability_chess_dm_admin_review(uuid,boolean,text) to authenticated;
grant execute on function public.ability_chess_dm_admin_resolve(uuid,text) to authenticated;
grant execute on function public.ability_chess_dm_owner_access_log(uuid) to authenticated;
