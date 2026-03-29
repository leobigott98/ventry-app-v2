import { AuthShell } from "@/components/forms/auth-shell";
import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Recuperacion de acceso"
      title="Restablecer contrasena"
      description="Recupera el acceso sin friccion para volver a operar el control de entradas."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
