"use client";

import { Copy, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

 type ShareInvitationActionsProps = {
  invitationId: string;
  shareText: string;
  mode?: "all" | "whatsapp" | "secondary";
};

export function ShareInvitationActions({
  invitationId,
  mode = "all",
  shareText,
}: ShareInvitationActionsProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [hasNativeShare, setHasNativeShare] = useState(false);

  useEffect(() => {
    setHasNativeShare(typeof navigator.share === "function");
  }, []);

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
        {mode !== "secondary" ? <Button className={mode === "whatsapp" ? "h-14 w-full rounded-2xl bg-[#21cf70] text-base text-white shadow-[0_8px_18px_rgba(5,150,105,0.24)] hover:bg-[#19bd63]" : undefined} disabled={isSharing} type="button" onClick={handleWhatsAppShare}>
          <Share2 className="h-4 w-4" />
          {mode === "whatsapp" ? "Compartir por WhatsApp" : "WhatsApp"}
        </Button> : null}
        {mode !== "whatsapp" && hasNativeShare ? (
          <Button disabled={isSharing} type="button" variant="outline" onClick={handleNativeShare}>
            <Share2 className="h-4 w-4" />
            Compartir
          </Button>
        ) : null}
        {mode !== "whatsapp" ? <Button disabled={isSharing} type="button" variant="ghost" onClick={handleCopyShare}>
          <Copy className="h-4 w-4" />
          Copiar
        </Button> : null}
      </div>
      {copyMessage ? <div className="text-sm text-muted-foreground">{copyMessage}</div> : null}
    </div>
  );
}
