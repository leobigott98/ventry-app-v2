import { describe, expect, it } from "vitest";

import { residentContactInputSchema } from "@/lib/schemas/contacts";

describe("residentContactInputSchema", () => {
  it("permite guardar solo nombre sin teléfono", () => {
    expect(residentContactInputSchema.parse({ name: "  Ana García  " })).toEqual({
      name: "Ana García", phone: null, relationshipLabel: undefined, isFavorite: false, source: "manual",
    });
  });

  it("valida un teléfono cuando se proporciona", () => {
    expect(residentContactInputSchema.safeParse({ name: "Ana", phone: "555" }).success).toBe(false);
    expect(residentContactInputSchema.safeParse({ name: "Ana", phone: "04125551234" }).success).toBe(true);
  });
});
