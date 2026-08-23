import { describe, expect, it } from "vitest";

import { parseEventDraftTransfer, serializeEventDraftTransfer } from "@/lib/event-draft-transfer";

describe("event draft transfer", () => {
  it("serializa solo campos admitidos y valida el contenido al recuperarlo", () => {
    const payload = serializeEventDraftTransfer([{ fullName: "  Carlos Rojas  ", phone: " +58 111 " }]);
    expect(parseEventDraftTransfer(payload)).toEqual([{
      fullName: "Carlos Rojas",
      phone: "+58 111",
      notes: null,
      allowsCompanions: false,
      maxCompanions: 0,
      residentContactId: null,
      contactStableId: null,
      contactOrigin: null,
    }]);
  });

  it("rechaza JSON inválido, versiones desconocidas y más de 500 invitados", () => {
    expect(parseEventDraftTransfer("{")).toBeNull();
    expect(parseEventDraftTransfer(JSON.stringify({ version: 2, guests: [] }))).toBeNull();
    expect(parseEventDraftTransfer(JSON.stringify({
      version: 1,
      guests: Array.from({ length: 501 }, (_, index) => ({ fullName: `Persona ${index}` })),
    }))).toBeNull();
  });
});
