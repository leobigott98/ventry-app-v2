import { z } from "zod";

import {
  credentialTypeOptions,
  invitationAccessTypeOptions,
} from "@/lib/domain/types";
import { normalizePhoneNumber } from "@/lib/contacts/phone";
import { arrivalWindowFieldsSchema, validateArrivalWindow } from "@/lib/schemas/arrival-window";
import { nullableOptionalText } from "@/lib/schemas/community";

function isCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const invitationDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha valida.")
  .refine(isCalendarDate, "Selecciona una fecha válida.");

export const invitationTimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Selecciona una hora valida.")
  .refine((value) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
  }, "Selecciona una hora válida.");

export const invitationVisitorSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresa el nombre del visitante.").max(120),
  phone: nullableOptionalText,
  residentContactId: z.string().uuid().optional().nullable(),
  contactStableId: z.string().max(200).optional().nullable(),
  contactOrigin: z.enum(["history", "saved", "both"]).optional().nullable(),
});

function normalizeLegacyWindow(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  if (input.arrivalWindowMode || !("windowStart" in input || "noTimeLimit" in input)) return value;
  const allDay = input.noTimeLimit === true;
  return { ...input, arrivalWindowMode: allDay ? "all_day" : "from_time", arrivalStart: allDay ? null : input.windowStart ?? null, arrivalEndDate: allDay ? null : input.windowEndDate ?? input.visitDate ?? null, arrivalEnd: allDay ? null : input.windowEnd ?? null, plannedExitDate: input.plannedExitDate ?? null, plannedExitTime: input.plannedExitTime ?? null };
}

const createInvitationCoreSchema = z
  .object({
    idempotencyKey: z.string().uuid("La clave de reintento no es válida."),
    residentId: z.string().uuid("Selecciona un residente."),
    residentContactId: z.string().uuid("El contacto seleccionado no es válido.").optional().nullable(),
    saveContact: z.boolean().optional().default(false),
    visitorName: nullableOptionalText,
    visitorPhone: nullableOptionalText,
    accessType: z.enum(
      invitationAccessTypeOptions.map((option) => option.value) as [string, ...string[]],
    ),
    credentialType: z.enum(
      credentialTypeOptions.map((option) => option.value) as [string, ...string[]],
    ),
    notes: nullableOptionalText,
  }).merge(arrivalWindowFieldsSchema)
  .superRefine((input, ctx) => {
    if (input.accessType !== "delivery" && !input.visitorName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["visitorName"],
        message: "Ingresa el nombre del visitante.",
      });
    }

    validateArrivalWindow(input, ctx);
  });
export const createInvitationSchema = z.preprocess(normalizeLegacyWindow, createInvitationCoreSchema);

const createInvitationGroupCoreSchema = z
  .object({
    idempotencyKey: z.string().uuid("La clave de reintento no es válida."),
    residentId: z.string().uuid("Selecciona un residente."),
    accessType: z.enum(
      invitationAccessTypeOptions.map((option) => option.value) as [string, ...string[]],
    ),
    credentialType: z.enum(
      credentialTypeOptions.map((option) => option.value) as [string, ...string[]],
    ),
    notes: nullableOptionalText,
    saveNewContacts: z.boolean().optional().default(false),
    visitors: z.array(invitationVisitorSchema).min(2, "Agrega al menos dos personas.").max(25),
  }).merge(arrivalWindowFieldsSchema)
  .superRefine((input, ctx) => {
    validateArrivalWindow(input, ctx);
    const seenContacts = new Set<string>();
    const seenPhones = new Set<string>();
    input.visitors.forEach((visitor, index) => {
      const contactKey = visitor.contactStableId ?? visitor.residentContactId ?? null;
      const phone = visitor.phone ? normalizePhoneNumber(visitor.phone) : null;
      if ((contactKey && seenContacts.has(contactKey)) || (phone && seenPhones.has(phone))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["visitors", index, "fullName"], message: "Esta persona ya esta en la lista." });
      }
      if (contactKey) seenContacts.add(contactKey);
      if (phone) seenPhones.add(phone);
    });
  });
export const createInvitationGroupSchema = z.preprocess(normalizeLegacyWindow, createInvitationGroupCoreSchema);

const updateInvitationWindowCoreSchema = z
  .object({}).merge(arrivalWindowFieldsSchema)
  .superRefine(validateArrivalWindow);
export const updateInvitationWindowSchema = z.preprocess(normalizeLegacyWindow, updateInvitationWindowCoreSchema);

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type CreateInvitationGroupInput = z.infer<typeof createInvitationGroupSchema>;
export type InvitationVisitorInput = z.infer<typeof invitationVisitorSchema>;
export type UpdateInvitationWindowInput = z.infer<typeof updateInvitationWindowSchema>;
