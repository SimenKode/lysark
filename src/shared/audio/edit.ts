// Editing a slide's sound. Every function changes the slide it is given
// (the editor calls them on a draft, so each is one undo step) and never
// touches a recording: clips only point at parts of it. When sound is cut
// out or a pause is put in, the times of the steps after it move along, so
// what is shown still follows what is said.
import type { AudioClip, Scene } from '../format/schema';
import { clipDuration, trackDuration } from '../render/clock';

/** Clips shorter than this are not worth keeping; they are leftovers of rounding. */
const SLIVER = 0.005;
/** The shortest pause that can be put in or left. */
export const MIN_PAUSE = 0.05;

type AudioScene = Pick<Scene, 'audio' | 'timeline'>;
type NewId = () => string;

function clips(scene: AudioScene): AudioClip[] {
  if (!scene.audio) scene.audio = { clips: [] };
  return scene.audio.clips;
}

/** Drops slivers, joins neighbours that continue each other, and removes an empty track. */
function tidy(scene: AudioScene): void {
  if (!scene.audio) return;
  const out: AudioClip[] = [];
  for (const clip of scene.audio.clips) {
    if (clipDuration(clip) < SLIVER) continue;
    const last = out[out.length - 1];
    if (last && last.kind === 'pause' && clip.kind === 'pause') {
      last.duration += clip.duration;
    } else if (
      last &&
      last.kind === 'sound' &&
      clip.kind === 'sound' &&
      last.asset === clip.asset &&
      Math.abs(last.to - clip.from) < 1e-6
    ) {
      last.to = clip.to;
    } else {
      out.push(clip);
    }
  }
  scene.audio.clips = out;
  if (out.length === 0 && scene.audio.gain === undefined) delete scene.audio;
}

/** Moves the steps that have a time: those at or after `from` move by `delta`. */
function shiftSteps(scene: AudioScene, from: number, delta: number): void {
  for (const step of scene.timeline) {
    if (step.at !== undefined && step.at >= from) step.at = Math.max(from, step.at + delta);
  }
}

/** Keeps step times inside the slide after its sound got shorter. */
function clampSteps(scene: AudioScene): void {
  const end = trackDuration(scene.audio);
  if (end <= 0) return;
  for (const step of scene.timeline) {
    if (step.at !== undefined) step.at = Math.min(end, Math.max(0, step.at));
  }
}

/**
 * Makes sure a clip boundary lies at track time `t`, splitting the clip
 * there if needed. Returns the index of the clip that starts at `t`
 * (the number of clips when `t` is at or past the end).
 */
export function splitAt(scene: AudioScene, t: number, newId: NewId): number {
  const list = clips(scene);
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const clip = list[i]!;
    const length = clipDuration(clip);
    const end = start + length;
    if (t <= start + SLIVER) return i;
    if (t < end - SLIVER) {
      const offset = t - start;
      if (clip.kind === 'pause') {
        list.splice(
          i,
          1,
          { ...clip, duration: offset },
          { id: newId(), kind: 'pause', duration: length - offset },
        );
      } else {
        const cut = clip.from + offset;
        list.splice(i, 1, { ...clip, to: cut }, { ...clip, id: newId(), from: cut });
      }
      return i + 1;
    }
    start = end;
  }
  return list.length;
}

/** Removes the stretch from `from` to `to` (track time). What comes after moves forward. */
export function cutRange(scene: AudioScene, from: number, to: number, newId: NewId): void {
  const end = trackDuration(scene.audio);
  const a = Math.max(0, Math.min(from, to));
  const b = Math.min(end, Math.max(from, to));
  if (!scene.audio || b - a < SLIVER) return;
  const first = splitAt(scene, a, newId);
  const last = splitAt(scene, b, newId);
  scene.audio.clips.splice(first, last - first);
  // Steps inside the cut happen where the cut is; later ones move forward.
  for (const step of scene.timeline) {
    if (step.at === undefined) continue;
    if (step.at >= b) step.at -= b - a;
    else if (step.at > a) step.at = a;
  }
  tidy(scene);
  clampSteps(scene);
}

/** Puts silence in at `t`. What comes after moves back. */
export function insertPause(scene: AudioScene, t: number, duration: number, newId: NewId): void {
  if (!(duration >= MIN_PAUSE)) return;
  const at = Math.max(0, Math.min(trackDuration(scene.audio), t));
  const index = splitAt(scene, at, newId);
  clips(scene).splice(index, 0, { id: newId(), kind: 'pause', duration });
  shiftSteps(scene, at, duration);
  tidy(scene);
}

/** Changes the length of a pause. What comes after moves with it. */
export function setPauseDuration(scene: AudioScene, clipId: string, duration: number): void {
  const list = scene.audio?.clips ?? [];
  let start = 0;
  for (const clip of list) {
    if (clip.id === clipId && clip.kind === 'pause') {
      const next = Math.max(MIN_PAUSE, duration);
      const end = start + clip.duration;
      shiftSteps(scene, end, next - clip.duration);
      clip.duration = next;
      return;
    }
    start += clipDuration(clip);
  }
}

/** Adds a recording (or an imported sound file) at the end of the slide's sound. */
export function appendSound(scene: AudioScene, asset: string, seconds: number, newId: NewId): void {
  if (!(seconds > SLIVER)) return;
  clips(scene).push({ id: newId(), kind: 'sound', asset, from: 0, to: seconds });
}

/**
 * Replaces the slide's sound with a new recording ("ta om"). Steps keep
 * the times given, which the recording set as the owner pressed on.
 */
export function replaceSound(
  scene: AudioScene,
  asset: string,
  seconds: number,
  stepAts: ReadonlyArray<number | undefined>,
  newId: NewId,
): void {
  const gain = scene.audio?.gain;
  scene.audio = { clips: [], ...(gain === undefined ? {} : { gain }) };
  appendSound(scene, asset, seconds, newId);
  scene.timeline.forEach((step, index) => {
    const at = stepAts[index];
    if (at === undefined) delete step.at;
    else step.at = Math.max(0, Math.min(seconds, at));
  });
  tidy(scene);
}

/** Removes the slide's sound. Steps lose their times and are spread evenly again. */
export function removeSound(scene: AudioScene): void {
  delete scene.audio;
  for (const step of scene.timeline) delete step.at;
}

/** Sets when a step happens, inside the slide. */
export function setStepTime(scene: AudioScene, stepId: string, at: number): void {
  const step = scene.timeline.find((s) => s.id === stepId);
  if (!step) return;
  const end = trackDuration(scene.audio);
  step.at = Math.max(0, end > 0 ? Math.min(end, at) : at);
}

export function setGain(scene: AudioScene, gain: number): void {
  if (!scene.audio) return;
  if (Math.abs(gain) < 0.05) delete scene.audio.gain;
  else scene.audio.gain = gain;
}

/** Where each clip lies on the slide's track. */
export function clipSpans(
  scene: Pick<Scene, 'audio'>,
): Array<{ clip: AudioClip; start: number; end: number }> {
  let start = 0;
  return (scene.audio?.clips ?? []).map((clip) => {
    const span = { clip, start, end: start + clipDuration(clip) };
    start = span.end;
    return span;
  });
}
