-- Reproducible RLS harness. Run only against a disposable/local database after
-- all migrations: psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_multi_tenant.sql
-- Every fixture is rolled back.

begin;

insert into public.communities (
  id, name, address, location_label, planned_unit_count, access_policy_mode,
  gate_operation_mode, admin_contact_name, admin_contact_phone, created_by_email
) values
  ('10000000-0000-4000-8000-000000000001', 'Comunidad A', 'A', 'A', 2,
   'invitation_only', '24_7_guarded', 'Admin A', '+58001', 'admin-a@example.com'),
  ('20000000-0000-4000-8000-000000000001', 'Comunidad B', 'B', 'B', 1,
   'invitation_only', '24_7_guarded', 'Admin B', '+58002', 'admin-b@example.com');

insert into public.units (id, community_id, identifier) values
  ('10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', 'A-01'),
  ('20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000001', 'B-01');

insert into public.residents (id, community_id, unit_id, full_name, phone) values
  ('10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000010', 'Residente A1', '+58101'),
  ('10000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000010', 'Residente A2', '+58102'),
  ('20000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000010', 'Residente B1', '+58201');

insert into public.community_memberships (
  id, community_id, email, full_name, role, resident_id, auth_user_id, is_primary, is_active
) values
  ('10000000-0000-4000-8000-000000001001', '10000000-0000-4000-8000-000000000001', 'admin-a@example.com', 'Admin A', 'admin', null, 'a0000000-0000-4000-8000-000000000001', true, true),
  ('10000000-0000-4000-8000-000000001002', '10000000-0000-4000-8000-000000000001', 'guard-a@example.com', 'Guard A', 'guard', null, 'a0000000-0000-4000-8000-000000000002', false, true),
  ('10000000-0000-4000-8000-000000001003', '10000000-0000-4000-8000-000000000001', 'resident-a1@example.com', 'Resident A1', 'resident', '10000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000003', false, true),
  ('10000000-0000-4000-8000-000000001004', '10000000-0000-4000-8000-000000000001', 'resident-a2@example.com', 'Resident A2', 'resident', '10000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000004', false, true),
  ('10000000-0000-4000-8000-000000001005', '10000000-0000-4000-8000-000000000001', 'inactive-a@example.com', 'Inactive A', 'guard', null, 'a0000000-0000-4000-8000-000000000005', false, false),
  ('20000000-0000-4000-8000-000000001001', '20000000-0000-4000-8000-000000000001', 'admin-b@example.com', 'Admin B', 'admin', null, 'b0000000-0000-4000-8000-000000000001', true, true);

insert into public.invitations (
  id, community_id, resident_id, unit_id, visitor_name, access_type,
  visit_date, window_start, window_end, status, share_token
) values
  ('10000000-0000-4000-8000-000000002001', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000010', 'Visita A1', 'visitor', current_date, '08:00', '20:00', 'active', 'share-a1'),
  ('10000000-0000-4000-8000-000000002002', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000010', 'Visita A2', 'visitor', current_date, '08:00', '20:00', 'active', 'share-a2'),
  ('20000000-0000-4000-8000-000000002001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000010', 'Visita B1', 'visitor', current_date, '08:00', '20:00', 'active', 'share-b1');

insert into public.access_credentials (invitation_id, credential_type, credential_value) values
  ('10000000-0000-4000-8000-000000002001', 'pin', '111111'),
  ('10000000-0000-4000-8000-000000002002', 'pin', '222222'),
  ('20000000-0000-4000-8000-000000002001', 'pin', '333333');

insert into public.resident_events (
  id, community_id, resident_id, unit_id, name, event_date, window_start,
  window_end_date, window_end, share_token
) values
  ('10000000-0000-4000-8000-000000003001', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000010', 'Evento A1', current_date, '08:00', current_date, '20:00', 'event-a1'),
  ('10000000-0000-4000-8000-000000003002', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000010', 'Evento A2', current_date, '08:00', current_date, '20:00', 'event-a2'),
  ('20000000-0000-4000-8000-000000003001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000010', 'Evento B1', current_date, '08:00', current_date, '20:00', 'event-b1');

insert into public.event_guests (event_id, full_name) values
  ('10000000-0000-4000-8000-000000003001', 'Invitado A1'),
  ('10000000-0000-4000-8000-000000003002', 'Invitado A2'),
  ('20000000-0000-4000-8000-000000003001', 'Invitado B1');

insert into public.event_credentials (event_id, credential_type, credential_value) values
  ('10000000-0000-4000-8000-000000003001', 'pin', '44444444'),
  ('10000000-0000-4000-8000-000000003002', 'pin', '55555555'),
  ('20000000-0000-4000-8000-000000003001', 'pin', '66666666');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated","email":"onboarding@example.com","app_metadata":{"can_create_community":true}}',
  true
);

do $$
declare
  v_community jsonb;
begin
  v_community := public.create_community_onboarding(
    'Comunidad onboarding', 'Direccion onboarding', 'Caracas', 2,
    'invitation_only', null, '24_7_guarded', null,
    'Admin onboarding', '+58999', 'onboarding@example.com', null
  );
  if v_community ->> 'name' <> 'Comunidad onboarding' then
    raise exception 'onboarding RPC did not create the expected community';
  end if;

  begin
    perform public.create_community_onboarding(
      'Comunidad duplicada', 'Direccion duplicada', 'Caracas', 2,
      'invitation_only', null, '24_7_guarded', null,
      'Admin onboarding', '+58999', 'onboarding@example.com', null
    );
    raise exception 'onboarding RPC accepted a duplicate submission';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated","email":"admin-a@example.com"}',
  true
);

do $$
begin
  if (select count(*) from public.communities) <> 1 then
    raise exception 'admin A can see another community';
  end if;
  if (select count(*) from public.residents) <> 2 then
    raise exception 'admin A resident scope is incorrect';
  end if;
  if exists (
    select 1 from public.invitations
    where community_id = '20000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'admin A can see community B invitations';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated","email":"resident-a1@example.com"}',
  true
);

do $$
begin
  if (select count(*) from public.invitations) <> 1 then
    raise exception 'resident A1 can see another resident invitation';
  end if;
  if (select count(*) from public.resident_events) <> 1 then
    raise exception 'resident A1 can see another resident event';
  end if;
  if (select count(*) from public.residents) <> 1 then
    raise exception 'resident A1 can see another resident profile';
  end if;

  begin
    insert into public.invitations (
      community_id, resident_id, unit_id, visitor_name, access_type,
      visit_date, window_start, window_end, share_token
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000102',
      '10000000-0000-4000-8000-000000000010',
      'Intento cruzado', 'visitor', current_date, '08:00', '20:00', 'denied-cross-resident'
    );
    raise exception 'resident A1 inserted an invitation for resident A2';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.invitations (
      community_id, resident_id, unit_id, visitor_name, access_type,
      visit_date, window_start, window_end, share_token
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000101',
      '20000000-0000-4000-8000-000000000010',
      'Unidad cruzada', 'visitor', current_date, '08:00', '20:00', 'denied-cross-unit'
    );
    raise exception 'resident A1 linked an invitation to a community B unit';
  exception when check_violation then
    null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","email":"guard-a@example.com"}',
  true
);

do $$
declare
  v_updated integer;
  v_invitation_id uuid;
  v_event_id uuid;
  v_entry_id uuid;
begin
  if (select count(*) from public.invitations) <> 2 then
    raise exception 'guard A cannot read the invitations needed at the gate';
  end if;
  if exists (
    select 1 from public.residents
    where community_id = '20000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'guard A can see community B residents';
  end if;
  if (select count(*) from public.access_credentials) <> 0
     or (select count(*) from public.event_credentials) <> 0 then
    raise exception 'guard A can read raw credentials';
  end if;

  v_invitation_id := public.match_invitation_credential(
    '10000000-0000-4000-8000-000000000001', 'pin', '111111'
  );
  if v_invitation_id <> '10000000-0000-4000-8000-000000002001' then
    raise exception 'guard A cannot validate a community A invitation credential';
  end if;

  v_event_id := public.match_event_credential(
    '10000000-0000-4000-8000-000000000001', 'pin', '44444444'
  );
  if v_event_id <> '10000000-0000-4000-8000-000000003001' then
    raise exception 'guard A cannot validate a community A event credential';
  end if;

  begin
    perform public.match_invitation_credential(
      '20000000-0000-4000-8000-000000000001', 'pin', '333333'
    );
    raise exception 'guard A validated a community B credential';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.invitations
    set visitor_name = 'Guard changed invitation identity'
    where id = '10000000-0000-4000-8000-000000002001';
    raise exception 'guard A changed sensitive invitation fields';
  exception when insufficient_privilege then
    null;
  end;

  v_entry_id := public.register_invitation_entry(
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000002001'
  );
  if v_entry_id is null
     or not exists (
       select 1 from public.access_events
       where visitor_entry_id = v_entry_id
         and access_event_type = 'entry_registered'
     ) then
    raise exception 'atomic invitation entry did not create its audit event';
  end if;

  begin
    perform public.register_invitation_entry(
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000002001'
    );
    raise exception 'the same invitation was consumed twice';
  exception when object_not_in_prerequisite_state then
    null;
  end;

  begin
    update public.visitor_entries
    set visitor_name = 'Guard changed immutable entry data'
    where id = v_entry_id;
    raise exception 'guard A changed immutable visitor entry fields';
  exception when insufficient_privilege then
    null;
  end;

  update public.visitor_entries
  set entry_status = 'exited', exited_at = now()
  where id = v_entry_id;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'guard A cannot register an entry exit';
  end if;

  begin
    update public.event_guests
    set full_name = 'Guard changed guest identity'
    where event_id = '10000000-0000-4000-8000-000000003001';
    raise exception 'guard A changed sensitive event guest fields';
  exception when insufficient_privilege then
    null;
  end;

  update public.event_guests
  set attendance_status = 'inside', checked_in_at = now()
  where event_id = '10000000-0000-4000-8000-000000003001';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'guard A cannot register event attendance';
  end if;

  update public.communities
  set name = 'Guard changed sensitive configuration'
  where id = '10000000-0000-4000-8000-000000000001';
  get diagnostics v_updated = row_count;
  if v_updated <> 0 then
    raise exception 'guard A updated community administration data';
  end if;

  begin
    insert into public.community_memberships (
      community_id, email, full_name, role, is_active
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'forged-admin@example.com', 'Forged Admin', 'admin', true
    );
    raise exception 'guard A inserted an admin membership';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.visitor_entries (
      community_id, resident_id, unit_id, visitor_name, access_type,
      registration_source, created_by_email
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000101',
      '10000000-0000-4000-8000-000000000010',
      'Referencia cruzada', 'visitor', 'unannounced', 'guard-a@example.com'
    );
    raise exception 'guard A linked an entry to a community B resident';
  exception when check_violation then
    null;
  end;

  insert into public.visitor_entries (
    community_id, resident_id, unit_id, visitor_name, access_type,
    registration_source, created_by_email
  ) values (
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000101',
    '10000000-0000-4000-8000-000000000010',
    'Entrada permitida', 'visitor', 'unannounced', 'guard-a@example.com'
  ) returning id into v_entry_id;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated","email":"inactive-a@example.com"}',
  true
);

do $$
begin
  if (select count(*) from public.community_memberships) <> 1 then
    raise exception 'inactive user cannot read its own membership status';
  end if;
  if (select count(*) from public.communities) <> 0
     or (select count(*) from public.invitations) <> 0 then
    raise exception 'inactive membership still grants community data';
  end if;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare
  v_invitation jsonb;
  v_event jsonb;
begin
  begin
    perform 1 from public.invitations limit 1;
    raise exception 'anon can read the invitations table';
  exception when insufficient_privilege then
    null;
  end;

  v_invitation := public.get_public_invitation('share-a1');
  if v_invitation ->> 'visitor_name' <> 'Visita A1'
     or v_invitation ? 'community_id'
     or v_invitation ? 'resident_id' then
    raise exception 'public invitation RPC returned an invalid projection';
  end if;

  v_event := public.get_public_event('event-a1');
  if v_event ->> 'name' <> 'Evento A1'
     or (v_event ->> 'guest_count')::integer <> 1
     or v_event ? 'event_guests' then
    raise exception 'public event RPC returned an invalid projection';
  end if;
end;
$$;

reset role;
rollback;

select 'RLS multi-tenant harness passed' as result;
