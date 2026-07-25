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
export type UpdateInvitationWindowInput = z.infer<typeof updateInvitationWindowSchema>;
