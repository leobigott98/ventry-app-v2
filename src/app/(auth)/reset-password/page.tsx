import { Suspense } from "react";

import { AuthShell } from "@/components/forms/auth-shell";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Recuperacion segura"
      title="Nueva contrasena"
      description="Actualiza tu clave para volver a entrar a la operacion de acceso."
    >
      <Suspense
        fallback={
          <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
            Cargando recuperacion...
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
