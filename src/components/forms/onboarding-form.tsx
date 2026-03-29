"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormMessage } from "@/components/forms/form-message";
import { LogoUploadField } from "@/components/forms/logo-upload-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  accessPolicyOptions,
  gateOperationOptions,
} from "@/lib/domain/types";
import { onboardingSchema, type OnboardingInput } from "@/lib/schemas/community";

type OnboardingFormProps = {
  sessionUser: {
    fullName: string;
    email: string;
  };
};

export function OnboardingForm({ sessionUser }: OnboardingFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: "",
      address: "",
      locationLabel: "",
      plannedUnitCount: 20,
      accessPolicyMode: "invitation_or_guard_confirmation",
      accessPolicyNotes: "",
      adminContactName: sessionUser.fullName,
      adminContactPhone: "",
      adminContactEmail: sessionUser.email,
      gateOperationMode: "24_7_guarded",
      gateOperationNotes: "",
      logoUrl: "",
    },
  });

  const logoUrl = watch("logoUrl") ?? "";

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/community/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json()) as { error?: string; redirectTo?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setServerError(payload.error ?? "No fue posible completar la configuracion.");
      return;
    }

    router.push(payload.redirectTo ?? "/app/dashboard");
    router.refresh();
  });

  return (
    <form className="space-y-8" onSubmit={onSubmit}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="name">Nombre de la comunidad</Label>
          <Input id="name" placeholder="Residencias Altos del Este" {...register("name")} />
          <p className="text-sm text-danger">{errors.name?.message}</p>
        </div>

        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="address">Direccion principal</Label>
          <Input
            id="address"
            placeholder="Av. Principal, sector El Mirador"
            {...register("address")}
          />
          <p className="text-sm text-danger">{errors.address?.message}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="locationLabel">Referencia o ubicacion</Label>
          <Input
            id="locationLabel"
            placeholder="Caracas, municipio Baruta"
            {...register("locationLabel")}
          />
          <p className="text-sm text-danger">{errors.locationLabel?.message}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="plannedUnitCount">Cantidad de unidades</Label>
          <Input
            id="plannedUnitCount"
            type="number"
            min={1}
            max={5000}
            {...register("plannedUnitCount", { valueAsNumber: true })}
          />
          <p className="text-sm text-danger">{errors.plannedUnitCount?.message}</p>
          <p className="text-xs text-muted-foreground">
            Se crearan unidades base numeradas para que luego puedas editarlas.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="accessPolicyMode">Politica basica de acceso</Label>
          <Select id="accessPolicyMode" {...register("accessPolicyMode")}>
            {accessPolicyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <p className="text-sm text-danger">{errors.accessPolicyMode?.message}</p>
          <p className="text-xs text-muted-foreground">
            {
              accessPolicyOptions.find(
                (option) => option.value === "invitation_or_guard_confirmation",
              )?.description
            }
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gateOperationMode">Operacion basica de garita</Label>
          <Select id="gateOperationMode" {...register("gateOperationMode")}>
            {gateOperationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <p className="text-sm text-danger">{errors.gateOperationMode?.message}</p>
        </div>

        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="accessPolicyNotes">Notas operativas de acceso</Label>
          <Textarea
            id="accessPolicyNotes"
            placeholder="Ejemplo: visitantes sin invitacion requieren confirmacion telefonica con el residente."
            {...register("accessPolicyNotes")}
          />
          <p className="text-sm text-danger">{errors.accessPolicyNotes?.message}</p>
        </div>

        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="gateOperationNotes">Notas de operacion de garita</Label>
          <Textarea
            id="gateOperationNotes"
            placeholder="Ejemplo: cambio de turno a las 7:00 AM y 7:00 PM, con entrega de novedades."
            {...register("gateOperationNotes")}
          />
          <p className="text-sm text-danger">{errors.gateOperationNotes?.message}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="adminContactName">Contacto administrativo</Label>
          <Input id="adminContactName" placeholder="Nombre del responsable" {...register("adminContactName")} />
          <p className="text-sm text-danger">{errors.adminContactName?.message}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adminContactPhone">Telefono o WhatsApp</Label>
          <Input id="adminContactPhone" placeholder="+58 412 000 0000" {...register("adminContactPhone")} />
          <p className="text-sm text-danger">{errors.adminContactPhone?.message}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adminContactEmail">Correo administrativo</Label>
          <Input
            id="adminContactEmail"
            type="email"
            placeholder="admin@residencia.com"
            {...register("adminContactEmail")}
          />
          <p className="text-sm text-danger">{errors.adminContactEmail?.message}</p>
        </div>

        <div className="space-y-2">
          <input type="hidden" {...register("logoUrl")} />
          <LogoUploadField
            error={errors.logoUrl?.message}
            label="Logo opcional"
            value={logoUrl}
            onChange={(value) => {
              setValue("logoUrl", value, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              });
            }}
          />
        </div>
      </div>

      <FormMessage message={serverError} variant="error" />
      <Button className="w-full sm:w-auto" size="lg" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Guardando configuracion..." : "Completar onboarding"}
      </Button>
    </form>
  );
}
