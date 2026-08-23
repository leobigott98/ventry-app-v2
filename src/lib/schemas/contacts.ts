import { z } from "zod";

import { normalizePhoneNumber } from "@/lib/contacts/phone";

export const contactSourceSchema = z.enum(["manual", "contact_picker", "vcard"]);

const optionalContactPhoneSchema = z.union([z.string().trim().max(32), z.null()]).optional()
  .transform((value) => value?.trim() || null)
  .refine((value) => value === null || normalizePhoneNumber(value) !== null, "Ingresa un teléfono venezolano o internacional con código de país.");

export const residentContactInputSchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre del contacto.").max(120),
  phone: optionalContactPhoneSchema,
  relationshipLabel: z.string().trim().max(80).optional().nullable(),
  isFavorite: z.boolean().default(false),
  source: contactSourceSchema.default("manual"),
});

export const createResidentContactsSchema = z.object({
  contacts: z.array(residentContactInputSchema).min(1).max(200),
});

export const reviewResidentContactPhonesSchema = z.object({
  phones: z.array(z.string().trim().min(1).max(32)).max(200),
});

export const updateResidentContactSchema = residentContactInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "No hay cambios para guardar.",
);

export type ResidentContactInput = z.infer<typeof residentContactInputSchema>;
export type UpdateResidentContactInput = z.infer<typeof updateResidentContactSchema>;
