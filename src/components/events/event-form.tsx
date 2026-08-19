"use client";

import {
  CalendarDays,
  Check,
  FileSpreadsheet,
  Plus,
  Trash2,
  Upload,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ResidentRecord, UnitRecord } from "@/lib/domain/types";
import { createEventSchema, type EventGuestInput } from "@/lib/schemas/events";
import { cn } from "@/lib/utils";

type ResidentOption = ResidentRecord & {
  units: Pick<UnitRecord, "identifier" | "building"> | null;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultWindow() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 5);
  return {
    eventDate: dateValue(start),
    windowStart: timeValue(start),
    windowEndDate: dateValue(end),
    windowEnd: timeValue(end),
  };
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if ((character === "," || character === ";") && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function guestsFromCsv(csv: string) {
  const rows = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);
  if (!rows.length) return [];

  const headers = rows[0].map(normalizeHeader);
  const nameIndex = headers.findIndex((header) =>
    ["nombre", "name", "invitado", "guest", "nombre completo", "full name"].includes(header),
  );
  const phoneIndex = headers.findIndex((header) =>
    ["telefono", "phone", "celular", "whatsapp"].includes(header),
  );
  const notesIndex = headers.findIndex((header) =>
    ["notas", "notes", "nota", "observaciones"].includes(header),
  );
  const hasHeader = nameIndex >= 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const resolvedNameIndex = hasHeader ? nameIndex : 0;

  return dataRows
    .map((row) => ({
      fullName: row[resolvedNameIndex]?.trim() ?? "",
      phone: (hasHeader ? row[phoneIndex] : row[1])?.trim() || null,
      notes: (hasHeader ? row[notesIndex] : row[2])?.trim() || null,
    }))
    .filter((guest) => guest.fullName.length >= 2)
    .slice(0, 500);
}

export function EventForm({ residents }: { residents: ResidentOption[] }) {
  const router = useRouter();
  const defaults = useMemo(defaultWindow, []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    residentId: residents[0]?.id ?? "",
    name: "",
    eventDate: defaults.eventDate,
    windowStart: defaults.windowStart,
    windowEndDate: defaults.windowEndDate,
    windowEnd: defaults.windowEnd,
    credentialType: "qr" as "pin" | "qr",
    notes: "",
  });
  const [guests, setGuests] = useState<EventGuestInput[]>([]);
  const [draftGuest, setDraftGuest] = useState({ fullName: "", phone: "", notes: "" });
  const [guestMode, setGuestMode] = useState<"manual" | "csv">("manual");
  const [error, setError] = useState<string | null>(null);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function addGuest() {
    const fullName = draftGuest.fullName.trim();
    if (fullName.length < 2) {
      setError("Escribe el nombre del invitado.");
      return;
    }
    const duplicate = guests.some(
      (guest) =>
        guest.fullName.toLocaleLowerCase() === fullName.toLocaleLowerCase() &&
        (guest.phone ?? "") === draftGuest.phone.trim(),
    );
    if (duplicate) {
      setError("Ese invitado ya esta en la lista.");
      return;
    }
    setGuests((current) => [
      ...current,
      {
        fullName,
        phone: draftGuest.phone.trim() || null,
        notes: draftGuest.notes.trim() || null,
      },
    ]);
    setDraftGuest({ fullName: "", phone: "", notes: "" });
    setError(null);
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setCsvMessage(null);
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError("Selecciona un archivo CSV.");
      return;
    }
    const imported = guestsFromCsv(await file.text());
    if (!imported.length) {
      setError("No encontramos invitados. Usa columnas nombre, telefono y notas.");
      return;
    }
    setGuests((current) => {
      const merged = [...current];
      imported.forEach((guest) => {
        const exists = merged.some(
          (item) =>
            item.fullName.toLocaleLowerCase() === guest.fullName.toLocaleLowerCase() &&
            (item.phone ?? "") === (guest.phone ?? ""),
        );
        if (!exists && merged.length < 500) merged.push(guest);
      });
      return merged;
    });
    setCsvMessage(`${imported.length} invitados leidos. Puedes revisar la lista antes de crear.`);
    event.target.value = "";
  }

  async function submit() {
    setError(null);
    const parsed = createEventSchema.safeParse({ ...form, guests });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos del evento.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok) {
        setError(payload.error ?? "No fue posible crear el evento.");
        return;
      }
      router.push(payload.redirectTo ?? "/app/events");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-secondary/35 p-4 sm:p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">1. Tu evento</h3>
            <p className="text-sm text-muted-foreground">Nombre, anfitrion y horario de acceso.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="eventName">Nombre del evento</Label>
            <Input
              id="eventName"
              className="h-14 text-base"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Cumple de Sofia"
            />
          </div>
          {residents.length > 1 ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="eventResident">Residente anfitrion</Label>
              <Select
                id="eventResident"
                className="h-14"
                value={form.residentId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, residentId: event.target.value }))
                }
              >
                {residents.map((resident) => (
                  <option key={resident.id} value={resident.id}>
                    {resident.full_name}
                    {resident.units ? ` | ${resident.units.identifier}` : ""}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="eventDate">Fecha</Label>
            <Input
              id="eventDate"
              className="h-14"
              type="date"
              value={form.eventDate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  eventDate: event.target.value,
                  windowEndDate:
                    current.windowEndDate < event.target.value
                      ? event.target.value
                      : current.windowEndDate,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eventStart">Entrada desde</Label>
            <Input
              id="eventStart"
              className="h-14"
              type="time"
              value={form.windowStart}
              onChange={(event) =>
                setForm((current) => ({ ...current, windowStart: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eventEndDate">Fecha final</Label>
            <Input
              id="eventEndDate"
              className="h-14"
              type="date"
              value={form.windowEndDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, windowEndDate: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eventEnd">Entrada hasta</Label>
            <Input
              id="eventEnd"
              className="h-14"
              type="time"
              value={form.windowEnd}
              onChange={(event) =>
                setForm((current) => ({ ...current, windowEnd: event.target.value }))
              }
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-secondary/35 p-4 sm:p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success/10 text-success">
            <UsersRound className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-semibold">2. Lista de invitados</h3>
            <p className="text-sm text-muted-foreground">
              {guests.length ? `${guests.length} listos para invitar` : "Agrega uno a uno o sube un CSV."}
            </p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-2xl border border-border bg-background/50 p-1">
          <button
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold",
              guestMode === "manual" ? "bg-primary/15 text-primary" : "text-muted-foreground",
            )}
            type="button"
            aria-pressed={guestMode === "manual"}
            onClick={() => setGuestMode("manual")}
          >
            <UserRoundPlus className="h-4 w-4" /> Manual
          </button>
          <button
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold",
              guestMode === "csv" ? "bg-primary/15 text-primary" : "text-muted-foreground",
            )}
            type="button"
            aria-pressed={guestMode === "csv"}
            onClick={() => setGuestMode("csv")}
          >
            <FileSpreadsheet className="h-4 w-4" /> Subir CSV
          </button>
        </div>

        {guestMode === "manual" ? (
          <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
            <div className="space-y-2">
              <Label htmlFor="guestName">Nombre completo</Label>
              <Input
                id="guestName"
                className="h-14 text-base"
                value={draftGuest.fullName}
                onChange={(event) =>
                  setDraftGuest((current) => ({ ...current, fullName: event.target.value }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addGuest();
                  }
                }}
                placeholder="Andrea Perez"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="guestPhone">Telefono (opcional)</Label>
                <Input
                  id="guestPhone"
                  className="h-14"
                  inputMode="tel"
                  value={draftGuest.phone}
                  onChange={(event) =>
                    setDraftGuest((current) => ({ ...current, phone: event.target.value }))
                  }
                  placeholder="+58 412 000 0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guestNotes">Nota (opcional)</Label>
                <Input
                  id="guestNotes"
                  className="h-14"
                  value={draftGuest.notes}
                  onChange={(event) =>
                    setDraftGuest((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Acompanante, placa..."
                />
              </div>
            </div>
            <Button className="h-14 w-full text-base" type="button" variant="outline" onClick={addGuest}>
              <Plus className="h-5 w-5" /> Agregar a la lista
            </Button>
          </div>
        ) : (
          <button
            className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-primary/45 bg-primary/5 px-5 py-9 text-center"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-primary" />
            <span className="mt-3 font-semibold text-foreground">Seleccionar archivo CSV</span>
            <span className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
              Columnas recomendadas: nombre, telefono, notas. Tambien aceptamos archivos sin encabezado.
            </span>
            <input
              ref={fileInputRef}
              className="hidden"
              accept=".csv,text/csv"
              type="file"
              onChange={importCsv}
            />
          </button>
        )}

        {csvMessage ? (
          <div className="mt-3 flex gap-2 rounded-2xl border border-success/25 bg-success/10 p-3 text-sm text-success">
            <Check className="mt-0.5 h-4 w-4 shrink-0" /> {csvMessage}
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {guests.map((guest, index) => (
            <div
              key={`${guest.fullName}-${guest.phone ?? ""}-${index}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{guest.fullName}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[guest.phone, guest.notes].filter(Boolean).join(" · ") || "Sin datos adicionales"}
                </div>
              </div>
              <Button
                aria-label={`Quitar a ${guest.fullName}`}
                size="icon"
                type="button"
                variant="ghost"
                onClick={() => setGuests((current) => current.filter((_, item) => item !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {!guests.length ? (
            <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              Tu lista aparecera aqui para que puedas revisarla.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-secondary/35 p-4 sm:p-5">
        <h3 className="font-display text-lg font-semibold">3. Acceso compartido</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Un solo codigo funciona para todos; garita elige el nombre al registrar la entrada.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(["qr", "pin"] as const).map((type) => (
            <button
              key={type}
              className={cn(
                "min-h-20 rounded-2xl border p-4 text-left",
                form.credentialType === type
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted-foreground",
              )}
              type="button"
              aria-pressed={form.credentialType === type}
              onClick={() => setForm((current) => ({ ...current, credentialType: type }))}
            >
              <div className="font-semibold">{type === "qr" ? "QR compartido" : "PIN compartido"}</div>
              <div className="mt-1 text-xs">{type === "qr" ? "Rapido para escanear" : "Facil de dictar"}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="eventNotes">Nota para garita (opcional)</Label>
          <Textarea
            id="eventNotes"
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Salon de fiestas, estacionamiento de visitantes..."
          />
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-10 rounded-[22px] border border-border bg-background/90 p-3 shadow-panel backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <Button
          className="h-14 w-full text-base"
          disabled={isSubmitting}
          type="button"
          onClick={() => void submit()}
        >
          {isSubmitting ? "Creando evento..." : `Crear evento con ${guests.length} invitado${guests.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
