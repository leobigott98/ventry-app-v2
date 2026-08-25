import type { VoiceTranscriptionResponse } from "@/lib/voice/types";

export type VoicePhase = "idle" | "requesting-permission" | "recording" | "uploading" | "transcribing" | "needs-clarification" | "confirm" | "creating" | "error";
export type VoiceMachineState = { phase: VoicePhase; result: VoiceTranscriptionResponse | null; errorCode: string | null; errorMessage: string | null; retryable: boolean };
export type VoiceMachineEvent =
  | { type: "REQUEST_PERMISSION" } | { type: "SUBMIT_TEXT" } | { type: "RECORDING_STARTED" } | { type: "STOPPED" } | { type: "UPLOADED" }
  | { type: "RESULT"; result: VoiceTranscriptionResponse } | { type: "READY" } | { type: "CREATE" }
  | { type: "ERROR"; code?: string; message: string; retryable?: boolean } | { type: "RESET" } | { type: "CANCEL" };

export const initialVoiceMachineState: VoiceMachineState = { phase: "idle", result: null, errorCode: null, errorMessage: null, retryable: false };

export function voiceMachineReducer(state: VoiceMachineState, event: VoiceMachineEvent): VoiceMachineState {
  switch (event.type) {
    case "REQUEST_PERMISSION": return state.phase === "idle" || state.phase === "error" ? { ...initialVoiceMachineState, phase: "requesting-permission" } : state;
    case "SUBMIT_TEXT": return ["idle", "error", "needs-clarification", "confirm"].includes(state.phase) ? { ...state, phase: "uploading", errorCode: null, errorMessage: null } : state;
    case "RECORDING_STARTED": return state.phase === "requesting-permission" ? { ...state, phase: "recording" } : state;
    case "STOPPED": return state.phase === "recording" ? { ...state, phase: "uploading" } : state;
    case "UPLOADED": return state.phase === "uploading" ? { ...state, phase: "transcribing" } : state;
    case "RESULT": return ["uploading", "transcribing"].includes(state.phase) ? { ...state, result: event.result, phase: event.result.ambiguities.length || event.result.missingFields.length ? "needs-clarification" : "confirm" } : state;
    case "READY": return state.result && ["needs-clarification", "confirm", "creating"].includes(state.phase) ? { ...state, phase: "confirm" } : state;
    case "CREATE": return state.phase === "confirm" ? { ...state, phase: "creating" } : state;
    case "ERROR": return { ...state, phase: "error", errorCode: event.code ?? null, errorMessage: event.message, retryable: event.retryable ?? true };
    case "RESET": case "CANCEL": return initialVoiceMachineState;
    default: return state;
  }
}
