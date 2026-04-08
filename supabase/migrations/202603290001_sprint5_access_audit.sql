alter table public.access_events
  add column if not exists resident_id uuid references public.residents(id) on delete set null,
  add column if not exists unit_id uuid references public.units(id) on delete set null,
  add column if not exists visitor_name text,
  add column if not exists access_type text check (
    access_type in ('visitor', 'delivery', 'service_provider', 'frequent_visitor')
  ),
  add column if not exists event_status text default 'logged' check (
    event_status in ('validated', 'rejected', 'entered', 'exited', 'logged')
  ),
  add column if not exists event_direction text default 'validation' check (
    event_direction in ('validation', 'entry', 'exit')
  ),
  add column if not exists event_source text default 'validation' check (
    event_source in ('invitation', 'validation', 'unannounced', 'vehicle_manual')
  ),
  add column if not exists validated_by_email text,
  add column if not exists notes text;

update public.access_events as ae
set
  resident_id = coalesce(
    ae.resident_id,
    (select ve.resident_id from public.visitor_entries as ve where ve.id = ae.visitor_entry_id),
    (select inv.resident_id from public.invitations as inv where inv.id = ae.invitation_id)
  ),
  unit_id = coalesce(
    ae.unit_id,
    (select ve.unit_id from public.visitor_entries as ve where ve.id = ae.visitor_entry_id),
    (select inv.unit_id from public.invitations as inv where inv.id = ae.invitation_id)
  ),
  visitor_name = coalesce(
    ae.visitor_name,
    (select ve.visitor_name from public.visitor_entries as ve where ve.id = ae.visitor_entry_id),
    (select inv.visitor_name from public.invitations as inv where inv.id = ae.invitation_id),
    ae.details ->> 'visitorName'
  ),
  access_type = coalesce(
    ae.access_type,
    (select ve.access_type from public.visitor_entries as ve where ve.id = ae.visitor_entry_id),
    (select inv.access_type from public.invitations as inv where inv.id = ae.invitation_id)
  ),
  event_status = coalesce(
    ae.event_status,
    case ae.access_event_type
      when 'validation_success' then 'validated'
      when 'validation_failed' then 'rejected'
      when 'entry_registered' then 'entered'
      when 'exit_registered' then 'exited'
      when 'unannounced_registered' then 'entered'
      when 'vehicle_registered' then 'entered'
      else 'logged'
    end
  ),
  event_direction = coalesce(
    ae.event_direction,
    case ae.access_event_type
      when 'validation_success' then 'validation'
      when 'validation_failed' then 'validation'
      when 'entry_registered' then 'entry'
      when 'exit_registered' then 'exit'
      when 'unannounced_registered' then 'entry'
      when 'vehicle_registered' then 'entry'
      else 'validation'
    end
  ),
  event_source = coalesce(
    ae.event_source,
    case ae.access_event_type
      when 'validation_success' then case when ae.invitation_id is not null then 'invitation' else 'validation' end
      when 'validation_failed' then 'validation'
      when 'entry_registered' then 'invitation'
      when 'exit_registered' then coalesce(
        (select
          case ve.registration_source
            when 'invitation' then 'invitation'
            when 'unannounced' then 'unannounced'
            when 'vehicle_manual' then 'vehicle_manual'
            else 'validation'
          end
        from public.visitor_entries as ve
        where ve.id = ae.visitor_entry_id),
        case when ae.invitation_id is not null then 'invitation' else 'validation' end
      )
      when 'unannounced_registered' then 'unannounced'
      when 'vehicle_registered' then 'vehicle_manual'
      else 'validation'
    end
  ),
  validated_by_email = coalesce(ae.validated_by_email, ae.created_by_email),
  notes = coalesce(
    ae.notes,
    (select ve.notes from public.visitor_entries as ve where ve.id = ae.visitor_entry_id),
    (select inv.notes from public.invitations as inv where inv.id = ae.invitation_id),
    ae.details ->> 'notes'
  );

alter table public.access_events
  alter column event_status set not null,
  alter column event_direction set not null,
  alter column event_source set not null;

create index if not exists idx_access_events_community_resident_created
  on public.access_events (community_id, resident_id, created_at desc);

create index if not exists idx_access_events_community_unit_created
  on public.access_events (community_id, unit_id, created_at desc);

create index if not exists idx_access_events_community_status_created
  on public.access_events (community_id, event_status, created_at desc);

create index if not exists idx_access_events_community_direction_created
  on public.access_events (community_id, event_direction, created_at desc);

create index if not exists idx_access_events_community_access_type_created
  on public.access_events (community_id, access_type, created_at desc);
