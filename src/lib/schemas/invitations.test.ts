import { describe, expect, it } from "vitest";

import {
  createInvitationSchema,
  createInvitationGroupSchema,
  updateInvitationWindowSchema,
} from "@/lib/schemas/invitations";

const validInvitation = {
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
  residentId: "11111111-1111-4111-8111-111111111111",
  visitorName: "Carlos Rojas",
  accessType: "visitor",
  credentialType: "pin",
  visitDate: "2026-08-17",
  windowStart: "09:00",
  windowEndDate: "2026-08-17",
  windowEnd: "11:00",
  noTimeLimit: false,
  notes: "Vehiculo azul",
};

describe("esquemas de invitaciones", () => {
  it("acepta una invitacion completa", () => {
    expect(createInvitationSchema.safeParse(validInvitation).success).toBe(true);
    expect(createInvitationSchema.safeParse({ ...validInvitation, idempotencyKey: undefined }).success).toBe(false);
  });

  it("exige nombre salvo para delivery", () => {
    expect(
      createInvitationSchema.safeParse({ ...validInvitation, visitorName: "" }).success,
    ).toBe(false);
    expect(
      createInvitationSchema.safeParse({
        ...validInvitation,
        accessType: "delivery",
        visitorName: "",
      }).success,
    ).toBe(true);
  });

  it("rechaza residentes, fechas y ventanas invalidas", () => {
    expect(
      createInvitationSchema.safeParse({ ...validInvitation, residentId: "otro" }).success,
    ).toBe(false);
    expect(
      createInvitationSchema.safeParse({ ...validInvitation, visitDate: "17/08/2026" }).success,
    ).toBe(false);
    expect(createInvitationSchema.safeParse({ ...validInvitation, visitDate: "2026-02-30" }).success).toBe(false);
    expect(createInvitationSchema.safeParse({ ...validInvitation, windowStart: "29:70" }).success).toBe(false);
    expect(
      createInvitationSchema.safeParse({ ...validInvitation, windowEnd: "08:59" }).success,
    ).toBe(false);
  });

  it("permite actualizar a una ventana sin limite", () => {
    expect(
      updateInvitationWindowSchema.safeParse({
        visitDate: "2026-08-17",
        windowStart: "09:00",
        noTimeLimit: true,
      }).success,
    ).toBe(true);
  });

  it("permite nombres iguales nuevos pero rechaza contacto o teléfono repetido en grupos", () => {
    const group = { ...validInvitation, idempotencyKey: "11111111-1111-4111-8111-111111111199", visitors: [
      { fullName: "José Pérez", phone: null }, { fullName: "José Pérez", phone: null },
    ] };
    expect(createInvitationGroupSchema.safeParse(group).success).toBe(true);
    expect(createInvitationGroupSchema.safeParse({ ...group, visitors: [
      { fullName: "Uno", phone: "04125551234" }, { fullName: "Dos", phone: "+58 412 555 1234" },
    ] }).success).toBe(false);
    expect(createInvitationGroupSchema.safeParse({ ...group, visitors: [
      { fullName: "Uno", phone: null, contactStableId: "saved:one" }, { fullName: "Dos", phone: null, contactStableId: "saved:one" },
    ] }).success).toBe(false);
  });
});
