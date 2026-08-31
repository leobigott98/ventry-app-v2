import "server-only";

type OperationErrorMetadata = {
  code: string | null;
  message: string;
  details: string | null;
  hint: string | null;
};

export class OperationError extends Error {
  readonly code: string | null;
  readonly details: string | null;
  readonly hint: string | null;

  constructor(metadata: OperationErrorMetadata) {
    super(metadata.message);
    this.name = "OperationError";
    this.code = metadata.code;
    this.details = metadata.details;
    this.hint = metadata.hint;
  }
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sanitizeDiagnostic(value: string | null) {
  if (!value) return null;
  return value
    .replace(/\b(pin|qr|token|credential|clave)(\s*[:=]?\s*)\S+/gi, "$1=[dato omitido]")
    .replace(/\+?\d[\d\s()-]{5,}\d/g, "[dato omitido]")
    .replace(/\b\d{4,8}\b/g, "[dato omitido]")
    .replace(/\b[0-9a-f]{24,}\b/gi, "[dato omitido]")
    .replace(/\{[^{}]{1,400}\}/g, "[payload omitido]")
    .slice(0, 500);
}

function sanitizeCode(value: string | null) {
  return value?.replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || null;
}

export function operationErrorFrom(error: unknown, fallbackMessage: string) {
  if (error instanceof OperationError) return error;
  const record = error && typeof error === "object" ? error as Record<string, unknown> : null;
  return new OperationError({
    code: stringField(record?.code),
    message: stringField(record?.message) ?? fallbackMessage,
    details: stringField(record?.details),
    hint: stringField(record?.hint),
  });
}

export function logOperationError(operation: string, error: unknown) {
  const metadata = operationErrorFrom(error, "Error interno sin mensaje técnico.");
  console.error("[server-operation-error]", {
    operation,
    code: sanitizeCode(metadata.code),
    message: sanitizeDiagnostic(metadata.message),
    details: sanitizeDiagnostic(metadata.details),
    hint: sanitizeDiagnostic(metadata.hint),
  });
}
