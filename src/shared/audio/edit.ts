// Editing a slide's sound. Every function changes the slide it is given
// (the editor calls them on a draft, so each is one undo step) and never
// touches a recording: clips only point at parts of it. When sound is cut
// out or a pause is put in, the times of the steps after it move along, so
// what is shown still follows what is said.
import type { AudioClip, Scene, SceneEvent } from '../format/schema';
import {
  SILENT_SECONDS,
  clipDuration,
  defaultCameraPlace,
  hasSound,
  ownsSeconds,
  trackDuration,
  videosAt,
  videoKey,
} from '../render/clock';

/** Clips shorter than this are not worth keeping; they are leftovers of rounding. */
const SLIVER = 0.005;
/** The shortest pause that can be put in or left. */
export const MIN_PAUSE = 0.05;

type AudioScene = Pick<Scene, 'audio' | 'timeline'> & Partial<Pick<Scene, 'events'>>;
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

/**
 * Moves the steps that have a time, and what was opened and played: those
 * at or after `from` move by `delta`.
 */
function shiftSteps(scene: AudioScene, from: number, delta: number): void {
  for (const step of scene.timeline) {
    if (step.at !== undefined && step.at >= from) step.at = Math.max(from, step.at + delta);
  }
  for (const event of scene.events ?? []) {
    if (event.at >= from) event.at = Math.max(from, event.at + delta);
  }
}

/** Keeps step and event times inside the slide after its sound got shorter. */
function clampSteps(scene: AudioScene): void {
  const end = trackDuration(scene.audio);
  if (end <= 0) return;
  for (const step of scene.timeline) {
    if (step.at !== undefined) step.at = Math.min(end, Math.max(0, step.at));
  }
  for (const event of scene.events ?? []) event.at = Math.min(end, Math.max(0, event.at));
}

/** Puts the events in order of time, and drops the list when it is empty. */
function tidyEvents(scene: AudioScene): void {
  if (!scene.events) return;
  if (scene.events.length === 0) {
    delete scene.events;
    return;
  }
  const order = new Map(scene.events.map((event, index) => [event, index]));
  scene.events.sort((a, b) => a.at - b.at || order.get(a)! - order.get(b)!);
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
  // The same goes for what was opened and played. A film started inside the
  // cut starts where the cut is, as far into the film as it had come.
  for (const event of scene.events ?? []) {
    if (event.at >= b) event.at -= b - a;
    else if (event.at > a) {
      if (event.kind === 'video-play') {
        event.from = Math.min(event.duration, event.from + (b - event.at));
      }
      event.at = a;
    }
  }
  tidy(scene);
  clampSteps(scene);
  tidyEvents(scene);
}

/** Puts silence in at `t`. What comes after moves back. */
export function insertPause(scene: AudioScene, t: number, duration: number, newId: NewId): void {
  if (!(duration >= MIN_PAUSE)) return;
  const at = Math.max(0, Math.min(trackDuration(scene.audio), t));
  const index = splitAt(scene, at, newId);
  clips(scene).splice(index, 0, { id: newId(), kind: 'pause', duration });
  shiftSteps(scene, at, duration);
  tidy(scene);
  tidyEvents(scene);
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
 * the times given, which the recording set as the owner pressed on, and
 * what was opened and played is what this recording did.
 */
export function replaceSound(
  scene: AudioScene,
  asset: string,
  seconds: number,
  stepAts: ReadonlyArray<number | undefined>,
  newId: NewId,
  events: ReadonlyArray<SceneEvent> = [],
): void {
  const gain = scene.audio?.gain;
  scene.audio = { clips: [], ...(gain === undefined ? {} : { gain }) };
  appendSound(scene, asset, seconds, newId);
  scene.timeline.forEach((step, index) => {
    const at = stepAts[index];
    if (at === undefined) delete step.at;
    else step.at = Math.max(0, Math.min(seconds, at));
  });
  scene.events = events.map((event) => ({
    ...event,
    at: Math.max(0, Math.min(seconds, event.at)),
  }));
  tidy(scene);
  tidyEvents(scene);
}

/**
 * Keeps the slide's sound up to `keepBefore` and lets a new recording
 * follow it ("ta om herfra"). Steps that happen in the part that is kept
 * keep their times; the others get theirs from the new recording, counted
 * from where it starts. What was opened and played before that point
 * stays; a film that was running there stops, and the new recording's own
 * events follow.
 */
export function continueSound(
  scene: AudioScene,
  keepBefore: number,
  asset: string,
  seconds: number,
  stepAts: ReadonlyArray<number | undefined>,
  newId: NewId,
  events: ReadonlyArray<SceneEvent> = [],
): void {
  const kept = Math.max(0, Math.min(keepBefore, trackDuration(scene.audio)));
  const before = scene.timeline.map((step) => step.at);
  const keptEvents = stateEventsBefore(scene, kept, newId);
  cutRange(scene, kept, trackDuration(scene.audio), newId);
  appendSound(scene, asset, seconds, newId);
  scene.events = [
    ...keptEvents,
    ...events.map((event) => ({ ...event, at: kept + Math.max(0, Math.min(seconds, event.at)) })),
  ];
  tidyEvents(scene);
  scene.timeline.forEach((step, index) => {
    const pressed = stepAts[index];
    const old = before[index];
    if (pressed !== undefined) step.at = kept + Math.min(seconds, Math.max(0, pressed));
    else if (old !== undefined && old < kept) step.at = old;
    else delete step.at;
  });
}

/**
 * The events before `at`, with every film that is running at `at` stopped
 * there: what a recording that takes over from `at` starts out with.
 */
function stateEventsBefore(scene: AudioScene, at: number, newId: NewId): SceneEvent[] {
  const kept = (scene.events ?? []).filter((event) => event.at < at).map((event) => ({ ...event }));
  const playing = videosAt({ ...scene, events: kept }, at);
  for (const event of [...kept]) {
    if (event.kind !== 'video-play') continue;
    const key = videoKey(event.element, event.block);
    if (!playing.get(key)?.playing) continue;
    playing.delete(key);
    kept.push({
      id: newId(),
      at,
      kind: 'video-pause',
      element: event.element,
      ...(event.block === undefined ? {} : { block: event.block }),
    });
  }
  return kept;
}

/**
 * Removes the slide's sound. Steps lose their times and are spread evenly
 * again, and what was opened and played is forgotten with the recording.
 */
export function removeSound(scene: AudioScene): void {
  delete scene.audio;
  delete scene.events;
  for (const step of scene.timeline) delete step.at;
}

/**
 * Makes a slide without sound stand for `seconds` (`Scene.seconds`). Pauses
 * that were put in only to give it a length (the old way) are replaced by
 * it. Does nothing to a slide with sound, a repeat or a slide that plays the
 * closing animation.
 */
export function setSilentSeconds(
  scene: AudioScene & Partial<Pick<Scene, 'seconds' | 'closingAnimation' | 'repeat'>>,
  seconds: number,
): void {
  if (!Number.isFinite(seconds) || hasSound(scene) || !ownsSeconds(scene)) return;
  scene.seconds =
    Math.round(Math.max(SILENT_SECONDS.min, Math.min(SILENT_SECONDS.max, seconds)) * 10) / 10;
  if (scene.audio) {
    scene.audio.clips = [];
    if (scene.audio.gain === undefined) delete scene.audio;
  }
}

/** Sets when something that was opened or played happens, inside the slide. */
export function setEventTime(scene: AudioScene, eventId: string, at: number): void {
  const event = scene.events?.find((e) => e.id === eventId);
  if (!event) return;
  const end = trackDuration(scene.audio);
  event.at = Math.max(0, end > 0 ? Math.min(end, at) : at);
  tidyEvents(scene);
}

/** Removes one event: the box is then not opened, or the film not started, there. */
export function removeEvent(scene: AudioScene, eventId: string): void {
  if (!scene.events) return;
  scene.events = scene.events.filter((event) => event.id !== eventId);
  tidyEvents(scene);
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

/**
 * Puts the camera circle at a new place as from `t` seconds into the slide.
 * When the lecturer had moved the circle before that moment, the latest of
 * those moves gets the new place; otherwise the place the slide starts with.
 */
export function setCameraPlace(
  scene: Pick<Scene, 'camera'> & Partial<Pick<Scene, 'events'>>,
  t: number,
  place: { x: number; y: number },
): void {
  let latest: Extract<SceneEvent, { kind: 'camera-move' }> | undefined;
  for (const event of scene.events ?? []) {
    if (event.kind !== 'camera-move' || event.at > t) continue;
    if (!latest || event.at >= latest.at) latest = event;
  }
  if (latest) {
    latest.x = place.x;
    latest.y = place.y;
  } else {
    scene.camera = { ...(scene.camera ?? defaultCameraPlace()), x: place.x, y: place.y };
  }
}
