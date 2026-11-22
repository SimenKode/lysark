// Putting sound on top of sound: a film that plays while the lecturer
// speaks, music under the voice. All of it is mono, 48 kHz, 16 bit.
import type { Scene, VideoSource } from '../format/schema';
import { SAMPLE_RATE, type VideoSpan } from '../render/clock';

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
