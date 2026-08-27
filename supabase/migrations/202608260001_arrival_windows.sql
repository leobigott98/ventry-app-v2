-- Explicit arrival windows and informational planned exit.
-- Legacy indefinite rows are preserved for manual review; every new write is finite.

set search_path = pg_catalog, extensions, public;

alter table public.invitations
  add column if not exists arrival_window_mode text,
  add column if not exists arrival_start time,
  add column if not exists arrival_end_date date,
  add column if not exists arrival_end time,
  add column if not exists planned_exit_date date,
  add column if not exists planned_exit_time time,
  add column if not exists legacy_indefinite boolean not null default false,
  add column if not exists arrival_request_fingerprint bytea;

alter table public.invitation_groups
  add column if not exists arrival_window_mode text,
  add column if not exists arrival_start time,
  add column if not exists arrival_end_date date,
  add column if not exists arrival_end time,
  add column if not exists planned_exit_date date,
  add column if not exists planned_exit_time time,
  add column if not exists legacy_indefinite boolean not null default false,
  add column if not exists arrival_request_fingerprint bytea;

alter table public.resident_events
  add column if not exists arrival_window_mode text,
  add column if not exists arrival_start time,
  add column if not exists arrival_end_date date,
  add column if not exists arrival_end time,
  add column if not exists arrival_request_fingerprint bytea;

-- Deterministic backfill. Finite legacy windows keep their exact meaning. Indefinite
-- rows stay explicitly legacy and are not silently converted to all-day access.
update public.invitations
set legacy_indefinite = true
where no_time_limit = true;

update public.invitations
set arrival_window_mode = 'from_time',
    arrival_start = window_start,
    arrival_end_date = coalesce(window_end_date, visit_date),
    arrival_end = window_end
where no_time_limit = false and arrival_window_mode is null;

update public.invitation_groups
set legacy_indefinite = true
where no_time_limit = true;

update public.invitation_groups
set arrival_window_mode = 'from_time',
    arrival_start = window_start,
    arrival_end_date = coalesce(window_end_date, visit_date),
    arrival_end = window_end
where no_time_limit = false and arrival_window_mode is null;

update public.resident_events
set arrival_window_mode = 'from_time',
    arrival_start = window_start,
    arrival_end_date = window_end_date,
    arrival_end = window_end
where arrival_window_mode is null;

alter table public.invitations
  drop constraint if exists invitations_arrival_window_check,
  drop constraint if exists invitations_planned_exit_pair_check,
  drop constraint if exists invitations_planned_exit_after_start_check,
  add constraint invitations_arrival_window_check check (
    (legacy_indefinite and no_time_limit and arrival_window_mode is null)
    or (
      not legacy_indefinite and not no_time_limit
      and arrival_window_mode in ('all_day', 'from_time')
      and ((arrival_window_mode = 'all_day' and arrival_start is null and arrival_end_date is null and arrival_end is null)
        or (arrival_window_mode = 'from_time' and arrival_start is not null
          and ((arrival_end_date is null and arrival_end is null)
            or (arrival_end_date is not null and arrival_end is not null
              and arrival_end_date + arrival_end > visit_date + arrival_start))))
    )
  ),
  add constraint invitations_planned_exit_pair_check check ((planned_exit_date is null) = (planned_exit_time is null)),
  add constraint invitations_planned_exit_after_start_check check (
    planned_exit_date is null
    or planned_exit_date + planned_exit_time > visit_date + coalesce(arrival_start, '00:00'::time)
  );

alter table public.invitation_groups
  drop constraint if exists invitation_groups_arrival_window_check,
  drop constraint if exists invitation_groups_planned_exit_pair_check,
  drop constraint if exists invitation_groups_planned_exit_after_start_check,
  add constraint invitation_groups_arrival_window_check check (
    (legacy_indefinite and no_time_limit and arrival_window_mode is null)
    or (
      not legacy_indefinite and not no_time_limit
      and arrival_window_mode in ('all_day', 'from_time')
      and ((arrival_window_mode = 'all_day' and arrival_start is null and arrival_end_date is null and arrival_end is null)
        or (arrival_window_mode = 'from_time' and arrival_start is not null
          and ((arrival_end_date is null and arrival_end is null)
            or (arrival_end_date is not null and arrival_end is not null
              and arrival_end_date + arrival_end > visit_date + arrival_start))))
    )
  ),
  add constraint invitation_groups_planned_exit_pair_check check ((planned_exit_date is null) = (planned_exit_time is null)),
  add constraint invitation_groups_planned_exit_after_start_check check (
    planned_exit_date is null
    or planned_exit_date + planned_exit_time > visit_date + coalesce(arrival_start, '00:00'::time)
  );

alter table public.resident_events
  drop constraint if exists resident_events_planned_exit_after_window_check,
  drop constraint if exists resident_events_planned_exit_after_start_check,
  drop constraint if exists resident_events_arrival_window_check,
  add constraint resident_events_arrival_window_check check (
    arrival_window_mode in ('all_day', 'from_time')
    and ((arrival_window_mode = 'all_day' and arrival_start is null and arrival_end_date is null and arrival_end is null)
      or (arrival_window_mode = 'from_time' and arrival_start is not null
        and ((arrival_end_date is null and arrival_end is null)
          or (arrival_end_date is not null and arrival_end is not null
            and arrival_end_date + arrival_end > event_date + arrival_start))))
  ),
  add constraint resident_events_planned_exit_after_start_check check (
    planned_exit_date is null
    or planned_exit_date + planned_exit_time > event_date + coalesce(arrival_start, '00:00'::time)
  );

create or replace function public.sync_invitation_arrival_compatibility()
returns trigger language plpgsql
set search_path = 'pg_catalog', 'public' as $$
begin
  if new.legacy_indefinite then return new; end if;
  if new.arrival_window_mode is null then
    if new.no_time_limit then
      new.arrival_window_mode := 'all_day';
      new.arrival_start := null; new.arrival_end_date := null; new.arrival_end := null;
    else
      new.arrival_window_mode := 'from_time';
      new.arrival_start := new.window_start;
      new.arrival_end_date := coalesce(new.window_end_date, new.visit_date);
      new.arrival_end := new.window_end;
    end if;
  end if;
  new.no_time_limit := false;
  if new.arrival_window_mode = 'all_day' then
    new.window_start := '00:00'::time;
    new.window_end_date := new.visit_date;
    new.window_end := '23:59:59.999999'::time;
  else
    new.window_start := new.arrival_start;
    new.window_end_date := coalesce(new.arrival_end_date, new.visit_date);
    new.window_end := coalesce(new.arrival_end, '23:59:59.999999'::time);
  end if;
  return new;
end $$;

create or replace function public.sync_event_arrival_compatibility()
returns trigger language plpgsql
set search_path = 'pg_catalog', 'public' as $$
begin
  if new.arrival_window_mode is null then
    new.arrival_window_mode := 'from_time';
    new.arrival_start := new.window_start;
    new.arrival_end_date := new.window_end_date;
    new.arrival_end := new.window_end;
  end if;
  if new.arrival_window_mode = 'all_day' then
    new.window_start := '00:00'::time;
    new.window_end_date := new.event_date;
    new.window_end := '23:59:59.999999'::time;
  else
    new.window_start := new.arrival_start;
    new.window_end_date := coalesce(new.arrival_end_date, new.event_date);
    new.window_end := coalesce(new.arrival_end, '23:59:59.999999'::time);
  end if;
  return new;
end $$;

revoke all on function public.sync_invitation_arrival_compatibility() from public;
revoke all on function public.sync_event_arrival_compatibility() from public;

drop trigger if exists sync_invitation_arrival_compatibility on public.invitations;
create trigger sync_invitation_arrival_compatibility before insert or update of
  visit_date, window_start, window_end_date, window_end, no_time_limit,
  arrival_window_mode, arrival_start, arrival_end_date, arrival_end
on public.invitations for each row execute function public.sync_invitation_arrival_compatibility();

drop trigger if exists sync_invitation_group_arrival_compatibility on public.invitation_groups;
create trigger sync_invitation_group_arrival_compatibility before insert or update of
  visit_date, window_start, window_end_date, window_end, no_time_limit,
  arrival_window_mode, arrival_start, arrival_end_date, arrival_end
on public.invitation_groups for each row execute function public.sync_invitation_arrival_compatibility();

drop trigger if exists sync_event_arrival_compatibility on public.resident_events;
create trigger sync_event_arrival_compatibility before insert or update of
  event_date, window_start, window_end_date, window_end,
  arrival_window_mode, arrival_start, arrival_end_date, arrival_end
on public.resident_events for each row execute function public.sync_event_arrival_compatibility();

create or replace function public.create_arrival_invitation(
  p_community_id uuid, p_resident_id uuid, p_resident_contact_id uuid,
  p_visitor_name text, p_visitor_phone text, p_access_type text,
  p_visit_date date, p_arrival_window_mode text, p_arrival_start time,
  p_arrival_end_date date, p_arrival_end time,
  p_planned_exit_date date, p_planned_exit_time time,
  p_notes text, p_credential_type text, p_idempotency_key uuid
) returns uuid language plpgsql security definer
set search_path = 'pg_catalog', 'extensions', 'public' as $$
declare v_id uuid; v_fingerprint bytea; v_existing bytea; v_start time; v_end_date date; v_end time;
begin
  if not (public.has_active_community_role(p_community_id,array['admin'])
    or p_resident_id=public.current_community_resident_id(p_community_id)) then
    raise exception 'arrival invitation creation is not allowed' using errcode='42501';
  end if;
  if not exists(select 1 from public.residents r where r.id=p_resident_id and r.community_id=p_community_id and r.is_active) then
    raise exception 'resident not found' using errcode='P0002';
  end if;
  if p_resident_contact_id is not null and not exists (
    select 1 from public.resident_contacts c where c.id=p_resident_contact_id
      and c.community_id=p_community_id and c.resident_id=p_resident_id
  ) then raise exception 'resident contact is outside invitation scope' using errcode='42501'; end if;
  if p_idempotency_key is null or p_arrival_window_mode not in ('all_day','from_time')
    or (p_arrival_window_mode='all_day' and (p_arrival_start is not null or p_arrival_end_date is not null or p_arrival_end is not null))
    or (p_arrival_window_mode='from_time' and p_arrival_start is null)
    or ((p_arrival_end_date is null) <> (p_arrival_end is null))
    or (p_arrival_end is not null and p_arrival_end_date+p_arrival_end <= p_visit_date+p_arrival_start)
    or ((p_planned_exit_date is null) <> (p_planned_exit_time is null))
    or (p_planned_exit_date is not null and p_planned_exit_date+p_planned_exit_time <= p_visit_date+coalesce(p_arrival_start,'00:00'::time)) then
    raise exception 'invalid arrival window' using errcode='22023';
  end if;
  v_start := case when p_arrival_window_mode='all_day' then '00:00'::time else p_arrival_start end;
  v_end_date := coalesce(p_arrival_end_date,p_visit_date);
  v_end := coalesce(p_arrival_end,'23:59:59.999999'::time);
  v_fingerprint := digest(jsonb_build_object('residentId',p_resident_id,'residentContactId',p_resident_contact_id,'visitorName',nullif(trim(p_visitor_name),''),'visitorPhone',nullif(trim(p_visitor_phone),''),'accessType',p_access_type,'visitDate',p_visit_date,'mode',p_arrival_window_mode,'start',p_arrival_start,'endDate',p_arrival_end_date,'end',p_arrival_end,'plannedExitDate',p_planned_exit_date,'plannedExitTime',p_planned_exit_time,'notes',nullif(trim(p_notes),''),'credentialType',p_credential_type)::text,'sha256');
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':'||p_resident_id::text||':'||p_idempotency_key::text,0));
  select id,arrival_request_fingerprint into v_id,v_existing from public.invitations
  where community_id=p_community_id and resident_id=p_resident_id and group_id is null and creation_idempotency_key=p_idempotency_key;
  if found then
    if v_existing is distinct from v_fingerprint then raise exception 'idempotency key was used for another arrival invitation' using errcode='22023'; end if;
    return v_id;
  end if;
  v_id := public.create_individual_invitation(p_community_id,p_resident_id,p_resident_contact_id,p_visitor_name,p_visitor_phone,p_access_type,p_visit_date,v_start,v_end_date,v_end,false,p_notes,p_credential_type,p_idempotency_key);
  update public.invitations set arrival_window_mode=p_arrival_window_mode,arrival_start=p_arrival_start,arrival_end_date=p_arrival_end_date,arrival_end=p_arrival_end,
    planned_exit_date=p_planned_exit_date,planned_exit_time=p_planned_exit_time,legacy_indefinite=false,arrival_request_fingerprint=v_fingerprint where id=v_id;
  return v_id;
end $$;

revoke all on function public.create_arrival_invitation(uuid,uuid,uuid,text,text,text,date,text,time,date,time,date,time,text,text,uuid) from public;
grant execute on function public.create_arrival_invitation(uuid,uuid,uuid,text,text,text,date,text,time,date,time,date,time,text,text,uuid) to authenticated;

create or replace function public.create_arrival_invitation_group(
  p_community_id uuid, p_resident_id uuid, p_access_type text,
  p_visit_date date, p_arrival_window_mode text, p_arrival_start time,
  p_arrival_end_date date, p_arrival_end time,
  p_planned_exit_date date, p_planned_exit_time time,
  p_notes text, p_credential_type text, p_visitors jsonb, p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path = 'pg_catalog', 'extensions', 'public' as $$
declare v_result jsonb; v_group_id uuid; v_fingerprint bytea; v_existing bytea; v_start time; v_end_date date; v_end time;
begin
  if not (public.has_active_community_role(p_community_id,array['admin'])
    or p_resident_id=public.current_community_resident_id(p_community_id)) then
    raise exception 'arrival group creation is not allowed' using errcode='42501';
  end if;
  if not exists(select 1 from public.residents r where r.id=p_resident_id and r.community_id=p_community_id and r.is_active) then
    raise exception 'resident not found' using errcode='P0002';
  end if;
  if p_idempotency_key is null or p_arrival_window_mode not in ('all_day','from_time')
    or (p_arrival_window_mode='all_day' and (p_arrival_start is not null or p_arrival_end_date is not null or p_arrival_end is not null))
    or (p_arrival_window_mode='from_time' and p_arrival_start is null)
    or ((p_arrival_end_date is null) <> (p_arrival_end is null))
    or (p_arrival_end is not null and p_arrival_end_date+p_arrival_end <= p_visit_date+p_arrival_start)
    or ((p_planned_exit_date is null) <> (p_planned_exit_time is null))
    or (p_planned_exit_date is not null and p_planned_exit_date+p_planned_exit_time <= p_visit_date+coalesce(p_arrival_start,'00:00'::time)) then raise exception 'invalid arrival window' using errcode='22023'; end if;
  v_start:=case when p_arrival_window_mode='all_day' then '00:00'::time else p_arrival_start end;
  v_end_date:=coalesce(p_arrival_end_date,p_visit_date); v_end:=coalesce(p_arrival_end,'23:59:59.999999'::time);
  v_fingerprint:=digest(jsonb_build_object('residentId',p_resident_id,'accessType',p_access_type,'visitDate',p_visit_date,'mode',p_arrival_window_mode,'start',p_arrival_start,'endDate',p_arrival_end_date,'end',p_arrival_end,'plannedExitDate',p_planned_exit_date,'plannedExitTime',p_planned_exit_time,'notes',nullif(trim(p_notes),''),'credentialType',p_credential_type,'visitors',p_visitors)::text,'sha256');
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':'||p_resident_id::text||':'||p_idempotency_key::text,0));
  select id,arrival_request_fingerprint into v_group_id,v_existing from public.invitation_groups where community_id=p_community_id and resident_id=p_resident_id and creation_idempotency_key=p_idempotency_key;
  if found then
    if v_existing is distinct from v_fingerprint then raise exception 'idempotency key was used for another arrival group' using errcode='22023'; end if;
    select jsonb_build_object('groupId',v_group_id,'invitationIds',coalesce(jsonb_agg(i.id order by i.created_at,i.id),'[]'::jsonb)) into v_result from public.invitations i where i.group_id=v_group_id;
    return v_result;
  end if;
  v_result:=public.create_invitation_group(p_community_id,p_resident_id,p_access_type,p_visit_date,v_start,v_end_date,v_end,false,p_notes,p_credential_type,p_visitors,p_idempotency_key);
  v_group_id:=(v_result->>'groupId')::uuid;
  update public.invitation_groups set arrival_window_mode=p_arrival_window_mode,arrival_start=p_arrival_start,arrival_end_date=p_arrival_end_date,arrival_end=p_arrival_end,planned_exit_date=p_planned_exit_date,planned_exit_time=p_planned_exit_time,legacy_indefinite=false,arrival_request_fingerprint=v_fingerprint where id=v_group_id;
  update public.invitations set arrival_window_mode=p_arrival_window_mode,arrival_start=p_arrival_start,arrival_end_date=p_arrival_end_date,arrival_end=p_arrival_end,planned_exit_date=p_planned_exit_date,planned_exit_time=p_planned_exit_time,legacy_indefinite=false where group_id=v_group_id;
  return v_result;
end $$;

revoke all on function public.create_arrival_invitation_group(uuid,uuid,text,date,text,time,date,time,date,time,text,text,jsonb,uuid) from public;
grant execute on function public.create_arrival_invitation_group(uuid,uuid,text,date,text,time,date,time,date,time,text,text,jsonb,uuid) to authenticated;

create or replace function public.create_arrival_resident_event(
  p_community_id uuid,p_resident_id uuid,p_name text,p_event_date date,
  p_arrival_window_mode text,p_arrival_start time,p_arrival_end_date date,p_arrival_end time,
  p_planned_exit_date date,p_planned_exit_time time,p_notes text,p_credential_type text,
  p_guests jsonb,p_idempotency_key uuid
) returns uuid language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_id uuid; v_fingerprint bytea; v_existing bytea; v_start time; v_end_date date; v_end time;
begin
  if not (public.has_active_community_role(p_community_id,array['admin'])
    or p_resident_id=public.current_community_resident_id(p_community_id)) then
    raise exception 'arrival event creation is not allowed' using errcode='42501';
  end if;
  if not exists(select 1 from public.residents r where r.id=p_resident_id and r.community_id=p_community_id and r.is_active) then
    raise exception 'resident not found' using errcode='P0002';
  end if;
  if p_idempotency_key is null or p_arrival_window_mode not in ('all_day','from_time')
    or (p_arrival_window_mode='all_day' and (p_arrival_start is not null or p_arrival_end_date is not null or p_arrival_end is not null))
    or (p_arrival_window_mode='from_time' and p_arrival_start is null)
    or ((p_arrival_end_date is null) <> (p_arrival_end is null))
    or (p_arrival_end is not null and p_arrival_end_date+p_arrival_end <= p_event_date+p_arrival_start)
    or ((p_planned_exit_date is null) <> (p_planned_exit_time is null))
    or (p_planned_exit_date is not null and p_planned_exit_date+p_planned_exit_time <= p_event_date+coalesce(p_arrival_start,'00:00'::time)) then raise exception 'invalid event arrival window' using errcode='22023'; end if;
  v_start:=case when p_arrival_window_mode='all_day' then '00:00'::time else p_arrival_start end;
  v_end_date:=coalesce(p_arrival_end_date,p_event_date); v_end:=coalesce(p_arrival_end,'23:59:59.999999'::time);
  v_fingerprint:=digest(jsonb_build_object('residentId',p_resident_id,'name',trim(p_name),'eventDate',p_event_date,'mode',p_arrival_window_mode,'start',p_arrival_start,'endDate',p_arrival_end_date,'end',p_arrival_end,'plannedExitDate',p_planned_exit_date,'plannedExitTime',p_planned_exit_time,'notes',nullif(trim(p_notes),''),'credentialType',p_credential_type,'guests',p_guests)::text,'sha256');
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':'||p_resident_id::text||':'||p_idempotency_key::text,0));
  select id,arrival_request_fingerprint into v_id,v_existing from public.resident_events where community_id=p_community_id and resident_id=p_resident_id and creation_idempotency_key=p_idempotency_key;
  if found then
    if v_existing is distinct from v_fingerprint then raise exception 'idempotency key was used for another arrival event' using errcode='22023'; end if;
    return v_id;
  end if;
  v_id:=public.create_individual_resident_event(p_community_id,p_resident_id,p_name,p_event_date,v_start,v_end_date,v_end,p_planned_exit_date,p_planned_exit_time,p_notes,p_credential_type,p_guests,p_idempotency_key);
  update public.resident_events set arrival_window_mode=p_arrival_window_mode,arrival_start=p_arrival_start,arrival_end_date=p_arrival_end_date,arrival_end=p_arrival_end,arrival_request_fingerprint=v_fingerprint where id=v_id;
  return v_id;
end $$;

revoke all on function public.create_arrival_resident_event(uuid,uuid,text,date,text,time,date,time,date,time,text,text,jsonb,uuid) from public;
grant execute on function public.create_arrival_resident_event(uuid,uuid,text,date,text,time,date,time,date,time,text,text,jsonb,uuid) to authenticated;

create or replace function public.arrival_effective_status(
  p_status text,p_visit_date date,p_mode text,p_start time,p_end_date date,p_end time,
  p_legacy_indefinite boolean,p_time_zone text,p_used boolean default false
) returns text language sql stable
set search_path='pg_catalog','public' as $$
  select case
    when p_status='revoked' then 'revoked'
    when p_used or p_status='used' then 'used'
    when now() < (p_visit_date + case when p_mode='all_day' then '00:00'::time else coalesce(p_start,'00:00'::time) end) at time zone p_time_zone then 'scheduled'
    when p_legacy_indefinite then 'active'
    when now() > (coalesce(p_end_date,p_visit_date) + coalesce(p_end,'23:59:59.999999'::time)) at time zone p_time_zone then 'expired'
    else 'active'
  end;
$$;
revoke all on function public.arrival_effective_status(text,date,text,time,date,time,boolean,text,boolean) from public;

create or replace function public.get_public_invitation(p_share_token text)
returns jsonb language sql stable security definer
set search_path='pg_catalog','extensions','public' as $$
  select jsonb_build_object(
    'visitor_name',i.visitor_name,'access_type',i.access_type,'visit_date',i.visit_date,
    'arrival_window_mode',i.arrival_window_mode,'arrival_start',i.arrival_start,
    'arrival_end_date',i.arrival_end_date,'arrival_end',i.arrival_end,
    'planned_exit_date',i.planned_exit_date,'planned_exit_time',i.planned_exit_time,
    'window_start',i.window_start,'window_end',i.window_end,'window_end_date',i.window_end_date,
    'no_time_limit',i.no_time_limit,'legacy_indefinite',i.legacy_indefinite,
    'status',public.arrival_effective_status(i.status,i.visit_date,i.arrival_window_mode,i.arrival_start,i.arrival_end_date,i.arrival_end,i.legacy_indefinite,community.time_zone,i.status='used'),
    'resident_name',r.full_name,'unit_identifier',u.identifier,'unit_building',u.building,'credential_type',c.credential_type,
    'credential_value',case when c.credential_type='pin' then coalesce(s.secret_value,c.credential_value) else coalesce(s.secret_value,c.qr_payload,c.credential_value) end,
    'qr_payload',case when c.credential_type='qr' then coalesce(s.secret_value,c.qr_payload,c.credential_value) else null end,
    'group_size',case when i.group_id is null then null else (select count(*) from public.invitations member where member.group_id=i.group_id) end,
    'group_position',case when i.group_id is null then null else (select count(*) from public.invitations member where member.group_id=i.group_id and (member.created_at,member.id)<=(i.created_at,i.id)) end
  ) from public.invitations i join public.communities community on community.id=i.community_id join public.residents r on r.id=i.resident_id
  left join public.units u on u.id=i.unit_id left join public.access_credentials c on c.invitation_id=i.id
  left join public.credential_secrets s on s.access_credential_id=c.id where i.share_token=p_share_token limit 1;
$$;
revoke all on function public.get_public_invitation(text) from public;
grant execute on function public.get_public_invitation(text) to anon,authenticated;

create or replace function public.get_public_event(p_share_token text)
returns jsonb language sql stable security definer
set search_path='pg_catalog','extensions','public' as $$
  select jsonb_build_object('name',e.name,'event_date',e.event_date,
    'arrival_window_mode',e.arrival_window_mode,'arrival_start',e.arrival_start,
    'arrival_end_date',e.arrival_end_date,'arrival_end',e.arrival_end,
    'window_start',e.window_start,'window_end_date',e.window_end_date,'window_end',e.window_end,
    'planned_exit_date',e.planned_exit_date,'planned_exit_time',e.planned_exit_time,
    'status',public.arrival_effective_status(e.status,e.event_date,e.arrival_window_mode,e.arrival_start,e.arrival_end_date,e.arrival_end,false,community.time_zone,false),
    'resident_name',r.full_name,'unit_identifier',u.identifier,'credential_type',c.credential_type,
    'credential_value',case when c.credential_type='pin' then coalesce(s.secret_value,c.credential_value) else coalesce(s.secret_value,c.qr_payload,c.credential_value) end,
    'qr_payload',case when c.credential_type='qr' then coalesce(s.secret_value,c.qr_payload,c.credential_value) else null end,
    'guest_count',(select count(*) from public.event_guests g where g.event_id=e.id))
  from public.resident_events e join public.communities community on community.id=e.community_id join public.residents r on r.id=e.resident_id left join public.units u on u.id=e.unit_id
  left join public.event_credentials c on c.event_id=e.id left join public.credential_secrets s on s.event_credential_id=c.id
  where e.share_token=p_share_token and e.credential_mode='shared' limit 1;
$$;
revoke all on function public.get_public_event(text) from public;
grant execute on function public.get_public_event(text) to anon,authenticated;

create or replace function public.get_public_event_guest(p_share_token text)
returns jsonb language sql stable security definer
set search_path='pg_catalog','extensions','public' as $$
  select jsonb_build_object(
    'event_name',e.name,'guest_name',g.full_name,'event_date',e.event_date,
    'arrival_window_mode',e.arrival_window_mode,'arrival_start',e.arrival_start,
    'arrival_end_date',e.arrival_end_date,'arrival_end',e.arrival_end,
    'window_start',e.window_start,'window_end_date',e.window_end_date,'window_end',e.window_end,
    'planned_exit_date',e.planned_exit_date,'planned_exit_time',e.planned_exit_time,
    'status',public.arrival_effective_status(e.status,e.event_date,e.arrival_window_mode,e.arrival_start,e.arrival_end_date,e.arrival_end,false,community.time_zone,false),
    'resident_name',r.full_name,'unit_identifier',u.identifier,
    'attendance_status',g.attendance_status,'allows_companions',g.allows_companions,
    'max_companions',g.max_companions,'credential_type',c.credential_type,
    'credential_value',s.secret_value,'qr_payload',case when c.credential_type='qr' then s.secret_value else null end
  ) from public.event_guest_credentials c
  join public.event_guest_credential_secrets s on s.event_guest_credential_id=c.id
  join public.event_guests g on g.id=c.event_guest_id
  join public.resident_events e on e.id=c.event_id
  join public.communities community on community.id=e.community_id
  join public.residents r on r.id=e.resident_id left join public.units u on u.id=e.unit_id
  where c.share_token=p_share_token limit 1;
$$;
revoke all on function public.get_public_event_guest(text) from public;
grant execute on function public.get_public_event_guest(text) to anon,authenticated;

create index if not exists idx_invitations_arrival_window on public.invitations(community_id,visit_date,arrival_window_mode,arrival_start,arrival_end_date,arrival_end);
create index if not exists idx_invitation_groups_arrival_window on public.invitation_groups(community_id,visit_date,arrival_window_mode,arrival_start,arrival_end_date,arrival_end);
create index if not exists idx_events_arrival_window on public.resident_events(community_id,event_date,arrival_window_mode,arrival_start,arrival_end_date,arrival_end);

comment on column public.invitations.legacy_indefinite is 'True only for pre-migration no_time_limit rows pending manual review.';
comment on function public.create_arrival_invitation(uuid,uuid,uuid,text,text,text,date,text,time,date,time,date,time,text,text,uuid) is 'Creates a finite individual arrival credential atomically. Planned exit is informational.';
