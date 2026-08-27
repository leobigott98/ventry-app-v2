-- Run only against a disposable local database after all migrations.
begin;

insert into public.communities(id,name,address,location_label,planned_unit_count,access_policy_mode,gate_operation_mode,admin_contact_name,admin_contact_phone,created_by_email,time_zone)
values('61000000-0000-4000-8000-000000000001','Arrival A','A','A',2,'invitation_only','24_7_guarded','Admin','+58001','arrival-admin@example.com','America/Caracas'),
('62000000-0000-4000-8000-000000000001','Arrival B','B','B',2,'invitation_only','24_7_guarded','Admin','+58002','arrival-b@example.com','Pacific/Kiritimati');
insert into public.residents(id,community_id,full_name,phone) values
('61000000-0000-4000-8000-000000000101','61000000-0000-4000-8000-000000000001','Resident A','+58101'),
('62000000-0000-4000-8000-000000000101','62000000-0000-4000-8000-000000000001','Resident B','+58201');
insert into public.community_memberships(id,community_id,email,full_name,role,auth_user_id,is_active)
values('61000000-0000-4000-8000-000000001001','61000000-0000-4000-8000-000000000001','arrival-admin@example.com','Admin A','admin','c1000000-0000-4000-8000-000000000001',true);

insert into public.invitations(
  community_id,resident_id,visitor_name,access_type,visit_date,window_start,window_end_date,window_end,
  no_time_limit,status,share_token,creation_idempotency_key,creation_request_fingerprint,
  arrival_window_mode,arrival_request_fingerprint
) values (
  '62000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000101','Private retry','visitor',current_date,
  '00:00',current_date,'23:59:59.999999',false,'active','arrival-private-retry',
  '62000000-0000-4000-8000-000000008001',digest('legacy','sha256'),'all_day',digest('private','sha256')
);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","email":"arrival-admin@example.com"}',true);

do $$
declare v_id uuid; v_group jsonb; v_event uuid; v_today date := (now() at time zone 'America/Caracas')::date;
begin
  v_id := public.create_arrival_invitation(
    '61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000101',null,
    'All day visitor',null,'visitor',v_today,'all_day',null,null,null,null,null,null,'pin',
    '61000000-0000-4000-8000-000000008001'
  );
  if (select arrival_window_mode<>'all_day' or no_time_limit or window_start<>'00:00'::time or window_end_date<>v_today from public.invitations where id=v_id) then
    raise exception 'all-day invitation was not finite and normalized';
  end if;
  if public.arrival_effective_status('active',v_today,'all_day',null,null,null,false,'America/Caracas',false)<>'active' then raise exception 'all-day status is not active today'; end if;
  if public.arrival_effective_status('active',v_today-1,'all_day',null,null,null,false,'America/Caracas',false)<>'expired' then raise exception 'all-day status did not expire locally'; end if;
  if public.arrival_effective_status('active',v_today+1,'all_day',null,null,null,false,'America/Caracas',false)<>'scheduled' then raise exception 'future window is not scheduled'; end if;
  if public.arrival_effective_status('used',v_today+1,'all_day',null,null,null,false,'America/Caracas',true)<>'used' then raise exception 'used precedence failed'; end if;
  if public.arrival_effective_status('revoked',v_today+1,'all_day',null,null,null,false,'America/Caracas',false)<>'revoked' then raise exception 'revoked precedence failed'; end if;

  if public.create_arrival_invitation(
    '61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000101',null,
    'All day visitor',null,'visitor',v_today,'all_day',null,null,null,null,null,null,'pin',
    '61000000-0000-4000-8000-000000008001'
  )<>v_id then raise exception 'idempotent retry created or returned another invitation'; end if;
  begin
    perform public.create_arrival_invitation(
      '61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000101',null,
      'Changed request',null,'visitor',v_today,'all_day',null,null,null,null,null,null,'pin',
      '61000000-0000-4000-8000-000000008001'
    );
    raise exception 'changed request reused an idempotency key';
  exception when sqlstate '22023' then null; end;

  begin
    perform public.create_arrival_invitation('62000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000101',null,'Private retry',null,'visitor',v_today,'all_day',null,null,null,null,null,null,'pin','62000000-0000-4000-8000-000000008001');
    raise exception 'cross-community idempotent retry was accepted';
  exception when sqlstate '42501' then null; end;

  v_group := public.create_arrival_invitation_group('61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000101','visitor',v_today,'from_time','14:00',null,null,v_today,'16:00',null,'qr','[{"fullName":"Ana"},{"fullName":"Carlos"}]','61000000-0000-4000-8000-000000008003');
  if (select count(distinct public.get_invitation_credential(i.id)->>'credential_value') from public.invitations i where i.group_id=(v_group->>'groupId')::uuid)<>2 then raise exception 'group credentials are not individual'; end if;

  v_event := public.create_arrival_resident_event('61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000101','Arrival event',v_today,'from_time','12:00',v_today,'18:00',v_today,'16:00',null,'pin','[{"fullName":"Guest","allowsCompanions":false,"maxCompanions":0}]','61000000-0000-4000-8000-000000008004');
  if (select planned_exit_time from public.resident_events where id=v_event)<>'16:00'::time then raise exception 'planned exit before arrival close was rejected or changed'; end if;
end $$;

rollback;
