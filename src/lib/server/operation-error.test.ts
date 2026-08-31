import { afterEach, describe, expect, it, vi } from "vitest";

import { logOperationError, operationErrorFrom } from "@/lib/server/operation-error";

describe("operation error diagnostics", () => {
  afterEach(() => vi.restoreAllMocks());

  it("conserva el código técnico sin registrar teléfonos, PIN, QR ni payload", () => {
    const error = operationErrorFrom({
      code: "23514",
      message: "constraint failed for +58 412 555 1234 with PIN 123456",
      details: "qr=abcdefabcdefabcdefabcdefabcdefabcdef payload visitor 04125559876",
      hint: "retry key 0123456789abcdef0123456789abcdef",
    }, "fallback");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logOperationError("create_arrival_resident_event", error);

    expect(consoleError).toHaveBeenCalledOnce();
    const serialized = JSON.stringify(consoleError.mock.calls[0]);
    expect(serialized).toContain("create_arrival_resident_event");
    expect(serialized).toContain("23514");
    expect(serialized).not.toContain("04125559876");
    expect(serialized).not.toContain("123456");
    expect(serialized).not.toContain("abcdefabcdefabcdefabcdefabcdefabcdef");
    expect(serialized).not.toContain("0123456789abcdef0123456789abcdef");
  });
});
