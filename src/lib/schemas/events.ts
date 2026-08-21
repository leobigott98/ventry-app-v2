import { z } from "zod";

import { credentialTypeOptions } from "@/lib/domain/types";
import { nullableOptionalText } from "@/lib/schemas/community";

const eventDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha valida.");
const eventTime = z.string().regex(/^\d{2}:\d{2}$/, "Selecciona una hora valida.");
const optionalEventDate = z
  .union([eventDate, z.literal(""), z.null(), z.undefined()])
  .transform((value) => value || null);
const optionalEventTime = z
  .union([eventTime, z.literal(""), z.null(), z.undefined()])
  .transform((value) => value || null);

export const eventGuestSchema = z.object({
  fullName: z.string().trim().min(2, "Cada invitado necesita un nombre.").max(120),
  phone: nullableOptionalText,
  notes: nullableOptionalText,
});

export const createEventSchema = z
  .object({
    residentId: z.string().uuid("Selecciona un residente."),
    name: z.string().trim().min(2, "Escribe el nombre del evento.").max(120),
    eventDate,
    windowStart: eventTime,
    windowEndDate: eventDate,
    windowEnd: eventTime,
    plannedExitDate: optionalEventDate,
    plannedExitTime: optionalEventTime,
    credentialType: z.enum(
      credentialTypeOptions.map((option) => option.value) as [string, ...string[]],
    ),
    notes: nullableOptionalText,
    guests: z.array(eventGuestSchema).min(1, "Agrega al menos un invitado.").max(500),
  })
  .superRefine((input, ctx) => {
    const start = new Date(`${input.eventDate}T${input.windowStart}:00`);
    const end = new Date(`${input.windowEndDate}T${input.windowEnd}:00`);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["windowEnd"],
        message: "La fecha y hora final deben ser posteriores al inicio.",
      });
    }

    const hasPlannedExitDate = Boolean(input.plannedExitDate);
    const hasPlannedExitTime = Boolean(input.plannedExitTime);
    if (hasPlannedExitDate !== hasPlannedExitTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hasPlannedExitDate ? "plannedExitTime" : "plannedExitDate"],
        message: "Completa la fecha y la hora de salida prevista.",
      });
    } else if (input.plannedExitDate && input.plannedExitTime) {
      const plannedExit = new Date(`${input.plannedExitDate}T${input.plannedExitTime}:00`);
      if (Number.isNaN(plannedExit.valueOf()) || plannedExit < end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["plannedExitTime"],
          message: "La salida prevista debe ser igual o posterior al fin de la vigencia.",
        });
      }
    }

    const seen = new Set<string>();
    input.guests.forEach((guest, index) => {
      const key = `${guest.fullName.trim().toLocaleLowerCase()}|${guest.phone?.trim() ?? ""}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["guests", index, "fullName"],
          message: `${guest.fullName} aparece mas de una vez.`,
        });
      }
      seen.add(key);
    });
  });

export const registerEventGuestSchema = z.object({
  eventId: z.string().uuid("Evento invalido."),
  eventGuestId: z.string().uuid("Invitado invalido."),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type EventGuestInput = z.infer<typeof eventGuestSchema>;
