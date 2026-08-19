import { describe, expect, it } from "vitest";

import {
  createNumericPin,
  createOpaqueQrCredential,
  createOpaqueShareToken,
} from "@/lib/security/credentials";

describe("credential generation", () => {
  it("creates fixed-width numeric PINs, including possible leading zeroes", () => {
    expect(createNumericPin(6)).toMatch(/^\d{6}$/);
    expect(createNumericPin(8)).toMatch(/^\d{8}$/);
  });

  it("creates opaque base64url credentials with 256 bits of entropy", () => {
    const credentials = new Set(Array.from({ length: 32 }, createOpaqueQrCredential));
    expect(credentials.size).toBe(32);
    for (const credential of credentials) {
      expect(credential).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(credential).not.toContain(":");
    }
  });

  it("uses the same high-entropy opaque format for share tokens", () => {
    expect(createOpaqueShareToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
