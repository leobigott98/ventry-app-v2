drop function if exists public.create_individual_invitation(uuid, uuid, uuid, text, text, text, date, time, date, time, boolean, text, text, uuid);
drop index if exists public.invitations_individual_creation_idempotency_idx;
alter table public.invitations
  drop constraint if exists invitations_creation_idempotency_pair_check,
  drop column if exists creation_request_fingerprint,
  drop column if exists creation_idempotency_key;
