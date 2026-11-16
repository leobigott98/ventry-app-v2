"use client";

import { CarFront, LoaderCircle } from "lucide-react";
import { useState } from "react";

import type { ResidentOption, VehicleFormValue } from "@/components/guards/guard-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialValue: VehicleFormValue = {
  vehiclePlate: "",
  driverName: "",
  residentId: "",
  accessType: "visitor",
  notes: "",
};

export function VehicleForm({
  isSubmitting,
  onSubmit,
  residents,
}: {
  isSubmitting: boolean;
  onSubmit: (value: VehicleFormValue) => Promise<boolean>;
  residents: ResidentOption[];
}) {
  const [value, setValue] = useState(initialValue);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onSubmit(value)) setValue(initialValue);
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vehiclePlate">Placa</Label>
          <Input
            id="vehiclePlate"
            autoCapitalize="characters"
            className="h-14 text-lg uppercase"
            onChange={(event) => setValue((current) => ({ ...current, vehiclePlate: event.target.value.toUpperCase() }))}
            placeholder="AB123CD"
            required
            value={value.vehiclePlate}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vehicleDriver">Conductor</Label>
          <Input
            id="vehicleDriver"
            className="h-14 text-lg"
            onChange={(event) => setValue((current) => ({ ...current, driverName: event.target.value }))}
            placeholder="Opcional"
            value={value.driverName}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vehicleResident">Residente / unidad</Label>
          <Select
            id="vehicleResident"
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
          <Label htmlFor="vehicleType">Tipo</Label>
          <Select
            id="vehicleType"
            onChange={(event) => setValue((current) => ({ ...current, accessType: event.target.value as VehicleFormValue["accessType"] }))}
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
        <Label htmlFor="vehicleNotes">Notas</Label>
        <Textarea
          id="vehicleNotes"
          onChange={(event) => setValue((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Descripción del vehículo o motivo (opcional)"
          value={value.notes}
        />
      </div>
      <Button aria-busy={isSubmitting} className="h-14 w-full text-base" disabled={isSubmitting} type="submit">
        {isSubmitting ? <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" /> : <CarFront aria-hidden="true" className="h-5 w-5" />}
        {isSubmitting ? "Esperando al servidor…" : "Registrar vehículo"}
      </Button>
    </form>
  );
}
