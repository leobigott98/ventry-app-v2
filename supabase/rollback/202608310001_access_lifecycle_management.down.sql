-- Roll back access lifecycle management. Run only after explicitly confirming that
-- lifecycle history and revoked credential revisions may be removed.
set search_path=pg_catalog,extensions,public;

drop function if exists public.duplicate_managed_resident_event(uuid,uuid,integer,jsonb,uuid);
drop function if exists public.duplicate_managed_invitation_group(uuid,uuid,integer,jsonb,uuid);
drop function if exists public.duplicate_managed_invitation(uuid,uuid,integer,jsonb,uuid);
drop function if exists public.cancel_managed_resident_event(uuid,uuid,integer,text,uuid);
drop function if exists public.remove_managed_event_guest(uuid,uuid,uuid,integer,text,uuid);
drop function if exists public.update_managed_event_guest(uuid,uuid,uuid,integer,integer,jsonb,uuid);
drop function if exists public.add_managed_event_guests(uuid,uuid,integer,jsonb,uuid);
drop function if exists public.update_managed_resident_event(uuid,uuid,integer,jsonb,uuid);
drop function if exists public.cancel_managed_invitation_group(uuid,uuid,integer,text,uuid);
drop function if exists public.remove_managed_invitation_group_member(uuid,uuid,uuid,integer,text,uuid);
drop function if exists public.add_managed_invitation_group_members(uuid,uuid,integer,jsonb,uuid);
drop function if exists public.update_managed_invitation_group(uuid,uuid,integer,jsonb,uuid);
drop function if exists public.cancel_managed_invitation(uuid,uuid,integer,text,uuid);
drop function if exists public.update_managed_invitation(uuid,uuid,integer,jsonb,uuid);
drop function if exists public.get_access_change_history(uuid,text,uuid);
drop function if exists public.get_public_invitation(text);
drop function if exists public.get_public_event_guest(text);
drop function if exists public.issue_event_guest_credential_revision(uuid,uuid,uuid,text);
drop function if exists public.revoke_current_event_guest_credential(uuid,text);
drop function if exists public.issue_invitation_credential_revision(uuid,uuid,text);
drop function if exists public.revoke_current_invitation_credential(uuid,text);
drop function if exists public.record_access_change(uuid,text,uuid,text,text[],jsonb,jsonb,text,uuid,jsonb);

drop table if exists public.invitation_share_token_history;
drop table if exists public.access_change_audit;

drop index if exists public.access_credentials_one_current_per_invitation;
drop index if exists public.event_guest_credentials_one_current_per_guest;
delete from public.credential_secrets where access_credential_id in (select id from public.access_credentials where revoked_at is not null);
delete from public.access_credentials where revoked_at is not null;
delete from public.event_guest_credential_secrets where event_guest_credential_id in (select id from public.event_guest_credentials where revoked_at is not null);
delete from public.event_guest_credentials where revoked_at is not null;
alter table public.access_credentials add constraint access_credentials_invitation_id_key unique(invitation_id);
alter table public.event_guest_credentials add constraint event_guest_credentials_event_guest_id_key unique(event_guest_id);

update public.event_guests set attendance_status='pending' where attendance_status='removed';
alter table public.event_guests drop constraint if exists event_guests_attendance_status_check;
alter table public.event_guests add constraint event_guests_attendance_status_check check(attendance_status in('pending','inside','exited'));

alter table public.invitation_events drop constraint if exists invitation_events_event_type_check;
alter table public.invitation_events add constraint invitation_events_event_type_check check(event_type in('created','shared','revoked','status_changed','window_updated'));
alter table public.event_activity drop constraint if exists event_activity_activity_type_check;
alter table public.event_activity add constraint event_activity_activity_type_check check(activity_type in('created','shared','revoked','guest_checked_in','guest_checked_out'));

alter table public.event_guest_credentials drop column if exists credential_version,drop column if exists revocation_reason,drop column if exists revoked_at;
alter table public.access_credentials drop column if exists revocation_reason,drop column if exists revoked_at;
alter table public.event_guests drop constraint if exists event_guests_removal_metadata_check,drop constraint if exists event_guests_version_check,
  drop column if exists removal_reason,drop column if exists removed_by,drop column if exists removed_at,drop column if exists resident_contact_id,drop column if exists version;
alter table public.resident_events drop constraint if exists resident_events_cancellation_metadata_check,drop constraint if exists resident_events_default_companions_check,drop constraint if exists resident_events_version_check,
  drop column if exists default_max_companions,drop column if exists default_allows_companions,drop column if exists cancellation_reason,drop column if exists cancelled_by,drop column if exists cancelled_at,drop column if exists version;
alter table public.invitation_groups drop constraint if exists invitation_groups_cancellation_metadata_check,drop constraint if exists invitation_groups_version_check,
  drop column if exists cancellation_reason,drop column if exists cancelled_by,drop column if exists cancelled_at,drop column if exists version;
alter table public.invitations drop constraint if exists invitations_removal_metadata_check,drop constraint if exists invitations_cancellation_metadata_check,drop constraint if exists invitations_version_check,
  drop column if exists removed_by,drop column if exists removed_at,drop column if exists cancellation_reason,drop column if exists cancelled_by,drop column if exists cancelled_at,drop column if exists version;

-- Restore the pre-lifecycle owner credential readers.
create or replace function public.get_invitation_credential(p_invitation_id uuid) returns jsonb language sql stable security definer set search_path='pg_catalog','extensions','public' as $$
 select jsonb_build_object('credential_type',c.credential_type,'credential_value',case when c.credential_type='pin' then coalesce(s.secret_value,c.credential_value) else coalesce(s.secret_value,c.qr_payload,c.credential_value) end,'qr_payload',case when c.credential_type='qr' then coalesce(s.secret_value,c.qr_payload,c.credential_value) else null end)
 from public.access_credentials c join public.invitations i on i.id=c.invitation_id left join public.credential_secrets s on s.access_credential_id=c.id where i.id=p_invitation_id and(public.has_active_community_role(i.community_id,array['admin'])or i.resident_id=public.current_community_resident_id(i.community_id))limit 1;$$;
revoke all on function public.get_invitation_credential(uuid) from public;grant execute on function public.get_invitation_credential(uuid) to authenticated;

create or replace function public.get_event_guest_credentials(p_event_id uuid) returns jsonb language sql stable security definer set search_path='pg_catalog','extensions','public' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'event_id',c.event_id,'event_guest_id',c.event_guest_id,'credential_type',c.credential_type,'credential_value',s.secret_value,'qr_payload',case when c.credential_type='qr'then s.secret_value else null end,'credential_audit_id',c.credential_audit_id,'share_token',c.share_token,'created_at',c.created_at)order by c.created_at),'[]'::jsonb)
 from public.event_guest_credentials c join public.event_guest_credential_secrets s on s.event_guest_credential_id=c.id join public.resident_events e on e.id=c.event_id where c.event_id=p_event_id and(public.has_active_community_role(e.community_id,array['admin'])or e.resident_id=public.current_community_resident_id(e.community_id));$$;
revoke all on function public.get_event_guest_credentials(uuid) from public;grant execute on function public.get_event_guest_credentials(uuid) to authenticated;

create or replace function public.get_public_invitation(p_share_token text) returns jsonb language sql stable security definer set search_path='pg_catalog','extensions','public' as $$
 select jsonb_build_object('visitor_name',i.visitor_name,'access_type',i.access_type,'visit_date',i.visit_date,'arrival_window_mode',i.arrival_window_mode,'arrival_start',i.arrival_start,'arrival_end_date',i.arrival_end_date,'arrival_end',i.arrival_end,'planned_exit_date',i.planned_exit_date,'planned_exit_time',i.planned_exit_time,'window_start',i.window_start,'window_end',i.window_end,'window_end_date',i.window_end_date,'no_time_limit',i.no_time_limit,'legacy_indefinite',i.legacy_indefinite,'status',public.arrival_effective_status(i.status,i.visit_date,i.arrival_window_mode,i.arrival_start,i.arrival_end_date,i.arrival_end,i.legacy_indefinite,community.time_zone,i.status='used'),'resident_name',r.full_name,'unit_identifier',u.identifier,'unit_building',u.building,'credential_type',c.credential_type,'credential_value',case when c.credential_type='pin'then coalesce(s.secret_value,c.credential_value)else coalesce(s.secret_value,c.qr_payload,c.credential_value)end,'qr_payload',case when c.credential_type='qr'then coalesce(s.secret_value,c.qr_payload,c.credential_value)else null end,'group_size',case when i.group_id is null then null else(select count(*)from public.invitations m where m.group_id=i.group_id)end,'group_position',case when i.group_id is null then null else(select count(*)from public.invitations m where m.group_id=i.group_id and(m.created_at,m.id)<=(i.created_at,i.id))end)
 from public.invitations i join public.communities community on community.id=i.community_id join public.residents r on r.id=i.resident_id left join public.units u on u.id=i.unit_id left join public.access_credentials c on c.invitation_id=i.id left join public.credential_secrets s on s.access_credential_id=c.id where i.share_token=p_share_token limit 1;$$;
revoke all on function public.get_public_invitation(text) from public;grant execute on function public.get_public_invitation(text) to anon,authenticated;

create or replace function public.get_public_event_guest(p_share_token text) returns jsonb language sql stable security definer set search_path='pg_catalog','extensions','public' as $$
 select jsonb_build_object('event_name',e.name,'guest_name',g.full_name,'event_date',e.event_date,'arrival_window_mode',e.arrival_window_mode,'arrival_start',e.arrival_start,'arrival_end_date',e.arrival_end_date,'arrival_end',e.arrival_end,'window_start',e.window_start,'window_end_date',e.window_end_date,'window_end',e.window_end,'planned_exit_date',e.planned_exit_date,'planned_exit_time',e.planned_exit_time,'status',public.arrival_effective_status(e.status,e.event_date,e.arrival_window_mode,e.arrival_start,e.arrival_end_date,e.arrival_end,false,community.time_zone,false),'resident_name',r.full_name,'unit_identifier',u.identifier,'attendance_status',g.attendance_status,'allows_companions',g.allows_companions,'max_companions',g.max_companions,'credential_type',c.credential_type,'credential_value',s.secret_value,'qr_payload',case when c.credential_type='qr'then s.secret_value else null end)
 from public.event_guest_credentials c join public.event_guest_credential_secrets s on s.event_guest_credential_id=c.id join public.event_guests g on g.id=c.event_guest_id join public.resident_events e on e.id=c.event_id join public.communities community on community.id=e.community_id join public.residents r on r.id=e.resident_id left join public.units u on u.id=e.unit_id where c.share_token=p_share_token limit 1;$$;
revoke all on function public.get_public_event_guest(text) from public;grant execute on function public.get_public_event_guest(text) to anon,authenticated;
