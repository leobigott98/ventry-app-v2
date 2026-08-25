import { VoiceError, voiceSafeMessages } from "@/lib/voice/errors";

export const MAX_VOICE_BYTES = 3 * 1024 * 1024;
export const MAX_VOICE_SECONDS = 30;

type AudioKind = { extension: string; mimeType: string };
const allowedExtensions = new Set(["webm", "mp4", "mp3", "mpeg", "mpga", "m4a", "wav", "ogg", "flac"]);

function ascii(bytes: Uint8Array, start: number, length: number) { return String.fromCharCode(...bytes.slice(start, start + length)); }

function containsBytes(bytes: Uint8Array, sequence: readonly number[]) {
  if (!sequence.length || sequence.length > bytes.length) return false;
  outer: for (let index = 0; index <= bytes.length - sequence.length; index += 1) {
    for (let item = 0; item < sequence.length; item += 1) if (bytes[index + item] !== sequence[item]) continue outer;
    return true;
  }
  return false;
}

function containsAscii(bytes: Uint8Array, value: string) {
  return containsBytes(bytes, Array.from(value, (character) => character.charCodeAt(0)));
}

function hasAudioTrack(bytes: Uint8Array, kind: AudioKind) {
  if (kind.extension === "wav") {
    for (let offset = 12; offset + 10 <= bytes.length;) {
      const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true);
      if (ascii(bytes, offset, 4) === "fmt ") {
        const format = new DataView(bytes.buffer, bytes.byteOffset + offset + 8, 2).getUint16(0, true);
        return [1, 3, 0xfffe].includes(format);
      }
      offset += 8 + size + (size % 2);
    }
    return false;
  }
  if (kind.extension === "webm") return containsAscii(bytes, "A_OPUS") || containsAscii(bytes, "A_VORBIS") || containsAscii(bytes, "A_AAC") || containsBytes(bytes, [0x83, 0x81, 0x02]);
  if (kind.extension === "mp4") return containsAscii(bytes, "soun");
  if (kind.extension === "ogg") return containsAscii(bytes, "OpusHead") || containsAscii(bytes, "\u0001vorbis");
  return true;
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

function wavDuration(bytes: Uint8Array) {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const byteRate = view.getUint32(28, true);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const size = view.getUint32(offset + 4, true);
    if (ascii(bytes, offset, 4) === "data" && byteRate > 0) return size / byteRate;
    offset += 8 + size + (size % 2);
  }
  return null;
}

function mp4Duration(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 0; offset + 24 <= bytes.length;) {
    const size = view.getUint32(offset, false);
    const type = ascii(bytes, offset + 4, 4);
    if (type === "mvhd") {
      const version = bytes[offset + 8];
      const base = offset + (version === 1 ? 28 : 20);
      if (base + (version === 1 ? 12 : 8) > bytes.length) return null;
      const scale = view.getUint32(base, false);
      const duration = version === 1 ? Number(view.getBigUint64(base + 4, false)) : view.getUint32(base + 4, false);
      return scale > 0 ? duration / scale : null;
    }
    if (size < 8) break;
    if (["moov", "trak", "mdia"].includes(type)) { offset += 8; continue; }
    offset += size;
  }
  return null;
}

function webmDuration(bytes: Uint8Array) {
  const durationMarker = [0x44, 0x89];
  let timecodeScale = 1_000_000;
  let clusterTimecode = 0; let lastBlockTimecode = 0;
  const vint = (offset: number) => {
    const first = bytes[offset]; if (!first) return null;
    let length = 1; while (length <= 8 && (first & (0x80 >> (length - 1))) === 0) length += 1;
    if (length > 8 || offset + length > bytes.length) return null;
    let value = first & (0xff >> length); for (let item = 1; item < length; item += 1) value = value * 256 + bytes[offset + item];
    return { length, value };
  };
  for (let index = 0; index < bytes.length - 12; index += 1) {
    if (bytes[index] === 0x2a && bytes[index + 1] === 0xd7 && bytes[index + 2] === 0xb1) {
      const size = bytes[index + 3] & 0x7f;
      if (size > 0 && size <= 4) { timecodeScale = 0; for (let item = 0; item < size; item += 1) timecodeScale = timecodeScale * 256 + bytes[index + 4 + item]; }
    }
    if (bytes[index] === durationMarker[0] && bytes[index + 1] === durationMarker[1]) {
      const size = bytes[index + 2] & 0x7f;
      const view = new DataView(bytes.buffer, bytes.byteOffset + index + 3, size);
      const value = size === 4 ? view.getFloat32(0, false) : size === 8 ? view.getFloat64(0, false) : NaN;
      if (Number.isFinite(value)) return value * timecodeScale / 1_000_000_000;
    }
    if (bytes[index] === 0xe7) {
      const size = vint(index + 1); if (size && size.value > 0 && size.value <= 8) {
        clusterTimecode = 0; const start = index + 1 + size.length; for (let item = 0; item < size.value; item += 1) clusterTimecode = clusterTimecode * 256 + bytes[start + item];
      }
    }
    if (bytes[index] === 0xa3) {
      const size = vint(index + 1); const start = size ? index + 1 + size.length : 0; const track = start ? vint(start) : null;
      if (track && start + track.length + 2 <= bytes.length) {
        const relative = new DataView(bytes.buffer, bytes.byteOffset + start + track.length, 2).getInt16(0, false);
        lastBlockTimecode = Math.max(lastBlockTimecode, clusterTimecode + relative);
      }
    }
  }
  return lastBlockTimecode > 0 ? lastBlockTimecode * timecodeScale / 1_000_000_000 : null;
}

function oggDuration(bytes: Uint8Array) {
  let lastGranule: bigint | null = null;
  for (let index = 0; index + 14 <= bytes.length; index += 1) if (ascii(bytes, index, 4) === "OggS") lastGranule = new DataView(bytes.buffer, bytes.byteOffset + index + 6, 8).getBigUint64(0, true);
  if (lastGranule == null) return null;
  const content = ascii(bytes, 0, Math.min(bytes.length, 256));
  let sampleRate = 48_000;
  const vorbis = content.indexOf("\u0001vorbis");
  if (vorbis >= 0 && vorbis + 16 <= bytes.length) sampleRate = new DataView(bytes.buffer, bytes.byteOffset + vorbis + 12, 4).getUint32(0, true);
  return sampleRate > 0 ? Number(lastGranule) / sampleRate : null;
}

function flacDuration(bytes: Uint8Array) {
  if (bytes.length < 26 || (bytes[4] & 0x7f) !== 0 || ((bytes[5] << 16) | (bytes[6] << 8) | bytes[7]) < 18) return null;
  const packed = new DataView(bytes.buffer, bytes.byteOffset + 18, 8).getBigUint64(0, false);
  const sampleRate = Number(packed >> BigInt(44)) & 0xfffff; const totalSamples = Number(packed & BigInt("0xfffffffff"));
  return sampleRate > 0 ? totalSamples / sampleRate : null;
}

function mp3Duration(bytes: Uint8Array) {
  const bitrateV1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const bitrateV2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const rates = [44_100, 48_000, 32_000]; let offset = 0; let seconds = 0; let frames = 0;
  if (ascii(bytes, 0, 3) === "ID3" && bytes.length >= 10) offset = 10 + ((bytes[6] & 0x7f) << 21) + ((bytes[7] & 0x7f) << 14) + ((bytes[8] & 0x7f) << 7) + (bytes[9] & 0x7f);
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff || (bytes[offset + 1] & 0xe0) !== 0xe0) { offset += 1; continue; }
    const version = (bytes[offset + 1] >> 3) & 3; const layer = (bytes[offset + 1] >> 1) & 3; const bitrateIndex = (bytes[offset + 2] >> 4) & 15; const rateIndex = (bytes[offset + 2] >> 2) & 3;
    if (layer !== 1 || version === 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) { offset += 1; continue; }
    const sampleRate = rates[rateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4); const bitrate = (version === 3 ? bitrateV1 : bitrateV2)[bitrateIndex] * 1000; const samples = version === 3 ? 1152 : 576;
    const frameLength = Math.floor((version === 3 ? 144 : 72) * bitrate / sampleRate) + ((bytes[offset + 2] >> 1) & 1);
    if (frameLength <= 4 || offset + frameLength > bytes.length) break;
    seconds += samples / sampleRate; frames += 1; offset += frameLength;
  }
  return frames > 0 ? seconds : null;
}

export function getAudioDurationSeconds(bytes: Uint8Array, kind: AudioKind) {
  if (kind.extension === "wav") return wavDuration(bytes);
  if (kind.extension === "mp4") return mp4Duration(bytes);
  if (kind.extension === "webm") return webmDuration(bytes);
  if (kind.extension === "ogg") return oggDuration(bytes);
  if (kind.extension === "flac") return flacDuration(bytes);
  if (kind.extension === "mp3") return mp3Duration(bytes);
  return null;
}

export function validateVoiceAudio(args: { bytes: Uint8Array; fileName: string }) {
  if (args.bytes.length === 0) throw new VoiceError("AUDIO_EMPTY", 400, voiceSafeMessages.AUDIO_EMPTY);
  if (args.bytes.length > MAX_VOICE_BYTES) throw new VoiceError("AUDIO_TOO_LARGE", 413, voiceSafeMessages.AUDIO_TOO_LARGE);
  const kind = sniffAudioKind(args.bytes);
  const extension = args.fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!kind || !allowedExtensions.has(extension) || (kind.extension === "mp4" ? !["mp4", "m4a"].includes(extension) : kind.extension !== extension && !(kind.extension === "mp3" && ["mpeg", "mpga"].includes(extension)))) {
    throw new VoiceError("AUDIO_FORMAT_UNSUPPORTED", 415, voiceSafeMessages.AUDIO_FORMAT_UNSUPPORTED);
  }
  if (!hasAudioTrack(args.bytes, kind)) throw new VoiceError("AUDIO_FORMAT_UNSUPPORTED", 415, voiceSafeMessages.AUDIO_FORMAT_UNSUPPORTED);
  const duration = getAudioDurationSeconds(args.bytes, kind);
  if (duration == null || !Number.isFinite(duration) || duration <= 0) throw new VoiceError("AUDIO_FORMAT_UNSUPPORTED", 415, voiceSafeMessages.AUDIO_FORMAT_UNSUPPORTED);
  if (duration != null && duration > MAX_VOICE_SECONDS + 0.5) throw new VoiceError("AUDIO_TOO_LONG", 413, voiceSafeMessages.AUDIO_TOO_LONG);
  return { ...kind, duration };
}
