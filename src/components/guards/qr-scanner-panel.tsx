"use client";

import { Camera, CameraOff, LoaderCircle, QrCode } from "lucide-react";

import { useQrScanner } from "@/components/guards/hooks/use-qr-scanner";
import { Button } from "@/components/ui/button";

export function QrScannerPanel({
  disabled,
  onDetected,
}: {
  disabled: boolean;
  onDetected: (credential: string) => void;
}) {
  const scanner = useQrScanner(onDetected);
  const active = scanner.status === "active";
  const starting = scanner.status === "starting";

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border-2 border-dashed border-primary/25 bg-foreground">
        <div className="relative aspect-[4/3] min-h-64 sm:aspect-video">
          <video
            ref={scanner.videoRef}
            aria-label="Cámara para escanear QR"
            autoPlay
            className="h-full w-full object-cover"
            muted
            playsInline
          />
          {!active ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-foreground px-6 text-center text-background">
              {starting ? (
                <LoaderCircle aria-hidden="true" className="h-10 w-10 animate-spin" />
              ) : scanner.status === "error" || scanner.status === "unsupported" || scanner.status === "denied" ? (
                <CameraOff aria-hidden="true" className="h-10 w-10" />
              ) : (
                <QrCode aria-hidden="true" className="h-12 w-12" />
              )}
              <p className="max-w-md text-sm font-semibold leading-6">{scanner.message}</p>
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
              <div className="h-full max-h-64 w-full max-w-64 rounded-2xl border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.4)]" />
              <span className="absolute bottom-4 rounded-full bg-black/65 px-4 py-2 text-xs font-bold text-white">
                {scanner.message}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          className="h-14 text-base"
          disabled={disabled || starting}
          onClick={() => void scanner.start()}
          type="button"
        >
          {starting ? <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" /> : <Camera aria-hidden="true" className="h-5 w-5" />}
          {active ? "Reiniciar" : "Abrir cámara"}
        </Button>
        <Button
          className="h-14 text-base"
          disabled={!active && !starting}
          onClick={() => scanner.stop()}
          type="button"
          variant="outline"
        >
          <CameraOff aria-hidden="true" className="h-5 w-5" />
          Detener
        </Button>
      </div>

      {scanner.lastScannedValue ? (
        <p className="rounded-xl border border-primary/20 bg-secondary p-3 text-sm font-semibold text-primary" role="status">
          QR leído y enviado para validación.
        </p>
      ) : null}
    </div>
  );
}
