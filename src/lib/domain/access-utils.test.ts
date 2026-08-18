import { describe, expect, it } from "vitest";

import { mayRotateProvisionedAuthUser } from "@/lib/domain/access-utils";

describe("mayRotateProvisionedAuthUser", () => {
  it("allows a password rotation only for the auth user already linked to the membership", () => {
    expect(mayRotateProvisionedAuthUser("auth-a", "auth-a")).toBe(true);
    expect(mayRotateProvisionedAuthUser("auth-a", "auth-b")).toBe(false);
    expect(mayRotateProvisionedAuthUser("auth-a", null)).toBe(false);
  });
});
