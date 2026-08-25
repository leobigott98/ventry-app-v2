import { describe, expect, it } from "vitest";

import { MAX_VOICE_BYTES, sniffAudioKind, validateVoiceAudio } from "@/lib/voice/audio";
import { VoiceError } from "@/lib/voice/errors";

function wav(seconds: number, byteRate = 8_000) {
  const dataSize = Math.floor(seconds * byteRate);
  const bytes = new Uint8Array(44 + dataSize); const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("RIFF"), 0); view.setUint32(4, 36 + dataSize, true); bytes.set(new TextEncoder().encode("WAVEfmt "), 8);
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8_000, true); view.setUint32(28, byteRate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  bytes.set(new TextEncoder().encode("data"), 36); view.setUint32(40, dataSize, true); return bytes;
}

function mp4WithoutAudioTrack() {
  const bytes = new Uint8Array(44); const view = new DataView(bytes.buffer); const encoder = new TextEncoder();
  view.setUint32(0, 16, false); bytes.set(encoder.encode("ftyp"), 4); bytes.set(encoder.encode("M4A "), 8);
  view.setUint32(16, 28, false); bytes.set(encoder.encode("mvhd"), 20); bytes[24] = 0; view.setUint32(36, 1_000, false); view.setUint32(40, 1_000, false);
  return bytes;
}

describe("voice audio validation", () => {
  it("detecta firmas WebM/Opus y MP4/AAC sin confiar en MIME", () => {
    expect(sniffAudioKind(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))?.extension).toBe("webm");
    expect(sniffAudioKind(new Uint8Array([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]))?.extension).toBe("mp4");
  });

  it.each([
    [new Uint8Array(), "audio.wav", "AUDIO_EMPTY"],
    [new Uint8Array(MAX_VOICE_BYTES + 1), "audio.wav", "AUDIO_TOO_LARGE"],
    [new Uint8Array([1, 2, 3, 4]), "audio.webm", "AUDIO_FORMAT_UNSUPPORTED"],
    [wav(31), "audio.wav", "AUDIO_TOO_LONG"],
    [wav(2), "audio.mp3", "AUDIO_FORMAT_UNSUPPORTED"],
    [mp4WithoutAudioTrack(), "video.mp4", "AUDIO_FORMAT_UNSUPPORTED"],
  ])("rechaza vacío, tamaño, firma, duración o extensión incompatibles", (bytes, name, code) => {
    try { validateVoiceAudio({ bytes, fileName: name }); throw new Error("expected rejection"); }
    catch (error) { expect(error).toBeInstanceOf(VoiceError); expect((error as VoiceError).code).toBe(code); }
  });

  it("acepta WAV válido y calcula duración autoritativa", () => expect(validateVoiceAudio({ bytes: wav(30), fileName: "audio.wav" }).duration).toBe(30));
});
