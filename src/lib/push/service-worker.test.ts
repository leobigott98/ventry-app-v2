// @vitest-environment node
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker() {
  const handlers = new Map<string, (event: object) => void>();
  const show = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const matchAll = vi.fn().mockResolvedValue([]);
  const assets = { addAll: vi.fn().mockResolvedValue(undefined), match: vi.fn().mockResolvedValue(new Response("Offline")) };
  const fetch = vi.fn().mockRejectedValue(new Error("offline"));
  const self = {
    location: { origin: "https://ventry.example" },
    clients: { matchAll, openWindow },
    registration: { showNotification: show },
    addEventListener: (name: string, handler: (event: object) => void) => { handlers.set(name, handler); },
  };
  class WorkerRequest extends Request {
    constructor(path: string, options: RequestInit) { super(self.location.origin + path, options); }
  }
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self, URL, fetch, Response, Request: WorkerRequest,
    caches: { open: vi.fn().mockResolvedValue(assets) },
  });

  async function dispatch(type: string, data: object = {}) {
    let done: Promise<unknown> | undefined;
    const wait = (promise: Promise<unknown>) => { done = promise; };
    handlers.get(type)?.({ ...data, waitUntil: wait, respondWith: wait });
    return done;
  }
  return { dispatch, show, openWindow, matchAll, assets, fetch };
}

const id = "b5144a87-171f-4171-a477-d9165d65036d";

describe("Ventry service worker", () => {
  it("precaches public shell assets and only falls back on failed navigation", async () => {
    const { dispatch, assets, fetch } = worker();
    await dispatch("install");
    const requests = assets.addAll.mock.calls[0][0] as Request[];
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/pwa/offline.html", "/pwa/offline.js", "/pwa/icon-192.png",
    ]);
    expect(requests.every((request) => request.credentials === "omit")).toBe(true);

    const html = await dispatch("fetch", { request: { method: "GET", mode: "navigate", url: "https://ventry.example/app/notifications" } });
    if (!(html instanceof Response)) throw new Error("Expected an offline response");
    expect(await html.text()).toBe("Offline");
    expect(await dispatch("fetch", { request: { method: "GET", mode: "cors", url: "https://ventry.example/api/push" } })).toBeUndefined();
    expect(await dispatch("fetch", { request: { method: "POST", mode: "navigate", url: "https://ventry.example/app" } })).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reuses the tag and retries without actions where unsupported", async () => {
    const { dispatch, show } = worker();
    show.mockRejectedValueOnce(new Error("actions unsupported"));
    const data = { json: () => ({ id, title: "Ventry", body: "Consulta el aviso", action: "call" }) };
    await dispatch("push", { data });
    await dispatch("push", { data });
    expect(show.mock.calls.map(([, options]) => options.tag)).toEqual(Array(3).fill("ventry-" + id));
    expect(show).toHaveBeenNthCalledWith(2, "Ventry", {
      body: "Consulta el aviso", icon: "/pwa/icon-192.png", tag: "ventry-" + id, renotify: false,
      data: { path: "/app/notifications/" + id },
    });
    expect(show.mock.calls[2][1].vibrate).toEqual([200, 100, 200]);
  });

  it("focuses an open deep link and discards an external click destination", async () => {
    const { dispatch, openWindow, matchAll } = worker();
    const focus = vi.fn();
    const close = vi.fn();
    matchAll.mockResolvedValueOnce([{ url: "https://ventry.example/app/notifications/" + id, focus }]);
    await dispatch("notificationclick", { notification: { close, data: { path: "/app/notifications/" + id } } });
    expect(focus).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();

    await dispatch("notificationclick", { notification: { close, data: { path: "//external.example" } } });
    expect(openWindow).toHaveBeenCalledWith("https://ventry.example/app/notifications");
  });
});
