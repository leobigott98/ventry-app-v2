"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export function ServiceWorkerRegistration() {
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  const reload = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    const workers = navigator.serviceWorker;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    let cancelled = false;
    const watchWorker = () => {
      if (registration?.waiting && workers.controller) setUpdate(registration.waiting);
    };
    const watchInstallation = () => {
      installing?.removeEventListener("statechange", watchWorker);
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", watchWorker);
    };
    const checkUpdate = () => {
      if (!document.hidden) void registration?.update().catch(() => undefined);
    };
    const onControllerChange = () => {
      setUpdate(null);
      if (reload.current) window.location.reload();
    };
    workers.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", checkUpdate);
    void workers.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((registered) => {
      if (cancelled) return;
      registration = registered;
      watchWorker();
      watchInstallation();
      registration.addEventListener("updatefound", watchInstallation);
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      installing?.removeEventListener("statechange", watchWorker);
      registration?.removeEventListener("updatefound", watchInstallation);
      workers.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", checkUpdate);
    };
  }, []);

  if (!update) return null;
  return (
    <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[80] mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl bg-surface p-3 shadow-elevated">
      <p className="text-sm">Hay una actualización de Ventry.</p>
      <Button onClick={() => {
        reload.current = true;
        update.postMessage({ type: "VENTRY_UPDATE" });
      }} type="button">Actualizar</Button>
    </div>
  );
}
