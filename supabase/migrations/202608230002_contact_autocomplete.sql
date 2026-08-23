create or replace function public.search_resident_contact_views(
  p_community_id uuid,
  p_resident_id uuid,
  p_query text,
  p_limit integer default 5
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
  origin text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := public.normalize_resident_contact_name(coalesce(p_query, ''));
  v_phone_query text := public.normalize_resident_contact_phone(coalesce(p_query, ''));
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 5);
begin
  if p_resident_id is distinct from public.current_community_resident_id(p_community_id) then
    raise exception 'resident contact scope denied' using errcode = '42501';
  end if;
  if v_query = '' and v_digits = '' then return; end if;

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
      count(*)::bigint as invitation_count, max(created_at) as last_invited_at
    from resolved_history
    group by coalesce('saved:' || matched_saved_id::text, 'phone:' || normalized_phone, 'name:' || normalized_name), matched_saved_id
  ), unified as (
    select 'saved:' || contact.id::text as stable_id, contact.id as saved_contact_id,
      contact.name, contact.phone, contact.normalized_phone, contact.normalized_name,
      contact.relationship_label, contact.is_favorite,
      coalesce(history.invitation_count, 0)::bigint as invitation_count,
      history.last_invited_at,
      case when history.matched_saved_id is null then 'saved' else 'both' end as origin
    from saved as contact
    left join history_grouped as history on history.matched_saved_id = contact.id
    union all
    select history.history_key, null::uuid, history.visitor_name, history.visitor_phone,
      public.normalize_resident_contact_phone(history.visitor_phone), public.normalize_resident_contact_name(history.visitor_name), null::text, false,
      history.invitation_count, history.last_invited_at, 'history'
    from history_grouped as history where history.matched_saved_id is null
  ), matching as (
    select unified.*,
      public.normalize_resident_contact_name(coalesce(unified.relationship_label, '')) as normalized_relationship,
      regexp_replace(coalesce(unified.phone, ''), '\D', '', 'g') as phone_digits
    from unified
  )
  select matching.stable_id, matching.saved_contact_id, matching.name, matching.phone,
    matching.relationship_label, matching.is_favorite, matching.invitation_count,
    matching.last_invited_at, matching.origin
  from matching
  where matching.normalized_name like '%' || v_query || '%'
    or matching.normalized_relationship like '%' || v_query || '%'
    or (v_digits <> '' and matching.phone_digits like '%' || v_digits || '%')
    or (v_phone_query is not null and matching.normalized_phone = v_phone_query)
  order by (
      matching.normalized_name = v_query
      or matching.normalized_relationship = v_query
      or (v_phone_query is not null and matching.normalized_phone = v_phone_query)
      or (v_digits <> '' and matching.phone_digits = v_digits)
    ) desc,
    matching.is_favorite desc,
    matching.invitation_count desc,
    matching.last_invited_at desc nulls last,
    matching.name
  limit v_limit;
end;
$$;

revoke all on function public.search_resident_contact_views(uuid, uuid, text, integer) from public;
grant execute on function public.search_resident_contact_views(uuid, uuid, text, integer) to authenticated;

comment on function public.search_resident_contact_views(uuid, uuid, text, integer) is
  'Returns at most five resident-scoped unified contacts ranked for invitation autocomplete.';
