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

  it.each([
    ["Mañana a las once de la mañana viene Dana a mi casa", "2026-08-27", "11:00"],
    ["Mañana a las 11 de la mañana viene Dana a mi casa", "2026-08-27", "11:00"],
    ["Hoy a las once de la mañana viene Dana a mi casa", "2026-08-26", "11:00"],
    ["Hoy a las 11 de la mañana viene Dana a mi casa", "2026-08-26", "11:00"],
  ])("separa fecha y período horario en %s", (phrase, date, start) => {
    expect(parse(phrase)).toMatchObject({ visitDate: date, arrivalWindowMode: "from_time", arrivalStart: start, arrivalEnd: null, arrivalEndDate: null });
  });

  it("mantiene el viernes en la mañana como franja del próximo viernes", () => {
    expect(parse("El viernes en la mañana viene Dana")).toMatchObject({ visitDate: "2026-08-28", arrivalWindowMode: "from_time", arrivalStart: "08:00", arrivalEnd: "12:00" });
  });

  it.each([
    ["una", "01:00"], ["uno", "01:00"], ["dos", "02:00"], ["tres", "03:00"], ["cuatro", "04:00"], ["cinco", "05:00"], ["seis", "06:00"],
    ["siete", "07:00"], ["ocho", "08:00"], ["nueve", "09:00"], ["diez", "10:00"], ["once", "11:00"], ["doce", "00:00"],
  ])("interpreta la hora hablada %s", (word, expected) => {
    expect(parse(`hoy a las ${word} de la mañana`)).toMatchObject({ arrivalWindowMode: "from_time", arrivalStart: expected });
  });

  it.each([
    ["a las dos de la tarde", "14:00"],
    ["a las ocho de la noche", "20:00"],
    ["a la una de la madrugada", "01:00"],
  ])("aplica el período en %s", (phrase, expected) => {
    expect(parse(`mañana ${phrase}`)).toMatchObject({ arrivalWindowMode: "from_time", arrivalStart: expected });
  });

  it("no convierte una expresión horaria desconocida en Todo el día", () => {
    const result = parse("mañana a las trece de la mañana viene Dana");
    expect(result.arrivalWindowMode).toBeNull();
    expect(result.ambiguities).toEqual(expect.arrayContaining([expect.objectContaining({ code: "TIME_UNRESOLVED" })]));
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
