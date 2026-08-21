import { redirect } from "next/navigation";

import { EventForm } from "@/components/events/event-form";
import { ResidentPageHeader } from "@/components/resident/resident-header";
import { getResidentsForCommunity } from "@/lib/domain/community";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

export default async function NewEventPage() {
  const { context, sessionUser } = await getCommunityContextOrRedirect({
    allowedRoles: ["admin", "resident"],
  });
  if (sessionUser.role === "resident" && !sessionUser.residentId) redirect("/app");
  const residents = (await getResidentsForCommunity(context.community.id)).filter(
    (resident) => resident.is_active,
  );
  const available =
    sessionUser.role === "resident"
      ? residents.filter((resident) => resident.id === sessionUser.residentId)
      : residents;

  if (available.length) return <EventForm residents={available} />;

  return <section className="min-h-[100dvh]"><ResidentPageHeader backHref="/app/events" title="Nuevo evento" /><div className="max-w-2xl px-5 py-8 sm:px-7 md:px-8 xl:px-10"><div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-muted-foreground">Necesitas un residente activo y vinculado antes de crear un evento.</div></div></section>;
}
