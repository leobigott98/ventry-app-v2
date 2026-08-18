import { describe, expect, it } from "vitest";

import { normalizeQrCredential } from "@/lib/qr-credentials";

describe("normalizeQrCredential", () => {
  it("recupera credenciales desde los parametros admitidos", () => {
    expect(normalizeQrCredential("https://ventry.app/app/guards?qr=ventry%3Aabc")).toBe("ventry:abc");
    expect(normalizeQrCredential("https://ventry.app/app/guards?credential= 123456 ")).toBe("123456");
    expect(normalizeQrCredential("https://ventry.app/app/guards?code=evento-1")).toBe("evento-1");
  });

  it("prioriza qr y conserva una URL sin parametro reconocido", () => {
    expect(normalizeQrCredential("https://ventry.app/app/guards?qr=primero&code=segundo")).toBe("primero");
    expect(normalizeQrCredential(" https://ventry.app/invite/token ")).toBe("https://ventry.app/invite/token");
  });

  it("normaliza payloads crudos incluso si no son URLs", () => {
    expect(normalizeQrCredential("  ventry:community:invitation:token  ")).toBe(
      "ventry:community:invitation:token",
    );
    expect(normalizeQrCredential("   ")).toBe("");
  });
});
