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
import {
  teamMemberAccessSchema,
  type TeamMemberAccessInput,
} from "@/lib/schemas/access";

export function TeamMemberAccessForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<TeamMemberAccessInput>({
    resolver: zodResolver(teamMemberAccessSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      role: "guard",
      password: "",
      notes: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const response = await fetch("/api/access/team-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setServerError(payload.error ?? "No fue posible crear el acceso.");
      return;
    }

    setSuccessMessage(payload.message ?? "Acceso creado.");
    reset({
      fullName: "",
      email: "",
      phone: "",
      role: "guard",
      password: "",
      notes: "",
    });
    router.refresh();
  });

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input id="fullName" placeholder="Luis Mendoza" {...register("fullName")} />
          <p className="text-sm text-danger">{errors.fullName?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Rol</Label>
          <Select id="role" {...register("role")}>
            <option value="guard">Guardia</option>
            <option value="admin">Administrador</option>
          </Select>
          <p className="text-sm text-danger">{errors.role?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" type="email" placeholder="equipo@comunidad.com" {...register("email")} />
          <p className="text-sm text-danger">{errors.email?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefono o WhatsApp</Label>
          <Input id="phone" placeholder="+58 412 000 0000" {...register("phone")} />
          <p className="text-sm text-danger">{errors.phone?.message}</p>
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="password">Contrasena temporal</Label>
          <Input id="password" type="password" placeholder="Minimo 8 caracteres" {...register("password")} />
          <p className="text-sm text-danger">{errors.password?.message}</p>
          <p className="text-xs text-muted-foreground">
            Comparte esta clave con la persona y recomiendale cambiarla luego desde recuperacion.
          </p>
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="notes">Notas</Label>
          <Textarea id="notes" placeholder="Turno nocturno, administrador suplente, etc." {...register("notes")} />
          <p className="text-sm text-danger">{errors.notes?.message}</p>
        </div>
      </div>

      <FormMessage message={serverError} variant="error" />
      <FormMessage message={successMessage} />
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Guardando..." : "Crear acceso de equipo"}
      </Button>
    </form>
  );
}
