import { z } from "zod";

import {
  credentialTypeOptions,
  invitationAccessTypeOptions,
} from "@/lib/domain/types";
import { nullableOptionalText } from "@/lib/schemas/community";

const invitationDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha valida.");

const invitationTime = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Selecciona una hora valida.");

export const invitationVisitorSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresa el nombre del visitante.").max(120),
  phone: nullableOptionalText,
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
    residentId: z.string().uuid("Selecciona un residente."),
    visitorName: nullableOptionalText,
    visitorPhone: nullableOptionalText,
    accessType: z.enum(
      invitationAccessTypeOptions.map((option) => option.value) as [string, ...string[]],
    ),
    credentialType: z.enum(
      credentialTypeOptions.map((option) => option.value) as [string, ...string[]],
    ),
    visitDate: invitationDate,
    windowStart: invitationTime,
    windowEndDate: invitationDate.optional(),
    windowEnd: invitationTime.optional(),
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
    visitDate: invitationDate,
    windowStart: invitationTime,
    windowEndDate: invitationDate.optional(),
    windowEnd: invitationTime.optional(),
    noTimeLimit: z.boolean().default(false),
    notes: nullableOptionalText,
    visitors: z.array(invitationVisitorSchema).min(2, "Agrega al menos dos personas.").max(25),
  })
  .superRefine((input, ctx) => {
    validateWindow(input, ctx);
    const seen = new Set<string>();
    input.visitors.forEach((visitor, index) => {
      const key = `${visitor.fullName.toLocaleLowerCase("es-VE")}|${visitor.phone?.replace(/\s+/g, "") ?? ""}`;
      if (seen.has(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["visitors", index, "fullName"], message: "Esta persona ya esta en la lista." });
      }
      seen.add(key);
    });
  });

export const updateInvitationWindowSchema = z
  .object({
    visitDate: invitationDate,
    windowStart: invitationTime,
    windowEndDate: invitationDate.optional(),
    windowEnd: invitationTime.optional(),
    noTimeLimit: z.boolean().default(false),
  })
  .superRefine(validateWindow);

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type CreateInvitationGroupInput = z.infer<typeof createInvitationGroupSchema>;
export type InvitationVisitorInput = z.infer<typeof invitationVisitorSchema>;
export type UpdateInvitationWindowInput = z.infer<typeof updateInvitationWindowSchema>;
