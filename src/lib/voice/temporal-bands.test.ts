import { describe, expect, it } from "vitest";

import { interpretVenezuelanTemporal } from "@/lib/voice/temporal-bands";

const parse = (transcript: string) => interpretVenezuelanTemporal({ transcript, referenceLocalDate: "2026-08-26" });

describe("franjas venezolanas deterministas", () => {
  it.each([
    ["mañana en la mañana", "08:00", "12:00", "2026-08-27"],
    ["mañana al mediodía", "11:00", "14:00", "2026-08-27"],
    ["mañana en la tarde", "12:00", "18:00", "2026-08-27"],
    ["mañana primera hora de la mañana", "07:00", "10:00", "2026-08-27"],
  ])("interpreta %s", (phrase, start, end, date) => {
    expect(parse(phrase)).toMatchObject({ visitDate: date, arrivalWindowMode: "from_time", arrivalStart: start, arrivalEnd: end });
  });

  it("cruza noche y madrugada al día siguiente", () => {
    expect(parse("mañana en la noche")).toMatchObject({ arrivalStart: "18:00", arrivalEnd: "00:00", arrivalEndDate: "2026-08-28" });
    expect(parse("mañana en la madrugada")).toMatchObject({ arrivalStart: "23:00", arrivalEnd: "06:00", arrivalEndDate: "2026-08-28" });
  });

  it("distingue desde una hora de un rango", () => {
    expect(parse("mañana desde las 2 de la tarde")).toMatchObject({ arrivalStart: "14:00", arrivalEnd: null });
    expect(parse("mañana a las 2 de la tarde")).toMatchObject({ arrivalStart: "14:00", arrivalEnd: null });
    expect(parse("mañana entre 2 y 5 de la tarde")).toMatchObject({ arrivalStart: "14:00", arrivalEnd: "17:00" });
  });

  it("pide AM/PM para a las 2 sin contexto", () => {
    expect(parse("mañana a las 2:30").ambiguities).toEqual(expect.arrayContaining([expect.objectContaining({
      code: "AM_PM_AMBIGUOUS",
      options: [{ value: "02:30", label: "02:30 de la mañana" }, { value: "14:30", label: "14:30 de la tarde" }],
    })]));
  });

  it("conserva minutos explícitos en horas y rangos", () => {
    expect(parse("mañana desde las 9:15 de la mañana")).toMatchObject({ arrivalStart: "09:15" });
    expect(parse("mañana entre las 9:15 y las 11:45 de la mañana")).toMatchObject({ arrivalStart: "09:15", arrivalEnd: "11:45" });
  });

  it("no permite que una fecha pasada avance sin aclaración", () => {
    expect(parse("2026-08-25 en la tarde")).toMatchObject({
      visitDate: null,
      ambiguities: [expect.objectContaining({ code: "PAST_DATE" })],
    });
  });

  it("separa salida prevista de la ventana de llegada", () => {
    expect(parse("mañana desde las 10, debería salir como a las 4")).toMatchObject({ arrivalStart: "10:00", arrivalEnd: null, plannedExitTime: "16:00" });
  });
});
