-- Run only against a disposable local database after all migrations.
-- psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/group_individual_event_access.sql
begin;

insert into public.communities(id,name,address,location_label,planned_unit_count,access_policy_mode,gate_operation_mode,admin_contact_name,admin_contact_phone,created_by_email,time_zone)
values('51000000-0000-4000-8000-000000000001','Group access A','A','A',2,'invitation_only','24_7_guarded','Admin','+58001','admin-group@example.com','America/Caracas'),
('52000000-0000-4000-8000-000000000001','Group access B','B','B',2,'invitation_only','24_7_guarded','Admin','+58002','admin-b@example.com','America/Caracas');
insert into public.residents(id,community_id,full_name,phone) values
('51000000-0000-4000-8000-000000000101','51000000-0000-4000-8000-000000000001','Resident A','+58101'),
('52000000-0000-4000-8000-000000000101','52000000-0000-4000-8000-000000000001','Resident B','+58201');
insert into public.community_memberships(id,community_id,email,full_name,role,resident_id,auth_user_id,is_active) values
('51000000-0000-4000-8000-000000001001','51000000-0000-4000-8000-000000000001','admin-group@example.com','Admin A','admin',null,'b1000000-0000-4000-8000-000000000001',true),
('52000000-0000-4000-8000-000000001001','52000000-0000-4000-8000-000000000001','resident-b@example.com','Resident B','resident','52000000-0000-4000-8000-000000000101','b2000000-0000-4000-8000-000000000001',true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated","email":"admin-group@example.com"}',true);

do $$
declare v_group jsonb; v_group_retry jsonb; v_group_id uuid; v_event uuid; v_event_retry uuid; v_legacy_event uuid; v_secret text; v_validation jsonb; v_guest uuid; v_entry uuid; v_public jsonb; v_nine_visitors jsonb; v_credentials jsonb;
begin
  if (select pg_get_expr(adbin,adrelid) from pg_attrdef where adrelid='public.resident_events'::regclass and adnum=(select attnum from pg_attribute where attrelid='public.resident_events'::regclass and attname='credential_mode')) not like '%individual%' then raise exception 'new event default is not individual'; end if;
  begin
    perform public.create_invitation_group('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000101','visitor',current_date,'00:00',current_date+1,'23:59',false,null,'pin',
      '[{"fullName":"Valid person","phone":"+58111"},{"fullName":"x","phone":"+58222"}]'::jsonb,'51000000-0000-4000-8000-000000008000');
    raise exception 'invalid group was accepted';
  exception when sqlstate '22023' then null; end;
  if exists(select 1 from public.invitation_groups) then raise exception 'failed group left partial rows'; end if;

  v_group:=public.create_invitation_group('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000101','visitor',current_date,'00:00',current_date+1,'23:59',false,'Group note','pin',
    '[{"fullName":"First person","phone":"+58111"},{"fullName":"Second person","phone":"+58222"}]'::jsonb,'51000000-0000-4000-8000-000000008001');
  v_group_id:=(v_group->>'groupId')::uuid;
  v_group_retry:=public.create_invitation_group('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000101','visitor',current_date,'00:00',current_date+1,'23:59',false,'Group note','pin',
    '[{"fullName":"First person","phone":"+58111"},{"fullName":"Second person","phone":"+58222"}]'::jsonb,'51000000-0000-4000-8000-000000008001');
  if v_group_retry->>'groupId'<>v_group_id::text or (select count(*) from public.invitation_groups where creation_idempotency_key='51000000-0000-4000-8000-000000008001')<>1 then raise exception 'group creation is not idempotent'; end if;
  if (select count(*) from public.invitations where group_id=v_group_id)<>2 then raise exception 'group did not create two independent invitations'; end if;
  if (select count(distinct public.get_invitation_credential(i.id)->>'credential_value') from public.invitations i where i.group_id=v_group_id)<>2 then raise exception 'group credentials are not unique'; end if;
  select jsonb_agg(jsonb_build_object('fullName','Person '||number,'phone','+589'||number) order by number) into v_nine_visitors from generate_series(1,9) number;
  perform public.create_invitation_group('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000101','visitor',current_date,'00:00',current_date+1,'23:59',false,null,'pin',v_nine_visitors,'51000000-0000-4000-8000-000000008009');
  if (select count(*) from public.invitations i join public.invitation_groups g on g.id=i.group_id where g.creation_idempotency_key='51000000-0000-4000-8000-000000008009')<>9 then raise exception 'nine-person group was not created'; end if;
  update public.invitations set status='used' where id=(select id from public.invitations where group_id=v_group_id order by created_at,id limit 1);
  perform public.revoke_invitation_group('51000000-0000-4000-8000-000000000001',v_group_id);
  if (select count(*) from public.invitations where group_id=v_group_id and status='used')<>1 or (select count(*) from public.invitations where group_id=v_group_id and status='revoked')<>1 then raise exception 'group revoke changed a non-active member'; end if;

  insert into public.resident_events(community_id,resident_id,name,event_date,window_start,window_end_date,window_end,status,share_token,credential_mode)
  values('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000101','Legacy shared event',current_date-1,'00:00',current_date+1,'23:59','active','legacy-shared-event-token','shared') returning id into v_legacy_event;
  insert into public.event_guests(event_id,full_name) values(v_legacy_event,'Legacy guest');
  perform public.store_event_credential('51000000-0000-4000-8000-000000000001',v_legacy_event,'pin','12345678');
  if public.get_public_event('legacy-shared-event-token')->>'credential_type'<>'pin' then raise exception 'legacy shared event stopped working'; end if;

  v_event:=public.create_individual_resident_event('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000101','Private credentials',current_date-1,'00:00',current_date+1,'23:59',null,null,null,'qr',
    '[{"fullName":"Guest One","phone":"+58333","notes":"private","allowsCompanions":true,"maxCompanions":2},{"fullName":"Guest Two","allowsCompanions":false,"maxCompanions":0}]'::jsonb,'51000000-0000-4000-8000-000000008010');
  v_event_retry:=public.create_individual_resident_event('51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000101','Private credentials',current_date-1,'00:00',current_date+1,'23:59',null,null,null,'qr',
    '[{"fullName":"Guest One","phone":"+58333","notes":"private","allowsCompanions":true,"maxCompanions":2},{"fullName":"Guest Two","allowsCompanions":false,"maxCompanions":0}]'::jsonb,'51000000-0000-4000-8000-000000008010');
  if v_event_retry<>v_event or (select count(*) from public.resident_events where creation_idempotency_key='51000000-0000-4000-8000-000000008010')<>1 then raise exception 'event creation is not idempotent'; end if;
  if (select credential_mode from public.resident_events where id=v_event)<>'individual' then raise exception 'new event is not individual'; end if;
  v_credentials:=public.get_event_guest_credentials(v_event);
  if (select count(distinct item->>'credential_value') from jsonb_array_elements(v_credentials) item)<>2 then raise exception 'event guest credentials are not unique'; end if;
  select (item->>'event_guest_id')::uuid,item->>'credential_value' into strict v_guest,v_secret from jsonb_array_elements(v_credentials) item order by item->>'created_at' limit 1;
  v_validation:=public.validate_event_guest_credential('51000000-0000-4000-8000-000000000001','qr',v_secret,'device-identifier-123456','local-test');
  if v_validation->>'eventGuestId'<>v_guest::text then raise exception 'credential did not resolve the exact guest'; end if;
  v_public:=public.get_public_event_guest((select item->>'share_token' from jsonb_array_elements(v_credentials) item where (item->>'event_guest_id')::uuid=v_guest));
  if v_public ?| array['phone','notes','event_id','event_guest_id','guest_list','activity'] then raise exception 'public guest DTO leaks private fields'; end if;

  begin
    perform public.register_event_guest_entry(
      '51000000-0000-4000-8000-000000000001',v_event,
      (select id from public.event_guests where event_id=v_event and id<>v_guest limit 1),0,
      '51000000-0000-4000-8000-000000009000'
    );
    raise exception 'entry without credential validation was accepted';
  exception when sqlstate '42501' then null; end;

  v_entry:=public.register_event_guest_entry('51000000-0000-4000-8000-000000000001',v_event,v_guest,2,'51000000-0000-4000-8000-000000009001');
  if (select companion_count from public.visitor_entries where id=v_entry)<>2 then raise exception 'companion count was not stored'; end if;
  if public.register_event_guest_entry('51000000-0000-4000-8000-000000000001',v_event,v_guest,2,'51000000-0000-4000-8000-000000009001')<>v_entry then raise exception 'idempotent replay created another entry'; end if;
  begin perform public.register_event_guest_entry('51000000-0000-4000-8000-000000000001',v_event,v_guest,1,'51000000-0000-4000-8000-000000009001'); raise exception 'idempotency accepted different companion count'; exception when sqlstate '22023' then null; end;
end $$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b2000000-0000-4000-8000-000000000001","role":"authenticated","email":"resident-b@example.com"}',true);
do $$ begin
  if public.get_event_guest_credentials((select id from public.resident_events where community_id='51000000-0000-4000-8000-000000000001' limit 1)) <> '[]'::jsonb then raise exception 'cross-tenant credentials were exposed'; end if;
end $$;

rollback;
