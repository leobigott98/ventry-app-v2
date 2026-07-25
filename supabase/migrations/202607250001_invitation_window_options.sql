alter table public.invitations
  add column if not exists window_end_date date,
  add column if not exists no_time_limit boolean not null default false;

update public.invitations
set window_end_date = visit_date
where window_end_date is null
  and no_time_limit = false;

create index if not exists idx_invitations_community_window_end
  on public.invitations (community_id, no_time_limit, window_end_date desc, window_end desc);
alter table public.invitation_events
  drop constraint if exists invitation_events_event_type_check;

alter table public.invitation_events
  add constraint invitation_events_event_type_check
  check (event_type in ('created', 'shared', 'revoked', 'status_changed', 'window_updated'));
