export type GuardApiError = {
  error?: string;
  message?: string;
  requestId?: string;
};

export async function readGuardApiPayload<T>(response: Response): Promise<T & GuardApiError> {
  const text = await response.text();

  if (!text) return {} as T & GuardApiError;

  try {
    return JSON.parse(text) as T & GuardApiError;
  } catch {
    return {
      error: "La garita recibió una respuesta inválida del servidor. Intenta nuevamente.",
    } as T & GuardApiError;
  }
}

export function getGuardApiError(
  payload: GuardApiError,
  fallback: string,
) {
  return payload.error ?? payload.message ?? fallback;
}
