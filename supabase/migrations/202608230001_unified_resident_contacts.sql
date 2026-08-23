create or replace function public.normalize_resident_contact_name(p_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select translate(
    lower(regexp_replace(trim(p_value), '\s+', ' ', 'g')),
    'áéíóúüñ',
    'aeiouun'
  );
$$;

create or replace function public.normalize_resident_contact_phone(p_value text)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_trimmed text := trim(p_value);
  v_digits text := regexp_replace(trim(p_value), '\D', '', 'g');
  v_international boolean := v_trimmed like '+%' or v_trimmed like '00%';
begin
  if v_trimmed = '' then return null; end if;
  if v_trimmed like '00%' then v_digits := substring(v_digits from 3); end if;
  if not v_international then
    if length(v_digits) = 11 and v_digits like '0%' then v_digits := '58' || substring(v_digits from 2);
    elsif length(v_digits) = 10 and v_digits ~ '^[24]' then v_digits := '58' || v_digits;
    elsif not (length(v_digits) = 12 and v_digits like '58%') then return null;
    end if;
  end if;
  if v_digits !~ '^[1-9][0-9]{6,14}$' then return null; end if;
  return '+' || v_digits;
end;
$$;

alter table public.resident_contacts
  drop constraint if exists resident_contacts_resident_id_normalized_phone_key,
  drop constraint if exists resident_contacts_phone_check,
  drop constraint if exists resident_contacts_normalized_phone_check;

alter table public.resident_contacts
  alter column phone drop not null,
  alter column normalized_phone drop not null,
  add column normalized_name text generated always as (public.normalize_resident_contact_name(name)) stored,
  add constraint resident_contacts_phone_check check (phone is null or char_length(trim(phone)) between 7 and 32),
  add constraint resident_contacts_normalized_phone_check check (normalized_phone is null or normalized_phone ~ '^\+[1-9][0-9]{6,14}$');

create unique index resident_contacts_unique_phone_idx
  on public.resident_contacts (resident_id, normalized_phone)
  where normalized_phone is not null;
create unique index resident_contacts_unique_name_without_phone_idx
  on public.resident_contacts (resident_id, normalized_name)
  where normalized_phone is null;

alter table public.invitations
  add column resident_contact_id uuid references public.resident_contacts(id) on delete set null;
create index invitations_resident_contact_idx
  on public.invitations (community_id, resident_id, resident_contact_id)
  where resident_contact_id is not null;

update public.invitations as invitation
set resident_contact_id = usage.contact_id
from public.resident_contact_invitation_usage as usage
where usage.invitation_id = invitation.id;

create or replace function public.enforce_invitation_contact_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.resident_contact_id is not null and not exists (
    select 1 from public.resident_contacts as contact
    where contact.id = new.resident_contact_id
      and contact.community_id = new.community_id
      and contact.resident_id = new.resident_id
  ) then
    raise exception 'resident contact belongs to another resident or community' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_invitation_contact_scope() from public;
create trigger enforce_invitation_contact_scope
before insert or update of resident_contact_id, resident_id, community_id on public.invitations
for each row execute function public.enforce_invitation_contact_scope();

create or replace function public.sync_invitation_contact_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.resident_contact_id is distinct from new.resident_contact_id then
    delete from public.resident_contact_invitation_usage where invitation_id = new.id;
  end if;
  if new.resident_contact_id is not null then
    insert into public.resident_contact_invitation_usage (contact_id, invitation_id)
    values (new.resident_contact_id, new.id)
    on conflict (invitation_id) do update set contact_id = excluded.contact_id;
  end if;
  return null;
end;
$$;

revoke all on function public.sync_invitation_contact_usage() from public;
create trigger sync_invitation_contact_usage
after insert or update of resident_contact_id on public.invitations
for each row execute function public.sync_invitation_contact_usage();

create or replace function public.record_resident_contact_invitation(p_contact_id uuid, p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer := 0;
begin
  if exists (
    select 1 from public.invitations as invitation
    where invitation.id = p_invitation_id
      and invitation.resident_contact_id = p_contact_id
      and invitation.resident_id = public.current_community_resident_id(invitation.community_id)
  ) then
    return false;
  end if;

  update public.invitations as invitation
  set resident_contact_id = p_contact_id
  where invitation.id = p_invitation_id
    and invitation.resident_id = public.current_community_resident_id(invitation.community_id)
    and exists (
      select 1 from public.resident_contacts as contact
      where contact.id = p_contact_id
        and contact.community_id = invitation.community_id
        and contact.resident_id = invitation.resident_id
    );
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'contact and invitation must belong to the current resident' using errcode = '42501';
  end if;
  return true;
end;
$$;

create or replace function public.get_resident_contact_views(
  p_community_id uuid,
  p_resident_id uuid,
  p_page integer default 1,
  p_page_size integer default 50
)
returns table (
  stable_id text,
  saved_contact_id uuid,
  name text,
  phone text,
  relationship_label text,
  is_favorite boolean,
  invitation_count bigint,
  last_invited_at timestamptz,
  origin text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 50), 1), 100);
begin
  if p_resident_id is distinct from public.current_community_resident_id(p_community_id) then
    raise exception 'resident contact scope denied' using errcode = '42501';
  end if;

  return query
  with saved as (
    select contact.*
    from public.resident_contacts as contact
    where contact.community_id = p_community_id and contact.resident_id = p_resident_id
  ), history_base as (
    select invitation.id, trim(invitation.visitor_name) as visitor_name,
      nullif(trim(invitation.visitor_phone), '') as visitor_phone,
      public.normalize_resident_contact_phone(invitation.visitor_phone) as normalized_phone,
      public.normalize_resident_contact_name(invitation.visitor_name) as normalized_name,
      invitation.resident_contact_id, invitation.created_at
    from public.invitations as invitation
    where invitation.community_id = p_community_id
      and invitation.resident_id = p_resident_id
      and nullif(trim(invitation.visitor_name), '') is not null
  ), resolved_history as (
    select history.*, matched.id as matched_saved_id
    from history_base as history
    left join lateral (
      select contact.id
      from saved as contact
      where contact.id = history.resident_contact_id
        or (history.resident_contact_id is null and history.normalized_phone is not null and contact.normalized_phone = history.normalized_phone)
        or (history.resident_contact_id is null and history.normalized_phone is null
          and contact.normalized_name = history.normalized_name
          and (select count(*) from saved as same_name where same_name.normalized_name = history.normalized_name) = 1)
      order by (contact.id = history.resident_contact_id) desc
      limit 1
    ) as matched on true
  ), history_grouped as (
    select coalesce('saved:' || matched_saved_id::text, 'phone:' || normalized_phone, 'name:' || normalized_name) as history_key,
      matched_saved_id,
      (array_agg(visitor_name order by created_at desc))[1] as visitor_name,
      (array_agg(visitor_phone order by created_at desc) filter (where visitor_phone is not null))[1] as visitor_phone,
      count(*)::bigint as invitation_count,
      max(created_at) as last_invited_at
    from resolved_history
    group by coalesce('saved:' || matched_saved_id::text, 'phone:' || normalized_phone, 'name:' || normalized_name), matched_saved_id
  ), unified as (
    select 'saved:' || contact.id::text as stable_id, contact.id as saved_contact_id,
      contact.name, contact.phone, contact.relationship_label, contact.is_favorite,
      coalesce(history.invitation_count, 0)::bigint as invitation_count,
      history.last_invited_at,
      case when history.matched_saved_id is null then 'saved' else 'both' end as origin
    from saved as contact
    left join history_grouped as history on history.matched_saved_id = contact.id
    union all
    select history.history_key, null::uuid, history.visitor_name, history.visitor_phone,
      null::text, false, history.invitation_count, history.last_invited_at, 'history'
    from history_grouped as history
    where history.matched_saved_id is null
  ), counted as (
    select unified.*, count(*) over () as total_count
    from unified
  )
  select counted.stable_id, counted.saved_contact_id, counted.name, counted.phone,
    counted.relationship_label, counted.is_favorite, counted.invitation_count,
    counted.last_invited_at, counted.origin, counted.total_count
  from counted
  order by counted.is_favorite desc, counted.invitation_count desc,
    counted.last_invited_at desc nulls last, counted.name
  limit v_page_size offset (v_page - 1) * v_page_size;
end;
$$;

revoke all on function public.get_resident_contact_views(uuid, uuid, integer, integer) from public;
grant execute on function public.get_resident_contact_views(uuid, uuid, integer, integer) to authenticated;

comment on function public.get_resident_contact_views(uuid, uuid, integer, integer) is
  'Returns a resident-scoped, paginated merge of saved contacts and complete invitation history.';
