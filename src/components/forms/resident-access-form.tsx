"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MembershipRecord, ResidentRecord } from "@/lib/domain/types";
import {
  residentAccessSchema,
  type ResidentAccessInput,
} from "@/lib/schemas/access";

type ResidentAccessFormProps = {
  resident: ResidentRecord;
  accessMembership: MembershipRecord | null;
};

export function ResidentAccessForm({
  resident,
  accessMembership,
}: ResidentAccessFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResidentAccessInput>({
    resolver: zodResolver(residentAccessSchema),
    defaultValues: {
      email: accessMembership?.email ?? resident.email ?? "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/residents/${resident.id}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setServerError(payload.error ?? "No fue posible habilitar el acceso.");
      return;
    }

    setSuccessMessage(payload.message ?? "Acceso habilitado.");
    router.refresh();
  });

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="email">Correo de acceso</Label>
          <Input id="email" type="email" placeholder="residente@correo.com" {...register("email")} />
          <p className="text-sm text-danger">{errors.email?.message}</p>
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="password">
            {accessMembership ? "Nueva contrasena temporal" : "Contrasena temporal"}
          </Label>
          <Input id="password" type="password" placeholder="Minimo 8 caracteres" {...register("password")} />
          <p className="text-sm text-danger">{errors.password?.message}</p>
          <p className="text-xs text-muted-foreground">
            Esta clave se comparte una sola vez con el residente para su primer acceso.
          </p>
        </div>
      </div>

      <FormMessage message={serverError} variant="error" />
      <FormMessage message={successMessage} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting
            ? "Guardando..."
            : accessMembership
              ? "Actualizar acceso"
              : "Habilitar acceso"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/app/residents")}>
          Volver
        </Button>
      </div>
    </form>
  );
}
