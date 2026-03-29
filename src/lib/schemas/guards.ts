import { z } from "zod";

import { invitationAccessTypeOptions } from "@/lib/domain/types";
import { nullableOptionalText } from "@/lib/schemas/community";

export const validateCredentialSchema = z.object({
  credentialType: z.enum(["pin", "qr"]),
  credentialValue: z
    .string()
    .trim()
    .min(3, "Ingresa un PIN o codigo valido."),
});

export const registerInvitationEntrySchema = z.object({
  invitationId: z.string().uuid("Invitacion invalida."),
});

export const registerExitSchema = z.object({
  entryId: z.string().uuid("Registro invalido."),
});

export const unannouncedVisitorSchema = z.object({
  visitorName: z.string().trim().min(2, "Ingresa el nombre del visitante."),
  residentId: nullableOptionalText,
  accessType: z.enum(
    invitationAccessTypeOptions.map((option) => option.value) as [string, ...string[]],
  ),
  notes: nullableOptionalText,
});

export const manualVehicleEntrySchema = z.object({
  vehiclePlate: z.string().trim().min(3, "Ingresa la placa."),
  driverName: nullableOptionalText,
  residentId: nullableOptionalText,
  accessType: z.enum(
    invitationAccessTypeOptions.map((option) => option.value) as [string, ...string[]],
  ),
  notes: nullableOptionalText,
});

export const guardSearchSchema = z.object({
  q: z.string().trim().min(1).max(100),
});

export type ValidateCredentialInput = z.infer<typeof validateCredentialSchema>;
export type RegisterInvitationEntryInput = z.infer<typeof registerInvitationEntrySchema>;
export type RegisterExitInput = z.infer<typeof registerExitSchema>;
export type UnannouncedVisitorInput = z.infer<typeof unannouncedVisitorSchema>;
export type ManualVehicleEntryInput = z.infer<typeof manualVehicleEntrySchema>;
