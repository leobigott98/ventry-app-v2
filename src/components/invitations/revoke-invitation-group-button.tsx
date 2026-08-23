"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export function RevokeInvitationGroupButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const pending = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function revoke() {
    if (pending.current || !window.confirm("¿Revocar todas las invitaciones activas de este grupo?")) return;
    pending.current = true; setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/invitation-groups/${groupId}/revoke`, { method: "PATCH" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) { setError(payload.error ?? "No fue posible revocar el grupo."); return; }
      router.refresh();
    } catch { setError("No pudimos conectar con el servicio."); }
    finally { pending.current = false; setLoading(false); }
  }
  return <div><Button className="w-full border-danger/30 text-danger hover:bg-danger/10" disabled={loading} onClick={() => void revoke()} type="button" variant="outline">{loading ? "Revocando…" : "Revocar invitaciones activas"}</Button>{error ? <p className="mt-2 text-sm text-danger" role="alert">{error}</p> : null}</div>;
}
