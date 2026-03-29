"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ResidentRecord, UnitRecord } from "@/lib/domain/types";
import { residentSchema, type ResidentInput } from "@/lib/schemas/community";

type ResidentFormProps = {
  mode: "create" | "edit";
  resident?: ResidentRecord | null;
  units: UnitRecord[];
};

export function ResidentForm({ mode, resident, units }: ResidentFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResidentInput>({
    resolver: zodResolver(residentSchema),
    defaultValues: {
      fullName: resident?.full_name ?? "",
      phone: resident?.phone ?? "",
      whatsappPhone: resident?.whatsapp_phone ?? "",
      email: resident?.email ?? "",
      unitId: resident?.unit_id ?? "",
      isActive: resident?.is_active ?? true,
      notes: resident?.notes ?? "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setIsSubmitting(true);

    const endpoint = mode === "create" ? "/api/residents" : `/api/residents/${resident?.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json()) as { error?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setServerError(payload.error ?? "No fue posible guardar el residente.");
      return;
    }

    router.push("/app/residents");
    router.refresh();
  });

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input id="fullName" placeholder="Maria Fernanda Perez" {...register("fullName")} />
          <p className="text-sm text-danger">{errors.fullName?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="unitId">Unidad</Label>
          <Select id="unitId" {...register("unitId")}>
            <option value="">Sin asignar</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.building ? `${unit.building} - ` : ""}
                {unit.identifier}
              </option>
            ))}
          </Select>
          <p className="text-sm text-danger">{errors.unitId?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefono principal</Label>
          <Input id="phone" placeholder="+58 412 000 0000" {...register("phone")} />
          <p className="text-sm text-danger">{errors.phone?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsappPhone">WhatsApp</Label>
          <Input id="whatsappPhone" placeholder="+58 412 000 0000" {...register("whatsappPhone")} />
          <p className="text-sm text-danger">{errors.whatsappPhone?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Correo opcional</Label>
          <Input id="email" type="email" placeholder="residente@correo.com" {...register("email")} />
          <p className="text-sm text-danger">{errors.email?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="isActive">Estado</Label>
          <Select
            id="isActive"
            {...register("isActive", { setValueAs: (value) => value === "true" })}
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </Select>
          <p className="text-sm text-danger">{errors.isActive?.message}</p>
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="notes">Notas</Label>
          <Textarea
            id="notes"
            placeholder="Ejemplo: propietario, contacto secundario, o detalle operativo relevante."
            {...register("notes")}
          />
          <p className="text-sm text-danger">{errors.notes?.message}</p>
        </div>
      </div>

      <FormMessage message={serverError} variant="error" />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting
            ? "Guardando..."
            : mode === "create"
              ? "Crear residente"
              : "Guardar residente"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/app/residents")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
