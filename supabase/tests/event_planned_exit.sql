-- Run only against a disposable/local database after all migrations.
-- psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/event_planned_exit.sql
begin;

insert into public.communities (
  id, name, address, location_label, planned_unit_count, access_policy_mode,
  gate_operation_mode, admin_contact_name, admin_contact_phone, created_by_email
) values (
  '41000000-0000-4000-8000-000000000001', 'Planned exit test', 'A', 'A', 1,
  'invitation_only', '24_7_guarded', 'Admin', '+58001', 'admin@example.com'
);

insert into public.residents (id, community_id, full_name, phone)
values ('41000000-0000-4000-8000-000000000101', '41000000-0000-4000-8000-000000000001', 'Resident', '+58101');

insert into public.resident_events (
  id, community_id, resident_id, name, event_date, window_start,
  window_end_date, window_end, planned_exit_date, planned_exit_time, share_token
) values (
  '41000000-0000-4000-8000-000000003001',
  '41000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000101',
  'Valid planned exit', current_date, '10:00', current_date, '18:00',
  current_date, '18:00', 'valid-planned-exit'
);

do $$
begin
  begin
    insert into public.resident_events (
      community_id, resident_id, name, event_date, window_start,
      window_end_date, window_end, planned_exit_date, planned_exit_time, share_token
    ) values (
      '41000000-0000-4000-8000-000000000001',
      '41000000-0000-4000-8000-000000000101',
      'Incomplete pair', current_date, '10:00', current_date, '18:00',
      current_date, null, 'invalid-planned-exit-pair'
    );
    raise exception 'incomplete planned-exit pair was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.resident_events (
      community_id, resident_id, name, event_date, window_start,
      window_end_date, window_end, planned_exit_date, planned_exit_time, share_token
    ) values (
      '41000000-0000-4000-8000-000000000001',
      '41000000-0000-4000-8000-000000000101',
      'Early planned exit', current_date, '10:00', current_date, '18:00',
      current_date, '17:59', 'invalid-planned-exit-order'
    );
    raise exception 'planned exit before valid-until was accepted';
  exception when check_violation then null;
  end;
end;
$$;

rollback;
