import { describe, expect, it } from "vitest";

import { getSafeSameOriginPath } from "@/lib/auth/redirect";

describe("getSafeSameOriginPath", () => {
  const requestUrl = "https://staging.ventry.example/auth/callback";

  it("preserves a same-origin application path", () => {
    expect(getSafeSameOriginPath("/reset-password?source=email", requestUrl, "/app")).toBe(
      "/reset-password?source=email",
    );
  });

  it("rejects protocol-relative and absolute external redirects", () => {
    expect(getSafeSameOriginPath("//evil.example/steal", requestUrl, "/app")).toBe("/app");
    expect(getSafeSameOriginPath("https://evil.example/steal", requestUrl, "/app")).toBe(
      "/app",
    );
  });
});
