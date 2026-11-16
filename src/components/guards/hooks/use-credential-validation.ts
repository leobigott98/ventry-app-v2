"use client";

import { useCallback, useRef, useState } from "react";

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
  match?: ValidationMatch | null;
  ok?: boolean;
};

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

        if (!response.ok) {
          setState({
            attemptRef,
            match: null,
            message: getGuardApiError(payload, "No fue posible validar el código."),
            phase: "error",
          });
          onServerAttempt?.();
          return false;
        }

        if (!payload.match) {
          setState({
            attemptRef,
            match: null,
            message: payload.message ?? "No encontramos ese código.",
            phase: "not_found",
          });
          onServerAttempt?.();
          return false;
        }

        setState({
          attemptRef,
          match: payload.match,
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
