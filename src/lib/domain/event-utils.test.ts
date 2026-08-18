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
});
