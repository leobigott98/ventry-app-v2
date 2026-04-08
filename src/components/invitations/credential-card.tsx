import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccessCredentialRecord } from "@/lib/domain/types";

type CredentialCardProps = {
  credential: AccessCredentialRecord | null;
  qrImageDataUrl?: string | null;
};

export function CredentialCard({ credential, qrImageDataUrl }: CredentialCardProps) {
  if (!credential) {
    return null;
  }

  if (credential.credential_type === "pin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>PIN de acceso</CardTitle>
          <CardDescription>
            Comparte este PIN por WhatsApp o leelo en garita para validacion manual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[28px] border border-primary/20 bg-primary/10 px-6 py-8 text-center shadow-[0_0_0_1px_rgba(0,212,255,0.08)]">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              PIN unico
            </div>
            <div className="mt-3 font-mono text-5xl font-semibold tracking-[0.35em] text-foreground">
              {credential.credential_value}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>QR de acceso</CardTitle>
        <CardDescription>
          Muestra este QR al llegar a la entrada. El guardia podra validarlo rapidamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="mx-auto flex w-full max-w-sm justify-center rounded-[28px] border border-border bg-white p-5">
          {qrImageDataUrl ? (
            <img
              alt="QR de acceso"
              className="h-[280px] w-[280px]"
              src={qrImageDataUrl}
            />
          ) : (
            <div className="flex h-[280px] w-[280px] items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
              QR pendiente de generacion
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-secondary p-4 text-sm text-muted-foreground">
          Codigo interno: <span className="font-mono text-foreground">{credential.credential_value}</span>
        </div>
      </CardContent>
    </Card>
  );
}
