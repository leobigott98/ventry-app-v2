-- Group invitations, per-guest event credentials, and companion accounting.
-- Existing invitations remain standalone and existing events remain in shared mode.

set search_path = pg_catalog, extensions, public;

create table public.invitation_groups (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  access_type text not null check (access_type in ('visitor', 'delivery', 'service_provider', 'frequent_visitor')),
  visit_date date not null,
  window_start time not null,
  window_end_date date,
  window_end time not null,
  no_time_limit boolean not null default false,
  notes text,
  credential_type text not null check (credential_type in ('pin', 'qr')),
  creation_idempotency_key uuid not null,
  creation_request_fingerprint bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitation_groups_window_check check (
    no_time_limit or (coalesce(window_end_date, visit_date) + window_end) > (visit_date + window_start)
  )
);

alter table public.invitations
  add column if not exists group_id uuid references public.invitation_groups(id) on delete set null,
  add column if not exists visitor_phone text;

alter table public.resident_events
  add column if not exists credential_mode text not null default 'shared',
  add column if not exists creation_idempotency_key uuid,
  add column if not exists creation_request_fingerprint bytea;
alter table public.resident_events
  drop constraint if exists resident_events_credential_mode_check,
  add constraint resident_events_credential_mode_check check (credential_mode in ('shared', 'individual'));
alter table public.resident_events alter column credential_mode set default 'individual';

alter table public.event_guests
  add column if not exists allows_companions boolean not null default false,
  add column if not exists max_companions smallint not null default 0,
  add column if not exists credential_shared_at timestamptz;
alter table public.event_guests
  drop constraint if exists event_guests_companions_check,
  add constraint event_guests_companions_check check (
    (not allows_companions and max_companions = 0)
    or (allows_companions and max_companions between 1 and 5)
  );

alter table public.visitor_entries
  add column if not exists companion_count integer not null default 0;
alter table public.visitor_entries
  drop constraint if exists visitor_entries_companion_count_check,
  add constraint visitor_entries_companion_count_check check (companion_count between 0 and 5);

create table public.event_guest_credentials (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.resident_events(id) on delete cascade,
  event_guest_id uuid not null unique references public.event_guests(id) on delete cascade,
  credential_type text not null check (credential_type in ('pin', 'qr')),
  credential_hash text not null,
  credential_fingerprint bytea not null unique,
  credential_audit_id text not null unique default ('guest_cred_' || encode(gen_random_bytes(8), 'hex')),
  share_token text not null unique,
  created_at timestamptz not null default now()
);

create table public.event_guest_credential_secrets (
  id uuid primary key default gen_random_uuid(),
  event_guest_credential_id uuid not null unique references public.event_guest_credentials(id) on delete cascade,
  secret_value text not null check (length(secret_value) between 6 and 128),
  created_at timestamptz not null default now()
);

create index idx_invitation_groups_community_resident_created
  on public.invitation_groups (community_id, resident_id, created_at desc, id desc);
create unique index idx_invitation_groups_creation_idempotency
  on public.invitation_groups (community_id, resident_id, creation_idempotency_key);
create unique index idx_resident_events_creation_idempotency
  on public.resident_events (community_id, resident_id, creation_idempotency_key)
  where creation_idempotency_key is not null;
create index idx_invitations_group on public.invitations (group_id, created_at, id);
create index idx_event_guest_credentials_event on public.event_guest_credentials (event_id, event_guest_id);
create index idx_guard_events_window on public.resident_events (community_id, event_date, window_start, window_end_date, window_end);
create index idx_guard_group_window on public.invitation_groups (community_id, visit_date, window_start, window_end_date, window_end);

alter table public.event_guests add constraint event_guests_event_id_id_unique unique (event_id,id);
alter table public.event_guest_credentials add constraint event_guest_credentials_event_guest_pair_fk
  foreign key (event_id,event_guest_id) references public.event_guests(event_id,id) on delete cascade;

create or replace function public.enforce_group_tenant_references() returns trigger language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
begin
  if tg_table_name='invitation_groups' then
    if not exists(select 1 from public.residents r where r.id=new.resident_id and r.community_id=new.community_id)
      or (new.unit_id is not null and not exists(select 1 from public.units u where u.id=new.unit_id and u.community_id=new.community_id)) then
      raise exception 'group tenant references do not match' using errcode='23514'; end if;
  else
    if new.group_id is not null and not exists(select 1 from public.invitation_groups g where g.id=new.group_id and g.community_id=new.community_id and g.resident_id=new.resident_id) then
      raise exception 'invitation group reference does not match' using errcode='23514'; end if;
  end if;
  return new;
end $$;
revoke all on function public.enforce_group_tenant_references() from public;
create trigger enforce_invitation_group_tenant before insert or update on public.invitation_groups for each row execute function public.enforce_group_tenant_references();
create trigger enforce_invitation_group_member_tenant before insert or update of community_id,resident_id,group_id on public.invitations for each row execute function public.enforce_group_tenant_references();

drop trigger if exists set_invitation_groups_updated_at on public.invitation_groups;
create trigger set_invitation_groups_updated_at before update on public.invitation_groups
for each row execute function public.set_updated_at();

alter table public.invitation_groups enable row level security;
alter table public.event_guest_credentials enable row level security;
alter table public.event_guest_credential_secrets enable row level security;

revoke all on public.invitation_groups from anon;
revoke all on public.event_guest_credentials from anon, authenticated;
revoke all on public.event_guest_credential_secrets from anon, authenticated;
grant select, insert, update on public.invitation_groups to authenticated;

create policy invitation_groups_select_scoped on public.invitation_groups for select to authenticated
using (
  public.has_active_community_role(community_id, array['admin', 'guard'])
  or resident_id = public.current_community_resident_id(community_id)
);
create policy invitation_groups_insert_owner on public.invitation_groups for insert to authenticated
with check (
  public.has_active_community_role(community_id, array['admin'])
  or resident_id = public.current_community_resident_id(community_id)
);
create policy invitation_groups_update_owner on public.invitation_groups for update to authenticated
using (
  public.has_active_community_role(community_id, array['admin'])
  or resident_id = public.current_community_resident_id(community_id)
) with check (
  public.has_active_community_role(community_id, array['admin'])
  or resident_id = public.current_community_resident_id(community_id)
);

create policy event_guest_credentials_owner_select on public.event_guest_credentials for select to authenticated
using (exists (
  select 1 from public.resident_events e
  where e.id = event_id and (
    public.has_active_community_role(e.community_id, array['admin'])
    or e.resident_id = public.current_community_resident_id(e.community_id)
  )
));

create or replace function public.create_invitation_group(
  p_community_id uuid, p_resident_id uuid, p_access_type text,
  p_visit_date date, p_window_start time, p_window_end_date date,
  p_window_end time, p_no_time_limit boolean, p_notes text,
  p_credential_type text, p_visitors jsonb, p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path = 'pg_catalog', 'extensions', 'public' as $$
declare
  v_resident public.residents%rowtype;
  v_group_id uuid;
  v_invitation_id uuid;
  v_visitor jsonb;
  v_ids jsonb := '[]'::jsonb;
  v_secret text;
  v_bytes bytea;
  v_attempt integer;
  v_request_fingerprint bytea;
  v_existing_fingerprint bytea;
begin
  if not (public.has_active_community_role(p_community_id, array['admin'])
    or p_resident_id = public.current_community_resident_id(p_community_id)) then
    raise exception 'group creation is not allowed' using errcode = '42501';
  end if;
  if p_credential_type not in ('pin', 'qr') or p_access_type not in ('visitor','delivery','service_provider','frequent_visitor')
    or p_idempotency_key is null or jsonb_typeof(p_visitors) <> 'array' or jsonb_array_length(p_visitors) not between 2 and 25 then
    raise exception 'invalid invitation group' using errcode = '22023';
  end if;
  select * into v_resident from public.residents
  where id = p_resident_id and community_id = p_community_id and is_active;
  if not found then raise exception 'resident not found' using errcode = 'P0002'; end if;

  v_request_fingerprint := digest(jsonb_build_object(
    'residentId',p_resident_id,'accessType',p_access_type,'visitDate',p_visit_date,
    'windowStart',p_window_start,'windowEndDate',p_window_end_date,'windowEnd',p_window_end,
    'noTimeLimit',p_no_time_limit,'notes',nullif(trim(p_notes),''),
    'credentialType',p_credential_type,'visitors',p_visitors
  )::text,'sha256');
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':'||p_resident_id::text||':'||p_idempotency_key::text,0));
  select id,creation_request_fingerprint into v_group_id,v_existing_fingerprint
  from public.invitation_groups
  where community_id=p_community_id and resident_id=p_resident_id and creation_idempotency_key=p_idempotency_key;
  if found then
    if v_existing_fingerprint is distinct from v_request_fingerprint then
      raise exception 'idempotency key was used for another invitation group' using errcode='22023';
    end if;
    select coalesce(jsonb_agg(id order by created_at,id),'[]'::jsonb) into v_ids
    from public.invitations where group_id=v_group_id;
    return jsonb_build_object('groupId',v_group_id,'invitationIds',v_ids);
  end if;

  insert into public.invitation_groups (
    community_id, resident_id, unit_id, access_type, visit_date, window_start,
    window_end_date, window_end, no_time_limit, notes, credential_type,
    creation_idempotency_key, creation_request_fingerprint
  ) values (
    p_community_id, p_resident_id, v_resident.unit_id, p_access_type, p_visit_date,
    p_window_start, case when p_no_time_limit then null else coalesce(p_window_end_date,p_visit_date) end,
    case when p_no_time_limit then '23:59'::time else p_window_end end,
    p_no_time_limit, nullif(trim(p_notes), ''), p_credential_type,
    p_idempotency_key, v_request_fingerprint
  ) returning id into v_group_id;

  for v_visitor in select value from jsonb_array_elements(p_visitors) loop
    if length(trim(v_visitor->>'fullName')) not between 2 and 120 then
      raise exception 'invalid visitor name' using errcode = '22023';
    end if;
    if exists(select 1 from public.invitations existing where existing.group_id=v_group_id and lower(existing.visitor_name)=lower(trim(v_visitor->>'fullName')) and coalesce(existing.visitor_phone,'')=coalesce(nullif(trim(v_visitor->>'phone'),''),'')) then
      raise exception 'duplicate visitor' using errcode='22023';
    end if;
    insert into public.invitations (
      community_id, resident_id, unit_id, group_id, visitor_name, visitor_phone,
      access_type, visit_date, window_start, window_end_date, window_end,
      no_time_limit, status, notes, share_token
    ) values (
      p_community_id, p_resident_id, v_resident.unit_id, v_group_id,
      trim(v_visitor->>'fullName'), nullif(trim(v_visitor->>'phone'), ''), p_access_type,
      p_visit_date, p_window_start,
      case when p_no_time_limit then null else coalesce(p_window_end_date,p_visit_date) end,
      case when p_no_time_limit then '23:59'::time else p_window_end end,
      p_no_time_limit, 'active', nullif(trim(p_notes), ''), encode(gen_random_bytes(32), 'hex')
    ) returning id into v_invitation_id;

    for v_attempt in 1..5 loop
      if p_credential_type = 'pin' then
        v_bytes := gen_random_bytes(4);
        v_secret := lpad(((get_byte(v_bytes,0)::bigint*16777216 + get_byte(v_bytes,1)::bigint*65536 + get_byte(v_bytes,2)::bigint*256 + get_byte(v_bytes,3)::bigint) % 1000000)::text, 6, '0');
      else
        v_secret := encode(gen_random_bytes(32), 'hex');
      end if;
      begin
        if exists(
          select 1 from public.event_guest_credentials event_guest_credential
          where event_guest_credential.credential_type=p_credential_type
            and event_guest_credential.credential_fingerprint=digest(p_community_id::text||':'||p_credential_type||':'||v_secret,'sha256')
        ) then raise unique_violation; end if;
        perform public.store_invitation_credential(p_community_id, v_invitation_id, p_credential_type, v_secret);
        exit;
      exception when unique_violation then
        if v_attempt = 5 then raise; end if;
      end;
    end loop;
    insert into public.invitation_events (invitation_id, event_type, event_label, payload)
    values (v_invitation_id, 'created', 'Invitacion grupal creada',
      jsonb_build_object('groupId', v_group_id, 'credentialType', p_credential_type));
    v_ids := v_ids || jsonb_build_array(v_invitation_id);
  end loop;
  return jsonb_build_object('groupId', v_group_id, 'invitationIds', v_ids);
end $$;

revoke all on function public.create_invitation_group(uuid,uuid,text,date,time,date,time,boolean,text,text,jsonb,uuid) from public;
grant execute on function public.create_invitation_group(uuid,uuid,text,date,time,date,time,boolean,text,text,jsonb,uuid) to authenticated;

create or replace function public.revoke_invitation_group(p_community_id uuid, p_group_id uuid)
returns integer language plpgsql security definer
set search_path = 'pg_catalog', 'extensions', 'public' as $$
declare v_count integer;
begin
  if not exists (select 1 from public.invitation_groups g where g.id=p_group_id and g.community_id=p_community_id and (
    public.has_active_community_role(p_community_id,array['admin']) or g.resident_id=public.current_community_resident_id(p_community_id)
  )) then raise exception 'group not found' using errcode='P0002'; end if;
  with changed as (
    update public.invitations set status='revoked', revoked_at=now()
    where group_id=p_group_id and community_id=p_community_id and status='active'
    returning id
  ), logged as (
    insert into public.invitation_events(invitation_id,event_type,event_label,payload)
    select id,'revoked','Invitacion revocada con su grupo',jsonb_build_object('groupId',p_group_id) from changed
  ) select count(*) into v_count from changed;
  return v_count;
end $$;
revoke all on function public.revoke_invitation_group(uuid,uuid) from public;
grant execute on function public.revoke_invitation_group(uuid,uuid) to authenticated;

create or replace function public.create_individual_resident_event(
  p_community_id uuid, p_resident_id uuid, p_name text, p_event_date date,
  p_window_start time, p_window_end_date date, p_window_end time,
  p_planned_exit_date date, p_planned_exit_time time, p_notes text,
  p_credential_type text, p_guests jsonb, p_idempotency_key uuid
) returns uuid language plpgsql security definer
set search_path = 'pg_catalog', 'extensions', 'public' as $$
declare
  v_resident public.residents%rowtype; v_event_id uuid; v_guest_id uuid;
  v_guest jsonb; v_secret text; v_bytes bytea; v_attempt integer; v_cred_id uuid;
  v_allows boolean; v_max smallint;
  v_request_fingerprint bytea; v_existing_fingerprint bytea;
begin
  if not (public.has_active_community_role(p_community_id,array['admin']) or p_resident_id=public.current_community_resident_id(p_community_id)) then
    raise exception 'event creation is not allowed' using errcode='42501';
  end if;
  if p_credential_type not in ('pin','qr') or p_idempotency_key is null or jsonb_typeof(p_guests)<>'array' or jsonb_array_length(p_guests) not between 1 and 500 then
    raise exception 'invalid event guests' using errcode='22023';
  end if;
  select * into v_resident from public.residents where id=p_resident_id and community_id=p_community_id and is_active;
  if not found then raise exception 'resident not found' using errcode='P0002'; end if;
  v_request_fingerprint:=digest(jsonb_build_object(
    'residentId',p_resident_id,'name',trim(p_name),'eventDate',p_event_date,
    'windowStart',p_window_start,'windowEndDate',p_window_end_date,'windowEnd',p_window_end,
    'plannedExitDate',p_planned_exit_date,'plannedExitTime',p_planned_exit_time,
    'notes',nullif(trim(p_notes),''),'credentialType',p_credential_type,'guests',p_guests
  )::text,'sha256');
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':'||p_resident_id::text||':'||p_idempotency_key::text,0));
  select id,creation_request_fingerprint into v_event_id,v_existing_fingerprint
  from public.resident_events
  where community_id=p_community_id and resident_id=p_resident_id and creation_idempotency_key=p_idempotency_key;
  if found then
    if v_existing_fingerprint is distinct from v_request_fingerprint then
      raise exception 'idempotency key was used for another event' using errcode='22023';
    end if;
    return v_event_id;
  end if;
  insert into public.resident_events(community_id,resident_id,unit_id,name,event_date,window_start,window_end_date,window_end,planned_exit_date,planned_exit_time,status,notes,share_token,credential_mode,creation_idempotency_key,creation_request_fingerprint)
  values(p_community_id,p_resident_id,v_resident.unit_id,trim(p_name),p_event_date,p_window_start,p_window_end_date,p_window_end,p_planned_exit_date,p_planned_exit_time,'active',nullif(trim(p_notes),''),encode(gen_random_bytes(32),'hex'),'individual',p_idempotency_key,v_request_fingerprint)
  returning id into v_event_id;
  for v_guest in select value from jsonb_array_elements(p_guests) loop
    if length(trim(v_guest->>'fullName')) not between 2 and 120 then raise exception 'invalid guest name' using errcode='22023'; end if;
    if exists(select 1 from public.event_guests existing where existing.event_id=v_event_id and lower(existing.full_name)=lower(trim(v_guest->>'fullName')) and coalesce(existing.phone,'')=coalesce(nullif(trim(v_guest->>'phone'),''),'')) then raise exception 'duplicate event guest' using errcode='22023'; end if;
    v_allows := coalesce((v_guest->>'allowsCompanions')::boolean,false);
    v_max := coalesce((v_guest->>'maxCompanions')::smallint,0);
    if (not v_allows and v_max<>0) or (v_allows and v_max not between 1 and 5) then raise exception 'invalid companion limit' using errcode='22023'; end if;
    insert into public.event_guests(event_id,full_name,phone,notes,allows_companions,max_companions)
    values(v_event_id,trim(v_guest->>'fullName'),nullif(trim(v_guest->>'phone'),''),nullif(trim(v_guest->>'notes'),''),v_allows,v_max)
    returning id into v_guest_id;
    for v_attempt in 1..5 loop
      if p_credential_type='pin' then
        v_bytes:=gen_random_bytes(4);
        v_secret:=lpad(((get_byte(v_bytes,0)::bigint*16777216+get_byte(v_bytes,1)::bigint*65536+get_byte(v_bytes,2)::bigint*256+get_byte(v_bytes,3)::bigint)%100000000)::text,8,'0');
      else v_secret:=encode(gen_random_bytes(32),'hex'); end if;
      begin
        if exists(select 1 from public.access_credentials c join public.invitations i on i.id=c.invitation_id where i.community_id=p_community_id and c.credential_type=p_credential_type and public.credential_matches(v_secret,c.credential_hash,c.legacy_fallback_hash,c.credential_value,c.qr_payload))
          or exists(select 1 from public.event_credentials c join public.resident_events e on e.id=c.event_id where e.community_id=p_community_id and c.credential_type=p_credential_type and public.credential_matches(v_secret,c.credential_hash,c.legacy_fallback_hash,c.credential_value,c.qr_payload)) then
          raise unique_violation;
        end if;
        insert into public.event_guest_credentials(event_id,event_guest_id,credential_type,credential_hash,credential_fingerprint,share_token)
        values(v_event_id,v_guest_id,p_credential_type,crypt(v_secret,gen_salt('bf',10)),digest(p_community_id::text||':'||p_credential_type||':'||v_secret,'sha256'),encode(gen_random_bytes(32),'hex'))
        returning id into v_cred_id;
        insert into public.event_guest_credential_secrets(event_guest_credential_id,secret_value) values(v_cred_id,v_secret);
        exit;
      exception when unique_violation then if v_attempt=5 then raise; end if; end;
    end loop;
  end loop;
  insert into public.event_activity(event_id,activity_type,activity_label,payload)
  values(v_event_id,'created','Evento creado',jsonb_build_object('guestCount',jsonb_array_length(p_guests),'credentialMode','individual','credentialType',p_credential_type));
  return v_event_id;
end $$;
revoke all on function public.create_individual_resident_event(uuid,uuid,text,date,time,date,time,date,time,text,text,jsonb,uuid) from public;
grant execute on function public.create_individual_resident_event(uuid,uuid,text,date,time,date,time,date,time,text,text,jsonb,uuid) to authenticated;

create or replace function public.get_event_guest_credentials(p_event_id uuid)
returns jsonb language sql stable security definer
set search_path='pg_catalog','extensions','public' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'event_id',c.event_id,'event_guest_id',c.event_guest_id,
    'credential_type',c.credential_type,'credential_value',s.secret_value,
    'qr_payload',case when c.credential_type='qr' then s.secret_value else null end,
    'credential_audit_id',c.credential_audit_id,'share_token',c.share_token,'created_at',c.created_at
  ) order by c.created_at), '[]'::jsonb)
  from public.event_guest_credentials c
  join public.event_guest_credential_secrets s on s.event_guest_credential_id=c.id
  join public.resident_events e on e.id=c.event_id
  where c.event_id=p_event_id and (public.has_active_community_role(e.community_id,array['admin']) or e.resident_id=public.current_community_resident_id(e.community_id));
$$;
revoke all on function public.get_event_guest_credentials(uuid) from public;
grant execute on function public.get_event_guest_credentials(uuid) to authenticated;

create or replace function public.get_public_event_guest(p_share_token text)
returns jsonb language sql stable security definer
set search_path='pg_catalog','extensions','public' as $$
  select jsonb_build_object(
    'event_name',e.name,'guest_name',g.full_name,'event_date',e.event_date,
    'window_start',e.window_start,'window_end_date',e.window_end_date,'window_end',e.window_end,
    'planned_exit_date',e.planned_exit_date,'planned_exit_time',e.planned_exit_time,
    'status',case when e.status='revoked' then 'revoked' when now()<(e.event_date+e.window_start) at time zone community.time_zone then 'scheduled' when now()>(e.window_end_date+e.window_end) at time zone community.time_zone then 'expired' else 'active' end,'resident_name',r.full_name,'unit_identifier',u.identifier,
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
revoke all on function public.get_public_event_guest(text) from public;
grant execute on function public.get_public_event_guest(text) to anon,authenticated;

create or replace function public.mark_event_guest_credential_shared(p_event_id uuid,p_event_guest_id uuid,p_channel text)
returns void language plpgsql security definer set search_path='pg_catalog','extensions','public' as $$
begin
  if p_channel not in ('whatsapp','native','copy') or not exists(select 1 from public.resident_events e where e.id=p_event_id and (public.has_active_community_role(e.community_id,array['admin']) or e.resident_id=public.current_community_resident_id(e.community_id))) then
    raise exception 'share is not allowed' using errcode='42501'; end if;
  update public.event_guests set credential_shared_at=coalesce(credential_shared_at,now()) where id=p_event_guest_id and event_id=p_event_id;
  insert into public.event_activity(event_id,activity_type,activity_label,payload) values(p_event_id,'shared','Acceso individual compartido',jsonb_build_object('eventGuestId',p_event_guest_id,'channel',p_channel));
end $$;
revoke all on function public.mark_event_guest_credential_shared(uuid,uuid,text) from public;
grant execute on function public.mark_event_guest_credential_shared(uuid,uuid,text) to authenticated;

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
revoke all on function public.get_public_invitation(text) from public;
grant execute on function public.get_public_invitation(text) to anon,authenticated;

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
revoke all on function public.get_public_event(text) from public;
grant execute on function public.get_public_event(text) to anon,authenticated;

create or replace function public.validate_event_guest_credential(
  p_community_id uuid,p_credential_type text,p_credential_value text,p_device_id text,p_origin text
) returns jsonb language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare
  v_actor uuid:=auth.uid(); v_email text:=lower(auth.jwt()->>'email'); v_device bytea; v_origin bytea;
  v_limit public.credential_rate_limits%rowtype; v_credential public.event_guest_credentials%rowtype;
  v_event public.resident_events%rowtype; v_guest public.event_guests%rowtype; v_tz text;
  v_start timestamptz; v_end timestamptz; v_status text; v_fail integer; v_retry integer;
begin
  if v_actor is null or v_email is null or not public.has_active_community_role(p_community_id,array['admin','guard']) then raise exception 'credential validation is not allowed' using errcode='42501'; end if;
  if p_credential_type not in ('pin','qr') or length(p_credential_value) not between 6 and 128 then raise exception 'invalid credential' using errcode='22023'; end if;
  select c.* into v_credential from public.event_guest_credentials c join public.resident_events e on e.id=c.event_id
  where e.community_id=p_community_id and c.credential_type=p_credential_type
    and c.credential_fingerprint=digest(p_community_id::text||':'||p_credential_type||':'||trim(p_credential_value),'sha256') limit 1;
  if not found then return null; end if;
  v_device:=digest(p_device_id,'sha256'); v_origin:=digest(p_origin,'sha256');
  insert into public.credential_rate_limits(community_id,actor_user_id,device_hash,origin_hash)
  values(p_community_id,v_actor,v_device,v_origin) on conflict do nothing;
  select * into v_limit from public.credential_rate_limits where community_id=p_community_id and actor_user_id=v_actor and device_hash=v_device and origin_hash=v_origin for update;
  if v_limit.blocked_until is not null and v_limit.blocked_until>now() then
    v_retry:=greatest(1,ceil(extract(epoch from (v_limit.blocked_until-now())))::integer);
    return jsonb_build_object('rateLimited',true,'retryAfterSeconds',v_retry,'status','rate_limited','credentialRef',v_credential.credential_audit_id);
  end if;
  if v_limit.window_started_at<now()-interval '10 minutes' then update public.credential_rate_limits set window_started_at=now(),failure_count=0,blocked_until=null where community_id=p_community_id and actor_user_id=v_actor and device_hash=v_device and origin_hash=v_origin; v_limit.failure_count:=0; end if;
  select * into v_event from public.resident_events where id=v_credential.event_id;
  select * into v_guest from public.event_guests where id=v_credential.event_guest_id;
  select time_zone into v_tz from public.communities where id=p_community_id;
  v_start:=(v_event.event_date+v_event.window_start) at time zone v_tz; v_end:=(v_event.window_end_date+v_event.window_end) at time zone v_tz;
  v_status:=case when v_event.status='revoked' then 'revoked' when now()<v_start then 'scheduled' when now()>v_end then 'expired' when v_guest.attendance_status<>'pending' then 'used' else 'active' end;
  if v_status='active' then update public.credential_rate_limits set failure_count=0,window_started_at=now(),blocked_until=null,last_attempt_at=now() where community_id=p_community_id and actor_user_id=v_actor and device_hash=v_device and origin_hash=v_origin;
  else v_fail:=v_limit.failure_count+1; update public.credential_rate_limits set failure_count=v_fail,blocked_until=case when v_fail>=5 then now()+interval '15 minutes' else null end,last_attempt_at=now() where community_id=p_community_id and actor_user_id=v_actor and device_hash=v_device and origin_hash=v_origin; end if;
  insert into public.access_events(community_id,event_id,event_guest_id,resident_id,unit_id,visitor_name,access_type,access_event_type,event_status,event_direction,event_source,event_label,validated_by_email,details,created_by_email)
  values(p_community_id,v_event.id,v_guest.id,v_event.resident_id,v_event.unit_id,v_guest.full_name,'visitor',case when v_status='active' then 'validation_success' else 'validation_failed' end,case when v_status='active' then 'validated' else 'rejected' end,'validation','event',case when v_status='active' then 'Invitado de evento validado' else 'Validacion de invitado rechazada' end,v_email,jsonb_build_object('credentialType',p_credential_type,'credentialRef',v_credential.credential_audit_id,'result',v_status),v_email);
  return jsonb_build_object('rateLimited',case when v_status='active' then false else v_fail>=5 end,'retryAfterSeconds',case when v_status<>'active' and v_fail>=5 then 900 else null end,'kind','event','resourceId',v_event.id,'eventGuestId',v_guest.id,'status',v_status,'credentialRef',v_credential.credential_audit_id);
end $$;
revoke all on function public.validate_event_guest_credential(uuid,text,text,text,text) from public;
grant execute on function public.validate_event_guest_credential(uuid,text,text,text,text) to authenticated;

create or replace function public.register_event_guest_entry(
  p_community_id uuid,p_event_id uuid,p_event_guest_id uuid,p_companion_count integer,p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path='pg_catalog','extensions','public' as $$
declare v_event public.resident_events%rowtype; v_guest public.event_guests%rowtype; v_existing public.visitor_entries%rowtype; v_entry uuid; v_email text:=lower(auth.jwt()->>'email'); v_tz text; v_start timestamptz; v_end timestamptz; v_ref text;
begin
  if v_email is null or not public.has_active_community_role(p_community_id,array['admin','guard']) then raise exception 'entry registration is not allowed' using errcode='42501'; end if;
  if p_idempotency_key is null or p_companion_count not between 0 and 5 then raise exception 'invalid entry request' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':'||p_idempotency_key::text,0));
  select * into v_existing from public.visitor_entries where community_id=p_community_id and idempotency_key=p_idempotency_key;
  if found then if v_existing.event_id is distinct from p_event_id or v_existing.event_guest_id is distinct from p_event_guest_id or v_existing.companion_count is distinct from p_companion_count then raise exception 'idempotency key was used for another operation' using errcode='22023'; end if; return v_existing.id; end if;
  select * into v_event from public.resident_events where id=p_event_id and community_id=p_community_id for update; if not found then raise exception 'event not found' using errcode='P0002'; end if;
  select * into v_guest from public.event_guests where id=p_event_guest_id and event_id=p_event_id for update; if not found then raise exception 'guest not found' using errcode='P0002'; end if;
  if not exists(
    select 1 from public.access_events validation
    where validation.community_id=p_community_id
      and validation.event_id=p_event_id
      and validation.access_event_type='validation_success'
      and validation.created_by_email=v_email
      and validation.created_at>=now()-interval '10 minutes'
      and (v_event.credential_mode='shared' or validation.event_guest_id=p_event_guest_id)
  ) then raise exception 'a recent successful validation is required' using errcode='42501'; end if;
  if p_companion_count>v_guest.max_companions or (p_companion_count>0 and not v_guest.allows_companions) then raise exception 'companion limit exceeded' using errcode='22023'; end if;
  select time_zone into v_tz from public.communities where id=p_community_id; v_start:=(v_event.event_date+v_event.window_start) at time zone v_tz; v_end:=(v_event.window_end_date+v_event.window_end) at time zone v_tz;
  if v_event.status<>'active' or now()<v_start or now()>v_end then raise exception 'event is outside its access window' using errcode='22023'; end if;
  if v_guest.attendance_status<>'pending' then raise exception 'event guest was already registered' using errcode='55000'; end if;
  update public.event_guests set attendance_status='inside',checked_in_at=now() where id=v_guest.id;
  if v_event.credential_mode='individual' then select credential_audit_id into v_ref from public.event_guest_credentials where event_guest_id=v_guest.id; else select credential_audit_id into v_ref from public.event_credentials where event_id=v_event.id; end if;
  insert into public.visitor_entries(community_id,event_id,event_guest_id,resident_id,unit_id,visitor_name,access_type,registration_source,notes,created_by_email,idempotency_key,companion_count)
  values(p_community_id,v_event.id,v_guest.id,v_event.resident_id,v_event.unit_id,v_guest.full_name,'visitor','event',coalesce(v_guest.notes,v_event.notes),v_email,p_idempotency_key,p_companion_count) returning id into v_entry;
  insert into public.event_activity(event_id,activity_type,activity_label,payload) values(v_event.id,'guest_checked_in',v_guest.full_name||' ingreso',jsonb_build_object('eventGuestId',v_guest.id,'visitorEntryId',v_entry,'companionCount',p_companion_count));
  insert into public.access_events(community_id,event_id,event_guest_id,visitor_entry_id,resident_id,unit_id,visitor_name,access_type,access_event_type,event_status,event_direction,event_source,event_label,validated_by_email,notes,details,created_by_email)
  values(p_community_id,v_event.id,v_guest.id,v_entry,v_event.resident_id,v_event.unit_id,v_guest.full_name,'visitor','entry_registered','entered','entry','event','Entrada de evento registrada',v_email,coalesce(v_guest.notes,v_event.notes),jsonb_build_object('source','event','credentialRef',v_ref,'result','entered','idempotencyKey',p_idempotency_key,'companionCount',p_companion_count),v_email);
  return v_entry;
end $$;
revoke all on function public.register_event_guest_entry(uuid,uuid,uuid,integer,uuid) from public;
grant execute on function public.register_event_guest_entry(uuid,uuid,uuid,integer,uuid) to authenticated;

create or replace function public.get_guard_upcoming_access(
  p_community_id uuid,p_query text default '',p_status text default 'all',p_page integer default 1,p_page_size integer default 3
) returns jsonb language plpgsql stable security definer set search_path='pg_catalog','extensions','public' as $$
declare v_result jsonb;
begin
  if not public.has_active_community_role(p_community_id,array['admin','guard']) then raise exception 'guard access is not allowed' using errcode='42501'; end if;
  p_page:=greatest(coalesce(p_page,1),1); p_page_size:=least(greatest(coalesce(p_page_size,3),1),20);
  with community as (select time_zone from public.communities where id=p_community_id), candidates as (
    select 'event'::text kind,e.id,e.name label,e.event_date access_date,e.window_start,e.window_end_date,e.window_end,
      r.full_name host_name,u.identifier unit_identifier,u.building unit_building,
      count(g.id) filter(where g.attendance_status='pending')::int pending_count,
      count(g.id) filter(where g.attendance_status='inside')::int inside_count,
      count(g.id) filter(where g.attendance_status='exited')::int exited_count,
      (e.event_date+e.window_start) at time zone c.time_zone start_at,
      (e.window_end_date+e.window_end) at time zone c.time_zone end_at
    from public.resident_events e join public.residents r on r.id=e.resident_id left join public.units u on u.id=e.unit_id
    left join public.event_guests g on g.event_id=e.id cross join community c
    where e.community_id=p_community_id and e.status='active'
    group by e.id,r.full_name,u.identifier,u.building,c.time_zone
    union all
    select 'group'::text kind,ig.id,('Invitacion para '||count(i.id)||' personas') label,ig.visit_date,ig.window_start,coalesce(ig.window_end_date,ig.visit_date),ig.window_end,
      r.full_name,u.identifier,u.building,count(i.id) filter(where i.status='active')::int,
      count(ve.id) filter(where ve.entry_status='inside')::int,count(ve.id) filter(where ve.entry_status='exited')::int,
      (ig.visit_date+ig.window_start) at time zone c.time_zone,
      case when ig.no_time_limit then now()+interval '100 years' else (coalesce(ig.window_end_date,ig.visit_date)+ig.window_end) at time zone c.time_zone end
    from public.invitation_groups ig join public.invitations i on i.group_id=ig.id join public.residents r on r.id=ig.resident_id
    left join public.units u on u.id=ig.unit_id left join public.visitor_entries ve on ve.invitation_id=i.id cross join community c
    where ig.community_id=p_community_id group by ig.id,r.full_name,u.identifier,u.building,c.time_zone
  ), filtered as (
    select *,case when start_at<=now() and end_at>=now() then 'active' else 'next' end timing_status from candidates
    where end_at>=now() and start_at<=now()+interval '6 hours'
      and (coalesce(trim(p_query),'')='' or label ilike '%'||trim(p_query)||'%' or host_name ilike '%'||trim(p_query)||'%' or unit_identifier ilike '%'||trim(p_query)||'%')
      and (p_status='all' or (p_status='active' and start_at<=now()) or (p_status='next' and start_at>now()))
  ), numbered as (select *,count(*) over() total_count from filtered order by start_at,kind,id offset (p_page-1)*p_page_size limit p_page_size)
  select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(numbered)-'total_count' order by start_at,kind,id),'[]'::jsonb),'total',coalesce(max(total_count),0),'page',p_page,'pageSize',p_page_size) into v_result from numbered;
  return v_result;
end $$;
revoke all on function public.get_guard_upcoming_access(uuid,text,text,integer,integer) from public;
grant execute on function public.get_guard_upcoming_access(uuid,text,text,integer,integer) to authenticated;

create or replace function public.get_invitation_card_ids(
  p_community_id uuid,p_resident_id uuid,p_query text,p_status text,p_date_from date,p_date_to date,p_page integer,p_page_size integer
) returns jsonb language plpgsql stable security definer set search_path='pg_catalog','extensions','public' as $$
declare v_result jsonb;
begin
  if not (public.has_active_community_role(p_community_id,array['admin','guard']) or (p_resident_id is not null and p_resident_id=public.current_community_resident_id(p_community_id))) then raise exception 'invitation list is not allowed' using errcode='42501'; end if;
  p_page:=greatest(coalesce(p_page,1),1);p_page_size:=least(greatest(coalesce(p_page_size,10),1),25);
  with community as(select time_zone from public.communities where id=p_community_id), filtered as(
    select i.*,row_number() over(partition by coalesce(i.group_id,i.id) order by i.created_at desc,i.id desc) member_rank
    from public.invitations i cross join community c
    where i.community_id=p_community_id and (p_resident_id is null or i.resident_id=p_resident_id)
      and (coalesce(trim(p_query),'')='' or i.visitor_name ilike '%'||trim(p_query)||'%')
      and (p_date_from is null or i.visit_date>=p_date_from) and (p_date_to is null or i.visit_date<=p_date_to)
      and (p_status='all'
        or (p_status='used' and i.status='used') or (p_status='revoked' and i.status='revoked')
        or (p_status='current' and i.status='active' and (i.no_time_limit or (coalesce(i.window_end_date,i.visit_date)+i.window_end) at time zone c.time_zone>=now()))
        or (p_status='expired' and i.status='active' and not i.no_time_limit and (coalesce(i.window_end_date,i.visit_date)+i.window_end) at time zone c.time_zone<now()))
  ), cards as(select * from filtered where member_rank=1), paged as(
    select id,created_at,count(*) over() total_count from cards order by created_at desc,id desc offset (p_page-1)*p_page_size limit p_page_size
  ) select jsonb_build_object('ids',coalesce(jsonb_agg(id order by created_at desc,id desc),'[]'::jsonb),'total',coalesce(max(total_count),0),'page',p_page,'pageSize',p_page_size) into v_result from paged;
  return v_result;
end $$;
revoke all on function public.get_invitation_card_ids(uuid,uuid,text,text,date,date,integer,integer) from public;
grant execute on function public.get_invitation_card_ids(uuid,uuid,text,text,date,date,integer,integer) to authenticated;

reset search_path;
