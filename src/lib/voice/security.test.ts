import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { VoiceError } from "@/lib/voice/errors";
import { OpenAIInvitationExtractionProvider, OpenAITranscriptionProvider } from "@/lib/voice/openai-providers";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("voice server and persistence boundaries", () => {
  it("importa sin API key y solo la valida cuando se intenta usar el proveedor", async () => {
    const previous = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
    const fetchSpy = vi.fn(); vi.stubGlobal("fetch", fetchSpy);
    try {
      await expect(new OpenAITranscriptionProvider().transcribe({ bytes: new Uint8Array([1]), fileName: "a.wav", mimeType: "audio/wav" })).rejects.toMatchObject({ code: "VOICE_PROVIDER_NOT_CONFIGURED", status: 503 } satisfies Partial<VoiceError>);
      await expect(new OpenAIInvitationExtractionProvider().extract({ transcript: "Invita a Pedro", timeZone: "America/Caracas", referenceTime: "2026-08-23T12:00:00.000Z", referenceLocalDate: "2026-08-23" })).rejects.toMatchObject({ code: "VOICE_PROVIDER_NOT_CONFIGURED" });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous;
    }
  });

  it("mantiene SDK, modelos y store:false exclusivamente en el adaptador server-only", () => {
    const provider = read("src/lib/voice/openai-providers.ts");
    expect(provider).toContain('import "server-only"'); expect(provider).toContain('store: false'); expect(provider).toContain('"gpt-transcribe"'); expect(provider).toContain('"gpt-5.6-luna"');
    const client = read("src/components/invitations/voice-invitation.tsx");
    expect(client).not.toContain("OPENAI_API_KEY"); expect(client).not.toContain("OPENAI_TRANSCRIPTION_MODEL");
  });

  it("mantiene el parser pesado de medios fuera del bundle cliente", () => {
    const audio = read("src/lib/voice/audio.ts"); const client = read("src/components/invitations/voice-invitation.tsx");
    expect(audio).toContain('import "server-only"'); expect(audio).toContain('from "mediabunny"');
    expect(client).toContain('from "@/lib/voice/audio-limits"'); expect(client).not.toContain("@/lib/voice/audio\""); expect(client).not.toContain("mediabunny");
  });

  it("implementa límite atómico por usuario/comunidad, lock expirable y metadatos mínimos", () => {
    const migration = read("supabase/migrations/202608230004_voice_transcription_limits.sql");
    expect(migration).toContain("pg_advisory_xact_lock"); expect(migration).toContain("interval '10 minutes'"); expect(migration).toContain(">= 10"); expect(migration).toContain("where status = 'active'"); expect(migration).toContain("auth.uid()"); expect(migration).toContain("enable row level security");
    expect(migration).not.toMatch(/\b(audio|transcript|visitor_name|pin|qr|token)\s+(text|bytea|jsonb)/i);
    expect(read("supabase/rollback/202608230004_voice_transcription_limits.down.sql")).toContain("drop table if exists public.voice_transcription_requests");
  });

  it("el endpoint de voz no importa ni llama la creación de invitaciones", () => {
    const route = read("src/app/api/invitations/voice/transcribe/route.ts");
    expect(route).not.toContain("createInvitation"); expect(route).not.toContain("access_credentials"); expect(route).not.toContain("invitation_events");
  });
});
