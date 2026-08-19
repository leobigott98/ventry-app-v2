"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function RevokeInvitationButton({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke() {
    const confirmed = window.confirm(
      "Esta accion revocara la invitacion y ya no podra usarse en la entrada. Continuar?",
    );

    if (!confirmed) {
      return;
    }

    setIsRevoking(true);
    setError(null);
    try {
      const response = await fetch(`/api/invitations/${invitationId}/revoke`, { method: "PATCH" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) { setError(payload.error ?? "No fue posible revocar la invitación."); return; }
      router.refresh();
    } catch {
      setError("No pudimos conectar. Inténtalo de nuevo.");
    } finally { setIsRevoking(false); }
  }

  return (
    <div className="space-y-2"><Button disabled={isRevoking} type="button" variant="outline" onClick={handleRevoke}>{isRevoking ? "Revocando…" : error ? "Reintentar revocación" : "Revocar invitación"}</Button>{error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}</div>
  );
}
