"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/schemas/auth";

export function ResetPasswordForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      accessToken: "",
      refreshToken: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);

    setValue("accessToken", params.get("access_token") ?? "", {
      shouldValidate: false,
    });
    setValue("refreshToken", params.get("refresh_token") ?? "", {
      shouldValidate: false,
    });
  }, [setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json()) as { error?: string; message?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setServerError(payload.error ?? "No fue posible actualizar la contrasena.");
      return;
    }

    setSuccessMessage(payload.message ?? "Contrasena actualizada.");
    window.setTimeout(() => {
      router.push("/login");
      router.refresh();
    }, 1200);
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <input type="hidden" {...register("accessToken")} />
      <input type="hidden" {...register("refreshToken")} />
      <div className="space-y-2">
        <Label htmlFor="password">Nueva contrasena</Label>
        <Input id="password" type="password" placeholder="Crea una contrasena" {...register("password")} />
        <p className="text-sm text-danger">{errors.password?.message}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmar contrasena</Label>
        <Input id="confirmPassword" type="password" placeholder="Repite la contrasena" {...register("confirmPassword")} />
        <p className="text-sm text-danger">{errors.confirmPassword?.message}</p>
      </div>
      <FormMessage message={serverError} variant="error" />
      <FormMessage message={successMessage} />
      <Button className="w-full" size="lg" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Actualizando..." : "Guardar nueva contrasena"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-semibold text-primary hover:text-primary/80">
          Volver a iniciar sesion
        </Link>
      </p>
    </form>
  );
}
