"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const requestedRedirectTo = searchParams.get("redirectTo");
  const redirectTo = requestedRedirectTo?.startsWith("/app") ? requestedRedirectTo : "/app";

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

    router.push(redirectTo === "/app" ? (payload.redirectTo ?? redirectTo) : redirectTo);
    router.refresh();
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
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
          <Label htmlFor="password">Contraseña</Label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary transition hover:text-primary/80"
          >
            Olvidaste tu clave?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            className="pr-12"
            {...register("password")}
          />
          <button
            type="button"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-sm text-danger">{errors.password?.message}</p>
      </div>
      <FormMessage message={serverError} variant="error" />
      <Button className="w-full" size="lg" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Ingresando..." : "Entrar a Ventry"}
      </Button>
      <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
        Usa el correo y la clave entregados por la administración. Si eres admin inicial,
        puedes crear tu cuenta desde el registro.
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Primera vez aquí?{" "}
        <Link href="/signup" className="font-semibold text-primary hover:text-primary/80">
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}
