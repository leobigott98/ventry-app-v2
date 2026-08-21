import { describe, expect, it } from "vitest";

import { createEventSchema } from "@/lib/schemas/events";

const valid = {
  residentId: "11111111-1111-4111-8111-111111111111",
  name: "Reunión familiar",
  eventDate: "2026-08-20",
  windowStart: "10:00",
  windowEndDate: "2026-08-20",
  windowEnd: "18:00",
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
    const result = createEventSchema.safeParse({ ...valid, windowEnd: "09:59" });
    expect(result.success).toBe(false);
  });

  it("rechaza un par de salida prevista incompleto", () => {
    const result = createEventSchema.safeParse({ ...valid, plannedExitDate: "2026-08-20", plannedExitTime: null });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toContain("plannedExitTime");
  });

  it("rechaza una salida prevista anterior al fin de vigencia", () => {
    const result = createEventSchema.safeParse({ ...valid, plannedExitDate: "2026-08-20", plannedExitTime: "17:59" });
    expect(result.success).toBe(false);
  });
});
