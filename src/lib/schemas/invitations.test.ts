import { describe, expect, it } from "vitest";

import {
  createInvitationSchema,
  updateInvitationWindowSchema,
} from "@/lib/schemas/invitations";

const validInvitation = {
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
});
