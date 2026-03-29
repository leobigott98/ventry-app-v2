import { AuthShell } from "@/components/forms/auth-shell";
import { SignupForm } from "@/components/forms/signup-form";

export default function SignupPage() {
  return (
    <AuthShell
      eyebrow="Configuracion inicial"
      title="Crear cuenta"
      description="Registro pensado para el administrador inicial de la comunidad. Guardias y residentes reciben acceso luego desde la plataforma."
    >
      <SignupForm />
    </AuthShell>
  );
}
