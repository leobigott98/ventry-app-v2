-- Run against a disposable/local database after all migrations:
-- psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/credential_access_security.sql
-- All fixtures are rolled back.

begin;

insert into public.communities (
  id, name, address, location_label, planned_unit_count, access_policy_mode,
  gate_operation_mode, admin_contact_name, admin_contact_phone, created_by_email,
  time_zone
) values
  ('31000000-0000-4000-8000-000000000001', 'Security A', 'A', 'A', 1,
   'invitation_only', '24_7_guarded', 'Admin A', '+58001', 'admin-a@example.com',
   'Pacific/Kiritimati'),
  ('32000000-0000-4000-8000-000000000001', 'Security B', 'B', 'B', 1,
   'invitation_only', '24_7_guarded', 'Admin B', '+58002', 'admin-b@example.com',
   'America/Caracas');

insert into public.residents (id, community_id, full_name, phone) values
  ('31000000-0000-4000-8000-000000000101', '31000000-0000-4000-8000-000000000001', 'Resident A', '+58101'),
  ('31000000-0000-4000-8000-000000000102', '31000000-0000-4000-8000-000000000001', 'Resident A2', '+58102'),
  ('32000000-0000-4000-8000-000000000101', '32000000-0000-4000-8000-000000000001', 'Resident B', '+58201');

insert into public.community_memberships (
  id, community_id, email, full_name, role, resident_id, auth_user_id, is_active
) values
  ('31000000-0000-4000-8000-000000001001',
   '31000000-0000-4000-8000-000000000001',
   'guard-security@example.com', 'Guard Security', 'admin', null,
   'a1000000-0000-4000-8000-000000000001', true),
  ('31000000-0000-4000-8000-000000001002',
   '31000000-0000-4000-8000-000000000001',
   'resident-a2@example.com', 'Resident A2', 'resident',
   '31000000-0000-4000-8000-000000000102',
   'a1000000-0000-4000-8000-000000000002', true);

insert into public.invitations (
  id, community_id, resident_id, visitor_name, access_type, visit_date,
  window_start, window_end_date, window_end, no_time_limit, status, share_token
) values
  ('31000000-0000-4000-8000-000000002001', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', 'Active', 'visitor', current_date - 1, '00:00', null, '23:59', true, 'active', 'active-share'),
  ('31000000-0000-4000-8000-000000002002', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', 'Expired', 'visitor', current_date - 3, '00:00', current_date - 2, '23:59', false, 'active', 'expired-share'),
  ('31000000-0000-4000-8000-000000002003', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', 'Revoked', 'visitor', current_date - 1, '00:00', null, '23:59', true, 'revoked', 'revoked-share'),
  ('31000000-0000-4000-8000-000000002004', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', 'Used', 'visitor', current_date - 1, '00:00', null, '23:59', true, 'used', 'used-share'),
  ('31000000-0000-4000-8000-000000002005', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', 'V2 QR', 'visitor', current_date - 1, '00:00', null, '23:59', true, 'active', 'v2-share'),
  ('31000000-0000-4000-8000-000000002006', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', 'Timezone active', 'visitor',
   ((now() at time zone 'Pacific/Kiritimati') - interval '1 minute')::date,
   (((now() at time zone 'Pacific/Kiritimati') - interval '1 minute')::time),
   null, '23:59', true, 'active', 'timezone-share'),
  ('32000000-0000-4000-8000-000000002001', '32000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000101', 'Other community', 'visitor', current_date - 1, '00:00', null, '23:59', true, 'active', 'other-share');

insert into public.access_credentials (
  invitation_id, credential_type, credential_value, qr_payload
) values
  ('31000000-0000-4000-8000-000000002001', 'pin', '111111', null),
  ('31000000-0000-4000-8000-000000002002', 'pin', '222222', null),
  ('31000000-0000-4000-8000-000000002003', 'pin', '333333', null),
  ('31000000-0000-4000-8000-000000002004', 'pin', '444444', null),
  ('31000000-0000-4000-8000-000000002006', 'pin', '666666', null),
  ('32000000-0000-4000-8000-000000002001', 'qr', 'LEGACYOTHERQR', 'ventry:legacy:community-b:LEGACYOTHERQR');

insert into public.resident_events (
  id, community_id, resident_id, name, event_date, window_start,
  window_end_date, window_end, status, share_token
) values (
  '31000000-0000-4000-8000-000000003001',
  '31000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000101', 'Active event',
  current_date - 1, '00:00', current_date + 1, '23:59', 'active', 'event-share'
);

insert into public.event_credentials (event_id, credential_type, credential_value)
values ('31000000-0000-4000-8000-000000003001', 'pin', '55555555');

insert into public.event_guests (id, event_id, full_name)
values (
  '31000000-0000-4000-8000-000000004001',
  '31000000-0000-4000-8000-000000003001',
  'Event Guest'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","email":"guard-security@example.com"}',
  true
);

do $$
declare
  v_result jsonb;
  v_entry_id uuid;
  v_attempt integer;
begin
  perform public.store_invitation_credential(
    '31000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000002005',
    'qr',
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  );
  if not exists (
    select 1 from public.access_credentials
    where invitation_id = '31000000-0000-4000-8000-000000002005'
      and credential_version = 2
      and credential_hash is not null
      and credential_value is null
      and qr_payload is null
  ) then
    raise exception 'v2 QR was stored recoverably in the RLS-visible table';
  end if;
  begin
    perform 1 from public.credential_secrets limit 1;
    raise exception 'authenticated client can read credential_secrets';
  exception when insufficient_privilege then
    null;
  end;
  v_result := public.validate_access_credential(
    '31000000-0000-4000-8000-000000000001', 'qr',
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'v2-qr-device-000000001', '10.0.0.20'
  );
  if v_result ->> 'resourceId' <> '31000000-0000-4000-8000-000000002005' then
    raise exception 'v2 opaque QR did not validate';
  end if;
  if public.get_public_invitation('v2-share') ->> 'qr_payload'
     <> 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' then
    raise exception 'public bearer RPC could not recover the v2 QR';
  end if;
  if public.get_invitation_credential('31000000-0000-4000-8000-000000002005')
       ->> 'qr_payload' <> 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' then
    raise exception 'authorized owner/admin could not recover the v2 QR';
  end if;

  perform set_config(
    'request.jwt.claims',
    '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","email":"resident-a2@example.com"}',
    true
  );
  if public.get_invitation_credential('31000000-0000-4000-8000-000000002005') is not null then
    raise exception 'another resident recovered an invitation credential';
  end if;
  if public.get_event_credential('31000000-0000-4000-8000-000000003001') is not null then
    raise exception 'another resident recovered an event credential';
  end if;
  perform set_config(
    'request.jwt.claims',
    '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","email":"guard-security@example.com"}',
    true
  );

  v_result := public.validate_access_credential(
    '31000000-0000-4000-8000-000000000001', 'pin', '666666',
    'timezone-device-000001', '10.0.0.21'
  );
  if v_result ->> 'status' <> 'active' then
    raise exception 'community timezone was not used to evaluate the access window';
  end if;

  v_result := public.validate_access_credential(
    '31000000-0000-4000-8000-000000000001', 'pin', '999999',
    'negative-pin-device-0001', '10.0.0.1'
  );
  if v_result ->> 'status' <> 'not_found' or (v_result ->> 'rateLimited')::boolean then
    raise exception 'incorrect PIN did not return a normal negative result';
  end if;

  v_result := public.validate_access_credential(
    '31000000-0000-4000-8000-000000000001', 'qr',
    'ventry:legacy:community-b:LEGACYOTHERQR',
    'cross-community-device-01', '10.0.0.2'
  );
  if v_result ->> 'status' <> 'not_found' then
    raise exception 'QR from another community matched';
  end if;

  v_result := public.validate_access_credential(
    '31000000-0000-4000-8000-000000000001', 'pin', '222222',
    'expired-device-0000001', '10.0.0.3'
  );
  if v_result ->> 'status' <> 'expired' then
    raise exception 'expired invitation was not rejected as expired';
  end if;

  v_result := public.validate_access_credential(
    '31000000-0000-4000-8000-000000000001', 'pin', '333333',
    'revoked-device-0000001', '10.0.0.4'
  );
  if v_result ->> 'status' <> 'revoked' then
    raise exception 'revoked invitation was not rejected as revoked';
  end if;

  v_result := public.validate_access_credential(
    '31000000-0000-4000-8000-000000000001', 'pin', '444444',
    'used-device-0000000001', '10.0.0.5'
  );
  if v_result ->> 'status' <> 'used' then
    raise exception 'used invitation was not rejected as used';
  end if;

  for v_attempt in 1..4 loop
    v_result := public.validate_access_credential(
      '31000000-0000-4000-8000-000000000001', 'pin', '000000',
      'stale-reset-device-001', '10.0.0.51'
    );
  end loop;
  v_result := public.validate_access_credential(
    '31000000-0000-4000-8000-000000000001', 'pin', '222222',
    'stale-reset-device-001', '10.0.0.51'
  );
  if not (v_result ->> 'rateLimited')::boolean then
    raise exception 'an expired credential reset the failed-attempt budget';
  end if;
  v_result := public.validate_access_credential(
    '31000000-0000-4000-8000-000000000001', 'pin', '111111',
    'stale-reset-device-001', '10.0.0.51'
  );
  if v_result ->> 'status' <> 'rate_limited' then
    raise exception 'stale credential bypass left the tuple unblocked';
  end if;

  for v_attempt in 1..5 loop
    v_result := public.validate_access_credential(
      '31000000-0000-4000-8000-000000000001', 'pin', '000000',
      'rate-limit-device-0001', '10.0.0.6'
    );
  end loop;
  if not (v_result ->> 'rateLimited')::boolean then
    raise exception 'fifth failed attempt did not trigger temporary blocking';
  end if;

  v_result := public.validate_access_credential(
    '31000000-0000-4000-8000-000000000001', 'pin', '111111',
    'rate-limit-device-0001', '10.0.0.6'
  );
  if v_result ->> 'status' <> 'rate_limited' then
    raise exception 'blocked tuple accepted a correct credential';
  end if;

  v_entry_id := public.register_invitation_entry(
    '31000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000002001',
    '31000000-0000-4000-8000-000000009001'
  );
  if public.register_invitation_entry(
    '31000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000002001',
    '31000000-0000-4000-8000-000000009001'
  ) <> v_entry_id then
    raise exception 'invitation retry was not idempotent';
  end if;

  if (select count(*) from public.visitor_entries where invitation_id = '31000000-0000-4000-8000-000000002001') <> 1 then
    raise exception 'invitation retry created duplicate entries';
  end if;

  v_entry_id := public.register_event_guest_entry(
    '31000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000003001',
    '31000000-0000-4000-8000-000000004001',
    '31000000-0000-4000-8000-000000009002'
  );
  if public.register_event_guest_entry(
    '31000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000003001',
    '31000000-0000-4000-8000-000000004001',
    '31000000-0000-4000-8000-000000009002'
  ) <> v_entry_id then
    raise exception 'event retry was not idempotent';
  end if;

  if exists (
    select 1 from public.access_events
    where details ?| array['credential', 'credentialValue', 'rawCredential', 'pin', 'qr', 'qrPayload']
  ) then
    raise exception 'access audit contains reusable credential material';
  end if;

  begin
    insert into public.access_events (
      community_id, access_event_type, event_status, event_direction,
      event_source, event_label, details, created_by_email
    ) values (
      '31000000-0000-4000-8000-000000000001', 'validation_failed',
      'rejected', 'validation', 'validation', 'Unsafe audit',
      jsonb_build_object('pin', '111111'), 'guard-security@example.com'
    );
    raise exception 'raw audit trigger accepted a reusable PIN';
  exception when check_violation then
    null;
  end;
end;
$$;

rollback;
