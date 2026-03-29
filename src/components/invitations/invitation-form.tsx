"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  credentialTypeOptions,
  invitationAccessTypeOptions,
  type ResidentRecord,
  type UnitRecord,
} from "@/lib/domain/types";
import {
  createInvitationSchema,
  type CreateInvitationInput,
} from "@/lib/schemas/invitations";

type ResidentOption = ResidentRecord & {
  units: Pick<UnitRecord, "identifier" | "building"> | null;
};

function getDefaultWindow() {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  if (now.getMinutes() > 30) {
    start.setHours(start.getHours() + 1);
  }

  const end = new Date(start);
  end.setHours(end.getHours() + 2);

  const pad = (value: number) => String(value).padStart(2, "0");
  const toDateValue = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const toTimeValue = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  return {
    date: toDateValue(now),
    start: toTimeValue(start),
    end: toTimeValue(end),
  };
}

export function InvitationForm({ residents }: { residents: ResidentOption[] }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const defaults = useMemo(() => getDefaultWindow(), []);

  const {
    register,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateInvitationInput>({
    resolver: zodResolver(createInvitationSchema),
    defaultValues: {
      residentId: residents[0]?.id ?? "",
      visitorName: "",
      accessType: "visitor",
      credentialType: "pin",
      visitDate: defaults.date,
      windowStart: defaults.start,
      windowEnd: defaults.end,
      notes: "",
    },
  });

  const accessType = watch("accessType");
  const selectedResidentId = watch("residentId");
  const selectedResident = residents.find((resident) => resident.id === selectedResidentId);
  const isSingleResident = residents.length === 1;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json()) as { error?: string; redirectTo?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setServerError(payload.error ?? "No fue posible crear la invitacion.");
      return;
    }

    router.push(payload.redirectTo ?? "/app/invitations");
    router.refresh();
  });

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="residentId">Residente</Label>
          {isSingleResident ? (
            <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-sm">
              <div className="font-semibold text-foreground">{residents[0]?.full_name}</div>
              <div className="mt-1 text-muted-foreground">
                {residents[0]?.units
                  ? `${residents[0].units.building ? `${residents[0].units.building} - ` : ""}${residents[0].units.identifier}`
                  : "Sin unidad asignada"}
              </div>
              <input type="hidden" {...register("residentId")} value={residents[0]?.id ?? ""} />
            </div>
          ) : (
            <Select id="residentId" {...register("residentId")}>
              <option value="">Selecciona un residente</option>
              {residents.map((resident) => (
                <option key={resident.id} value={resident.id}>
                  {resident.full_name}
                  {resident.units
                    ? ` | ${resident.units.building ? `${resident.units.building} - ` : ""}${resident.units.identifier}`
                    : ""}
                </option>
              ))}
            </Select>
          )}
          <p className="text-sm text-danger">{errors.residentId?.message}</p>
          {selectedResident ? (
            <p className="text-xs text-muted-foreground">
              WhatsApp principal: {selectedResident.whatsapp_phone || selectedResident.phone}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="accessType">Tipo de acceso</Label>
          <Select id="accessType" {...register("accessType")}>
            {invitationAccessTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <p className="text-sm text-danger">{errors.accessType?.message}</p>
        </div>

        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="visitorName">
            {accessType === "delivery" ? "Nombre del repartidor o empresa" : "Nombre del visitante"}
          </Label>
          <Input
            id="visitorName"
            placeholder={
              accessType === "delivery"
                ? "Opcional para delivery rapido"
                : "Ejemplo: Carlos Rojas"
            }
            {...register("visitorName")}
          />
          <p className="text-sm text-danger">{errors.visitorName?.message}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="credentialType">Presentacion del acceso</Label>
          <Select id="credentialType" {...register("credentialType")}>
            {credentialTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <p className="text-sm text-danger">{errors.credentialType?.message}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="visitDate">Fecha</Label>
          <Input id="visitDate" type="date" {...register("visitDate")} />
          <p className="text-sm text-danger">{errors.visitDate?.message}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="windowStart">Desde</Label>
          <Input id="windowStart" type="time" {...register("windowStart")} />
          <p className="text-sm text-danger">{errors.windowStart?.message}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="windowEnd">Hasta</Label>
          <Input id="windowEnd" type="time" {...register("windowEnd")} />
          <p className="text-sm text-danger">{errors.windowEnd?.message}</p>
        </div>

        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="notes">Notas</Label>
          <Textarea
            id="notes"
            placeholder="Opcional: placa del vehiculo, motivo de visita o referencia para garita."
            {...register("notes")}
          />
          <p className="text-sm text-danger">{errors.notes?.message}</p>
        </div>
      </div>

      <FormMessage message={serverError} variant="error" />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creando invitacion..." : "Crear invitacion"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/app/invitations")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
