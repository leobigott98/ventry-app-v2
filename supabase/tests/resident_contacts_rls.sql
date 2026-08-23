-- Run only against a disposable/local database after all migrations:
-- psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/resident_contacts_rls.sql
-- Every fixture is rolled back.
begin;

insert into public.communities (id, name, address, location_label, planned_unit_count, access_policy_mode, gate_operation_mode, admin_contact_name, admin_contact_phone, created_by_email)
values
  ('31000000-0000-4000-8000-000000000001', 'Contact RLS', 'A', 'A', 2, 'invitation_only', '24_7_guarded', 'Admin', '+58000', 'admin@example.com'),
  ('32000000-0000-4000-8000-000000000001', 'Foreign Contact RLS', 'B', 'B', 1, 'invitation_only', '24_7_guarded', 'Admin B', '+58001', 'admin-b@example.com');
insert into public.units (id, community_id, identifier) values
  ('31000000-0000-4000-8000-000000000010', '31000000-0000-4000-8000-000000000001', 'A-01'),
  ('32000000-0000-4000-8000-000000000010', '32000000-0000-4000-8000-000000000001', 'B-01');
insert into public.residents (id, community_id, unit_id, full_name, phone) values
  ('31000000-0000-4000-8000-000000000101', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000010', 'Resident One', '+58101'),
  ('31000000-0000-4000-8000-000000000102', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000010', 'Resident Two', '+58102'),
  ('32000000-0000-4000-8000-000000000101', '32000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000010', 'Foreign Resident', '+58201');
insert into public.community_memberships (id, community_id, email, full_name, role, resident_id, auth_user_id, is_primary, is_active) values
  ('31000000-0000-4000-8000-000000001001', '31000000-0000-4000-8000-000000000001', 'admin@example.com', 'Admin', 'admin', null, '31000000-0000-4000-8000-000000009001', true, true),
  ('31000000-0000-4000-8000-000000001002', '31000000-0000-4000-8000-000000000001', 'guard@example.com', 'Guard', 'guard', null, '31000000-0000-4000-8000-000000009002', false, true),
  ('31000000-0000-4000-8000-000000001003', '31000000-0000-4000-8000-000000000001', 'one@example.com', 'One', 'resident', '31000000-0000-4000-8000-000000000101', '31000000-0000-4000-8000-000000009003', false, true),
  ('31000000-0000-4000-8000-000000001004', '31000000-0000-4000-8000-000000000001', 'two@example.com', 'Two', 'resident', '31000000-0000-4000-8000-000000000102', '31000000-0000-4000-8000-000000009004', false, true);
insert into public.resident_contacts (id, community_id, resident_id, name, phone, normalized_phone) values
  ('31000000-0000-4000-8000-000000002001', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', 'Contact One', '04125550101', '+584125550101'),
  ('31000000-0000-4000-8000-000000002002', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000102', 'Contact Two', '04125550102', '+584125550102'),
  ('32000000-0000-4000-8000-000000002001', '32000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000101', 'Foreign Contact', '04125550201', '+584125550201');
update public.resident_contacts set relationship_label = 'Médico familiar'
where id = '31000000-0000-4000-8000-000000002001';
insert into public.invitation_groups (id, community_id, resident_id, unit_id, access_type, visit_date, window_start, window_end_date, window_end, credential_type, creation_idempotency_key, creation_request_fingerprint)
values ('31000000-0000-4000-8000-000000004001', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', '31000000-0000-4000-8000-000000000010', 'visitor', current_date, '08:00', current_date, '20:00', 'pin', '31000000-0000-4000-8000-000000008001', decode('00', 'hex'));
insert into public.invitations (id, community_id, resident_id, unit_id, visitor_name, visitor_phone, access_type, visit_date, window_start, window_end, status, share_token) values
  ('31000000-0000-4000-8000-000000003001', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', '31000000-0000-4000-8000-000000000010', 'Contact One', '04125550101', 'visitor', current_date, '08:00', '20:00', 'active', 'contact-one-invite'),
  ('31000000-0000-4000-8000-000000003002', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000102', '31000000-0000-4000-8000-000000000010', 'Contact Two', '04125550102', 'visitor', current_date, '08:00', '20:00', 'active', 'contact-two-invite');
insert into public.invitations (id, community_id, resident_id, unit_id, group_id, visitor_name, visitor_phone, access_type, visit_date, window_start, window_end, status, share_token) values
  ('31000000-0000-4000-8000-000000003003', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', '31000000-0000-4000-8000-000000000010', '31000000-0000-4000-8000-000000004001', 'Contact One', '+58 412 555 0101', 'visitor', current_date, '08:00', '20:00', 'active', 'contact-one-group-invite'),
  ('31000000-0000-4000-8000-000000003004', '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', '31000000-0000-4000-8000-000000000010', null, 'Contact One', '+58 424 555 0101', 'visitor', current_date, '08:00', '20:00', 'active', 'same-name-different-phone');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000009003","role":"authenticated","email":"one@example.com"}', true);
do $$
declare
  v_first_invitation uuid;
  v_retried_invitation uuid;
begin
  if (select count(*) from public.resident_contacts) <> 1 then raise exception 'resident can see another resident contact'; end if;
  begin
    insert into public.resident_contacts (community_id, resident_id, name, phone, normalized_phone)
    values ('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000102', 'Cross resident', '04125550999', '+584125550999');
    raise exception 'resident inserted a contact for another resident';
  exception when insufficient_privilege then null; end;
  begin
    update public.resident_contacts set invitation_count = 99
    where id = '31000000-0000-4000-8000-000000002001';
    raise exception 'resident changed system-managed contact metrics';
  exception when insufficient_privilege then null; end;
  if not public.record_resident_contact_invitation('31000000-0000-4000-8000-000000002001', '31000000-0000-4000-8000-000000003001') then raise exception 'first use not recorded'; end if;
  if public.record_resident_contact_invitation('31000000-0000-4000-8000-000000002001', '31000000-0000-4000-8000-000000003001') then raise exception 'duplicate use recorded'; end if;
  if (select invitation_count from public.resident_contacts where id = '31000000-0000-4000-8000-000000002001') <> 1 then raise exception 'metric not idempotent'; end if;
  if (select count(*) from public.get_resident_contact_views('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', 1, 50)) <> 2 then
    raise exception 'unified view did not deduplicate saved/history or separated same-name phones incorrectly';
  end if;
  if not exists (
    select 1 from public.get_resident_contact_views('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', 1, 50)
    where saved_contact_id = '31000000-0000-4000-8000-000000002001' and invitation_count = 2 and origin = 'both'
  ) then raise exception 'saved contact did not merge individual and grouped invitation history'; end if;
  if not exists (
    select 1 from public.get_resident_contact_views('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', 1, 50)
    where saved_contact_id is null and phone = '+58 424 555 0101' and invitation_count = 1
  ) then raise exception 'same name with a different phone was merged incorrectly'; end if;
  if (select count(*) from public.search_resident_contact_views('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', 'contact', 5)) <> 2 then
    raise exception 'autocomplete did not return the resident unified contacts';
  end if;
  if not exists (
    select 1 from public.search_resident_contact_views('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', 'medico', 5)
    where saved_contact_id = '31000000-0000-4000-8000-000000002001'
  ) then raise exception 'autocomplete is not accent-insensitive for relationship labels'; end if;
  if exists (
    select 1 from public.search_resident_contact_views('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', '0102', 5)
  ) then raise exception 'autocomplete exposed another resident phone'; end if;
  begin
    perform public.search_resident_contact_views('32000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000101', 'foreign', 5);
    raise exception 'resident searched contacts in another community';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.resident_contacts (community_id, resident_id, name, phone, normalized_phone)
    values ('32000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000101', 'Cross community', '04125550998', '+584125550998');
    raise exception 'resident inserted a contact in another community';
  exception when insufficient_privilege then null; end;
  v_first_invitation := public.create_individual_invitation(
    '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', null,
    'Retry Guest', null, 'visitor', current_date, '10:00', current_date, '12:00', false,
    null, 'pin', '31000000-0000-4000-8000-000000008099'
  );
  v_retried_invitation := public.create_individual_invitation(
    '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', null,
    'Retry Guest', null, 'visitor', current_date, '10:00', current_date, '12:00', false,
    null, 'pin', '31000000-0000-4000-8000-000000008099'
  );
  if v_first_invitation is distinct from v_retried_invitation then
    raise exception 'individual invitation retry created a second invitation';
  end if;
  if (select count(*) from public.invitations where id = v_first_invitation) <> 1 then
    raise exception 'individual invitation idempotency row is inconsistent';
  end if;
  begin
    perform public.record_resident_contact_invitation('31000000-0000-4000-8000-000000002002', '31000000-0000-4000-8000-000000003001');
    raise exception 'resident linked another resident contact';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000009001","role":"authenticated","email":"admin@example.com"}', true);
do $$ begin
  if (select count(*) from public.resident_contacts) <> 0 then raise exception 'admin can read contacts'; end if;
  begin
    perform public.get_resident_contact_views('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', 1, 50);
    raise exception 'admin can aggregate private contacts';
  exception when insufficient_privilege then null; end;
  begin
    perform public.search_resident_contact_views('31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000101', 'contact', 5);
    raise exception 'admin can search private contacts';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"31000000-0000-4000-8000-000000009002","role":"authenticated","email":"guard@example.com"}', true);
do $$ begin if (select count(*) from public.resident_contacts) <> 0 then raise exception 'guard can read contacts'; end if; end $$;

rollback;
