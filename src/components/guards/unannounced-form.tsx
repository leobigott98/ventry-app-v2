"use client";

import { AlertTriangle, LoaderCircle, UserCheck } from "lucide-react";
import { useState } from "react";

import type { ResidentOption, UnannouncedFormValue } from "@/components/guards/guard-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialValue: UnannouncedFormValue = {
  visitorName: "",
  residentId: "",
  accessType: "visitor",
  notes: "",
};

export function UnannouncedForm({
  isSubmitting,
  onSubmit,
  residents,
}: {
  isSubmitting: boolean;
  onSubmit: (value: UnannouncedFormValue) => Promise<boolean>;
  residents: ResidentOption[];
}) {
  const [value, setValue] = useState(initialValue);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onSubmit(value)) setValue(initialValue);
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      <div className="flex gap-3 rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm text-warning">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <p>Confirma con el residente antes de registrar. Este formulario crea una entrada real y auditada.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="unannouncedName">Nombre del visitante</Label>
        <Input
          id="unannouncedName"
          autoComplete="name"
          className="h-14 text-lg"
          onChange={(event) => setValue((current) => ({ ...current, visitorName: event.target.value }))}
          placeholder="Carlos Rojas"
          required
          value={value.visitorName}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="unannouncedResident">Residente / unidad</Label>
          <Select
            id="unannouncedResident"
            onChange={(event) => setValue((current) => ({ ...current, residentId: event.target.value }))}
            value={value.residentId}
          >
            <option value="">Sin seleccionar</option>
            {residents.map((resident) => (
              <option key={resident.id} value={resident.id}>
                {resident.full_name}{resident.units ? ` · ${resident.units.building ? `${resident.units.building} ` : ""}${resident.units.identifier}` : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="unannouncedType">Tipo</Label>
          <Select
            id="unannouncedType"
            onChange={(event) => setValue((current) => ({ ...current, accessType: event.target.value as UnannouncedFormValue["accessType"] }))}
            value={value.accessType}
          >
            <option value="visitor">Visita</option>
            <option value="service_provider">Proveedor</option>
            <option value="delivery">Delivery</option>
            <option value="frequent_visitor">Visitante frecuente</option>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="unannouncedNotes">Notas</Label>
        <Textarea
          id="unannouncedNotes"
          onChange={(event) => setValue((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Motivo o confirmación recibida (opcional)"
          value={value.notes}
        />
      </div>
      <Button aria-busy={isSubmitting} className="h-14 w-full text-base" disabled={isSubmitting} type="submit">
        {isSubmitting ? <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" /> : <UserCheck aria-hidden="true" className="h-5 w-5" />}
        {isSubmitting ? "Esperando al servidor…" : "Registrar visitante"}
      </Button>
    </form>
  );
}
