"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function ResponsiveDialog({ children, description, onClose, title, wide = false }: { children: ReactNode; description?: string; onClose: () => void; title: string; wide?: boolean }) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    const initial = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0];
    initial?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = originalOverflow; previousFocus?.focus(); };
  }, []);

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#07101f]/55 p-0 backdrop-blur-[2px] md:items-center md:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div aria-describedby={description ? descriptionId : undefined} aria-labelledby={titleId} aria-modal="true" className={cn("flex max-h-[92dvh] w-full flex-col rounded-t-[1.5rem] bg-surface shadow-2xl md:max-h-[88dvh] md:max-w-xl md:rounded-[1.5rem]", wide && "md:max-w-2xl")} ref={panelRef} role="dialog">
      <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-border md:hidden" />
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6"><div><h2 className="text-xl font-extrabold" id={titleId}>{title}</h2>{description ? <p className="mt-1 text-sm leading-5 text-muted-foreground" id={descriptionId}>{description}</p> : null}</div><button aria-label="Cerrar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted" onClick={onClose} type="button"><X className="h-5 w-5" /></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  </div>;
}
