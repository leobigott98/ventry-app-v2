import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Plus, Search } from "lucide-react";
import { redirect } from "next/navigation";

import { InvitationStatusBadge } from "@/components/invitations/invitation-status-badge";
import { SectionShell } from "@/components/layout/section-shell";
import { ResidentPageHeader } from "@/components/resident/resident-header";
import { Button } from "@/components/ui/button";
import { classifyInvitations, getInvitationAccessTypeLabel, getInvitationEffectiveStatus, getInvitationWindowLabel, getPaginatedInvitations, type InvitationListFilter } from "@/lib/domain/invitations";
import { getCommunityContextOrRedirect } from "@/lib/domain/session-context";

function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
function integer(value: string | string[] | undefined, fallback: number) { const parsed = Number.parseInt(single(value), 10); return Number.isFinite(parsed) ? parsed : fallback; }
const validStatuses: InvitationListFilter[] = ["all", "current", "used", "expired", "revoked"];

function pageHref(values: Record<string, string>, page: number) {
  const params = new URLSearchParams(values);
  if (page > 1) params.set("page", String(page)); else params.delete("page");
  const query = params.toString();
  return query ? `/app/invitations?${query}` : "/app/invitations";
}

export default async function InvitationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { context, sessionUser } = await getCommunityContextOrRedirect({ allowedRoles: ["admin", "guard", "resident"] });
  if (sessionUser.role === "resident" && !sessionUser.residentId) redirect("/app");
  const params = await searchParams;
  const requestedStatus = single(params.status) as InvitationListFilter;
  const values = {
    q: single(params.q).slice(0, 80),
    status: validStatuses.includes(requestedStatus) ? requestedStatus : "all" as InvitationListFilter,
    dateFrom: single(params.dateFrom),
    dateTo: single(params.dateTo),
  };
  const result = await getPaginatedInvitations(context.community.id, sessionUser.role === "resident" ? sessionUser.residentId : null, { query: values.q, status: values.status, dateFrom: values.dateFrom, dateTo: values.dateTo, page: integer(params.page, 1), pageSize: 10 });
  const groups = classifyInvitations(result.items);
  const resident = sessionUser.role === "resident";
  const filterParams = { q: values.q, status: values.status, dateFrom: values.dateFrom, dateTo: values.dateTo };

  const content = <>
    <form aria-label="Buscar y filtrar invitaciones" className="space-y-3" method="get" role="search">
      <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><input aria-label="Buscar por visitante" className="h-12 w-full rounded-2xl border border-border bg-surface pl-11 pr-4 text-base outline-none focus:ring-2 focus:ring-primary/25" defaultValue={values.q} name="q" placeholder="Buscar visitante" /></div>
      <details className="group rounded-2xl bg-surface px-4"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-semibold"><span className="inline-flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /> Filtros</span><span className="text-xs font-medium text-muted-foreground">{values.status === "all" ? "Todas" : values.status === "current" ? "Vigentes" : values.status}</span></summary><div className="grid gap-3 border-t border-border py-4 sm:grid-cols-3"><label className="text-sm font-semibold">Estado<select className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 text-base" defaultValue={values.status} name="status"><option value="all">Todas</option><option value="current">Vigentes</option><option value="used">Usadas</option><option value="expired">Vencidas</option><option value="revoked">Revocadas</option></select></label><label className="text-sm font-semibold">Desde<input className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 text-base" defaultValue={values.dateFrom} name="dateFrom" type="date" /></label><label className="text-sm font-semibold">Hasta<input className="mt-1 h-11 w-full rounded-xl border border-border bg-surface px-3 text-base" defaultValue={values.dateTo} name="dateTo" type="date" /></label><Button className="sm:col-span-3" type="submit">Aplicar filtros</Button></div></details>
    </form>

    {resident ? <div className="flex items-center justify-between gap-3"><Link className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary" href="/app/events"><CalendarDays className="h-4 w-4" /> Eventos</Link><Link className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white" href="/app/invitations/new"><Plus className="h-4 w-4" /> Nueva invitación</Link></div> : sessionUser.role !== "guard" ? <Button asChild><Link href="/app/invitations/new">Nueva invitación</Link></Button> : null}

    <div className="space-y-5">
      {values.status === "all" && groups.current.length > 0 ? <InvitationGroup invitations={groups.current} title="Vigentes" /> : null}
      {values.status === "all" && groups.history.length > 0 ? <InvitationGroup invitations={groups.history} title="Historial" /> : null}
      {values.status !== "all" && result.items.length > 0 ? <InvitationGroup invitations={result.items} title={values.status === "current" ? "Vigentes" : "Resultados"} /> : null}
      {result.items.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center"><p className="font-bold">No encontramos invitaciones</p><p className="mt-2 text-sm text-muted-foreground">Ajusta los filtros o crea una nueva visita.</p></div> : null}
    </div>

    <nav aria-label="Paginación de invitaciones" className="flex items-center justify-between gap-3 border-t border-border pt-4"><Button asChild={result.page > 1} disabled={result.page <= 1} variant="outline">{result.page > 1 ? <Link href={pageHref(filterParams, result.page - 1)}><ChevronLeft className="h-4 w-4" /> Anterior</Link> : <span><ChevronLeft className="h-4 w-4" /> Anterior</span>}</Button><span className="text-sm text-muted-foreground">Página {result.page} de {result.totalPages}</span><Button asChild={result.page < result.totalPages} disabled={result.page >= result.totalPages} variant="outline">{result.page < result.totalPages ? <Link href={pageHref(filterParams, result.page + 1)}>Siguiente <ChevronRight className="h-4 w-4" /></Link> : <span>Siguiente <ChevronRight className="h-4 w-4" /></span>}</Button></nav>
  </>;

  if (resident) return <section className="min-h-[100dvh]"><ResidentPageHeader subtitle={`${result.total} ${result.total === 1 ? "invitación" : "invitaciones"}`} title="Mis invitaciones" /><div className="space-y-4 px-4 py-4 sm:px-6 md:px-8 md:py-6 xl:max-w-6xl xl:px-10">{content}</div></section>;
  return <SectionShell eyebrow={`${result.total} registradas`} title="Invitaciones" description={sessionUser.role === "guard" ? "Consulta accesos vigentes y detalles operativos." : "Crea y administra accesos para la comunidad."}>{content}</SectionShell>;
}

function InvitationGroup({ invitations, title }: { invitations: Awaited<ReturnType<typeof getPaginatedInvitations>>["items"]; title: string }) {
  return <section><h2 className="mb-2 px-1 text-sm font-bold text-muted-foreground">{title}</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{invitations.map((invitation) => { const status = getInvitationEffectiveStatus(invitation); return <Link className="block rounded-2xl border border-border bg-surface p-4 transition hover:border-primary/35" href={`/app/invitations/${invitation.id}`} key={invitation.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[17px] font-bold">{invitation.visitor_name || "Acceso rápido sin nombre"}</p><p className="mt-1 text-sm text-muted-foreground">{getInvitationAccessTypeLabel(invitation.access_type)} · {getInvitationWindowLabel(invitation)}</p></div><InvitationStatusBadge status={status} /></div></Link>; })}</div></section>;
}
