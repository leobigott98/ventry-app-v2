"use client";

import { Copy, Share2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

 type ShareInvitationActionsProps = {
  invitationId: string;
  shareText: string;
};

export function ShareInvitationActions({
  invitationId,
  shareText,
}: ShareInvitationActionsProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  async function logShare(channel: "whatsapp" | "native") {
    await fetch(`/api/invitations/${invitationId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel }),
    });
  }

  async function handleNativeShare() {
    if (!navigator.share) {
      return;
    }

    setIsSharing(true);
    try {
      await navigator.share({
        text: shareText,
      });
      await logShare("native");
    } catch {
      // Ignore user cancellation.
    } finally {
      setIsSharing(false);
    }
  }

  async function handleWhatsAppShare() {
    setIsSharing(true);
    await logShare("whatsapp");
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setIsSharing(false);
  }

  async function handleCopyShare() {
    setCopyMessage(null);
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyMessage("Enlace copiado.");
    } catch {
      setCopyMessage("No fue posible copiar automaticamente.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button disabled={isSharing} type="button" onClick={handleWhatsAppShare}>
          <Share2 className="h-4 w-4" />
          WhatsApp
        </Button>
        {typeof navigator !== "undefined" && "share" in navigator ? (
          <Button disabled={isSharing} type="button" variant="outline" onClick={handleNativeShare}>
            <Share2 className="h-4 w-4" />
            Compartir
          </Button>
        ) : null}
        <Button disabled={isSharing} type="button" variant="ghost" onClick={handleCopyShare}>
          <Copy className="h-4 w-4" />
          Copiar
        </Button>
      </div>
      {copyMessage ? <div className="text-sm text-muted-foreground">{copyMessage}</div> : null}
    </div>
  );
}
