"use client";

import { Ban } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function RevokeEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function revoke() {
    setBusy(true);
    const response = await fetch(`/api/events/${eventId}/revoke`, { method: "POST" });
    setBusy(false);
    if (response.ok) router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-danger/25 bg-danger/10 p-3 sm:flex-row">
        <Button disabled={busy} type="button" onClick={() => void revoke()}>
          {busy ? "Cancelando..." : "Si, cancelar evento"}
        </Button>
        <Button disabled={busy} type="button" variant="ghost" onClick={() => setConfirming(false)}>
          Volver
        </Button>
      </div>
    );
  }

  return (
    <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
      <Ban className="h-4 w-4" /> Cancelar evento
    </Button>
  );
}
