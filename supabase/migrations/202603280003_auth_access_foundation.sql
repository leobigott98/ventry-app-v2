alter table public.community_memberships
  add column if not exists resident_id uuid references public.residents(id) on delete set null,
  add column if not exists auth_user_id uuid;

create unique index if not exists idx_memberships_community_resident_unique
  on public.community_memberships (community_id, resident_id)
  where resident_id is not null;

create index if not exists idx_memberships_auth_user
  on public.community_memberships (auth_user_id);
