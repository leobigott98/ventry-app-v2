import { describe, expect, it } from "vitest";

import { parseVoiceAccessDraft, serializeVoiceAccessDraft } from "@/lib/voice/draft-transfer";
import type { VoiceAccessDraft } from "@/lib/voice/types";

const draft: VoiceAccessDraft = {
  intent: "group_invitation", eventName: null, accessType: "visitor", visitDate: "2026-08-27",
  arrivalWindowMode: "all_day", arrivalStart: null, arrivalEndDate: null, arrivalEnd: null,
  plannedExitDate: null, plannedExitTime: null, notes: null, allowsCompanions: null,
  recommendEvent: false, tooManyPeople: false,
  people: [{ personId: "11111111-1111-4111-8111-111111111111", name: "Ana", phone: null, contactId: null, contactCandidates: [], needsContactClarification: false }],
};

describe("transferencia temporal de borradores de voz", () => {
  it("acepta un borrador reciente y conserva solo el contrato permitido", () => {
    const encoded = serializeVoiceAccessDraft(draft, 1_000_000);
    expect(parseVoiceAccessDraft(encoded, 1_000_100)).toEqual(draft);
    expect(encoded).not.toMatch(/api[_-]?key|credential|token/i);
  });

  it("rechaza borradores vencidos, del futuro o alterados", () => {
    expect(parseVoiceAccessDraft(serializeVoiceAccessDraft(draft, 1_000_000), 1_900_001)).toBeNull();
    expect(parseVoiceAccessDraft(serializeVoiceAccessDraft(draft, 1_100_001), 1_000_000)).toBeNull();
    expect(parseVoiceAccessDraft('{"version":1,"createdAt":1000000,"draft":{"intent":"event"}}', 1_000_100)).toBeNull();
  });
});
