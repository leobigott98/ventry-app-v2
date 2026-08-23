import { describe, expect, it, vi } from "vitest";

import { contactPickerIsSupported, pickDeviceContacts, prepareImportReview } from "@/lib/contacts/import";

describe("contact import", () => {
  it("deduplica por teléfono normalizado contra guardados y dentro del lote", () => {
    const review = prepareImportReview([
      { name: "María", phone: "0412 555 1234", source: "contact_picker" },
      { name: "María duplicada", phone: "+58 412 555 1234", source: "contact_picker" },
      { name: "Pedro", phone: "+1 305 555 0199", source: "contact_picker" },
    ], ["+13055550199"]);

    expect(review.map((item) => ({ phone: item.normalizedPhone, duplicate: item.duplicate }))).toEqual([
      { phone: "+584125551234", duplicate: false },
      { phone: "+584125551234", duplicate: true },
      { phone: "+13055550199", duplicate: true },
    ]);
  });

  it("comprueba que el selector ofrece nombre y teléfono antes de mostrarlo", async () => {
    const supported = { getProperties: vi.fn().mockResolvedValue(["name", "tel", "email"]), select: vi.fn() };
    const unsupported = { getProperties: vi.fn().mockResolvedValue(["name", "email"]), select: vi.fn() };
    await expect(contactPickerIsSupported(supported)).resolves.toBe(true);
    await expect(contactPickerIsSupported(unsupported)).resolves.toBe(false);
  });

  it("trata la cancelación del selector como un resultado vacío sin error", async () => {
    const manager = { select: vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")) };
    await expect(pickDeviceContacts(manager)).resolves.toEqual({ status: "cancelled", contacts: [] });
    expect(manager.select).toHaveBeenCalledWith(["name", "tel"], { multiple: true });
  });
});
