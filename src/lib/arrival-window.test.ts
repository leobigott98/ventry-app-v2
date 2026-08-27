import { describe, expect, it } from "vitest";

import { getArrivalBounds, getArrivalEffectiveStatus } from "@/lib/arrival-window";

const allDay = { status: "active" as const, arrivalWindowMode: "all_day" as const, visitDate: "2026-08-28", arrivalStart: null, arrivalEndDate: null, arrivalEnd: null, plannedExitDate: null, plannedExitTime: null };

describe("arrival windows", () => {
  it("deriva inicio y fin del día en la zona IANA sin sumar 24 horas", () => {
    const caracas = getArrivalBounds(allDay, "America/Caracas");
    expect(caracas.start.toISOString()).toBe("2026-08-28T04:00:00.000Z");
    expect(caracas.end.toISOString()).toBe("2026-08-29T03:59:59.999Z");
    const kiritimati = getArrivalBounds(allDay, "Pacific/Kiritimati");
    expect(kiritimati.start.toISOString()).toBe("2026-08-27T10:00:00.000Z");
  });

  it("todo el día nunca queda activo indefinidamente", () => {
    expect(getArrivalEffectiveStatus(allDay, "America/Caracas", new Date("2026-08-28T12:00:00Z"))).toBe("active");
    expect(getArrivalEffectiveStatus(allDay, "America/Caracas", new Date("2026-08-29T04:00:00Z"))).toBe("expired");
  });

  it("desde una hora sin límite expira al terminar el mismo día", () => {
    const window = { ...allDay, arrivalWindowMode: "from_time" as const, arrivalStart: "14:00" };
    expect(getArrivalEffectiveStatus(window, "America/Caracas", new Date("2026-08-28T17:59:00Z"))).toBe("scheduled");
    expect(getArrivalEffectiveStatus(window, "America/Caracas", new Date("2026-08-28T18:00:00Z"))).toBe("active");
    expect(getArrivalEffectiveStatus(window, "America/Caracas", new Date("2026-08-29T04:00:00Z"))).toBe("expired");
  });

  it("salida prevista no modifica la vigencia", () => {
    const window = { ...allDay, plannedExitDate: "2026-08-28", plannedExitTime: "16:00" };
    expect(getArrivalEffectiveStatus(window, "America/Caracas", new Date("2026-08-28T22:00:00Z"))).toBe("active");
  });

  it("used y revoked prevalecen sobre las fechas", () => {
    const beforeVisit = new Date("2026-08-27T12:00:00Z");
    expect(getArrivalEffectiveStatus({ ...allDay, status: "used" }, "America/Caracas", beforeVisit)).toBe("used");
    expect(getArrivalEffectiveStatus({ ...allDay, status: "revoked" }, "America/Caracas", beforeVisit)).toBe("revoked");
  });
});
