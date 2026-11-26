// Putting sound on top of sound: a film that plays while the lecturer
// speaks, music under the voice. All of it is mono, 48 kHz, 16 bit.
import type { Scene, VideoSource } from '../format/schema';
import { SAMPLE_RATE, type PlacedClip, type VideoSpan } from '../render/clock';
import { gainFactor } from './wav';

/** Sound that is put in comes in from, and goes out to, silence over this long, so it never clicks. */
const EDGE_SAMPLES = Math.round(SAMPLE_RATE * 0.004);

function clip16(value: number): number {
  return value > 32767 ? 32767 : value < -32768 ? -32768 : Math.round(value);
}

/**
 * Adds `source` to `target`, starting at sample `at` of the target. What
 * falls outside the target is left out. `gain` is a factor (1 is as it is).
 */
export function mixInto(target: Int16Array, at: number, source: Int16Array, gain = 1): void {
  const length = source.length;
  const edge = Math.min(EDGE_SAMPLES, Math.floor(length / 2));
  const first = Math.max(0, -at);
  const last = Math.min(length, target.length - at);
  for (let i = first; i < last; i++) {
    let factor = gain;
    if (i < edge) factor *= i / edge;
    else if (i >= length - edge) factor *= (length - 1 - i) / edge;
    target[at + i] = clip16(target[at + i]! + source[i]! * factor);
  }
}

/** The video file a stretch of film on a slide plays: the asset's id, when it is a file in the project. */
export function spanAsset(scene: Pick<Scene, 'elements'>, span: VideoSpan): string | undefined {
  const element = scene.elements.find((e) => e.id === span.element);
  if (!element) return undefined;
  let source: VideoSource | undefined;
  if (span.block === undefined) {
    if (element.type === 'video') source = element.source;
  } else {
    const block = element.more?.blocks.find((b) => b.id === span.block);
    if (block?.kind === 'video') source = block.source;
  }
  return source?.kind === 'asset' ? source.asset : undefined;
}

// ---------- Music that steps back while someone speaks ----------

/** The music's loudness is decided for stretches this long. */
export const DUCK_BLOCK = Math.round(SAMPLE_RATE * 0.02);
/** How far the music is lowered under speech: a quarter, about 12 dB. */
export const DUCK_GAIN = 0.25;
/** Sound above this (about -42 dB) counts as someone speaking. */
const SPEECH_LEVEL = 260;
/** The music stays down this long after the last word, so it does not pump between sentences. */
const HOLD_BLOCKS = Math.round(0.7 / 0.02);
/** It starts going down this long before a word, where the sound ahead is known. */
const AHEAD_BLOCKS = Math.round(0.2 / 0.02);
/** How fast it goes down and comes back up, as a share of the way for each block. */
const DOWN_RATE = 0.2;
const UP_RATE = 0.05;

/** What is carried from one slide to the next, so the music does not jump at the boundary. */
export interface DuckState {
  /** The music's loudness factor right now. */
  gain: number;
  /** Blocks since someone last spoke. */
  quiet: number;
  /** Where the sound that was last looked at ended, in samples of the lecture. */
  end?: number;
}

export function newDuckState(): DuckState {
  return { gain: 1, quiet: HOLD_BLOCKS + 1 };
}

/**
 * How loud the music may be under `voice`: one factor for each block of
 * `DUCK_BLOCK` samples, 1 where nobody speaks and `DUCK_GAIN` where
 * somebody does, gliding between the two. `state` is carried on.
 */
export function duckGains(voice: Int16Array, state: DuckState): Float32Array {
  const blocks = Math.ceil(voice.length / DUCK_BLOCK);
  const speaking = new Uint8Array(blocks);
  for (let b = 0; b < blocks; b++) {
    const from = b * DUCK_BLOCK;
    const to = Math.min(voice.length, from + DUCK_BLOCK);
    let sum = 0;
    for (let i = from; i < to; i++) sum += voice[i]! * voice[i]!;
    speaking[b] = Math.sqrt(sum / Math.max(1, to - from)) > SPEECH_LEVEL ? 1 : 0;
  }
  const gains = new Float32Array(blocks);
  // For each block: how many blocks until someone speaks next.
  const next = new Int32Array(blocks);
  let ahead = AHEAD_BLOCKS + 1;
  for (let b = blocks - 1; b >= 0; b--) {
    ahead = speaking[b] ? 0 : ahead + 1;
    next[b] = ahead;
  }
  for (let b = 0; b < blocks; b++) {
    state.quiet = speaking[b] ? 0 : state.quiet + 1;
    const down = state.quiet <= HOLD_BLOCKS || next[b]! <= AHEAD_BLOCKS;
    const target = down ? DUCK_GAIN : 1;
    state.gain += (target - state.gain) * (down ? DOWN_RATE : UP_RATE);
    gains[b] = state.gain;
  }
  return gains;
}

/** A clip of one of the lecture's tracks, with where it lies in the lecture, in seconds. */
export interface TrackPiece {
  asset: string;
  /** Where in the lecture it starts. */
  start: number;
  /** The part of the file that is played. */
  from: number;
  to: number;
  /** Loudness factor (1 is as it is). */
  gain: number;
  fadeIn: number;
  fadeOut: number;
}

/**
 * Adds the part of a track clip that falls inside `part` to it. `partStart`
 * is where `part` begins in the lecture, in samples. With `duck`, the clip
 * is lowered by those factors (one for each `DUCK_BLOCK` of `part`).
 */
export function mixPiece(
  part: Int16Array,
  partStart: number,
  piece: TrackPiece,
  source: Int16Array,
  duck?: Float32Array,
): void {
  const clipStart = Math.round(piece.start * SAMPLE_RATE);
  const sourceFrom = Math.round(piece.from * SAMPLE_RATE);
  const length = Math.min(
    Math.round((piece.to - piece.from) * SAMPLE_RATE),
    source.length - sourceFrom,
  );
  if (length <= 0) return;
  const fadeIn = Math.max(EDGE_SAMPLES, Math.round(piece.fadeIn * SAMPLE_RATE));
  const fadeOut = Math.max(EDGE_SAMPLES, Math.round(piece.fadeOut * SAMPLE_RATE));
  const first = Math.max(0, partStart - clipStart);
  const last = Math.min(length, partStart + part.length - clipStart);
  for (let i = first; i < last; i++) {
    let factor = piece.gain;
    if (i < fadeIn) factor *= i / fadeIn;
    if (i >= length - fadeOut) factor *= (length - 1 - i) / fadeOut;
    const at = clipStart + i - partStart;
    if (duck) factor *= duck[Math.floor(at / DUCK_BLOCK)] ?? 1;
    part[at] = clip16(part[at]! + source[sourceFrom + i]! * factor);
  }
}

/**
 * Adds the lecture's own tracks (music, other sound) to the sound of one
 * slide. `part` holds the slide's voice and is changed; `partStart` is
 * where the slide begins in the lecture, in samples. With `duck`, the
 * music steps back while someone speaks; the state is carried from slide
 * to slide, so the slides must come in the order of the lecture. With
 * `voice`, that is what the music steps back for, and `part` gets only the
 * tracks (the HTML file keeps the music apart from the voice, so that it
 * can run on over the change of slide).
 */
export function mixTracks(
  part: Int16Array,
  partStart: number,
  placed: readonly PlacedClip[],
  samplesOf: (assetId: string) => Int16Array | undefined,
  duck: DuckState | null,
  voice?: Int16Array,
): void {
  if (duck) {
    // After a jump in the lecture (slides without any sound are not put
    // together at all), nothing is known about what came just before.
    if (duck.end !== undefined && Math.abs(partStart - duck.end) > SAMPLE_RATE * 0.05) {
      Object.assign(duck, newDuckState(), { end: undefined });
    }
    duck.end = partStart + part.length;
  }
  // The voice decides before anything is laid on top of it.
  const gains = duck ? duckGains(voice ?? part, duck) : undefined;
  const from = partStart / SAMPLE_RATE;
  const to = (partStart + part.length) / SAMPLE_RATE;
  for (const { track, clip, start, end } of placed) {
    if (end <= from || start >= to) continue;
    const source = samplesOf(clip.asset);
    if (!source) continue;
    mixPiece(
      part,
      partStart,
      {
        asset: clip.asset,
        start,
        from: clip.from,
        to: clip.to,
        gain: gainFactor(clip.gain),
        fadeIn: clip.fadeIn ?? 0,
        fadeOut: clip.fadeOut ?? 0,
      },
      source,
      track === 'music' ? gains : undefined,
    );
  }
}
