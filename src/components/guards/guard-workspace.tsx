"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CarFront, Phone, QrCode, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ActivityFeed } from "@/components/guards/activity-feed";
import { GuardConsoleNavigation } from "@/components/guards/guard-console-navigation";
import { GuardFeedback } from "@/components/guards/guard-feedback";
import { GuardPageHeader } from "@/components/guards/guard-page-header";
import type {
  CredentialMode,
  GuardSection,
  GuardWorkspaceProps,
  ManualMode,
} from "@/components/guards/guard-types";
import { useCredentialValidation } from "@/components/guards/hooks/use-credential-validation";
import { useGuardOperations } from "@/components/guards/hooks/use-guard-operations";
import { InsideList } from "@/components/guards/inside-list";
import { InvitationSearch } from "@/components/guards/invitation-search";
import { UnannouncedForm } from "@/components/guards/unannounced-form";
import { ValidationPanel } from "@/components/guards/validation-panel";
import { VehicleForm } from "@/components/guards/vehicle-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeQrCredential } from "@/lib/qr-credentials";
import { cn } from "@/lib/utils";

const sectionTitles = {
  validate: {
    icon: QrCode,
    title: "Validar entrada",
  },
  inside: {
    icon: Users,
    title: "Personas dentro del conjunto",
  },
  unannounced: {
    icon: UserPlus,
    title: "Registrar acceso sin invitación",
  },
} satisfies Record<GuardSection, { title: string; icon: typeof Users }>;

function formatGuardDate() {
  return new Intl.DateTimeFormat("es-VE", { dateStyle: "full" }).format(new Date());
}

export function GuardWorkspace({
  communityName = "Comunidad",
  residents,
  recentInvitations,
  openEntries: initialOpenEntries,
  recentEvents,
}: GuardWorkspaceProps) {
  const router = useRouter();
  const query = useSearchParams().toString();
  const [activeSection, setActiveSection] = useState<GuardSection>("validate");
  const [credentialMode, setCredentialMode] = useState<CredentialMode>("pin");
  const [manualMode, setManualMode] = useState<ManualMode>("unannounced");
  const appliedQueryRef = useRef<string | null>(null);
  const processedDeepLinksRef = useRef(new Set<string>());
  const refreshServerData = useCallback(() => router.refresh(), [router]);
  const {
    credentialValue,
    reset: resetValidation,
    setCredentialValue,
    state: validationState,
    updateMatch: updateValidationMatch,
    validate: validateCredential,
  } = useCredentialValidation(refreshServerData);
  const operations = useGuardOperations({
    initialInvitations: recentInvitations,
    initialOpenEntries,
    initialRecentActivity: recentEvents,
    onServerMutation: refreshServerData,
    updateValidationMatch,
  });

  useEffect(() => {
    if (appliedQueryRef.current === query) return;
    appliedQueryRef.current = query;
    const searchParams = new URLSearchParams(query);
    const action = searchParams.get("action");
    if (action === "pin" || action === "qr") {
      setActiveSection("validate");
      setCredentialMode(action);
    } else if (action === "unannounced" || action === "vehicle") {
      setActiveSection("unannounced");
      setManualMode(action);
    }

    const scannedQr =
      searchParams.get("qr") || searchParams.get("credential") || searchParams.get("code");
    if (!scannedQr) return;

    const credential = normalizeQrCredential(scannedQr);
    const deepLinkKey = `${query}:${credential}`;
    if (!credential || processedDeepLinksRef.current.has(deepLinkKey)) return;

    processedDeepLinksRef.current.add(deepLinkKey);
    setActiveSection("validate");
    setCredentialMode("qr");
    setCredentialValue(credential);
    void validateCredential("qr", credential);
  }, [query, setCredentialValue, validateCredential]);

  function changeCredentialMode(mode: CredentialMode) {
    if (mode === credentialMode) return;
    setCredentialMode(mode);
    setCredentialValue("");
    resetValidation();
  }

  const heading = sectionTitles[activeSection];

  return (
    <section className="space-y-4">
      <GuardConsoleNavigation
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <GuardPageHeader {...heading} description={`${communityName} · ${formatGuardDate()}`}>
        <Badge variant="success">{operations.openEntries.length} adentro</Badge>
        <Badge variant="outline">{operations.activeInvitationCount} invitaciones activas</Badge>
      </GuardPageHeader>
      {operations.flash ? <GuardFeedback flash={operations.flash} /> : null}

      {activeSection === "validate" ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <ValidationPanel
            credentialValue={credentialValue}
            isPending={operations.isPending}
            mode={credentialMode}
            onCredentialChange={(value) => {
              setCredentialValue(value);
              resetValidation();
            }}
            onEventGuestEntry={(eventId, guestId, companions) =>
              void operations.registerEventGuest(eventId, guestId, companions)
            }
            onExit={(entryId) => void operations.registerExit(entryId)}
            onInvitationEntry={(invitationId) =>
              void operations.registerInvitationEntry(invitationId)
            }
            onModeChange={changeCredentialMode}
            onReject={(match) => void operations.rejectAccess(match)}
            onValidate={validateCredential}
            state={validationState}
          />
          <div className="space-y-4">
            <InvitationSearch
              invitations={operations.invitationFeed}
              isPending={operations.isPending}
              onRegisterEntry={(invitationId) =>
                void operations.registerInvitationEntry(invitationId)
              }
            />
            <ActivityFeed events={operations.recentActivity} />
          </div>
        </div>
      ) : null}

      {activeSection === "inside" ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
          <InsideList
            entries={operations.openEntries}
            isPending={operations.isPending}
            onExit={(entryId) => void operations.registerExit(entryId)}
          />
          <ActivityFeed events={operations.recentActivity} />
        </div>
      ) : null}

      {activeSection === "unannounced" ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Registro manual</CardTitle>
              <CardDescription>Selecciona el tipo y espera la confirmación del servidor antes de permitir el paso.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1.5" role="tablist" aria-label="Tipo de registro manual">
                {([
                  { id: "unannounced" as const, label: "Persona", icon: UserPlus },
                  { id: "vehicle" as const, label: "Vehículo", icon: CarFront },
                ]).map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      aria-selected={manualMode === item.id}
                      className={cn(
                        "flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold",
                        manualMode === item.id ? "bg-surface text-primary shadow-sm" : "text-muted-foreground",
                      )}
                      onClick={() => setManualMode(item.id)}
                      role="tab"
                      type="button"
                    >
                      <Icon aria-hidden="true" className="h-5 w-5" /> {item.label}
                    </button>
                  );
                })}
              </div>
              {manualMode === "unannounced" ? (
                <UnannouncedForm
                  isSubmitting={operations.manualPending === "unannounced"}
                  onSubmit={async (value) => Boolean(await operations.submitManual("unannounced", value))}
                  residents={residents}
                />
              ) : (
                <VehicleForm
                  isSubmitting={operations.manualPending === "vehicle"}
                  onSubmit={async (value) => Boolean(await operations.submitManual("vehicle", value))}
                  residents={residents}
                />
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-primary/20 bg-secondary/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Phone aria-hidden="true" className="h-5 w-5 text-primary" /> Confirmar con residente</CardTitle>
                <CardDescription>Consulta el directorio real de residentes y unidades. El intercom se implementará en una tarea posterior.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="h-14 w-full text-base">
                  <Link href="/app/guards/call-resident"><Users aria-hidden="true" className="h-5 w-5" /> Abrir directorio</Link>
                </Button>
              </CardContent>
            </Card>
            <ActivityFeed events={operations.recentActivity} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
