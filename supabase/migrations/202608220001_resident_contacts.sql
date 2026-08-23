create table public.resident_contacts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  phone text not null check (char_length(trim(phone)) between 7 and 32),
  normalized_phone text not null check (normalized_phone ~ '^\+[1-9][0-9]{6,14}$'),
  relationship_label text check (relationship_label is null or char_length(relationship_label) <= 80),
  is_favorite boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'contact_picker', 'vcard')),
  invitation_count integer not null default 0 check (invitation_count >= 0),
  last_invited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resident_id, normalized_phone)
);

create index resident_contacts_owner_order_idx
  on public.resident_contacts (community_id, resident_id, is_favorite desc, last_invited_at desc, name);

create trigger set_resident_contacts_updated_at
before update on public.resident_contacts
for each row execute function public.set_updated_at();

create trigger enforce_resident_contacts_tenant_references
before insert or update on public.resident_contacts
for each row execute function public.enforce_tenant_reference_integrity();

alter table public.resident_contacts enable row level security;

create policy resident_contacts_select_owner on public.resident_contacts
  for select to authenticated
  using (resident_id = public.current_community_resident_id(community_id));

create policy resident_contacts_insert_owner on public.resident_contacts
  for insert to authenticated
  with check (resident_id = public.current_community_resident_id(community_id));

create policy resident_contacts_update_owner on public.resident_contacts
  for update to authenticated
  using (resident_id = public.current_community_resident_id(community_id))
  with check (resident_id = public.current_community_resident_id(community_id));

create policy resident_contacts_delete_owner on public.resident_contacts
  for delete to authenticated
  using (resident_id = public.current_community_resident_id(community_id));

-- Authenticated residents can mutate only user-maintained fields. Metrics are
-- written exclusively by the private usage trigger below.
revoke all on table public.resident_contacts from anon, authenticated;
grant select, delete on table public.resident_contacts to authenticated;
grant insert (community_id, resident_id, name, phone, normalized_phone, relationship_label, is_favorite, source)
  on table public.resident_contacts to authenticated;
grant update (name, phone, normalized_phone, relationship_label, is_favorite)
  on table public.resident_contacts to authenticated;

-- The usage link is deliberately private. It exists only to make metric updates
-- idempotent and is not part of the guard/admin read model.
create table public.resident_contact_invitation_usage (
  contact_id uuid not null references public.resident_contacts(id) on delete cascade,
  invitation_id uuid not null unique references public.invitations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, invitation_id)
);

alter table public.resident_contact_invitation_usage enable row level security;
revoke all on table public.resident_contact_invitation_usage from anon, authenticated;

create or replace function public.refresh_resident_contact_metrics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact_id uuid;
begin
  v_contact_id := case when tg_op = 'DELETE' then old.contact_id else new.contact_id end;
  update public.resident_contacts as contact
  set invitation_count = usage_metrics.invitation_count,
      last_invited_at = usage_metrics.last_invited_at
  from (
    select count(*)::integer as invitation_count, max(usage.created_at) as last_invited_at
    from public.resident_contact_invitation_usage as usage
    where usage.contact_id = v_contact_id
  ) as usage_metrics
  where contact.id = v_contact_id;
  return null;
end;
$$;

revoke all on function public.refresh_resident_contact_metrics() from public;

create trigger refresh_resident_contact_metrics
after insert or delete on public.resident_contact_invitation_usage
for each row execute function public.refresh_resident_contact_metrics();

create or replace function public.record_resident_contact_invitation(
  p_contact_id uuid,
  p_invitation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact public.resident_contacts%rowtype;
  v_invitation public.invitations%rowtype;
  v_inserted integer := 0;
begin
  select * into v_contact
  from public.resident_contacts
  where id = p_contact_id;

  select * into v_invitation
  from public.invitations
  where id = p_invitation_id;

  if v_contact.id is null or v_invitation.id is null
     or v_contact.community_id <> v_invitation.community_id
     or v_contact.resident_id <> v_invitation.resident_id
     or v_contact.resident_id <> public.current_community_resident_id(v_contact.community_id) then
    raise exception 'contact and invitation must belong to the current resident'
      using errcode = '42501';
  end if;

  insert into public.resident_contact_invitation_usage (contact_id, invitation_id)
  values (p_contact_id, p_invitation_id)
  on conflict (invitation_id) do nothing;
  get diagnostics v_inserted = row_count;

  return v_inserted = 1;
end;
$$;

revoke all on function public.record_resident_contact_invitation(uuid, uuid) from public;
grant execute on function public.record_resident_contact_invitation(uuid, uuid) to authenticated;

comment on table public.resident_contacts is
  'Private resident-owned address book for invitation reuse; not part of the resident census.';
comment on function public.record_resident_contact_invitation(uuid, uuid) is
  'Idempotently records use after an invitation is created, scoped to the authenticated resident.';
