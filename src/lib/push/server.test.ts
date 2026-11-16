// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateVAPIDKeys } from "web-push";

import { allowedPushEndpoint, buildNativePayload, deliverQueuedPush, getPushConfiguration } from "@/lib/push/server";

const mocks = vi.hoisted(() => ({ send: vi.fn(), query: vi.fn() }));
vi.mock("pg", () => ({ Pool: class { query = mocks.query; on() { return this; } } }));
vi.mock("web-push", async (original) => ({ ...await original<typeof import("web-push")>(), sendNotification: mocks.send }));

const id = "b5144a87-171f-4171-a477-d9165d65036d";
const endpoint = "https://fcm.googleapis.com/fcm/send/token";
const keys = generateVAPIDKeys();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VAPID_PUBLIC_KEY", keys.publicKey);
  vi.stubEnv("VAPID_PRIVATE_KEY", keys.privateKey);
  vi.stubEnv("VAPID_SUBJECT", "mailto:push@ventry.example");
  vi.stubEnv("PUSH_DATABASE_URL", "postgres://test");
});
afterEach(() => vi.unstubAllEnvs());

describe("Web Push sender", () => {
  it("builds only fixed copy and a scoped deep link for the lock screen", () => {
    const event = { id, kind: "credential_rejected" as const, visitorName: "Private Name", pin: "123456" };
    expect(buildNativePayload(event)).toEqual({
      id, href: "/app/notifications/" + id, title: "Acceso rechazado",
      body: "Un QR o PIN no permitió el acceso. Revisa el aviso en Ventry.", action: "review",
    });
  });

  it("accepts browser push providers and requires a matching VAPID key pair", () => {
    expect(allowedPushEndpoint(endpoint)).toBe(true);
    expect(allowedPushEndpoint("https://web.push.apple.com/QABC")).toBe(true);
    expect(allowedPushEndpoint("https://fcm.googleapis.com@internal.example/token")).toBe(false);
    expect(allowedPushEndpoint("https://fcm.googleapis.com:443/token")).toBe(false);
    expect(allowedPushEndpoint("https://localhost/token")).toBe(false);
    expect(getPushConfiguration()?.publicKey).toBe(keys.publicKey);
    vi.stubEnv("VAPID_PRIVATE_KEY", generateVAPIDKeys().privateKey);
    expect(getPushConfiguration()).toBeNull();
  });

  it.each([[404, "expired"], [410, "expired"], [429, "retry"], [503, "retry"], [403, "failed"]])(
    "classifies provider %s and records the lease outcome",
    async (statusCode, outcome) => {
      mocks.query.mockResolvedValueOnce({ rows: [{
        delivery_id: id, lease_id: "lease", event_id: id, kind: "visit_waiting", ttl: 30,
        endpoint, p256dh: "public", auth_secret: "auth",
      }] }).mockResolvedValueOnce({ rows: [] });
      mocks.send.mockRejectedValueOnce({ statusCode });
      await deliverQueuedPush(id);
      expect(mocks.query).toHaveBeenNthCalledWith(1, expect.stringContaining("claim_deliveries"), [keys.publicKey, id]);
      expect(mocks.query).toHaveBeenNthCalledWith(2, expect.stringContaining("finish_delivery"), [id, "lease", outcome]);
      expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ endpoint }), expect.any(String),
        expect.objectContaining({ topic: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/), TTL: 30, urgency: "high" }));
    },
  );
});
