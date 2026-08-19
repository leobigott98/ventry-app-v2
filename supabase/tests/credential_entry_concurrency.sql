-- Real two-session concurrency harness. Run only against a disposable/local DB:
-- psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 \
--   -v TEST_DATABASE_URL="$LOCAL_DATABASE_URL" \
--   -f supabase/tests/credential_entry_concurrency.sql

\if :{?TEST_DATABASE_URL}
\else
  \echo 'TEST_DATABASE_URL is required'
  \quit 1
\endif

create extension if not exists dblink;

delete from public.communities where id = '39000000-0000-4000-8000-000000000001';

insert into public.communities (
  id, name, address, location_label, planned_unit_count, access_policy_mode,
  gate_operation_mode, admin_contact_name, admin_contact_phone, created_by_email,
  time_zone
) values (
  '39000000-0000-4000-8000-000000000001', 'Concurrency', 'A', 'A', 1,
  'invitation_only', '24_7_guarded', 'Admin', '+58001', 'admin@example.com',
  'America/Caracas'
);

insert into public.residents (id, community_id, full_name, phone)
values (
  '39000000-0000-4000-8000-000000000101',
  '39000000-0000-4000-8000-000000000001', 'Resident', '+58101'
);

insert into public.community_memberships (
  id, community_id, email, full_name, role, auth_user_id, is_active
) values (
  '39000000-0000-4000-8000-000000001001',
  '39000000-0000-4000-8000-000000000001',
  'concurrent-guard@example.com', 'Concurrent Guard', 'guard',
  'a9000000-0000-4000-8000-000000000001', true
);

insert into public.invitations (
  id, community_id, resident_id, visitor_name, access_type, visit_date,
  window_start, window_end, no_time_limit, status, share_token
) values (
  '39000000-0000-4000-8000-000000002001',
  '39000000-0000-4000-8000-000000000001',
  '39000000-0000-4000-8000-000000000101', 'Concurrent Visitor', 'visitor',
  current_date - 1, '00:00', '23:59', true, 'active', 'concurrency-share'
);

select dblink_connect('entry_1', :'TEST_DATABASE_URL');
select dblink_connect('entry_2', :'TEST_DATABASE_URL');

select dblink_send_query('entry_1', $remote$
  begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    '{"sub":"a9000000-0000-4000-8000-000000000001","role":"authenticated","email":"concurrent-guard@example.com"}',
    true
  );
  do $body$
  begin
    perform public.register_invitation_entry(
      '39000000-0000-4000-8000-000000000001',
      '39000000-0000-4000-8000-000000002001',
      '39000000-0000-4000-8000-000000009001'
    );
    perform pg_sleep(1);
  end;
  $body$;
  commit;
$remote$);

select dblink_send_query('entry_2', $remote$
  begin;
  set local role authenticated;
  select set_config(
    'request.jwt.claims',
    '{"sub":"a9000000-0000-4000-8000-000000000001","role":"authenticated","email":"concurrent-guard@example.com"}',
    true
  );
  do $body$
  begin
    perform public.register_invitation_entry(
      '39000000-0000-4000-8000-000000000001',
      '39000000-0000-4000-8000-000000002001',
      '39000000-0000-4000-8000-000000009002'
    );
  end;
  $body$;
  commit;
$remote$);

do $$
begin
  while dblink_is_busy('entry_1') = 1 or dblink_is_busy('entry_2') = 1 loop
    perform pg_sleep(0.05);
  end loop;
end;
$$;

do $$
begin
  if (
    select count(*) from public.visitor_entries
    where invitation_id = '39000000-0000-4000-8000-000000002001'
  ) <> 1 then
    raise exception 'concurrent requests created more than one visitor entry';
  end if;
  if (
    select count(*) from public.access_events
    where invitation_id = '39000000-0000-4000-8000-000000002001'
      and access_event_type = 'entry_registered'
  ) <> 1 then
    raise exception 'concurrent requests created duplicate entry audit events';
  end if;
end;
$$;

delete from public.communities where id = '39000000-0000-4000-8000-000000000001';
