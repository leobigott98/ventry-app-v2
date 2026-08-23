import { z } from "zod";

import { normalizePhoneNumber } from "@/lib/contacts/phone";

export const contactSourceSchema = z.enum(["manual", "contact_picker", "vcard"]);

export const residentContactInputSchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre del contacto.").max(120),
  phone: z.string().trim().min(7, "Ingresa un teléfono válido.").max(32)
    .refine((value) => normalizePhoneNumber(value) !== null, "Ingresa un teléfono venezolano o internacional con código de país."),
  relationshipLabel: z.string().trim().max(80).optional().nullable(),
  isFavorite: z.boolean().default(false),
  source: contactSourceSchema.default("manual"),
});

export const createResidentContactsSchema = z.object({
  contacts: z.array(residentContactInputSchema).min(1).max(200),
});

export const updateResidentContactSchema = residentContactInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "No hay cambios para guardar.",
);

export type ResidentContactInput = z.infer<typeof residentContactInputSchema>;
export type UpdateResidentContactInput = z.infer<typeof updateResidentContactSchema>;
