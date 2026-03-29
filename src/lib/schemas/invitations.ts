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
    windowEnd: invitationTime,
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

    if (input.windowEnd <= input.windowStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["windowEnd"],
        message: "La hora final debe ser posterior a la hora inicial.",
      });
    }
  });

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
