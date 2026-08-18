import { describe, expect, it } from "vitest";

import {
  guardSearchSchema,
  manualVehicleEntrySchema,
  registerExitSchema,
  registerInvitationEntrySchema,
  unannouncedVisitorSchema,
  validateCredentialSchema,
} from "@/lib/schemas/guards";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("esquemas de garita", () => {
  it("normaliza credenciales y rechaza codigos demasiado cortos", () => {
    expect(
      validateCredentialSchema.parse({ credentialType: "pin", credentialValue: " 123456 " }),
    ).toEqual({ credentialType: "pin", credentialValue: "123456" });
    expect(
      validateCredentialSchema.safeParse({ credentialType: "qr", credentialValue: " x " }).success,
    ).toBe(false);
  });

  it("exige identificadores UUID para entradas y salidas", () => {
    expect(registerInvitationEntrySchema.safeParse({ invitationId: uuid }).success).toBe(true);
    expect(registerInvitationEntrySchema.safeParse({ invitationId: "invalida" }).success).toBe(false);
    expect(registerExitSchema.safeParse({ entryId: uuid }).success).toBe(true);
    expect(registerExitSchema.safeParse({ entryId: "invalido" }).success).toBe(false);
  });

  it("valida visitantes no anunciados y vehiculos", () => {
    expect(
      unannouncedVisitorSchema.safeParse({
        visitorName: "Carlos",
        residentId: uuid,
        accessType: "visitor",
        notes: "",
      }).success,
    ).toBe(true);
    expect(
      unannouncedVisitorSchema.safeParse({ visitorName: "C", accessType: "visitor" }).success,
    ).toBe(false);
    expect(
      manualVehicleEntrySchema.safeParse({
        vehiclePlate: "ABC123",
        driverName: "Maria",
        residentId: "",
        accessType: "service_provider",
        notes: "",
      }).success,
    ).toBe(true);
    expect(
      manualVehicleEntrySchema.safeParse({ vehiclePlate: "A", accessType: "visitor" }).success,
    ).toBe(false);
  });

  it("limita las busquedas vacias o excesivas", () => {
    expect(guardSearchSchema.safeParse({ q: " Ana " }).success).toBe(true);
    expect(guardSearchSchema.safeParse({ q: " " }).success).toBe(false);
    expect(guardSearchSchema.safeParse({ q: "a".repeat(101) }).success).toBe(false);
  });
});
