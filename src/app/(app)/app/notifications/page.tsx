import Link from "next/link";

import { NotificationRefresh } from "@/components/pwa/notification-refresh";
import { buttonVariants } from "@/components/ui/button";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";
import { formatAppDateTime } from "@/lib/formatting";
import { getNotificationFeed } from "@/lib/push/inbox";
import { notificationCopy, notificationHref } from "@/lib/push/notifications";

export default async function NotificationsPage() {
  const { context, sessionUser } = await getCommunityContextOrRedirect();
  const events = await getNotificationFeed(context.community.id, sessionUser.authUserId);

  return <section className="mx-auto max-w-3xl space-y-4 px-4 py-6">
    <NotificationRefresh />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Notificaciones</h1>
      <Link className={buttonVariants({ variant: "outline" })} href="/app/notifications/preferences">Preferencias</Link>
    </div>
    <p className="text-sm text-muted-foreground">Aquí puedes consultar tus avisos aunque las notificaciones del dispositivo estén desactivadas.</p>
    {events === null ? <p role="status">No pudimos cargar los avisos. Vuelve a intentarlo en unos segundos.</p>
      : events.length === 0 ? <p className="rounded-xl bg-surface p-5">Todavía no tienes avisos.</p>
      : <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {events.map((event) => <li key={event.id}>
          <Link className="block p-4 hover:bg-muted" href={notificationHref(event.id)}>
            <span className="block font-semibold">{notificationCopy[event.kind].title}</span>
            <time className="text-sm text-muted-foreground" dateTime={event.created_at}>{formatAppDateTime(event.created_at)}</time>
          </Link>
        </li>)}
      </ul>}
  </section>;
}
