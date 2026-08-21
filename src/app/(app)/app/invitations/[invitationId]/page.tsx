import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";

import { AccessEventCard } from "@/components/access-log/access-event-card";
import { InvitationStatusBadge } from "@/components/invitations/invitation-status-badge";
import { InvitationWindowForm } from "@/components/invitations/invitation-window-form";
import { RevokeInvitationButton } from "@/components/invitations/revoke-invitation-button";
import { ShareInvitationActions } from "@/components/invitations/share-invitation-actions";
import { SectionShell } from "@/components/layout/section-shell";
import { ResidentPageHeader } from "@/components/resident/resident-header";
import { getInvitationAccessEventsPage } from "@/lib/domain/access-log";
import { buildInvitationShareText, getInvitationAccessTypeLabel, getInvitationById, getInvitationEffectiveStatus, getInvitationEventsPage, getInvitationStatusLabel, getInvitationWindowLabel } from "@/lib/domain/invitations";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";
import { formatAppDateTime } from "@/lib/formatting";

function getBaseUrl(requestHeaders: Headers) { const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host"); const proto = requestHeaders.get("x-forwarded-proto") || "http"; return host ? `${proto}://${host}` : ""; }
function integer(value: string | string[] | undefined) { const parsed = Number.parseInt(Array.isArray(value) ? value[0] ?? "" : value ?? "", 10); return Number.isFinite(parsed) && parsed > 0 ? parsed : 1; }
function detailHref(id: string, eventPage: number, movementPage: number) { const params = new URLSearchParams(); if (eventPage > 1) params.set("eventPage", String(eventPage)); if (movementPage > 1) params.set("movementPage", String(movementPage)); const query = params.toString(); return `/app/invitations/${id}${query ? `?${query}` : ""}`; }

function eventSummary(payload: Record<string, unknown>) {
  if (typeof payload.channel === "string") return `Canal: ${payload.channel}`;
  if (typeof payload.status === "string") return `Estado: ${payload.status}`;
  return null;
}

export default async function InvitationDetailPage({ params, searchParams }: { params: Promise<{ invitationId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { context, sessionUser } = await getCommunityContextOrRedirect({ allowedRoles: ["admin", "guard", "resident"] });
  if (sessionUser.role === "resident" && !sessionUser.residentId) redirect("/app");
  const [{ invitationId }, query] = await Promise.all([params, searchParams]);
  const invitation = await getInvitationById(context.community.id, invitationId, sessionUser.role === "resident" ? sessionUser.residentId : null);
  if (!invitation) notFound();
  const eventPage = integer(query.eventPage);
  const movementPage = integer(query.movementPage);
  const [eventResult, movementResult] = await Promise.all([
    getInvitationEventsPage(invitation.id, eventPage, 5),
    getInvitationAccessEventsPage(context.community.id, invitation.id, movementPage, 5),
  ]);
  const status = getInvitationEffectiveStatus(invitation);
  const canModify = status === "active" || status === "scheduled";
  const requestHeaders = await headers();
  const shareText = buildInvitationShareText(invitation, `${getBaseUrl(requestHeaders)}/invite/${invitation.share_token}`);
  const qrImageDataUrl = invitation.access_credentials?.credential_type === "qr" && invitation.access_credentials.qr_payload ? await QRCode.toDataURL(invitation.access_credentials.qr_payload, { margin: 1, width: 280, color: { dark: "#0c1221", light: "#ffffff" } }) : null;

  const body = <div className="space-y-4">
    <section className="rounded-2xl bg-surface p-5 shadow-[0_6px_20px_rgba(12,18,33,0.05)]">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Acceso Ventry</p><h2 className="mt-2 text-xl font-bold">{invitation.visitor_name || "Acceso rápido"}</h2></div><InvitationStatusBadge status={status} /></div>
      {invitation.access_credentials?.credential_type === "qr" ? <div className="mx-auto mt-5 flex w-fit justify-center rounded-2xl border-2 border-border bg-white p-3">{qrImageDataUrl ? <Image alt="QR de acceso" className="h-44 w-44" height={176} src={qrImageDataUrl} unoptimized width={176} /> : <div className="flex h-44 w-44 items-center justify-center text-sm text-muted-foreground">QR no disponible</div>}</div> : invitation.access_credentials ? <div className="mt-5 rounded-2xl bg-muted px-4 py-5 text-center"><p className="text-sm text-muted-foreground">#&nbsp; PIN de entrada</p><p className="mt-3 font-mono text-[2.35rem] font-semibold tracking-[0.24em]">{invitation.access_credentials.credential_value}</p></div> : <div className="mt-5 rounded-2xl bg-muted p-5 text-center text-sm text-muted-foreground">Credencial no disponible.</div>}
      <dl className="mt-5 divide-y divide-border text-sm"><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Ventana</dt><dd className="max-w-[65%] text-right font-semibold">{getInvitationWindowLabel(invitation)}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">Estado</dt><dd className="font-semibold">{getInvitationStatusLabel(status)}</dd></div></dl>
    </section>

    <details className="rounded-2xl bg-surface px-4"><summary className="flex min-h-14 cursor-pointer list-none items-center font-bold">Compartir y copiar</summary><div className="border-t border-border py-4"><ShareInvitationActions invitationId={invitation.id} mode="secondary" shareText={shareText} /></div></details>
    {sessionUser.role !== "guard" && canModify ? <details className="rounded-2xl bg-surface px-4"><summary className="flex min-h-14 cursor-pointer list-none items-center font-bold">Modificar ventana</summary><div className="border-t border-border py-4"><InvitationWindowForm invitation={invitation} /></div></details> : null}
    {sessionUser.role !== "guard" && canModify ? <details className="rounded-2xl bg-surface px-4"><summary className="flex min-h-14 cursor-pointer list-none items-center font-bold text-danger">Revocar invitación</summary><div className="border-t border-border py-4"><RevokeInvitationButton invitationId={invitation.id} /></div></details> : null}

    <details className="rounded-2xl bg-surface px-4"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between font-bold"><span>Historial</span><span className="text-xs font-medium text-muted-foreground">{eventResult.total}</span></summary><div className="space-y-3 border-t border-border py-4">{eventResult.items.length ? eventResult.items.map((event) => <div className="border-b border-border pb-3 last:border-0" key={event.id}><div className="font-semibold">{event.event_label}</div><div className="mt-1 text-xs text-muted-foreground">{formatAppDateTime(event.created_at, { dateStyle: "medium", timeStyle: "short" })}</div>{eventSummary(event.payload) ? <div className="mt-1 text-sm text-muted-foreground">{eventSummary(event.payload)}</div> : null}</div>) : <p className="py-4 text-sm text-muted-foreground">Sin eventos registrados.</p>}<Pager current={eventResult.page} href={(page) => detailHref(invitation.id, page, movementPage)} total={eventResult.totalPages} /></div></details>
    <details className="rounded-2xl bg-surface px-4"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between font-bold"><span>Movimientos en garita</span><span className="text-xs font-medium text-muted-foreground">{movementResult.total}</span></summary><div className="space-y-3 border-t border-border py-4">{movementResult.items.length ? movementResult.items.map((event) => <AccessEventCard event={event} key={event.id} showEventLink={sessionUser.role !== "resident"} showInvitationLink={false} />) : <p className="py-4 text-sm text-muted-foreground">Sin movimientos registrados.</p>}<Pager current={movementResult.page} href={(page) => detailHref(invitation.id, eventPage, page)} total={movementResult.totalPages} /></div></details>
  </div>;

  if (sessionUser.role === "resident") return <section className="min-h-[100dvh] pb-28 md:pb-0"><ResidentPageHeader backHref="/app/invitations" subtitle={`${getInvitationStatusLabel(status)} · ${getInvitationAccessTypeLabel(invitation.access_type)}`} title={invitation.visitor_name || "Detalle de invitación"} /><div className="space-y-4 px-3 py-4 sm:px-6 md:max-w-3xl md:px-8 md:py-6 xl:px-10">{body}</div>{canModify ? <div className="fixed inset-x-0 bottom-0 z-50 w-full border-t border-border bg-surface p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:sticky md:inset-auto md:max-w-3xl md:px-8 xl:px-10"><ShareInvitationActions invitationId={invitation.id} mode="whatsapp" shareText={shareText} /></div> : null}</section>;
  return <SectionShell eyebrow={getInvitationStatusLabel(status)} title={invitation.visitor_name || "Detalle de invitación"} description="Credencial, ventana e historial del acceso.">{body}</SectionShell>;
}

function Pager({ current, href, total }: { current: number; href: (page: number) => string; total: number }) {
  if (total <= 1) return null;
  return <nav aria-label="Paginación" className="flex items-center justify-between pt-2"><Link aria-disabled={current <= 1} className={current <= 1 ? "pointer-events-none text-sm opacity-40" : "text-sm font-semibold text-primary"} href={href(current - 1)}>Anterior</Link><span className="text-xs text-muted-foreground">{current} / {total}</span><Link aria-disabled={current >= total} className={current >= total ? "pointer-events-none text-sm opacity-40" : "text-sm font-semibold text-primary"} href={href(current + 1)}>Siguiente</Link></nav>;
}
