"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getGuardApiError, readGuardApiPayload } from "@/components/guards/guard-api";
import type {
  FlashMessage,
  GuardInvitation,
  ManualMode,
  OpenEntry,
  UnannouncedFormValue,
  ValidationMatch,
  VehicleFormValue,
} from "@/components/guards/guard-types";
import type { AccessEventRecord, InvitationStatus } from "@/lib/domain/types";

type UseGuardOperationsArgs = {
  initialInvitations: GuardInvitation[];
  initialOpenEntries: OpenEntry[];
  initialRecentActivity: AccessEventRecord[];
  onServerMutation?: () => void;
  updateValidationMatch: (
    updater: (current: ValidationMatch | null) => ValidationMatch | null,
  ) => void;
};

type EntryPayload = { entry?: OpenEntry };

export function useGuardOperations({
  initialInvitations,
  initialOpenEntries,
  initialRecentActivity,
  onServerMutation,
  updateValidationMatch,
}: UseGuardOperationsArgs) {
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [invitationFeed, setInvitationFeed] = useState(initialInvitations);
  const [openEntries, setOpenEntries] = useState(initialOpenEntries);
  const [recentActivity, setRecentActivity] = useState(initialRecentActivity);
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(
    () => new Set(),
  );
  const [manualPending, setManualPending] = useState<ManualMode | null>(null);
  const inFlightRef = useRef(new Set<string>());
  const idempotencyKeysRef = useRef(new Map<string, string>());

  useEffect(() => setInvitationFeed(initialInvitations), [initialInvitations]);
  useEffect(() => setOpenEntries(initialOpenEntries), [initialOpenEntries]);
  useEffect(() => setRecentActivity(initialRecentActivity), [initialRecentActivity]);

  const setPending = useCallback((key: string, pending: boolean) => {
    setPendingOperations((current) => {
      const next = new Set(current);
      if (pending) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const begin = useCallback(
    (key: string) => {
      if (inFlightRef.current.has(key)) return null;
      inFlightRef.current.add(key);
      setPending(key, true);
      setFlash(null);
      const idempotencyKey = idempotencyKeysRef.current.get(key) ?? crypto.randomUUID();
      idempotencyKeysRef.current.set(key, idempotencyKey);
      return idempotencyKey;
    },
    [setPending],
  );

  const finish = useCallback(
    (key: string, succeeded: boolean) => {
      inFlightRef.current.delete(key);
      setPending(key, false);
      if (succeeded) idempotencyKeysRef.current.delete(key);
    },
    [setPending],
  );

  const upsertOpenEntry = useCallback((entry: OpenEntry) => {
    setOpenEntries((current) => [
      entry,
      ...current.filter((item) => item.id !== entry.id),
    ].slice(0, 12));
  }, []);

  const syncInvitationStatus = useCallback(
    (invitationId: string, status: Exclude<InvitationStatus, "scheduled" | "expired">) => {
      setInvitationFeed((current) =>
        current.map((invitation) =>
          invitation.id === invitationId
            ? { ...invitation, status, effective_status: status }
            : invitation,
        ),
      );
    },
    [],
  );

  const registerInvitationEntry = useCallback(
    async (invitationId: string) => {
      const operationKey = `invitation:${invitationId}`;
      const idempotencyKey = begin(operationKey);
      if (!idempotencyKey) return;
      let succeeded = false;

      try {
        const response = await fetch("/api/guards/entries", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({ invitationId }),
        });
        const payload = await readGuardApiPayload<EntryPayload>(response);

        if (!response.ok || !payload.entry) {
          setFlash({
            variant: "error",
            message: getGuardApiError(payload, "No fue posible registrar la entrada."),
            reference: payload.requestId,
          });
          return;
        }

        succeeded = true;
        upsertOpenEntry(payload.entry);
        syncInvitationStatus(invitationId, "used");
        updateValidationMatch((current) =>
          current?.kind === "invitation" && current.invitation.id === invitationId
            ? {
                ...current,
                invitation: {
                  ...current.invitation,
                  effective_status: "used",
                  status_label: "Usada",
                },
                openEntry: payload.entry ?? null,
              }
            : current,
        );
        setFlash({ variant: "success", message: "Entrada registrada por el servidor." });
        onServerMutation?.();
      } catch {
        setFlash({
          variant: "error",
          message: "No fue posible conectar para registrar la entrada. Puedes reintentar sin duplicarla.",
        });
      } finally {
        finish(operationKey, succeeded);
      }
    },
    [begin, finish, onServerMutation, syncInvitationStatus, updateValidationMatch, upsertOpenEntry],
  );

  const registerEventGuest = useCallback(
    async (eventId: string, eventGuestId: string, companionCount = 0) => {
      const operationKey = `event:${eventId}:${eventGuestId}`;
      const idempotencyKey = begin(operationKey);
      if (!idempotencyKey) return;
      let succeeded = false;

      try {
        const response = await fetch("/api/guards/event-entries", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({ eventId, eventGuestId, companionCount }),
        });
        const payload = await readGuardApiPayload<EntryPayload>(response);

        if (!response.ok || !payload.entry) {
          setFlash({
            variant: "error",
            message: getGuardApiError(payload, "No fue posible registrar la entrada."),
            reference: payload.requestId,
          });
          return;
        }

        succeeded = true;
        upsertOpenEntry(payload.entry);
        updateValidationMatch((current) =>
          current?.kind === "event" && current.event.id === eventId
            ? {
                ...current,
                event: {
                  ...current.event,
                  event_guests: current.event.event_guests.map((guest) =>
                    guest.id === eventGuestId
                      ? {
                          ...guest,
                          attendance_status: "inside",
                          checked_in_at: new Date().toISOString(),
                        }
                      : guest,
                  ),
                },
              }
            : current,
        );
        setFlash({
          variant: "success",
          message: `${payload.entry.visitor_name} fue registrado por el servidor.`,
        });
        onServerMutation?.();
      } catch {
        setFlash({
          variant: "error",
          message: "No fue posible conectar para registrar la entrada. Puedes reintentar sin duplicarla.",
        });
      } finally {
        finish(operationKey, succeeded);
      }
    },
    [begin, finish, onServerMutation, updateValidationMatch, upsertOpenEntry],
  );

  const registerExit = useCallback(
    async (entryId: string) => {
      const operationKey = `exit:${entryId}`;
      const idempotencyKey = begin(operationKey);
      if (!idempotencyKey) return;
      let succeeded = false;

      try {
        const response = await fetch(`/api/guards/entries/${entryId}/exit`, {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
        });
        const payload = await readGuardApiPayload<EntryPayload>(response);

        if (!response.ok) {
          setFlash({
            variant: "error",
            message: getGuardApiError(payload, "No fue posible registrar la salida."),
            reference: payload.requestId,
          });
          return;
        }

        succeeded = true;
        setOpenEntries((current) => current.filter((entry) => entry.id !== entryId));
        updateValidationMatch((current) =>
          current?.kind === "invitation" && current.openEntry?.id === entryId
            ? { ...current, openEntry: null }
            : current,
        );
        setFlash({ variant: "success", message: "Salida registrada por el servidor." });
        onServerMutation?.();
      } catch {
        setFlash({
          variant: "error",
          message: "No fue posible conectar para registrar la salida. Puedes reintentar sin duplicarla.",
        });
      } finally {
        finish(operationKey, succeeded);
      }
    },
    [begin, finish, onServerMutation, updateValidationMatch],
  );

  const submitManual = useCallback(
    async (kind: ManualMode, body: UnannouncedFormValue | VehicleFormValue) => {
      const operationKey = `${kind}:${JSON.stringify(body)}`;
      const idempotencyKey = begin(operationKey);
      if (!idempotencyKey) return null;
      setManualPending(kind);
      let succeeded = false;

      try {
        const response = await fetch(
          kind === "unannounced" ? "/api/guards/unannounced" : "/api/guards/vehicle",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify(body),
          },
        );
        const payload = await readGuardApiPayload<EntryPayload>(response);

        if (!response.ok || !payload.entry) {
          setFlash({
            variant: "error",
            message: getGuardApiError(payload, "No fue posible guardar el registro."),
            reference: payload.requestId,
          });
          return null;
        }

        succeeded = true;
        upsertOpenEntry(payload.entry);
        setFlash({
          variant: "success",
          message:
            kind === "unannounced"
              ? "Visitante registrado y marcado como dentro."
              : "Vehículo registrado y marcado como dentro.",
        });
        onServerMutation?.();
        return payload.entry;
      } catch {
        setFlash({
          variant: "error",
          message: "No fue posible conectar para guardar. Puedes reintentar sin duplicar el registro.",
        });
        return null;
      } finally {
        setManualPending(null);
        finish(operationKey, succeeded);
      }
    },
    [begin, finish, onServerMutation, upsertOpenEntry],
  );

  const rejectAccess = useCallback(
    async (match: ValidationMatch) => {
      const resource =
        match.kind === "invitation"
          ? { kind: "invitation", invitationId: match.invitation.id }
          : {
              kind: "event",
              eventId: match.event.id,
              eventGuestId: match.event.identified_guest_id,
            };
      const resourceId =
        match.kind === "invitation"
          ? match.invitation.id
          : `${match.event.id}:${match.event.identified_guest_id ?? "shared"}`;
      const operationKey = `reject:${resourceId}`;
      const idempotencyKey = begin(operationKey);
      if (!idempotencyKey) return;
      let succeeded = false;

      try {
        const response = await fetch("/api/guards/rejections", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(resource),
        });
        const payload = await readGuardApiPayload<{ event?: AccessEventRecord }>(response);

        if (!response.ok || !payload.event) {
          setFlash({
            variant: "error",
            message: getGuardApiError(payload, "No fue posible registrar el rechazo."),
            reference: payload.requestId,
          });
          return;
        }

        succeeded = true;
        setRecentActivity((current) => [
          payload.event!,
          ...current.filter((event) => event.id !== payload.event!.id),
        ].slice(0, 12));
        setFlash({
          variant: "info",
          message: "Acceso rechazado y registrado en la bitácora. La invitación no fue revocada.",
        });
        onServerMutation?.();
      } catch {
        setFlash({
          variant: "error",
          message: "No fue posible conectar para registrar el rechazo. Puedes reintentar sin duplicarlo.",
        });
      } finally {
        finish(operationKey, succeeded);
      }
    },
    [begin, finish, onServerMutation],
  );

  const activeInvitationCount = useMemo(
    () =>
      invitationFeed.filter(
        (invitation) => (invitation.effective_status ?? invitation.status) === "active",
      ).length,
    [invitationFeed],
  );

  return {
    activeInvitationCount,
    clearFlash: () => setFlash(null),
    flash,
    invitationFeed,
    isPending: (key: string) => pendingOperations.has(key),
    manualPending,
    openEntries,
    recentActivity,
    registerEventGuest,
    registerExit,
    registerInvitationEntry,
    rejectAccess,
    submitManual,
  };
}
