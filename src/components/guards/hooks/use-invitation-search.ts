"use client";

import { useEffect, useState } from "react";

import { getGuardApiError, readGuardApiPayload } from "@/components/guards/guard-api";
import type { GuardInvitation } from "@/components/guards/guard-types";

export function useInvitationSearch(invitations: GuardInvitation[]) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(invitations);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(invitations);
      setError(null);
      setIsSearching(false);
      return;
    }

    setResults([]);
    setError(null);
    setIsSearching(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/guards/invitation-search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        const payload = await readGuardApiPayload<{ results?: GuardInvitation[] }>(response);
        if (controller.signal.aborted) return;

        if (!response.ok) {
          setError(getGuardApiError(payload, "No fue posible buscar."));
          return;
        }

        setResults(payload.results ?? []);
        setError(null);
      } catch {
        if (controller.signal.aborted) return;
        setError("No fue posible conectar con la búsqueda.");
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [invitations, query]);

  return { error, isSearching, query, results, setQuery };
}
