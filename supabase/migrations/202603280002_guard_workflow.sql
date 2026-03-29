create table if not exists public.visitor_entries (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  invitation_id uuid references public.invitations(id) on delete set null,
  resident_id uuid references public.residents(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  visitor_name text not null,
  access_type text not null check (
    access_type in ('visitor', 'delivery', 'service_provider', 'frequent_visitor')
  ),
  registration_source text not null check (
    registration_source in ('invitation', 'unannounced', 'vehicle_manual')
  ),
  vehicle_plate text,
  vehicle_description text,
  notes text,
  entry_status text not null default 'inside' check (entry_status in ('inside', 'exited')),
  entered_at timestamptz not null default now(),
  exited_at timestamptz,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.access_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  invitation_id uuid references public.invitations(id) on delete set null,
  visitor_entry_id uuid references public.visitor_entries(id) on delete set null,
  access_event_type text not null check (
    access_event_type in (
      'validation_success',
      'validation_failed',
      'entry_registered',
      'exit_registered',
      'unannounced_registered',
      'vehicle_registered'
    )
  ),
  event_label text not null,
  details jsonb not null default '{}'::jsonb,
  created_by_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_visitor_entries_community_status
  on public.visitor_entries (community_id, entry_status, entered_at desc);

create index if not exists idx_visitor_entries_invitation
  on public.visitor_entries (invitation_id);

create index if not exists idx_access_events_community_created
  on public.access_events (community_id, created_at desc);

drop trigger if exists set_visitor_entries_updated_at on public.visitor_entries;
create trigger set_visitor_entries_updated_at
before update on public.visitor_entries
for each row
execute function public.set_updated_at();
