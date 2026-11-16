// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/push/route";
import { POST as worker } from "@/app/api/push/worker/route";

const mocks = vi.hoisted(() => ({ context: vi.fn(), rpc: vi.fn(), deliver: vi.fn() }));
vi.mock("@/lib/auth/api", () => ({ requireApiCommunityContext: mocks.context }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/push/server", () => ({
  allowedPushEndpoint: () => true,
  getPushConfiguration: () => ({ publicKey: "test-key" }),
  deliverQueuedPush: mocks.deliver,
}));

const installationId = "b5144a87-171f-4171-a477-d9165d65036d";
const origin = "https://ventry.example";

function request(body: object, from = origin) {
  return new NextRequest(origin + "/api/push", {
    method: "POST", headers: { origin: from, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

beforeEach(() => vi.resetAllMocks());

describe("Push endpoints", () => {
  it("requires same origin and a validated membership before writing", async () => {
    expect((await POST(request({ action: "test", installationId }, "https://elsewhere.example"))).status).toBe(403);
    expect(mocks.context).not.toHaveBeenCalled();
    mocks.context.mockResolvedValueOnce({ response: NextResponse.json({}, { status: 401 }) });
    expect((await POST(request({ action: "test", installationId }))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("queues a test for the session community and verifies the installation with the scoped RPC", async () => {
    mocks.context.mockResolvedValue({ context: { community: { id: "own-community" } }, sessionUser: { role: "resident" } });
    mocks.rpc.mockResolvedValueOnce({ data: "own-test", error: null });
    mocks.deliver.mockResolvedValueOnce({ sent: 1, claimed: 1, retrying: false });
    const response = await POST(request({ action: "test", installationId, communityId: "untrusted", authUserId: "someone-else" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "accepted" });
    expect(mocks.rpc).toHaveBeenCalledWith("queue_push_test", {
      p_community: "own-community", p_installation: installationId, p_vapid_key: "test-key",
    });
    expect(mocks.deliver).toHaveBeenCalledWith("own-test");
  });

  it("rejects a test targeted at a device outside the caller's registration", async () => {
    mocks.context.mockResolvedValue({ context: { community: { id: "own-community" } }, sessionUser: { role: "resident" } });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "22023" } });
    expect((await POST(request({ action: "test", installationId }))).status).toBe(409);
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("requires the worker secret before draining the common queue", async () => {
    const secret = "a".repeat(40);
    vi.stubEnv("PUSH_WORKER_SECRET", secret);
    try {
      expect((await worker(request({}))).status).toBe(401);
      expect(mocks.deliver).not.toHaveBeenCalled();
      mocks.deliver.mockResolvedValueOnce({ sent: 0, claimed: 0 });
      const authorized = new NextRequest(origin + "/api/push/worker", {
        method: "POST", headers: { authorization: "Bearer " + secret },
      });
      expect((await worker(authorized)).status).toBe(200);
      expect(mocks.deliver).toHaveBeenCalledWith();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
