-- Authentication and tenant isolation hardening.
-- This migration intentionally does not modify historical migrations.

create index if not exists idx_memberships_auth_user_community_active
  on public.community_memberships (auth_user_id, community_id, is_active, role);

create or replace function public.has_active_community_role(
  p_community_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.community_memberships as membership
    where membership.community_id = p_community_id
      and membership.auth_user_id = auth.uid()
      and membership.is_active = true
      and (p_roles is null or membership.role = any (p_roles))
  );
$$;

create or replace function public.current_community_resident_id(p_community_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select membership.resident_id
  from public.community_memberships as membership
  where membership.community_id = p_community_id
    and membership.auth_user_id = auth.uid()
    and membership.is_active = true
    and membership.role = 'resident'
  limit 1;
$$;

create or replace function public.is_onboarding_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and auth.jwt() ->> 'email' is not null
    and auth.jwt() -> 'app_metadata' ->> 'can_create_community' = 'true'
    and not exists (
      select 1
      from public.community_memberships as membership
      where membership.auth_user_id = auth.uid()
    )
    and not exists (
      select 1
      from public.communities as community
      where lower(community.created_by_email) = lower(auth.jwt() ->> 'email')
    );
$$;

create or replace function public.can_manage_community_asset(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (storage.foldername(p_name))[1] = 'communities'
    and exists (
      select 1
      from public.community_memberships as membership
      where membership.community_id::text = (storage.foldername(p_name))[2]
        and membership.auth_user_id = auth.uid()
        and membership.is_active = true
        and membership.role = 'admin'
    )
  ) or (
    (storage.foldername(p_name))[1] = 'onboarding'
    and (storage.foldername(p_name))[2] = auth.uid()::text
    and (
      public.is_onboarding_user()
      or exists (
        select 1
        from public.community_memberships as membership
        where membership.auth_user_id = auth.uid()
          and membership.is_active = true
          and membership.role = 'admin'
      )
    )
  );
$$;

revoke all on function public.has_active_community_role(uuid, text[]) from public;
revoke all on function public.current_community_resident_id(uuid) from public;
revoke all on function public.is_onboarding_user() from public;
revoke all on function public.can_manage_community_asset(text) from public;
grant execute on function public.has_active_community_role(uuid, text[]) to authenticated;
grant execute on function public.current_community_resident_id(uuid) to authenticated;
grant execute on function public.is_onboarding_user() to authenticated;
grant execute on function public.can_manage_community_asset(text) to authenticated;

create or replace function public.claim_current_user_memberships()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_count integer;
begin
  if auth.uid() is null or v_email is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  update public.community_memberships
  set auth_user_id = auth.uid()
  where auth_user_id is null
    and lower(email) = v_email;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.claim_current_user_memberships() from public;
grant execute on function public.claim_current_user_memberships() to authenticated;

create or replace function public.match_invitation_credential(
  p_community_id uuid,
  p_credential_type text,
  p_credential_value text
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_invitation_id uuid;
begin
  if not public.has_active_community_role(
    p_community_id,
    array['admin', 'guard']
  ) then
    raise exception 'credential validation is not allowed' using errcode = '42501';
  end if;

  if p_credential_type not in ('pin', 'qr') then
    raise exception 'invalid credential type' using errcode = '22023';
  end if;

  select credential.invitation_id
  into v_invitation_id
  from public.access_credentials as credential
  join public.invitations as invitation on invitation.id = credential.invitation_id
  where invitation.community_id = p_community_id
    and credential.credential_type = p_credential_type
    and (
      (p_credential_type = 'pin' and credential.credential_value = p_credential_value)
      or (
        p_credential_type = 'qr'
        and (
          credential.qr_payload = p_credential_value
          or credential.credential_value = p_credential_value
        )
      )
    )
  limit 1;

  return v_invitation_id;
end;
$$;

create or replace function public.match_event_credential(
  p_community_id uuid,
  p_credential_type text,
  p_credential_value text
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  if not public.has_active_community_role(
    p_community_id,
    array['admin', 'guard']
  ) then
    raise exception 'credential validation is not allowed' using errcode = '42501';
  end if;

  if p_credential_type not in ('pin', 'qr') then
    raise exception 'invalid credential type' using errcode = '22023';
  end if;

  select credential.event_id
  into v_event_id
  from public.event_credentials as credential
  join public.resident_events as resident_event on resident_event.id = credential.event_id
  where resident_event.community_id = p_community_id
    and credential.credential_type = p_credential_type
    and (
      (p_credential_type = 'pin' and credential.credential_value = p_credential_value)
      or (
        p_credential_type = 'qr'
        and (
          credential.qr_payload = p_credential_value
          or credential.credential_value = p_credential_value
        )
      )
    )
  limit 1;

  return v_event_id;
end;
$$;

revoke all on function public.match_invitation_credential(uuid, text, text) from public;
revoke all on function public.match_event_credential(uuid, text, text) from public;
grant execute on function public.match_invitation_credential(uuid, text, text) to authenticated;
grant execute on function public.match_event_credential(uuid, text, text) to authenticated;

create or replace function public.register_invitation_entry(
  p_community_id uuid,
  p_invitation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations%rowtype;
  v_entry_id uuid;
  v_email text := lower(auth.jwt() ->> 'email');
begin
  if v_email is null or not public.has_active_community_role(
    p_community_id,
    array['admin', 'guard']
  ) then
    raise exception 'entry registration is not allowed' using errcode = '42501';
  end if;

  select invitation.*
  into v_invitation
  from public.invitations as invitation
  where invitation.id = p_invitation_id
    and invitation.community_id = p_community_id
  for update;

  if not found then
    raise exception 'invitation was not found' using errcode = 'P0002';
  end if;

  if v_invitation.status <> 'active' then
    raise exception 'invitation was already consumed' using errcode = '55000';
  end if;

  insert into public.visitor_entries (
    community_id,
    invitation_id,
    resident_id,
    unit_id,
    visitor_name,
    access_type,
    registration_source,
    notes,
    created_by_email
  ) values (
    p_community_id,
    v_invitation.id,
    v_invitation.resident_id,
    v_invitation.unit_id,
    coalesce(v_invitation.visitor_name, 'Visitante sin nombre'),
    v_invitation.access_type,
    'invitation',
    v_invitation.notes,
    v_email
  )
  returning id into v_entry_id;

  update public.invitations
  set status = 'used'
  where id = v_invitation.id;

  insert into public.invitation_events (
    invitation_id,
    event_type,
    event_label,
    payload
  ) values (
    v_invitation.id,
    'status_changed',
    'Invitacion usada en garita',
    jsonb_build_object('status', 'used', 'visitorEntryId', v_entry_id)
  );

  insert into public.access_events (
    community_id,
    invitation_id,
    visitor_entry_id,
    resident_id,
    unit_id,
    visitor_name,
    access_type,
    access_event_type,
    event_status,
    event_direction,
    event_source,
    event_label,
    validated_by_email,
    notes,
    details,
    created_by_email
  ) values (
    p_community_id,
    v_invitation.id,
    v_entry_id,
    v_invitation.resident_id,
    v_invitation.unit_id,
    coalesce(v_invitation.visitor_name, 'Visitante sin nombre'),
    v_invitation.access_type,
    'entry_registered',
    'entered',
    'entry',
    'invitation',
    'Entrada registrada',
    v_email,
    v_invitation.notes,
    jsonb_build_object(
      'source', 'invitation',
      'visitorName', coalesce(v_invitation.visitor_name, 'Visitante sin nombre')
    ),
    v_email
  );

  return v_entry_id;
end;
$$;

revoke all on function public.register_invitation_entry(uuid, uuid) from public;
grant execute on function public.register_invitation_entry(uuid, uuid) to authenticated;

create or replace function public.create_community_onboarding(
  p_name text,
  p_address text,
  p_location_label text,
  p_planned_unit_count integer,
  p_access_policy_mode text,
  p_access_policy_notes text,
  p_gate_operation_mode text,
  p_gate_operation_notes text,
  p_admin_contact_name text,
  p_admin_contact_phone text,
  p_admin_contact_email text,
  p_logo_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(auth.jwt() ->> 'email');
  v_full_name text := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(p_admin_contact_name, ''),
    v_email
  );
  v_community public.communities;
begin
  if v_user_id is null or v_email is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  if not public.is_onboarding_user() then
    raise exception 'onboarding is not allowed for this user' using errcode = '42501';
  end if;

  if p_planned_unit_count not between 1 and 5000 then
    raise exception 'planned unit count must be between 1 and 5000'
      using errcode = '22023';
  end if;

  if nullif(btrim(p_name), '') is null
     or nullif(btrim(p_address), '') is null
     or nullif(btrim(p_location_label), '') is null
     or nullif(btrim(p_admin_contact_name), '') is null
     or nullif(btrim(p_admin_contact_phone), '') is null then
    raise exception 'required onboarding fields cannot be blank'
      using errcode = '22023';
  end if;

  insert into public.communities (
    name,
    address,
    location_label,
    planned_unit_count,
    access_policy_mode,
    access_policy_notes,
    gate_operation_mode,
    gate_operation_notes,
    admin_contact_name,
    admin_contact_phone,
    admin_contact_email,
    logo_url,
    created_by_email,
    onboarding_completed_at
  )
  values (
    p_name,
    p_address,
    p_location_label,
    p_planned_unit_count,
    p_access_policy_mode,
    p_access_policy_notes,
    p_gate_operation_mode,
    p_gate_operation_notes,
    p_admin_contact_name,
    p_admin_contact_phone,
    p_admin_contact_email,
    p_logo_url,
    v_email,
    now()
  )
  returning * into v_community;

  insert into public.community_memberships (
    community_id,
    email,
    full_name,
    phone,
    role,
    auth_user_id,
    resident_id,
    is_primary,
    is_active,
    notes
  )
  values (
    v_community.id,
    v_email,
    v_full_name,
    p_admin_contact_phone,
    'admin',
    v_user_id,
    null,
    true,
    true,
    'Administrador principal creado desde onboarding.'
  );

  insert into public.units (community_id, identifier, building, is_active)
  select
    v_community.id,
    lpad(unit_number::text, 3, '0'),
    null,
    true
  from generate_series(1, p_planned_unit_count) as unit_number;

  return to_jsonb(v_community);
end;
$$;

create or replace function public.restrict_guard_invitation_updates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.has_active_community_role(old.community_id, array['admin']) then
    return new;
  end if;

  if public.has_active_community_role(old.community_id, array['guard']) then
    if (to_jsonb(new) - array['status', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['status', 'updated_at'])
       or old.status <> 'active'
       or new.status <> 'used' then
      raise exception 'guards may only mark active invitations as used'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.restrict_guard_event_guest_updates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_community_id uuid;
begin
  select resident_event.community_id
  into v_community_id
  from public.resident_events as resident_event
  where resident_event.id = old.event_id;

  if public.has_active_community_role(v_community_id, array['admin']) then
    return new;
  end if;

  if public.has_active_community_role(v_community_id, array['guard']) then
    if (to_jsonb(new) - array[
      'attendance_status',
      'checked_in_at',
      'checked_out_at',
      'updated_at'
    ]) is distinct from (to_jsonb(old) - array[
      'attendance_status',
      'checked_in_at',
      'checked_out_at',
      'updated_at'
    ]) then
      raise exception 'guards may only update guest attendance'
        using errcode = '42501';
    end if;

    if not (
      (old.attendance_status = 'pending'
        and new.attendance_status = 'inside'
        and new.checked_in_at is not null
        and new.checked_out_at is null)
      or (old.attendance_status = 'inside'
        and new.attendance_status = 'exited'
        and new.checked_out_at is not null)
      or (old.attendance_status = 'inside'
        and new.attendance_status = 'pending'
        and new.checked_in_at is null
        and new.checked_out_at is null)
    ) then
      raise exception 'invalid guard attendance transition'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.restrict_guard_visitor_entry_updates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.has_active_community_role(old.community_id, array['admin']) then
    return new;
  end if;

  if public.has_active_community_role(old.community_id, array['guard']) then
    if (to_jsonb(new) - array['entry_status', 'exited_at', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['entry_status', 'exited_at', 'updated_at'])
       or old.entry_status <> 'inside'
       or new.entry_status <> 'exited'
       or new.exited_at is null then
      raise exception 'guards may only register an exit for an inside entry'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_tenant_reference_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_community_id uuid := (v_row ->> 'community_id')::uuid;
begin
  if v_community_id is null then
    raise exception 'community_id is required for tenant integrity'
      using errcode = '23514';
  end if;

  if v_row ? 'resident_id'
     and v_row ->> 'resident_id' is not null
     and not exists (
       select 1 from public.residents as resident
       where resident.id = (v_row ->> 'resident_id')::uuid
         and resident.community_id = v_community_id
     ) then
    raise exception 'resident belongs to another community' using errcode = '23514';
  end if;

  if v_row ? 'unit_id'
     and v_row ->> 'unit_id' is not null
     and not exists (
       select 1 from public.units as unit_record
       where unit_record.id = (v_row ->> 'unit_id')::uuid
         and unit_record.community_id = v_community_id
     ) then
    raise exception 'unit belongs to another community' using errcode = '23514';
  end if;

  if v_row ? 'invitation_id'
     and v_row ->> 'invitation_id' is not null
     and not exists (
       select 1 from public.invitations as invitation
       where invitation.id = (v_row ->> 'invitation_id')::uuid
         and invitation.community_id = v_community_id
     ) then
    raise exception 'invitation belongs to another community' using errcode = '23514';
  end if;

  if v_row ? 'event_id'
     and v_row ->> 'event_id' is not null
     and not exists (
       select 1 from public.resident_events as resident_event
       where resident_event.id = (v_row ->> 'event_id')::uuid
         and resident_event.community_id = v_community_id
     ) then
    raise exception 'event belongs to another community' using errcode = '23514';
  end if;

  if v_row ? 'event_guest_id'
     and v_row ->> 'event_guest_id' is not null
     and not exists (
       select 1
       from public.event_guests as event_guest
       join public.resident_events as resident_event on resident_event.id = event_guest.event_id
       where event_guest.id = (v_row ->> 'event_guest_id')::uuid
         and resident_event.community_id = v_community_id
     ) then
    raise exception 'event guest belongs to another community' using errcode = '23514';
  end if;

  if v_row ? 'visitor_entry_id'
     and v_row ->> 'visitor_entry_id' is not null
     and not exists (
       select 1 from public.visitor_entries as visitor_entry
       where visitor_entry.id = (v_row ->> 'visitor_entry_id')::uuid
         and visitor_entry.community_id = v_community_id
     ) then
    raise exception 'visitor entry belongs to another community' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.restrict_guard_invitation_updates() from public;
revoke all on function public.restrict_guard_event_guest_updates() from public;
revoke all on function public.restrict_guard_visitor_entry_updates() from public;
revoke all on function public.enforce_tenant_reference_integrity() from public;

drop trigger if exists enforce_membership_tenant_references on public.community_memberships;
create trigger enforce_membership_tenant_references
before insert or update on public.community_memberships
for each row execute function public.enforce_tenant_reference_integrity();

drop trigger if exists enforce_resident_tenant_references on public.residents;
create trigger enforce_resident_tenant_references
before insert or update on public.residents
for each row execute function public.enforce_tenant_reference_integrity();

drop trigger if exists enforce_invitation_tenant_references on public.invitations;
create trigger enforce_invitation_tenant_references
before insert or update on public.invitations
for each row execute function public.enforce_tenant_reference_integrity();

drop trigger if exists enforce_visitor_entry_tenant_references on public.visitor_entries;
create trigger enforce_visitor_entry_tenant_references
before insert or update on public.visitor_entries
for each row execute function public.enforce_tenant_reference_integrity();

drop trigger if exists enforce_access_event_tenant_references on public.access_events;
create trigger enforce_access_event_tenant_references
before insert or update on public.access_events
for each row execute function public.enforce_tenant_reference_integrity();

drop trigger if exists enforce_resident_event_tenant_references on public.resident_events;
create trigger enforce_resident_event_tenant_references
before insert or update on public.resident_events
for each row execute function public.enforce_tenant_reference_integrity();

drop trigger if exists restrict_guard_invitation_updates on public.invitations;
create trigger restrict_guard_invitation_updates
before update on public.invitations
for each row execute function public.restrict_guard_invitation_updates();

drop trigger if exists restrict_guard_event_guest_updates on public.event_guests;
create trigger restrict_guard_event_guest_updates
before update on public.event_guests
for each row execute function public.restrict_guard_event_guest_updates();

drop trigger if exists restrict_guard_visitor_entry_updates on public.visitor_entries;
create trigger restrict_guard_visitor_entry_updates
before update on public.visitor_entries
for each row execute function public.restrict_guard_visitor_entry_updates();

revoke all on function public.create_community_onboarding(
  text, text, text, integer, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.create_community_onboarding(
  text, text, text, integer, text, text, text, text, text, text, text, text
) to authenticated;

create or replace function public.get_public_invitation(p_share_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
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
    'credential_value', credential.credential_value,
    'qr_payload', credential.qr_payload
  )
  from public.invitations as invitation
  join public.residents as resident on resident.id = invitation.resident_id
  left join public.units as unit_record on unit_record.id = invitation.unit_id
  left join public.access_credentials as credential
    on credential.invitation_id = invitation.id
  where invitation.share_token = p_share_token
  limit 1;
$$;

create or replace function public.get_public_event(p_share_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', resident_event.name,
    'event_date', resident_event.event_date,
    'window_start', resident_event.window_start,
    'window_end_date', resident_event.window_end_date,
    'window_end', resident_event.window_end,
    'status', resident_event.status,
    'resident_name', resident.full_name,
    'unit_identifier', unit_record.identifier,
    'credential_type', credential.credential_type,
    'credential_value', credential.credential_value,
    'qr_payload', credential.qr_payload,
    'guest_count', (
      select count(*)
      from public.event_guests as guest
      where guest.event_id = resident_event.id
    )
  )
  from public.resident_events as resident_event
  join public.residents as resident on resident.id = resident_event.resident_id
  left join public.units as unit_record on unit_record.id = resident_event.unit_id
  left join public.event_credentials as credential
    on credential.event_id = resident_event.id
  where resident_event.share_token = p_share_token
  limit 1;
$$;

revoke all on function public.get_public_invitation(text) from public;
revoke all on function public.get_public_event(text) from public;
grant execute on function public.get_public_invitation(text) to anon, authenticated;
grant execute on function public.get_public_event(text) to anon, authenticated;

revoke all on table
  public.communities,
  public.community_memberships,
  public.units,
  public.residents,
  public.invitations,
  public.access_credentials,
  public.invitation_events,
  public.visitor_entries,
  public.access_events,
  public.resident_events,
  public.event_guests,
  public.event_credentials,
  public.event_activity
from anon;

grant select, insert, update, delete on table
  public.communities,
  public.community_memberships,
  public.units,
  public.residents,
  public.invitations,
  public.access_credentials,
  public.invitation_events,
  public.visitor_entries,
  public.access_events,
  public.resident_events,
  public.event_guests,
  public.event_credentials,
  public.event_activity
to authenticated;

alter table public.communities enable row level security;
alter table public.community_memberships enable row level security;
alter table public.units enable row level security;
alter table public.residents enable row level security;
alter table public.invitations enable row level security;
alter table public.access_credentials enable row level security;
alter table public.invitation_events enable row level security;
alter table public.visitor_entries enable row level security;
alter table public.access_events enable row level security;
alter table public.resident_events enable row level security;
alter table public.event_guests enable row level security;
alter table public.event_credentials enable row level security;
alter table public.event_activity enable row level security;

create policy communities_select_member on public.communities
  for select to authenticated
  using (public.has_active_community_role(id, null));
create policy communities_update_admin on public.communities
  for update to authenticated
  using (public.has_active_community_role(id, array['admin']))
  with check (public.has_active_community_role(id, array['admin']));

create policy memberships_select_self_or_admin on public.community_memberships
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or public.has_active_community_role(community_id, array['admin'])
  );
create policy memberships_insert_admin on public.community_memberships
  for insert to authenticated
  with check (public.has_active_community_role(community_id, array['admin']));
create policy memberships_update_admin on public.community_memberships
  for update to authenticated
  using (public.has_active_community_role(community_id, array['admin']))
  with check (public.has_active_community_role(community_id, array['admin']));
create policy memberships_delete_admin on public.community_memberships
  for delete to authenticated
  using (public.has_active_community_role(community_id, array['admin']));

create policy units_select_member on public.units
  for select to authenticated
  using (public.has_active_community_role(community_id, null));
create policy units_insert_admin on public.units
  for insert to authenticated
  with check (public.has_active_community_role(community_id, array['admin']));
create policy units_update_admin on public.units
  for update to authenticated
  using (public.has_active_community_role(community_id, array['admin']))
  with check (public.has_active_community_role(community_id, array['admin']));
create policy units_delete_admin on public.units
  for delete to authenticated
  using (public.has_active_community_role(community_id, array['admin']));

create policy residents_select_scoped on public.residents
  for select to authenticated
  using (
    public.has_active_community_role(community_id, array['admin', 'guard'])
    or id = public.current_community_resident_id(community_id)
  );
create policy residents_insert_admin on public.residents
  for insert to authenticated
  with check (public.has_active_community_role(community_id, array['admin']));
create policy residents_update_admin on public.residents
  for update to authenticated
  using (public.has_active_community_role(community_id, array['admin']))
  with check (public.has_active_community_role(community_id, array['admin']));
create policy residents_delete_admin on public.residents
  for delete to authenticated
  using (public.has_active_community_role(community_id, array['admin']));

create policy invitations_select_scoped on public.invitations
  for select to authenticated
  using (
    public.has_active_community_role(community_id, array['admin', 'guard'])
    or resident_id = public.current_community_resident_id(community_id)
  );
create policy invitations_insert_scoped on public.invitations
  for insert to authenticated
  with check (
    public.has_active_community_role(community_id, array['admin'])
    or resident_id = public.current_community_resident_id(community_id)
  );
create policy invitations_update_scoped on public.invitations
  for update to authenticated
  using (
    public.has_active_community_role(community_id, array['admin', 'guard'])
    or resident_id = public.current_community_resident_id(community_id)
  )
  with check (
    public.has_active_community_role(community_id, array['admin', 'guard'])
    or resident_id = public.current_community_resident_id(community_id)
  );
create policy invitations_delete_owner on public.invitations
  for delete to authenticated
  using (
    public.has_active_community_role(community_id, array['admin'])
    or resident_id = public.current_community_resident_id(community_id)
  );

create policy access_credentials_select_scoped on public.access_credentials
  for select to authenticated
  using (exists (
    select 1 from public.invitations as invitation
    where invitation.id = invitation_id
      and (
        public.has_active_community_role(invitation.community_id, array['admin'])
        or invitation.resident_id = public.current_community_resident_id(invitation.community_id)
      )
  ));
create policy access_credentials_insert_owner on public.access_credentials
  for insert to authenticated
  with check (exists (
    select 1 from public.invitations as invitation
    where invitation.id = invitation_id
      and (
        public.has_active_community_role(invitation.community_id, array['admin'])
        or invitation.resident_id = public.current_community_resident_id(invitation.community_id)
      )
  ));
create policy access_credentials_delete_owner on public.access_credentials
  for delete to authenticated
  using (exists (
    select 1 from public.invitations as invitation
    where invitation.id = invitation_id
      and (
        public.has_active_community_role(invitation.community_id, array['admin'])
        or invitation.resident_id = public.current_community_resident_id(invitation.community_id)
      )
  ));

create policy invitation_events_select_owner on public.invitation_events
  for select to authenticated
  using (exists (
    select 1 from public.invitations as invitation
    where invitation.id = invitation_id
      and (
        public.has_active_community_role(invitation.community_id, array['admin'])
        or invitation.resident_id = public.current_community_resident_id(invitation.community_id)
      )
  ));
create policy invitation_events_insert_owner on public.invitation_events
  for insert to authenticated
  with check (exists (
    select 1 from public.invitations as invitation
    where invitation.id = invitation_id
      and (
        public.has_active_community_role(invitation.community_id, array['admin'])
        or invitation.resident_id = public.current_community_resident_id(invitation.community_id)
      )
  ));

create policy visitor_entries_select_scoped on public.visitor_entries
  for select to authenticated
  using (
    public.has_active_community_role(community_id, array['admin', 'guard'])
    or resident_id = public.current_community_resident_id(community_id)
  );
create policy visitor_entries_insert_gate on public.visitor_entries
  for insert to authenticated
  with check (public.has_active_community_role(community_id, array['admin', 'guard']));
create policy visitor_entries_update_gate on public.visitor_entries
  for update to authenticated
  using (public.has_active_community_role(community_id, array['admin', 'guard']))
  with check (public.has_active_community_role(community_id, array['admin', 'guard']));
create policy visitor_entries_delete_admin on public.visitor_entries
  for delete to authenticated
  using (public.has_active_community_role(community_id, array['admin']));

create policy access_events_select_scoped on public.access_events
  for select to authenticated
  using (
    public.has_active_community_role(community_id, array['admin', 'guard'])
    or resident_id = public.current_community_resident_id(community_id)
  );
create policy access_events_insert_gate on public.access_events
  for insert to authenticated
  with check (public.has_active_community_role(community_id, array['admin', 'guard']));
create policy access_events_update_admin on public.access_events
  for update to authenticated
  using (public.has_active_community_role(community_id, array['admin']))
  with check (public.has_active_community_role(community_id, array['admin']));
create policy access_events_delete_admin on public.access_events
  for delete to authenticated
  using (public.has_active_community_role(community_id, array['admin']));

create policy resident_events_select_scoped on public.resident_events
  for select to authenticated
  using (
    public.has_active_community_role(community_id, array['admin', 'guard'])
    or resident_id = public.current_community_resident_id(community_id)
  );
create policy resident_events_insert_owner on public.resident_events
  for insert to authenticated
  with check (
    public.has_active_community_role(community_id, array['admin'])
    or resident_id = public.current_community_resident_id(community_id)
  );
create policy resident_events_update_owner on public.resident_events
  for update to authenticated
  using (
    public.has_active_community_role(community_id, array['admin'])
    or resident_id = public.current_community_resident_id(community_id)
  )
  with check (
    public.has_active_community_role(community_id, array['admin'])
    or resident_id = public.current_community_resident_id(community_id)
  );
create policy resident_events_delete_owner on public.resident_events
  for delete to authenticated
  using (
    public.has_active_community_role(community_id, array['admin'])
    or resident_id = public.current_community_resident_id(community_id)
  );

create policy event_guests_select_scoped on public.event_guests
  for select to authenticated
  using (exists (
    select 1 from public.resident_events as resident_event
    where resident_event.id = event_id
  ));
create policy event_guests_insert_owner on public.event_guests
  for insert to authenticated
  with check (exists (
    select 1 from public.resident_events as resident_event
    where resident_event.id = event_id
      and (
        public.has_active_community_role(resident_event.community_id, array['admin'])
        or resident_event.resident_id = public.current_community_resident_id(resident_event.community_id)
      )
  ));
create policy event_guests_update_scoped on public.event_guests
  for update to authenticated
  using (exists (
    select 1 from public.resident_events as resident_event
    where resident_event.id = event_id
  ))
  with check (exists (
    select 1 from public.resident_events as resident_event
    where resident_event.id = event_id
  ));
create policy event_guests_delete_owner on public.event_guests
  for delete to authenticated
  using (exists (
    select 1 from public.resident_events as resident_event
    where resident_event.id = event_id
      and (
        public.has_active_community_role(resident_event.community_id, array['admin'])
        or resident_event.resident_id = public.current_community_resident_id(resident_event.community_id)
      )
  ));

create policy event_credentials_select_scoped on public.event_credentials
  for select to authenticated
  using (exists (
    select 1 from public.resident_events as resident_event
    where resident_event.id = event_id
      and (
        public.has_active_community_role(resident_event.community_id, array['admin'])
        or resident_event.resident_id = public.current_community_resident_id(resident_event.community_id)
      )
  ));
create policy event_credentials_insert_owner on public.event_credentials
  for insert to authenticated
  with check (exists (
    select 1 from public.resident_events as resident_event
    where resident_event.id = event_id
      and (
        public.has_active_community_role(resident_event.community_id, array['admin'])
        or resident_event.resident_id = public.current_community_resident_id(resident_event.community_id)
      )
  ));
create policy event_credentials_delete_owner on public.event_credentials
  for delete to authenticated
  using (exists (
    select 1 from public.resident_events as resident_event
    where resident_event.id = event_id
      and (
        public.has_active_community_role(resident_event.community_id, array['admin'])
        or resident_event.resident_id = public.current_community_resident_id(resident_event.community_id)
      )
  ));

create policy event_activity_select_scoped on public.event_activity
  for select to authenticated
  using (exists (
    select 1 from public.resident_events as resident_event
    where resident_event.id = event_id
  ));
create policy event_activity_insert_scoped on public.event_activity
  for insert to authenticated
  with check (exists (
    select 1 from public.resident_events as resident_event
    where resident_event.id = event_id
  ));

-- Supabase enables RLS on storage.objects. The policies below scope writes to
-- this application's bucket without changing ownership of the managed table.

create policy community_assets_insert_scoped on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community-assets'
    and public.can_manage_community_asset(name)
  );

create policy community_assets_update_scoped on storage.objects
  for update to authenticated
  using (
    bucket_id = 'community-assets'
    and public.can_manage_community_asset(name)
  )
  with check (
    bucket_id = 'community-assets'
    and public.can_manage_community_asset(name)
  );

create policy community_assets_delete_scoped on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community-assets'
    and public.can_manage_community_asset(name)
  );
