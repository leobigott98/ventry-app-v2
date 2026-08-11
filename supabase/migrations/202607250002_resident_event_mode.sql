create table if not exists public.resident_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete restrict,
  unit_id uuid references public.units(id) on delete set null,
  name text not null,
  event_date date not null,
  window_start time not null,
  window_end_date date not null,
  window_end time not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  notes text,
  share_token text not null unique,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.resident_events(id) on delete cascade,
  full_name text not null,
  phone text,
  notes text,
  attendance_status text not null default 'pending'
    check (attendance_status in ('pending', 'inside', 'exited')),
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_credentials (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.resident_events(id) on delete cascade,
  credential_type text not null check (credential_type in ('pin', 'qr')),
  credential_value text not null,
  qr_payload text,
  created_at timestamptz not null default now(),
  unique (event_id)
);

create table if not exists public.event_activity (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.resident_events(id) on delete cascade,
  activity_type text not null check (
    activity_type in ('created', 'shared', 'revoked', 'guest_checked_in', 'guest_checked_out')
  ),
  activity_label text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.visitor_entries
  add column if not exists event_id uuid references public.resident_events(id) on delete set null,
  add column if not exists event_guest_id uuid references public.event_guests(id) on delete set null;

alter table public.visitor_entries
  drop constraint if exists visitor_entries_registration_source_check;

alter table public.visitor_entries
  add constraint visitor_entries_registration_source_check
  check (registration_source in ('invitation', 'event', 'unannounced', 'vehicle_manual'));

alter table public.access_events
  add column if not exists event_id uuid references public.resident_events(id) on delete set null,
  add column if not exists event_guest_id uuid references public.event_guests(id) on delete set null;

alter table public.access_events
  drop constraint if exists access_events_event_source_check;

alter table public.access_events
  add constraint access_events_event_source_check
  check (event_source in ('invitation', 'event', 'validation', 'unannounced', 'vehicle_manual'));

create index if not exists idx_resident_events_community_date
  on public.resident_events (community_id, event_date desc);
create index if not exists idx_resident_events_resident_date
  on public.resident_events (resident_id, event_date desc);
create index if not exists idx_event_guests_event_status
  on public.event_guests (event_id, attendance_status, full_name);
create index if not exists idx_event_credentials_value
  on public.event_credentials (credential_type, credential_value);
create index if not exists idx_visitor_entries_event
  on public.visitor_entries (event_id, event_guest_id);
create index if not exists idx_access_events_event
  on public.access_events (event_id, created_at desc);

drop trigger if exists set_resident_events_updated_at on public.resident_events;
create trigger set_resident_events_updated_at
before update on public.resident_events
for each row execute function public.set_updated_at();

drop trigger if exists set_event_guests_updated_at on public.event_guests;
create trigger set_event_guests_updated_at
before update on public.event_guests
for each row execute function public.set_updated_at();
