alter table public.invitations
  add column creation_idempotency_key uuid,
  add column creation_request_fingerprint bytea,
  add constraint invitations_creation_idempotency_pair_check check (
    (creation_idempotency_key is null) = (creation_request_fingerprint is null)
  );

create unique index invitations_individual_creation_idempotency_idx
  on public.invitations (community_id, resident_id, creation_idempotency_key)
  where group_id is null and creation_idempotency_key is not null;

create or replace function public.create_individual_invitation(
  p_community_id uuid,
  p_resident_id uuid,
  p_resident_contact_id uuid,
  p_visitor_name text,
  p_visitor_phone text,
  p_access_type text,
  p_visit_date date,
  p_window_start time,
  p_window_end_date date,
  p_window_end time,
  p_no_time_limit boolean,
  p_notes text,
  p_credential_type text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = 'pg_catalog', 'extensions', 'public'
as $$
declare
  v_resident public.residents%rowtype;
  v_invitation_id uuid;
  v_existing_fingerprint bytea;
  v_request_fingerprint bytea;
  v_secret text;
  v_bytes bytea;
  v_attempt integer;
begin
  if not (
    public.has_active_community_role(p_community_id, array['admin'])
    or p_resident_id = public.current_community_resident_id(p_community_id)
  ) then
    raise exception 'invitation creation is not allowed' using errcode = '42501';
  end if;

  if p_idempotency_key is null
    or p_visit_date is null
    or p_no_time_limit is null
    or p_credential_type not in ('pin', 'qr')
    or p_access_type not in ('visitor', 'delivery', 'service_provider', 'frequent_visitor')
    or (p_access_type <> 'delivery' and length(trim(coalesce(p_visitor_name, ''))) not between 2 and 120)
    or p_window_start is null
    or (not p_no_time_limit and (p_window_end is null or coalesce(p_window_end_date, p_visit_date) + p_window_end <= p_visit_date + p_window_start)) then
    raise exception 'invalid individual invitation' using errcode = '22023';
  end if;

  select * into v_resident
  from public.residents
  where id = p_resident_id and community_id = p_community_id and is_active;
  if not found then
    raise exception 'resident not found' using errcode = 'P0002';
  end if;

  if p_resident_contact_id is not null and not exists (
    select 1 from public.resident_contacts as contact
    where contact.id = p_resident_contact_id
      and contact.community_id = p_community_id
      and contact.resident_id = p_resident_id
  ) then
    raise exception 'resident contact is outside invitation scope' using errcode = '42501';
  end if;

  v_request_fingerprint := digest(jsonb_build_object(
    'residentId', p_resident_id,
    'residentContactId', p_resident_contact_id,
    'visitorName', nullif(trim(p_visitor_name), ''),
    'visitorPhone', nullif(trim(p_visitor_phone), ''),
    'accessType', p_access_type,
    'visitDate', p_visit_date,
    'windowStart', p_window_start,
    'windowEndDate', case when p_no_time_limit then null else coalesce(p_window_end_date, p_visit_date) end,
    'windowEnd', case when p_no_time_limit then null else p_window_end end,
    'noTimeLimit', p_no_time_limit,
    'notes', nullif(trim(p_notes), ''),
    'credentialType', p_credential_type
  )::text, 'sha256');

  perform pg_advisory_xact_lock(hashtextextended(
    p_community_id::text || ':' || p_resident_id::text || ':' || p_idempotency_key::text,
    0
  ));

  select invitation.id, invitation.creation_request_fingerprint
  into v_invitation_id, v_existing_fingerprint
  from public.invitations as invitation
  where invitation.community_id = p_community_id
    and invitation.resident_id = p_resident_id
    and invitation.group_id is null
    and invitation.creation_idempotency_key = p_idempotency_key;

  if found then
    if v_existing_fingerprint is distinct from v_request_fingerprint then
      raise exception 'idempotency key was used for another invitation' using errcode = '22023';
    end if;
    return v_invitation_id;
  end if;

  insert into public.invitations (
    community_id, resident_id, unit_id, resident_contact_id,
    visitor_name, visitor_phone, access_type, visit_date,
    window_start, window_end_date, window_end, no_time_limit,
    status, notes, share_token,
    creation_idempotency_key, creation_request_fingerprint
  ) values (
    p_community_id, p_resident_id, v_resident.unit_id, p_resident_contact_id,
    nullif(trim(p_visitor_name), ''), nullif(trim(p_visitor_phone), ''), p_access_type, p_visit_date,
    p_window_start,
    case when p_no_time_limit then null else coalesce(p_window_end_date, p_visit_date) end,
    case when p_no_time_limit then '23:59'::time else p_window_end end,
    p_no_time_limit, 'active', nullif(trim(p_notes), ''), encode(gen_random_bytes(32), 'hex'),
    p_idempotency_key, v_request_fingerprint
  ) returning id into v_invitation_id;

  for v_attempt in 1..5 loop
    if p_credential_type = 'pin' then
      v_bytes := gen_random_bytes(4);
      v_secret := lpad((
        (get_byte(v_bytes, 0)::bigint * 16777216
          + get_byte(v_bytes, 1)::bigint * 65536
          + get_byte(v_bytes, 2)::bigint * 256
          + get_byte(v_bytes, 3)::bigint) % 1000000
      )::text, 6, '0');
    else
      v_secret := encode(gen_random_bytes(32), 'hex');
    end if;
    begin
      if exists (
        select 1
        from public.event_guest_credentials as event_guest_credential
        where event_guest_credential.credential_type = p_credential_type
          and event_guest_credential.credential_fingerprint = digest(
            p_community_id::text || ':' || p_credential_type || ':' || v_secret,
            'sha256'
          )
      ) then
        raise unique_violation;
      end if;
      perform public.store_invitation_credential(
        p_community_id,
        v_invitation_id,
        p_credential_type,
        v_secret
      );
      exit;
    exception when unique_violation then
      if v_attempt = 5 then raise; end if;
    end;
  end loop;

  insert into public.invitation_events (invitation_id, event_type, event_label, payload)
  values (
    v_invitation_id,
    'created',
    'Invitacion creada',
    jsonb_build_object(
      'accessType', p_access_type,
      'credentialType', p_credential_type,
      'visitDate', p_visit_date,
      'windowStart', p_window_start,
      'windowEndDate', case when p_no_time_limit then null else coalesce(p_window_end_date, p_visit_date) end,
      'windowEnd', case when p_no_time_limit then null else p_window_end end,
      'noTimeLimit', p_no_time_limit
    )
  );

  return v_invitation_id;
end;
$$;

revoke all on function public.create_individual_invitation(uuid, uuid, uuid, text, text, text, date, time, date, time, boolean, text, text, uuid) from public;
grant execute on function public.create_individual_invitation(uuid, uuid, uuid, text, text, text, date, time, date, time, boolean, text, text, uuid) to authenticated;

comment on function public.create_individual_invitation(uuid, uuid, uuid, text, text, text, date, time, date, time, boolean, text, text, uuid) is
  'Atomically and idempotently creates one invitation, its credential and audit event within the authenticated tenant scope.';
