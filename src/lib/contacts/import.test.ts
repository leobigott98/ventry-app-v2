import { describe, expect, it, vi } from "vitest";

import { parseVCard, pickDeviceContacts, prepareImportReview } from "@/lib/contacts/import";

describe("contact import", () => {
  it("deduplica por teléfono normalizado contra guardados y dentro del lote", () => {
    const review = prepareImportReview([
      { name: "María", phone: "0412 555 1234", source: "vcard" },
      { name: "María duplicada", phone: "+58 412 555 1234", source: "vcard" },
      { name: "Pedro", phone: "+1 305 555 0199", source: "vcard" },
    ], ["+13055550199"]);

    expect(review.map((item) => ({ phone: item.normalizedPhone, duplicate: item.duplicate }))).toEqual([
      { phone: "+584125551234", duplicate: false },
      { phone: "+584125551234", duplicate: true },
      { phone: "+13055550199", duplicate: true },
    ]);
  });

  it("extrae únicamente nombre y teléfono de vCard", () => {
    const contacts = parseVCard("BEGIN:VCARD\nVERSION:3.0\nFN:Ana García\nTEL;TYPE=CELL:04145551234\nEMAIL:ana@example.com\nADR:Caracas\nEND:VCARD");
    expect(contacts).toEqual([{ name: "Ana García", phone: "04145551234", source: "vcard" }]);
    expect(JSON.stringify(contacts)).not.toContain("example.com");
    expect(JSON.stringify(contacts)).not.toContain("Caracas");
  });

  it("trata la cancelación del selector como un resultado vacío sin error", async () => {
    const manager = { select: vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")) };
    await expect(pickDeviceContacts(manager)).resolves.toEqual({ status: "cancelled", contacts: [] });
    expect(manager.select).toHaveBeenCalledWith(["name", "tel"], { multiple: true });
  });
});
