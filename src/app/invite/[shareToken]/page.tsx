import QRCode from "qrcode";
import { notFound } from "next/navigation";

import { CredentialCard } from "@/components/invitations/credential-card";
import { InvitationStatusBadge } from "@/components/invitations/invitation-status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getInvitationAccessTypeLabel,
  getInvitationByShareToken,
  getInvitationEffectiveStatus,
  getInvitationWindowLabel,
} from "@/lib/domain/invitations";

export default async function SharedInvitationPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const invitation = await getInvitationByShareToken(shareToken);

  if (!invitation) {
    notFound();
  }

  if (invitation.status === "credential_revoked") {
    return <main className="mx-auto flex min-h-[100dvh] max-w-xl items-center px-4 py-8"><Card><CardHeader><CardTitle>Credencial regenerada</CardTitle><CardDescription>Este enlace ya no contiene una credencial válida. Solicita al anfitrión el enlace actualizado.</CardDescription></CardHeader></Card></main>;
  }

  const status = getInvitationEffectiveStatus(invitation);
  const credential = invitation.access_credentials;
  const qrImageDataUrl =
    credential?.credential_type === "qr" && credential.qr_payload
      ? await QRCode.toDataURL(credential.qr_payload, {
          margin: 1,
          width: 320,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        })
      : null;

  return (
    <main className="mx-auto min-h-[100dvh] max-w-3xl px-4 py-8 md:px-6">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{invitation.visitor_name || "Acceso Ventry"}</CardTitle>
                <CardDescription>
                  {getInvitationWindowLabel(invitation)}
                </CardDescription>
              </div>
              <InvitationStatusBadge status={status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {invitation.group_size ? <div className="rounded-xl bg-secondary p-3 text-foreground">Esta es tu credencial individual dentro de una invitacion para {invitation.group_size} personas{invitation.group_position ? ` · acceso ${invitation.group_position} de ${invitation.group_size}` : ""}. No se muestran datos de las demas personas.</div> : null}
            <div>
              Residente: <span className="text-foreground">{invitation.residents?.full_name || "Sin residente"}</span>
            </div>
            <div>
              Unidad:{" "}
              <span className="text-foreground">
                {invitation.units
                  ? `${invitation.units.building ? `${invitation.units.building} - ` : ""}${invitation.units.identifier}`
                  : "Sin unidad"}
              </span>
            </div>
            <div>
              Tipo de acceso: <span className="text-foreground">{getInvitationAccessTypeLabel(invitation.access_type)}</span>
            </div>
          </CardContent>
        </Card>

        <CredentialCard credential={credential} qrImageDataUrl={qrImageDataUrl} />
      </div>
    </main>
  );
}
