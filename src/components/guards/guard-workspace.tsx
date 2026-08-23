"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Camera,
  CameraOff,
  CarFront,
  LoaderCircle,
  QrCode,
  Search,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  getInvitationWindowLabel,
} from "@/lib/domain/invitation-utils";
import { getEventWindowLabel } from "@/lib/domain/event-utils";
import type {
  AccessEventRecord,
  EventGuestRecord,
  InvitationAccessType,
  InvitationStatus,
  ResidentEventRecord,
  ResidentRecord,
  UnitRecord,
  VisitorEntryRecord,
} from "@/lib/domain/types";
import { formatAppTime } from "@/lib/formatting";
import { normalizeQrCredential } from "@/lib/qr-credentials";
import { cn } from "@/lib/utils";
import type { IScannerControls } from "@zxing/browser";

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
  window_end_date: string | null;
  no_time_limit: boolean;
  status: "active" | "used" | "revoked";
  residents: { full_name: string } | null;
  units: { identifier: string; building: string | null } | null;
  effective_status?: InvitationStatus;
};

type OpenEntry = VisitorEntryRecord & {
  residents: { full_name: string; phone: string; whatsapp_phone: string | null } | null;
  units: { identifier: string; building: string | null } | null;
};

type GuardEvent = ResidentEventRecord & {
  residents: { full_name: string } | null;
  units: { identifier: string; building: string | null } | null;
  event_guests: EventGuestRecord[];
  effective_status: "scheduled" | "active" | "expired" | "revoked" | "used";
  identified_guest_id: string | null;
};

type ValidationMatch =
  | {
      kind: "invitation";
      invitation: GuardInvitation & { effective_status: InvitationStatus; status_label: string };
      openEntry: OpenEntry | null;
    }
  | {
      kind: "event";
      event: GuardEvent;
    };
type GuardWorkspaceProps = {
  residents: ResidentOption[];
  recentInvitations: GuardInvitation[];
  openEntries: OpenEntry[];
  recentEvents: AccessEventRecord[];
};

type ScannerStatus = "idle" | "starting" | "active" | "detected" | "unsupported" | "error";

function formatUnit(unit: { identifier: string; building: string | null } | null) {
  return unit ? `${unit.building ? `${unit.building} - ` : ""}${unit.identifier}` : "Sin unidad";
}

const actionLabels = {
  pin: "Validar PIN",
  qr: "QR",
  unannounced: "No anunciado",
  vehicle: "Vehiculo",
} as const;

function isGuardAction(value: string | null): value is keyof typeof actionLabels {
  return value === "pin" || value === "qr" || value === "unannounced" || value === "vehicle";
}

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
  const searchParams = useSearchParams();
  const [activeAction, setActiveAction] = useState<keyof typeof actionLabels>("pin");
  const [flash, setFlash] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const [invitationFeed, setInvitationFeed] = useState(recentInvitations);
  const [openEntries, setOpenEntries] = useState(initialOpenEntries);
  const [recentActivity, setRecentActivity] = useState(recentEvents);

  const [credentialValue, setCredentialValue] = useState("");
  const [validationMatch, setValidationMatch] = useState<ValidationMatch | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [eventGuestQuery, setEventGuestQuery] = useState("");
  const [companionCounts, setCompanionCounts] = useState<Record<string, number>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>("idle");
  const [scannerMessage, setScannerMessage] = useState(
    "Listo para escanear desde la camara trasera. En iPhone, abre Ventry por HTTPS.",
  );
  const [lastScannedValue, setLastScannedValue] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scannerActiveRef = useRef(false);
  const validationInFlightRef = useRef(false);
  const credentialRequestInFlightRef = useRef(false);
  const validateCredentialRef = useRef(validateCredential);
  validateCredentialRef.current = validateCredential;
  const entryIdempotencyKeysRef = useRef(new Map<string, string>());
  const entryRequestsInFlightRef = useRef(new Set<string>());
  const manualIdempotencyKeysRef = useRef(new Map<string, string>());
  const manualRequestsInFlightRef = useRef(new Set<string>());
  const [pendingEntryOperations, setPendingEntryOperations] = useState<Set<string>>(
    () => new Set(),
  );

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
    const requestedAction = searchParams.get("action");
    if (isGuardAction(requestedAction)) {
      setActiveAction(requestedAction);
    }
  }, [searchParams]);

  const stopQrScanner = useCallback((nextStatus: ScannerStatus = "idle", message?: string) => {
    scannerActiveRef.current = false;
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;

    if (videoRef.current) {
      if (videoRef.current.srcObject instanceof MediaStream) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
      videoRef.current.srcObject = null;
    }

    setScannerStatus(nextStatus);
    if (message) {
      setScannerMessage(message);
    }
  }, []);

  useEffect(() => {
    if (activeAction !== "qr") {
      stopQrScanner("idle", "Listo para escanear desde la camara trasera. En iPhone, abre Ventry por HTTPS.");
    }
  }, [activeAction, stopQrScanner]);

  useEffect(() => {
    const videoElement = videoRef.current;
    return () => {
      scannerActiveRef.current = false;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;

      if (videoElement) {
        if (videoElement.srcObject instanceof MediaStream) {
          videoElement.srcObject.getTracks().forEach((track) => track.stop());
        }
        videoElement.srcObject = null;
      }
    };
  }, []);

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

  useEffect(() => {
    const scannedQr = searchParams.get("qr") || searchParams.get("credential") || searchParams.get("code");

    if (!scannedQr || validationInFlightRef.current) {
      return;
    }

    const credential = normalizeQrCredential(scannedQr);
    validationInFlightRef.current = true;
    setActiveAction("qr");
    setCredentialValue(credential);
    setLastScannedValue(credential);
    setScannerStatus("detected");
    setScannerMessage("QR abierto desde la camara del telefono. Validando invitacion...");

    void validateCredentialRef.current("qr", credential).finally(() => {
      validationInFlightRef.current = false;
    });
  }, [searchParams]);

  function prependActivity(
    accessEventType: AccessEventRecord["access_event_type"],
    eventLabel: string,
    details: Record<string, unknown>,
    invitationId?: string | null,
    visitorEntryId?: string | null,
  ) {
    const eventStatus =
      accessEventType === "validation_success"
        ? "validated"
        : accessEventType === "validation_failed"
          ? "rejected"
          : accessEventType === "exit_registered"
            ? "exited"
            : "entered";
    const eventDirection =
      accessEventType === "validation_success" || accessEventType === "validation_failed"
        ? "validation"
        : accessEventType === "exit_registered"
          ? "exit"
          : "entry";
    const eventSource =
      accessEventType === "vehicle_registered"
        ? "vehicle_manual"
        : accessEventType === "unannounced_registered"
          ? "unannounced"
          : accessEventType === "entry_registered"
            ? typeof details.eventId === "string" ? "event" : "invitation"
            : "validation";
    const event: AccessEventRecord = {
      id: crypto.randomUUID(),
      community_id: "local",
      invitation_id: invitationId ?? null,
      event_id: typeof details.eventId === "string" ? details.eventId : null,
      event_guest_id: null,
      visitor_entry_id: visitorEntryId ?? null,
      resident_id: null,
      unit_id: null,
      visitor_name: typeof details.visitorName === "string" ? details.visitorName : null,
      access_type: null,
      access_event_type: accessEventType,
      event_status: eventStatus,
      event_direction: eventDirection,
      event_source: eventSource,
      event_label: eventLabel,
      validated_by_email: "Sesion actual",
      notes: null,
      details,
      created_by_email: "Sesion actual",
      created_at: new Date().toISOString(),
    };

    setRecentActivity((current) => [event, ...current].slice(0, 12));
  }

  function syncInvitationStatus(
    invitationId: string,
    status: Exclude<InvitationStatus, "scheduled" | "expired">,
  ) {
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

  function setEntryOperationPending(operationKey: string, pending: boolean) {
    setPendingEntryOperations((current) => {
      const next = new Set(current);
      if (pending) next.add(operationKey);
      else next.delete(operationKey);
      return next;
    });
  }

  async function validateCredential(type: "pin" | "qr", valueOverride?: string) {
    if (credentialRequestInFlightRef.current) return false;

    setFlash(null);
    setValidationError(null);
    setValidationMatch(null);
    const valueToValidate =
      type === "qr"
        ? normalizeQrCredential(valueOverride ?? credentialValue)
        : (valueOverride ?? credentialValue).trim();
    if (!valueToValidate) {
      setValidationError("Ingresa un codigo para validar.");
      return false;
    }

    credentialRequestInFlightRef.current = true;
    setIsValidating(true);
    let response: Response;
    let payload: { error?: string; message?: string; match?: ValidationMatch | null };
    try {
      response = await fetch("/api/guards/validate-credential", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialType: type, credentialValue: valueToValidate }),
      });
      payload = (await response.json()) as {
        error?: string;
        message?: string;
        match?: ValidationMatch | null;
      };
    } catch {
      credentialRequestInFlightRef.current = false;
      setIsValidating(false);
      setValidationError("No fue posible conectar con validacion.");
      return false;
    }

    credentialRequestInFlightRef.current = false;
    setIsValidating(false);
    if (!response.ok) {
      setValidationError(payload.error ?? "No fue posible validar.");
      return false;
    }
    if (!payload.match) {
      prependActivity("validation_failed", "Validacion fallida", {
        credentialType: type,
      });
      setValidationError(payload.message ?? "No encontramos ese codigo.");
      return false;
    }

    if (payload.match.kind === "invitation") {
      prependActivity(
        "validation_success",
        "Validacion correcta",
        { credentialType: type, visitorName: payload.match.invitation.visitor_name },
        payload.match.invitation.id,
        payload.match.openEntry?.id ?? null,
      );
    } else {
      prependActivity("validation_success", "Codigo de evento validado", {
        credentialType: type,
        eventName: payload.match.event.name,
        eventId: payload.match.event.id,
      });
      setEventGuestQuery("");
    }
    setValidationMatch(payload.match);
    return true;
  }
  async function startQrScanner() {
    setFlash(null);
    setValidationError(null);
    setValidationMatch(null);
    setLastScannedValue(null);

    if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
      setScannerStatus("unsupported");
      setScannerMessage(
        window.isSecureContext
          ? "Safari no entrego acceso a camara en esta vista. Revisa el permiso de camara del sitio o pega el codigo abajo."
          : "Safari solo muestra el permiso de camara en sitios HTTPS. Abre Ventry por HTTPS o pega el codigo abajo.",
      );
      return;
    }

    stopQrScanner("starting", "Abriendo camara...");

    try {
      const video = videoRef.current;
      if (!video) {
        setScannerStatus("error");
        setScannerMessage("No fue posible preparar la camara. Puedes pegar el codigo QR abajo.");
        return;
      }

      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const codeReader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 180,
        delayBetweenScanSuccess: 500,
        tryPlayVideoTimeout: 8000,
      });
      const controls = await codeReader.decodeFromConstraints({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }, video, (result) => {
        if (!result || !scannerActiveRef.current || validationInFlightRef.current) {
          return;
        }

        const cleanedValue = normalizeQrCredential(result.getText());
        validationInFlightRef.current = true;
        setCredentialValue(cleanedValue);
        setLastScannedValue(cleanedValue);
        stopQrScanner("detected", "QR detectado. Validando invitacion...");

        void validateCredential("qr", cleanedValue)
          .then((matched) => {
            setScannerMessage(matched ? "Invitacion encontrada." : "QR leido sin coincidencia.");
          })
          .finally(() => {
            validationInFlightRef.current = false;
          });
      });

      scannerControlsRef.current = controls;
      scannerActiveRef.current = true;
      setScannerStatus("active");
      setScannerMessage("Apunta la camara al QR de la invitacion.");
    } catch (error) {
      stopQrScanner(
        "error",
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Permiso de camara denegado. Revisa el permiso de Safari para este sitio o pega el codigo abajo."
          : "No fue posible abrir la camara. Puedes pegar el codigo QR abajo.",
      );
    }
  }

  async function registerEventGuest(eventId: string, eventGuestId: string, companionCount = 0) {
    const operationKey = `event:${eventId}:${eventGuestId}`;
    if (entryRequestsInFlightRef.current.has(operationKey)) return;

    setFlash(null);
    entryRequestsInFlightRef.current.add(operationKey);
    setEntryOperationPending(operationKey, true);
    const idempotencyKey =
      entryIdempotencyKeysRef.current.get(operationKey) ?? crypto.randomUUID();
    entryIdempotencyKeysRef.current.set(operationKey, idempotencyKey);
    try {
      const response = await fetch("/api/guards/event-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ eventId, eventGuestId, companionCount }),
      });
      const payload = (await response.json()) as { error?: string; entry?: OpenEntry };
      if (!response.ok || !payload.entry) {
        setFlash({ variant: "error", message: payload.error ?? "No fue posible registrar la entrada." });
        return;
      }
      entryIdempotencyKeysRef.current.delete(operationKey);

      upsertOpenEntry(payload.entry);
      setValidationMatch((current) =>
        current?.kind === "event"
          ? {
              ...current,
              event: {
                ...current.event,
                event_guests: current.event.event_guests.map((guest) =>
                  guest.id === eventGuestId
                    ? { ...guest, attendance_status: "inside", checked_in_at: new Date().toISOString() }
                    : guest,
                ),
              },
            }
          : current,
      );
      prependActivity("entry_registered", "Entrada de evento registrada", {
        visitorName: payload.entry.visitor_name,
        eventId,
      }, null, payload.entry.id);
      setFlash({ variant: "success", message: `${payload.entry.visitor_name} fue registrado.` });
    } catch {
      setFlash({ variant: "error", message: "No fue posible conectar para registrar la entrada." });
    } finally {
      entryRequestsInFlightRef.current.delete(operationKey);
      setEntryOperationPending(operationKey, false);
    }
  }
  async function registerEntry(invitationId: string) {
    const operationKey = `invitation:${invitationId}`;
    if (entryRequestsInFlightRef.current.has(operationKey)) return;

    setFlash(null);
    entryRequestsInFlightRef.current.add(operationKey);
    setEntryOperationPending(operationKey, true);
    const idempotencyKey =
      entryIdempotencyKeysRef.current.get(operationKey) ?? crypto.randomUUID();
    entryIdempotencyKeysRef.current.set(operationKey, idempotencyKey);
    try {
      const response = await fetch("/api/guards/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ invitationId }),
      });
      const payload = (await response.json()) as { error?: string; entry?: OpenEntry };
      if (!response.ok || !payload.entry) {
        setFlash({ variant: "error", message: payload.error ?? "No fue posible registrar la entrada." });
        return;
      }
      entryIdempotencyKeysRef.current.delete(operationKey);

      upsertOpenEntry(payload.entry);
      syncInvitationStatus(invitationId, "used");
      setValidationMatch((current) =>
        current?.kind === "invitation"
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
    } catch {
      setFlash({ variant: "error", message: "No fue posible conectar para registrar la entrada." });
    } finally {
      entryRequestsInFlightRef.current.delete(operationKey);
      setEntryOperationPending(operationKey, false);
    }
  }

  async function registerExit(entryId: string) {
    const operationKey = `exit:${entryId}`;
    if (entryRequestsInFlightRef.current.has(operationKey)) return;

    setFlash(null);
    entryRequestsInFlightRef.current.add(operationKey);
    setEntryOperationPending(operationKey, true);
    try {
      const response = await fetch(`/api/guards/entries/${entryId}/exit`, { method: "POST" });
      const payload = (await response.json()) as { error?: string; entry?: OpenEntry };
      if (!response.ok) {
        setFlash({ variant: "error", message: payload.error ?? "No fue posible registrar la salida." });
        return;
      }

      setOpenEntries((current) => current.filter((entry) => entry.id !== entryId));
      setValidationMatch((current) => (current?.kind === "invitation" && current.openEntry?.id === entryId ? { ...current, openEntry: null } : current));
      prependActivity(
        "exit_registered",
        "Salida registrada",
        { visitorName: payload.entry?.visitor_name ?? null },
        payload.entry?.invitation_id ?? null,
        payload.entry?.id ?? entryId,
      );
      setFlash({ variant: "success", message: "Salida registrada." });
    } catch {
      setFlash({ variant: "error", message: "No fue posible conectar para registrar la salida." });
    } finally {
      entryRequestsInFlightRef.current.delete(operationKey);
      setEntryOperationPending(operationKey, false);
    }
  }

  async function submitManual(kind: "unannounced" | "vehicle") {
    const endpoint = kind === "unannounced" ? "/api/guards/unannounced" : "/api/guards/vehicle";
    const body = kind === "unannounced" ? unannouncedForm : vehicleForm;
    const operationKey = `${kind}:${JSON.stringify(body)}`;
    if (manualRequestsInFlightRef.current.has(operationKey)) return;

    setFlash(null);
    manualRequestsInFlightRef.current.add(operationKey);
    setIsSubmittingManual(true);
    const idempotencyKey =
      manualIdempotencyKeysRef.current.get(operationKey) ?? crypto.randomUUID();
    manualIdempotencyKeysRef.current.set(operationKey, idempotencyKey);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string; entry?: OpenEntry };

      if (!response.ok || !payload.entry) {
        setFlash({ variant: "error", message: payload.error ?? "No fue posible guardar." });
        return;
      }
      manualIdempotencyKeysRef.current.delete(operationKey);

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
    } catch {
      setFlash({ variant: "error", message: "No fue posible conectar para guardar." });
    } finally {
      manualRequestsInFlightRef.current.delete(operationKey);
      setIsSubmittingManual(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["Invitaciones activas", String(activeInvitationCount)],
          ["Accesos", String(openEntries.length)],
          ["Movimientos", String(recentActivity.length)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="text-sm text-muted-foreground">{label}</div>
              <div className="mt-2 font-display text-3xl font-semibold text-foreground">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {flash ? (
        <div className={flash.variant === "success" ? "rounded-2xl border border-success/20 bg-success/10 p-4 text-sm text-success" : "rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger"}>
          {flash.message}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {actionCards.map((action) => {
          const Icon = action.icon;
          const active = activeAction === action.id;
          return (
            <button
              key={action.id}
              aria-pressed={active}
              className={active ? "min-h-28 rounded-lg border border-primary/30 bg-secondary px-5 py-5 text-left text-primary shadow-panel transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" : "min-h-28 rounded-lg border border-border bg-surface px-5 py-5 text-left transition-colors hover:border-primary/25 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"}
              type="button"
              onClick={() => setActiveAction(action.id)}
            >
              <Icon className="h-6 w-6" />
              <div className="mt-4 text-lg font-semibold">{action.label}</div>
              <div className={active ? "mt-2 text-sm text-primary" : "mt-2 text-sm text-muted-foreground"}>{action.description}</div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <Card id="guard-validation">
            <CardHeader>
              <CardTitle>{actionLabels[activeAction]}</CardTitle>
              <CardDescription>
                {activeAction === "pin" && "Ingresa el PIN y registra la entrada o salida en pocos toques."}
                {activeAction === "qr" && "Escanea el QR con la camara o pega el codigo para validarlo."}
                {activeAction === "unannounced" && "Registro rapido para visitas que llegan sin invitacion."}
                {activeAction === "vehicle" && "Registro manual de vehiculos con placa y referencia minima."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(activeAction === "pin" || activeAction === "qr") ? (
                <>
                  {activeAction === "qr" ? (
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-xl border border-border bg-foreground">
                        <div className="relative aspect-[4/5] min-h-72 sm:aspect-video">
                          <video
                            ref={videoRef}
                            aria-label="Camara para escanear QR"
                            autoPlay
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                          />
                          {scannerStatus !== "active" ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-foreground px-6 text-center text-background">
                              {scannerStatus === "starting" || scannerStatus === "detected" ? (
                                <LoaderCircle className="h-8 w-8 animate-spin" />
                              ) : scannerStatus === "unsupported" || scannerStatus === "error" ? (
                                <CameraOff className="h-8 w-8" />
                              ) : (
                                <Camera className="h-8 w-8" />
                              )}
                              <div className="text-sm font-medium">{scannerMessage}</div>
                            </div>
                          ) : null}
                          {scannerStatus === "active" ? (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                              <div className="h-full max-h-72 w-full max-w-72 rounded-xl border-2 border-background/90 shadow-[0_0_0_999px_rgba(0,0,0,0.32)]" />
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          className="h-14 text-base"
                          disabled={scannerStatus === "starting" || isValidating}
                          type="button"
                          onClick={() => void startQrScanner()}
                        >
                          {scannerStatus === "starting" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                          {scannerStatus === "active" ? "Reiniciar" : "Escanear"}
                        </Button>
                        <Button
                          className="h-14 text-base"
                          disabled={scannerStatus !== "active" && scannerStatus !== "starting"}
                          type="button"
                          variant="outline"
                          onClick={() =>
                            stopQrScanner(
                              "idle",
                              "Listo para escanear desde la camara trasera. En iPhone, abre Ventry por HTTPS.",
                            )
                          }
                        >
                          <CameraOff className="h-5 w-5" />
                          Detener
                        </Button>
                      </div>
                      {lastScannedValue ? (
                        <div className="rounded-2xl border border-success/20 bg-success/10 p-4 text-sm text-success">
                          QR leido y enviado a validacion.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="guardCredential">{activeAction === "pin" ? "PIN" : "Codigo QR alternativo"}</Label>
                    <Input
                      id="guardCredential"
                      className="h-14 text-lg"
                      value={credentialValue}
                      onChange={(e) => setCredentialValue(e.target.value)}
                      placeholder={activeAction === "pin" ? "482193" : "Pega el codigo QR"}
                    />
                  </div>
                  {validationError ? <div className="rounded-2xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger">{validationError}</div> : null}
                  <Button className="h-14 w-full text-base" disabled={isValidating} type="button" onClick={() => void validateCredential(activeAction === "pin" ? "pin" : "qr")}>
                    {isValidating ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                    {activeAction === "pin" ? "Validar PIN" : "Validar QR"}
                  </Button>
                  {validationMatch ? validationMatch.kind === "event" ? (
                    <div className="space-y-4 rounded-xl border border-primary/30 bg-secondary/90 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Modo evento</div>
                          <div className="mt-1 font-display text-xl font-semibold text-foreground">{validationMatch.event.name}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{validationMatch.event.residents?.full_name || "Sin residente"} | {formatUnit(validationMatch.event.units)}</div>
                        </div>
                        <Badge variant={validationMatch.event.effective_status === "active" ? "success" : "warning"}>
                          {validationMatch.event.effective_status === "active" ? "Activo" : validationMatch.event.effective_status === "scheduled" ? "Aun no inicia" : "Finalizado"}
                        </Badge>
                      </div>
                      <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
                        {getEventWindowLabel(validationMatch.event)}
                      </div>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="h-14 pl-11 text-base"
                          value={eventGuestQuery}
                          onChange={(event) => setEventGuestQuery(event.target.value)}
                          placeholder="Buscar nombre en la lista..."
                        />
                      </div>
                      {validationMatch.event.identified_guest_id ? <p className="text-sm font-bold text-primary">Persona identificada por la credencial</p> : null}
                      <div className="max-h-96 space-y-2 overflow-y-auto">
                        {[...validationMatch.event.event_guests]
                          .filter((guest) => guest.full_name.toLocaleLowerCase().includes(eventGuestQuery.trim().toLocaleLowerCase()))
                          .sort((left, right) => Number(right.id === validationMatch.event.identified_guest_id) - Number(left.id === validationMatch.event.identified_guest_id))
                          .slice(0, 60)
                          .map((guest) => {
                            const operationKey = `event:${validationMatch.event.id}:${guest.id}`;
                            const isRegistering = pendingEntryOperations.has(operationKey);
                            return (
                            <div key={guest.id} className={cn("rounded-2xl border bg-surface p-3", guest.id === validationMatch.event.identified_guest_id ? "border-2 border-primary" : "border-border")}>
                              <div className="flex items-center gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-semibold">{guest.full_name}</div>
                                <div className="truncate text-xs text-muted-foreground">{guest.phone || guest.notes || "Invitado del evento"}{guest.allows_companions ? ` · hasta ${guest.max_companions} acompanantes` : ""}</div>
                              </div>
                              {guest.attendance_status === "pending" && validationMatch.event.effective_status === "active" ? (
                                <Button
                                  aria-busy={isRegistering}
                                  className="h-11 shrink-0"
                                  disabled={isRegistering}
                                  type="button"
                                  onClick={() => void registerEventGuest(validationMatch.event.id, guest.id, companionCounts[guest.id] ?? 0)}
                                >
                                  {isRegistering ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
                                  {isRegistering ? "Registrando..." : "Registrar"}
                                </Button>
                              ) : (
                                <Badge variant={guest.attendance_status === "inside" ? "warning" : "success"}>
                                  {guest.attendance_status === "inside" ? "Dentro" : "Salio"}
                                </Badge>
                              )}
                              </div>
                              {guest.attendance_status === "pending" && guest.allows_companions && validationMatch.event.effective_status === "active" ? <label className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-sm font-semibold"><span>Acompanantes ({(companionCounts[guest.id] ?? 0) + 1} personas en total)</span><select aria-label={`Acompanantes de ${guest.full_name}`} className="h-11 rounded-xl border border-border bg-surface px-3" value={companionCounts[guest.id] ?? 0} onChange={(event) => setCompanionCounts((current) => ({ ...current, [guest.id]: Number(event.target.value) }))}>{Array.from({length:guest.max_companions+1},(_,count)=><option key={count} value={count}>{count}</option>)}</select></label> : null}
                            </div>
                            );
                          })}
                      </div>
                      <Button asChild className="h-12 w-full" type="button" variant="ghost">
                        <Link href={`/app/events/${validationMatch.event.id}`}>Ver evento completo</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4 rounded-xl border border-border bg-secondary/90 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-display text-xl font-semibold text-foreground">{validationMatch.invitation.visitor_name || "Acceso rapido sin nombre"}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{validationMatch.invitation.residents?.full_name || "Sin residente"} | {formatUnit(validationMatch.invitation.units)}</div>
                        </div>
                        <Badge variant={getInvitationStatusVariant(validationMatch.invitation.effective_status)} className="px-4 py-1.5 text-sm">{getInvitationStatusLabel(validationMatch.invitation.effective_status)}</Badge>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border bg-surface p-4 text-sm">{getInvitationWindowLabel(validationMatch.invitation)}</div>
                        <div className="rounded-2xl border border-border bg-surface p-4 text-sm">{getInvitationAccessTypeLabel(validationMatch.invitation.access_type)}</div>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        {validationMatch.invitation.effective_status === "active" ? (
                          <Button
                            aria-busy={pendingEntryOperations.has(`invitation:${validationMatch.invitation.id}`)}
                            className="h-14 flex-1 text-base"
                            disabled={pendingEntryOperations.has(`invitation:${validationMatch.invitation.id}`)}
                            type="button"
                            onClick={() => void registerEntry(validationMatch.invitation.id)}
                          >
                            {pendingEntryOperations.has(`invitation:${validationMatch.invitation.id}`) ? (
                              <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
                            ) : null}
                            {pendingEntryOperations.has(`invitation:${validationMatch.invitation.id}`)
                              ? "Registrando..."
                              : "Registrar entrada"}
                          </Button>
                        ) : null}
                        {validationMatch.openEntry ? (
                          <Button
                            aria-busy={pendingEntryOperations.has(`exit:${validationMatch.openEntry.id}`)}
                            className="h-14 flex-1 text-base"
                            disabled={pendingEntryOperations.has(`exit:${validationMatch.openEntry.id}`)}
                            type="button"
                            variant="outline"
                            onClick={() => void registerExit(validationMatch.openEntry!.id)}
                          >
                            {pendingEntryOperations.has(`exit:${validationMatch.openEntry.id}`)
                              ? "Registrando..."
                              : "Registrar salida"}
                          </Button>
                        ) : null}
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
                  <Button aria-busy={isSubmittingManual} className="h-14 w-full text-base" disabled={isSubmittingManual} type="button" onClick={() => void submitManual("unannounced")}>{isSubmittingManual ? "Registrando..." : "Registrar visitante"}</Button>
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
                  <Button aria-busy={isSubmittingManual} className="h-14 w-full text-base" disabled={isSubmittingManual} type="button" onClick={() => void submitManual("vehicle")}>{isSubmittingManual ? "Registrando..." : "Registrar vehiculo"}</Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
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
                    <div key={invitation.id} className="rounded-2xl border border-border bg-surface p-4">
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
                        {status === "active" ? (
                          <Button
                            aria-busy={pendingEntryOperations.has(`invitation:${invitation.id}`)}
                            className="h-12"
                            disabled={pendingEntryOperations.has(`invitation:${invitation.id}`)}
                            type="button"
                            onClick={() => void registerEntry(invitation.id)}
                          >
                            {pendingEntryOperations.has(`invitation:${invitation.id}`) ? "Registrando..." : "Entrada"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
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
                    {entry.vehicle_plate ? `Placa: ${entry.vehicle_plate}` : "Sin vehiculo"} | {formatAppTime(entry.entered_at)}
                  </div>
                  <Button
                    aria-busy={pendingEntryOperations.has(`exit:${entry.id}`)}
                    className="mt-4 h-12 w-full text-base"
                    disabled={pendingEntryOperations.has(`exit:${entry.id}`)}
                    type="button"
                    onClick={() => void registerExit(entry.id)}
                  >
                    {pendingEntryOperations.has(`exit:${entry.id}`) ? "Registrando..." : "Registrar salida"}
                  </Button>
                </div>
              )) : <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-6 text-sm text-muted-foreground">No hay personas dentro ahora.</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actividad reciente</CardTitle>
              <CardDescription>Lectura rapida del turno actual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.length > 0 ? recentActivity.map((event) => (
                <div key={event.id} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-foreground">{event.event_label}</div>
                    <div className="font-mono text-xs text-muted-foreground">{formatAppTime(event.created_at)}</div>
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
