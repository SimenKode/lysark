// Sound in the main process: storing recordings, bringing in sound files,
// and putting a lecture's sound together for export. All sound in a project
// is mono WAV at 48 kHz with 16-bit samples (see shared/audio/wav.ts).
import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { newId } from '../shared/format/factory';
import type { Asset, Project, Scene } from '../shared/format/schema';
import { readWavInfo, renderTrack, secondsToSamples, wavSamples } from '../shared/audio/wav';
import { SAMPLE_RATE, hasSound, sceneDuration, type Schedule } from '../shared/render/clock';
import { ffmpegPath, runFfmpeg, writeTo } from './ffmpeg';
import { mediaPath } from './projectIo';

export interface AddedSound {
  id: string;
  asset: Asset;
  seconds: number;
}

/** Sound files the owner can bring in; FFmpeg turns them into the project's format. */
export const SOUND_EXTENSIONS = ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'webm', 'wma'];

const MAX_RECORDING_BYTES = 2 * 1024 * 1024 * 1024 - 1;

function storeWav(dir: string, data: Uint8Array, name: string): AddedSound {
  const info = readWavInfo(data);
  if (info.channels !== 1 || info.bitsPerSample !== 16 || info.sampleRate !== SAMPLE_RATE) {
    throw new Error('Lyden må være mono, 48 kHz og 16 bit.');
  }
  if (!(info.seconds > 0)) throw new Error('Opptaket er tomt.');
  const hash = createHash('sha256').update(data).digest('hex').slice(0, 16);
  const file = `media/${hash}.wav`;
  mkdirSync(join(dir, 'media'), { recursive: true });
  const target = mediaPath(dir, file);
  if (!existsSync(target)) writeFileSync(target, data);
  return {
    id: newId('a'),
    asset: { kind: 'audio', file, mime: 'audio/wav', bytes: data.byteLength, name },
    seconds: info.seconds,
  };
}

/** Stores a recording made in the program. The bytes are a WAV file in the project's format. */
export function addRecording(dir: string, data: Uint8Array, name: string): AddedSound {
  if (!(data instanceof Uint8Array) || data.byteLength > MAX_RECORDING_BYTES) {
    throw new Error('Opptaket kan ikke lagres.');
  }
  return storeWav(dir, data, name.replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 80) || 'Opptak');
}

/** Brings a sound file into the project, converted to the project's format by FFmpeg. */
export async function importSound(dir: string, source: string): Promise<AddedSound> {
  const work = mkdtempSync(join(tmpdir(), 'lysark-lyd-'));
  const converted = join(work, 'lyd.wav');
  try {
    await runFfmpeg([
      '-y',
      '-i',
      source,
      '-vn',
      '-ac',
      '1',
      '-ar',
      String(SAMPLE_RATE),
      '-c:a',
      'pcm_s16le',
      '-f',
      'wav',
      // No tags or other extras: the file should hold the sound and nothing else.
      '-map_metadata',
      '-1',
      '-bitexact',
      converted,
    ]).done;
    return storeWav(dir, new Uint8Array(readFileSync(converted)), basename(source));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Lydfila kunne ikke leses. ${reason}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Reads the samples of the project's recordings, keeping only the latest few in memory. */
export function sampleReader(
  dir: string,
  project: Project,
): (assetId: string) => Int16Array | undefined {
  const cache = new Map<string, Int16Array | undefined>();
  return (assetId) => {
    if (cache.has(assetId)) return cache.get(assetId);
    const asset = project.assets[assetId];
    let samples: Int16Array | undefined;
    try {
      if (asset?.kind === 'audio') {
        samples = wavSamples(new Uint8Array(readFileSync(mediaPath(dir, asset.file))));
      }
    } catch {
      samples = undefined; // a missing or unreadable recording is silence
    }
    if (cache.size >= 4) cache.delete(cache.keys().next().value!);
    cache.set(assetId, samples);
    return samples;
  };
}

function bytesOf(samples: Int16Array): Uint8Array {
  // The machines Lysark runs on are little-endian, as the files are.
  return new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
}

/**
 * Writes the sound of the whole lecture to a file of raw samples, slide by
 * slide, each exactly as long as its slide stands, so sound and picture
 * cannot drift apart. Returns the number of samples written.
 */
export function writeLectureSound(
  file: string,
  scenes: readonly Scene[],
  plan: Schedule,
  samplesOf: (assetId: string) => Int16Array | undefined,
): number {
  const out = openSync(file, 'w');
  let written = 0;
  try {
    for (const entry of plan.entries) {
      const scene = scenes[entry.index]!;
      const end = secondsToSamples(entry.start + entry.duration);
      const want = Math.max(0, end - written);
      const track = hasSound(scene) ? renderTrack(scene.audio, samplesOf) : new Int16Array(0);
      const part = new Int16Array(want);
      part.set(track.subarray(0, Math.min(track.length, want)));
      writeSync(out, bytesOf(part));
      written += want;
    }
  } finally {
    closeSync(out);
  }
  return written;
}

/** The sound of one slide as an AAC file (M4A), for the exported HTML. */
export async function encodeSceneSound(
  scene: Scene,
  samplesOf: (assetId: string) => Int16Array | undefined,
): Promise<{ data: Uint8Array; seconds: number }> {
  const want = secondsToSamples(sceneDuration(scene));
  const track = renderTrack(scene.audio, samplesOf);
  const samples = new Int16Array(want);
  samples.set(track.subarray(0, Math.min(track.length, want)));
  const work = mkdtempSync(join(tmpdir(), 'lysark-lyd-'));
  const target = join(work, 'lyd.m4a');
  try {
    const run = runFfmpeg([
      '-y',
      '-f',
      's16le',
      '-ar',
      String(SAMPLE_RATE),
      '-ac',
      '1',
      '-i',
      'pipe:0',
      '-c:a',
      'aac',
      '-b:a',
      '64k',
      '-movflags',
      '+faststart',
      '-map_metadata',
      '-1',
      target,
    ]);
    const bytes = bytesOf(samples);
    const CHUNK = 1 << 20;
    for (let offset = 0; offset < bytes.byteLength; offset += CHUNK) {
      await writeTo(run, bytes.subarray(offset, offset + CHUNK));
    }
    run.process.stdin.end();
    await run.done;
    return { data: new Uint8Array(readFileSync(target)), seconds: want / SAMPLE_RATE };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/**
 * After an exported HTML file has been opened as a project: its sound is
 * AAC, one file per slide. Each is turned back into the project's format
 * (WAV), so the sound can be edited and exported again like any other.
 * Without FFmpeg that cannot be done; the slides then lose their sound,
 * and a note says so.
 */
export async function restoreSound(
  dir: string,
  source: Project,
): Promise<{ project: Project; notes: string[] }> {
  const compressed = Object.entries(source.assets).filter(
    ([, asset]) => asset.kind === 'audio' && !asset.file.endsWith('.wav'),
  );
  if (compressed.length === 0) return { project: source, notes: [] };
  const project = structuredClone(source);
  const notes: string[] = [];
  const lost = new Set<string>();
  for (const [id, asset] of compressed) {
    const file = mediaPath(dir, asset.file);
    try {
      if (!ffmpegPath()) throw new Error('FFmpeg mangler');
      const wav = await decodeToWav(new Uint8Array(readFileSync(file)), extname(asset.file));
      const stored = storeWav(dir, wav, asset.name ?? 'Stemme');
      project.assets[id] = stored.asset;
      for (const scene of project.scenes) {
        for (const clip of scene.audio?.clips ?? []) {
          if (clip.kind !== 'sound' || clip.asset !== id) continue;
          clip.to = Math.min(clip.to, stored.seconds);
          clip.from = Math.min(clip.from, Math.max(0, clip.to - 0.01));
        }
      }
    } catch {
      lost.add(id);
      delete project.assets[id];
    }
    rmSync(file, { force: true });
  }
  if (lost.size > 0) {
    let slides = 0;
    for (const scene of project.scenes) {
      if (!scene.audio?.clips.some((clip) => clip.kind === 'sound' && lost.has(clip.asset))) {
        continue;
      }
      slides += 1;
      delete scene.audio;
      for (const step of scene.timeline) delete step.at;
    }
    notes.push(
      `Lyden på ${slides} lysark kunne ikke gjøres om til prosjektets lydformat og er ikke med` +
        (ffmpegPath() ? '.' : ', fordi FFmpeg mangler.'),
    );
  } else {
    notes.push(
      'Stemmen er med, slik den var da HTML-fila ble laget: klipp og pauser er slått sammen til ett opptak per lysark.',
    );
  }
  return { project, notes };
}

/** Turns a compressed sound file (from an exported HTML file) back into the project's format. */
export async function decodeToWav(data: Uint8Array, extension: string): Promise<Uint8Array> {
  const work = mkdtempSync(join(tmpdir(), 'lysark-lyd-'));
  const source = join(work, `inn${extension}`);
  const target = join(work, 'ut.wav');
  try {
    writeFileSync(source, data);
    await runFfmpeg([
      '-y',
      '-i',
      source,
      '-vn',
      '-ac',
      '1',
      '-ar',
      String(SAMPLE_RATE),
      '-c:a',
      'pcm_s16le',
      '-map_metadata',
      '-1',
      '-bitexact',
      target,
    ]).done;
    return new Uint8Array(readFileSync(target));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
