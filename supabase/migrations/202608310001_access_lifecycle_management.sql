-- Non-destructive lifecycle management for invitations, groups and resident events.
-- Existing creation migrations remain immutable; this migration adds versioned edits,
-- credential rotation, cancellation/removal metadata and security-definer mutations.

set search_path = pg_catalog, extensions, public;

alter table public.invitations
  add column if not exists version integer not null default 1,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancellation_reason text,
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid;

alter table public.invitation_groups
  add column if not exists version integer not null default 1,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancellation_reason text;

alter table public.resident_events
  add column if not exists version integer not null default 1,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancellation_reason text,
  add column if not exists default_allows_companions boolean not null default false,
  add column if not exists default_max_companions smallint not null default 0;

alter table public.event_guests
  add column if not exists version integer not null default 1,
  add column if not exists resident_contact_id uuid references public.resident_contacts(id) on delete set null,
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid,
  add column if not exists removal_reason text;

alter table public.access_credentials
  add column if not exists revoked_at timestamptz,
  add column if not exists revocation_reason text;

alter table public.event_guest_credentials
  add column if not exists revoked_at timestamptz,
  add column if not exists revocation_reason text,
  add column if not exists credential_version smallint not null default 1;

alter table public.invitations
  drop constraint if exists invitations_version_check,
  add constraint invitations_version_check check (version >= 1),
  drop constraint if exists invitations_cancellation_metadata_check,
  add constraint invitations_cancellation_metadata_check check (
    (cancelled_at is null and cancelled_by is null and cancellation_reason is null)
    or (cancelled_at is not null and cancelled_by is not null)
  ),
  drop constraint if exists invitations_removal_metadata_check,
  add constraint invitations_removal_metadata_check check (
    (removed_at is null and removed_by is null)
    or (removed_at is not null and removed_by is not null)
  );

alter table public.invitation_groups
  drop constraint if exists invitation_groups_version_check,
  add constraint invitation_groups_version_check check (version >= 1),
  drop constraint if exists invitation_groups_cancellation_metadata_check,
  add constraint invitation_groups_cancellation_metadata_check check (
    (cancelled_at is null and cancelled_by is null and cancellation_reason is null)
    or (cancelled_at is not null and cancelled_by is not null)
  );

alter table public.resident_events
  drop constraint if exists resident_events_version_check,
  add constraint resident_events_version_check check (version >= 1),
  drop constraint if exists resident_events_default_companions_check,
  add constraint resident_events_default_companions_check check (
    (not default_allows_companions and default_max_companions = 0)
    or (default_allows_companions and default_max_companions between 1 and 5)
  ),
  drop constraint if exists resident_events_cancellation_metadata_check,
  add constraint resident_events_cancellation_metadata_check check (
    (cancelled_at is null and cancelled_by is null and cancellation_reason is null)
    or (cancelled_at is not null and cancelled_by is not null)
  );

alter table public.event_guests drop constraint if exists event_guests_attendance_status_check;
alter table public.event_guests
  add constraint event_guests_attendance_status_check check (attendance_status in ('pending','inside','exited','removed')),
  drop constraint if exists event_guests_version_check,
  add constraint event_guests_version_check check (version >= 1),
  drop constraint if exists event_guests_removal_metadata_check,
  add constraint event_guests_removal_metadata_check check (
    (removed_at is null and removed_by is null and removal_reason is null)
    or (removed_at is not null and removed_by is not null)
  );

alter table public.access_credentials drop constraint if exists access_credentials_invitation_id_key;
alter table public.event_guest_credentials drop constraint if exists event_guest_credentials_event_guest_id_key;

create unique index if not exists access_credentials_one_current_per_invitation
  on public.access_credentials(invitation_id) where revoked_at is null;
create unique index if not exists event_guest_credentials_one_current_per_guest
  on public.event_guest_credentials(event_guest_id) where revoked_at is null;
create index if not exists invitation_groups_cancelled_at_idx on public.invitation_groups(cancelled_at) where cancelled_at is not null;
create index if not exists resident_events_cancelled_at_idx on public.resident_events(cancelled_at) where cancelled_at is not null;
create index if not exists event_guests_event_status_name_idx on public.event_guests(event_id,attendance_status,full_name,id);
create index if not exists invitations_group_status_name_idx on public.invitations(group_id,status,visitor_name,id) where group_id is not null;

alter table public.invitation_events drop constraint if exists invitation_events_event_type_check;
alter table public.invitation_events add constraint invitation_events_event_type_check check (event_type in (
  'created','shared','revoked','status_changed','window_updated','updated','credential_rotated',
  'member_added','member_removed','cancelled','duplicated'
));

alter table public.event_activity drop constraint if exists event_activity_activity_type_check;
alter table public.event_activity add constraint event_activity_activity_type_check check (activity_type in (
  'created','shared','revoked','guest_checked_in','guest_checked_out','updated','guest_added',
  'guest_updated','guest_removed','cancelled','duplicated','credential_rotated'
));

create table public.access_change_audit (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  actor_user_id uuid not null,
  actor_email text not null,
  resource_type text not null check (resource_type in ('invitation','invitation_group','event','event_guest')),
  resource_id uuid not null,
  change_type text not null,
  changed_fields text[] not null default '{}',
  before_data jsonb not null default '{}',
  after_data jsonb not null default '{}',
  reason text,
  idempotency_key uuid,
  result jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (not public.audit_details_have_raw_credential(before_data)),
  check (not public.audit_details_have_raw_credential(after_data))
);

create unique index access_change_audit_idempotency_idx
  on public.access_change_audit(community_id,resource_type,resource_id,change_type,idempotency_key)
  where idempotency_key is not null;
create index access_change_audit_resource_created_idx
  on public.access_change_audit(community_id,resource_type,resource_id,created_at desc,id desc);

create table public.invitation_share_token_history (
  share_token text primary key,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  revoked_at timestamptz not null default now(),
  revocation_reason text not null
);
alter table public.invitation_share_token_history enable row level security;
revoke all on public.invitation_share_token_history from anon,authenticated;

alter table public.access_change_audit enable row level security;
revoke all on public.access_change_audit from anon, authenticated;

create or replace function public.record_access_change(
  p_community_id uuid,p_resource_type text,p_resource_id uuid,p_change_type text,
  p_changed_fields text[],p_before jsonb,p_after jsonb,p_reason text,
  p_idempotency_key uuid,p_result jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_id uuid; v_actor uuid:=auth.uid(); v_email text:=lower(auth.jwt()->>'email');
begin
  if v_actor is null or v_email is null then raise exception 'audit actor is required' using errcode='42501'; end if;
  insert into public.access_change_audit(
    community_id,actor_user_id,actor_email,resource_type,resource_id,change_type,
    changed_fields,before_data,after_data,reason,idempotency_key,result
  ) values (
    p_community_id,v_actor,v_email,p_resource_type,p_resource_id,p_change_type,
    coalesce(p_changed_fields,'{}'),public.redact_credential_audit_details(coalesce(p_before,'{}')),
    public.redact_credential_audit_details(coalesce(p_after,'{}')),nullif(trim(p_reason),''),p_idempotency_key,
    public.redact_credential_audit_details(coalesce(p_result,'{}'))
  ) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.record_access_change(uuid,text,uuid,text,text[],jsonb,jsonb,text,uuid,jsonb) from public,anon,authenticated;

create or replace function public.revoke_current_invitation_credential(p_invitation_id uuid,p_reason text)
returns text language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_audit text;
begin
  update public.access_credentials set
    revoked_at=coalesce(revoked_at,now()),revocation_reason=coalesce(revocation_reason,p_reason),
    credential_hash=crypt(encode(gen_random_bytes(32),'hex'),gen_salt('bf',10)),
    legacy_fallback_hash=null,credential_value=null,qr_payload=null
  where invitation_id=p_invitation_id and revoked_at is null returning credential_audit_id into v_audit;
  return v_audit;
end $$;
revoke all on function public.revoke_current_invitation_credential(uuid,text) from public,anon,authenticated;

create or replace function public.issue_invitation_credential_revision(
  p_community_id uuid,p_invitation_id uuid,p_credential_type text
) returns text language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_secret text; v_bytes bytea; v_attempt integer; v_audit text;
begin
  for v_attempt in 1..5 loop
    if p_credential_type='pin' then
      v_bytes:=gen_random_bytes(4);
      v_secret:=lpad(((get_byte(v_bytes,0)::bigint*16777216+get_byte(v_bytes,1)::bigint*65536+get_byte(v_bytes,2)::bigint*256+get_byte(v_bytes,3)::bigint)%1000000)::text,6,'0');
    else v_secret:=encode(gen_random_bytes(32),'hex'); end if;
    begin
      if exists(select 1 from public.access_credentials c join public.invitations i on i.id=c.invitation_id where i.community_id=p_community_id and c.revoked_at is null and c.credential_type=p_credential_type and public.credential_matches(v_secret,c.credential_hash,c.legacy_fallback_hash,c.credential_value,c.qr_payload))
        or exists(select 1 from public.event_credentials c join public.resident_events e on e.id=c.event_id where e.community_id=p_community_id and c.credential_type=p_credential_type and public.credential_matches(v_secret,c.credential_hash,c.legacy_fallback_hash,c.credential_value,c.qr_payload))
        or exists(select 1 from public.event_guest_credentials c where c.revoked_at is null and c.credential_type=p_credential_type and c.credential_fingerprint=digest(p_community_id::text||':'||p_credential_type||':'||v_secret,'sha256')) then raise unique_violation; end if;
      v_audit:=public.store_invitation_credential(p_community_id,p_invitation_id,p_credential_type,v_secret);
      return v_audit;
    exception when unique_violation then if v_attempt=5 then raise; end if; end;
  end loop;
  raise exception 'credential generation failed' using errcode='55000';
end $$;
revoke all on function public.issue_invitation_credential_revision(uuid,uuid,text) from public,anon,authenticated;

create or replace function public.revoke_current_event_guest_credential(p_event_guest_id uuid,p_reason text)
returns text language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_audit text;
begin
  update public.event_guest_credentials set
    revoked_at=coalesce(revoked_at,now()),revocation_reason=coalesce(revocation_reason,p_reason),
    credential_hash=crypt(encode(gen_random_bytes(32),'hex'),gen_salt('bf',10)),
    credential_fingerprint=digest(gen_random_bytes(32),'sha256')
  where event_guest_id=p_event_guest_id and revoked_at is null returning credential_audit_id into v_audit;
  return v_audit;
end $$;
revoke all on function public.revoke_current_event_guest_credential(uuid,text) from public,anon,authenticated;

create or replace function public.issue_event_guest_credential_revision(
  p_community_id uuid,p_event_id uuid,p_event_guest_id uuid,p_credential_type text
) returns text language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_secret text; v_bytes bytea; v_attempt integer; v_id uuid; v_audit text;
begin
  for v_attempt in 1..5 loop
    if p_credential_type='pin' then
      v_bytes:=gen_random_bytes(4);
      v_secret:=lpad(((get_byte(v_bytes,0)::bigint*16777216+get_byte(v_bytes,1)::bigint*65536+get_byte(v_bytes,2)::bigint*256+get_byte(v_bytes,3)::bigint)%100000000)::text,8,'0');
    else v_secret:=encode(gen_random_bytes(32),'hex'); end if;
    begin
      if exists(select 1 from public.access_credentials c join public.invitations i on i.id=c.invitation_id where i.community_id=p_community_id and c.revoked_at is null and c.credential_type=p_credential_type and public.credential_matches(v_secret,c.credential_hash,c.legacy_fallback_hash,c.credential_value,c.qr_payload))
        or exists(select 1 from public.event_credentials c join public.resident_events e on e.id=c.event_id where e.community_id=p_community_id and c.credential_type=p_credential_type and public.credential_matches(v_secret,c.credential_hash,c.legacy_fallback_hash,c.credential_value,c.qr_payload))
        or exists(select 1 from public.event_guest_credentials c where c.revoked_at is null and c.credential_type=p_credential_type and c.credential_fingerprint=digest(p_community_id::text||':'||p_credential_type||':'||v_secret,'sha256')) then raise unique_violation; end if;
      insert into public.event_guest_credentials(event_id,event_guest_id,credential_type,credential_hash,credential_fingerprint,share_token,credential_version)
      values(p_event_id,p_event_guest_id,p_credential_type,crypt(v_secret,gen_salt('bf',10)),digest(p_community_id::text||':'||p_credential_type||':'||v_secret,'sha256'),encode(gen_random_bytes(32),'hex'),2)
      returning id,credential_audit_id into v_id,v_audit;
      insert into public.event_guest_credential_secrets(event_guest_credential_id,secret_value) values(v_id,v_secret);
      return v_audit;
    exception when unique_violation then if v_attempt=5 then raise; end if; end;
  end loop;
  raise exception 'credential generation failed' using errcode='55000';
end $$;
revoke all on function public.issue_event_guest_credential_revision(uuid,uuid,uuid,text) from public,anon,authenticated;

create or replace function public.update_managed_invitation(
  p_community_id uuid,p_invitation_id uuid,p_expected_version integer,
  p_patch jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare
  v_row public.invitations%rowtype; v_before jsonb; v_result jsonb; v_actor uuid:=auth.uid();
  v_name text; v_phone text; v_contact uuid; v_access text; v_date date; v_mode text;
  v_start time; v_end_date date; v_end time; v_exit_date date; v_exit_time time; v_notes text;
  v_identity_changed boolean; v_credential_type text; v_rotated_audit text;
begin
  if p_idempotency_key is null or p_patch is null then raise exception 'idempotency key and patch are required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':invitation:'||p_invitation_id::text||':'||p_idempotency_key::text,0));
  select result into v_result from public.access_change_audit where community_id=p_community_id and resource_type='invitation' and resource_id=p_invitation_id and change_type='updated' and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  select * into v_row from public.invitations where id=p_invitation_id and community_id=p_community_id for update;
  if not found then raise exception 'invitation not found' using errcode='P0002'; end if;
  if not (public.has_active_community_role(p_community_id,array['admin']) or v_row.resident_id=public.current_community_resident_id(p_community_id)) then raise exception 'invitation update is not allowed' using errcode='42501'; end if;
  if v_row.group_id is not null then raise exception 'group member must be managed through its group' using errcode='55000'; end if;
  if v_row.version<>p_expected_version then raise exception 'invitation version conflict' using errcode='40001'; end if;
  if v_row.status<>'active' or v_row.cancelled_at is not null or exists(select 1 from public.visitor_entries x where x.invitation_id=v_row.id) then raise exception 'invitation can no longer be edited' using errcode='55000'; end if;

  v_name:=nullif(trim(p_patch->>'visitorName'),''); v_phone:=nullif(trim(p_patch->>'visitorPhone'),'');
  v_contact:=nullif(p_patch->>'residentContactId','')::uuid; v_access:=p_patch->>'accessType';
  v_date:=(p_patch->>'visitDate')::date; v_mode:=p_patch->>'arrivalWindowMode';
  v_start:=nullif(p_patch->>'arrivalStart','')::time; v_end_date:=nullif(p_patch->>'arrivalEndDate','')::date;
  v_end:=nullif(p_patch->>'arrivalEnd','')::time; v_exit_date:=nullif(p_patch->>'plannedExitDate','')::date;
  v_exit_time:=nullif(p_patch->>'plannedExitTime','')::time; v_notes:=nullif(trim(p_patch->>'notes'),'');
  if (v_name is null and v_access<>'delivery') or v_access not in ('visitor','delivery','service_provider','frequent_visitor') or v_mode not in ('all_day','from_time')
    or (v_mode='all_day' and (v_start is not null or v_end_date is not null or v_end is not null))
    or (v_mode='from_time' and v_start is null) or ((v_end_date is null)<>(v_end is null))
    or (v_end is not null and v_end_date+v_end<=v_date+v_start)
    or ((v_exit_date is null)<>(v_exit_time is null))
    or (v_exit_date is not null and v_exit_date+v_exit_time<=v_date+coalesce(v_start,'00:00'::time)) then raise exception 'invalid invitation update' using errcode='22023'; end if;
  if v_contact is not null and not exists(select 1 from public.resident_contacts c where c.id=v_contact and c.community_id=p_community_id and c.resident_id=v_row.resident_id) then raise exception 'resident contact is outside invitation scope' using errcode='42501'; end if;

  v_before:=jsonb_build_object('visitorName',v_row.visitor_name,'visitorPhone',v_row.visitor_phone,'residentContactId',v_row.resident_contact_id,'accessType',v_row.access_type,'visitDate',v_row.visit_date,'arrivalWindowMode',v_row.arrival_window_mode,'arrivalStart',v_row.arrival_start,'arrivalEndDate',v_row.arrival_end_date,'arrivalEnd',v_row.arrival_end,'plannedExitDate',v_row.planned_exit_date,'plannedExitTime',v_row.planned_exit_time,'notes',v_row.notes,'version',v_row.version);
  v_identity_changed:=coalesce(v_row.visitor_name,'')<>coalesce(v_name,'') or coalesce(v_row.visitor_phone,'')<>coalesce(v_phone,'') or v_row.resident_contact_id is distinct from v_contact;
  if v_identity_changed then
    select credential_type into v_credential_type from public.access_credentials where invitation_id=v_row.id and revoked_at is null;
    insert into public.invitation_share_token_history(share_token,invitation_id,revocation_reason) values(v_row.share_token,v_row.id,'identity_changed');
    perform public.revoke_current_invitation_credential(v_row.id,'identity_changed');
    v_rotated_audit:=public.issue_invitation_credential_revision(p_community_id,v_row.id,v_credential_type);
  end if;
  update public.invitations set visitor_name=v_name,visitor_phone=v_phone,resident_contact_id=v_contact,access_type=v_access,
    visit_date=v_date,arrival_window_mode=v_mode,arrival_start=v_start,arrival_end_date=v_end_date,arrival_end=v_end,
    planned_exit_date=v_exit_date,planned_exit_time=v_exit_time,notes=v_notes,legacy_indefinite=false,
    share_token=case when v_identity_changed then encode(gen_random_bytes(32),'hex') else share_token end,version=version+1
  where id=v_row.id returning version into p_expected_version;
  if v_identity_changed then insert into public.invitation_events(invitation_id,event_type,event_label,payload) values(v_row.id,'credential_rotated','Credencial regenerada por cambio de identidad',jsonb_build_object('credentialAuditId',v_rotated_audit)); end if;
  insert into public.invitation_events(invitation_id,event_type,event_label,payload) values(v_row.id,'updated','Invitación actualizada',jsonb_build_object('version',p_expected_version,'credentialRotated',v_identity_changed));
  v_result:=jsonb_build_object('invitationId',v_row.id,'version',p_expected_version,'credentialRotated',v_identity_changed);
  perform public.record_access_change(p_community_id,'invitation',v_row.id,'updated',array['visitor','contact','access','arrival_window','planned_exit','notes'],v_before,p_patch||jsonb_build_object('version',p_expected_version),null,p_idempotency_key,v_result);
  return v_result;
end $$;
revoke all on function public.update_managed_invitation(uuid,uuid,integer,jsonb,uuid) from public;
grant execute on function public.update_managed_invitation(uuid,uuid,integer,jsonb,uuid) to authenticated;

create or replace function public.cancel_managed_invitation(
  p_community_id uuid,p_invitation_id uuid,p_expected_version integer,p_reason text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_row public.invitations%rowtype; v_result jsonb; v_new_version integer; v_audit text;
begin
  if p_idempotency_key is null then raise exception 'idempotency key is required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':invitation-cancel:'||p_invitation_id::text||':'||p_idempotency_key::text,0));
  select result into v_result from public.access_change_audit where community_id=p_community_id and resource_type='invitation' and resource_id=p_invitation_id and change_type='cancelled' and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  select * into v_row from public.invitations where id=p_invitation_id and community_id=p_community_id for update;
  if not found then raise exception 'invitation not found' using errcode='P0002'; end if;
  if not (public.has_active_community_role(p_community_id,array['admin']) or v_row.resident_id=public.current_community_resident_id(p_community_id)) then raise exception 'invitation cancellation is not allowed' using errcode='42501'; end if;
  if v_row.group_id is not null then raise exception 'group member must be managed through its group' using errcode='55000'; end if;
  if v_row.version<>p_expected_version then raise exception 'invitation version conflict' using errcode='40001'; end if;
  if v_row.status='used' or exists(select 1 from public.visitor_entries x where x.invitation_id=v_row.id) then raise exception 'used invitation cannot be cancelled' using errcode='55000'; end if;
  if v_row.cancelled_at is not null then raise exception 'invitation is already cancelled' using errcode='55000'; end if;
  v_audit:=public.revoke_current_invitation_credential(v_row.id,'invitation_cancelled');
  update public.invitations set status='revoked',revoked_at=coalesce(revoked_at,now()),cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=nullif(trim(p_reason),''),version=version+1 where id=v_row.id returning version into v_new_version;
  insert into public.invitation_events(invitation_id,event_type,event_label,payload) values(v_row.id,'cancelled','Invitación cancelada',jsonb_build_object('credentialAuditId',v_audit,'version',v_new_version));
  v_result:=jsonb_build_object('invitationId',v_row.id,'version',v_new_version,'status','revoked');
  perform public.record_access_change(p_community_id,'invitation',v_row.id,'cancelled',array['status'],jsonb_build_object('status',v_row.status,'version',v_row.version),jsonb_build_object('status','revoked','version',v_new_version),p_reason,p_idempotency_key,v_result);
  return v_result;
end $$;
revoke all on function public.cancel_managed_invitation(uuid,uuid,integer,text,uuid) from public;
grant execute on function public.cancel_managed_invitation(uuid,uuid,integer,text,uuid) to authenticated;

create or replace function public.update_managed_invitation_group(
  p_community_id uuid,p_group_id uuid,p_expected_version integer,p_patch jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_row public.invitation_groups%rowtype; v_result jsonb; v_new_version integer; v_has_entries boolean;
  v_access text; v_date date; v_mode text; v_start time; v_end_date date; v_end time; v_exit_date date; v_exit_time time; v_notes text;
begin
  if p_idempotency_key is null then raise exception 'idempotency key is required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':group-update:'||p_group_id::text||':'||p_idempotency_key::text,0));
  select result into v_result from public.access_change_audit where community_id=p_community_id and resource_type='invitation_group' and resource_id=p_group_id and change_type='updated' and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  select * into v_row from public.invitation_groups where id=p_group_id and community_id=p_community_id for update;
  if not found then raise exception 'invitation group not found' using errcode='P0002'; end if;
  if not (public.has_active_community_role(p_community_id,array['admin']) or v_row.resident_id=public.current_community_resident_id(p_community_id)) then raise exception 'group update is not allowed' using errcode='42501'; end if;
  if v_row.version<>p_expected_version then raise exception 'group version conflict' using errcode='40001'; end if;
  if v_row.cancelled_at is not null then raise exception 'cancelled group cannot be edited' using errcode='55000'; end if;
  v_access:=p_patch->>'accessType'; v_date:=(p_patch->>'visitDate')::date; v_mode:=p_patch->>'arrivalWindowMode';
  v_start:=nullif(p_patch->>'arrivalStart','')::time; v_end_date:=nullif(p_patch->>'arrivalEndDate','')::date; v_end:=nullif(p_patch->>'arrivalEnd','')::time;
  v_exit_date:=nullif(p_patch->>'plannedExitDate','')::date; v_exit_time:=nullif(p_patch->>'plannedExitTime','')::time; v_notes:=nullif(trim(p_patch->>'notes'),'');
  if v_access not in ('visitor','delivery','service_provider','frequent_visitor') or v_mode not in ('all_day','from_time')
    or (v_mode='all_day' and (v_start is not null or v_end_date is not null or v_end is not null)) or (v_mode='from_time' and v_start is null)
    or ((v_end_date is null)<>(v_end is null)) or (v_end is not null and v_end_date+v_end<=v_date+v_start)
    or ((v_exit_date is null)<>(v_exit_time is null)) then raise exception 'invalid group update' using errcode='22023'; end if;
  select exists(select 1 from public.visitor_entries x join public.invitations i on i.id=x.invitation_id where i.group_id=p_group_id) into v_has_entries;
  if v_has_entries and (v_date<>v_row.visit_date or v_mode<>v_row.arrival_window_mode or v_start is distinct from v_row.arrival_start
    or coalesce(v_end_date,v_date)+coalesce(v_end,'23:59:59.999999'::time) < coalesce(v_row.arrival_end_date,v_row.visit_date)+coalesce(v_row.arrival_end,'23:59:59.999999'::time)) then
    raise exception 'group start cannot change and end cannot be reduced after first entry' using errcode='55000';
  end if;
  update public.invitation_groups set access_type=v_access,visit_date=v_date,arrival_window_mode=v_mode,arrival_start=v_start,arrival_end_date=v_end_date,arrival_end=v_end,
    planned_exit_date=v_exit_date,planned_exit_time=v_exit_time,notes=v_notes,legacy_indefinite=false,version=version+1 where id=p_group_id returning version into v_new_version;
  update public.invitations set access_type=v_access,visit_date=v_date,arrival_window_mode=v_mode,arrival_start=v_start,arrival_end_date=v_end_date,arrival_end=v_end,
    planned_exit_date=v_exit_date,planned_exit_time=v_exit_time,notes=v_notes,legacy_indefinite=false,version=version+1
    where group_id=p_group_id and removed_at is null and status='active';
  v_result:=jsonb_build_object('groupId',p_group_id,'version',v_new_version);
  perform public.record_access_change(p_community_id,'invitation_group',p_group_id,'updated',array['access','arrival_window','planned_exit','notes'],
    jsonb_build_object('accessType',v_row.access_type,'visitDate',v_row.visit_date,'arrivalWindowMode',v_row.arrival_window_mode,'arrivalStart',v_row.arrival_start,'arrivalEndDate',v_row.arrival_end_date,'arrivalEnd',v_row.arrival_end,'version',v_row.version),
    p_patch||jsonb_build_object('version',v_new_version),null,p_idempotency_key,v_result);
  return v_result;
end $$;
revoke all on function public.update_managed_invitation_group(uuid,uuid,integer,jsonb,uuid) from public;
grant execute on function public.update_managed_invitation_group(uuid,uuid,integer,jsonb,uuid) to authenticated;

create or replace function public.add_managed_invitation_group_members(
  p_community_id uuid,p_group_id uuid,p_expected_version integer,p_visitors jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_group public.invitation_groups%rowtype; v_result jsonb; v_visitor jsonb; v_id uuid; v_ids jsonb:='[]'::jsonb; v_contact uuid; v_new_version integer; v_audit text;
begin
  if p_idempotency_key is null or jsonb_typeof(p_visitors)<>'array' or jsonb_array_length(p_visitors)<1 then raise exception 'invalid group members' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':group-add:'||p_group_id::text||':'||p_idempotency_key::text,0));
  select result into v_result from public.access_change_audit where community_id=p_community_id and resource_type='invitation_group' and resource_id=p_group_id and change_type='members_added' and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  select * into v_group from public.invitation_groups where id=p_group_id and community_id=p_community_id for update;
  if not found then raise exception 'invitation group not found' using errcode='P0002'; end if;
  if not (public.has_active_community_role(p_community_id,array['admin']) or v_group.resident_id=public.current_community_resident_id(p_community_id)) then raise exception 'adding group members is not allowed' using errcode='42501'; end if;
  if v_group.version<>p_expected_version then raise exception 'group version conflict' using errcode='40001'; end if;
  if v_group.cancelled_at is not null or now()>(coalesce(v_group.arrival_end_date,v_group.visit_date)+coalesce(v_group.arrival_end,'23:59:59.999999'::time)) at time zone (select time_zone from public.communities where id=p_community_id) then raise exception 'group window is closed' using errcode='55000'; end if;
  if (select count(*) from public.invitations where group_id=p_group_id and removed_at is null)+jsonb_array_length(p_visitors)>25 then raise exception 'group member limit exceeded' using errcode='22023'; end if;
  if exists(select 1 from (select lower(trim(value->>'fullName')) n,coalesce(nullif(trim(value->>'phone'),''),'') p,count(*) c from jsonb_array_elements(p_visitors) group by 1,2 having count(*)>1) d) then raise exception 'duplicate group visitor' using errcode='22023'; end if;
  for v_visitor in select value from jsonb_array_elements(p_visitors) loop
    if length(trim(v_visitor->>'fullName')) not between 2 and 120 then raise exception 'invalid visitor name' using errcode='22023'; end if;
    v_contact:=nullif(v_visitor->>'residentContactId','')::uuid;
    if v_contact is not null and not exists(select 1 from public.resident_contacts c where c.id=v_contact and c.community_id=p_community_id and c.resident_id=v_group.resident_id) then raise exception 'resident contact is outside group scope' using errcode='42501'; end if;
    if exists(select 1 from public.invitations i where i.group_id=p_group_id and i.removed_at is null and lower(i.visitor_name)=lower(trim(v_visitor->>'fullName')) and coalesce(i.visitor_phone,'')=coalesce(nullif(trim(v_visitor->>'phone'),''),'')) then raise exception 'duplicate group visitor' using errcode='22023'; end if;
    insert into public.invitations(community_id,resident_id,unit_id,group_id,resident_contact_id,visitor_name,visitor_phone,access_type,visit_date,window_start,window_end_date,window_end,no_time_limit,status,notes,share_token,arrival_window_mode,arrival_start,arrival_end_date,arrival_end,planned_exit_date,planned_exit_time,legacy_indefinite)
    values(p_community_id,v_group.resident_id,v_group.unit_id,p_group_id,v_contact,trim(v_visitor->>'fullName'),nullif(trim(v_visitor->>'phone'),''),v_group.access_type,v_group.visit_date,
      case when v_group.arrival_window_mode='all_day' then '00:00'::time else v_group.arrival_start end,coalesce(v_group.arrival_end_date,v_group.visit_date),coalesce(v_group.arrival_end,'23:59:59.999999'::time),false,'active',v_group.notes,encode(gen_random_bytes(32),'hex'),v_group.arrival_window_mode,v_group.arrival_start,v_group.arrival_end_date,v_group.arrival_end,v_group.planned_exit_date,v_group.planned_exit_time,false) returning id into v_id;
    v_audit:=public.issue_invitation_credential_revision(p_community_id,v_id,v_group.credential_type);
    insert into public.invitation_events(invitation_id,event_type,event_label,payload) values(v_id,'member_added','Persona agregada al grupo',jsonb_build_object('groupId',p_group_id,'credentialAuditId',v_audit));
    v_ids:=v_ids||jsonb_build_array(v_id);
  end loop;
  update public.invitation_groups set version=version+1 where id=p_group_id returning version into v_new_version;
  v_result:=jsonb_build_object('groupId',p_group_id,'version',v_new_version,'invitationIds',v_ids);
  perform public.record_access_change(p_community_id,'invitation_group',p_group_id,'members_added',array['members'],jsonb_build_object('version',v_group.version),jsonb_build_object('version',v_new_version,'count',jsonb_array_length(p_visitors)),null,p_idempotency_key,v_result);
  return v_result;
end $$;
revoke all on function public.add_managed_invitation_group_members(uuid,uuid,integer,jsonb,uuid) from public;
grant execute on function public.add_managed_invitation_group_members(uuid,uuid,integer,jsonb,uuid) to authenticated;

create or replace function public.remove_managed_invitation_group_member(
  p_community_id uuid,p_group_id uuid,p_invitation_id uuid,p_expected_version integer,p_reason text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_group public.invitation_groups%rowtype; v_member public.invitations%rowtype; v_result jsonb; v_new_version integer; v_audit text;
begin
  if p_idempotency_key is null then raise exception 'idempotency key is required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':group-remove:'||p_group_id::text||':'||p_idempotency_key::text,0));
  select result into v_result from public.access_change_audit where community_id=p_community_id and resource_type='invitation_group' and resource_id=p_group_id and change_type='member_removed' and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  select * into v_group from public.invitation_groups where id=p_group_id and community_id=p_community_id for update;
  if not found then raise exception 'invitation group not found' using errcode='P0002'; end if;
  if not (public.has_active_community_role(p_community_id,array['admin']) or v_group.resident_id=public.current_community_resident_id(p_community_id)) then raise exception 'removing group member is not allowed' using errcode='42501'; end if;
  if v_group.version<>p_expected_version then raise exception 'group version conflict' using errcode='40001'; end if;
  select * into v_member from public.invitations where id=p_invitation_id and group_id=p_group_id and community_id=p_community_id for update;
  if not found then raise exception 'group member not found' using errcode='P0002'; end if;
  if v_member.removed_at is not null or v_member.status='used' or exists(select 1 from public.visitor_entries x where x.invitation_id=v_member.id) then raise exception 'member with access history cannot be removed' using errcode='55000'; end if;
  v_audit:=public.revoke_current_invitation_credential(v_member.id,'group_member_removed');
  update public.invitations set status='revoked',revoked_at=coalesce(revoked_at,now()),removed_at=now(),removed_by=auth.uid(),version=version+1 where id=v_member.id;
  update public.invitation_groups set version=version+1 where id=p_group_id returning version into v_new_version;
  insert into public.invitation_events(invitation_id,event_type,event_label,payload) values(v_member.id,'member_removed','Persona retirada del grupo',jsonb_build_object('groupId',p_group_id,'credentialAuditId',v_audit));
  v_result:=jsonb_build_object('groupId',p_group_id,'invitationId',p_invitation_id,'version',v_new_version);
  perform public.record_access_change(p_community_id,'invitation_group',p_group_id,'member_removed',array['members'],jsonb_build_object('version',v_group.version),jsonb_build_object('version',v_new_version,'invitationId',p_invitation_id),p_reason,p_idempotency_key,v_result);
  return v_result;
end $$;
revoke all on function public.remove_managed_invitation_group_member(uuid,uuid,uuid,integer,text,uuid) from public;
grant execute on function public.remove_managed_invitation_group_member(uuid,uuid,uuid,integer,text,uuid) to authenticated;

create or replace function public.cancel_managed_invitation_group(
  p_community_id uuid,p_group_id uuid,p_expected_version integer,p_reason text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_group public.invitation_groups%rowtype; v_member record; v_result jsonb; v_new_version integer; v_count integer:=0;
begin
  if p_idempotency_key is null then raise exception 'idempotency key is required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':group-cancel:'||p_group_id::text||':'||p_idempotency_key::text,0));
  select result into v_result from public.access_change_audit where community_id=p_community_id and resource_type='invitation_group' and resource_id=p_group_id and change_type='cancelled' and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  select * into v_group from public.invitation_groups where id=p_group_id and community_id=p_community_id for update;
  if not found then raise exception 'invitation group not found' using errcode='P0002'; end if;
  if not (public.has_active_community_role(p_community_id,array['admin']) or v_group.resident_id=public.current_community_resident_id(p_community_id)) then raise exception 'group cancellation is not allowed' using errcode='42501'; end if;
  if v_group.version<>p_expected_version then raise exception 'group version conflict' using errcode='40001'; end if;
  if v_group.cancelled_at is not null then raise exception 'group is already cancelled' using errcode='55000'; end if;
  for v_member in select id from public.invitations where group_id=p_group_id and status='active' and removed_at is null for update loop
    perform public.revoke_current_invitation_credential(v_member.id,'group_cancelled');
    update public.invitations set status='revoked',revoked_at=coalesce(revoked_at,now()),cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=nullif(trim(p_reason),''),version=version+1 where id=v_member.id;
    insert into public.invitation_events(invitation_id,event_type,event_label,payload) values(v_member.id,'cancelled','Invitación cancelada con su grupo',jsonb_build_object('groupId',p_group_id));
    v_count:=v_count+1;
  end loop;
  update public.invitation_groups set cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=nullif(trim(p_reason),''),version=version+1 where id=p_group_id returning version into v_new_version;
  v_result:=jsonb_build_object('groupId',p_group_id,'version',v_new_version,'revokedInvitations',v_count);
  perform public.record_access_change(p_community_id,'invitation_group',p_group_id,'cancelled',array['status'],jsonb_build_object('version',v_group.version),jsonb_build_object('version',v_new_version,'cancelled',true),p_reason,p_idempotency_key,v_result);
  return v_result;
end $$;
revoke all on function public.cancel_managed_invitation_group(uuid,uuid,integer,text,uuid) from public;
grant execute on function public.cancel_managed_invitation_group(uuid,uuid,integer,text,uuid) to authenticated;

create or replace function public.update_managed_resident_event(
  p_community_id uuid,p_event_id uuid,p_expected_version integer,p_patch jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_row public.resident_events%rowtype; v_result jsonb; v_new_version integer; v_has_entries boolean;
  v_name text; v_date date; v_mode text; v_start time; v_end_date date; v_end time; v_exit_date date; v_exit_time time; v_notes text; v_allows boolean; v_max smallint;
begin
  if p_idempotency_key is null then raise exception 'idempotency key is required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':event-update:'||p_event_id::text||':'||p_idempotency_key::text,0));
  select result into v_result from public.access_change_audit where community_id=p_community_id and resource_type='event' and resource_id=p_event_id and change_type='updated' and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  select * into v_row from public.resident_events where id=p_event_id and community_id=p_community_id for update;
  if not found then raise exception 'event not found' using errcode='P0002'; end if;
  if not (public.has_active_community_role(p_community_id,array['admin']) or v_row.resident_id=public.current_community_resident_id(p_community_id)) then raise exception 'event update is not allowed' using errcode='42501'; end if;
  if v_row.version<>p_expected_version then raise exception 'event version conflict' using errcode='40001'; end if;
  if v_row.cancelled_at is not null or v_row.status='revoked' then raise exception 'cancelled event cannot be edited' using errcode='55000'; end if;
  v_name:=nullif(trim(p_patch->>'name'),''); v_date:=(p_patch->>'eventDate')::date; v_mode:=p_patch->>'arrivalWindowMode';
  v_start:=nullif(p_patch->>'arrivalStart','')::time; v_end_date:=nullif(p_patch->>'arrivalEndDate','')::date; v_end:=nullif(p_patch->>'arrivalEnd','')::time;
  v_exit_date:=nullif(p_patch->>'plannedExitDate','')::date; v_exit_time:=nullif(p_patch->>'plannedExitTime','')::time; v_notes:=nullif(trim(p_patch->>'notes'),'');
  v_allows:=coalesce((p_patch->>'defaultAllowsCompanions')::boolean,false); v_max:=coalesce((p_patch->>'defaultMaxCompanions')::smallint,0);
  if v_name is null or v_mode not in ('all_day','from_time') or (v_mode='all_day' and (v_start is not null or v_end_date is not null or v_end is not null))
    or (v_mode='from_time' and v_start is null) or ((v_end_date is null)<>(v_end is null)) or (v_end is not null and v_end_date+v_end<=v_date+v_start)
    or ((v_exit_date is null)<>(v_exit_time is null)) or (not v_allows and v_max<>0) or (v_allows and v_max not between 1 and 5) then raise exception 'invalid event update' using errcode='22023'; end if;
  select exists(select 1 from public.visitor_entries x where x.event_id=p_event_id) into v_has_entries;
  if v_has_entries and (v_date<>v_row.event_date or v_mode<>v_row.arrival_window_mode or v_start is distinct from v_row.arrival_start
    or coalesce(v_end_date,v_date)+coalesce(v_end,'23:59:59.999999'::time) < coalesce(v_row.arrival_end_date,v_row.event_date)+coalesce(v_row.arrival_end,'23:59:59.999999'::time)) then raise exception 'event start cannot change and end cannot be reduced after first entry' using errcode='55000'; end if;
  update public.resident_events set name=v_name,event_date=v_date,arrival_window_mode=v_mode,arrival_start=v_start,arrival_end_date=v_end_date,arrival_end=v_end,
    planned_exit_date=v_exit_date,planned_exit_time=v_exit_time,notes=v_notes,default_allows_companions=v_allows,default_max_companions=v_max,version=version+1 where id=p_event_id returning version into v_new_version;
  insert into public.event_activity(event_id,activity_type,activity_label,payload) values(p_event_id,'updated','Evento actualizado',jsonb_build_object('version',v_new_version));
  v_result:=jsonb_build_object('eventId',p_event_id,'version',v_new_version);
  perform public.record_access_change(p_community_id,'event',p_event_id,'updated',array['name','arrival_window','planned_exit','notes','default_companions'],jsonb_build_object('name',v_row.name,'eventDate',v_row.event_date,'arrivalWindowMode',v_row.arrival_window_mode,'arrivalStart',v_row.arrival_start,'arrivalEndDate',v_row.arrival_end_date,'arrivalEnd',v_row.arrival_end,'version',v_row.version),p_patch||jsonb_build_object('version',v_new_version),null,p_idempotency_key,v_result);
  return v_result;
end $$;
revoke all on function public.update_managed_resident_event(uuid,uuid,integer,jsonb,uuid) from public;
grant execute on function public.update_managed_resident_event(uuid,uuid,integer,jsonb,uuid) to authenticated;

create or replace function public.add_managed_event_guests(
  p_community_id uuid,p_event_id uuid,p_expected_version integer,p_guests jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_event public.resident_events%rowtype; v_result jsonb; v_guest jsonb; v_guest_id uuid; v_ids jsonb:='[]'::jsonb; v_contact uuid; v_allows boolean; v_max smallint; v_type text; v_audit text; v_new_version integer;
begin
  if p_idempotency_key is null or jsonb_typeof(p_guests)<>'array' or jsonb_array_length(p_guests)<1 then raise exception 'invalid event guests' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':event-add:'||p_event_id::text||':'||p_idempotency_key::text,0));
  select result into v_result from public.access_change_audit where community_id=p_community_id and resource_type='event' and resource_id=p_event_id and change_type='guests_added' and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  select * into v_event from public.resident_events where id=p_event_id and community_id=p_community_id for update;
  if not found then raise exception 'event not found' using errcode='P0002'; end if;
  if not (public.has_active_community_role(p_community_id,array['admin']) or v_event.resident_id=public.current_community_resident_id(p_community_id)) then raise exception 'adding event guests is not allowed' using errcode='42501'; end if;
  if v_event.version<>p_expected_version then raise exception 'event version conflict' using errcode='40001'; end if;
  if v_event.cancelled_at is not null or now()>(coalesce(v_event.arrival_end_date,v_event.event_date)+coalesce(v_event.arrival_end,'23:59:59.999999'::time)) at time zone (select time_zone from public.communities where id=p_community_id) then raise exception 'event window is closed' using errcode='55000'; end if;
  if (select count(*) from public.event_guests where event_id=p_event_id and removed_at is null)+jsonb_array_length(p_guests)>500 then raise exception 'event guest limit exceeded' using errcode='22023'; end if;
  if exists(select 1 from (select lower(trim(value->>'fullName')) n,coalesce(nullif(trim(value->>'phone'),''),'') p,count(*) c from jsonb_array_elements(p_guests) group by 1,2 having count(*)>1) d) then raise exception 'duplicate event guest' using errcode='22023'; end if;
  select c.credential_type into v_type from public.event_guest_credentials c where c.event_id=p_event_id and c.revoked_at is null limit 1;
  v_type:=coalesce(v_type,'pin');
  for v_guest in select value from jsonb_array_elements(p_guests) loop
    if length(trim(v_guest->>'fullName')) not between 2 and 120 then raise exception 'invalid event guest name' using errcode='22023'; end if;
    v_contact:=nullif(v_guest->>'residentContactId','')::uuid;
    if v_contact is not null and not exists(select 1 from public.resident_contacts c where c.id=v_contact and c.community_id=p_community_id and c.resident_id=v_event.resident_id) then raise exception 'resident contact is outside event scope' using errcode='42501'; end if;
    if exists(select 1 from public.event_guests g where g.event_id=p_event_id and g.removed_at is null and lower(g.full_name)=lower(trim(v_guest->>'fullName')) and coalesce(g.phone,'')=coalesce(nullif(trim(v_guest->>'phone'),''),'')) then raise exception 'duplicate event guest' using errcode='22023'; end if;
    v_allows:=coalesce((v_guest->>'allowsCompanions')::boolean,v_event.default_allows_companions); v_max:=coalesce((v_guest->>'maxCompanions')::smallint,v_event.default_max_companions);
    if (not v_allows and v_max<>0) or (v_allows and v_max not between 1 and 5) then raise exception 'invalid companion limit' using errcode='22023'; end if;
    insert into public.event_guests(event_id,resident_contact_id,full_name,phone,notes,allows_companions,max_companions)
    values(p_event_id,v_contact,trim(v_guest->>'fullName'),nullif(trim(v_guest->>'phone'),''),nullif(trim(v_guest->>'notes'),''),v_allows,v_max) returning id into v_guest_id;
    v_audit:=public.issue_event_guest_credential_revision(p_community_id,p_event_id,v_guest_id,v_type);
    insert into public.event_activity(event_id,activity_type,activity_label,payload) values(p_event_id,'guest_added','Invitado agregado',jsonb_build_object('eventGuestId',v_guest_id,'credentialAuditId',v_audit));
    v_ids:=v_ids||jsonb_build_array(v_guest_id);
  end loop;
  update public.resident_events set version=version+1 where id=p_event_id returning version into v_new_version;
  v_result:=jsonb_build_object('eventId',p_event_id,'version',v_new_version,'eventGuestIds',v_ids);
  perform public.record_access_change(p_community_id,'event',p_event_id,'guests_added',array['guests'],jsonb_build_object('version',v_event.version),jsonb_build_object('version',v_new_version,'count',jsonb_array_length(p_guests)),null,p_idempotency_key,v_result);
  return v_result;
end $$;
revoke all on function public.add_managed_event_guests(uuid,uuid,integer,jsonb,uuid) from public;
grant execute on function public.add_managed_event_guests(uuid,uuid,integer,jsonb,uuid) to authenticated;

create or replace function public.update_managed_event_guest(
  p_community_id uuid,p_event_id uuid,p_event_guest_id uuid,p_expected_event_version integer,p_expected_guest_version integer,p_patch jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_event public.resident_events%rowtype; v_guest public.event_guests%rowtype; v_result jsonb; v_new_event_version integer; v_new_guest_version integer; v_name text; v_phone text; v_notes text; v_contact uuid; v_allows boolean; v_max smallint; v_identity_changed boolean; v_type text; v_audit text;
begin
  if p_idempotency_key is null then raise exception 'idempotency key is required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':guest-update:'||p_event_guest_id::text||':'||p_idempotency_key::text,0));
  select result into v_result from public.access_change_audit where community_id=p_community_id and resource_type='event_guest' and resource_id=p_event_guest_id and change_type='updated' and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  select * into v_event from public.resident_events where id=p_event_id and community_id=p_community_id for update;
  if not found then raise exception 'event not found' using errcode='P0002'; end if;
  if not (public.has_active_community_role(p_community_id,array['admin']) or v_event.resident_id=public.current_community_resident_id(p_community_id)) then raise exception 'event guest update is not allowed' using errcode='42501'; end if;
  if v_event.version<>p_expected_event_version then raise exception 'event version conflict' using errcode='40001'; end if;
  select * into v_guest from public.event_guests where id=p_event_guest_id and event_id=p_event_id for update;
  if not found then raise exception 'event guest not found' using errcode='P0002'; end if;
  if v_guest.version<>p_expected_guest_version then raise exception 'event guest version conflict' using errcode='40001'; end if;
  if v_event.cancelled_at is not null or v_guest.removed_at is not null or v_guest.attendance_status<>'pending' or exists(select 1 from public.visitor_entries x where x.event_guest_id=p_event_guest_id) then raise exception 'event guest can no longer be edited' using errcode='55000'; end if;
  v_name:=nullif(trim(p_patch->>'fullName'),''); v_phone:=nullif(trim(p_patch->>'phone'),''); v_notes:=nullif(trim(p_patch->>'notes'),''); v_contact:=nullif(p_patch->>'residentContactId','')::uuid;
  v_allows:=coalesce((p_patch->>'allowsCompanions')::boolean,false); v_max:=coalesce((p_patch->>'maxCompanions')::smallint,0);
  if v_name is null or (not v_allows and v_max<>0) or (v_allows and v_max not between 1 and 5) then raise exception 'invalid event guest update' using errcode='22023'; end if;
  if v_contact is not null and not exists(select 1 from public.resident_contacts c where c.id=v_contact and c.community_id=p_community_id and c.resident_id=v_event.resident_id) then raise exception 'resident contact is outside event scope' using errcode='42501'; end if;
  if exists(select 1 from public.event_guests g where g.event_id=p_event_id and g.id<>p_event_guest_id and g.removed_at is null and lower(g.full_name)=lower(v_name) and coalesce(g.phone,'')=coalesce(v_phone,'')) then raise exception 'duplicate event guest' using errcode='22023'; end if;
  v_identity_changed:=coalesce(v_guest.full_name,'')<>coalesce(v_name,'') or coalesce(v_guest.phone,'')<>coalesce(v_phone,'') or v_guest.resident_contact_id is distinct from v_contact;
  if v_identity_changed then select credential_type into v_type from public.event_guest_credentials where event_guest_id=p_event_guest_id and revoked_at is null; perform public.revoke_current_event_guest_credential(p_event_guest_id,'identity_changed'); v_audit:=public.issue_event_guest_credential_revision(p_community_id,p_event_id,p_event_guest_id,v_type); end if;
  update public.event_guests set full_name=v_name,phone=v_phone,notes=v_notes,resident_contact_id=v_contact,allows_companions=v_allows,max_companions=v_max,version=version+1 where id=p_event_guest_id returning version into v_new_guest_version;
  update public.resident_events set version=version+1 where id=p_event_id returning version into v_new_event_version;
  insert into public.event_activity(event_id,activity_type,activity_label,payload) values(p_event_id,'guest_updated','Invitado actualizado',jsonb_build_object('eventGuestId',p_event_guest_id,'credentialRotated',v_identity_changed,'credentialAuditId',v_audit));
  v_result:=jsonb_build_object('eventId',p_event_id,'eventGuestId',p_event_guest_id,'eventVersion',v_new_event_version,'guestVersion',v_new_guest_version,'credentialRotated',v_identity_changed);
  perform public.record_access_change(p_community_id,'event_guest',p_event_guest_id,'updated',array['identity','contact','companions','notes'],jsonb_build_object('fullName',v_guest.full_name,'phone',v_guest.phone,'version',v_guest.version),p_patch||jsonb_build_object('version',v_new_guest_version),null,p_idempotency_key,v_result);
  return v_result;
end $$;
revoke all on function public.update_managed_event_guest(uuid,uuid,uuid,integer,integer,jsonb,uuid) from public;
grant execute on function public.update_managed_event_guest(uuid,uuid,uuid,integer,integer,jsonb,uuid) to authenticated;

create or replace function public.remove_managed_event_guest(
  p_community_id uuid,p_event_id uuid,p_event_guest_id uuid,p_expected_event_version integer,p_reason text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_event public.resident_events%rowtype; v_guest public.event_guests%rowtype; v_result jsonb; v_new_version integer; v_audit text;
begin
  if p_idempotency_key is null then raise exception 'idempotency key is required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':guest-remove:'||p_event_guest_id::text||':'||p_idempotency_key::text,0));
  select result into v_result from public.access_change_audit where community_id=p_community_id and resource_type='event_guest' and resource_id=p_event_guest_id and change_type='removed' and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  select * into v_event from public.resident_events where id=p_event_id and community_id=p_community_id for update;
  if not found then raise exception 'event not found' using errcode='P0002'; end if;
  if not (public.has_active_community_role(p_community_id,array['admin']) or v_event.resident_id=public.current_community_resident_id(p_community_id)) then raise exception 'event guest removal is not allowed' using errcode='42501'; end if;
  if v_event.version<>p_expected_event_version then raise exception 'event version conflict' using errcode='40001'; end if;
  select * into v_guest from public.event_guests where id=p_event_guest_id and event_id=p_event_id for update;
  if not found then raise exception 'event guest not found' using errcode='P0002'; end if;
  if v_guest.removed_at is not null or v_guest.attendance_status<>'pending' or exists(select 1 from public.visitor_entries x where x.event_guest_id=p_event_guest_id) then raise exception 'event guest with access history cannot be removed' using errcode='55000'; end if;
  v_audit:=public.revoke_current_event_guest_credential(p_event_guest_id,'event_guest_removed');
  update public.event_guests set attendance_status='removed',removed_at=now(),removed_by=auth.uid(),removal_reason=nullif(trim(p_reason),''),version=version+1 where id=p_event_guest_id;
  update public.resident_events set version=version+1 where id=p_event_id returning version into v_new_version;
  insert into public.event_activity(event_id,activity_type,activity_label,payload) values(p_event_id,'guest_removed','Invitado retirado',jsonb_build_object('eventGuestId',p_event_guest_id,'credentialAuditId',v_audit));
  v_result:=jsonb_build_object('eventId',p_event_id,'eventGuestId',p_event_guest_id,'version',v_new_version);
  perform public.record_access_change(p_community_id,'event_guest',p_event_guest_id,'removed',array['attendance_status'],jsonb_build_object('attendanceStatus',v_guest.attendance_status),jsonb_build_object('attendanceStatus','removed'),p_reason,p_idempotency_key,v_result);
  return v_result;
end $$;
revoke all on function public.remove_managed_event_guest(uuid,uuid,uuid,integer,text,uuid) from public;
grant execute on function public.remove_managed_event_guest(uuid,uuid,uuid,integer,text,uuid) to authenticated;

create or replace function public.cancel_managed_resident_event(
  p_community_id uuid,p_event_id uuid,p_expected_version integer,p_reason text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_event public.resident_events%rowtype; v_guest record; v_result jsonb; v_new_version integer; v_count integer:=0;
begin
  if p_idempotency_key is null then raise exception 'idempotency key is required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':event-cancel:'||p_event_id::text||':'||p_idempotency_key::text,0));
  select result into v_result from public.access_change_audit where community_id=p_community_id and resource_type='event' and resource_id=p_event_id and change_type='cancelled' and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  select * into v_event from public.resident_events where id=p_event_id and community_id=p_community_id for update;
  if not found then raise exception 'event not found' using errcode='P0002'; end if;
  if not (public.has_active_community_role(p_community_id,array['admin']) or v_event.resident_id=public.current_community_resident_id(p_community_id)) then raise exception 'event cancellation is not allowed' using errcode='42501'; end if;
  if v_event.version<>p_expected_version then raise exception 'event version conflict' using errcode='40001'; end if;
  if v_event.cancelled_at is not null then raise exception 'event is already cancelled' using errcode='55000'; end if;
  for v_guest in select id from public.event_guests where event_id=p_event_id and attendance_status='pending' and removed_at is null for update loop perform public.revoke_current_event_guest_credential(v_guest.id,'event_cancelled'); v_count:=v_count+1; end loop;
  update public.resident_events set status='revoked',revoked_at=coalesce(revoked_at,now()),cancelled_at=now(),cancelled_by=auth.uid(),cancellation_reason=nullif(trim(p_reason),''),version=version+1 where id=p_event_id returning version into v_new_version;
  insert into public.event_activity(event_id,activity_type,activity_label,payload) values(p_event_id,'cancelled','Evento cancelado',jsonb_build_object('revokedPendingCredentials',v_count,'version',v_new_version));
  v_result:=jsonb_build_object('eventId',p_event_id,'version',v_new_version,'status','revoked','revokedPendingCredentials',v_count);
  perform public.record_access_change(p_community_id,'event',p_event_id,'cancelled',array['status'],jsonb_build_object('status',v_event.status,'version',v_event.version),jsonb_build_object('status','revoked','version',v_new_version),p_reason,p_idempotency_key,v_result);
  return v_result;
end $$;
revoke all on function public.cancel_managed_resident_event(uuid,uuid,integer,text,uuid) from public;
grant execute on function public.cancel_managed_resident_event(uuid,uuid,integer,text,uuid) to authenticated;

create or replace function public.get_invitation_credential(p_invitation_id uuid)
returns jsonb language sql stable security definer
set search_path='pg_catalog','extensions','public' as $$
  select jsonb_build_object('credential_type',c.credential_type,
    'credential_value',case when c.credential_type='pin' then coalesce(s.secret_value,c.credential_value) else coalesce(s.secret_value,c.qr_payload,c.credential_value) end,
    'qr_payload',case when c.credential_type='qr' then coalesce(s.secret_value,c.qr_payload,c.credential_value) else null end,
    'credential_audit_id',c.credential_audit_id)
  from public.access_credentials c join public.invitations i on i.id=c.invitation_id left join public.credential_secrets s on s.access_credential_id=c.id
  where i.id=p_invitation_id and c.revoked_at is null and (public.has_active_community_role(i.community_id,array['admin']) or i.resident_id=public.current_community_resident_id(i.community_id)) limit 1;
$$;
revoke all on function public.get_invitation_credential(uuid) from public;
grant execute on function public.get_invitation_credential(uuid) to authenticated;

create or replace function public.get_event_guest_credentials(p_event_id uuid)
returns jsonb language sql stable security definer
set search_path='pg_catalog','extensions','public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'event_id',c.event_id,'event_guest_id',c.event_guest_id,'credential_type',c.credential_type,
    'credential_value',s.secret_value,'qr_payload',case when c.credential_type='qr' then s.secret_value else null end,
    'credential_audit_id',c.credential_audit_id,'share_token',c.share_token,'created_at',c.created_at) order by c.created_at),'[]'::jsonb)
  from public.event_guest_credentials c join public.event_guest_credential_secrets s on s.event_guest_credential_id=c.id join public.resident_events e on e.id=c.event_id
  where c.event_id=p_event_id and c.revoked_at is null and (public.has_active_community_role(e.community_id,array['admin']) or e.resident_id=public.current_community_resident_id(e.community_id));
$$;
revoke all on function public.get_event_guest_credentials(uuid) from public;
grant execute on function public.get_event_guest_credentials(uuid) to authenticated;

create or replace function public.get_access_change_history(p_community_id uuid,p_resource_type text,p_resource_id uuid)
returns jsonb language plpgsql stable security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_allowed boolean:=false; v_result jsonb;
begin
  if public.has_active_community_role(p_community_id,array['admin']) then v_allowed:=true;
  elsif p_resource_type='invitation' then select exists(select 1 from public.invitations i where i.id=p_resource_id and i.community_id=p_community_id and i.resident_id=public.current_community_resident_id(p_community_id)) into v_allowed;
  elsif p_resource_type='invitation_group' then select exists(select 1 from public.invitation_groups g where g.id=p_resource_id and g.community_id=p_community_id and g.resident_id=public.current_community_resident_id(p_community_id)) into v_allowed;
  elsif p_resource_type='event' then select exists(select 1 from public.resident_events e where e.id=p_resource_id and e.community_id=p_community_id and e.resident_id=public.current_community_resident_id(p_community_id)) into v_allowed;
  end if;
  if not v_allowed then raise exception 'access history is not allowed' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'changeType',a.change_type,'changedFields',a.changed_fields,'before',a.before_data,'after',a.after_data,'reason',a.reason,'actorEmail',a.actor_email,'createdAt',a.created_at) order by a.created_at desc,a.id desc),'[]'::jsonb) into v_result
  from public.access_change_audit a where a.community_id=p_community_id and ((a.resource_type=p_resource_type and a.resource_id=p_resource_id)
    or (p_resource_type='event' and a.resource_type='event_guest' and exists(select 1 from public.event_guests g where g.id=a.resource_id and g.event_id=p_resource_id)));
  return v_result;
end $$;
revoke all on function public.get_access_change_history(uuid,text,uuid) from public;
grant execute on function public.get_access_change_history(uuid,text,uuid) to authenticated;

create or replace function public.get_public_invitation(p_share_token text)
returns jsonb language plpgsql stable security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_result jsonb;
begin
  if exists(select 1 from public.invitation_share_token_history h where h.share_token=p_share_token) then return jsonb_build_object('status','credential_revoked'); end if;
  select jsonb_build_object('visitor_name',i.visitor_name,'access_type',i.access_type,'visit_date',i.visit_date,
    'arrival_window_mode',i.arrival_window_mode,'arrival_start',i.arrival_start,'arrival_end_date',i.arrival_end_date,'arrival_end',i.arrival_end,
    'planned_exit_date',i.planned_exit_date,'planned_exit_time',i.planned_exit_time,'window_start',i.window_start,'window_end',i.window_end,'window_end_date',i.window_end_date,
    'no_time_limit',i.no_time_limit,'legacy_indefinite',i.legacy_indefinite,
    'status',public.arrival_effective_status(i.status,i.visit_date,i.arrival_window_mode,i.arrival_start,i.arrival_end_date,i.arrival_end,i.legacy_indefinite,community.time_zone,i.status='used'),
    'resident_name',r.full_name,'unit_identifier',u.identifier,'unit_building',u.building,'credential_type',c.credential_type,
    'credential_value',case when i.status='active' and c.credential_type='pin' then coalesce(s.secret_value,c.credential_value) when i.status='active' then coalesce(s.secret_value,c.qr_payload,c.credential_value) else null end,
    'qr_payload',case when i.status='active' and c.credential_type='qr' then coalesce(s.secret_value,c.qr_payload,c.credential_value) else null end,
    'group_size',case when i.group_id is null then null else (select count(*) from public.invitations m where m.group_id=i.group_id and m.removed_at is null) end,
    'group_position',case when i.group_id is null then null else (select count(*) from public.invitations m where m.group_id=i.group_id and m.removed_at is null and (m.created_at,m.id)<=(i.created_at,i.id)) end)
  into v_result from public.invitations i join public.communities community on community.id=i.community_id join public.residents r on r.id=i.resident_id
  left join public.units u on u.id=i.unit_id left join public.access_credentials c on c.invitation_id=i.id and c.revoked_at is null left join public.credential_secrets s on s.access_credential_id=c.id
  where i.share_token=p_share_token limit 1;
  return v_result;
end $$;
revoke all on function public.get_public_invitation(text) from public;
grant execute on function public.get_public_invitation(text) to anon,authenticated;

create or replace function public.get_public_event_guest(p_share_token text)
returns jsonb language sql stable security definer
set search_path='pg_catalog','extensions','public' as $$
  select jsonb_build_object('event_name',e.name,'guest_name',g.full_name,'event_date',e.event_date,
    'arrival_window_mode',e.arrival_window_mode,'arrival_start',e.arrival_start,'arrival_end_date',e.arrival_end_date,'arrival_end',e.arrival_end,
    'window_start',e.window_start,'window_end_date',e.window_end_date,'window_end',e.window_end,'planned_exit_date',e.planned_exit_date,'planned_exit_time',e.planned_exit_time,
    'status',case when c.revoked_at is not null then 'credential_revoked' when g.removed_at is not null then 'removed' else public.arrival_effective_status(e.status,e.event_date,e.arrival_window_mode,e.arrival_start,e.arrival_end_date,e.arrival_end,false,community.time_zone,false) end,
    'resident_name',r.full_name,'unit_identifier',u.identifier,'attendance_status',g.attendance_status,'allows_companions',g.allows_companions,'max_companions',g.max_companions,
    'credential_type',c.credential_type,'credential_value',case when c.revoked_at is null and e.status='active' then s.secret_value else null end,
    'qr_payload',case when c.revoked_at is null and e.status='active' and c.credential_type='qr' then s.secret_value else null end)
  from public.event_guest_credentials c join public.event_guest_credential_secrets s on s.event_guest_credential_id=c.id join public.event_guests g on g.id=c.event_guest_id
  join public.resident_events e on e.id=c.event_id join public.communities community on community.id=e.community_id join public.residents r on r.id=e.resident_id left join public.units u on u.id=e.unit_id
  where c.share_token=p_share_token limit 1;
$$;
revoke all on function public.get_public_event_guest(text) from public;
grant execute on function public.get_public_event_guest(text) to anon,authenticated;

create or replace function public.duplicate_managed_invitation(
  p_community_id uuid,p_invitation_id uuid,p_expected_version integer,p_window jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_source public.invitations%rowtype; v_type text; v_new_id uuid; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':invitation-duplicate:'||p_invitation_id::text||':'||p_idempotency_key::text,0));
  select result into v_result from public.access_change_audit where community_id=p_community_id and resource_type='invitation' and resource_id=p_invitation_id and change_type='duplicated' and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  select * into v_source from public.invitations where id=p_invitation_id and community_id=p_community_id;
  if not found then raise exception 'invitation not found' using errcode='P0002'; end if;
  if not (public.has_active_community_role(p_community_id,array['admin']) or v_source.resident_id=public.current_community_resident_id(p_community_id)) then raise exception 'invitation duplication is not allowed' using errcode='42501'; end if;
  if v_source.group_id is not null then raise exception 'group member must be duplicated through its group' using errcode='55000'; end if;
  if v_source.version<>p_expected_version then raise exception 'invitation version conflict' using errcode='40001'; end if;
  select credential_type into v_type from public.access_credentials where invitation_id=p_invitation_id order by created_at desc limit 1;
  v_new_id:=public.create_arrival_invitation(p_community_id,v_source.resident_id,v_source.resident_contact_id,v_source.visitor_name,v_source.visitor_phone,v_source.access_type,
    (p_window->>'visitDate')::date,p_window->>'arrivalWindowMode',nullif(p_window->>'arrivalStart','')::time,nullif(p_window->>'arrivalEndDate','')::date,nullif(p_window->>'arrivalEnd','')::time,
    nullif(p_window->>'plannedExitDate','')::date,nullif(p_window->>'plannedExitTime','')::time,v_source.notes,v_type,p_idempotency_key);
  v_result:=jsonb_build_object('invitationId',v_new_id,'redirectTo','/app/invitations/'||v_new_id::text);
  perform public.record_access_change(p_community_id,'invitation',p_invitation_id,'duplicated',array['duplicate'],jsonb_build_object('version',v_source.version),jsonb_build_object('newInvitationId',v_new_id),null,p_idempotency_key,v_result);
  insert into public.invitation_events(invitation_id,event_type,event_label,payload) values(v_new_id,'duplicated','Invitación duplicada',jsonb_build_object('sourceInvitationId',p_invitation_id));
  return v_result;
end $$;
revoke all on function public.duplicate_managed_invitation(uuid,uuid,integer,jsonb,uuid) from public;
grant execute on function public.duplicate_managed_invitation(uuid,uuid,integer,jsonb,uuid) to authenticated;

create or replace function public.duplicate_managed_invitation_group(
  p_community_id uuid,p_group_id uuid,p_expected_version integer,p_window jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_source public.invitation_groups%rowtype; v_visitors jsonb; v_result jsonb; v_new_group uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':group-duplicate:'||p_group_id::text||':'||p_idempotency_key::text,0));
  select result into v_result from public.access_change_audit where community_id=p_community_id and resource_type='invitation_group' and resource_id=p_group_id and change_type='duplicated' and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  select * into v_source from public.invitation_groups where id=p_group_id and community_id=p_community_id;
  if not found then raise exception 'invitation group not found' using errcode='P0002'; end if;
  if not (public.has_active_community_role(p_community_id,array['admin']) or v_source.resident_id=public.current_community_resident_id(p_community_id)) then raise exception 'group duplication is not allowed' using errcode='42501'; end if;
  if v_source.version<>p_expected_version then raise exception 'group version conflict' using errcode='40001'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('fullName',i.visitor_name,'phone',i.visitor_phone,'residentContactId',i.resident_contact_id) order by i.created_at,i.id),'[]'::jsonb) into v_visitors from public.invitations i where i.group_id=p_group_id and i.removed_at is null;
  v_result:=public.create_arrival_invitation_group(p_community_id,v_source.resident_id,v_source.access_type,(p_window->>'visitDate')::date,p_window->>'arrivalWindowMode',nullif(p_window->>'arrivalStart','')::time,
    nullif(p_window->>'arrivalEndDate','')::date,nullif(p_window->>'arrivalEnd','')::time,nullif(p_window->>'plannedExitDate','')::date,nullif(p_window->>'plannedExitTime','')::time,v_source.notes,v_source.credential_type,v_visitors,p_idempotency_key);
  v_new_group:=(v_result->>'groupId')::uuid; v_result:=v_result||jsonb_build_object('redirectTo','/app/invitation-groups/'||v_new_group::text);
  update public.invitations target set resident_contact_id=source.resident_contact_id from public.invitations source
    where target.group_id=v_new_group and source.group_id=p_group_id and source.removed_at is null and lower(target.visitor_name)=lower(source.visitor_name) and coalesce(target.visitor_phone,'')=coalesce(source.visitor_phone,'');
  perform public.record_access_change(p_community_id,'invitation_group',p_group_id,'duplicated',array['duplicate'],jsonb_build_object('version',v_source.version),jsonb_build_object('newGroupId',v_new_group),null,p_idempotency_key,v_result);
  return v_result;
end $$;
revoke all on function public.duplicate_managed_invitation_group(uuid,uuid,integer,jsonb,uuid) from public;
grant execute on function public.duplicate_managed_invitation_group(uuid,uuid,integer,jsonb,uuid) to authenticated;

create or replace function public.duplicate_managed_resident_event(
  p_community_id uuid,p_event_id uuid,p_expected_version integer,p_window jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer
set search_path='pg_catalog','extensions','public' as $$
declare v_source public.resident_events%rowtype; v_guests jsonb; v_type text; v_new_id uuid; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_community_id::text||':event-duplicate:'||p_event_id::text||':'||p_idempotency_key::text,0));
  select result into v_result from public.access_change_audit where community_id=p_community_id and resource_type='event' and resource_id=p_event_id and change_type='duplicated' and idempotency_key=p_idempotency_key;
  if found then return v_result; end if;
  select * into v_source from public.resident_events where id=p_event_id and community_id=p_community_id;
  if not found then raise exception 'event not found' using errcode='P0002'; end if;
  if not (public.has_active_community_role(p_community_id,array['admin']) or v_source.resident_id=public.current_community_resident_id(p_community_id)) then raise exception 'event duplication is not allowed' using errcode='42501'; end if;
  if v_source.version<>p_expected_version then raise exception 'event version conflict' using errcode='40001'; end if;
  select credential_type into v_type from public.event_guest_credentials where event_id=p_event_id order by created_at desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('fullName',g.full_name,'phone',g.phone,'notes',g.notes,'residentContactId',g.resident_contact_id,'allowsCompanions',g.allows_companions,'maxCompanions',g.max_companions) order by g.created_at,g.id),'[]'::jsonb) into v_guests from public.event_guests g where g.event_id=p_event_id and g.removed_at is null;
  v_new_id:=public.create_arrival_resident_event(p_community_id,v_source.resident_id,v_source.name,(p_window->>'eventDate')::date,p_window->>'arrivalWindowMode',nullif(p_window->>'arrivalStart','')::time,
    nullif(p_window->>'arrivalEndDate','')::date,nullif(p_window->>'arrivalEnd','')::time,nullif(p_window->>'plannedExitDate','')::date,nullif(p_window->>'plannedExitTime','')::time,v_source.notes,coalesce(v_type,'pin'),v_guests,p_idempotency_key);
  update public.resident_events set default_allows_companions=v_source.default_allows_companions,default_max_companions=v_source.default_max_companions where id=v_new_id;
  update public.event_guests target set resident_contact_id=source.resident_contact_id from public.event_guests source
    where target.event_id=v_new_id and source.event_id=p_event_id and source.removed_at is null and lower(target.full_name)=lower(source.full_name) and coalesce(target.phone,'')=coalesce(source.phone,'');
  v_result:=jsonb_build_object('eventId',v_new_id,'redirectTo','/app/events/'||v_new_id::text);
  perform public.record_access_change(p_community_id,'event',p_event_id,'duplicated',array['duplicate'],jsonb_build_object('version',v_source.version),jsonb_build_object('newEventId',v_new_id),null,p_idempotency_key,v_result);
  insert into public.event_activity(event_id,activity_type,activity_label,payload) values(v_new_id,'duplicated','Evento duplicado',jsonb_build_object('sourceEventId',p_event_id));
  return v_result;
end $$;
revoke all on function public.duplicate_managed_resident_event(uuid,uuid,integer,jsonb,uuid) from public;
grant execute on function public.duplicate_managed_resident_event(uuid,uuid,integer,jsonb,uuid) to authenticated;
