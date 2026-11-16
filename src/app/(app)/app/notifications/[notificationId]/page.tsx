import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { NotificationRefresh } from "@/components/pwa/notification-refresh";
import { VisitDecision } from "@/components/pwa/visit-decision";
import { buttonVariants } from "@/components/ui/button";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";
import { formatAppDateTime } from "@/lib/formatting";
import { getNotificationDetail } from "@/lib/push/inbox";
import { notificationCopy } from "@/lib/push/notifications";

export default async function NotificationDetailPage({ params }: { params: Promise<{ notificationId: string }> }) {
  const { context, sessionUser } = await getCommunityContextOrRedirect();
  const id = z.string().uuid().safeParse((await params).notificationId);
  if (!id.success) notFound();
  const community = context.community.id;
  const { client, data: event, error } = await getNotificationDetail(community, sessionUser.authUserId, id.data);
  if (error) return <p role="status" className="p-5">No pudimos cargar el aviso. Vuelve a intentarlo.</p>;
  if (!event) notFound();

  const copy = notificationCopy[event.kind];
  const target = event.target_id;
  const [visit, entry] = await Promise.all([
    event.target_type === "confirmation" && target ? client.from("visit_confirmations")
      .select("id, visitor_name, status, expires_at").eq("community_id", community).eq("id", target).maybeSingle() : null,
    event.target_type === "entry" && target ? client.from("visitor_entries")
      .select("visitor_name, entered_at").eq("community_id", community).eq("id", target).maybeSingle() : null,
  ]);
  const confirmation = visit?.data;
  const pending = confirmation?.status === "pending" && new Date(confirmation.expires_at).getTime() > Date.now();
  const destination = event.target_type === "invitation" ? "/app/invitations/" + target
    : event.target_type === "event" ? "/app/events/" + target : null;

  return <section className="mx-auto max-w-3xl space-y-4 px-4 py-6">
    <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-primary" href="/app/notifications">Todas las notificaciones</Link>
    <article className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <h1 className="text-xl font-bold">{copy.title}</h1>
      <time className="block text-sm text-muted-foreground" dateTime={event.created_at}>{formatAppDateTime(event.created_at)}</time>
      {confirmation ? <>
        {pending ? <NotificationRefresh /> : null}
        <p>Visitante <strong>{confirmation.visitor_name}</strong></p>
        <p className="text-sm">
          {pending ? "Tu respuesta llegará a la garita. El ingreso lo registra el personal de guardia."
            : confirmation.status === "approved" ? "Confirmaste esta visita."
              : confirmation.status === "declined" ? "Rechazaste esta visita." : "La solicitud venció."}
        </p>
        {pending ? <VisitDecision id={confirmation.id} /> : null}
      </> : entry?.data ? <>
        <p>Visitante <strong>{entry.data.visitor_name}</strong></p>
        <p className="text-sm">Ingreso {formatAppDateTime(entry.data.entered_at)}</p>
      </> : destination && target ? (
        <Link className={buttonVariants({ variant: "outline" })} href={destination}>
          {event.target_type === "event" ? "Ver evento" : "Ver invitación"}
        </Link>
      ) : <p>{event.kind === "test" ? "Este es el registro de tu prueba de notificaciones." : copy.body}</p>}
    </article>
  </section>;
}
