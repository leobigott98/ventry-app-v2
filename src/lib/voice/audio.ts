import "server-only";

import { BufferSource, FLAC, Input, MP3, MP4, OGG, WAVE, WEBM } from "mediabunny";

import { MAX_VOICE_BYTES, MAX_VOICE_SECONDS } from "@/lib/voice/audio-limits";
import { VoiceError, voiceSafeMessages } from "@/lib/voice/errors";

type AudioKind = { extension: string; mimeType: string };

const allowedExtensions = new Set(["webm", "mp4", "mp3", "mpeg", "mpga", "m4a", "wav", "ogg", "flac"]);

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function sniffAudioKind(bytes: Uint8Array): AudioKind | null {
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") return { extension: "wav", mimeType: "audio/wav" };
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return { extension: "webm", mimeType: "audio/webm" };
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") return { extension: "mp4", mimeType: "audio/mp4" };
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "OggS") return { extension: "ogg", mimeType: "audio/ogg" };
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "fLaC") return { extension: "flac", mimeType: "audio/flac" };
  if (bytes.length >= 3 && ascii(bytes, 0, 3) === "ID3") return { extension: "mp3", mimeType: "audio/mpeg" };
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return { extension: "mp3", mimeType: "audio/mpeg" };
  return null;
}

function extensionMatchesKind(extension: string, kind: AudioKind) {
  if (!allowedExtensions.has(extension)) return false;
  if (kind.extension === "mp4") return extension === "mp4" || extension === "m4a";
  if (kind.extension === "mp3") return extension === "mp3" || extension === "mpeg" || extension === "mpga";
  return extension === kind.extension;
}

export async function getAudioDurationSeconds(bytes: Uint8Array) {
  const input = new Input({
    source: new BufferSource(bytes),
    formats: [WEBM, MP4, MP3, WAVE, OGG, FLAC],
  });

  try {
    if (!(await input.canRead())) return null;
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack) return null;

    const duration = await input.computeDuration([audioTrack]);
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  } catch {
    return null;
  } finally {
    input.dispose();
  }
}

export async function validateVoiceAudio(args: { bytes: Uint8Array; fileName: string }) {
  if (args.bytes.length === 0) throw new VoiceError("AUDIO_EMPTY", 400, voiceSafeMessages.AUDIO_EMPTY);
  if (args.bytes.length > MAX_VOICE_BYTES) throw new VoiceError("AUDIO_TOO_LARGE", 413, voiceSafeMessages.AUDIO_TOO_LARGE);

  const kind = sniffAudioKind(args.bytes);
  const extension = args.fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!kind || !extensionMatchesKind(extension, kind)) {
    throw new VoiceError("AUDIO_FORMAT_UNSUPPORTED", 415, voiceSafeMessages.AUDIO_FORMAT_UNSUPPORTED);
  }

  const duration = await getAudioDurationSeconds(args.bytes);
  if (duration == null) throw new VoiceError("AUDIO_FORMAT_UNSUPPORTED", 415, voiceSafeMessages.AUDIO_FORMAT_UNSUPPORTED);
  if (duration > MAX_VOICE_SECONDS) throw new VoiceError("AUDIO_TOO_LONG", 413, voiceSafeMessages.AUDIO_TOO_LONG);

  return { ...kind, duration };
}
