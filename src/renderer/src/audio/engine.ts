// Sound in the editor: reading the project's recordings, drawing them and
// playing a slide's track. The track is put together by the same code that
// puts it together for export, so what is heard here is what comes out.
import { mediaUrl } from '../../../shared/api';
import { renderTrack, wavSamples } from '../../../shared/audio/wav';
import type { Project, Scene } from '../../../shared/format/schema';
import { SAMPLE_RATE } from '../../../shared/render/clock';

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
