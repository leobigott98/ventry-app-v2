"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function VisitDecision({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function decide(decision: "approved" | "declined") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/visit-confirmations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || "No pudimos registrar tu respuesta.");
      }
      setMessage("Tu respuesta está disponible para la garita.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos registrar tu respuesta.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy} type="button" onClick={() => void decide("approved")}>Confirmar visita</Button>
      <Button disabled={busy} type="button" variant="outline" onClick={() => void decide("declined")}>Rechazar visita</Button>
    </div>
    <p role="status" className="text-sm">{message}</p>
  </div>;
}
