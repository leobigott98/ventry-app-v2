import { describe, expect, it } from "vitest";

import { initialVoiceMachineState, voiceMachineReducer } from "@/lib/voice/machine";
import type { VoiceTranscriptionResponse } from "@/lib/voice/types";

const result = { transcript: "Invita a Pedro", draft: { visitorName: "Pedro", contactId: null, visitDate: "2026-08-24", windowStart: "14:00", windowEndDate: "2026-08-24", windowEnd: "16:00", accessType: "visitor", noTimeLimit: false, notes: null }, missingFields: [], ambiguities: [], contactCandidates: [], timeZone: "America/Caracas", referenceTime: "2026-08-23T12:00:00.000Z", referenceLocalDate: "2026-08-23" } satisfies VoiceTranscriptionResponse;

describe("voice invitation machine", () => {
  it("recorre permiso, grabación, carga, transcripción y confirmación", () => {
    let state = voiceMachineReducer(initialVoiceMachineState, { type: "REQUEST_PERMISSION" });
    state = voiceMachineReducer(state, { type: "RECORDING_STARTED" });
    state = voiceMachineReducer(state, { type: "STOPPED" });
    state = voiceMachineReducer(state, { type: "UPLOADED" });
    state = voiceMachineReducer(state, { type: "RESULT", result });
    expect(state.phase).toBe("confirm");
  });

  it("no acepta respuestas tardías después de cancelar", () => {
    const recording = voiceMachineReducer(voiceMachineReducer(initialVoiceMachineState, { type: "REQUEST_PERMISSION" }), { type: "RECORDING_STARTED" });
    const cancelled = voiceMachineReducer(recording, { type: "CANCEL" });
    expect(voiceMachineReducer(cancelled, { type: "RESULT", result })).toEqual(initialVoiceMachineState);
  });

  it("impide doble inicio y doble creación mediante transiciones inválidas", () => {
    const requesting = voiceMachineReducer(initialVoiceMachineState, { type: "REQUEST_PERMISSION" });
    expect(voiceMachineReducer(requesting, { type: "REQUEST_PERMISSION" })).toEqual(requesting);
    const confirming = { ...requesting, phase: "confirm" as const, result };
    const creating = voiceMachineReducer(confirming, { type: "CREATE" });
    expect(voiceMachineReducer(creating, { type: "CREATE" })).toEqual(creating);
  });
});

