import { describe, expect, it } from "vitest";

import { getTimeZoneNowParts } from "@/lib/formatting";

describe("community time zone formatting", () => {
  it("derives form defaults from the community zone instead of the browser zone", () => {
    const instant = new Date("2026-08-21T02:30:00.000Z");

    expect(getTimeZoneNowParts("America/Caracas", instant)).toEqual({
      date: "2026-08-20",
      time: "22:30",
    });
    expect(getTimeZoneNowParts("Europe/Madrid", instant)).toEqual({
      date: "2026-08-21",
      time: "04:30",
    });
  });
});
