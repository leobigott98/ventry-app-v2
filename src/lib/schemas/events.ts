import { z } from "zod";

import { credentialTypeOptions } from "@/lib/domain/types";
import { normalizePhoneNumber } from "@/lib/contacts/phone";
import { nullableOptionalText } from "@/lib/schemas/community";
import { arrivalWindowFieldsSchema, validateArrivalWindow } from "@/lib/schemas/arrival-window";

const eventDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha valida.");
export const eventGuestSchema = z.object({
  fullName: z.string().trim().min(2, "Cada invitado necesita un nombre.").max(120),
  phone: nullableOptionalText,
  notes: nullableOptionalText,
  allowsCompanions: z.boolean().optional(),
  maxCompanions: z.number().int().min(0).max(5).optional(),
  residentContactId: z.string().uuid().optional().nullable(),
  contactStableId: z.string().max(200).optional().nullable(),
  contactOrigin: z.enum(["history", "saved", "both"]).optional().nullable(),
});

function normalizeLegacyEventWindow(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  if (input.arrivalWindowMode || !("windowStart" in input)) return value;
  return { ...input, arrivalWindowMode: "from_time", arrivalStart: input.windowStart ?? null, arrivalEndDate: input.windowEndDate ?? null, arrivalEnd: input.windowEnd ?? null };
}

const createEventCoreSchema = z
  .object({
    idempotencyKey: z.string().uuid("La clave de reintento no es valida."),
    residentId: z.string().uuid("Selecciona un residente."),
    name: z.string().trim().min(2, "Escribe el nombre del evento.").max(120),
    credentialType: z.enum(
      credentialTypeOptions.map((option) => option.value) as [string, ...string[]],
    ),
    notes: nullableOptionalText,
    allowsCompanions: z.boolean().default(false),
    maxCompanions: z.number().int().min(0).max(5).default(0),
    saveNewContacts: z.boolean().optional().default(false),
    guests: z.array(eventGuestSchema).min(1, "Agrega al menos un invitado.").max(500),
  }).merge(arrivalWindowFieldsSchema.omit({ visitDate: true }).extend({ eventDate }))
  .superRefine((input, ctx) => {
    validateArrivalWindow({ ...input, visitDate: input.eventDate }, ctx);

    const seenContacts = new Set<string>();
    const seenPhones = new Set<string>();
    input.guests.forEach((guest, index) => {
      const contactKey = guest.contactStableId ?? guest.residentContactId ?? null;
      const phone = guest.phone ? normalizePhoneNumber(guest.phone) : null;
      if ((contactKey && seenContacts.has(contactKey)) || (phone && seenPhones.has(phone))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["guests", index, "fullName"],
          message: `${guest.fullName} aparece mas de una vez.`,
        });
      }
      if (contactKey) seenContacts.add(contactKey);
      if (phone) seenPhones.add(phone);

      const allowsCompanions = guest.allowsCompanions ?? input.allowsCompanions;
      const maxCompanions = guest.maxCompanions ?? input.maxCompanions;
      if ((!allowsCompanions && maxCompanions !== 0) || (allowsCompanions && (maxCompanions < 1 || maxCompanions > 5))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["guests", index, "maxCompanions"], message: "Configura entre 1 y 5 acompanantes, o desactivalos." });
      }
    });

    if ((!input.allowsCompanions && input.maxCompanions !== 0) || (input.allowsCompanions && input.maxCompanions < 1)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxCompanions"], message: "Configura entre 1 y 5 acompanantes, o desactivalos." });
    }
  });
export const createEventSchema = z.preprocess(normalizeLegacyEventWindow, createEventCoreSchema);

export const registerEventGuestSchema = z.object({
  eventId: z.string().uuid("Evento invalido."),
  eventGuestId: z.string().uuid("Invitado invalido."),
  companionCount: z.number().int().min(0).max(5).default(0),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type EventGuestInput = z.infer<typeof eventGuestSchema>;
