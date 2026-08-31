"use client";

import { Star } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { Input } from "@/components/ui/input";
import { formatPhoneForDisplay } from "@/lib/contacts/phone";
import type { ResidentContactViewModel } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}

export function ContactAutocomplete({
  ariaLabel,
  className,
  enabled = true,
  id,
  onChange,
  onEnter,
  onSelect,
  placeholder,
  value,
}: {
  ariaLabel?: string;
  className?: string;
  enabled?: boolean;
  id: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  onSelect: (contact: ResidentContactViewModel) => string | null | undefined;
  placeholder?: string;
  value: string;
}) {
  const generatedId = useId();
  const listboxId = `${id}-${generatedId.replace(/:/g, "")}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ResidentContactViewModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (!enabled || !started || !open || !query) {
      setLoading(false);
      if (!query) { setItems([]); setError(null); }
      return;
    }
    const controller = new AbortController();
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/contacts/suggestions?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const payload = await response.json() as { error?: string; items?: ResidentContactViewModel[] };
        if (requestId !== requestRef.current) return;
        if (!response.ok) throw new Error(payload.error);
        setItems((payload.items ?? []).slice(0, 5));
        setActiveIndex(-1);
      } catch {
        if (controller.signal.aborted || requestId !== requestRef.current) return;
        setItems([]);
        setError("No pudimos buscar contactos. Puedes continuar escribiendo.");
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [enabled, open, started, value]);

  function choose(contact: ResidentContactViewModel) {
    const message = onSelect(contact);
    if (message) { setSelectionError(message); return; }
    setSelectionError(null);
    setOpen(false);
    setActiveIndex(-1);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setOpen(false); setActiveIndex(-1); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!enabled || !value.trim()) return;
      event.preventDefault();
      setOpen(true);
      if (!items.length) return;
      setActiveIndex((current) => event.key === "ArrowDown"
        ? (current + 1) % items.length
        : (current <= 0 ? items.length - 1 : current - 1));
      return;
    }
    if (event.key === "Enter") {
      if (open && activeIndex >= 0 && items[activeIndex]) {
        event.preventDefault();
        choose(items[activeIndex]);
      } else if (onEnter) {
        event.preventDefault();
        onEnter();
      }
    }
  }

  const showPanel = enabled && open && Boolean(value.trim());
  const activeId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;
  return <div className="relative min-w-0 max-w-full" ref={rootRef}>
    <Input
      aria-activedescendant={activeId}
      aria-autocomplete="list"
      aria-controls={listboxId}
      aria-expanded={showPanel}
      aria-label={ariaLabel}
      autoComplete="off"
      className={className}
      id={id}
      onChange={(event) => {
        onChange(event.target.value);
        setStarted(true);
        setOpen(Boolean(event.target.value.trim()));
        setSelectionError(null);
      }}
      onFocus={() => { if (started && value.trim()) setOpen(true); }}
      onKeyDown={keyDown}
      placeholder={placeholder}
      role="combobox"
      value={value}
    />
    {showPanel ? <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-[65] max-h-64 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface p-1.5 shadow-[0_18px_45px_rgba(7,16,31,0.18)]" id={listboxId} role="listbox">
      {loading ? <div className="px-3 py-3 text-sm text-muted-foreground" role="status">Buscando contactos…</div> : null}
      {!loading && error ? <div className="px-3 py-3 text-sm text-danger" role="status">{error}</div> : null}
      {!loading && !error && items.length === 0 ? <div className="px-3 py-3 text-sm text-muted-foreground" role="status">No encontramos contactos. Puedes continuar con este nombre.</div> : null}
      {!loading && !error ? items.map((contact, index) => <div
        aria-selected={activeIndex === index}
        className={cn("flex min-h-16 cursor-pointer items-center gap-3 rounded-xl px-3 py-2", activeIndex === index ? "bg-secondary" : "hover:bg-muted")}
        id={`${listboxId}-option-${index}`}
        key={contact.stableId}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(contact)}
        role="option"
      >
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-primary">{initials(contact.name)}</span>
        <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><span className="block truncate font-semibold">{contact.name}</span>{contact.isFavorite ? <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" /> : null}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{[contact.relationshipLabel, contact.phone ? formatPhoneForDisplay(contact.phone) : null].filter(Boolean).join(" · ") || "Sin teléfono"}</span></span>
      </div>) : null}
      {selectionError ? <div className="px-3 py-2 text-sm font-medium text-danger" role="alert">{selectionError}</div> : null}
    </div> : null}
  </div>;
}
