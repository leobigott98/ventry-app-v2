import { describe, expect, it } from "vitest";

import { createEventSchema } from "@/lib/schemas/events";

const valid = {
  idempotencyKey: "11111111-1111-4111-8111-111111111199",
  residentId: "11111111-1111-4111-8111-111111111111",
  name: "Reunión familiar",
  eventDate: "2026-08-20",
  arrivalWindowMode: "from_time",
  arrivalStart: "10:00",
  arrivalEndDate: "2026-08-20",
  arrivalEnd: "18:00",
  plannedExitDate: null,
  plannedExitTime: null,
  credentialType: "qr",
  notes: null,
  guests: [{ fullName: "Carlos Rojas", phone: null, notes: null }],
};

describe("createEventSchema", () => {
  it("acepta eventos sin salida prevista y con una salida válida", () => {
    expect(createEventSchema.safeParse({ ...valid, plannedExitDate: null, plannedExitTime: null }).success).toBe(true);
    expect(createEventSchema.safeParse({ ...valid, plannedExitDate: "2026-08-20", plannedExitTime: "19:00" }).success).toBe(true);
  });

  it("rechaza un final anterior al inicio", () => {
    const result = createEventSchema.safeParse({ ...valid, arrivalEnd: "09:59" });
    expect(result.success).toBe(false);
  });

  it("rechaza un par de salida prevista incompleto", () => {
    const result = createEventSchema.safeParse({ ...valid, plannedExitDate: "2026-08-20", plannedExitTime: null });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toContain("plannedExitTime");
  });

  it("permite salir antes del cierre de llegada y rechaza salir antes del inicio", () => {
    const result = createEventSchema.safeParse({ ...valid, plannedExitDate: "2026-08-20", plannedExitTime: "17:59" });
    expect(result.success).toBe(true);
    expect(createEventSchema.safeParse({ ...valid, plannedExitDate: "2026-08-20", plannedExitTime: "09:59" }).success).toBe(false);
  });

  it("valida acompanantes generales y excepciones por invitado", () => {
    expect(createEventSchema.safeParse({ ...valid, allowsCompanions: true, maxCompanions: 3 }).success).toBe(true);
    expect(createEventSchema.safeParse({ ...valid, allowsCompanions: false, maxCompanions: 2 }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...valid, allowsCompanions: false, maxCompanions: 0, guests: [{ ...valid.guests[0], allowsCompanions: true, maxCompanions: 6 }] }).success).toBe(false);
  });

  it("permite homónimos nuevos y evita contactos o teléfonos duplicados", () => {
    expect(createEventSchema.safeParse({ ...valid, guests: [{ fullName: "José", phone: null }, { fullName: "José", phone: null }] }).success).toBe(true);
    expect(createEventSchema.safeParse({ ...valid, guests: [{ fullName: "Uno", phone: "04125551234" }, { fullName: "Dos", phone: "+58 412 555 1234" }] }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...valid, guests: [{ fullName: "Uno", phone: null, contactStableId: "history:one" }, { fullName: "Dos", phone: null, contactStableId: "history:one" }] }).success).toBe(false);
  });
});
