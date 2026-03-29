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
import type { CommunityRecord } from "@/lib/domain/types";
import {
  accessPolicyOptions,
  gateOperationOptions,
} from "@/lib/domain/types";
import {
  communityProfileSchema,
  type CommunityProfileInput,
} from "@/lib/schemas/community";

type CommunityProfileFormProps = {
  community: CommunityRecord;
};

export function CommunityProfileForm({ community }: CommunityProfileFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CommunityProfileInput>({
    resolver: zodResolver(communityProfileSchema),
    defaultValues: {
      name: community.name,
      address: community.address,
      locationLabel: community.location_label,
      plannedUnitCount: community.planned_unit_count,
      accessPolicyMode: community.access_policy_mode,
      accessPolicyNotes: community.access_policy_notes ?? "",
      adminContactName: community.admin_contact_name,
      adminContactPhone: community.admin_contact_phone,
      adminContactEmail: community.admin_contact_email ?? "",
      gateOperationMode: community.gate_operation_mode,
      gateOperationNotes: community.gate_operation_notes ?? "",
      logoUrl: community.logo_url ?? "",
    },
  });

  const logoUrl = watch("logoUrl") ?? "";

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const response = await fetch("/api/community/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json()) as { error?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setServerError(payload.error ?? "No fue posible actualizar la comunidad.");
      return;
    }

    setSuccessMessage("Perfil de la comunidad actualizado.");
    router.refresh();
  });

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="name">Nombre de la comunidad</Label>
          <Input id="name" {...register("name")} />
          <p className="text-sm text-danger">{errors.name?.message}</p>
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="address">Direccion principal</Label>
          <Input id="address" {...register("address")} />
          <p className="text-sm text-danger">{errors.address?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="locationLabel">Referencia o ubicacion</Label>
          <Input id="locationLabel" {...register("locationLabel")} />
          <p className="text-sm text-danger">{errors.locationLabel?.message}</p>
        </div>
        <div className="space-y-2">
          <input type="hidden" {...register("logoUrl")} />
          <LogoUploadField
            error={errors.logoUrl?.message}
            label="Logo de la comunidad"
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

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="accessPolicyMode">Politica basica</Label>
          <Select id="accessPolicyMode" {...register("accessPolicyMode")}>
            {accessPolicyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <p className="text-sm text-danger">{errors.accessPolicyMode?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gateOperationMode">Operacion de garita</Label>
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
          <Label htmlFor="accessPolicyNotes">Notas de acceso</Label>
          <Textarea id="accessPolicyNotes" {...register("accessPolicyNotes")} />
          <p className="text-sm text-danger">{errors.accessPolicyNotes?.message}</p>
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="gateOperationNotes">Notas de garita</Label>
          <Textarea id="gateOperationNotes" {...register("gateOperationNotes")} />
          <p className="text-sm text-danger">{errors.gateOperationNotes?.message}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="adminContactName">Contacto administrativo</Label>
          <Input id="adminContactName" {...register("adminContactName")} />
          <p className="text-sm text-danger">{errors.adminContactName?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="adminContactPhone">Telefono o WhatsApp</Label>
          <Input id="adminContactPhone" {...register("adminContactPhone")} />
          <p className="text-sm text-danger">{errors.adminContactPhone?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="adminContactEmail">Correo administrativo</Label>
          <Input id="adminContactEmail" type="email" {...register("adminContactEmail")} />
          <p className="text-sm text-danger">{errors.adminContactEmail?.message}</p>
        </div>
      </div>

      <FormMessage message={serverError} variant="error" />
      <FormMessage message={successMessage} />
      <Button className="w-full sm:w-auto" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
