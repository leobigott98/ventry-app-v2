import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getInvitationEffectiveStatus,
  getInvitationWindowLabel,
} from "@/lib/domain/invitation-utils";

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
    ).toBe("2026-08-17 09:00 - 11:00");
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
    ).toBe("2026-08-17 22:00 - 2026-08-18 06:00");
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
    ).toBe("Desde 2026-08-17 09:00, sin limite");
  });
});
