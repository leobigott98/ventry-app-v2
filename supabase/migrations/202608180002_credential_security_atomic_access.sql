-- Credential hardening, rate limiting, and atomic/idempotent gate entry.
-- Historical migrations are intentionally left unchanged.

set search_path = pg_catalog, extensions, public;

alter table public.communities
  add column if not exists time_zone text not null default 'America/Caracas';

create or replace function public.is_valid_time_zone(p_time_zone text)
returns boolean
language sql
stable
set search_path = 'pg_catalog', 'extensions', 'public'
as $$
  select exists (
    select 1 from pg_catalog.pg_timezone_names
    where name = p_time_zone
  );
$$;

alter table public.communities
  drop constraint if exists communities_time_zone_check;
alter table public.communities
  add constraint communities_time_zone_check
  check (public.is_valid_time_zone(time_zone));

revoke all on function public.is_valid_time_zone(text) from public;
grant execute on function public.is_valid_time_zone(text) to authenticated;

alter table public.access_credentials
  alter column credential_value drop not null,
  add column if not exists credential_hash text,
  add column if not exists legacy_fallback_hash text,
  add column if not exists credential_audit_id text,
  add column if not exists credential_version smallint not null default 1;

alter table public.event_credentials
  alter column credential_value drop not null,
  add column if not exists credential_hash text,
  add column if not exists legacy_fallback_hash text,
  add column if not exists credential_audit_id text,
  add column if not exists credential_version smallint not null default 1;

update public.access_credentials
set credential_hash = crypt(
      case when credential_type = 'qr' then coalesce(qr_payload, credential_value)
           else credential_value end,
      gen_salt('bf', 10)
    ),
    legacy_fallback_hash = case
      when credential_type = 'qr'
        and qr_payload is not null
        and credential_value is distinct from qr_payload
      then crypt(credential_value, gen_salt('bf', 10))
      else legacy_fallback_hash
    end,
    credential_audit_id = coalesce(
      credential_audit_id,
      'cred_' || encode(gen_random_bytes(8), 'hex')
    )
where credential_hash is null
   or credential_audit_id is null;

update public.event_credentials
set credential_hash = crypt(
      case when credential_type = 'qr' then coalesce(qr_payload, credential_value)
           else credential_value end,
      gen_salt('bf', 10)
    ),
    legacy_fallback_hash = case
      when credential_type = 'qr'
        and qr_payload is not null
        and credential_value is distinct from qr_payload
      then crypt(credential_value, gen_salt('bf', 10))
      else legacy_fallback_hash
    end,
    credential_audit_id = coalesce(
      credential_audit_id,
      'cred_' || encode(gen_random_bytes(8), 'hex')
    )
where credential_hash is null
   or credential_audit_id is null;

alter table public.access_credentials
  alter column credential_audit_id set default ('cred_' || encode(gen_random_bytes(8), 'hex')),
  alter column credential_audit_id set not null,
  drop constraint if exists access_credentials_version_check;
alter table public.access_credentials
  add constraint access_credentials_version_check check (
    credential_version = 1
    or (
      credential_version = 2
      and credential_hash is not null
      and credential_value is null
      and qr_payload is null
    )
  );

alter table public.event_credentials
  alter column credential_audit_id set default ('cred_' || encode(gen_random_bytes(8), 'hex')),
  alter column credential_audit_id set not null,
  drop constraint if exists event_credentials_version_check;
alter table public.event_credentials
  add constraint event_credentials_version_check check (
    credential_version = 1
    or (
      credential_version = 2
      and credential_hash is not null
      and credential_value is null
      and qr_payload is null
    )
  );

create unique index if not exists idx_access_credentials_audit_id
  on public.access_credentials (credential_audit_id);
create unique index if not exists idx_event_credentials_audit_id
  on public.event_credentials (credential_audit_id);
create index if not exists idx_access_credentials_type
  on public.access_credentials (credential_type);
create index if not exists idx_event_credentials_type
  on public.event_credentials (credential_type);

create table if not exists public.credential_secrets (
  id uuid primary key default gen_random_uuid(),
  access_credential_id uuid unique references public.access_credentials(id) on delete cascade,
  event_credential_id uuid unique references public.event_credentials(id) on delete cascade,
  secret_value text not null check (length(secret_value) between 6 and 256),
  created_at timestamptz not null default now(),
  check (num_nonnulls(access_credential_id, event_credential_id) = 1)
);

alter table public.credential_secrets enable row level security;
revoke all on table public.credential_secrets from anon, authenticated;

create table if not exists public.credential_rate_limits (
  community_id uuid not null references public.communities(id) on delete cascade,
  actor_user_id uuid not null,
  device_hash bytea not null,
  origin_hash bytea not null,
  window_started_at timestamptz not null default now(),
  failure_count integer not null default 0 check (failure_count >= 0),
  blocked_until timestamptz,
  last_attempt_at timestamptz not null default now(),
  primary key (community_id, actor_user_id, device_hash, origin_hash)
);

alter table public.credential_rate_limits enable row level security;
revoke all on table public.credential_rate_limits from anon, authenticated;
create index if not exists idx_credential_rate_limits_cleanup
  on public.credential_rate_limits (last_attempt_at);

alter table public.visitor_entries
  add column if not exists idempotency_key uuid;

create unique index if not exists idx_visitor_entries_community_idempotency
  on public.visitor_entries (community_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.audit_details_have_raw_credential(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = 'pg_catalog', 'extensions', 'public'
as $$
declare
  v_key text;
  v_child jsonb;
  v_normalized_key text;
begin
  if p_value is null then
    return false;
  end if;

  if jsonb_typeof(p_value) = 'object' then
    for v_key, v_child in select key, value from pg_catalog.jsonb_each(p_value)
    loop
      v_normalized_key := pg_catalog.regexp_replace(lower(v_key), '[_-]', '', 'g');
      if v_normalized_key in (
        'credential', 'credentialvalue', 'rawcredential', 'pin', 'qr', 'qrpayload'
      ) then
        return true;
      end if;
      if public.audit_details_have_raw_credential(v_child) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for v_child in select value from pg_catalog.jsonb_array_elements(p_value)
    loop
      if public.audit_details_have_raw_credential(v_child) then
        return true;
      end if;
    end loop;
  end if;

  return false;
end;
$$;

create or replace function public.redact_credential_audit_details(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = 'pg_catalog', 'extensions', 'public'
as $$
declare
  v_key text;
  v_child jsonb;
  v_result jsonb;
  v_normalized_key text;
begin
  if p_value is null then
    return '{}'::jsonb;
  end if;

  if jsonb_typeof(p_value) = 'object' then
    v_result := '{}'::jsonb;
    for v_key, v_child in select key, value from pg_catalog.jsonb_each(p_value)
    loop
      v_normalized_key := pg_catalog.regexp_replace(lower(v_key), '[_-]', '', 'g');
      if v_normalized_key not in (
        'credential', 'credentialvalue', 'rawcredential', 'pin', 'qr', 'qrpayload'
      ) then
        v_result := v_result || pg_catalog.jsonb_build_object(
          v_key,
          public.redact_credential_audit_details(v_child)
        );
      end if;
    end loop;
    return v_result;
  elsif jsonb_typeof(p_value) = 'array' then
    select coalesce(
      pg_catalog.jsonb_agg(public.redact_credential_audit_details(value)),
      '[]'::jsonb
    )
    into v_result
    from pg_catalog.jsonb_array_elements(p_value);
    return v_result;
  end if;

  return p_value;
end;
$$;

update public.access_events
set details = public.redact_credential_audit_details(details)
where public.audit_details_have_raw_credential(details);

create or replace function public.reject_raw_credential_audit()
returns trigger
language plpgsql
security definer
set search_path = 'pg_catalog', 'extensions', 'public'
as $$
begin
  if public.audit_details_have_raw_credential(new.details) then
    raise exception 'raw credential material is not allowed in access audit details'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_raw_credential_audit on public.access_events;
create trigger reject_raw_credential_audit
before insert or update of details on public.access_events
for each row execute function public.reject_raw_credential_audit();

revoke all on function public.audit_details_have_raw_credential(jsonb) from public;
revoke all on function public.redact_credential_audit_details(jsonb) from public;
revoke all on function public.reject_raw_credential_audit() from public;

create or replace function public.credential_matches(
  p_submitted_value text,
  p_hash text,
  p_fallback_hash text,
  p_legacy_value text,
  p_legacy_qr_payload text
)
returns boolean
language sql
stable
set search_path = 'pg_catalog', 'extensions', 'public'
as $$
  select (
    p_hash is not null and crypt(p_submitted_value, p_hash) = p_hash
  ) or (
    p_fallback_hash is not null
    and crypt(p_submitted_value, p_fallback_hash) = p_fallback_hash
  ) or p_submitted_value = p_legacy_value
    or p_submitted_value = p_legacy_qr_payload;
$$;

revoke all on function public.credential_matches(text, text, text, text, text) from public;

create or replace function public.store_invitation_credential(
  p_community_id uuid,
  p_invitation_id uuid,
  p_credential_type text,
  p_credential_value text
)
returns text
language plpgsql
security definer
set search_path = 'pg_catalog', 'extensions', 'public'
as $$
declare
  v_credential_id uuid;
  v_audit_id text := 'cred_' || encode(gen_random_bytes(8), 'hex');
begin
  if p_credential_type not in ('pin', 'qr') then
    raise exception 'invalid credential type' using errcode = '22023';
  end if;
  if p_credential_value is null
     or (p_credential_type = 'pin' and p_credential_value !~ '^[0-9]{6}$')
     or (p_credential_type = 'qr' and p_credential_value !~ '^[A-Za-z0-9_-]{43,128}$') then
    raise exception 'invalid credential format' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.invitations as invitation
    where invitation.id = p_invitation_id
      and invitation.community_id = p_community_id
      and (
        public.has_active_community_role(p_community_id, array['admin'])
        or invitation.resident_id = public.current_community_resident_id(p_community_id)
      )
  ) then
    raise exception 'credential creation is not allowed' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_community_id::text || ':' || p_credential_type, 0)
  );

  if exists (
    select 1
    from public.access_credentials as credential
    join public.invitations as invitation on invitation.id = credential.invitation_id
    where invitation.community_id = p_community_id
      and credential.credential_type = p_credential_type
      and public.credential_matches(
        p_credential_value, credential.credential_hash,
        credential.legacy_fallback_hash, credential.credential_value, credential.qr_payload
      )
  ) or exists (
    select 1
    from public.event_credentials as credential
    join public.resident_events as resident_event on resident_event.id = credential.event_id
    where resident_event.community_id = p_community_id
      and credential.credential_type = p_credential_type
      and public.credential_matches(
        p_credential_value, credential.credential_hash,
        credential.legacy_fallback_hash, credential.credential_value, credential.qr_payload
      )
  ) then
    raise exception 'credential collision' using errcode = '23505';
  end if;

  insert into public.access_credentials (
    invitation_id, credential_type, credential_value, qr_payload,
    credential_hash, credential_audit_id, credential_version
  ) values (
    p_invitation_id, p_credential_type, null, null,
    crypt(p_credential_value, gen_salt('bf', 10)), v_audit_id, 2
  ) returning id into v_credential_id;

  insert into public.credential_secrets (access_credential_id, secret_value)
  values (v_credential_id, p_credential_value);

  return v_audit_id;
end;
$$;

create or replace function public.store_event_credential(
  p_community_id uuid,
  p_event_id uuid,
  p_credential_type text,
  p_credential_value text
)
returns text
language plpgsql
security definer
set search_path = 'pg_catalog', 'extensions', 'public'
as $$
declare
  v_credential_id uuid;
  v_audit_id text := 'cred_' || encode(gen_random_bytes(8), 'hex');
begin
  if p_credential_type not in ('pin', 'qr') then
    raise exception 'invalid credential type' using errcode = '22023';
  end if;
  if p_credential_value is null
     or (p_credential_type = 'pin' and p_credential_value !~ '^[0-9]{8}$')
     or (p_credential_type = 'qr' and p_credential_value !~ '^[A-Za-z0-9_-]{43,128}$') then
    raise exception 'invalid credential format' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.resident_events as resident_event
    where resident_event.id = p_event_id
      and resident_event.community_id = p_community_id
      and (
        public.has_active_community_role(p_community_id, array['admin'])
        or resident_event.resident_id = public.current_community_resident_id(p_community_id)
      )
  ) then
    raise exception 'credential creation is not allowed' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_community_id::text || ':' || p_credential_type, 0)
  );

  if exists (
    select 1
    from public.access_credentials as credential
    join public.invitations as invitation on invitation.id = credential.invitation_id
    where invitation.community_id = p_community_id
      and credential.credential_type = p_credential_type
      and public.credential_matches(
        p_credential_value, credential.credential_hash,
        credential.legacy_fallback_hash, credential.credential_value, credential.qr_payload
      )
  ) or exists (
    select 1
    from public.event_credentials as credential
    join public.resident_events as resident_event on resident_event.id = credential.event_id
    where resident_event.community_id = p_community_id
      and credential.credential_type = p_credential_type
      and public.credential_matches(
        p_credential_value, credential.credential_hash,
        credential.legacy_fallback_hash, credential.credential_value, credential.qr_payload
      )
  ) then
    raise exception 'credential collision' using errcode = '23505';
  end if;

  insert into public.event_credentials (
    event_id, credential_type, credential_value, qr_payload,
    credential_hash, credential_audit_id, credential_version
  ) values (
    p_event_id, p_credential_type, null, null,
    crypt(p_credential_value, gen_salt('bf', 10)), v_audit_id, 2
  ) returning id into v_credential_id;

  insert into public.credential_secrets (event_credential_id, secret_value)
  values (v_credential_id, p_credential_value);

  return v_audit_id;
end;
$$;

revoke all on function public.store_invitation_credential(uuid, uuid, text, text) from public;
revoke all on function public.store_event_credential(uuid, uuid, text, text) from public;
grant execute on function public.store_invitation_credential(uuid, uuid, text, text) to authenticated;
grant execute on function public.store_event_credential(uuid, uuid, text, text) to authenticated;

-- New clients cannot downgrade to a recoverable credential in the RLS-visible tables.
revoke insert, update on table public.access_credentials from authenticated;
revoke insert, update on table public.event_credentials from authenticated;

create or replace function public.get_invitation_credential(p_invitation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = 'pg_catalog', 'extensions', 'public'
as $$
  select pg_catalog.jsonb_build_object(
    'credential_type', credential.credential_type,
    'credential_value', case
      when credential.credential_type = 'pin'
        then coalesce(secret.secret_value, credential.credential_value)
      else coalesce(secret.secret_value, credential.qr_payload, credential.credential_value)
    end,
    'qr_payload', case
      when credential.credential_type = 'qr'
        then coalesce(secret.secret_value, credential.qr_payload, credential.credential_value)
      else null
    end
  )
  from public.access_credentials as credential
  join public.invitations as invitation on invitation.id = credential.invitation_id
  left join public.credential_secrets as secret
    on secret.access_credential_id = credential.id
  where invitation.id = p_invitation_id
    and (
      public.has_active_community_role(invitation.community_id, array['admin'])
      or invitation.resident_id = public.current_community_resident_id(invitation.community_id)
    )
  limit 1;
$$;

create or replace function public.get_event_credential(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = 'pg_catalog', 'extensions', 'public'
as $$
  select pg_catalog.jsonb_build_object(
    'credential_type', credential.credential_type,
    'credential_value', case
      when credential.credential_type = 'pin'
        then coalesce(secret.secret_value, credential.credential_value)
      else coalesce(secret.secret_value, credential.qr_payload, credential.credential_value)
    end,
    'qr_payload', case
      when credential.credential_type = 'qr'
        then coalesce(secret.secret_value, credential.qr_payload, credential.credential_value)
      else null
    end
  )
  from public.event_credentials as credential
  join public.resident_events as resident_event on resident_event.id = credential.event_id
  left join public.credential_secrets as secret
    on secret.event_credential_id = credential.id
  where resident_event.id = p_event_id
    and (
      public.has_active_community_role(resident_event.community_id, array['admin'])
      or resident_event.resident_id = public.current_community_resident_id(resident_event.community_id)
    )
  limit 1;
$$;

revoke all on function public.get_invitation_credential(uuid) from public;
revoke all on function public.get_event_credential(uuid) from public;
grant execute on function public.get_invitation_credential(uuid) to authenticated;
grant execute on function public.get_event_credential(uuid) to authenticated;

create or replace function public.get_public_invitation(p_share_token text)
returns jsonb
language sql
stable
security definer
set search_path = 'pg_catalog', 'extensions', 'public'
as $$
  select pg_catalog.jsonb_build_object(
    'visitor_name', invitation.visitor_name,
    'access_type', invitation.access_type,
    'visit_date', invitation.visit_date,
    'window_start', invitation.window_start,
    'window_end', invitation.window_end,
    'window_end_date', invitation.window_end_date,
    'no_time_limit', invitation.no_time_limit,
    'status', invitation.status,
    'resident_name', resident.full_name,
    'unit_identifier', unit_record.identifier,
    'unit_building', unit_record.building,
    'credential_type', credential.credential_type,
    'credential_value', case
      when credential.credential_type = 'pin'
        then coalesce(secret.secret_value, credential.credential_value)
      else coalesce(secret.secret_value, credential.qr_payload, credential.credential_value)
    end,
    'qr_payload', case
      when credential.credential_type = 'qr'
        then coalesce(secret.secret_value, credential.qr_payload, credential.credential_value)
      else null
    end
  )
  from public.invitations as invitation
  join public.residents as resident on resident.id = invitation.resident_id
  left join public.units as unit_record on unit_record.id = invitation.unit_id
  left join public.access_credentials as credential on credential.invitation_id = invitation.id
  left join public.credential_secrets as secret on secret.access_credential_id = credential.id
  where invitation.share_token = p_share_token
  limit 1;
$$;

create or replace function public.get_public_event(p_share_token text)
returns jsonb
language sql
stable
security definer
set search_path = 'pg_catalog', 'extensions', 'public'
as $$
  select pg_catalog.jsonb_build_object(
    'name', resident_event.name,
    'event_date', resident_event.event_date,
    'window_start', resident_event.window_start,
    'window_end_date', resident_event.window_end_date,
    'window_end', resident_event.window_end,
    'status', resident_event.status,
    'resident_name', resident.full_name,
    'unit_identifier', unit_record.identifier,
    'credential_type', credential.credential_type,
    'credential_value', case
      when credential.credential_type = 'pin'
        then coalesce(secret.secret_value, credential.credential_value)
      else coalesce(secret.secret_value, credential.qr_payload, credential.credential_value)
    end,
    'qr_payload', case
      when credential.credential_type = 'qr'
        then coalesce(secret.secret_value, credential.qr_payload, credential.credential_value)
      else null
    end,
    'guest_count', (
      select count(*) from public.event_guests as guest
      where guest.event_id = resident_event.id
    )
  )
  from public.resident_events as resident_event
  join public.residents as resident on resident.id = resident_event.resident_id
  left join public.units as unit_record on unit_record.id = resident_event.unit_id
  left join public.event_credentials as credential on credential.event_id = resident_event.id
  left join public.credential_secrets as secret on secret.event_credential_id = credential.id
  where resident_event.share_token = p_share_token
  limit 1;
$$;

revoke all on function public.get_public_invitation(text) from public;
revoke all on function public.get_public_event(text) from public;
grant execute on function public.get_public_invitation(text) to anon, authenticated;
grant execute on function public.get_public_event(text) to anon, authenticated;

-- Legacy match RPCs have no rate limiting. Keep their definitions for rollback
-- compatibility, but remove client execution after the new validator exists.
revoke execute on function public.match_invitation_credential(uuid, text, text) from authenticated;
revoke execute on function public.match_event_credential(uuid, text, text) from authenticated;

create or replace function public.validate_access_credential(
  p_community_id uuid,
  p_credential_type text,
  p_credential_value text,
  p_device_id text,
  p_origin text
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'extensions', 'public'
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_email text := lower(auth.jwt() ->> 'email');
  v_device_hash bytea;
  v_origin_hash bytea;
  v_limit public.credential_rate_limits%rowtype;
  v_invitation public.invitations%rowtype;
  v_event public.resident_events%rowtype;
  v_audit_id text;
  v_attempt_id text := 'attempt_' || encode(gen_random_bytes(8), 'hex');
  v_time_zone text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_status text;
  v_failure_count integer;
  v_retry_after integer;
  v_resource_id uuid;
begin
  if v_actor_user_id is null or v_email is null or not public.has_active_community_role(
    p_community_id, array['admin', 'guard']
  ) then
    raise exception 'credential validation is not allowed' using errcode = '42501';
  end if;
  if p_credential_type not in ('pin', 'qr')
     or p_credential_value is null
     or p_device_id is null
     or p_origin is null
     or length(p_credential_value) not between 3 and 512
     or length(p_device_id) not between 16 and 256
     or length(p_origin) not between 1 and 256 then
    raise exception 'invalid credential validation request' using errcode = '22023';
  end if;

  v_device_hash := digest(p_device_id, 'sha256');
  v_origin_hash := digest(p_origin, 'sha256');

  insert into public.credential_rate_limits (
    community_id, actor_user_id, device_hash, origin_hash
  ) values (
    p_community_id, v_actor_user_id, v_device_hash, v_origin_hash
  ) on conflict do nothing;

  select * into v_limit
  from public.credential_rate_limits
  where community_id = p_community_id
    and actor_user_id = v_actor_user_id
    and device_hash = v_device_hash
    and origin_hash = v_origin_hash
  for update;

  if v_limit.blocked_until is not null and v_limit.blocked_until > now() then
    v_retry_after := greatest(1, ceil(extract(epoch from (v_limit.blocked_until - now())))::integer);
    update public.credential_rate_limits
    set last_attempt_at = now()
    where community_id = p_community_id
      and actor_user_id = v_actor_user_id
      and device_hash = v_device_hash
      and origin_hash = v_origin_hash;
    insert into public.access_events (
      community_id, access_event_type, event_status, event_direction, event_source,
      event_label, validated_by_email, details, created_by_email
    ) values (
      p_community_id, 'validation_failed', 'rejected', 'validation', 'validation',
      'Validacion bloqueada temporalmente', v_email,
      pg_catalog.jsonb_build_object(
        'credentialType', p_credential_type,
        'credentialRef', v_attempt_id,
        'result', 'rate_limited'
      ),
      v_email
    );
    return pg_catalog.jsonb_build_object(
      'rateLimited', true,
      'retryAfterSeconds', v_retry_after,
      'credentialRef', v_attempt_id,
      'status', 'rate_limited'
    );
  end if;

  if v_limit.window_started_at < now() - interval '10 minutes' then
    update public.credential_rate_limits
    set window_started_at = now(), failure_count = 0, blocked_until = null
    where community_id = p_community_id
      and actor_user_id = v_actor_user_id
      and device_hash = v_device_hash
      and origin_hash = v_origin_hash;
    v_limit.failure_count := 0;
  end if;

  select invitation.id, credential.credential_audit_id
  into v_resource_id, v_audit_id
  from public.access_credentials as credential
  join public.invitations as invitation on invitation.id = credential.invitation_id
  where invitation.community_id = p_community_id
    and credential.credential_type = p_credential_type
    and public.credential_matches(
      p_credential_value, credential.credential_hash,
      credential.legacy_fallback_hash, credential.credential_value, credential.qr_payload
    )
  order by credential.credential_version desc, credential.created_at desc
  limit 1;

  if found then
    select * into v_invitation
    from public.invitations where id = v_resource_id;
    select time_zone into v_time_zone
    from public.communities where id = p_community_id;
    v_start_at := (v_invitation.visit_date + v_invitation.window_start) at time zone v_time_zone;
    v_end_at := (
      coalesce(v_invitation.window_end_date, v_invitation.visit_date) + v_invitation.window_end
    ) at time zone v_time_zone;
    v_status := case
      when v_invitation.status in ('revoked', 'used') then v_invitation.status
      when now() < v_start_at then 'scheduled'
      when not v_invitation.no_time_limit and now() > v_end_at then 'expired'
      else 'active'
    end;

    if v_status = 'active' then
      update public.credential_rate_limits
      set failure_count = 0, window_started_at = now(), blocked_until = null, last_attempt_at = now()
      where community_id = p_community_id
        and actor_user_id = v_actor_user_id
        and device_hash = v_device_hash
        and origin_hash = v_origin_hash;
    else
      -- A known but unusable credential must not reset the guessing budget.
      -- Otherwise an old/revoked code can be alternated with guesses forever.
      v_failure_count := v_limit.failure_count + 1;
      update public.credential_rate_limits
      set failure_count = v_failure_count,
          blocked_until = case when v_failure_count >= 5 then now() + interval '15 minutes' else null end,
          last_attempt_at = now()
      where community_id = p_community_id
        and actor_user_id = v_actor_user_id
        and device_hash = v_device_hash
        and origin_hash = v_origin_hash;
    end if;

    insert into public.access_events (
      community_id, invitation_id, resident_id, unit_id, visitor_name, access_type,
      access_event_type, event_status, event_direction, event_source, event_label,
      validated_by_email, details, created_by_email
    ) values (
      p_community_id, v_invitation.id, v_invitation.resident_id, v_invitation.unit_id,
      v_invitation.visitor_name, v_invitation.access_type,
      case when v_status = 'active' then 'validation_success' else 'validation_failed' end,
      case when v_status = 'active' then 'validated' else 'rejected' end,
      'validation', 'invitation',
      case when v_status = 'active' then 'Validacion correcta' else 'Validacion rechazada' end,
      v_email,
      pg_catalog.jsonb_build_object(
        'credentialType', p_credential_type,
        'credentialRef', v_audit_id,
        'result', v_status
      ),
      v_email
    );

    return pg_catalog.jsonb_build_object(
      'rateLimited', case when v_status = 'active' then false else v_failure_count >= 5 end,
      'retryAfterSeconds', case when v_status <> 'active' and v_failure_count >= 5 then 900 else null end,
      'kind', 'invitation', 'resourceId', v_invitation.id,
      'status', v_status, 'credentialRef', v_audit_id
    );
  end if;

  select resident_event.id, credential.credential_audit_id
  into v_resource_id, v_audit_id
  from public.event_credentials as credential
  join public.resident_events as resident_event on resident_event.id = credential.event_id
  where resident_event.community_id = p_community_id
    and credential.credential_type = p_credential_type
    and public.credential_matches(
      p_credential_value, credential.credential_hash,
      credential.legacy_fallback_hash, credential.credential_value, credential.qr_payload
    )
  order by credential.credential_version desc, credential.created_at desc
  limit 1;

  if found then
    select * into v_event
    from public.resident_events where id = v_resource_id;
    select time_zone into v_time_zone
    from public.communities where id = p_community_id;
    v_start_at := (v_event.event_date + v_event.window_start) at time zone v_time_zone;
    v_end_at := (v_event.window_end_date + v_event.window_end) at time zone v_time_zone;
    v_status := case
      when v_event.status = 'revoked' then 'revoked'
      when now() < v_start_at then 'scheduled'
      when now() > v_end_at then 'expired'
      else 'active'
    end;

    if v_status = 'active' then
      update public.credential_rate_limits
      set failure_count = 0, window_started_at = now(), blocked_until = null, last_attempt_at = now()
      where community_id = p_community_id
        and actor_user_id = v_actor_user_id
        and device_hash = v_device_hash
        and origin_hash = v_origin_hash;
    else
      v_failure_count := v_limit.failure_count + 1;
      update public.credential_rate_limits
      set failure_count = v_failure_count,
          blocked_until = case when v_failure_count >= 5 then now() + interval '15 minutes' else null end,
          last_attempt_at = now()
      where community_id = p_community_id
        and actor_user_id = v_actor_user_id
        and device_hash = v_device_hash
        and origin_hash = v_origin_hash;
    end if;

    insert into public.access_events (
      community_id, event_id, resident_id, unit_id, visitor_name, access_type,
      access_event_type, event_status, event_direction, event_source, event_label,
      validated_by_email, details, created_by_email
    ) values (
      p_community_id, v_event.id, v_event.resident_id, v_event.unit_id,
      v_event.name, 'visitor',
      case when v_status = 'active' then 'validation_success' else 'validation_failed' end,
      case when v_status = 'active' then 'validated' else 'rejected' end,
      'validation', 'event',
      case when v_status = 'active' then 'Codigo de evento validado' else 'Validacion de evento rechazada' end,
      v_email,
      pg_catalog.jsonb_build_object(
        'credentialType', p_credential_type,
        'credentialRef', v_audit_id,
        'result', v_status
      ),
      v_email
    );

    return pg_catalog.jsonb_build_object(
      'rateLimited', case when v_status = 'active' then false else v_failure_count >= 5 end,
      'retryAfterSeconds', case when v_status <> 'active' and v_failure_count >= 5 then 900 else null end,
      'kind', 'event', 'resourceId', v_event.id,
      'status', v_status, 'credentialRef', v_audit_id
    );
  end if;

  v_failure_count := v_limit.failure_count + 1;
  update public.credential_rate_limits
  set failure_count = v_failure_count,
      blocked_until = case when v_failure_count >= 5 then now() + interval '15 minutes' else null end,
      last_attempt_at = now()
  where community_id = p_community_id
    and actor_user_id = v_actor_user_id
    and device_hash = v_device_hash
    and origin_hash = v_origin_hash;

  insert into public.access_events (
    community_id, access_event_type, event_status, event_direction, event_source,
    event_label, validated_by_email, details, created_by_email
  ) values (
    p_community_id, 'validation_failed', 'rejected', 'validation', 'validation',
    'Validacion fallida', v_email,
    pg_catalog.jsonb_build_object(
      'credentialType', p_credential_type,
      'credentialRef', v_attempt_id,
      'result', 'not_found'
    ),
    v_email
  );

  return pg_catalog.jsonb_build_object(
    'rateLimited', v_failure_count >= 5,
    'retryAfterSeconds', case when v_failure_count >= 5 then 900 else null end,
    'status', 'not_found', 'credentialRef', v_attempt_id
  );
end;
$$;

revoke all on function public.validate_access_credential(uuid, text, text, text, text) from public;
grant execute on function public.validate_access_credential(uuid, text, text, text, text) to authenticated;

create or replace function public.register_invitation_entry(
  p_community_id uuid,
  p_invitation_id uuid,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = 'pg_catalog', 'extensions', 'public'
as $$
declare
  v_invitation public.invitations%rowtype;
  v_existing public.visitor_entries%rowtype;
  v_entry_id uuid;
  v_email text := lower(auth.jwt() ->> 'email');
  v_time_zone text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_credential_ref text;
begin
  if v_email is null or not public.has_active_community_role(
    p_community_id, array['admin', 'guard']
  ) then
    raise exception 'entry registration is not allowed' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'idempotency key is required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_community_id::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_existing
  from public.visitor_entries
  where community_id = p_community_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.invitation_id is distinct from p_invitation_id then
      raise exception 'idempotency key was used for another operation' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  select invitation.*
  into v_invitation
  from public.invitations as invitation
  where invitation.id = p_invitation_id
    and invitation.community_id = p_community_id
  for update of invitation;

  if not found then
    raise exception 'invitation was not found' using errcode = 'P0002';
  end if;
  select time_zone into v_time_zone
  from public.communities where id = p_community_id;
  v_start_at := (v_invitation.visit_date + v_invitation.window_start) at time zone v_time_zone;
  v_end_at := (
    coalesce(v_invitation.window_end_date, v_invitation.visit_date) + v_invitation.window_end
  ) at time zone v_time_zone;
  if v_invitation.status <> 'active' then
    raise exception 'invitation is not active' using errcode = '55000';
  end if;
  if now() < v_start_at or (not v_invitation.no_time_limit and now() > v_end_at) then
    raise exception 'invitation is outside its access window' using errcode = '22023';
  end if;

  select credential_audit_id into v_credential_ref
  from public.access_credentials where invitation_id = v_invitation.id;

  insert into public.visitor_entries (
    community_id, invitation_id, resident_id, unit_id, visitor_name, access_type,
    registration_source, notes, created_by_email, idempotency_key
  ) values (
    p_community_id, v_invitation.id, v_invitation.resident_id, v_invitation.unit_id,
    coalesce(v_invitation.visitor_name, 'Visitante sin nombre'), v_invitation.access_type,
    'invitation', v_invitation.notes, v_email, p_idempotency_key
  ) returning id into v_entry_id;

  update public.invitations set status = 'used' where id = v_invitation.id;

  insert into public.invitation_events (invitation_id, event_type, event_label, payload)
  values (
    v_invitation.id, 'status_changed', 'Invitacion usada en garita',
    pg_catalog.jsonb_build_object('status', 'used', 'visitorEntryId', v_entry_id)
  );

  insert into public.access_events (
    community_id, invitation_id, visitor_entry_id, resident_id, unit_id,
    visitor_name, access_type, access_event_type, event_status, event_direction,
    event_source, event_label, validated_by_email, notes, details, created_by_email
  ) values (
    p_community_id, v_invitation.id, v_entry_id, v_invitation.resident_id,
    v_invitation.unit_id, coalesce(v_invitation.visitor_name, 'Visitante sin nombre'),
    v_invitation.access_type, 'entry_registered', 'entered', 'entry', 'invitation',
    'Entrada registrada', v_email, v_invitation.notes,
    pg_catalog.jsonb_build_object(
      'source', 'invitation', 'credentialRef', v_credential_ref,
      'result', 'entered', 'idempotencyKey', p_idempotency_key
    ),
    v_email
  );

  return v_entry_id;
end;
$$;

revoke execute on function public.register_invitation_entry(uuid, uuid) from authenticated;
revoke all on function public.register_invitation_entry(uuid, uuid, uuid) from public;
grant execute on function public.register_invitation_entry(uuid, uuid, uuid) to authenticated;

create or replace function public.register_event_guest_entry(
  p_community_id uuid,
  p_event_id uuid,
  p_event_guest_id uuid,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = 'pg_catalog', 'extensions', 'public'
as $$
declare
  v_event public.resident_events%rowtype;
  v_guest public.event_guests%rowtype;
  v_existing public.visitor_entries%rowtype;
  v_entry_id uuid;
  v_email text := lower(auth.jwt() ->> 'email');
  v_time_zone text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_credential_ref text;
begin
  if v_email is null or not public.has_active_community_role(
    p_community_id, array['admin', 'guard']
  ) then
    raise exception 'entry registration is not allowed' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'idempotency key is required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_community_id::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_existing
  from public.visitor_entries
  where community_id = p_community_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.event_id is distinct from p_event_id
       or v_existing.event_guest_id is distinct from p_event_guest_id then
      raise exception 'idempotency key was used for another operation' using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  select resident_event.*
  into v_event
  from public.resident_events as resident_event
  where resident_event.id = p_event_id
    and resident_event.community_id = p_community_id
  for update of resident_event;
  if not found then
    raise exception 'event was not found' using errcode = 'P0002';
  end if;
  select time_zone into v_time_zone
  from public.communities where id = p_community_id;

  select * into v_guest
  from public.event_guests
  where id = p_event_guest_id and event_id = p_event_id
  for update;
  if not found then
    raise exception 'event guest was not found' using errcode = 'P0002';
  end if;

  v_start_at := (v_event.event_date + v_event.window_start) at time zone v_time_zone;
  v_end_at := (v_event.window_end_date + v_event.window_end) at time zone v_time_zone;
  if v_event.status <> 'active' or now() < v_start_at or now() > v_end_at then
    raise exception 'event is outside its access window' using errcode = '22023';
  end if;
  if v_guest.attendance_status <> 'pending' then
    raise exception 'event guest was already registered' using errcode = '55000';
  end if;

  update public.event_guests
  set attendance_status = 'inside', checked_in_at = now()
  where id = v_guest.id;

  select credential_audit_id into v_credential_ref
  from public.event_credentials where event_id = v_event.id;

  insert into public.visitor_entries (
    community_id, event_id, event_guest_id, resident_id, unit_id, visitor_name,
    access_type, registration_source, notes, created_by_email, idempotency_key
  ) values (
    p_community_id, v_event.id, v_guest.id, v_event.resident_id, v_event.unit_id,
    v_guest.full_name, 'visitor', 'event', coalesce(v_guest.notes, v_event.notes),
    v_email, p_idempotency_key
  ) returning id into v_entry_id;

  insert into public.event_activity (event_id, activity_type, activity_label, payload)
  values (
    v_event.id, 'guest_checked_in', v_guest.full_name || ' ingreso',
    pg_catalog.jsonb_build_object('eventGuestId', v_guest.id, 'visitorEntryId', v_entry_id)
  );

  insert into public.access_events (
    community_id, event_id, event_guest_id, visitor_entry_id, resident_id, unit_id,
    visitor_name, access_type, access_event_type, event_status, event_direction,
    event_source, event_label, validated_by_email, notes, details, created_by_email
  ) values (
    p_community_id, v_event.id, v_guest.id, v_entry_id, v_event.resident_id,
    v_event.unit_id, v_guest.full_name, 'visitor', 'entry_registered', 'entered',
    'entry', 'event', 'Entrada de evento registrada', v_email,
    coalesce(v_guest.notes, v_event.notes),
    pg_catalog.jsonb_build_object(
      'source', 'event', 'credentialRef', v_credential_ref,
      'result', 'entered', 'idempotencyKey', p_idempotency_key
    ),
    v_email
  );

  return v_entry_id;
end;
$$;

revoke all on function public.register_event_guest_entry(uuid, uuid, uuid, uuid) from public;
grant execute on function public.register_event_guest_entry(uuid, uuid, uuid, uuid) to authenticated;

reset search_path;
