import { describe, expect, it } from "vitest";

import type { ResidentContactViewModel } from "@/lib/domain/types";
import { interpretVoiceAccess } from "@/lib/voice/orchestrator";
import type { ProviderExtraction } from "@/lib/voice/types";
import { FakeInvitationExtractionProvider } from "@/test/voice-fake-providers";

const provider = (people: string[], intent: ProviderExtraction["draft"]["intent"] = "group_invitation", overrides: Partial<ProviderExtraction["draft"]> = {}) => new FakeInvitationExtractionProvider({ draft: { intent, eventName: null, people: people.map((name) => ({ name, phone: null })), accessType: "visitor", dateText: "mañana", arrivalText: "en la tarde", plannedExitText: null, notes: null, allowsCompanions: null, tooManyPeople: false, ...overrides }, ambiguities: [] });
const contact = (id: string, phone: string): ResidentContactViewModel => ({ stableId: `saved:${id}`, savedContactId: id, name: "José Pérez", phone, relationshipLabel: "Familia", isFavorite: true, invitationCount: 4, lastInvitedAt: "2026-08-20T00:00:00Z", origin: "saved" });

describe("orquestación unificada de voz", () => {
  it("clasifica una persona como individual y tres como grupo", async () => {
    const common = { transcript: "mañana en la tarde", timeZone: "America/Caracas", now: new Date("2026-08-26T12:00:00Z"), findContacts: async () => [] };
    expect((await interpretVoiceAccess({ ...common, extractionProvider: provider(["Ana"], "individual_invitation") })).draft.intent).toBe("individual_invitation");
    expect((await interpretVoiceAccess({ ...common, extractionProvider: provider(["Ana", "Luis", "José"]) })).draft.intent).toBe("group_invitation");
  });

  it("normaliza invitaciones sin horario a Todo el día pero deja eventos pendientes", async () => {
    const common = { transcript: "mañana", timeZone: "America/Caracas", now: new Date("2026-08-26T12:00:00Z"), findContacts: async () => [] };
    const invitation = await interpretVoiceAccess({ ...common, extractionProvider: provider(["Ana"], "individual_invitation", { arrivalText: null }) });
    const event = await interpretVoiceAccess({ ...common, extractionProvider: provider(["Ana"], "event", { eventName: "Cena", arrivalText: null }) });
    expect(invitation.draft).toMatchObject({ arrivalWindowMode: "all_day", arrivalStart: null, arrivalEndDate: null, arrivalEnd: null });
    expect(invitation.missingFields).not.toContain("arrivalWindowMode");
    expect(event.draft.arrivalWindowMode).toBeNull();
    expect(event.missingFields).toContain("arrivalWindowMode");
  });

  it("una intención explícita de cumpleaños produce evento", async () => {
    const result = await interpretVoiceAccess({ transcript: "Crea un evento para el cumpleaños de Ana mañana en la tarde", timeZone: "America/Caracas", extractionProvider: provider([], "event", { eventName: "Cumpleaños de Ana" }), findContacts: async () => [] });
    expect(result.draft).toMatchObject({ intent: "event", eventName: "Cumpleaños de Ana", allowsCompanions: null });
  });

  it("nueve personas recomienda evento sin cambiar automáticamente", async () => {
    const names = Array.from({ length: 9 }, (_, index) => `Persona ${index + 1}`);
    const result = await interpretVoiceAccess({ transcript: "Invita mañana en la tarde a nueve personas", timeZone: "America/Caracas", extractionProvider: provider(names), findContacts: async () => [] });
    expect(result.draft).toMatchObject({ intent: "group_invitation", recommendEvent: true });
    expect(result.ambiguities).toEqual(expect.arrayContaining([expect.objectContaining({ code: "EVENT_RECOMMENDED" })]));
  });

  it("resuelve cada contacto de forma independiente y solo marca el ambiguo", async () => {
    const first = "11111111-1111-4111-8111-111111111111"; const second = "22222222-2222-4222-8222-222222222222";
    const result = await interpretVoiceAccess({ transcript: "Invita a Ana y José mañana en la tarde", timeZone: "America/Caracas", extractionProvider: provider(["Ana", "José Pérez"]), findContacts: async (name) => name === "Ana" ? [] : [contact(first, "+584125551234"), contact(second, "+584145559876")] });
    expect(result.draft.people[0]?.needsContactClarification).toBe(false);
    expect(result.draft.people[1]).toMatchObject({ contactId: null, needsContactClarification: true });
    expect(result.draft.people[1]?.contactCandidates.map((item) => item.phoneLastDigits)).toEqual(["1234", "9876"]);
  });

  it("selecciona una coincidencia histórica exacta sin inventar contactId", async () => {
    const historical: ResidentContactViewModel = { stableId: "history:ana", savedContactId: null, name: "Ana Pérez", phone: "+584121234567", relationshipLabel: null, isFavorite: false, invitationCount: 1, lastInvitedAt: "2026-08-20T00:00:00Z", origin: "history" };
    const result = await interpretVoiceAccess({ transcript: "Invita a Ana Pérez mañana en la tarde", timeZone: "America/Caracas", extractionProvider: provider(["Ana Pérez"], "individual_invitation"), findContacts: async () => [historical] });
    expect(result.draft.people[0]).toMatchObject({ contactId: null, selectedContactStableId: "history:ana", continueAsNew: false, phone: historical.phone, needsContactClarification: false });
  });

  it("pide grupo o evento cuando la intención sigue ambigua", async () => {
    const result = await interpretVoiceAccess({ transcript: "Organiza esto mañana", timeZone: "America/Caracas", extractionProvider: provider(["Ana", "Luis"], "ambiguous"), findContacts: async () => [] });
    expect(result.ambiguities).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INTENT_AMBIGUOUS" })]));
  });

  it("pide nombre y horario cuando faltan en un evento", async () => {
    const result = await interpretVoiceAccess({
      transcript: "Crea un evento",
      timeZone: "America/Caracas",
      extractionProvider: provider([], "event", {
        eventName: null,
        dateText: null,
        arrivalText: null,
      }),
      findContacts: async () => [],
    });
    expect(result.missingFields).toEqual(expect.arrayContaining(["visitDate", "arrivalWindowMode", "eventName"]));
    expect(result.ambiguities).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "EVENT_SCHEDULE_MISSING" }),
      expect.objectContaining({ code: "EVENT_NAME_MISSING" }),
    ]));
  });

  it("marca personas duplicadas sin fusionarlas silenciosamente", async () => {
    const result = await interpretVoiceAccess({
      transcript: "Invita a Ana y Ana mañana en la tarde",
      timeZone: "America/Caracas",
      extractionProvider: provider(["Ana", "Ana"]),
      findContacts: async () => [],
    });
    expect(result.draft.people).toHaveLength(2);
    expect(result.ambiguities).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "DUPLICATE_PERSON", personId: result.draft.people[1]?.personId }),
    ]));
  });
});
