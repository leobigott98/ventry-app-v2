import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { EventGuestList } from "@/components/events/event-guest-list";
import type { EventGuestCredentialRecord, EventGuestRecord } from "@/lib/domain/types";

function guest(id: string, status: EventGuestRecord["attendance_status"], shared = false): EventGuestRecord {
  return { id, event_id: "event-1", resident_contact_id: null, full_name: `Persona ${id}`, phone: null, notes: null, allows_companions: false, max_companions: 0, credential_shared_at: shared ? "2026-08-21T00:00:00.000Z" : null, attendance_status: status, checked_in_at: null, checked_out_at: null, version: 1, removed_at: null, removed_by: null, removal_reason: null, created_at: "2026-08-21T00:00:00.000Z", updated_at: "2026-08-21T00:00:00.000Z" };
}

function credential(id: string): EventGuestCredentialRecord {
  return { id: `credential-${id}`, event_id: "event-1", event_guest_id: id, credential_type: "qr", credential_value: `value-${id}`, qr_payload: `payload-${id}`, credential_audit_id: `audit-${id}`, share_token: `share-${id}`, revoked_at: null, revocation_reason: null, created_at: "2026-08-21T00:00:00.000Z" };
}

describe("EventGuestList", () => {
  it("reports shared progress and narrows the list to pending guests before sharing", async () => {
    const user = userEvent.setup();
    const pending = guest("pendiente", "pending");
    const inside = guest("dentro", "inside", true);
    render(<EventGuestList eventId="event-1" items={[pending, inside].map((item) => ({ guest: item, credential: credential(item.id), shareText: `Acceso ${item.full_name}`, shareUrl: `/event/guest/${item.id}` }))} />);
    expect(screen.getByText("1 de 2 compartidas")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Compartir pendientes" }));
    expect(screen.getByText("Persona pendiente")).toBeInTheDocument();
    expect(screen.queryByText("Persona dentro")).not.toBeInTheDocument();
  });
});
