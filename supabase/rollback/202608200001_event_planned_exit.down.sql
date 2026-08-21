create or replace function public.get_public_event(p_share_token text)
returns jsonb
language sql
stable
security definer
set search_path = 'pg_catalog', 'extensions', 'public'
as $$
  select pg_catalog.jsonb_build_object(
    'name', resident_event.name,
    'event_date', resident_event.event_date,
    'window_start', resident_event.window_start,
    'window_end_date', resident_event.window_end_date,
    'window_end', resident_event.window_end,
    'status', resident_event.status,
    'resident_name', resident.full_name,
    'unit_identifier', unit_record.identifier,
    'credential_type', credential.credential_type,
    'credential_value', case
      when credential.credential_type = 'pin'
        then coalesce(secret.secret_value, credential.credential_value)
      else coalesce(secret.secret_value, credential.qr_payload, credential.credential_value)
    end,
    'qr_payload', case
      when credential.credential_type = 'qr'
        then coalesce(secret.secret_value, credential.qr_payload, credential.credential_value)
      else null
    end,
    'guest_count', (
      select count(*) from public.event_guests as guest
      where guest.event_id = resident_event.id
    )
  )
  from public.resident_events as resident_event
  join public.residents as resident on resident.id = resident_event.resident_id
  left join public.units as unit_record on unit_record.id = resident_event.unit_id
  left join public.event_credentials as credential on credential.event_id = resident_event.id
  left join public.credential_secrets as secret on secret.event_credential_id = credential.id
  where resident_event.share_token = p_share_token
  limit 1;
$$;

revoke all on function public.get_public_event(text) from public;
grant execute on function public.get_public_event(text) to anon, authenticated;

alter table public.resident_events
  drop constraint if exists resident_events_planned_exit_after_window_check,
  drop constraint if exists resident_events_planned_exit_pair_check,
  drop column if exists planned_exit_time,
  drop column if exists planned_exit_date;
