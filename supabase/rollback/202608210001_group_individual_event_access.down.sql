-- Local/manual rollback only. Back up first: this removes group metadata and individual event credentials.
begin;

drop function if exists public.get_guard_upcoming_access(uuid,text,text,integer,integer);
drop function if exists public.get_invitation_card_ids(uuid,uuid,text,text,date,date,integer,integer);
drop function if exists public.register_event_guest_entry(uuid,uuid,uuid,integer,uuid);
drop function if exists public.validate_event_guest_credential(uuid,text,text,text,text);
drop function if exists public.mark_event_guest_credential_shared(uuid,uuid,text);
drop function if exists public.get_public_event_guest(text);
drop function if exists public.get_event_guest_credentials(uuid);
drop function if exists public.create_individual_resident_event(uuid,uuid,text,date,time,date,time,date,time,text,text,jsonb,uuid);
drop function if exists public.revoke_invitation_group(uuid,uuid);
drop function if exists public.create_invitation_group(uuid,uuid,text,date,time,date,time,boolean,text,text,jsonb,uuid);

drop trigger if exists enforce_invitation_group_member_tenant on public.invitations;
drop trigger if exists enforce_invitation_group_tenant on public.invitation_groups;
drop function if exists public.enforce_group_tenant_references();

drop table if exists public.event_guest_credential_secrets;
drop table if exists public.event_guest_credentials;
alter table public.visitor_entries drop constraint if exists visitor_entries_companion_count_check, drop column if exists companion_count;
alter table public.event_guests drop constraint if exists event_guests_companions_check, drop constraint if exists event_guests_event_id_id_unique,
  drop column if exists credential_shared_at, drop column if exists max_companions, drop column if exists allows_companions;
alter table public.resident_events drop constraint if exists resident_events_credential_mode_check,
  drop column if exists creation_request_fingerprint, drop column if exists creation_idempotency_key,
  drop column if exists credential_mode;
alter table public.invitations drop column if exists group_id, drop column if exists visitor_phone;
drop table if exists public.invitation_groups;

-- Restore the previous public RPC definitions by reapplying migration 202608180002
-- (and 202608200001 for planned-exit fields) before accepting traffic.
commit;
