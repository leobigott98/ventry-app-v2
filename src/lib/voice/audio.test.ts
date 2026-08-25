import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getAudioDurationSeconds, sniffAudioKind, validateVoiceAudio } from "@/lib/voice/audio";
import { MAX_VOICE_BYTES, MAX_VOICE_SECONDS } from "@/lib/voice/audio-limits";

const fixture = (name: string) => new Uint8Array(readFileSync(path.join(process.cwd(), "src", "test", "fixtures", "voice", name)));
const chromiumWebm = () => fixture("chromium-mediarecorder-8s.webm");

function wav(seconds: number, byteRate = 8_000) {
  const dataSize = Math.floor(seconds * byteRate);
  const bytes = new Uint8Array(44 + dataSize); const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("RIFF"), 0); view.setUint32(4, 36 + dataSize, true); bytes.set(new TextEncoder().encode("WAVEfmt "), 8);
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8_000, true); view.setUint32(28, byteRate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  bytes.set(new TextEncoder().encode("data"), 36); view.setUint32(40, dataSize, true); return bytes;
}

function webmLongerThanThirtySeconds() {
  const bytes = chromiumWebm().slice();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The fixture's last SimpleBlock starts at 18,967. Keep the block and Opus
  // payload intact, but move its signed relative timestamp to 32.7 seconds.
  expect(Array.from(bytes.slice(18_967, 18_974))).toEqual([0xa3, 0x41, 0x61, 0x81, 0x0b, 0x40, 0x80]);
  view.setInt16(18_971, 32_700, false);
  return bytes;
}

describe("voice audio validation", () => {
  it("mantiene los límites públicos de 30 segundos y 3 MB", () => {
    expect(MAX_VOICE_SECONDS).toBe(30);
    expect(MAX_VOICE_BYTES).toBe(3 * 1024 * 1024);
  });

  it("detecta firmas WebM/Opus y MP4/AAC sin confiar en MIME", () => {
    expect(sniffAudioKind(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))?.extension).toBe("webm");
    expect(sniffAudioKind(new Uint8Array([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]))?.extension).toBe("mp4");
  });

  it("acepta un WebM/Opus real de Chromium sin campo Duration", async () => {
    const bytes = chromiumWebm();
    const result = await validateVoiceAudio({ bytes, fileName: "grabacion.webm" });
    expect(result).toMatchObject({ extension: "webm", mimeType: "audio/webm" });
    expect(result.duration).toBeCloseTo(8.464, 3);
    expect(result.duration).toBeLessThan(MAX_VOICE_SECONDS);
  });

  it("no confunde bytes E7 o A3 del payload Opus con elementos EBML", async () => {
    const bytes = chromiumWebm();
    expect(bytes.filter((byte) => byte === 0xe7).length).toBeGreaterThan(1);
    expect(bytes.filter((byte) => byte === 0xa3).length).toBeGreaterThan(49);
    await expect(getAudioDurationSeconds(bytes)).resolves.toBeCloseTo(8.464, 3);
  });

  it("continúa rechazando un WebM real cuya línea de tiempo supera 30 segundos", async () => {
    const bytes = webmLongerThanThirtySeconds();
    await expect(getAudioDurationSeconds(bytes)).resolves.toBeCloseTo(32.732, 3);
    await expect(validateVoiceAudio({ bytes, fileName: "grabacion.webm" })).rejects.toMatchObject({ code: "AUDIO_TOO_LONG", status: 413 });
  });

  it.each([
    [new Uint8Array(), "audio.wav", "AUDIO_EMPTY"],
    [new Uint8Array(MAX_VOICE_BYTES + 1), "audio.wav", "AUDIO_TOO_LARGE"],
    [new Uint8Array([1, 2, 3, 4]), "audio.webm", "AUDIO_FORMAT_UNSUPPORTED"],
    [wav(31), "audio.wav", "AUDIO_TOO_LONG"],
    [wav(2), "audio.mp3", "AUDIO_FORMAT_UNSUPPORTED"],
    [chromiumWebm().slice(0, 180), "audio.webm", "AUDIO_FORMAT_UNSUPPORTED"],
    [fixture("webm-video-only.webm"), "video.webm", "AUDIO_FORMAT_UNSUPPORTED"],
  ])("rechaza vacío, tamaño, firma, duración, truncado, falta de audio o extensión incompatible", async (bytes, name, code) => {
    await expect(validateVoiceAudio({ bytes, fileName: name })).rejects.toMatchObject({ code });
  });

  it("acepta WAV válido en el límite y calcula duración autoritativa", async () => {
    await expect(validateVoiceAudio({ bytes: wav(30), fileName: "audio.wav" })).resolves.toMatchObject({ duration: 30 });
  });

  it("acepta un M4A/AAC sintético válido", async () => {
    const result = await validateVoiceAudio({ bytes: fixture("aac-tone-1s.m4a"), fileName: "nota.m4a" });
    expect(result).toMatchObject({ extension: "mp4", mimeType: "audio/mp4" });
    expect(result.duration).toBeCloseTo(1, 3);
  });
});
