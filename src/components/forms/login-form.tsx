"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type LoginInput, loginSchema } from "@/lib/schemas/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const redirectTo = searchParams.get("redirectTo") ?? "/app";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json()) as { error?: string; redirectTo?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setServerError(payload.error ?? "No fue posible iniciar sesion.");
      return;
    }

    router.push(payload.redirectTo ?? redirectTo);
    router.refresh();
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="email">Correo electronico</Label>
        <Input
          id="email"
          type="email"
          placeholder="tu@correo.com"
          autoComplete="email"
          {...register("email")}
        />
        <p className="text-sm text-danger">{errors.email?.message}</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="password">Contrasena</Label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary transition hover:text-primary/80"
          >
            Olvidaste tu clave?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          {...register("password")}
        />
        <p className="text-sm text-danger">{errors.password?.message}</p>
      </div>
      <FormMessage message={serverError} variant="error" />
      <Button className="w-full" size="lg" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Ingresando..." : "Entrar a Ventry"}
      </Button>
      <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
        Usa el correo y la clave entregados por la administracion. Si eres admin inicial,
        puedes crear tu cuenta desde el registro.
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Primera vez aqui?{" "}
        <Link href="/signup" className="font-semibold text-primary hover:text-primary/80">
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}
