import type { ClarificationIssue, ProviderExtraction, VoiceInvitationDraft, VoiceInvitationField } from "@/lib/voice/types";

const missingQuestions: Partial<Record<VoiceInvitationField, string>> = {
  visitorName: "¿A quién quieres invitar?",
  visitDate: "¿Qué día vendrá?",
  windowStart: "¿A qué hora llegará?",
  accessType: "¿Qué tipo de visita es?",
};

function compareWindow(draft: VoiceInvitationDraft) {
  if (draft.noTimeLimit || !draft.visitDate || !draft.windowStart || !draft.windowEnd) return false;
  const endDate = draft.windowEndDate ?? draft.visitDate;
  return `${endDate}T${draft.windowEnd}` <= `${draft.visitDate}T${draft.windowStart}`;
}

export function buildClarifications(extraction: ProviderExtraction, referenceLocalDate?: string) {
  const draft: VoiceInvitationDraft = { ...extraction.draft, contactId: null };
  const missingFields = (Object.entries(missingQuestions) as Array<[VoiceInvitationField, string]>).flatMap(([field]) => {
    if (field === "windowStart" && draft.noTimeLimit) return [];
    return draft[field] == null ? [field] : [];
  });
  const issues: ClarificationIssue[] = missingFields.map((field) => ({ field, code: `MISSING_${field.toUpperCase()}`, question: missingQuestions[field] ?? "Completa este dato." }));
  for (const ambiguity of extraction.ambiguities) {
    if (ambiguity.code === "AM_PM_AMBIGUOUS") {
      const raw = draft.windowStart?.slice(0, 2) ?? "02";
      const hour = Number(raw) % 12 || 12;
      issues.push({ field: ambiguity.field, code: ambiguity.code, question: `¿A las ${hour}:00 a. m. o a las ${hour}:00 p. m.?`, options: [
        { value: `${String(hour % 12).padStart(2, "0")}:00`, label: `${hour}:00 a. m.` },
        { value: `${String((hour % 12) + 12).padStart(2, "0")}:00`, label: `${hour}:00 p. m.` },
      ] });
    } else issues.push({ field: ambiguity.field, code: ambiguity.code, question: ambiguity.detail });
  }
  if (compareWindow(draft) && !issues.some((issue) => issue.code === "END_BEFORE_START")) {
    issues.push({ field: "windowEnd", code: "END_BEFORE_START", question: "La hora final debe ser posterior a la hora de inicio. ¿Hasta qué hora podrá ingresar?" });
  }
  if (referenceLocalDate && draft.visitDate && draft.visitDate < referenceLocalDate && !issues.some((issue) => issue.code === "PAST_DATE")) {
    issues.push({ field: "visitDate", code: "PAST_DATE", question: "La fecha indicada ya pasó. ¿Qué fecha deseas usar?" });
  }
  return { draft, missingFields, ambiguities: issues };
}
