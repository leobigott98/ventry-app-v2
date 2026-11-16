-- Push is written through scoped RPCs and delivered through a separate database role.
create schema if not exists ventry_push;
revoke all on schema ventry_push from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'ventry_push_worker') then
    create role ventry_push_worker nologin;
  end if;
end $$;
grant usage on schema ventry_push to ventry_push_worker;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  resident_id uuid references public.residents(id) on delete cascade,
  installation_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  vapid_key text not null,
  platform text not null check (platform in ('android', 'ios', 'web')),
  state text not null default 'active' check (state in ('active', 'disabled', 'expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, auth_user_id, installation_id)
);

create table public.push_preferences (
  community_id uuid not null references public.communities(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('visit_waiting', 'entry_registered', 'credential_rejected', 'call_incoming', 'call_missed')),
  enabled boolean not null,
  primary key (community_id, auth_user_id, kind)
);

create table public.visit_confirmations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  visitor_name text not null check (length(visitor_name) between 2 and 150),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  responded_at timestamptz,
  unique (community_id, requested_by, request_key)
);
create index visit_confirmations_resident_idx on public.visit_confirmations(community_id, resident_id, created_at desc);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  resident_id uuid references public.residents(id) on delete cascade,
  kind text not null check (kind in ('visit_waiting', 'entry_registered', 'credential_rejected', 'call_incoming', 'call_missed', 'test')),
  source_key text not null,
  target_id uuid,
  target_type text check (target_type in ('confirmation', 'invitation', 'event', 'entry', 'call')),
  created_at timestamptz not null default now(),
  unique (community_id, auth_user_id, kind, source_key)
);
create index notification_events_feed_idx on public.notification_events(community_id, auth_user_id, created_at desc);

create table ventry_push.deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  subscription_version timestamptz not null,
  state text not null default 'pending' check (state in ('pending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease uuid,
  unique (event_id, subscription_id)
);
create index push_deliveries_pending_idx on ventry_push.deliveries(next_attempt_at) where state = 'pending';

alter table public.push_subscriptions enable row level security;
alter table public.push_preferences enable row level security;
alter table public.visit_confirmations enable row level security;
alter table public.notification_events enable row level security;
alter table ventry_push.deliveries enable row level security;
revoke all on public.push_subscriptions, public.push_preferences, public.visit_confirmations, public.notification_events
  from public, anon, authenticated;
grant select on public.push_preferences, public.visit_confirmations, public.notification_events to authenticated;

create policy push_preferences_own on public.push_preferences for select to authenticated
  using (auth_user_id = (select auth.uid()) and public.has_active_community_role(community_id));
create policy notification_events_own on public.notification_events for select to authenticated
  using (auth_user_id = (select auth.uid()) and public.has_active_community_role(community_id)
    and (resident_id is null or resident_id = public.current_community_resident_id(community_id)));
create policy visit_confirmations_scoped on public.visit_confirmations for select to authenticated
  using (resident_id = public.current_community_resident_id(community_id)
    or public.has_active_community_role(community_id, array['admin', 'guard']));

create function ventry_push.endpoint_allowed(p_endpoint text) returns boolean
language sql immutable set search_path = '' as $$
  select length(p_endpoint) <= 2048 and p_endpoint collate "C" ~
    '^https://(fcm[.]googleapis[.]com|[a-z0-9-]+[.]push[.]apple[.]com|updates[.]push[.]services[.]mozilla[.]com|[a-z0-9-]+[.]notify[.]windows[.]com)/[A-Za-z0-9._~/%!$&()*+,;=:@?+-]+$';
$$;

create function public.save_push_subscription(
  p_community uuid, p_installation uuid, p_endpoint text, p_p256dh text, p_auth text,
  p_platform text, p_vapid_key text, p_expires_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_resident uuid := public.current_community_resident_id(p_community);
begin
  if not public.has_active_community_role(p_community) then
    raise exception 'active membership required' using errcode = '42501';
  end if;
  if not coalesce(ventry_push.endpoint_allowed(p_endpoint), false)
      or p_p256dh is null or p_p256dh !~ '^B[A-Za-z0-9_-]{86}$'
      or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}$'
      or p_vapid_key is null or p_vapid_key !~ '^B[A-Za-z0-9_-]{86}$'
      or (p_expires_at is not null and p_expires_at <= now()) then
    raise exception 'invalid subscription' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 53));
  if (select count(*) from public.push_subscriptions
      where auth_user_id = v_user and community_id = p_community and installation_id <> p_installation
        and state = 'active' and (expires_at is null or expires_at > now())) >= 10 then
    raise exception 'device limit reached' using errcode = '54000';
  end if;
  -- The endpoint is globally unique. An upsert can only rotate the caller's own installation.
  insert into public.push_subscriptions as s
    (community_id, auth_user_id, resident_id, installation_id, endpoint, p256dh, auth_secret, platform, vapid_key, expires_at)
  values (p_community, v_user, v_resident, p_installation, p_endpoint, p_p256dh, p_auth, p_platform, p_vapid_key, p_expires_at)
  on conflict (community_id, auth_user_id, installation_id) do update set
    resident_id = excluded.resident_id, endpoint = excluded.endpoint, p256dh = excluded.p256dh,
    auth_secret = excluded.auth_secret, platform = excluded.platform, vapid_key = excluded.vapid_key,
    expires_at = excluded.expires_at, state = 'active', updated_at = clock_timestamp()
  where (s.resident_id, s.endpoint, s.p256dh, s.auth_secret, s.platform, s.vapid_key, s.expires_at, s.state)
    is distinct from (excluded.resident_id, excluded.endpoint, excluded.p256dh, excluded.auth_secret,
      excluded.platform, excluded.vapid_key, excluded.expires_at, 'active');
end $$;

create function public.push_device_status(p_community uuid, p_installation uuid, p_vapid_key text) returns text
language sql stable security definer set search_path = '' as $$
  select case when s.state = 'active' and (s.expires_at <= now() or s.vapid_key <> p_vapid_key)
    then 'expired' else s.state end
  from public.push_subscriptions s
  where s.community_id = p_community and s.auth_user_id = auth.uid()
    and s.installation_id = p_installation and public.has_active_community_role(p_community);
$$;

create function public.disable_push_installation(p_installation uuid) returns void
language sql security definer set search_path = '' as $$
  update public.push_subscriptions set state = 'disabled', updated_at = clock_timestamp()
  where auth_user_id = auth.uid() and installation_id = p_installation and state <> 'disabled';
$$;

create function public.set_push_preference(p_community uuid, p_kind text, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_active_community_role(p_community) then
    raise exception 'active membership required' using errcode = '42501';
  end if;
  insert into public.push_preferences (community_id, auth_user_id, kind, enabled)
  values (p_community, auth.uid(), p_kind, p_enabled)
  on conflict (community_id, auth_user_id, kind) do update set enabled = excluded.enabled;
end $$;

create function ventry_push.enqueue(
  p_community uuid, p_user uuid, p_resident uuid, p_kind text, p_source text,
  p_target uuid, p_target_type text, p_installation uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  -- Legacy memberships can retain a stale Auth id. A missing recipient must not break access registration.
  perform 1 from auth.users where id = p_user for key share;
  if not found then return null; end if;
  insert into public.notification_events (community_id, auth_user_id, resident_id, kind, source_key, target_id, target_type)
  values (p_community, p_user, p_resident, p_kind, p_source, p_target, p_target_type)
  on conflict (community_id, auth_user_id, kind, source_key) do nothing returning id into v_id;

  if v_id is not null then
    insert into ventry_push.deliveries (event_id, subscription_id, subscription_version)
    select v_id, s.id, s.updated_at from public.push_subscriptions s
    where s.community_id = p_community and s.auth_user_id = p_user
      and s.resident_id is not distinct from p_resident and s.state = 'active'
      and (s.expires_at is null or s.expires_at > now())
      and (p_installation is null or s.installation_id = p_installation)
      and coalesce((select p.enabled from public.push_preferences p
        where p.community_id = p_community and p.auth_user_id = p_user and p.kind = p_kind), true);
  end if;
  return v_id;
end $$;

create function ventry_push.notify_resident(
  p_community uuid, p_resident uuid, p_kind text, p_source text, p_target uuid, p_target_type text
) returns void language sql security definer set search_path = '' as $$
  select ventry_push.enqueue(p_community, m.auth_user_id, p_resident, p_kind, p_source, p_target, p_target_type)
  from public.community_memberships m join public.residents r on r.id = m.resident_id and r.community_id = m.community_id
  where m.community_id = p_community and m.resident_id = p_resident and m.is_active
    and m.role = 'resident' and m.auth_user_id is not null and r.is_active;
$$;

create function ventry_push.notify_entry() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform ventry_push.notify_resident(new.community_id, new.resident_id, 'entry_registered', new.id::text, new.id, 'entry');
  return new;
end $$;
create trigger push_entry_recorded after insert on public.visitor_entries
  for each row execute function ventry_push.notify_entry();

create function ventry_push.notify_rejection() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_resident uuid;
  v_target uuid := coalesce(new.invitation_id, new.event_id);
  v_type text := case when new.invitation_id is not null then 'invitation' else 'event' end;
begin
  if new.details->>'credentialType' in ('pin', 'qr')
      or new.details->>'decision' = 'guard_rejected' then
    if v_type = 'invitation' then
      select i.resident_id into v_resident from public.invitations i where i.id = v_target and i.community_id = new.community_id;
    else
      select e.resident_id into v_resident from public.resident_events e where e.id = v_target and e.community_id = new.community_id;
    end if;
    if v_resident is not null then
      -- Collapse repeated scans/guard decisions for the same credential resource into a two-minute window.
      perform ventry_push.notify_resident(new.community_id, v_resident, 'credential_rejected',
        v_target::text || ':' || floor(extract(epoch from now()) / 120)::text, v_target, v_type);
    end if;
  end if;
  return new;
end $$;
create trigger push_credential_rejected after insert on public.access_events
  for each row when (new.access_event_type = 'validation_failed' and new.event_status = 'rejected')
  execute function ventry_push.notify_rejection();

create function public.create_visit_confirmation(p_community uuid, p_resident uuid, p_name text, p_key uuid)
returns public.visit_confirmations language plpgsql security definer set search_path = '' as $$
declare v_result public.visit_confirmations;
begin
  if not public.has_active_community_role(p_community, array['admin', 'guard']) then
    raise exception 'guard membership required' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_resident::text, 54));
  select * into v_result from public.visit_confirmations where community_id = p_community
    and requested_by = auth.uid() and request_key = p_key;
  if found then
    if v_result.resident_id <> p_resident or v_result.visitor_name <> btrim(p_name) then
      raise exception 'idempotency key already used' using errcode = '22023';
    end if;
    return v_result;
  end if;
  if not exists (
    select 1 from public.residents r join public.community_memberships m
      on m.community_id = r.community_id and m.resident_id = r.id
    join auth.users u on u.id = m.auth_user_id
    where r.community_id = p_community and r.id = p_resident and r.is_active and m.is_active
      and m.role = 'resident' and m.auth_user_id is not null
  ) then
    raise exception 'resident has no active account' using errcode = '22023';
  end if;
  if exists (select 1 from public.visit_confirmations where community_id = p_community and resident_id = p_resident
      and created_at > now() - interval '20 seconds') then
    raise exception 'confirmation rate limit' using errcode = '54000';
  end if;
  insert into public.visit_confirmations (community_id, resident_id, requested_by, request_key, visitor_name)
  values (p_community, p_resident, auth.uid(), p_key, btrim(p_name)) returning * into v_result;
  perform ventry_push.notify_resident(p_community, p_resident, 'visit_waiting', v_result.id::text, v_result.id, 'confirmation');
  return v_result;
end $$;

create function public.respond_visit_confirmation(p_community uuid, p_id uuid, p_decision text)
returns public.visit_confirmations language plpgsql security definer set search_path = '' as $$
declare v_result public.visit_confirmations;
begin
  if p_decision not in ('approved', 'declined') or p_decision is null then
    raise exception 'invalid decision' using errcode = '22023';
  end if;
  update public.visit_confirmations set status = p_decision, responded_at = now()
  where id = p_id and community_id = p_community and resident_id = public.current_community_resident_id(p_community)
    and status = 'pending' and expires_at > now() returning * into v_result;
  if not found then raise exception 'confirmation unavailable' using errcode = '42501'; end if;
  return v_result;
end $$;

-- The future call lifecycle invokes this only after authorizing and persisting a call transition.
create function ventry_push.notify_call(
  p_community uuid, p_recipient uuid, p_call uuid, p_kind text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_resident uuid;
begin
  if p_kind not in ('call_incoming', 'call_missed') or p_kind is null then
    raise exception 'invalid call transition' using errcode = '22023';
  end if;
  select case when role = 'resident' then resident_id end into v_resident
  from public.community_memberships
  where community_id = p_community and auth_user_id = p_recipient and is_active;
  if not found then return null; end if;
  if p_kind = 'call_missed' then
    update ventry_push.deliveries d set state = 'skipped', lease = null
    from public.notification_events e
    where d.event_id = e.id and e.community_id = p_community and e.auth_user_id = p_recipient
      and e.kind = 'call_incoming' and e.target_id = p_call and d.state = 'pending';
  end if;
  return ventry_push.enqueue(p_community, p_recipient, v_resident, p_kind, p_call::text, p_call, 'call');
end $$;

create function public.queue_push_test(p_community uuid, p_installation uuid, p_vapid_key text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_resident uuid := public.current_community_resident_id(p_community);
begin
  if not public.has_active_community_role(p_community) then
    raise exception 'active membership required' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 53));
  if exists (select 1 from public.notification_events where community_id = p_community and auth_user_id = v_user
      and kind = 'test' and created_at > now() - interval '1 minute') then
    raise exception 'test rate limit' using errcode = '54000';
  end if;
  if not exists (select 1 from public.push_subscriptions where community_id = p_community and auth_user_id = v_user
      and installation_id = p_installation and resident_id is not distinct from v_resident and state = 'active'
      and vapid_key = p_vapid_key and (expires_at is null or expires_at > now())) then
    raise exception 'active installation required' using errcode = '22023';
  end if;
  return ventry_push.enqueue(p_community, v_user, v_resident, 'test', gen_random_uuid()::text, null, null, p_installation);
end $$;

create function ventry_push.claim_deliveries(p_vapid_key text, p_event uuid)
returns table (delivery_id uuid, lease_id uuid, event_id uuid, kind text, target_id uuid, ttl integer,
  endpoint text, p256dh text, auth_secret text)
language sql security definer set search_path = '' as $$
  with eligible as (
    select d.id,
      extract(epoch from (e.created_at + case when e.kind = 'call_incoming' then interval '30 seconds'
        when e.kind = 'visit_waiting' then interval '15 minutes' else interval '1 hour' end - now()))::integer as ttl
    from ventry_push.deliveries d join public.notification_events e on e.id = d.event_id
    join public.push_subscriptions s on s.id = d.subscription_id
    where d.state = 'pending' and d.attempts < 5 and d.next_attempt_at <= now()
      and (p_event is null or e.id = p_event) and s.state = 'active' and s.updated_at = d.subscription_version
      and s.vapid_key = p_vapid_key and (s.expires_at is null or s.expires_at > now())
      and exists (select 1 from public.community_memberships m
        where m.community_id = e.community_id and m.auth_user_id = e.auth_user_id and m.is_active
          and (case when m.role = 'resident' then m.resident_id end) is not distinct from e.resident_id
          and (e.resident_id is null or exists (select 1 from public.residents r where r.id = e.resident_id and r.is_active)))
      and coalesce((select p.enabled from public.push_preferences p
        where p.community_id = e.community_id and p.auth_user_id = e.auth_user_id and p.kind = e.kind), true)
      and (e.kind <> 'visit_waiting' or exists (select 1 from public.visit_confirmations v
        where v.id = e.target_id and v.status = 'pending' and v.expires_at > now()))
      and e.created_at > now() - case when e.kind = 'call_incoming' then interval '30 seconds'
        when e.kind = 'visit_waiting' then interval '15 minutes' else interval '1 hour' end
    order by case when e.kind = 'call_incoming' then 0 else 1 end, d.next_attempt_at
    limit 20 for update of d skip locked
  ), claimed as (
    update ventry_push.deliveries d set attempts = attempts + 1, lease = gen_random_uuid(), next_attempt_at = now() + interval '45 seconds'
    from eligible q where d.id = q.id returning d.*, q.ttl
  )
  select d.id, d.lease, e.id, e.kind, e.target_id, greatest(1, d.ttl), s.endpoint, s.p256dh, s.auth_secret
  from claimed d join public.notification_events e on e.id = d.event_id
  join public.push_subscriptions s on s.id = d.subscription_id;
$$;

create function ventry_push.finish_delivery(p_id uuid, p_lease uuid, p_result text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_delivery ventry_push.deliveries;
begin
  if p_result not in ('sent', 'expired', 'retry', 'failed') or p_result is null then
    raise exception 'invalid result' using errcode = '22023';
  end if;
  update ventry_push.deliveries set lease = null,
    state = case when p_result = 'sent' then 'sent' when p_result = 'retry' and attempts < 5 then 'pending' else 'failed' end,
    next_attempt_at = now() + make_interval(secs => least(300, 10 * (1 << attempts)))
  where id = p_id and lease = p_lease returning * into v_delivery;
  if found and p_result = 'expired' then
    update public.push_subscriptions set state = 'expired', updated_at = clock_timestamp()
    where id = v_delivery.subscription_id and updated_at = v_delivery.subscription_version and state = 'active';
  end if;
end $$;

create function ventry_push.prune() returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from ventry_push.deliveries d using public.notification_events e
    where d.event_id = e.id and e.created_at < now() - interval '2 hours';
  delete from public.notification_events where created_at < now() - interval '90 days';
  delete from public.visit_confirmations where created_at < now() - interval '90 days';
  delete from public.push_subscriptions where updated_at < now() - interval '30 days'
    and (state <> 'active' or expires_at <= now());
end $$;

revoke all on all functions in schema ventry_push from public, anon, authenticated;
grant execute on function ventry_push.claim_deliveries(text, uuid),
  ventry_push.finish_delivery(uuid, uuid, text), ventry_push.prune() to ventry_push_worker;

revoke all on function public.save_push_subscription(uuid, uuid, text, text, text, text, text, timestamptz),
  public.push_device_status(uuid, uuid, text), public.disable_push_installation(uuid), public.set_push_preference(uuid, text, boolean),
  public.create_visit_confirmation(uuid, uuid, text, uuid), public.respond_visit_confirmation(uuid, uuid, text),
  public.queue_push_test(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.save_push_subscription(uuid, uuid, text, text, text, text, text, timestamptz),
  public.push_device_status(uuid, uuid, text), public.disable_push_installation(uuid), public.set_push_preference(uuid, text, boolean),
  public.create_visit_confirmation(uuid, uuid, text, uuid), public.respond_visit_confirmation(uuid, uuid, text),
  public.queue_push_test(uuid, uuid, text) to authenticated;
