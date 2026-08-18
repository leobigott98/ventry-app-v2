-- STAGING EMERGENCY ROLLBACK ONLY.
-- Deploy the pre-migration application before running this file. This restores
-- the historically permissive database posture and must not be used casually.

begin;

drop policy if exists community_assets_insert_scoped on storage.objects;
drop policy if exists community_assets_update_scoped on storage.objects;
drop policy if exists community_assets_delete_scoped on storage.objects;

drop trigger if exists restrict_guard_invitation_updates on public.invitations;
drop trigger if exists restrict_guard_event_guest_updates on public.event_guests;
drop trigger if exists restrict_guard_visitor_entry_updates on public.visitor_entries;
drop trigger if exists enforce_membership_tenant_references on public.community_memberships;
drop trigger if exists enforce_resident_tenant_references on public.residents;
drop trigger if exists enforce_invitation_tenant_references on public.invitations;
drop trigger if exists enforce_visitor_entry_tenant_references on public.visitor_entries;
drop trigger if exists enforce_access_event_tenant_references on public.access_events;
drop trigger if exists enforce_resident_event_tenant_references on public.resident_events;

drop policy if exists communities_select_member on public.communities;
drop policy if exists communities_update_admin on public.communities;
drop policy if exists memberships_select_self_or_admin on public.community_memberships;
drop policy if exists memberships_insert_admin on public.community_memberships;
drop policy if exists memberships_update_admin on public.community_memberships;
drop policy if exists memberships_delete_admin on public.community_memberships;
drop policy if exists units_select_member on public.units;
drop policy if exists units_insert_admin on public.units;
drop policy if exists units_update_admin on public.units;
drop policy if exists units_delete_admin on public.units;
drop policy if exists residents_select_scoped on public.residents;
drop policy if exists residents_insert_admin on public.residents;
drop policy if exists residents_update_admin on public.residents;
drop policy if exists residents_delete_admin on public.residents;
drop policy if exists invitations_select_scoped on public.invitations;
drop policy if exists invitations_insert_scoped on public.invitations;
drop policy if exists invitations_update_scoped on public.invitations;
drop policy if exists invitations_delete_owner on public.invitations;
drop policy if exists access_credentials_select_scoped on public.access_credentials;
drop policy if exists access_credentials_insert_owner on public.access_credentials;
drop policy if exists access_credentials_delete_owner on public.access_credentials;
drop policy if exists invitation_events_select_owner on public.invitation_events;
drop policy if exists invitation_events_insert_owner on public.invitation_events;
drop policy if exists visitor_entries_select_scoped on public.visitor_entries;
drop policy if exists visitor_entries_insert_gate on public.visitor_entries;
drop policy if exists visitor_entries_update_gate on public.visitor_entries;
drop policy if exists visitor_entries_delete_admin on public.visitor_entries;
drop policy if exists access_events_select_scoped on public.access_events;
drop policy if exists access_events_insert_gate on public.access_events;
drop policy if exists access_events_update_admin on public.access_events;
drop policy if exists access_events_delete_admin on public.access_events;
drop policy if exists resident_events_select_scoped on public.resident_events;
drop policy if exists resident_events_insert_owner on public.resident_events;
drop policy if exists resident_events_update_owner on public.resident_events;
drop policy if exists resident_events_delete_owner on public.resident_events;
drop policy if exists event_guests_select_scoped on public.event_guests;
drop policy if exists event_guests_insert_owner on public.event_guests;
drop policy if exists event_guests_update_scoped on public.event_guests;
drop policy if exists event_guests_delete_owner on public.event_guests;
drop policy if exists event_credentials_select_scoped on public.event_credentials;
drop policy if exists event_credentials_insert_owner on public.event_credentials;
drop policy if exists event_credentials_delete_owner on public.event_credentials;
drop policy if exists event_activity_select_scoped on public.event_activity;
drop policy if exists event_activity_insert_scoped on public.event_activity;

alter table public.communities disable row level security;
alter table public.community_memberships disable row level security;
alter table public.units disable row level security;
alter table public.residents disable row level security;
alter table public.invitations disable row level security;
alter table public.access_credentials disable row level security;
alter table public.invitation_events disable row level security;
alter table public.visitor_entries disable row level security;
alter table public.access_events disable row level security;
alter table public.resident_events disable row level security;
alter table public.event_guests disable row level security;
alter table public.event_credentials disable row level security;
alter table public.event_activity disable row level security;

grant all on table
  public.communities,
  public.community_memberships,
  public.units,
  public.residents,
  public.invitations,
  public.access_credentials,
  public.invitation_events,
  public.visitor_entries,
  public.access_events,
  public.resident_events,
  public.event_guests,
  public.event_credentials,
  public.event_activity
to anon, authenticated;

drop function if exists public.get_public_invitation(text);
drop function if exists public.get_public_event(text);
drop function if exists public.create_community_onboarding(
  text, text, text, integer, text, text, text, text, text, text, text, text
);
drop function if exists public.claim_current_user_memberships();
drop function if exists public.match_invitation_credential(uuid, text, text);
drop function if exists public.match_event_credential(uuid, text, text);
drop function if exists public.register_invitation_entry(uuid, uuid);
drop function if exists public.restrict_guard_invitation_updates();
drop function if exists public.restrict_guard_event_guest_updates();
drop function if exists public.restrict_guard_visitor_entry_updates();
drop function if exists public.enforce_tenant_reference_integrity();
drop function if exists public.can_manage_community_asset(text);
drop function if exists public.current_community_resident_id(uuid);
drop function if exists public.has_active_community_role(uuid, text[]);
drop function if exists public.is_onboarding_user();
drop index if exists public.idx_memberships_auth_user_community_active;

commit;
