"use client";

import { CarFront, LoaderCircle, LogOut, UserRound } from "lucide-react";

import { formatGuardUnit, type OpenEntry } from "@/components/guards/guard-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAppTime } from "@/lib/formatting";

export function InsideList({
  entries,
  isPending,
  onExit,
}: {
  entries: OpenEntry[];
  isPending: (key: string) => boolean;
  onExit: (entryId: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
        <UserRound aria-hidden="true" className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-bold">No hay personas dentro ahora.</p>
        <p className="mt-1 text-sm text-muted-foreground">Las entradas confirmadas por el servidor aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {entries.map((entry) => {
        const pending = isPending(`exit:${entry.id}`);
        return (
          <article key={entry.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-primary">
                {entry.vehicle_plate ? <CarFront aria-hidden="true" className="h-5 w-5" /> : entry.visitor_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{entry.visitor_name}</p>
                  <Badge variant="warning">Dentro</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {entry.residents?.full_name || "Sin residente"} · {formatGuardUnit(entry.units)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Entró a las {formatAppTime(entry.entered_at)}
                  {entry.vehicle_plate ? ` · Placa ${entry.vehicle_plate}` : ""}
                  {entry.companion_count > 0 ? ` · ${entry.companion_count} acompañantes` : ""}
                </p>
              </div>
              <Button
                aria-busy={pending}
                className="h-12 shrink-0"
                disabled={pending}
                onClick={() => onExit(entry.id)}
                type="button"
                variant="outline"
              >
                {pending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <LogOut aria-hidden="true" className="h-4 w-4" />}
                {pending ? "Registrando…" : "Registrar salida"}
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
