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
import { mixInto, mixTracks, newDuckState, spanAsset } from '../shared/audio/mix';
import { readWavInfo, renderTrack, secondsToSamples, wavSamples } from '../shared/audio/wav';
import {
  SAMPLE_RATE,
  hasSound,
  placeTracks,
  sceneDuration,
  videoOptions,
  videoSpans,
  type Schedule,
} from '../shared/render/clock';
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
 * The sound of a stretch of a video file, in the project's format. A film
 * without sound, or one FFmpeg cannot read, is silence.
 */
export async function videoSound(file: string, from: number, length: number): Promise<Int16Array> {
  const work = mkdtempSync(join(tmpdir(), 'lysark-lyd-'));
  const target = join(work, 'film.pcm');
  try {
    await runFfmpeg([
      '-y',
      '-ss',
      String(Math.max(0, from)),
      '-t',
      String(length),
      '-i',
      file,
      '-vn',
      '-ac',
      '1',
      '-ar',
      String(SAMPLE_RATE),
      '-f',
      's16le',
      target,
    ]).done;
    const bytes = readFileSync(target);
    const samples = new Int16Array(Math.floor(bytes.byteLength / 2));
    new Uint8Array(samples.buffer).set(bytes.subarray(0, samples.length * 2));
    return samples;
  } catch {
    return new Int16Array(0);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Adds to the sound of one slide. `start` is where the slide begins in the lecture, in samples. */
export type SlideMix = (scene: Scene, start: number, part: Int16Array) => Promise<void>;

/**
 * Puts the sound of the films that were played while a slide was read in,
 * into the slide's sound: each film where the lecturer started it.
 */
export function filmSound(dir: string, project: Project): SlideMix {
  return async (scene, _start, part) => {
    for (const span of videoSpans(scene)) {
      const id = spanAsset(scene, span);
      const asset = id ? project.assets[id] : undefined;
      if (asset?.kind !== 'video') continue;
      const sound = await videoSound(mediaPath(dir, asset.file), span.from, span.length);
      const wanted = secondsToSamples(span.length);
      mixInto(part, secondsToSamples(span.at), sound.subarray(0, Math.min(sound.length, wanted)));
    }
  };
}

/** True when the lecture has music or other sound on its own tracks. */
export function hasTracks(project: Pick<Project, 'tracks'>): boolean {
  return !!project.tracks && project.tracks.music.length + project.tracks.sound.length > 0;
}

/**
 * Puts the lecture's own tracks (music, other sound) into the sound of each
 * slide. The music steps back while someone speaks, unless the owner has
 * turned that off. `offset` is where the first slide that is written
 * begins in the whole lecture, in seconds (a video of some of the slides).
 * The slides must come in the order of the lecture.
 */
export function trackSound(
  project: Project,
  samplesOf: (assetId: string) => Int16Array | undefined,
  offset = 0,
): SlideMix {
  const placed = placeTracks(project);
  const duck = videoOptions(project).duckMusic === false ? null : newDuckState();
  const shift = secondsToSamples(offset);
  return async (_scene, start, part) => {
    mixTracks(part, start + shift, placed, samplesOf, duck);
  };
}

/** The sound of one slide, exactly `want` samples long: the voice, and what `mixes` add to it. */
async function slideSound(
  scene: Scene,
  start: number,
  want: number,
  samplesOf: (assetId: string) => Int16Array | undefined,
  mixes: readonly SlideMix[],
): Promise<Int16Array> {
  const track = hasSound(scene) ? renderTrack(scene.audio, samplesOf) : new Int16Array(0);
  const part = new Int16Array(want);
  part.set(track.subarray(0, Math.min(track.length, want)));
  for (const mix of mixes) await mix(scene, start, part);
  return part;
}

/**
 * Writes the sound of the whole lecture to a file of raw samples, slide by
 * slide, each exactly as long as its slide stands, so sound and picture
 * cannot drift apart. Returns the number of samples written.
 */
export async function writeLectureSound(
  file: string,
  scenes: readonly Scene[],
  plan: Schedule,
  samplesOf: (assetId: string) => Int16Array | undefined,
  mixes: readonly SlideMix[] = [],
): Promise<number> {
  const out = openSync(file, 'w');
  let written = 0;
  try {
    for (const entry of plan.entries) {
      const scene = scenes[entry.index]!;
      const end = secondsToSamples(entry.start + entry.duration);
      const want = Math.max(0, end - written);
      const part = await slideSound(scene, written, want, samplesOf, mixes);
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
  const samples = await slideSound(scene, 0, want, samplesOf, []);
  const data = await encodeAac(async (write) => write(samples));
  return { data, seconds: want / SAMPLE_RATE };
}

/**
 * The lecture's own tracks (music, other sound) as one AAC file (M4A) for
 * the exported HTML, from the start of the lecture to where the last clip
 * ends: one file, so that "Spill av" can let the music run on over the
 * change of slide. The music steps back under the voice exactly as in the
 * video (`mixTracks`), but the voice itself is not in the file: it stays in
 * the sound of each slide. Undefined when nothing is heard on the tracks.
 */
export async function encodeLectureTracks(
  project: Project,
  plan: Schedule,
  samplesOf: (assetId: string) => Int16Array | undefined,
): Promise<{ data: Uint8Array; seconds: number } | undefined> {
  const placed = placeTracks(project, plan);
  const end = Math.min(plan.total, Math.max(0, ...placed.map((p) => p.end)));
  if (placed.length === 0 || end <= 0) return undefined;
  const duck = videoOptions(project).duckMusic === false ? null : newDuckState();
  const total = secondsToSamples(end);
  const data = await encodeAac(async (write) => {
    let written = 0;
    for (const entry of plan.entries) {
      if (written >= total) break;
      const to = Math.min(total, secondsToSamples(entry.start + entry.duration));
      const want = Math.max(0, to - written);
      if (want === 0) continue;
      const scene = project.scenes[entry.index]!;
      const voice = new Int16Array(want);
      if (hasSound(scene)) {
        const track = renderTrack(scene.audio, samplesOf);
        voice.set(track.subarray(0, Math.min(track.length, want)));
      }
      const part = new Int16Array(want);
      mixTracks(part, written, placed, samplesOf, duck, voice);
      await write(part);
      written += want;
    }
  });
  return { data, seconds: total / SAMPLE_RATE };
}

/** Encodes raw samples, handed over by `fill` a piece at a time, as one AAC file (M4A). */
async function encodeAac(
  fill: (write: (samples: Int16Array) => Promise<void>) => Promise<void>,
): Promise<Uint8Array> {
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
    const CHUNK = 1 << 20;
    await fill(async (samples) => {
      const bytes = bytesOf(samples);
      for (let offset = 0; offset < bytes.byteLength; offset += CHUNK) {
        await writeTo(run, bytes.subarray(offset, offset + CHUNK));
      }
    });
    run.process.stdin.end();
    await run.done;
    return new Uint8Array(readFileSync(target));
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
  if (compressed.length === 0 && !source.tracks) return { project: source, notes: [] };
  const project = structuredClone(source);
  const notes: string[] = [];
  if (project.tracks) {
    // In an exported file the music and other sound lie in one sound file for
    // the whole lecture, on a clip of its own; files made before that have
    // them in the sound of each slide. What else is left of the tracks is
    // only the names for the list of sources.
    const carried = (clip: { asset: string }): boolean =>
      compressed.some(([id]) => id === clip.asset);
    const sound = project.tracks.sound.filter(carried);
    for (const clip of [...project.tracks.music, ...project.tracks.sound]) {
      if (!carried(clip)) delete project.assets[clip.asset];
    }
    if (sound.length > 0) {
      project.tracks = { music: [], sound };
      notes.push(
        'Musikk og annen lyd fra lydsporene ligger nå som ett klipp under hele forelesningen, på sporet «Lyd», slik de ble hørt i HTML-fila.',
      );
    } else {
      delete project.tracks;
      notes.push(
        'Musikk og annen lyd fra lydsporene ligger nå i lyden på hvert lysark, sammen med stemmen.',
      );
    }
  }
  if (compressed.length === 0) return { project, notes };
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
      for (const clip of project.tracks?.sound ?? []) {
        if (clip.asset === id) clip.to = Math.min(clip.to, stored.seconds);
      }
    } catch {
      lost.add(id);
      delete project.assets[id];
      if (project.tracks) {
        project.tracks.sound = project.tracks.sound.filter((clip) => clip.asset !== id);
        if (project.tracks.sound.length + project.tracks.music.length === 0) {
          delete project.tracks;
        }
      }
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
