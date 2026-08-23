"use client";

import { Copy, ExternalLink, Search, Send, Share2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EventGuestCredentialRecord, EventGuestRecord } from "@/lib/domain/types";

type GuestItem = { guest: EventGuestRecord; credential: EventGuestCredentialRecord | null; shareText: string | null; shareUrl: string | null };

export function EventGuestList({ eventId, items }: { eventId: string; items: GuestItem[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | EventGuestRecord["attendance_status"]>("all");
  const [shared, setShared] = useState(() => new Set(items.filter((item) => item.guest.credential_shared_at).map((item) => item.guest.id)));
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filtered = useMemo(() => items.filter(({ guest }) => (status === "all" || guest.attendance_status === status) && guest.full_name.toLocaleLowerCase("es-VE").includes(query.trim().toLocaleLowerCase("es-VE"))), [items, query, status]);

  async function mark(guestId: string, channel: "whatsapp" | "native" | "copy") {
    const response = await fetch(`/api/events/${eventId}/guests/${guestId}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel }) });
    if (!response.ok) throw new Error("share-log-failed");
    setShared((current) => new Set(current).add(guestId));
  }
  async function share(item: GuestItem, channel: "whatsapp" | "native" | "copy") {
    if (!item.shareText || pending) return;
    setPending(item.guest.id); setError(null);
    try {
      if (channel === "whatsapp") window.open(`https://wa.me/?text=${encodeURIComponent(item.shareText)}`, "_blank", "noopener,noreferrer");
      else if (channel === "native" && navigator.share) await navigator.share({ text: item.shareText, title: `Acceso para ${item.guest.full_name}` });
      else await navigator.clipboard.writeText(item.shareText);
      await mark(item.guest.id, channel === "native" && !navigator.share ? "copy" : channel);
    } catch { setError("La accion se abrio, pero no pudimos confirmar el registro. Reintenta si es necesario."); } finally { setPending(null); }
  }

  return <div className="space-y-4">
    <div className="grid gap-2 sm:grid-cols-[1fr_12rem]"><label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">Buscar invitado</span><input className="h-12 w-full rounded-xl border border-border bg-surface pl-10 pr-3 text-base" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar invitado" value={query} /></label><select aria-label="Filtrar estado" className="h-12 rounded-xl border border-border bg-surface px-3 text-base" onChange={(event) => setStatus(event.target.value as typeof status)} value={status}><option value="all">Todos</option><option value="pending">Pendientes</option><option value="inside">Dentro</option><option value="exited">Salieron</option></select></div>
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline">{items.filter((item) => item.guest.attendance_status === "pending").length} pendientes</Badge><Badge variant="outline">{shared.size} de {items.length} compartidas</Badge>{items.some((item) => item.guest.attendance_status === "pending") ? <button className="min-h-11 font-semibold text-primary" onClick={() => setStatus("pending")} type="button">Compartir pendientes</button> : null}</div>{error?<p className="text-sm text-danger" role="alert">{error}</p>:null}
    <div className="space-y-2">{filtered.map((item) => <article className="rounded-2xl border border-border bg-secondary/25 p-3" key={item.guest.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold">{item.guest.full_name}</h3><p className="mt-1 text-xs text-muted-foreground">{item.guest.phone || "Sin telefono"}{item.guest.allows_companions ? ` · hasta ${item.guest.max_companions} acompanantes` : " · sin acompanantes"}</p></div><Badge variant={item.guest.attendance_status === "pending" ? "outline" : item.guest.attendance_status === "inside" ? "warning" : "success"}>{item.guest.attendance_status === "pending" ? "Pendiente" : item.guest.attendance_status === "inside" ? "Dentro" : "Salio"}</Badge></div>
      {shared.has(item.guest.id) ? <p className="mt-2 text-xs font-semibold text-success">Credencial ya compartida</p> : null}{item.credential && item.shareUrl ? <div className="mt-3 grid grid-cols-4 gap-2"><Button aria-label={`Compartir ${item.guest.full_name} por WhatsApp`} disabled={pending === item.guest.id} onClick={() => void share(item,"whatsapp")} size="icon" type="button"><Send className="h-4 w-4" /></Button><Button aria-label={`Compartir ${item.guest.full_name}`} disabled={pending === item.guest.id} onClick={() => void share(item,"native")} size="icon" type="button" variant="outline"><Share2 className="h-4 w-4" /></Button><Button aria-label={`Copiar acceso de ${item.guest.full_name}`} disabled={pending === item.guest.id} onClick={() => void share(item,"copy")} size="icon" type="button" variant="outline"><Copy className="h-4 w-4" /></Button><Button asChild aria-label={`Ver acceso de ${item.guest.full_name}`} size="icon" variant="outline"><Link href={item.shareUrl} target="_blank"><ExternalLink className="h-4 w-4" /></Link></Button></div> : <p className="mt-3 text-xs text-muted-foreground">Usa la credencial compartida de este evento.</p>}
    </article>)}{!filtered.length ? <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No hay invitados con estos filtros.</p> : null}</div>
  </div>;
}
