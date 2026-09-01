"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { FormMessage } from "@/components/forms/form-message";
import { ArrivalWindowFields, type ArrivalWindowEditorValue } from "@/components/invitations/arrival-window-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResourceKind = "invitation" | "group" | "event";

function endpoint(kind: ResourceKind, id: string) {
  if (kind === "invitation") return `/api/invitations/${id}`;
  if (kind === "group") return `/api/invitation-groups/${id}`;
  return `/api/events/${id}`;
}

export function LifecycleActions({ kind, resourceId, version, window: initialWindow, canCancel = true }: {
  kind: ResourceKind;
  resourceId: string;
  version: number;
  window: ArrivalWindowEditorValue;
  canCancel?: boolean;
}) {
  const router = useRouter();
  const [duplicateWindow, setDuplicateWindow] = useState(initialWindow);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"cancel" | "duplicate" | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const cancelKey = useRef(crypto.randomUUID());
  const duplicateKey = useRef(crypto.randomUUID());

  async function submit(action: "cancel" | "duplicate") {
    if (busy) return;
    if (action === "cancel" && !window.confirm("¿Confirmas la cancelación? Las credenciales pendientes dejarán de funcionar y el historial se conservará.")) return;
    setBusy(action); setMessage(null);
    const body = action === "cancel"
      ? { expectedVersion: version, idempotencyKey: cancelKey.current, reason: reason || null }
      : { expectedVersion: version, idempotencyKey: duplicateKey.current, ...(kind === "event" ? { eventDate: duplicateWindow.date } : { visitDate: duplicateWindow.date }), arrivalWindowMode: duplicateWindow.arrivalWindowMode, arrivalStart: duplicateWindow.arrivalStart, arrivalEndDate: duplicateWindow.arrivalEndDate, arrivalEnd: duplicateWindow.arrivalEnd, plannedExitDate: duplicateWindow.plannedExitDate, plannedExitTime: duplicateWindow.plannedExitTime };
    try {
      const response = await fetch(`${endpoint(kind, resourceId)}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({})) as { error?: string; redirectTo?: string };
      if (!response.ok) { setMessage({ text: payload.error ?? "No fue posible completar la operación.", error: true }); return; }
      if (payload.redirectTo) router.push(payload.redirectTo); else router.refresh();
    } catch { setMessage({ text: "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.", error: true }); }
    finally { setBusy(null); }
  }

  return <div className="min-w-0 space-y-3">
    <details className="min-w-0 rounded-2xl border border-border bg-surface px-4">
      <summary className="flex min-h-14 cursor-pointer list-none items-center font-bold">Duplicar con otra fecha</summary>
      <div className="min-w-0 space-y-4 border-t border-border py-4">
        <p className="text-sm text-muted-foreground">Se creará un acceso nuevo. Nada se crea hasta que confirmes.</p>
        <ArrivalWindowFields idPrefix={`duplicate-${kind}-${resourceId}`} value={duplicateWindow} onChange={(field, value) => setDuplicateWindow((current) => ({ ...current, [field]: value }))} />
        <Button className="w-full sm:w-auto" disabled={busy !== null} onClick={() => submit("duplicate")} type="button">{busy === "duplicate" ? "Duplicando…" : "Crear duplicado"}</Button>
      </div>
    </details>
    {canCancel ? <details className="rounded-2xl border border-danger/25 bg-surface px-4">
      <summary className="flex min-h-14 cursor-pointer list-none items-center font-bold text-danger">Cancelar acceso</summary>
      <div className="space-y-4 border-t border-border py-4">
        <p className="text-sm text-muted-foreground">Esta acción invalida credenciales pendientes, conserva registros y no cierra entradas ya registradas.</p>
        <div className="space-y-2"><Label htmlFor={`cancel-reason-${resourceId}`}>Motivo opcional</Label><Input id={`cancel-reason-${resourceId}`} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></div>
        <Button className="w-full border-danger/40 text-danger hover:bg-danger/10 sm:w-auto" disabled={busy !== null} onClick={() => submit("cancel")} type="button" variant="outline">{busy === "cancel" ? "Cancelando…" : "Confirmar cancelación"}</Button>
      </div>
    </details> : null}
    <FormMessage message={message?.text ?? null} variant={message?.error ? "error" : "success"} />
  </div>;
}
