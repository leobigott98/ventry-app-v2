import { GuardWorkspace } from "@/components/guards/guard-workspace";
import { SectionShell } from "@/components/layout/section-shell";
import { getResidentsForCommunity } from "@/lib/domain/community";
import {
  getOpenEntriesForCommunity,
  getRecentAccessEvents,
  getRecentGuardInvitations,
} from "@/lib/domain/guards";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function GuardsPage() {
  const { context } = await getCommunityContextOrRedirect({ allowedRoles: ["admin", "guard"] });
  const [residents, recentInvitations, openEntries, recentEvents] = await Promise.all([
    getResidentsForCommunity(context.community.id),
    getRecentGuardInvitations(context.community.id),
    getOpenEntriesForCommunity(context.community.id),
    getRecentAccessEvents(context.community.id),
  ]);

  return (
    <SectionShell
      eyebrow="Operacion de garita"
      title="Validacion y registro de acceso"
      description="Pantalla pensada para turnos reales de porteria: validar rapido, registrar lo minimo y mantener la trazabilidad clara para cada entrada y salida."
    >
      <GuardWorkspace
        openEntries={openEntries}
        recentEvents={recentEvents}
        recentInvitations={recentInvitations}
        residents={residents.filter((resident) => resident.is_active)}
      />
    </SectionShell>
  );
}
