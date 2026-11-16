"use client";

import { LoaderCircle, Search, UserCheck } from "lucide-react";
import { useMemo, useState } from "react";

import type { GuardEvent } from "@/components/guards/guard-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function attendanceLabel(status: GuardEvent["event_guests"][number]["attendance_status"]) {
  if (status === "inside") return "Dentro";
  if (status === "exited") return "Salió";
  if (status === "removed") return "Retirado";
  return "Pendiente";
}

export function EventGuestCheckIn({
  event,
  isPending,
  onRegister,
}: {
  event: GuardEvent;
  isPending: (key: string) => boolean;
  onRegister: (eventId: string, guestId: string, companions: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [companionCounts, setCompanionCounts] = useState<Record<string, number>>({});
  const guests = useMemo(
    () =>
      [...event.event_guests]
        .filter((guest) =>
          guest.full_name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
        )
        .sort(
          (left, right) =>
            Number(right.id === event.identified_guest_id) -
            Number(left.id === event.identified_guest_id),
        )
        .slice(0, 60),
    [event.event_guests, event.identified_guest_id, query],
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search aria-hidden="true" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Buscar invitado del evento"
          className="h-14 pl-12 text-base"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar nombre en la lista…"
          value={query}
        />
      </div>

      {event.identified_guest_id ? (
        <p className="text-sm font-bold text-primary">La credencial identificó a esta persona.</p>
      ) : (
        <p className="text-sm text-muted-foreground">Selecciona al invitado antes de registrar la entrada.</p>
      )}

      <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {guests.map((guest) => {
          const operationKey = `event:${event.id}:${guest.id}`;
          const pending = isPending(operationKey);
          const canRegister = guest.attendance_status === "pending" && event.effective_status === "active";
          return (
            <article
              key={guest.id}
              className={cn(
                "rounded-xl border bg-surface p-3",
                guest.id === event.identified_guest_id ? "border-2 border-primary" : "border-border",
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{guest.full_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {guest.phone || guest.notes || "Invitado del evento"}
                    {guest.allows_companions ? ` · hasta ${guest.max_companions} acompañantes` : ""}
                  </p>
                </div>
                {canRegister ? (
                  <Button
                    aria-busy={pending}
                    className="h-12 shrink-0"
                    disabled={pending}
                    onClick={() => onRegister(event.id, guest.id, companionCounts[guest.id] ?? 0)}
                    type="button"
                  >
                    {pending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <UserCheck aria-hidden="true" className="h-4 w-4" />}
                    {pending ? "Registrando…" : "Registrar entrada"}
                  </Button>
                ) : (
                  <Badge variant={guest.attendance_status === "inside" ? "warning" : guest.attendance_status === "removed" ? "danger" : "success"}>
                    {attendanceLabel(guest.attendance_status)}
                  </Badge>
                )}
              </div>

              {canRegister && guest.allows_companions ? (
                <label className="mt-3 flex min-h-12 items-center justify-between gap-3 border-t border-border pt-3 text-sm font-semibold">
                  <span>Acompañantes ({(companionCounts[guest.id] ?? 0) + 1} personas en total)</span>
                  <select
                    aria-label={`Acompañantes de ${guest.full_name}`}
                    className="h-11 rounded-xl border border-border bg-surface px-3"
                    onChange={(changeEvent) =>
                      setCompanionCounts((current) => ({
                        ...current,
                        [guest.id]: Number(changeEvent.target.value),
                      }))
                    }
                    value={companionCounts[guest.id] ?? 0}
                  >
                    {Array.from({ length: guest.max_companions + 1 }, (_, count) => (
                      <option key={count} value={count}>{count}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </article>
          );
        })}
      </div>

      {guests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          No hay invitados que coincidan con la búsqueda.
        </p>
      ) : null}
    </div>
  );
}
