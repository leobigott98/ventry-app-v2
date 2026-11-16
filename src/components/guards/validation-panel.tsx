"use client";

import { AlertCircle, Hash, LoaderCircle, QrCode, ShieldCheck } from "lucide-react";

import { AccessResult } from "@/components/guards/access-result";
import type {
  CredentialMode,
  ValidationMatch,
  ValidationState,
} from "@/components/guards/guard-types";
import { QrScannerPanel } from "@/components/guards/qr-scanner-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ValidationPanel({
  credentialValue,
  isPending,
  mode,
  onCredentialChange,
  onEventGuestEntry,
  onExit,
  onInvitationEntry,
  onModeChange,
  onReject,
  onValidate,
  state,
}: {
  credentialValue: string;
  isPending: (key: string) => boolean;
  mode: CredentialMode;
  onCredentialChange: (value: string) => void;
  onEventGuestEntry: (eventId: string, guestId: string, companionCount: number) => void;
  onExit: (entryId: string) => void;
  onInvitationEntry: (invitationId: string) => void;
  onModeChange: (mode: CredentialMode) => void;
  onReject: (match: ValidationMatch) => void;
  onValidate: (mode: CredentialMode, value: string) => Promise<boolean>;
  state: ValidationState;
}) {
  const validating = state.phase === "validating";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onValidate(mode, credentialValue);
  }

  return (
    <Card id="guard-validation" className="overflow-hidden">
      <CardHeader className="border-b border-border bg-surface">
        <CardTitle className="text-xl">PIN o código QR</CardTitle>
        <CardDescription>
          Consulta primero. Sólo registra entrada o salida después de recibir y revisar la respuesta del servidor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-5 sm:pt-6">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1.5" role="tablist" aria-label="Método de validación">
          {([
            { id: "pin" as const, label: "Ingresar PIN", icon: Hash },
            { id: "qr" as const, label: "Escanear QR", icon: QrCode },
          ]).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                aria-selected={mode === item.id}
                disabled={validating}
                className={cn(
                  "flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition-colors",
                  mode === item.id ? "bg-surface text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => onModeChange(item.id)}
                role="tab"
                type="button"
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {mode === "qr" ? (
          <QrScannerPanel
            disabled={validating}
            onDetected={(credential) => void onValidate("qr", credential)}
          />
        ) : null}

        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-2">
            <Label className="flex items-center gap-2" htmlFor="guardCredential">
              {mode === "pin" ? <Hash aria-hidden="true" className="h-4 w-4" /> : <QrCode aria-hidden="true" className="h-4 w-4" />}
              {mode === "pin" ? "PIN del visitante" : "Código QR alternativo"}
            </Label>
            <Input
              id="guardCredential"
              autoComplete={mode === "pin" ? "one-time-code" : "off"}
              className={cn("h-16 text-center text-xl", mode === "pin" && "font-mono tracking-[0.24em]")}
              readOnly={validating}
              inputMode={mode === "pin" ? "numeric" : "text"}
              onChange={(event) => onCredentialChange(event.target.value)}
              placeholder={mode === "pin" ? "000 000" : "Pega el contenido del QR"}
              value={credentialValue}
            />
          </div>
          <Button className="h-14 w-full text-base" disabled={validating} type="submit">
            {validating ? <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" /> : <ShieldCheck aria-hidden="true" className="h-5 w-5" />}
            {validating ? "Consultando servidor…" : mode === "pin" ? "Validar PIN" : "Validar QR"}
          </Button>
        </form>

        <div aria-live="assertive">
          {state.phase !== "idle" ? (
            <div
              className={cn(
                "rounded-xl border p-4 text-sm font-semibold",
                state.phase === "matched" && "border-primary/25 bg-secondary text-primary",
                state.phase === "validating" && "border-border bg-muted text-foreground",
                (state.phase === "error" || state.phase === "not_found") && "border-danger/25 bg-danger/10 text-danger",
              )}
              role={state.phase === "error" || state.phase === "not_found" ? "alert" : "status"}
            >
              <p className="flex items-start gap-2">
                {state.phase === "error" || state.phase === "not_found" ? <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : null}
                <span>{state.message}</span>
              </p>
              {state.phase === "error" || state.phase === "not_found" ? (
                <p className="mt-2 font-extrabold uppercase tracking-wide">No autorizar acceso.</p>
              ) : null}
              {state.attemptRef ? <p className="mt-2 font-mono text-xs">Referencia: {state.attemptRef}</p> : null}
            </div>
          ) : null}
        </div>

        {state.match ? (
          <AccessResult
            isPending={isPending}
            match={state.match}
            onEventGuestEntry={onEventGuestEntry}
            onExit={onExit}
            onInvitationEntry={onInvitationEntry}
            onReject={onReject}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
