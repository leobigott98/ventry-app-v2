set search_path = pg_catalog, extensions, public;

drop function if exists public.create_arrival_resident_event(uuid,uuid,text,date,text,time,date,time,date,time,text,text,jsonb,uuid);
drop function if exists public.create_arrival_invitation_group(uuid,uuid,text,date,text,time,date,time,date,time,text,text,jsonb,uuid);
drop function if exists public.create_arrival_invitation(uuid,uuid,uuid,text,text,text,date,text,time,date,time,date,time,text,text,uuid);

create or replace function public.get_public_invitation(p_share_token text)
returns jsonb language sql stable security definer
set search_path='pg_catalog','extensions','public' as $$
  select jsonb_build_object(
    'visitor_name',i.visitor_name,'access_type',i.access_type,'visit_date',i.visit_date,
    'window_start',i.window_start,'window_end',i.window_end,'window_end_date',i.window_end_date,
    'no_time_limit',i.no_time_limit,'status',i.status,'resident_name',r.full_name,
    'unit_identifier',u.identifier,'unit_building',u.building,'credential_type',c.credential_type,
    'credential_value',case when c.credential_type='pin' then coalesce(s.secret_value,c.credential_value) else coalesce(s.secret_value,c.qr_payload,c.credential_value) end,
    'qr_payload',case when c.credential_type='qr' then coalesce(s.secret_value,c.qr_payload,c.credential_value) else null end,
    'group_size',case when i.group_id is null then null else (select count(*) from public.invitations member where member.group_id=i.group_id) end,
    'group_position',case when i.group_id is null then null else (select count(*) from public.invitations member where member.group_id=i.group_id and (member.created_at,member.id)<=(i.created_at,i.id)) end
  ) from public.invitations i join public.residents r on r.id=i.resident_id
  left join public.units u on u.id=i.unit_id left join public.access_credentials c on c.invitation_id=i.id
  left join public.credential_secrets s on s.access_credential_id=c.id where i.share_token=p_share_token limit 1;
$$;

create or replace function public.get_public_event(p_share_token text)
returns jsonb language sql stable security definer
set search_path='pg_catalog','extensions','public' as $$
  select jsonb_build_object('name',e.name,'event_date',e.event_date,'window_start',e.window_start,
    'window_end_date',e.window_end_date,'window_end',e.window_end,'planned_exit_date',e.planned_exit_date,
    'planned_exit_time',e.planned_exit_time,'status',e.status,'resident_name',r.full_name,
    'unit_identifier',u.identifier,'credential_type',c.credential_type,
    'credential_value',case when c.credential_type='pin' then coalesce(s.secret_value,c.credential_value) else coalesce(s.secret_value,c.qr_payload,c.credential_value) end,
    'qr_payload',case when c.credential_type='qr' then coalesce(s.secret_value,c.qr_payload,c.credential_value) else null end,
    'guest_count',(select count(*) from public.event_guests g where g.event_id=e.id))
  from public.resident_events e join public.residents r on r.id=e.resident_id left join public.units u on u.id=e.unit_id
  left join public.event_credentials c on c.event_id=e.id left join public.credential_secrets s on s.event_credential_id=c.id
  where e.share_token=p_share_token and e.credential_mode='shared' limit 1;
$$;

create or replace function public.get_public_event_guest(p_share_token text)
returns jsonb language sql stable security definer
set search_path='pg_catalog','extensions','public' as $$
  select jsonb_build_object(
    'event_name',e.name,'guest_name',g.full_name,'event_date',e.event_date,
    'window_start',e.window_start,'window_end_date',e.window_end_date,'window_end',e.window_end,
    'planned_exit_date',e.planned_exit_date,'planned_exit_time',e.planned_exit_time,
    'status',case when e.status='revoked' then 'revoked' when now()<(e.event_date+e.window_start) at time zone community.time_zone then 'scheduled' when now()>(e.window_end_date+e.window_end) at time zone community.time_zone then 'expired' else 'active' end,
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
drop function if exists public.arrival_effective_status(text,date,text,time,date,time,boolean,text,boolean);

drop trigger if exists sync_event_arrival_compatibility on public.resident_events;
drop trigger if exists sync_invitation_group_arrival_compatibility on public.invitation_groups;
drop trigger if exists sync_invitation_arrival_compatibility on public.invitations;
drop function if exists public.sync_event_arrival_compatibility();
drop function if exists public.sync_invitation_arrival_compatibility();

alter table public.resident_events
  drop constraint if exists resident_events_arrival_window_check,
  drop constraint if exists resident_events_planned_exit_after_start_check;
alter table public.resident_events
  add constraint resident_events_planned_exit_after_window_check check (
    planned_exit_date is null or planned_exit_date + planned_exit_time >= window_end_date + window_end
  );

alter table public.invitation_groups
  drop constraint if exists invitation_groups_arrival_window_check,
  drop constraint if exists invitation_groups_planned_exit_pair_check,
  drop constraint if exists invitation_groups_planned_exit_after_start_check;
alter table public.invitations
  drop constraint if exists invitations_arrival_window_check,
  drop constraint if exists invitations_planned_exit_pair_check,
  drop constraint if exists invitations_planned_exit_after_start_check;

drop index if exists public.idx_events_arrival_window;
drop index if exists public.idx_invitation_groups_arrival_window;
drop index if exists public.idx_invitations_arrival_window;

alter table public.resident_events
  drop column if exists arrival_request_fingerprint,
  drop column if exists arrival_end,
  drop column if exists arrival_end_date,
  drop column if exists arrival_start,
  drop column if exists arrival_window_mode;
alter table public.invitation_groups
  drop column if exists arrival_request_fingerprint,
  drop column if exists legacy_indefinite,
  drop column if exists planned_exit_time,
  drop column if exists planned_exit_date,
  drop column if exists arrival_end,
  drop column if exists arrival_end_date,
  drop column if exists arrival_start,
  drop column if exists arrival_window_mode;
alter table public.invitations
  drop column if exists arrival_request_fingerprint,
  drop column if exists legacy_indefinite,
  drop column if exists planned_exit_time,
  drop column if exists planned_exit_date,
  drop column if exists arrival_end,
  drop column if exists arrival_end_date,
  drop column if exists arrival_start,
  drop column if exists arrival_window_mode;
