"use client";

import Link from "next/link";
import { LoaderCircle, Search } from "lucide-react";

import type { GuardInvitation } from "@/components/guards/guard-types";
import { useInvitationSearch } from "@/components/guards/hooks/use-invitation-search";
import { InvitationStatusBadge } from "@/components/invitations/invitation-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getInvitationAccessTypeLabel,
} from "@/lib/domain/invitation-utils";
import { formatGuardUnit } from "@/components/guards/guard-types";

export function InvitationSearch({
  invitations,
  isPending,
  onRegisterEntry,
}: {
  invitations: GuardInvitation[];
  isPending: (key: string) => boolean;
  onRegisterEntry: (invitationId: string) => void;
}) {
  const search = useInvitationSearch(invitations);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Búsqueda de invitaciones</CardTitle>
        <CardDescription>Busca por visitante, residente o nota registrada.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search aria-hidden="true" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar invitación"
            className="h-14 pl-12 text-base"
            onChange={(event) => search.setQuery(event.target.value)}
            placeholder="Visitante, residente o nota"
            value={search.query}
          />
        </div>
        <div aria-live="polite">
          {search.isSearching ? (
            <p className="flex items-center gap-2 rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> Buscando…
            </p>
          ) : null}
          {search.error ? <p className="rounded-xl border border-danger/25 bg-danger/10 p-3 text-sm text-danger" role="alert">{search.error}</p> : null}
          {!search.isSearching && !search.error && search.results.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Sin resultados.</p>
          ) : null}
        </div>
        <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {search.results.map((invitation) => {
            const status = invitation.effective_status ?? invitation.status;
            const pending = isPending(`invitation:${invitation.id}`);
            return (
              <article key={invitation.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{invitation.visitor_name || "Acceso rápido sin nombre"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {invitation.residents?.full_name || "Sin residente"} · {formatGuardUnit(invitation.units)}
                    </p>
                  </div>
                  <InvitationStatusBadge status={status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {getInvitationAccessTypeLabel(invitation.access_type)} · {invitation.visit_date}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild className="h-11" variant="outline">
                    <Link href={`/app/invitations/${invitation.id}`}>Detalle</Link>
                  </Button>
                  {status === "active" ? (
                    <Button
                      aria-busy={pending}
                      className="h-11"
                      disabled={pending}
                      onClick={() => onRegisterEntry(invitation.id)}
                      type="button"
                    >
                      {pending ? "Registrando…" : "Registrar entrada"}
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
