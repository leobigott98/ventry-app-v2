"use client";

import Link from "next/link";
import { AlertCircle, CarFront, LoaderCircle, QrCode, Search, ShieldCheck, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { InvitationStatusBadge } from "@/components/invitations/invitation-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getInvitationAccessTypeLabel,
  getInvitationStatusLabel,
  getInvitationStatusVariant,
} from "@/lib/domain/invitations";
import type {
  AccessEventRecord,
  InvitationAccessType,
  InvitationStatus,
  ResidentRecord,
  UnitRecord,
  VisitorEntryRecord,
} from "@/lib/domain/types";

type ResidentOption = ResidentRecord & {
  units: Pick<UnitRecord, "identifier" | "building"> | null;
};

type GuardInvitation = {
  id: string;
  visitor_name: string | null;
  access_type: InvitationAccessType;
  visit_date: string;
  window_start: string;
  window_end: string;
  status: "active" | "used" | "revoked";
  residents: { full_name: string } | null;
  units: { identifier: string; building: string | null } | null;
  access_credentials: { credential_type: "pin" | "qr"; credential_value: string } | null;
  effective_status?: InvitationStatus;
};

type OpenEntry = VisitorEntryRecord & {
  residents: { full_name: string; phone: string; whatsapp_phone: string | null } | null;
  units: { identifier: string; building: string | null } | null;
};

type ValidationMatch = {
  invitation: GuardInvitation & { effective_status: InvitationStatus; status_label: string };
  openEntry: OpenEntry | null;
};

type GuardWorkspaceProps = {
  residents: ResidentOption[];
  recentInvitations: GuardInvitation[];
  openEntries: OpenEntry[];
  recentEvents: AccessEventRecord[];
};

function formatUnit(unit: { identifier: string; building: string | null } | null) {
  return unit ? `${unit.building ? `${unit.building} - ` : ""}${unit.identifier}` : "Sin unidad";
}

const actionLabels = {
  pin: "Validar PIN",
  qr: "QR",
  unannounced: "No anunciado",
  vehicle: "Vehiculo",
} as const;

const actionCards: Array<{
  icon: typeof ShieldCheck;
  id: keyof typeof actionLabels;
  label: string;
  description: string;
}> = [
  {
    icon: ShieldCheck,
    id: "pin",
    label: "Validar PIN",
    description: "Mas rapido para la garita.",
  },
  {
    icon: QrCode,
    id: "qr",
    label: "QR",
    description: "Base lista para escaneo.",
  },
  {
    icon: UserPlus,
    id: "unannounced",
    label: "No anunciado",
    description: "Registro express.",
  },
  {
    icon: CarFront,
    id: "vehicle",
    label: "Vehiculo",
    description: "Placa y entrada manual.",
  },
];

export function GuardWorkspace({
  residents,
  recentInvitations,
  openEntries: initialOpenEntries,
  recentEvents,
}: GuardWorkspaceProps) {
  const [activeAction, setActiveAction] = useState<keyof typeof actionLabels>("pin");
  const [flash, setFlash] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const [invitationFeed, setInvitationFeed] = useState(recentInvitations);
  const [openEntries, setOpenEntries] = useState(initialOpenEntries);
  const [recentActivity, setRecentActivity] = useState(recentEvents);

  const [credentialValue, setCredentialValue] = useState("");
  const [validationMatch, setValidationMatch] = useState<ValidationMatch | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GuardInvitation[]>(recentInvitations);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [unannouncedForm, setUnannouncedForm] = useState({
    visitorName: "",
    residentId: "",
    accessType: "visitor" as InvitationAccessType,
    notes: "",
  });
  const [vehicleForm, setVehicleForm] = useState({
    vehiclePlate: "",
    driverName: "",
    residentId: "",
    accessType: "visitor" as InvitationAccessType,
    notes: "",
  });
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  useEffect(() => {
    setInvitationFeed(recentInvitations);
  }, [recentInvitations]);

  useEffect(() => {
    setOpenEntries(initialOpenEntries);
  }, [initialOpenEntries]);

  useEffect(() => {
    setRecentActivity(recentEvents);
  }, [recentEvents]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(invitationFeed);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      const response = await fetch(`/api/guards/invitation-search?q=${encodeURIComponent(trimmed)}`);
      const payload = (await response.json()) as { error?: string; results?: GuardInvitation[] };
      setIsSearching(false);

      if (!response.ok) {
        setSearchError(payload.error ?? "No fue posible buscar.");
        return;
      }

      setSearchError(null);
      setSearchResults(payload.results ?? []);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [invitationFeed, searchQuery]);

  const activeInvitationCount = useMemo(
    () => invitationFeed.filter((item) => (item.effective_status ?? item.status) === "active").length,
    [invitationFeed],
  );

  function prependActivity(
    accessEventType: AccessEventRecord["access_event_type"],
    eventLabel: string,
    details: Record<string, unknown>,
    invitationId?: string | null,
    visitorEntryId?: string | null,
  ) {
    const event: AccessEventRecord = {
      id: crypto.randomUUID(),
      community_id: "local",
      invitation_id: invitationId ?? null,
      visitor_entry_id: visitorEntryId ?? null,
      access_event_type: accessEventType,
      event_label: eventLabel,
      details,
      created_by_email: "Sesion actual",
      created_at: new Date().toISOString(),
    };

    setRecentActivity((current) => [event, ...current].slice(0, 12));
  }

  function syncInvitationStatus(invitationId: string, status: Exclude<InvitationStatus, "expired">) {
    const updateInvitation = (invitation: GuardInvitation) =>
      invitation.id === invitationId
        ? {
            ...invitation,
            status,
            effective_status: status,
          }
        : invitation;

    setInvitationFeed((current) => current.map(updateInvitation));
    setSearchResults((current) => current.map(updateInvitation));
  }

  function upsertOpenEntry(entry: OpenEntry) {
    setOpenEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, 12));
  }

  async function validateCredential(type: "pin" | "qr") {
    setFlash(null);
    setValidationError(null);
    setValidationMatch(null);

    if (!credentialValue.trim()) {
      setValidationError("Ingresa un codigo para validar.");
      return;
    }

    setIsValidating(true);
    const response = await fetch("/api/guards/validate-credential", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credentialType: type, credentialValue }),
    });
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
      match?: ValidationMatch | null;
    };
    setIsValidating(false);

    if (!response.ok) {
      setValidationError(payload.error ?? "No fue posible validar.");
      return;
    }

    if (!payload.match) {
      prependActivity("validation_failed", "Validacion fallida", {
        credentialType: type,
        credentialValue,
      });
      setValidationError(payload.message ?? "No encontramos ese codigo.");
      return;
    }

    prependActivity(
      "validation_success",
      "Validacion correcta",
      {
        credentialType: type,
        visitorName: payload.match.invitation.visitor_name,
      },
      payload.match.invitation.id,
      payload.match.openEntry?.id ?? null,
    );
    setValidationMatch(payload.match);
  }

  async function registerEntry(invitationId: string) {
    setFlash(null);
    const response = await fetch("/api/guards/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId }),
    });
    const payload = (await response.json()) as { error?: string; entry?: OpenEntry };
    if (!response.ok || !payload.entry) {
      setFlash({ variant: "error", message: payload.error ?? "No fue posible registrar la entrada." });
      return;
    }

    upsertOpenEntry(payload.entry);
    syncInvitationStatus(invitationId, "used");
    setValidationMatch((current) =>
      current
        ? {
            ...current,
            invitation: { ...current.invitation, effective_status: "used", status_label: "Usada" },
            openEntry: payload.entry!,
          }
        : current,
    );
    prependActivity(
      "entry_registered",
      "Entrada registrada",
      { visitorName: payload.entry.visitor_name },
      invitationId,
      payload.entry.id,
    );
    setFlash({ variant: "success", message: "Entrada registrada." });
  }

  async function registerExit(entryId: string) {
    setFlash(null);
    const response = await fetch(`/api/guards/entries/${entryId}/exit`, { method: "POST" });
    const payload = (await response.json()) as { error?: string; entry?: OpenEntry };
    if (!response.ok) {
      setFlash({ variant: "error", message: payload.error ?? "No fue posible registrar la salida." });
      return;
    }

    setOpenEntries((current) => current.filter((entry) => entry.id !== entryId));
    setValidationMatch((current) => (current?.openEntry?.id === entryId ? { ...current, openEntry: null } : current));
    prependActivity(
      "exit_registered",
      "Salida registrada",
      { visitorName: payload.entry?.visitor_name ?? null },
      payload.entry?.invitation_id ?? null,
      payload.entry?.id ?? entryId,
    );
    setFlash({ variant: "success", message: "Salida registrada." });
  }

  async function submitManual(kind: "unannounced" | "vehicle") {
    setFlash(null);
    setIsSubmittingManual(true);
    const endpoint = kind === "unannounced" ? "/api/guards/unannounced" : "/api/guards/vehicle";
    const body = kind === "unannounced" ? unannouncedForm : vehicleForm;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { error?: string; entry?: OpenEntry };
    setIsSubmittingManual(false);

    if (!response.ok || !payload.entry) {
      setFlash({ variant: "error", message: payload.error ?? "No fue posible guardar." });
      return;
    }

    upsertOpenEntry(payload.entry);
    if (kind === "unannounced") {
      setUnannouncedForm({ visitorName: "", residentId: "", accessType: "visitor", notes: "" });
      prependActivity(
        "unannounced_registered",
        "Visitante no anunciado registrado",
        { visitorName: payload.entry.visitor_name },
        payload.entry.invitation_id,
        payload.entry.id,
      );
      setFlash({ variant: "success", message: "Visitante registrado y marcado como dentro." });
    } else {
      setVehicleForm({ vehiclePlate: "", driverName: "", residentId: "", accessType: "visitor", notes: "" });
      prependActivity(
        "vehicle_registered",
        "Vehiculo registrado manualmente",
        {
          vehiclePlate: payload.entry.vehicle_plate,
          visitorName: payload.entry.visitor_name,
        },
        payload.entry.invitation_id,
        payload.entry.id,
      );
      setFlash({ variant: "success", message: "Vehiculo registrado y marcado como dentro." });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Invitaciones activas", String(activeInvitationCount)],
          ["Entradas dentro", String(openEntries.length)],
          ["Movimientos", String(recentActivity.length)],
          ["Modo", "Garita"],
        ].map(([label, value]) => (
          <Card key={label} className="border-white/70 bg-white/92">
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">{label}</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">{value}</div>
            </CardContent>
          </Card>
        ))}
        <LogoutButton className="h-full min-h-24 rounded-[26px]" variant="outline" />
      </div>

      {flash ? (
        <div className={flash.variant === "success" ? "rounded-2xl border border-success/20 bg-success/10 p-4 text-sm text-success" : "rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger"}>
          {flash.message}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actionCards.map((action) => {
          const Icon = action.icon;
          const active = activeAction === action.id;
          return (
            <button
              key={action.id}
              className={active ? "rounded-[26px] border border-primary bg-primary px-5 py-5 text-left text-primary-foreground" : "rounded-[26px] border border-white/70 bg-white/92 px-5 py-5 text-left"}
              type="button"
              onClick={() => setActiveAction(action.id)}
            >
              <Icon className="h-6 w-6" />
              <div className="mt-4 text-lg font-semibold">{action.label}</div>
              <div className={active ? "mt-2 text-sm text-primary-foreground/80" : "mt-2 text-sm text-muted-foreground"}>{action.description}</div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <Card className="border-white/70 bg-white/92">
            <CardHeader>
              <CardTitle>{actionLabels[activeAction]}</CardTitle>
              <CardDescription>
                {activeAction === "pin" && "Ingresa el PIN y registra la entrada o salida en pocos toques."}
                {activeAction === "qr" && "El escaneo con camara viene despues. Ya puedes pegar el contenido del QR para validarlo."}
                {activeAction === "unannounced" && "Registro rapido para visitas que llegan sin invitacion."}
                {activeAction === "vehicle" && "Registro manual de vehiculos con placa y referencia minima."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(activeAction === "pin" || activeAction === "qr") ? (
                <>
                  {activeAction === "qr" ? (
                    <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                      Escanear con camara: proximo paso. Usa este espacio para pegar el codigo QR si ya lo recibiste.
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="guardCredential">{activeAction === "pin" ? "PIN" : "Codigo QR"}</Label>
                    <Input id="guardCredential" className="h-14 text-lg" value={credentialValue} onChange={(e) => setCredentialValue(e.target.value)} placeholder={activeAction === "pin" ? "482193" : "Pega el codigo"} />
                  </div>
                  {validationError ? <div className="rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger">{validationError}</div> : null}
                  <Button className="h-14 w-full text-base" disabled={isValidating} type="button" onClick={() => void validateCredential(activeAction === "pin" ? "pin" : "qr")}>
                    {isValidating ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                    {activeAction === "pin" ? "Validar PIN" : "Validar QR"}
                  </Button>
                  {validationMatch ? (
                    <div className="space-y-4 rounded-[28px] border border-border bg-secondary/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xl font-semibold text-slate-950">{validationMatch.invitation.visitor_name || "Acceso rapido sin nombre"}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{validationMatch.invitation.residents?.full_name || "Sin residente"} | {formatUnit(validationMatch.invitation.units)}</div>
                        </div>
                        <Badge variant={getInvitationStatusVariant(validationMatch.invitation.effective_status)} className="px-4 py-1.5 text-sm">{getInvitationStatusLabel(validationMatch.invitation.effective_status)}</Badge>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border bg-white p-4 text-sm">{validationMatch.invitation.visit_date} | {validationMatch.invitation.window_start} - {validationMatch.invitation.window_end}</div>
                        <div className="rounded-2xl border border-border bg-white p-4 text-sm">{getInvitationAccessTypeLabel(validationMatch.invitation.access_type)}</div>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        {validationMatch.invitation.effective_status === "active" ? <Button className="h-14 flex-1 text-base" type="button" onClick={() => void registerEntry(validationMatch.invitation.id)}>Registrar entrada</Button> : null}
                        {validationMatch.openEntry ? <Button className="h-14 flex-1 text-base" type="button" variant="outline" onClick={() => void registerExit(validationMatch.openEntry!.id)}>Registrar salida</Button> : null}
                        <Button asChild className="h-14 text-base" type="button" variant="ghost"><Link href={`/app/invitations/${validationMatch.invitation.id}`}>Detalle</Link></Button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {activeAction === "unannounced" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="unannouncedName">Nombre del visitante</Label>
                    <Input id="unannouncedName" className="h-14 text-lg" value={unannouncedForm.visitorName} onChange={(e) => setUnannouncedForm((c) => ({ ...c, visitorName: e.target.value }))} placeholder="Carlos Rojas" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="unannouncedResident">Residente</Label>
                      <Select id="unannouncedResident" value={unannouncedForm.residentId} onChange={(e) => setUnannouncedForm((c) => ({ ...c, residentId: e.target.value }))}>
                        <option value="">Sin seleccionar</option>
                        {residents.map((resident) => <option key={resident.id} value={resident.id}>{resident.full_name}</option>)}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unannouncedType">Tipo</Label>
                      <Select id="unannouncedType" value={unannouncedForm.accessType} onChange={(e) => setUnannouncedForm((c) => ({ ...c, accessType: e.target.value as InvitationAccessType }))}>
                        <option value="visitor">Visita</option>
                        <option value="service_provider">Proveedor</option>
                        <option value="delivery">Delivery</option>
                        <option value="frequent_visitor">Visitante frecuente</option>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unannouncedNotes">Notas</Label>
                    <Textarea id="unannouncedNotes" value={unannouncedForm.notes} onChange={(e) => setUnannouncedForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Opcional" />
                  </div>
                  <Button className="h-14 w-full text-base" disabled={isSubmittingManual} type="button" onClick={() => void submitManual("unannounced")}>Registrar visitante</Button>
                </div>
              ) : null}

              {activeAction === "vehicle" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="vehiclePlate">Placa</Label>
                      <Input id="vehiclePlate" className="h-14 text-lg uppercase" value={vehicleForm.vehiclePlate} onChange={(e) => setVehicleForm((c) => ({ ...c, vehiclePlate: e.target.value.toUpperCase() }))} placeholder="AB123CD" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vehicleDriver">Conductor</Label>
                      <Input id="vehicleDriver" className="h-14 text-lg" value={vehicleForm.driverName} onChange={(e) => setVehicleForm((c) => ({ ...c, driverName: e.target.value }))} placeholder="Opcional" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="vehicleResident">Residente</Label>
                      <Select id="vehicleResident" value={vehicleForm.residentId} onChange={(e) => setVehicleForm((c) => ({ ...c, residentId: e.target.value }))}>
                        <option value="">Sin seleccionar</option>
                        {residents.map((resident) => <option key={resident.id} value={resident.id}>{resident.full_name}</option>)}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vehicleType">Tipo</Label>
                      <Select id="vehicleType" value={vehicleForm.accessType} onChange={(e) => setVehicleForm((c) => ({ ...c, accessType: e.target.value as InvitationAccessType }))}>
                        <option value="visitor">Visita</option>
                        <option value="service_provider">Proveedor</option>
                        <option value="delivery">Delivery</option>
                        <option value="frequent_visitor">Visitante frecuente</option>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicleNotes">Notas</Label>
                    <Textarea id="vehicleNotes" value={vehicleForm.notes} onChange={(e) => setVehicleForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Opcional" />
                  </div>
                  <Button className="h-14 w-full text-base" disabled={isSubmittingManual} type="button" onClick={() => void submitManual("vehicle")}>Registrar vehiculo</Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/92">
            <CardHeader>
              <CardTitle>Busqueda rapida</CardTitle>
              <CardDescription>Busca invitaciones recientes por visitante, residente o nota.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="h-14 pl-11 text-base" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Carlos, delivery, mantenimiento" />
              </div>
              {isSearching ? <div className="rounded-2xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">Buscando...</div> : null}
              {searchError ? <div className="rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger">{searchError}</div> : null}
              {!isSearching && !searchError && searchResults.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-4 text-sm text-muted-foreground">Sin resultados recientes.</div> : null}
              <div className="space-y-3">
                {searchResults.map((invitation) => {
                  const status = invitation.effective_status ?? invitation.status;
                  return (
                    <div key={invitation.id} className="rounded-2xl border border-border bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-foreground">{invitation.visitor_name || "Acceso rapido sin nombre"}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{invitation.residents?.full_name || "Sin residente"} | {formatUnit(invitation.units)}</div>
                        </div>
                        <InvitationStatusBadge status={status} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span>{getInvitationAccessTypeLabel(invitation.access_type)}</span>
                        <span>{invitation.visit_date}</span>
                      </div>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <Button asChild className="h-12" type="button" variant="outline"><Link href={`/app/invitations/${invitation.id}`}>Detalle</Link></Button>
                        {status === "active" ? <Button className="h-12" type="button" onClick={() => void registerEntry(invitation.id)}>Entrada</Button> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-white/70 bg-white/92">
            <CardHeader>
              <CardTitle>Personas dentro</CardTitle>
              <CardDescription>Marca la salida apenas salga cada visita o vehiculo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {openEntries.length > 0 ? openEntries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-border bg-secondary/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-foreground">{entry.visitor_name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{entry.residents?.full_name || "Sin residente"} | {formatUnit(entry.units)}</div>
                    </div>
                    <Badge variant="warning">Dentro</Badge>
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    {entry.vehicle_plate ? `Placa: ${entry.vehicle_plate}` : "Sin vehiculo"} | {new Date(entry.entered_at).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <Button className="mt-4 h-12 w-full text-base" type="button" onClick={() => void registerExit(entry.id)}>Registrar salida</Button>
                </div>
              )) : <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">No hay personas dentro ahora.</div>}
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/92">
            <CardHeader>
              <CardTitle>Actividad reciente</CardTitle>
              <CardDescription>Lectura rapida del turno actual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.length > 0 ? recentActivity.map((event) => (
                <div key={event.id} className="rounded-2xl border border-border bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-foreground">{event.event_label}</div>
                    <div className="font-mono text-xs text-muted-foreground">{new Date(event.created_at).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {event.access_event_type === "validation_failed" ? <span className="inline-flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Codigo no valido</span> : "Operacion registrada"}
                  </div>
                </div>
              )) : <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">Aun no hay actividad registrada.</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
