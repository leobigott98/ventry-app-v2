import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/forms/onboarding-form";
import { SectionShell } from "@/components/layout/section-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCommunityContextForEmail } from "@/lib/domain/community";
import { getSessionUserOrRedirect } from "@/lib/domain/session-context";

export default async function OnboardingPage() {
  const sessionUser = await getSessionUserOrRedirect();

  if (sessionUser.role !== "admin") {
    redirect("/app");
  }

  const existingCommunity = await getCommunityContextForEmail(sessionUser.email);

  if (existingCommunity) {
    redirect("/app/dashboard");
  }

  return (
    <SectionShell
      eyebrow="Sprint 1"
      title="Configura tu comunidad"
      description="Este onboarding crea la base operativa: perfil de la comunidad, unidades iniciales, contacto administrativo y reglas basicas para empezar a trabajar."
    >
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>Onboarding de comunidad</CardTitle>
            <CardDescription>
              Mantenlo simple. Lo importante ahora es dejar lista la estructura para residentes, accesos e historial.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm
              sessionUser={{ fullName: sessionUser.fullName, email: sessionUser.email }}
            />
          </CardContent>
        </Card>

        <Card className="border-white/70 bg-white/90">
          <CardHeader>
            <CardTitle>Que ocurrira al guardar</CardTitle>
            <CardDescription>
              Ventry creara la base minima de la comunidad y te llevara al dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Se crea la comunidad con sus politicas basicas y contacto principal.",
              "Se registra tu usuario actual como administrador primario.",
              "Se generan unidades base numeradas para que luego las ajustes.",
              "Queda lista la estructura de roles para admins y guardias.",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-border bg-secondary/35 p-4 text-sm leading-6">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}
