"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type Confirmation = { id: string; status: "pending" | "approved" | "declined"; expires_at: string };

export function RequestVisitConfirmation({ residentId, visitorName }: { residentId: string; visitorName: string }) {
  const requestKey = useRef<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [expired, setExpired] = useState(false);

  const pendingId = confirmation?.status === "pending" && !expired ? confirmation.id : null;
  const expiry = confirmation?.expires_at;
  useEffect(() => {
    if (!pendingId || !expiry) return;
    const controller = new AbortController();
    let polling = false;
    async function check(id: string, expiresAt: string) {
      if (document.hidden || polling) return;
      polling = true;
      try {
        const result = await fetch("/api/visit-confirmations?" + new URLSearchParams({ id }), {
          cache: "no-store", signal: controller.signal,
        });
        if (!result.ok) throw new Error();
        setConfirmation(await result.json());
        setExpired(Date.parse(expiresAt) <= Date.now());
        setMessage("");
      } catch {
        if (!controller.signal.aborted) setMessage("No se pudo actualizar la respuesta. Ventry volverá a consultarla.");
      } finally {
        polling = false;
      }
    }
    const refresh = () => void check(pendingId, expiry);
    const timer = window.setInterval(refresh, 8000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      controller.abort();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pendingId, expiry]);

  async function requestConfirmation() {
    setBusy(true);
    setMessage("");
    try {
      requestKey.current ??= crypto.randomUUID();
      const response = await fetch("/api/visit-confirmations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ residentId, visitorName, requestKey: requestKey.current }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo solicitar la confirmación.");
      setConfirmation(result);
      setExpired(Date.parse(result.expires_at) <= Date.now());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo solicitar la confirmación.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-2">
    {!confirmation ? <Button type="button" variant="outline" className="min-h-11 w-full"
      disabled={busy || !residentId || visitorName.trim().length < 2}
      onClick={() => void requestConfirmation()}>
      {busy ? "Solicitando…" : "Pedir confirmación en Ventry"}
    </Button> : null}
    {confirmation ? <p role="status" className="text-sm font-semibold">
      {confirmation.status === "approved" ? "El residente confirmó la visita."
        : confirmation.status === "declined" ? "El residente rechazó la visita."
          : expired ? "La solicitud de confirmación venció." : "Esperando la respuesta del residente."}
    </p> : null}
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </div>;
}
