import Link from "next/link";

import { PushSettings } from "@/components/pwa/push-settings";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";
import { getPreferenceKinds } from "@/lib/push/notifications";

export default async function NotificationPreferencesPage() {
  const { sessionUser } = await getCommunityContextOrRedirect();
  return <section className="mx-auto max-w-3xl space-y-4 px-4 py-6">
    <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-primary" href="/app/notifications">Volver a notificaciones</Link>
    <h1 className="text-2xl font-bold">Preferencias de notificaciones</h1>
    <PushSettings owner={sessionUser.authUserId} kinds={getPreferenceKinds(sessionUser.role)} />
  </section>;
}
