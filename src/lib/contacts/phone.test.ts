import { describe, expect, it } from "vitest";

import { normalizeContactName, normalizePhoneNumber } from "@/lib/contacts/phone";

describe("normalizePhoneNumber", () => {
  it.each([
    ["0412-555-1234", "+584125551234"],
    ["412 555 1234", "+584125551234"],
    ["58 412 555 1234", "+584125551234"],
    ["+58 (424) 555.1234", "+584245551234"],
    ["0058 414 555 1234", "+584145551234"],
    ["+1 (305) 555-0199", "+13055550199"],
    ["0044 20 7946 0958", "+442079460958"],
  ])("normaliza %s", (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
  });

  it.each(["", "123", "555-1234", "0412 555 1234 ext 99", "+00 1234567"])("rechaza %s", (input) => {
    expect(normalizePhoneNumber(input)).toBeNull();
  });
});

describe("normalizeContactName", () => {
  it("normaliza acentos, mayúsculas y espacios para deduplicar sin teléfono", () => {
    expect(normalizeContactName("  María   PÉREZ ")).toBe("maria perez");
  });
});
