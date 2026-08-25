import { describe, expect, it } from "vitest";

import type { ResidentContactViewModel } from "@/lib/domain/types";
import { FakeInvitationExtractionProvider } from "@/test/voice-fake-providers";
import { interpretVoiceInvitation } from "@/lib/voice/orchestrator";
import type { ProviderExtraction } from "@/lib/voice/types";

const base: ProviderExtraction = { draft: { visitorName: "José Pérez", contactId: null, visitDate: "2026-08-28", windowStart: "02:00", windowEndDate: "2026-08-28", windowEnd: "04:00", accessType: "visitor", noTimeLimit: false, notes: null }, ambiguities: [{ field: "windowStart", code: "AM_PM_AMBIGUOUS", detail: "La frase no indica mañana o tarde." }] };
const contact = (id: string, phone: string): ResidentContactViewModel => ({ stableId: `saved:${id}`, savedContactId: id, name: "José Pérez", phone, relationshipLabel: "Familia", isFavorite: true, invitationCount: 4, lastInvitedAt: "2026-08-20T00:00:00Z", origin: "saved" });

describe("voice extraction orchestration", () => {
  it("congela reloj en Caracas y pide AM/PM sin elegir silenciosamente", async () => {
    const result = await interpretVoiceInvitation({ transcript: "Invita a José el viernes a las dos", timeZone: "America/Caracas", now: new Date("2026-08-23T12:00:00.000Z"), extractionProvider: new FakeInvitationExtractionProvider(base), findContacts: async () => [] });
    expect(result.referenceLocalDate).toBe("2026-08-23");
    expect(result.ambiguities[0]).toMatchObject({ code: "AM_PM_AMBIGUOUS", options: [{ value: "02:00" }, { value: "14:00" }] });
  });

  it("no elige entre contactos duplicados y minimiza teléfonos", async () => {
    const contacts = [contact("11111111-1111-4111-8111-111111111111", "+58 412 555 1234"), contact("22222222-2222-4222-8222-222222222222", "+58 414 555 9876")];
    const result = await interpretVoiceInvitation({ transcript: "Invita a José", timeZone: "America/Caracas", extractionProvider: new FakeInvitationExtractionProvider({ ...base, ambiguities: [] }), findContacts: async () => contacts });
    expect(result.draft.contactId).toBeNull(); expect(result.ambiguities).toEqual(expect.arrayContaining([expect.objectContaining({ code: "CONTACT_AMBIGUOUS" })]));
    expect(result.contactCandidates.map((item) => item.phoneLastDigits)).toEqual(["1234", "9876"]);
  });

  it("propone una coincidencia exacta única guardada, pero no crea nada", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const result = await interpretVoiceInvitation({ transcript: "Invita a José", timeZone: "America/Caracas", extractionProvider: new FakeInvitationExtractionProvider({ ...base, ambiguities: [] }), findContacts: async () => [contact(id, "+58 412 555 1234")] });
    expect(result.draft.contactId).toBe(id);
  });

  it("detecta identidad, fecha, hora faltantes y ventana invertida", async () => {
    const extraction: ProviderExtraction = { draft: { visitorName: null, contactId: null, visitDate: null, windowStart: null, windowEndDate: null, windowEnd: null, accessType: null, noTimeLimit: false, notes: null }, ambiguities: [] };
    const result = await interpretVoiceInvitation({ transcript: "Hay una visita", timeZone: "America/Caracas", extractionProvider: new FakeInvitationExtractionProvider(extraction), findContacts: async () => [] });
    expect(result.missingFields).toEqual(expect.arrayContaining(["visitorName", "visitDate", "windowStart", "accessType"]));
  });

  it("marca una fecha pasada de forma determinista aunque el proveedor no lo haga", async () => {
    const result = await interpretVoiceInvitation({ transcript: "Invita a José ayer", timeZone: "America/Caracas", now: new Date("2026-08-23T12:00:00.000Z"), extractionProvider: new FakeInvitationExtractionProvider({ ...base, draft: { ...base.draft, visitDate: "2026-08-22", windowEndDate: "2026-08-22" }, ambiguities: [] }), findContacts: async () => [] });
    expect(result.ambiguities).toEqual(expect.arrayContaining([expect.objectContaining({ field: "visitDate", code: "PAST_DATE" })]));
  });
});
