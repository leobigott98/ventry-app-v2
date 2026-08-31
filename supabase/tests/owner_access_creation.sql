-- Run only against a disposable local database after all migrations.
begin;

insert into public.communities(
  id,name,address,location_label,planned_unit_count,access_policy_mode,
  gate_operation_mode,admin_contact_name,admin_contact_phone,created_by_email,time_zone
) values (
  '71000000-0000-4000-8000-000000000001','Owner creation','Local','Local',2,
  'invitation_only','24_7_guarded','Admin','+58000','owner-admin@example.com','America/Caracas'
);

insert into public.residents(id,community_id,full_name,phone)
values('71000000-0000-4000-8000-000000000101','71000000-0000-4000-8000-000000000001','Owner Resident','+58101');

insert into public.community_memberships(
  id,community_id,email,full_name,role,resident_id,auth_user_id,is_active
) values (
  '71000000-0000-4000-8000-000000001001','71000000-0000-4000-8000-000000000001',
  'owner-resident@example.com','Owner Resident','resident','71000000-0000-4000-8000-000000000101',
  'd1000000-0000-4000-8000-000000000001',true
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","email":"owner-resident@example.com"}',
  true
);

do $$
declare
  v_today date := (now() at time zone 'America/Caracas')::date;
  v_group_pin jsonb;
  v_group_pin_retry jsonb;
  v_group_qr jsonb;
  v_event_pin uuid;
  v_event_pin_retry uuid;
  v_event_qr uuid;
begin
  if public.current_community_resident_id('71000000-0000-4000-8000-000000000001')
    <> '71000000-0000-4000-8000-000000000101'::uuid then
    raise exception 'resident context was not resolved' using errcode='42501';
  end if;

  v_group_pin := public.create_arrival_invitation_group(
    '71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000101',
    'visitor',v_today,'all_day',null,null,null,null,null,null,'pin',
    '[{"fullName":"Pin Guest One"},{"fullName":"Pin Guest Two"}]'::jsonb,
    '71000000-0000-4000-8000-000000008001'
  );
  v_group_pin_retry := public.create_arrival_invitation_group(
    '71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000101',
    'visitor',v_today,'all_day',null,null,null,null,null,null,'pin',
    '[{"fullName":"Pin Guest One"},{"fullName":"Pin Guest Two"}]'::jsonb,
    '71000000-0000-4000-8000-000000008001'
  );
  if v_group_pin_retry->>'groupId' <> v_group_pin->>'groupId' then
    raise exception 'group idempotent retry returned a different group';
  end if;

  v_group_qr := public.create_arrival_invitation_group(
    '71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000101',
    'visitor',v_today,'from_time','11:00',null,null,null,null,null,'qr',
    '[{"fullName":"QR Guest One"},{"fullName":"QR Guest Two"}]'::jsonb,
    '71000000-0000-4000-8000-000000008002'
  );

  if (select count(*) from public.invitations where group_id=(v_group_pin->>'groupId')::uuid) <> 2
    or (select count(*) from public.invitations where group_id=(v_group_qr->>'groupId')::uuid) <> 2 then
    raise exception 'group did not create two invitations';
  end if;
  if (select count(distinct public.get_invitation_credential(i.id)->>'credential_value')
      from public.invitations i where i.group_id=(v_group_pin->>'groupId')::uuid) <> 2 then
    raise exception 'PIN group credentials are not individual';
  end if;
  if (select count(distinct public.get_invitation_credential(i.id)->>'credential_value')
      from public.invitations i where i.group_id=(v_group_qr->>'groupId')::uuid) <> 2 then
    raise exception 'QR group credentials are not individual';
  end if;

  v_event_pin := public.create_arrival_resident_event(
    '71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000101',
    'PIN event',v_today,'all_day',null,null,null,null,null,null,'pin',
    '[{"fullName":"Solo Guest","allowsCompanions":false,"maxCompanions":0}]'::jsonb,
    '71000000-0000-4000-8000-000000008003'
  );
  v_event_pin_retry := public.create_arrival_resident_event(
    '71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000101',
    'PIN event',v_today,'all_day',null,null,null,null,null,null,'pin',
    '[{"fullName":"Solo Guest","allowsCompanions":false,"maxCompanions":0}]'::jsonb,
    '71000000-0000-4000-8000-000000008003'
  );
  if v_event_pin_retry <> v_event_pin then
    raise exception 'event idempotent retry returned a different event';
  end if;

  v_event_qr := public.create_arrival_resident_event(
    '71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000101',
    'QR event',v_today,'from_time','18:00',null,null,null,null,null,'qr',
    '[
      {"fullName":"Guest One","allowsCompanions":true,"maxCompanions":1},
      {"fullName":"Guest Two","allowsCompanions":true,"maxCompanions":2},
      {"fullName":"Guest Three","allowsCompanions":true,"maxCompanions":3},
      {"fullName":"Guest Four","allowsCompanions":true,"maxCompanions":4},
      {"fullName":"Guest Five","allowsCompanions":true,"maxCompanions":5}
    ]'::jsonb,
    '71000000-0000-4000-8000-000000008004'
  );

  if jsonb_array_length(public.get_event_guest_credentials(v_event_pin)) <> 1 then
    raise exception 'PIN event credential was not created';
  end if;
  if (select count(distinct item->>'credential_value')
      from jsonb_array_elements(public.get_event_guest_credentials(v_event_qr)) item) <> 5 then
    raise exception 'QR event credentials are not individual';
  end if;
  if (select array_agg(max_companions order by max_companions) from public.event_guests where event_id=v_event_qr)
    <> array[1,2,3,4,5]::smallint[] then
    raise exception 'event companion limits were not stored';
  end if;
  if (select count(*) from public.resident_events where creation_idempotency_key in (
    '71000000-0000-4000-8000-000000008003','71000000-0000-4000-8000-000000008004'
  )) <> 2 then
    raise exception 'event retry created a duplicate';
  end if;
end $$;

rollback;
