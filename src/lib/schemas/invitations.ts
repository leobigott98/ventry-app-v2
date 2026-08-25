import { z } from "zod";

import {
  credentialTypeOptions,
  invitationAccessTypeOptions,
} from "@/lib/domain/types";
import { normalizePhoneNumber } from "@/lib/contacts/phone";
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

function validateWindow(
  input: {
    visitDate: string;
    windowStart: string;
    windowEndDate?: string;
    windowEnd?: string;
    noTimeLimit: boolean;
  },
  ctx: z.RefinementCtx,
) {
  if (input.noTimeLimit) {
    return;
  }

  if (!input.windowEnd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["windowEnd"],
      message: "Selecciona la hora final.",
    });
    return;
  }

  const endDate = input.windowEndDate ?? input.visitDate;
  const start = new Date(`${input.visitDate}T${input.windowStart}:00`);
  const end = new Date(`${endDate}T${input.windowEnd}:00`);

  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["windowEnd"],
      message: "La fecha y hora final deben ser posteriores al inicio.",
    });
  }
}

export const createInvitationSchema = z
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
    visitDate: invitationDateSchema,
    windowStart: invitationTimeSchema,
    windowEndDate: invitationDateSchema.optional(),
    windowEnd: invitationTimeSchema.optional(),
    noTimeLimit: z.boolean().default(false),
    notes: nullableOptionalText,
  })
  .superRefine((input, ctx) => {
    if (input.accessType !== "delivery" && !input.visitorName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["visitorName"],
        message: "Ingresa el nombre del visitante.",
      });
    }

    validateWindow(input, ctx);
  });

export const createInvitationGroupSchema = z
  .object({
    idempotencyKey: z.string().uuid("La clave de reintento no es válida."),
    residentId: z.string().uuid("Selecciona un residente."),
    accessType: z.enum(
      invitationAccessTypeOptions.map((option) => option.value) as [string, ...string[]],
    ),
    credentialType: z.enum(
      credentialTypeOptions.map((option) => option.value) as [string, ...string[]],
    ),
    visitDate: invitationDateSchema,
    windowStart: invitationTimeSchema,
    windowEndDate: invitationDateSchema.optional(),
    windowEnd: invitationTimeSchema.optional(),
    noTimeLimit: z.boolean().default(false),
    notes: nullableOptionalText,
    saveNewContacts: z.boolean().optional().default(false),
    visitors: z.array(invitationVisitorSchema).min(2, "Agrega al menos dos personas.").max(25),
  })
  .superRefine((input, ctx) => {
    validateWindow(input, ctx);
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

export const updateInvitationWindowSchema = z
  .object({
    visitDate: invitationDateSchema,
    windowStart: invitationTimeSchema,
    windowEndDate: invitationDateSchema.optional(),
    windowEnd: invitationTimeSchema.optional(),
    noTimeLimit: z.boolean().default(false),
  })
  .superRefine(validateWindow);

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type CreateInvitationGroupInput = z.infer<typeof createInvitationGroupSchema>;
export type InvitationVisitorInput = z.infer<typeof invitationVisitorSchema>;
export type UpdateInvitationWindowInput = z.infer<typeof updateInvitationWindowSchema>;
