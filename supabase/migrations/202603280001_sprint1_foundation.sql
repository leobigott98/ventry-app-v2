create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-assets',
  'community-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  location_label text not null,
  planned_unit_count integer not null check (planned_unit_count > 0),
  access_policy_mode text not null check (
    access_policy_mode in (
      'invitation_only',
      'invitation_or_guard_confirmation',
      'open_with_logging'
    )
  ),
  access_policy_notes text,
  gate_operation_mode text not null check (
    gate_operation_mode in (
      '24_7_guarded',
      'scheduled_guarded',
      'mixed_manual'
    )
  ),
  gate_operation_notes text,
  admin_contact_name text not null,
  admin_contact_phone text not null,
  admin_contact_email text,
  logo_url text,
  created_by_email text not null,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  role text not null check (role in ('admin', 'guard', 'resident')),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, email)
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  identifier text not null,
  building text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.residents (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  full_name text not null,
  phone text not null,
  whatsapp_phone text,
  email text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete restrict,
  unit_id uuid references public.units(id) on delete set null,
  visitor_name text,
  access_type text not null check (
    access_type in ('visitor', 'delivery', 'service_provider', 'frequent_visitor')
  ),
  visit_date date not null,
  window_start time not null,
  window_end time not null,
  status text not null default 'active' check (status in ('active', 'used', 'revoked')),
  notes text,
  share_token text not null unique,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.access_credentials (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  credential_type text not null check (credential_type in ('pin', 'qr')),
  credential_value text not null,
  qr_payload text,
  created_at timestamptz not null default now(),
  unique (invitation_id)
);

create table if not exists public.invitation_events (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'shared', 'revoked', 'status_changed')),
  event_label text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_memberships_community_role
  on public.community_memberships (community_id, role);

create index if not exists idx_units_community
  on public.units (community_id);

create unique index if not exists idx_units_community_identifier_unique
  on public.units (community_id, coalesce(building, ''), identifier);

create index if not exists idx_residents_community
  on public.residents (community_id);

create index if not exists idx_residents_unit
  on public.residents (unit_id);

create index if not exists idx_invitations_community_status
  on public.invitations (community_id, status, visit_date desc);

create index if not exists idx_invitations_resident
  on public.invitations (resident_id);

create index if not exists idx_invitation_events_invitation
  on public.invitation_events (invitation_id, created_at desc);

drop trigger if exists set_communities_updated_at on public.communities;
create trigger set_communities_updated_at
before update on public.communities
for each row
execute function public.set_updated_at();

drop trigger if exists set_memberships_updated_at on public.community_memberships;
create trigger set_memberships_updated_at
before update on public.community_memberships
for each row
execute function public.set_updated_at();

drop trigger if exists set_units_updated_at on public.units;
create trigger set_units_updated_at
before update on public.units
for each row
execute function public.set_updated_at();

drop trigger if exists set_residents_updated_at on public.residents;
create trigger set_residents_updated_at
before update on public.residents
for each row
execute function public.set_updated_at();

drop trigger if exists set_invitations_updated_at on public.invitations;
create trigger set_invitations_updated_at
before update on public.invitations
for each row
execute function public.set_updated_at();
