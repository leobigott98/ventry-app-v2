-- Run with psql on a disposable, already migrated database (fixtures roll back).
begin;

insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000001', 'push-resident@example.com'),
  ('a1000000-0000-4000-8000-000000000002', 'push-neighbor@example.com'),
  ('a1000000-0000-4000-8000-000000000003', 'push-guard@example.com'),
  ('a1000000-0000-4000-8000-000000000004', 'push-admin@example.com'),
  ('b1000000-0000-4000-8000-000000000001', 'push-other-community@example.com');
insert into public.communities (id, name, address, location_label, planned_unit_count, access_policy_mode,
    gate_operation_mode, admin_contact_name, admin_contact_phone, created_by_email)
values
  ('10000000-0000-4000-8000-000000000001', 'Push A', 'A', 'A', 2, 'invitation_only', '24_7_guarded', 'Admin A', '+58001', 'push-admin@example.com'),
  ('20000000-0000-4000-8000-000000000001', 'Push B', 'B', 'B', 1, 'invitation_only', '24_7_guarded', 'Admin B', '+58002', 'push-other-community@example.com');
insert into public.residents (id, community_id, full_name, phone) values
  ('10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001', 'Resident A', '+58011'),
  ('10000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000001', 'Neighbor A', '+58012');
insert into public.community_memberships (community_id, email, full_name, role, resident_id, auth_user_id)
values
  ('10000000-0000-4000-8000-000000000001', 'push-resident@example.com', 'Resident A', 'resident', '10000000-0000-4000-8000-000000000101', 'a1000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001', 'push-neighbor@example.com', 'Neighbor A', 'resident', '10000000-0000-4000-8000-000000000102', 'a1000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000001', 'push-guard@example.com', 'Guard A', 'guard', null, 'a1000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-000000000001', 'push-admin@example.com', 'Admin A', 'admin', null, 'a1000000-0000-4000-8000-000000000004'),
  ('20000000-0000-4000-8000-000000000001', 'push-other-community@example.com', 'Admin B', 'admin', null, 'b1000000-0000-4000-8000-000000000001');

select set_config('test.push_community', '10000000-0000-4000-8000-000000000001', true);
select set_config('test.push_resident', '10000000-0000-4000-8000-000000000101', true);
select set_config('test.push_installation', '10000000-0000-4000-8000-000000000222', true);
select set_config('test.push_key', 'B' || repeat('A', 86), true);
select set_config('test.push_endpoint', 'https://fcm.googleapis.com/fcm/send/example', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","email":"push-resident@example.com","role":"authenticated"}', true);
do $$
declare
  c uuid := current_setting('test.push_community')::uuid;
  device uuid := current_setting('test.push_installation')::uuid;
  key text := current_setting('test.push_key');
  test_id uuid;
begin
  perform public.save_push_subscription(c, device, current_setting('test.push_endpoint'), key, repeat('B', 22), 'android', key, null);
  perform public.set_push_preference(c, 'entry_registered', false);
  test_id := public.queue_push_test(c, device, key);
  if test_id is null or (select count(*) from public.notification_events where kind = 'test') <> 1 then
    raise exception 'test could not be queued for owner';
  end if;
  perform set_config('test.push_test_event', test_id::text, true);
  begin
    perform public.queue_push_test(c, device, key);
    raise exception 'test accepted without cooldown';
  exception when program_limit_exceeded then null;
  end;
  if public.push_device_status(c, device, key) is distinct from 'active' then raise exception 'own device status unavailable'; end if;
  if public.push_device_status(c, device, 'B' || repeat('C', 86)) is distinct from 'expired' then
    raise exception 'key rotation did not expire the old subscription';
  end if;
  begin
    perform 1 from public.push_subscriptions;
    raise exception 'subscriber gained direct access to endpoints and keys';
  exception when insufficient_privilege then null;
  end;
  begin
    perform ventry_push.notify_call(c, 'a1000000-0000-4000-8000-000000000001', gen_random_uuid(), 'call_incoming');
    raise exception 'client gained access to internal call publisher';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000002","email":"push-neighbor@example.com","role":"authenticated"}', true);
do $$
declare
  c uuid := current_setting('test.push_community')::uuid;
  device uuid := current_setting('test.push_installation')::uuid;
  key text := current_setting('test.push_key');
begin
  if public.push_device_status(c, device, key) is not null or exists (select 1 from public.push_preferences)
      or exists (select 1 from public.notification_events) then
    raise exception 'same-community neighbor can see private subscription, preferences or feed';
  end if;
  begin
    perform public.queue_push_test(c, device, key);
    raise exception 'neighbor targeted somebody else''s installation';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_push_subscription(c, gen_random_uuid(), current_setting('test.push_endpoint'), key, repeat('B', 22), 'android', key, null);
    raise exception 'neighbor claimed somebody else''s endpoint';
  exception when unique_violation then null;
  end;
  perform public.disable_push_installation(device);
end $$;

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000003","email":"push-guard@example.com","role":"authenticated"}', true);
do $$
declare
  c uuid := current_setting('test.push_community')::uuid;
  r uuid := current_setting('test.push_resident')::uuid;
  k uuid := gen_random_uuid();
  first_id uuid;
  repeat_id uuid;
begin
  select id into first_id from public.create_visit_confirmation(c, r, 'Test visitor', k);
  select id into repeat_id from public.create_visit_confirmation(c, r, 'Test visitor', k);
  if first_id is null or first_id is distinct from repeat_id then raise exception 'confirmation was not idempotent'; end if;
  perform set_config('test.push_visit', first_id::text, true);
  begin
    perform public.respond_visit_confirmation(c, first_id, 'approved');
    raise exception 'guard answered on behalf of resident';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

insert into public.visitor_entries (community_id, resident_id, visitor_name, access_type, registration_source, created_by_email)
values (current_setting('test.push_community')::uuid, current_setting('test.push_resident')::uuid,
  'Test visitor', 'visitor', 'unannounced', 'push-guard@example.com');

insert into public.invitations (id, community_id, resident_id, visitor_name, access_type, visit_date, window_start, window_end, share_token)
values ('10000000-0000-4000-8000-000000000303', current_setting('test.push_community')::uuid,
  current_setting('test.push_resident')::uuid, 'Test visitor', 'visitor', current_date, '10:00', '12:00', 'push-test-invitation');

insert into public.access_events (community_id, invitation_id, resident_id, access_event_type, event_status,
  event_direction, event_source, event_label, details, created_by_email)
select current_setting('test.push_community')::uuid, '10000000-0000-4000-8000-000000000303',
  current_setting('test.push_resident')::uuid, 'validation_failed', 'rejected', 'validation', 'invitation',
  'Test rejection', '{"credentialType":"qr","result":"expired"}'::jsonb, 'push-guard@example.com'
from generate_series(1, 2);

select ventry_push.notify_call(current_setting('test.push_community')::uuid,
  'a1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000444', 'call_incoming');
select ventry_push.notify_call(current_setting('test.push_community')::uuid,
  'a1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000444', 'call_missed');

do $$ begin
  if exists (select 1 from ventry_push.deliveries d join public.notification_events e on e.id = d.event_id
      where e.kind = 'entry_registered') then raise exception 'opt-out was ignored'; end if;
  if (select count(*) from public.notification_events where kind = 'credential_rejected') <> 1 then
    raise exception 'repeated QR rejection was not deduplicated';
  end if;
  if (select count(*) from ventry_push.deliveries d join public.notification_events e on e.id = d.event_id
      where e.kind = 'call_incoming' and d.state = 'skipped') <> 1 then
    raise exception 'missed call did not suppress the unsent incoming alert';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","email":"push-other-community@example.com","role":"authenticated"}', true);
do $$ begin
  if exists(select 1 from public.visit_confirmations) or exists(select 1 from public.notification_events) then
    raise exception 'cross-community admin gained access to confirmations or feed';
  end if;
  begin
    perform public.set_push_preference(current_setting('test.push_community')::uuid, 'entry_registered', true);
    raise exception 'cross-community admin can write preferences';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000004","email":"push-admin@example.com","role":"authenticated"}', true);
do $$ begin
  if exists(select 1 from public.notification_events) or exists(select 1 from public.push_preferences)
    or public.push_device_status(current_setting('test.push_community')::uuid, current_setting('test.push_installation')::uuid, current_setting('test.push_key')) is not null then
    raise exception 'community admin gained access to another account''s feed/preferences/subscriptions';
  end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","email":"push-resident@example.com","role":"authenticated"}', true);
do $$ begin
  if not exists (select 1 from public.notification_events where kind = 'entry_registered')
    or (select count(*) from public.notification_events where kind = 'visit_waiting') <> 1 then
    raise exception 'in-app feed missing without native opt-in for entry, or duplicates confirmations';
  end if;
  perform public.respond_visit_confirmation(current_setting('test.push_community')::uuid, current_setting('test.push_visit')::uuid, 'approved');
end $$;
reset role;

set local role ventry_push_worker;
do $$
declare
  claimed record;
  test_id uuid := current_setting('test.push_test_event')::uuid;
  key text := current_setting('test.push_key');
begin
  select * into claimed from ventry_push.claim_deliveries(key, test_id);
  if claimed.event_id is distinct from test_id then raise exception 'worker could not claim targeted test'; end if;
  if exists (select 1 from ventry_push.claim_deliveries(key, test_id)) then
    raise exception 'worker claimed an already leased delivery';
  end if;
  perform ventry_push.finish_delivery(claimed.delivery_id, claimed.lease_id, 'expired');
  if exists (select 1 from ventry_push.claim_deliveries(key, null)) then
    raise exception 'expired device still receives deliveries';
  end if;
  begin
    perform 1 from public.push_subscriptions;
    raise exception 'worker gained unrestricted subscription access';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$ begin
  if (select state from public.push_subscriptions) <> 'expired' then raise exception 'expiration was not persisted'; end if;
end $$;

rollback;
