"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type SignupInput, signupSchema } from "@/lib/schemas/auth";

import { Eye, EyeOff } from "lucide-react";

export function SignupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isShowingPassword, setIsShowingPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      communityName: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = (await response.json()) as { error?: string; redirectTo?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setServerError(payload.error ?? "No fue posible crear la cuenta.");
      return;
    }

    router.push(payload.redirectTo ?? "/app/onboarding");
    router.refresh();
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="fullName">Nombre completo</Label>
        <Input id="fullName" placeholder="Maria Fernanda Perez" {...register("fullName")} />
        <p className="text-sm text-danger">{errors.fullName?.message}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="communityName">Residencia o conjunto</Label>
        <Input
          id="communityName"
          placeholder="Residencias Altos del Este"
          {...register("communityName")}
        />
        <p className="text-sm text-danger">{errors.communityName?.message}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Correo electronico</Label>
        <Input id="email" type="email" placeholder="tu@correo.com" {...register("email")} />
        <p className="text-sm text-danger">{errors.email?.message}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <div className="relative">
          <Input
          id="password"
          type={isShowingPassword ? "text" : "password"}
          placeholder="Crea una contraseña"
          {...register("password")}
          />
          <button
            type="button"
            aria-label={isShowingPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
            onClick={() => setIsShowingPassword(!isShowingPassword)}
          >
            {isShowingPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
        
        <p className="text-sm text-danger">{errors.password?.message}</p>
      </div>
      <FormMessage message={serverError} variant="error" />
      <Button className="w-full" size="lg" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
      </Button>
      <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
        Este registro crea el acceso del administrador principal. Los demás usuarios se habilitan
        después desde Ajustes o Residentes.
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Ya tienes acceso?{" "}
        <Link href="/login" className="font-semibold text-primary hover:text-primary/80">
          Iniciar sesión
        </Link>
      </p>
    </form>
  );
}
