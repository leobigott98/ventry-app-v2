import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha válida.").refine((value) => {
  const [year, month, day] = value.split("-").map(Number); const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Selecciona una fecha válida.");
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Selecciona una hora válida.");
const optionalDate = z.union([dateSchema, z.literal(""), z.null(), z.undefined()]).transform((value) => value || null);
const optionalTime = z.union([timeSchema, z.literal(""), z.null(), z.undefined()]).transform((value) => value || null);

export const arrivalWindowFieldsSchema = z.object({
  arrivalWindowMode: z.enum(["all_day", "from_time"]).default("all_day"),
  visitDate: dateSchema,
  arrivalStart: optionalTime,
  arrivalEndDate: optionalDate,
  arrivalEnd: optionalTime,
  plannedExitDate: optionalDate,
  plannedExitTime: optionalTime,
});

function wallClock(date: string, time: string) {
  return `${date}T${time}`;
}

export function validateArrivalWindow(
  input: z.infer<typeof arrivalWindowFieldsSchema>,
  ctx: z.RefinementCtx,
) {
  if (input.arrivalWindowMode === "all_day") {
    if (input.arrivalStart) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["arrivalStart"], message: "Todo el día no necesita una hora inicial." });
    if (input.arrivalEnd || input.arrivalEndDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["arrivalEnd"], message: "Todo el día no necesita una hora límite." });
  } else if (!input.arrivalStart) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["arrivalStart"], message: "Indica desde qué hora puede llegar." });
  }

  if (Boolean(input.arrivalEndDate) !== Boolean(input.arrivalEnd)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [input.arrivalEndDate ? "arrivalEnd" : "arrivalEndDate"], message: "Completa la fecha y la hora límite de llegada." });
  } else if (input.arrivalEndDate && input.arrivalEnd) {
    const startTime = input.arrivalWindowMode === "all_day" ? "00:00" : input.arrivalStart;
    if (startTime && wallClock(input.arrivalEndDate, input.arrivalEnd) <= wallClock(input.visitDate, startTime)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["arrivalEnd"], message: "La hora límite debe ser posterior al inicio de llegada." });
    }
  }

  if (Boolean(input.plannedExitDate) !== Boolean(input.plannedExitTime)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [input.plannedExitDate ? "plannedExitTime" : "plannedExitDate"], message: "Completa la fecha y la hora de salida prevista." });
  } else if (input.plannedExitDate && input.plannedExitTime) {
    const startTime = input.arrivalWindowMode === "all_day" ? "00:00" : input.arrivalStart;
    if (startTime && wallClock(input.plannedExitDate, input.plannedExitTime) <= wallClock(input.visitDate, startTime)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["plannedExitTime"], message: "La salida prevista debe ser posterior al inicio de llegada." });
    }
  }
}

export type ArrivalWindowFields = z.infer<typeof arrivalWindowFieldsSchema>;
