import { z } from "zod";

import { eventGuestSchema, type EventGuestInput } from "@/lib/schemas/events";

export const EVENT_DRAFT_TRANSFER_KEY = "ventry:event-draft-guests:v1";

const eventDraftTransferSchema = z.object({
  version: z.literal(1),
  guests: z.array(eventGuestSchema).min(1).max(500),
});

export function serializeEventDraftTransfer(
  visitors: Array<{ fullName: string; phone?: string | null; residentContactId?: string | null; contactStableId?: string | null; contactOrigin?: "history" | "saved" | "both" | null }>,
) {
  return JSON.stringify({
    version: 1,
    guests: visitors.map((visitor) => ({
      fullName: visitor.fullName.trim(),
      phone: visitor.phone?.trim() || null,
      notes: null,
      allowsCompanions: false,
      maxCompanions: 0,
      residentContactId: visitor.residentContactId ?? null,
      contactStableId: visitor.contactStableId ?? null,
      contactOrigin: visitor.contactOrigin ?? null,
    })),
  });
}

export function parseEventDraftTransfer(value: string | null): EventGuestInput[] | null {
  if (!value) return null;

  try {
    const parsed = eventDraftTransferSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data.guests : null;
  } catch {
    return null;
  }
}
