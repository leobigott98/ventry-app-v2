"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function TeamMemberActions({
  memberId,
  isActive,
}: {
  memberId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function updateStatus(nextIsActive: boolean) {
    setError(null);
    setIsSubmitting(true);
    const response = await fetch(`/api/access/team-members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: nextIsActive }),
    });
    const payload = (await response.json()) as { error?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "No fue posible actualizar el acceso.");
      return;
    }

    router.refresh();
  }

  async function deleteMember() {
    if (!window.confirm("Eliminar este acceso del equipo?")) {
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const response = await fetch(`/api/access/team-members/${memberId}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as { error?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "No fue posible eliminar el acceso.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          disabled={isSubmitting}
          type="button"
          variant={isActive ? "outline" : "default"}
          onClick={() => void updateStatus(!isActive)}
        >
          {isActive ? "Desactivar" : "Activar"}
        </Button>
        <Button disabled={isSubmitting} type="button" variant="ghost" onClick={() => void deleteMember()}>
          <Trash2 className="h-4 w-4" />
          Eliminar
        </Button>
      </div>
      {error ? <div className="text-sm text-danger">{error}</div> : null}
    </div>
  );
}
