import { afterEach, describe, expect, it, vi } from "vitest";

import {
  classifyInvitations,
  getInvitationEffectiveStatus,
  getInvitationWindowLabel,
} from "@/lib/domain/invitation-utils";

describe("classifyInvitations", () => {
  it("mantiene scheduled solo en vigentes y no repite IDs entre colecciones", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T12:00:00.000Z"));
    const invitations = [
      { id: "scheduled", status: "active" as const, visit_date: "2026-08-21", window_start: "09:00", window_end: "10:00" },
      { id: "active", status: "active" as const, visit_date: "2026-08-19", window_start: "07:00", window_end: "18:00" },
      { id: "used", status: "used" as const, visit_date: "2026-08-18", window_start: "09:00", window_end: "10:00" },
      { id: "revoked", status: "revoked" as const, visit_date: "2026-08-18", window_start: "09:00", window_end: "10:00" },
    ];
    const result = classifyInvitations(invitations);
    expect(result.current.map((item) => item.id)).toEqual(["scheduled", "active"]);
    expect(result.history.map((item) => item.id)).toEqual(["used", "revoked"]);
    expect(result.current.map((item) => item.id).filter((id) => result.history.some((item) => item.id === id))).toEqual([]);
    vi.useRealTimers();
  });
});

describe("getInvitationEffectiveStatus", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["revoked", "used"] as const)("preserva el estado %s", (status) => {
    expect(
      getInvitationEffectiveStatus({
        status,
        visit_date: "2026-08-17",
        window_start: "09:00",
        window_end: "10:00",
      }),
    ).toBe(status);
  });

  it("marca como vencida una ventana finalizada", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T12:00:00"));

    expect(
      getInvitationEffectiveStatus({
        status: "active",
        visit_date: "2026-08-17",
        window_start: "09:00",
        window_end: "10:00",
      }),
    ).toBe("expired");
  });

  it("marca como programada una ventana futura y activa una iniciada sin limite", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T12:00:00"));

    expect(
      getInvitationEffectiveStatus({
        status: "active",
        visit_date: "2026-08-18",
        window_start: "09:00",
        window_end: "10:00",
      }),
    ).toBe("scheduled");
    expect(
      getInvitationEffectiveStatus({
        status: "active",
        visit_date: "2020-01-01",
        window_start: "09:00",
        window_end: "10:00",
        no_time_limit: true,
      }),
    ).toBe("active");
  });

  it("interpreta la ventana en America/Caracas aunque el runtime use otra zona", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T13:30:00.000Z"));

    expect(
      getInvitationEffectiveStatus({
        status: "active",
        visit_date: "2026-08-17",
        window_start: "09:00",
        window_end: "10:00",
      }),
    ).toBe("active");
  });
});

describe("getInvitationWindowLabel", () => {
  it("resume ventanas del mismo dia", () => {
    expect(
      getInvitationWindowLabel({
        visit_date: "2026-08-17",
        window_start: "09:00",
        window_end: "11:00",
        window_end_date: null,
        no_time_limit: false,
      }),
    ).toBe("17 ago. 2026, 09:00 – 11:00");
  });

  it("incluye la fecha final en ventanas de varios dias", () => {
    expect(
      getInvitationWindowLabel({
        visit_date: "2026-08-17",
        window_start: "22:00",
        window_end: "06:00",
        window_end_date: "2026-08-18",
        no_time_limit: false,
      }),
    ).toBe("17 ago. 2026, 22:00 – 18 ago. 2026, 06:00");
  });

  it("explica una invitacion sin limite", () => {
    expect(
      getInvitationWindowLabel({
        visit_date: "2026-08-17",
        window_start: "09:00",
        window_end: "",
        window_end_date: null,
        no_time_limit: true,
      }),
    ).toBe("Desde 17 ago. 2026 a las 09:00, sin límite");
  });
});
