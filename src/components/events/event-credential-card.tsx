import { Copy, QrCode, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EventCredentialRecord } from "@/lib/domain/types";

export function EventCredentialCard({
  credential,
  qrImageDataUrl,
}: {
  credential: EventCredentialRecord | null;
  qrImageDataUrl?: string | null;
}) {
  if (!credential) return null;

  return (
    <Card className="overflow-hidden border-primary/25">
      <div className="h-1 bg-gradient-to-r from-primary via-cyan-300 to-success" />
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {credential.credential_type === "qr" ? <QrCode className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div>
            <CardTitle>
              {credential.credential_type === "qr" ? "QR compartido del evento" : "PIN compartido del evento"}
            </CardTitle>
            <CardDescription>
              El mismo acceso sirve para todas las personas de la lista durante el horario del evento.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {credential.credential_type === "qr" ? (
          <div className="mx-auto flex w-full max-w-sm justify-center rounded-[28px] border border-border bg-white p-5">
            {qrImageDataUrl ? (
              <img alt="QR compartido del evento" className="h-[280px] w-[280px]" src={qrImageDataUrl} />
            ) : (
              <div className="flex h-[280px] w-[280px] items-center justify-center text-sm text-slate-500">
                QR pendiente
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[28px] border border-primary/20 bg-primary/10 px-4 py-8 text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              PIN del evento
            </div>
            <div className="mt-3 font-mono text-4xl font-semibold tracking-[0.25em] text-foreground sm:text-5xl">
              {credential.credential_value}
            </div>
          </div>
        )}
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-secondary/60 p-4 text-sm text-muted-foreground">
          <Copy className="h-4 w-4 shrink-0" />
          Comparte el enlace de arriba: incluye este codigo y los datos del evento.
        </div>
      </CardContent>
    </Card>
  );
}
