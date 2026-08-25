drop function if exists public.release_voice_transcription_slot(uuid, uuid, text);
drop function if exists public.acquire_voice_transcription_slot(uuid, uuid, integer);
drop table if exists public.voice_transcription_requests;

