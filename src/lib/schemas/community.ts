import { z } from "zod";

import {
  accessPolicyOptions,
  gateOperationOptions,
} from "@/lib/domain/types";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .transform((value) => value || null);

const optionalEmail = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .refine((value) => value === "" || z.string().email().safeParse(value).success, {
    message: "Ingresa un correo valido o dejalo vacio.",
  })
  .transform((value) => value || null);

const optionalUrl = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .refine(
    (value) => value === "" || /^https?:\/\/.+/i.test(value),
    "Ingresa una URL valida o deja este campo vacio.",
  )
  .transform((value) => value || null);

export const nullableOptionalText = optionalText;

export const onboardingSchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre de la comunidad."),
  address: z.string().trim().min(5, "Ingresa la direccion principal."),
  locationLabel: z.string().trim().min(2, "Agrega una referencia o ubicacion."),
  plannedUnitCount: z
    .number({ invalid_type_error: "Ingresa la cantidad de unidades." })
    .int()
    .min(1, "Debe existir al menos una unidad.")
    .max(5000, "La cantidad luce demasiado alta para esta etapa."),
  accessPolicyMode: z.enum(accessPolicyOptions.map((option) => option.value) as [string, ...string[]]),
  accessPolicyNotes: optionalText,
  adminContactName: z.string().trim().min(2, "Ingresa el nombre del contacto principal."),
  adminContactPhone: z.string().trim().min(7, "Ingresa un telefono o WhatsApp valido."),
  adminContactEmail: optionalEmail,
  gateOperationMode: z.enum(
    gateOperationOptions.map((option) => option.value) as [string, ...string[]],
  ),
  gateOperationNotes: optionalText,
  logoUrl: optionalUrl,
});

export const communityProfileSchema = onboardingSchema.extend({
  plannedUnitCount: onboardingSchema.shape.plannedUnitCount.optional(),
});

export const unitSchema = z.object({
  identifier: z.string().trim().min(1, "Ingresa el identificador de la unidad."),
  building: optionalText,
  isActive: z.boolean(),
});

export const residentSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresa nombre y apellido."),
  phone: z.string().trim().min(7, "Ingresa un telefono principal."),
  whatsappPhone: optionalText,
  email: optionalEmail,
  unitId: optionalText,
  isActive: z.boolean(),
  notes: optionalText,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type CommunityProfileInput = z.infer<typeof communityProfileSchema>;
export type UnitInput = z.infer<typeof unitSchema>;
export type ResidentInput = z.infer<typeof residentSchema>;
