"use client";

import Link from "next/link";
import { Bell, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ResidentNotification = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

export function NotificationSheet({ notifications }: { notifications: ResidentNotification[] }) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Abrir notificaciones"
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-white transition hover:bg-white/10"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Bell className="h-6 w-6" />
        {notifications.length > 0 ? <span aria-hidden="true" className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-primary bg-[#ff5263]" /> : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/35 sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section aria-label="Notificaciones" aria-modal="true" className="max-h-[78dvh] w-full max-w-lg overflow-y-auto rounded-t-[1.5rem] bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-5 shadow-elevated sm:rounded-[1.5rem]" role="dialog">
            <div className="flex items-center justify-between gap-4">
              <div><h2 className="text-xl font-bold">Notificaciones</h2><p className="mt-1 text-sm text-muted-foreground">Accesos que requieren tu atención.</p></div>
              <button ref={closeButtonRef} aria-label="Cerrar notificaciones" className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground" onClick={() => setOpen(false)} type="button"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-5 divide-y divide-border">
              {notifications.length > 0 ? notifications.map((notification) => (
                <Link key={notification.id} className="flex min-h-20 items-center justify-between gap-3 py-4" href={notification.href} onClick={() => setOpen(false)}>
                  <span><span className="block font-semibold">{notification.title}</span><span className="mt-1 block text-sm text-muted-foreground">{notification.detail}</span></span><ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </Link>
              )) : <div className="py-10 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary"><Bell className="h-6 w-6" /></span><p className="mt-4 font-semibold">Todo está al día</p><p className="mt-2 text-sm text-muted-foreground">No hay invitaciones activas o programadas que mostrar.</p></div>}
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">El punto rojo indica accesos vigentes o programados; no representa mensajes sin leer.</p>
          </section>
        </div>
      ) : null}
    </>
  );
}
