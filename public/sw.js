/* global self, caches, fetch, URL, Response, Request */

const shellCache = "ventry-public-shell-v1";
const shellFiles = ["/pwa/offline.html", "/pwa/offline.js", "/pwa/icon-192.png"];
const notificationId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const icon = "/pwa/icon-192.png";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(shellCache).then((cache) => cache.addAll(
    shellFiles.map((url) => new Request(url, { cache: "reload", credentials: "omit" })),
  )));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith("ventry-public-shell-") && key !== shellCache)
    .map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "VENTRY_UPDATE") event.waitUntil(self.skipWaiting());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (shellFiles.includes(url.pathname) && !url.search) {
    event.respondWith(caches.open(shellCache).then(async (cache) => (await cache.match(request)) ?? fetch(request)));
    return;
  }
  // Only the public shell is cached. Navigation remains network-first, including sign-in and deep links.
  if (request.mode === "navigate" && !url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(async () => (
      (await caches.open(shellCache)).match("/pwa/offline.html")
    )).then((response) => response ?? Response.error()));
  }
});

self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data?.json();
  } catch {
    payload = null;
  }
  if (!payload || !notificationId.test(payload.id) || typeof payload.title !== "string" || typeof payload.body !== "string") {
    event.waitUntil(self.registration.showNotification("Ventry", {
      body: "Consulta tus avisos en Ventry.", icon, tag: "ventry", data: { path: "/app/notifications" },
    }));
    return;
  }
  const path = "/app/notifications/" + payload.id;
  const options = {
    body: payload.body,
    icon,
    tag: "ventry-" + payload.id,
    renotify: false,
    data: { path },
    actions: [{ action: "open", title: payload.action === "review" ? "Revisar" : "Abrir" }],
    ...(payload.action === "call" ? { vibrate: [200, 100, 200] } : {}),
  };
  event.waitUntil(self.registration.showNotification(payload.title, options).catch(() => {
    delete options.actions;
    delete options.vibrate;
    return self.registration.showNotification(payload.title, options);
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.path;
  const allowed = typeof path === "string" && (
    path === "/app/notifications" ||
    (path.startsWith("/app/notifications/") && notificationId.test(path.slice("/app/notifications/".length)))
  );
  const target = new URL(allowed ? path : "/app/notifications", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const exact = windows.find((client) => client.url === target);
    if (exact) return exact.focus();
    const app = windows.find((client) => {
      const url = new URL(client.url);
      return url.origin === self.location.origin && (url.pathname === "/app" || url.pathname.startsWith("/app/"));
    });
    if (app) {
      const navigated = await app.navigate(target).catch(() => null);
      if (navigated) return navigated.focus();
    }
    return self.clients.openWindow(target);
  })());
});
