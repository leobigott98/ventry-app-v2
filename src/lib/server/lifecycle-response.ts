import "server-only";

import { NextResponse } from "next/server";

import { OperationError, logOperationError } from "@/lib/server/operation-error";

export function lifecycleErrorResponse(operation: string, error: unknown) {
  logOperationError(operation, error);
  const code = error instanceof OperationError ? error.code : null;
  if (code === "40001") return NextResponse.json({ error: "Este acceso cambió en otra sesión. Recarga la página antes de reintentar.", code: "VERSION_CONFLICT" }, { status: 409 });
  if (code === "42501") return NextResponse.json({ error: "No tienes permiso para modificar este acceso." }, { status: 403 });
  if (code === "P0002") return NextResponse.json({ error: "No encontramos el acceso solicitado." }, { status: 404 });
  if (code === "22023") return NextResponse.json({ error: "Revisa los datos de la operación." }, { status: 400 });
  if (code === "55000") return NextResponse.json({ error: error instanceof Error ? error.message : "El estado actual no permite esta operación." }, { status: 409 });
  return NextResponse.json({ error: "No fue posible completar la operación. Intenta nuevamente." }, { status: 500 });
}
