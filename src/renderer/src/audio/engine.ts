// Sound in the editor: reading the project's recordings, drawing them and
// playing a slide's track. The track is put together by the same code that
// puts it together for export, so what is heard here is what comes out.
import { mediaUrl } from '../../../shared/api';
import { mixTracks, newDuckState } from '../../../shared/audio/mix';
import { renderTrack, secondsToSamples, wavSamples } from '../../../shared/audio/wav';
import type { Project, Scene } from '../../../shared/format/schema';
import {
  SAMPLE_RATE,
  hasSound,
  placeTracks,
  schedule,
  videoOptions,
  type PlacedClip,
} from '../../../shared/render/clock';

const samples = new Map<string, Int16Array>();
const loading = new Map<string, Promise<Int16Array | undefined>>();
const MAX_KEPT = 12;

/** The samples of a recording that has been read already. */
export function cachedSamples(file: string): Int16Array | undefined {
  return samples.get(file);
}

/** Puts a recording that was just made into the cache, so it need not be read back. */
export function rememberSamples(file: string, data: Int16Array): void {
  if (samples.size >= MAX_KEPT) samples.delete(samples.keys().next().value!);
  samples.set(file, data);
}

/** Reads a recording from the project folder. */
export function loadSamples(file: string): Promise<Int16Array | undefined> {
  const known = samples.get(file);
  if (known) return Promise.resolve(known);
  let pending = loading.get(file);
  if (!pending) {
    pending = fetch(mediaUrl(file))
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject()))
      .then((buffer) => {
        const data = wavSamples(new Uint8Array(buffer));
        rememberSamples(file, data);
        return data;
      })
      .catch(() => undefined)
      .finally(() => loading.delete(file));
    loading.set(file, pending);
  }
  return pending;
}

/** Reads every recording a slide's track uses. */
export async function loadSceneSamples(project: Project, scene: Scene): Promise<void> {
  const files = new Set<string>();
  for (const clip of scene.audio?.clips ?? []) {
    const file = clip.kind === 'sound' ? project.assets[clip.asset]?.file : undefined;
    if (file) files.add(file);
  }
  await Promise.all([...files].map(loadSamples));
}

export function samplesOf(project: Project): (assetId: string) => Int16Array | undefined {
  return (assetId) => {
    const file = project.assets[assetId]?.file;
    return file ? samples.get(file) : undefined;
  };
}

let context: AudioContext | null = null;

export function audioContext(): AudioContext {
  if (!context) context = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: 'interactive' });
  return context;
}

export interface Playback {
  /** Seconds into the slide's track right now. */
  position(): number;
  stop(): void;
  /** Resolves with true when the track played to its end, false when it was stopped. */
  ended: Promise<boolean>;
}

/** Plays a slide's track from `from` seconds in. The recordings must have been read. */
export async function playScene(project: Project, scene: Scene, from: number): Promise<Playback> {
  const ctx = audioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const track = renderTrack(scene.audio, samplesOf(project));
  const buffer = ctx.createBuffer(1, Math.max(1, track.length), SAMPLE_RATE);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < track.length; i++) channel[i] = track[i]! / 32768;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  const offset = Math.max(0, Math.min(buffer.duration, from));
  const startedAt = ctx.currentTime;
  let stopped = false;
  const ended = new Promise<boolean>((resolve) => {
    source.onended = () => resolve(!stopped);
  });
  source.start(0, offset);
  return {
    position: () => Math.min(buffer.duration, offset + (ctx.currentTime - startedAt)),
    stop: () => {
      if (stopped) return;
      stopped = true;
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    },
    ended,
  };
}

/** Playing the whole lecture: the voice of each slide with the lecture's tracks under it. */
export interface LecturePlayback {
  /** Seconds into the lecture right now. */
  position(): number;
  stop(): void;
  /** Resolves with true when the lecture played to its end, false when it was stopped. */
  ended: Promise<boolean>;
}

/** Reads what one slide of the lecture needs: its recordings, and the track clips that lie under it. */
async function loadSlideSamples(
  project: Project,
  scene: Scene,
  placed: readonly PlacedClip[],
  start: number,
  end: number,
): Promise<void> {
  const files = new Set<string>();
  for (const { clip, start: from, end: to } of placed) {
    const file = to > start && from < end ? project.assets[clip.asset]?.file : undefined;
    if (file) files.add(file);
  }
  await Promise.all([loadSceneSamples(project, scene), ...[...files].map(loadSamples)]);
}

/**
 * Plays the lecture from `from` seconds in: slide after slide, each put
 * together by the same code as the export (voice, then music and other
 * sound, the music lowered under the voice). The sound of films on the
 * slides is not played here; it is in the video and in the HTML file.
 */
export async function playLecture(project: Project, from: number): Promise<LecturePlayback> {
  const ctx = audioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const plan = schedule(project.scenes);
  const placed = placeTracks(project, plan);
  const duck = videoOptions(project).duckMusic === false ? null : newDuckState();
  const begin = Math.max(0, Math.min(Math.max(0, plan.total - 0.01), from));
  let index = plan.entries.findIndex((e) => begin < e.start + e.duration);
  if (index < 0) index = Math.max(0, plan.entries.length - 1);

  let stopped = false;
  let finish: (toEnd: boolean) => void = () => undefined;
  const ended = new Promise<boolean>((resolve) => {
    finish = resolve;
  });
  const sources = new Set<AudioBufferSourceNode>();
  // The lecture time `anchorLecture` is heard when the sound clock shows `anchorClock`.
  let anchorClock = ctx.currentTime + 0.06;
  let anchorLecture = begin;

  /** The sound of one slide, exactly as long as the slide. */
  const build = async (i: number): Promise<AudioBuffer> => {
    const entry = plan.entries[i]!;
    const scene = project.scenes[i]!;
    await loadSlideSamples(project, scene, placed, entry.start, entry.start + entry.duration);
    const startSample = secondsToSamples(entry.start);
    const length = Math.max(1, secondsToSamples(entry.start + entry.duration) - startSample);
    const part = new Int16Array(length);
    if (hasSound(scene)) {
      const voice = renderTrack(scene.audio, samplesOf(project));
      part.set(voice.subarray(0, Math.min(voice.length, length)));
    }
    mixTracks(part, startSample, placed, samplesOf(project), duck);
    const buffer = ctx.createBuffer(1, length, SAMPLE_RATE);
    const channel = buffer.getChannelData(0);
    for (let n = 0; n < length; n++) channel[n] = part[n]! / 32768;
    return buffer;
  };

  // Slides left out of the video take no time and have no sound here.
  let lastPlayed = plan.entries.length - 1;
  while (lastPlayed > 0 && plan.entries[lastPlayed]!.duration <= 0) lastPlayed -= 1;

  const run = async (): Promise<void> => {
    for (let i = index; i <= lastPlayed && !stopped; i++) {
      const entry = plan.entries[i]!;
      if (entry.duration <= 0 && i < lastPlayed) continue;
      const buffer = await build(i);
      if (stopped) return;
      const offset = i === index ? Math.max(0, begin - entry.start) : 0;
      let when = anchorClock + (entry.start + offset - anchorLecture);
      if (when < ctx.currentTime + 0.01) {
        // Putting the slide together took longer than the time there was: the sound starts
        // a moment late, and the clock is told, so the playhead does not run ahead of it.
        when = ctx.currentTime + 0.03;
        anchorClock = when;
        anchorLecture = entry.start + offset;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      sources.add(source);
      const over = new Promise<void>((resolve) => {
        source.onended = () => {
          sources.delete(source);
          resolve();
        };
      });
      source.start(when, Math.min(offset, buffer.duration));
      // The next slide is put together while this one plays; near its end is early enough.
      const wait = (when + buffer.duration - offset - ctx.currentTime - 1.5) * 1000;
      if (wait > 0 && i < lastPlayed) {
        await Promise.race([over, new Promise((resolve) => setTimeout(resolve, wait))]);
      }
      if (i === lastPlayed) {
        await over;
        if (!stopped) finish(true);
      }
    }
  };
  void run().catch(() => {
    if (!stopped) finish(false);
  });

  return {
    position: () =>
      Math.max(begin, Math.min(plan.total, anchorLecture + (ctx.currentTime - anchorClock))),
    stop: () => {
      if (stopped) return;
      stopped = true;
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          // Already stopped.
        }
      }
      finish(false);
    },
    ended,
  };
}
