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
import type { UnitRecord } from "@/lib/domain/types";
import { unitSchema, type UnitInput } from "@/lib/schemas/community";

type UnitFormProps = {
  mode: "create" | "edit";
  unit?: UnitRecord | null;
};

export function UnitForm({ mode, unit }: UnitFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UnitInput>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      identifier: unit?.identifier ?? "",
      building: unit?.building ?? "",
      isActive: unit?.is_active ?? true,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setIsSubmitting(true);

    const endpoint = mode === "create" ? "/api/units" : `/api/units/${unit?.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json()) as { error?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setServerError(payload.error ?? "No fue posible guardar la unidad.");
      return;
    }

    router.push("/app/units");
    router.refresh();
  });

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="identifier">Identificador</Label>
          <Input id="identifier" placeholder="101 o Casa 12" {...register("identifier")} />
          <p className="text-sm text-danger">{errors.identifier?.message}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="building">Torre o edificio</Label>
          <Input id="building" placeholder="Torre A" {...register("building")} />
          <p className="text-sm text-danger">{errors.building?.message}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="isActive">Estado</Label>
          <Select
            id="isActive"
            {...register("isActive", { setValueAs: (value) => value === "true" })}
          >
            <option value="true">Activa</option>
            <option value="false">Inactiva</option>
          </Select>
          <p className="text-sm text-danger">{errors.isActive?.message}</p>
        </div>
      </div>

      <FormMessage message={serverError} variant="error" />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting
            ? "Guardando..."
            : mode === "create"
              ? "Crear unidad"
              : "Guardar unidad"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/app/units")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
