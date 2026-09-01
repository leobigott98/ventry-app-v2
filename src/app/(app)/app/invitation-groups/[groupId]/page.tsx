import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { InvitationStatusBadge } from "@/components/invitations/invitation-status-badge";
import { AccessChangeHistory } from "@/components/access/access-change-history";
import { ManagedGroupPanel } from "@/components/invitations/managed-group-panel";
import { LifecycleActions } from "@/components/access/lifecycle-actions";
import { ShareInvitationActions } from "@/components/invitations/share-invitation-actions";
import { ResidentPageHeader } from "@/components/resident/resident-header";
import { buildInvitationShareText, getInvitationEffectiveStatus, getInvitationGroupById, getInvitationWindowLabel } from "@/lib/domain/invitations";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";
import { getAccessChangeHistory } from "@/lib/domain/access-lifecycle";

function origin(value: Headers) { const host=value.get("x-forwarded-host")||value.get("host"); const proto=value.get("x-forwarded-proto")||"http"; return host?`${proto}://${host}`:""; }

export default async function InvitationGroupPage({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { context, sessionUser } = await getCommunityContextOrRedirect({ allowedRoles: ["admin","guard","resident"] });
  if (sessionUser.role === "resident" && !sessionUser.residentId) redirect("/app");
  const [{ groupId }, query] = await Promise.all([params, searchParams]);
  const group = await getInvitationGroupById(context.community.id, groupId, sessionUser.role === "resident" ? sessionUser.residentId : null);
  if (!group) notFound();
  const changeHistory = sessionUser.role === "guard" ? [] : await getAccessChangeHistory(context.community.id,"invitation_group",group.id);
  const firstInvitation = group.invitations[0];
  if (!firstInvitation) notFound();
  const base = origin(await headers());
  const activeCount = group.invitations.filter((item) => ["active","scheduled"].includes(getInvitationEffectiveStatus(item,context.community.time_zone))).length;
  return <section className="min-h-[100dvh]"><ResidentPageHeader backHref="/app/invitations" subtitle={`${activeCount} activas · ${getInvitationWindowLabel(firstInvitation)}`} title={`Invitación para ${group.invitations.length} personas`} />
    <div className="grid gap-4 px-4 py-5 sm:px-6 md:px-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:px-10">
      <div className="space-y-3">{query.contactWarning === "1" ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900" role="status">La invitación se creó correctamente, pero algunos contactos no pudieron guardarse.</div> : null}{group.invitations.map((invitation) => { const status=getInvitationEffectiveStatus(invitation,context.community.time_zone); const text=buildInvitationShareText(invitation,`${base}/invite/${invitation.share_token}`,context.community.time_zone); return <article className="rounded-2xl border border-border bg-surface p-4" key={invitation.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-bold">{invitation.visitor_name}</h2><p className="mt-1 text-sm text-muted-foreground">{invitation.visitor_phone || "Sin telefono"}</p></div><InvitationStatusBadge status={status} /></div>{invitation.access_credentials?.credential_type === "pin" ? <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-center font-mono text-xl tracking-[0.2em]">{invitation.access_credentials.credential_value}</p> : <p className="mt-4 text-sm font-semibold text-primary">QR individual listo para compartir</p>}<div className="mt-4 grid gap-2 sm:grid-cols-2"><ShareInvitationActions invitationId={invitation.id} mode="secondary" shareText={text} /><Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border font-semibold" href={`/app/invitations/${invitation.id}`}>Abrir detalle</Link></div></article>; })}</div>
      <aside className="min-w-0 space-y-3 xl:sticky xl:top-6 xl:self-start"><div className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">Cada persona tiene una credencial y estado independientes. Retirar una no afecta a las demás.</div>{sessionUser.role !== "guard" ? <><ManagedGroupPanel group={group} /><LifecycleActions canCancel={Boolean(activeCount)&&!group.cancelled_at} kind="group" resourceId={group.id} version={group.version} window={{date:group.visit_date,arrivalWindowMode:group.arrival_window_mode??"all_day",arrivalStart:group.arrival_start??null,arrivalEndDate:group.arrival_end_date??null,arrivalEnd:group.arrival_end??null,plannedExitDate:group.planned_exit_date??null,plannedExitTime:group.planned_exit_time??null}} /><AccessChangeHistory items={changeHistory}/></> : null}</aside>
    </div>
  </section>;
}
