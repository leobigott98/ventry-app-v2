"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function RevokeInvitationButton({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [isRevoking, setIsRevoking] = useState(false);

  async function handleRevoke() {
    const confirmed = window.confirm(
      "Esta accion revocara la invitacion y ya no podra usarse en la entrada. Continuar?",
    );

    if (!confirmed) {
      return;
    }

    setIsRevoking(true);
    const response = await fetch(`/api/invitations/${invitationId}/revoke`, {
      method: "PATCH",
    });
    setIsRevoking(false);

    if (!response.ok) {
      return;
    }

    router.refresh();
  }

  return (
    <Button disabled={isRevoking} type="button" variant="outline" onClick={handleRevoke}>
      {isRevoking ? "Revocando..." : "Revocar invitacion"}
    </Button>
  );
}

