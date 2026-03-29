import { Suspense } from "react";

import { AuthShell } from "@/components/forms/auth-shell";
import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Acceso seguro"
      title="Iniciar sesion"
      description="Entra a tu operacion de acceso, revisa actividad y prepara el siguiente visitante."
    >
      <Suspense
        fallback={
          <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
            Cargando acceso...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
