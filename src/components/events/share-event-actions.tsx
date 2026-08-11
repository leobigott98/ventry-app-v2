"use client";

import { Copy, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function ShareEventActions({
  eventId,
  shareText,
}: {
  eventId: string;
  shareText: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function log(channel: "whatsapp" | "native" | "copy") {
    await fetch(`/api/events/${eventId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel }),
    });
  }

  async function whatsapp() {
    setBusy(true);
    await log("whatsapp");
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
    setBusy(false);
  }

  async function nativeShare() {
    if (!navigator.share) return;
    setBusy(true);
    try {
      await navigator.share({ text: shareText });
      await log("native");
    } catch {
      // Native share was dismissed.
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText);
      await log("copy");
      setMessage("Acceso copiado. Ya puedes pegarlo donde quieras.");
    } catch {
      setMessage("No fue posible copiar automaticamente.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:flex">
        <Button className="h-12" disabled={busy} type="button" onClick={() => void whatsapp()}>
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </Button>
        {typeof navigator !== "undefined" && "share" in navigator ? (
          <Button className="h-12" disabled={busy} type="button" variant="outline" onClick={() => void nativeShare()}>
            <Share2 className="h-4 w-4" /> Compartir
          </Button>
        ) : null}
        <Button className="col-span-2 h-12" disabled={busy} type="button" variant="ghost" onClick={() => void copy()}>
          <Copy className="h-4 w-4" /> Copiar acceso
        </Button>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
