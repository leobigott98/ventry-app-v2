import { addCalendarDays } from "@/lib/arrival-window";

export const VENEZUELAN_TIME_BANDS_VERSION = 1;
export const VENEZUELAN_TIME_BANDS = [
  { expressions: ["primera hora de la mañana", "temprano en la mañana"], start: "07:00", end: "10:00", crossesMidnight: false },
  { expressions: ["en la mañana"], start: "08:00", end: "12:00", crossesMidnight: false },
  { expressions: ["al mediodía", "al mediodia"], start: "11:00", end: "14:00", crossesMidnight: false },
  { expressions: ["en la tarde"], start: "12:00", end: "18:00", crossesMidnight: false },
  { expressions: ["en la noche"], start: "18:00", end: "00:00", crossesMidnight: true },
  { expressions: ["en la madrugada"], start: "23:00", end: "06:00", crossesMidnight: true },
] as const;

const WEEKDAYS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6 };
const HOUR_WORDS: Record<string, number> = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
const HOUR_PATTERN = "(?:\\d{1,2}|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)";
const normalize = (value: string) => value.toLocaleLowerCase("es-VE").replace(/\s+/g, " ").trim();

function nextWeekday(referenceDate: string, weekday: number) {
  const reference = new Date(`${referenceDate}T12:00:00.000Z`);
  const delta = (weekday - reference.getUTCDay() + 7) % 7 || 7;
  return addCalendarDays(referenceDate, delta);
}

function parseDate(text: string, referenceDate: string) {
  const dateContext = text.replace(/\b(?:de|en|por) la mañana\b/g, " ");
  if (/\bhoy\b/.test(dateContext)) return referenceDate;
  if (/\bmañana\b/.test(dateContext)) return addCalendarDays(referenceDate, 1);
  for (const [name, weekday] of Object.entries(WEEKDAYS)) if (new RegExp(`\\b${name}\\b`).test(dateContext)) return nextWeekday(referenceDate, weekday);
  return /\b(20\d{2}-\d{2}-\d{2})\b/.exec(dateContext)?.[1] ?? null;
}

function hour24(raw: string, minutes: string | undefined, period: string | undefined) {
  let hour = HOUR_WORDS[raw] ?? Number(raw);
  const minute = Number(minutes ?? "0");
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return null;
  if (period && /tarde|noche/.test(period) && hour < 12) hour += 12;
  if (period && /mañana|madrugada/.test(period) && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const explicitPeriod = (text: string) => /(?:de|en|por) la (mañana|tarde|noche|madrugada)/.exec(text)?.[1];

export type DeterministicTemporalResult = {
  visitDate: string | null; arrivalWindowMode: "all_day" | "from_time" | null;
  arrivalStart: string | null; arrivalEndDate: string | null; arrivalEnd: string | null;
  plannedExitDate: string | null; plannedExitTime: string | null;
  ambiguities: Array<{ field: string; code: string; question: string; options?: Array<{ value: string; label: string }> }>;
};

export function interpretVenezuelanTemporal(input: { transcript: string; referenceLocalDate: string; dateText?: string | null; arrivalText?: string | null; plannedExitText?: string | null }): DeterministicTemporalResult {
  const transcript = normalize(input.transcript);
  const dateText = normalize(input.dateText ?? transcript);
  // The transcript remains authoritative for detecting whether a time was spoken.
  // Provider fields are useful hints, but may omit words such as the actual hour.
  const arrivalText = normalize(`${transcript} ${input.arrivalText ?? ""}`);
  const plannedExitText = normalize(input.plannedExitText ?? transcript);
  const ambiguities: DeterministicTemporalResult["ambiguities"] = [];
  let visitDate = parseDate(`${dateText} ${transcript}`, input.referenceLocalDate);
  if (visitDate && visitDate < input.referenceLocalDate) {
    ambiguities.push({ field: "visitDate", code: "PAST_DATE", question: "La fecha indicada ya pasó. Selecciona una fecha de hoy en adelante." });
    visitDate = null;
  }
  let arrivalWindowMode: DeterministicTemporalResult["arrivalWindowMode"] = null;
  let arrivalStart: string | null = null;
  let arrivalEnd: string | null = null;
  let arrivalEndDate: string | null = null;
  const allDayPattern = /\btodo el día\b|\btodo el dia\b/;
  const spokenTimePattern = /\b(?:a|desde|entre|antes de|como a|tipo|alrededor de)\s+(?:(?:la|las)\s+)?[\p{L}\d:.]+/u;
  const providerArrivalText = normalize(input.arrivalText ?? "");

  if (allDayPattern.test(transcript) || (!spokenTimePattern.test(transcript) && allDayPattern.test(providerArrivalText))) arrivalWindowMode = "all_day";
  else {
    const between = new RegExp(`(?:entre|de)\\s+(?:(?:la|las)\\s+)?(${HOUR_PATTERN})(?:[:.](\\d{2}))?\\s*(?:(?:de|en|por) la\\s+)?(mañana|tarde|noche|madrugada)?\\s+(?:y|a)\\s+(?:(?:la|las)\\s+)?(${HOUR_PATTERN})(?:[:.](\\d{2}))?\\s*(?:(?:de|en|por) la\\s+)?(mañana|tarde|noche|madrugada)?`).exec(arrivalText);
    const from = new RegExp(`(?:desde|como a|tipo|alrededor de|a)\\s+(?:(?:la|las)\\s+)?(${HOUR_PATTERN})(?:[:.](\\d{2}))?\\s*(?:(?:de|en|por) la\\s+)?(mañana|tarde|noche|madrugada)?`).exec(arrivalText);
    const before = new RegExp(`antes de\\s+(?:(?:la|las)\\s+)?(${HOUR_PATTERN})(?:[:.](\\d{2}))?\\s*(?:(?:de|en|por) la\\s+)?(mañana|tarde|noche|madrugada)?`).exec(arrivalText);
    const band = VENEZUELAN_TIME_BANDS.find((item) => item.expressions.some((expression) => arrivalText.includes(expression)));
    if (between) {
      const period = between[6] ?? between[3] ?? explicitPeriod(arrivalText);
      arrivalWindowMode = "from_time"; arrivalStart = hour24(between[1], between[2], between[3] ?? period); arrivalEnd = hour24(between[4], between[5], between[6] ?? period);
      if (!arrivalStart || !arrivalEnd) ambiguities.push({ field: "arrivalStart", code: "TIME_INVALID", question: "No reconocimos ese horario. Indica una hora válida." });
      else if (visitDate) arrivalEndDate = arrivalEnd <= arrivalStart ? addCalendarDays(visitDate, 1) : visitDate;
    } else if (from) {
      const period = from[3] ?? explicitPeriod(arrivalText); arrivalWindowMode = "from_time";
      const rawHour = HOUR_WORDS[from[1]] ?? Number(from[1]);
      if (!period && rawHour >= 1 && rawHour <= 6) {
        const morning = hour24(from[1], from[2], "mañana")!;
        const afternoon = hour24(from[1], from[2], "tarde")!;
        ambiguities.push({ field: "arrivalStart", code: "AM_PM_AMBIGUOUS", question: `¿Las ${rawHour} son de la mañana o de la tarde?`, options: [{ value: morning, label: `${morning} de la mañana` }, { value: afternoon, label: `${afternoon} de la tarde` }] });
      } else {
        arrivalStart = hour24(from[1], from[2], period);
        if (!arrivalStart) ambiguities.push({ field: "arrivalStart", code: "TIME_INVALID", question: "No reconocimos esa hora de llegada. Indica una hora válida." });
      }
    } else if (band) {
      arrivalWindowMode = "from_time"; arrivalStart = band.start; arrivalEnd = band.end;
      arrivalEndDate = visitDate ? addCalendarDays(visitDate, band.crossesMidnight ? 1 : 0) : null;
    }
    if (before) {
      arrivalEnd = hour24(before[1], before[2], before[3] ?? explicitPeriod(arrivalText)); arrivalEndDate = arrivalEnd ? visitDate : null;
      if (!arrivalEnd) ambiguities.push({ field: "arrivalEnd", code: "TIME_INVALID", question: "No reconocimos la hora límite. Indica una hora válida." });
      if (!arrivalStart) ambiguities.push({ field: "arrivalStart", code: "ARRIVAL_START_MISSING", question: "¿Desde qué hora puede llegar, o será durante todo el día?" });
    }
  }
  if (!arrivalWindowMode && spokenTimePattern.test(arrivalText)) {
    ambiguities.push({ field: "arrivalStart", code: "TIME_UNRESOLVED", question: "Mencionaste una hora, pero no pudimos interpretarla. Indícala nuevamente." });
  }

  let plannedExitDate: string | null = null; let plannedExitTime: string | null = null;
  const exit = new RegExp(`(?:salir|salida|salgan|debería salir|deberian salir|deberían salir).{0,20}?(?:como a|tipo|alrededor de|a)?\\s*(?:(?:la|las)\\s+)?(${HOUR_PATTERN})(?:[:.](\\d{2}))?\\s*(?:(?:de|en|por) la\\s+)?(mañana|tarde|noche|madrugada)?`).exec(plannedExitText);
  if (exit && visitDate) {
    const period = exit[3] ?? explicitPeriod(plannedExitText); plannedExitTime = hour24(exit[1], exit[2], period);
    if (!period && arrivalStart && plannedExitTime && plannedExitTime <= arrivalStart && (HOUR_WORDS[exit[1]] ?? Number(exit[1])) <= 6) plannedExitTime = hour24(exit[1], exit[2], "tarde");
    if (plannedExitTime) plannedExitDate = plannedExitTime <= (arrivalStart ?? "00:00") ? addCalendarDays(visitDate, 1) : visitDate;
    else ambiguities.push({ field: "plannedExitTime", code: "TIME_INVALID", question: "No reconocimos la salida prevista. Indica una hora válida." });
  }
  return { visitDate, arrivalWindowMode, arrivalStart, arrivalEndDate, arrivalEnd, plannedExitDate, plannedExitTime, ambiguities };
}
