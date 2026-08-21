import { afterEach, describe, expect, it, vi } from "vitest";

import { getEventEffectiveStatus } from "@/lib/domain/event-utils";

describe("getEventEffectiveStatus", () => {
  afterEach(() => vi.useRealTimers());

  it("uses the Caracas wall-clock window independently from the runtime timezone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T13:30:00.000Z"));

    expect(
      getEventEffectiveStatus({
        status: "active",
        event_date: "2026-08-17",
        window_start: "09:00",
        window_end_date: "2026-08-17",
        window_end: "10:00",
      }),
    ).toBe("active");
  });

  it("classifies before and after the inclusive entry window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T13:00:00.000Z"));
    const base = { status: "active" as const, event_date: "2026-08-17", window_end_date: "2026-08-17" };

    expect(getEventEffectiveStatus({ ...base, window_start: "09:01", window_end: "10:00" })).toBe("scheduled");
    expect(getEventEffectiveStatus({ ...base, window_start: "09:00", window_end: "09:00" })).toBe("active");

    vi.setSystemTime(new Date("2026-08-17T14:00:01.000Z"));
    expect(getEventEffectiveStatus({ ...base, window_start: "09:00", window_end: "10:00" })).toBe("expired");
  });
});
