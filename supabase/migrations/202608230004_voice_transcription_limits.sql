create table public.voice_transcription_requests (
  id uuid primary key,
  community_id uuid not null references public.communities(id) on delete cascade,
  auth_user_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null check (status in ('active', 'success', 'error', 'cancelled', 'expired')),
  completed_at timestamptz
);

create index voice_transcription_requests_rate_window_idx
  on public.voice_transcription_requests (community_id, auth_user_id, created_at desc);
create unique index voice_transcription_requests_one_active_idx
  on public.voice_transcription_requests (community_id, auth_user_id)
  where status = 'active';

alter table public.voice_transcription_requests enable row level security;
revoke all on public.voice_transcription_requests from public, anon, authenticated;

create or replace function public.acquire_voice_transcription_slot(
  p_community_id uuid,
  p_request_id uuid,
  p_lock_seconds integer default 45
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.community_memberships membership
    where membership.community_id = p_community_id and membership.auth_user_id = v_user_id
      and membership.role = 'resident' and membership.is_active and membership.resident_id is not null
  ) then raise exception 'voice invitation scope denied' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text || ':' || v_user_id::text || ':voice', 0));
  delete from public.voice_transcription_requests where created_at < now() - interval '1 day';
  update public.voice_transcription_requests set status = 'expired', completed_at = now()
    where community_id = p_community_id and auth_user_id = v_user_id and status = 'active' and expires_at <= now();

  if exists (select 1 from public.voice_transcription_requests where community_id = p_community_id and auth_user_id = v_user_id and status = 'active') then
    return 'already_in_progress';
  end if;
  if (select count(*) from public.voice_transcription_requests where community_id = p_community_id and auth_user_id = v_user_id and created_at > now() - interval '10 minutes') >= 10 then
    return 'rate_limited';
  end if;

  insert into public.voice_transcription_requests (id, community_id, auth_user_id, expires_at, status)
  values (p_request_id, p_community_id, v_user_id, now() + make_interval(secs => greatest(10, least(p_lock_seconds, 90))), 'active');
  return 'acquired';
end;
$$;

create or replace function public.release_voice_transcription_slot(
  p_community_id uuid,
  p_request_id uuid,
  p_status text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_user_id uuid := auth.uid();
begin
  if p_status not in ('success', 'error', 'cancelled') then raise exception 'invalid voice request status' using errcode = '22023'; end if;
  update public.voice_transcription_requests set status = p_status, completed_at = now()
    where id = p_request_id and community_id = p_community_id and auth_user_id = v_user_id and status = 'active';
  return found;
end;
$$;

revoke all on function public.acquire_voice_transcription_slot(uuid, uuid, integer) from public;
revoke all on function public.release_voice_transcription_slot(uuid, uuid, text) from public;
grant execute on function public.acquire_voice_transcription_slot(uuid, uuid, integer) to authenticated;
grant execute on function public.release_voice_transcription_slot(uuid, uuid, text) to authenticated;

comment on table public.voice_transcription_requests is
  'Operational metadata only for voice rate limits and expiring locks. Never stores audio, transcripts, names, credentials, or invitation content.';
