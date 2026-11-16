"use client";

import Link from "next/link";
import { ArrowLeft, Building2, Phone, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

import { formatGuardUnit, type ResidentOption } from "@/components/guards/guard-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

export function GuardResidentDirectory({
  communityName,
  residents,
}: {
  communityName: string;
  residents: ResidentOption[];
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const needle = normalized(query.trim());
    if (!needle) return residents;
    return residents.filter((resident) =>
      normalized(
        `${resident.full_name} ${resident.units?.identifier ?? ""} ${resident.units?.building ?? ""}`,
      ).includes(needle),
    );
  }, [query, residents]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Directorio de garita</p>
          <h2 className="mt-1 text-2xl font-extrabold">Llamar a residente</h2>
          <p className="mt-1 text-sm text-muted-foreground">{communityName} · directorio real de residentes y unidades activas.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/guards"><ArrowLeft aria-hidden="true" className="h-4 w-4" /> Volver a garita</Link>
        </Button>
      </div>

      <div className="flex gap-3 rounded-xl border border-primary/20 bg-secondary/60 p-4 text-sm text-primary">
        <Phone aria-hidden="true" className="h-5 w-5 shrink-0" />
        <p><strong>Intercom pendiente.</strong> Esta pantalla sólo permite localizar al residente; no simula ni inicia llamadas.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Residentes y unidades</CardTitle>
          <CardDescription>Busca por nombre, edificio, torre o identificador de unidad.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar residente o unidad"
              autoFocus
              className="h-14 pl-12 text-base"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nombre, torre o unidad"
              value={query}
            />
          </div>

          <p className="text-sm text-muted-foreground" role="status">{results.length} resultado{results.length === 1 ? "" : "s"}</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {results.map((resident) => (
              <article key={resident.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                    <UserRound aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{resident.full_name}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 aria-hidden="true" className="h-4 w-4" /> {formatGuardUnit(resident.units)}
                    </p>
                  </div>
                  <Badge variant="success">Activo</Badge>
                </div>
              </article>
            ))}
          </div>
          {results.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No hay residentes o unidades que coincidan.</p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
