"use client";

import { useCallback, useRef, useState } from "react";
import { z } from "zod";


import { getGuardApiError, readGuardApiPayload } from "@/components/guards/guard-api";
import type {
  CredentialMode,
  ValidationMatch,
  ValidationState,
} from "@/components/guards/guard-types";
import { normalizeQrCredential } from "@/lib/qr-credentials";

const initialState: ValidationState = {
  attemptRef: null,
  match: null,
  message: null,
  phase: "idle",
};

type ValidationPayload = {
  attemptRef?: string | null;
  match?: unknown;
  ok?: boolean;
};

const resourceId = z.string().min(1);
const resource = z.object({
  id: resourceId,
  effective_status: z.enum(["scheduled", "active", "expired", "revoked", "used"]),
});
const invitationMatch = z.object({
  kind: z.literal("invitation").optional(),
  invitation: resource.extend({ visit_date: z.string() }),
  openEntry: z.object({ id: resourceId }).nullable(),
});
const eventMatch = z.object({
  kind: z.literal("event"),
  event: resource.extend({
    event_date: z.string(),
    event_guests: z.array(z.object({ id: resourceId, full_name: z.string() })),
  }),
});

function parseValidationMatch(match: unknown): ValidationMatch | null {
  if (invitationMatch.safeParse(match).success) {
    // Older API responses omit the discriminator, but still include the invitation and openEntry.
    const data = match as Extract<ValidationMatch, { kind: "invitation" }>;
    return { ...data, kind: "invitation" };
  }
  return eventMatch.safeParse(match).success ? (match as ValidationMatch) : null;
}

export function useCredentialValidation(onServerAttempt?: () => void) {
  const [credentialValue, setCredentialValue] = useState("");
  const [state, setState] = useState<ValidationState>(initialState);
  const inFlightRef = useRef(false);

  const reset = useCallback(() => {
    if (inFlightRef.current) return;
    setState(initialState);
  }, []);

  const updateMatch = useCallback(
    (updater: (current: ValidationMatch | null) => ValidationMatch | null) => {
      setState((current) => ({ ...current, match: updater(current.match) }));
    },
    [],
  );

  const validate = useCallback(
    async (type: CredentialMode, input: string) => {
      if (inFlightRef.current) return false;

      const value =
        type === "qr"
          ? normalizeQrCredential(input)
          : input.trim();

      if (!value) {
        setState({
          attemptRef: null,
          match: null,
          message: "Ingresa un código para validar.",
          phase: "error",
        });
        return false;
      }

      inFlightRef.current = true;
      setCredentialValue(value);
      setState({
        attemptRef: null,
        match: null,
        message: "Consultando la credencial con el servidor…",
        phase: "validating",
      });

      try {
        const response = await fetch("/api/guards/validate-credential", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credentialType: type, credentialValue: value }),
        });
        const payload = await readGuardApiPayload<ValidationPayload>(response);
        const attemptRef = payload.attemptRef ?? payload.requestId ?? null;

        if (!response.ok || payload.error) {
          setState({
            attemptRef,
            match: null,
            message: getGuardApiError(payload, "No fue posible validar el código."),
            phase: "error",
          });
          onServerAttempt?.();
          return false;
        }

        if (payload.match == null && payload.ok !== true) {
          setState({
            attemptRef,
            match: null,
            message: payload.message ?? "No encontramos ese código.",
            phase: "not_found",
          });
          onServerAttempt?.();
          return false;
        }

        const match = payload.ok === true ? parseValidationMatch(payload.match) : null;
        if (!match) {
          setState({
            attemptRef,
            match: null,
            message: "La garita recibió datos incompletos del servidor. Intenta nuevamente.",
            phase: "error",
          });
          onServerAttempt?.();
          return false;
        }

        setState({
          attemptRef,
          match,
          message: "Credencial consultada. Revisa los datos antes de actuar.",
          phase: "matched",
        });
        onServerAttempt?.();
        return true;
      } catch {
        setState({
          attemptRef: null,
          match: null,
          message: "No fue posible conectar con validación. No autorices el acceso y reintenta.",
          phase: "error",
        });
        return false;
      } finally {
        inFlightRef.current = false;
      }
    },
    [onServerAttempt],
  );

  return {
    credentialValue,
    isValidating: state.phase === "validating",
    reset,
    setCredentialValue,
    state,
    updateMatch,
    validate,
  };
}
