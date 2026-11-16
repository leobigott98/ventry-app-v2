export const preferenceKinds = [
  "visit_waiting",
  "entry_registered",
  "credential_rejected",
  "call_incoming",
  "call_missed",
] as const;

export type PreferenceKind = (typeof preferenceKinds)[number];
export type NotificationKind = PreferenceKind | "test";

export const notificationCopy = {
  visit_waiting: { title: "Visita esperando confirmación", body: "Abre Ventry para responder a la garita.", action: "review" },
  entry_registered: { title: "Entrada registrada", body: "Consulta el registro en Ventry.", action: "open" },
  credential_rejected: { title: "Acceso rechazado", body: "Un QR o PIN no permitió el acceso. Revisa el aviso en Ventry.", action: "review" },
  call_incoming: { title: "Llamada entrante", body: "Abre Ventry para ver la llamada.", action: "call" },
  call_missed: { title: "Llamada perdida", body: "Consulta el aviso en Ventry.", action: "open" },
  test: { title: "Prueba de Ventry", body: "Aviso de prueba de las notificaciones de Ventry.", action: "open" },
} as const satisfies Record<NotificationKind, { title: string; body: string; action: string }>;

export type NotificationEvent = {
  id: string;
  kind: NotificationKind;
  created_at: string;
  target_id: string | null;
  target_type: "confirmation" | "invitation" | "event" | "entry" | "call" | null;
};

export function notificationHref(id: string) {
  return "/app/notifications/" + id;
}

export function getPreferenceKinds(role: string) {
  return role === "resident" ? preferenceKinds : preferenceKinds.filter((kind) => kind.startsWith("call_"));
}
