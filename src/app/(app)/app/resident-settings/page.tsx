import Link from "next/link";
import { CalendarDays, Mail, UserRound } from "lucide-react";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { ResidentPageHeader } from "@/components/resident/resident-header";
import { getResidentById, getUnitById } from "@/lib/domain/community";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function ResidentSettingsPage() {
  const { context, sessionUser } = await getCommunityContextOrRedirect({ allowedRoles: ["resident"] });
  if (!sessionUser.residentId) redirect("/app");
  const resident = await getResidentById(context.community.id, sessionUser.residentId);
  const unit = resident?.unit_id ? await getUnitById(context.community.id, resident.unit_id) : null;
  return <section className="min-h-[100dvh]"><ResidentPageHeader title="Ajustes" /><div className="space-y-6 px-5 py-6 sm:px-7">
    <div><p className="text-sm font-semibold text-muted-foreground">Perfil</p><div className="mt-2 divide-y divide-border rounded-2xl bg-surface px-4"><div className="flex min-h-16 items-center gap-3"><UserRound className="h-5 w-5 text-primary" /><div><p className="font-semibold">{sessionUser.fullName}</p><p className="text-sm text-muted-foreground">{unit ? `${unit.identifier}${unit.building ? ` · ${unit.building}` : ""}` : "Sin unidad asignada"}</p></div></div><div className="flex min-h-16 items-center gap-3"><Mail className="h-5 w-5 text-primary" /><span className="text-sm">{sessionUser.email}</span></div></div></div>
    <div><p className="text-sm font-semibold text-muted-foreground">Más opciones</p><Link className="mt-2 flex min-h-16 items-center gap-3 rounded-2xl bg-surface px-4 font-semibold" href="/app/events"><CalendarDays className="h-5 w-5 text-primary" /> Eventos y listas de invitados</Link></div>
    <LogoutButton className="w-full justify-center" label="Cerrar sesión" variant="outline" />
  </div></section>;
}
