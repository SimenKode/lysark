// Sound as numbers. Every recording in a project is a mono WAV file at
// 48 kHz with 16-bit samples, so that a time in a clip is a sample number
// and nothing needs to be decoded to cut or join. Pure functions.
import type { AudioClip, SceneAudio } from '../format/schema';
import { SAMPLE_RATE } from '../render/clock';

const HEADER_BYTES = 44;

/** Writes samples (-1..1) as a mono 16-bit WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number = SAMPLE_RATE): Uint8Array {
  const bytes = new Uint8Array(HEADER_BYTES + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string): void => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(HEADER_BYTES + i * 2, Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), true);
  }
  return bytes;
}

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  /** Where the samples start in the file, and how many bytes of them there are. */
  dataOffset: number;
  dataBytes: number;
  seconds: number;
}

/** Reads the header of a PCM WAV file. Throws when the file is something else. */
export function readWavInfo(bytes: Uint8Array): WavInfo {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number): string =>
    String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (bytes.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') {
    throw new Error('Lydfila er ikke en WAV-fil.');
  }
  let offset = 12;
  let format: { channels: number; sampleRate: number; bitsPerSample: number } | undefined;
  while (offset + 8 <= bytes.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      if (view.getUint16(body, true) !== 1) throw new Error('Lydfila er ikke ukomprimert WAV.');
      format = {
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === 'data') {
      if (!format) break;
      const dataBytes = Math.min(size, bytes.byteLength - body);
      const frame = (format.bitsPerSample / 8) * format.channels;
      return {
        ...format,
        dataOffset: body,
        dataBytes,
        seconds: dataBytes / frame / format.sampleRate,
      };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('Lydfila mangler lyddata.');
}

/** The samples of a mono 16-bit WAV file, as they lie in the file. */
export function wavSamples(bytes: Uint8Array): Int16Array {
  const info = readWavInfo(bytes);
  if (info.channels !== 1 || info.bitsPerSample !== 16 || info.sampleRate !== SAMPLE_RATE) {
    throw new Error('Lyden i prosjektet skal være mono, 48 kHz og 16 bit.');
  }
  const count = Math.floor(info.dataBytes / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset + info.dataOffset, count * 2);
  const out = new Int16Array(count);
  for (let i = 0; i < count; i++) out[i] = view.getInt16(i * 2, true);
  return out;
}

export function secondsToSamples(seconds: number): number {
  return Math.max(0, Math.round(seconds * SAMPLE_RATE));
}

/** Decibels to a factor on the samples. */
export function gainFactor(decibels: number | undefined): number {
  return decibels ? Math.pow(10, decibels / 20) : 1;
}

/**
 * The sound of a slide as one row of samples: its clips one after the
 * other, pauses as silence, with the slide's loudness change applied.
 * Joins get a few milliseconds of fade so that a cut never clicks.
 */
export function renderTrack(
  audio: SceneAudio | undefined,
  samplesOf: (assetId: string) => Int16Array | undefined,
): Int16Array {
  const parts: Int16Array[] = [];
  const gain = gainFactor(audio?.gain);
  const edge = Math.round(SAMPLE_RATE * 0.004);
  for (const clip of audio?.clips ?? []) {
    parts.push(renderClip(clip, samplesOf, gain, edge));
  }
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Int16Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function renderClip(
  clip: AudioClip,
  samplesOf: (assetId: string) => Int16Array | undefined,
  gain: number,
  edge: number,
): Int16Array {
  if (clip.kind === 'pause') return new Int16Array(secondsToSamples(clip.duration));
  const length = secondsToSamples(clip.to) - secondsToSamples(clip.from);
  const out = new Int16Array(Math.max(0, length));
  const source = samplesOf(clip.asset);
  if (!source) return out; // a missing recording is silence of the same length
  const start = secondsToSamples(clip.from);
  const fade = Math.min(edge, Math.floor(out.length / 2));
  for (let i = 0; i < out.length; i++) {
    let value = (source[start + i] ?? 0) * gain;
    if (i < fade) value *= i / fade;
    else if (i >= out.length - fade) value *= (out.length - 1 - i) / fade;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(value)));
  }
  return out;
}

/**
 * Peaks for drawing a waveform: for each of `buckets` equal stretches of
 * the samples, the largest absolute value (0..1).
 */
export function peaks(samples: Int16Array, buckets: number): Float32Array {
  const out = new Float32Array(Math.max(0, buckets));
  if (samples.length === 0 || buckets <= 0) return out;
  const size = samples.length / buckets;
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(b * size);
    const to = Math.max(from + 1, Math.floor((b + 1) * size));
    let peak = 0;
    // A stride keeps long recordings fast; the eye cannot tell the difference.
    const stride = Math.max(1, Math.floor((to - from) / 64));
    for (let i = from; i < to && i < samples.length; i += stride) {
      const v = Math.abs(samples[i]!);
      if (v > peak) peak = v;
    }
    out[b] = peak / 32768;
  }
  return out;
}
