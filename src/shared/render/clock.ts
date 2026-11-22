// Time. What the lecture shows at a given moment is a pure function of the
// project and that moment: the video export draws frame by frame from it,
// "Spill av" in the HTML player follows it, and the editor's timeline shows
// it. Nothing here reads a clock.
import type {
  AudioClip,
  Project,
  Scene,
  SceneAudio,
  SceneEvent,
  Step,
  TrackClip,
  TrackName,
} from '../format/schema';
import { stepDuration } from './timeline';

/** A slide without sound stands this long, plus a little for each step. */
export const SILENT_SCENE_SECONDS = 5;
export const SILENT_STEP_SECONDS = 2;
/** Length of the fade between slides, when the project asks for one. */
export const FADE_SECONDS = 0.3;
export const VIDEO_FPS = 30;
export const VIDEO_SIZE = { width: 1920, height: 1080 } as const;
/**
 * A GIF is for short clips: fewer pictures a second, no sound, and not long.
 * A GIF gives the time of each picture in hundredths of a second, so the
 * rate must divide 100 evenly, or the clip runs slower than the lecture:
 * 12.5 a second is 8 hundredths each.
 */
export const GIF_FPS = 12.5;
export const GIF_MAX_SECONDS = 120;
export const GIF_WIDTHS = [480, 640, 960] as const;
/** All sound in a project is mono at this rate. */
export const SAMPLE_RATE = 48000;

export function clipDuration(clip: AudioClip): number {
  return clip.kind === 'pause' ? clip.duration : Math.max(0, clip.to - clip.from);
}

/** Length of a sound track, in seconds. */
export function trackDuration(audio: SceneAudio | undefined): number {
  let total = 0;
  for (const clip of audio?.clips ?? []) total += clipDuration(clip);
  return total;
}

export function hasSound(scene: Pick<Scene, 'audio'>): boolean {
  return (scene.audio?.clips ?? []).some((clip) => clip.kind === 'sound');
}

/** What the clock needs to know about a slide. */
export type Timed = Pick<Scene, 'audio' | 'timeline'> &
  Partial<Pick<Scene, 'closingAnimation' | 'events'>>;

/** How long the last picture of the closing animation stands after the film has ended. */
export const CLOSING_HOLD_SECONDS = 2;

/** How long a slide stands in video and in "Spill av". */
export function sceneDuration(scene: Timed): number {
  const track = trackDuration(scene.audio);
  if (track > 0) return track;
  // A slide with the closing animation stands as long as the film, and a little more.
  if (scene.closingAnimation) return scene.closingAnimation.seconds + CLOSING_HOLD_SECONDS;
  return SILENT_SCENE_SECONDS + SILENT_STEP_SECONDS * scene.timeline.length;
}

/**
 * When each step of a slide happens, in seconds from the start of the
 * slide. A step with a time keeps it (inside the slide); steps without one
 * are spread evenly. The times never go backwards.
 */
export function stepTimes(scene: Timed): number[] {
  const duration = sceneDuration(scene);
  const count = scene.timeline.length;
  let previous = 0;
  return scene.timeline.map((step: Step, index) => {
    const own = step.at ?? (duration * (index + 1)) / (count + 1);
    previous = Math.max(previous, Math.min(duration, Math.max(0, own)));
    return previous;
  });
}

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

/** How many steps have been triggered `t` seconds into the slide. */
export function stepsShownAt(scene: Timed, t: number): number {
  return stepTimes(scene).filter((at) => at <= t).length;
}

/**
 * Opacity (0..1) of every element that takes part in the timeline, `t`
 * seconds into the slide. The same rule as stepping by hand
 * (`sceneState`), but every step runs from its own time.
 */
export function sceneStateAt(
  scene: Pick<Scene, 'audio' | 'timeline'>,
  t: number,
): Map<string, number> {
  const times = stepTimes(scene);
  const state = new Map<string, number>();
  scene.timeline.forEach((step, index) => {
    const since = t - times[index]!;
    for (const action of step.actions) {
      if (state.has(action.target)) continue; // the first step that brings it in decides
      let opacity: number;
      const local = since - (action.delay ?? 0);
      if (since < 0 || local < 0) opacity = 0;
      else if (action.effect === 'appear' || action.duration <= 0) opacity = 1;
      else opacity = easeOutCubic(Math.min(1, local / action.duration));
      state.set(action.target, opacity);
    }
  });
  return state;
}

// ---------- What was opened and played while the slide was read in ----------

/** How long a "Lær mer" box takes to pop out of its mark. */
export const POP_SECONDS = 0.28;

/** One name for a video on a slide: the element, or a block in the element's box. */
export function videoKey(element: string, block?: string): string {
  return block === undefined ? element : `${element}/${block}`;
}

/** The slide's events in order of time, none of them after the slide has ended. */
export function sceneEvents(scene: Timed): SceneEvent[] {
  const events = scene.events;
  if (!events || events.length === 0) return [];
  const end = sceneDuration(scene);
  return events
    .map((event, index) => ({ event, index, at: Math.min(end, Math.max(0, event.at)) }))
    .sort((a, b) => a.at - b.at || a.index - b.index)
    .map(({ event, at }) => (at === event.at ? event : { ...event, at }));
}

export interface MoreAt {
  /** The element whose box is open. */
  element: string;
  /** Seconds since it was opened. */
  since: number;
}

/** The "Lær mer" box that is open `t` seconds into the slide, if any. */
export function moreAt(scene: Timed, t: number): MoreAt | undefined {
  let open: MoreAt | undefined;
  for (const event of sceneEvents(scene)) {
    if (event.at > t) break;
    if (event.kind === 'more-open') open = { element: event.element, since: t - event.at };
    else if (event.kind === 'more-close') open = undefined;
  }
  return open;
}

/** How far the box has popped out (0..1) when it was opened `since` seconds ago. */
export function popProgress(since: number): number {
  return Math.max(0, Math.min(1, since / POP_SECONDS));
}

/** A stretch in which a video plays. */
export interface VideoSpan {
  element: string;
  block?: string;
  /** When it starts, in seconds from the start of the slide. */
  at: number;
  /** Where in the film it starts. */
  from: number;
  /** How long it plays. */
  length: number;
}

/**
 * Every stretch in which a video plays on the slide. A video stops when it
 * is paused, when the film has run out, when the box it is in is put away,
 * and when the slide ends.
 */
export function videoSpans(scene: Timed): VideoSpan[] {
  const events = sceneEvents(scene);
  if (events.length === 0) return [];
  const spans: VideoSpan[] = [];
  const running = new Map<string, { span: VideoSpan; duration: number }>();
  const stop = (key: string, at: number): void => {
    const entry = running.get(key);
    if (!entry) return;
    running.delete(key);
    const length = Math.min(at - entry.span.at, entry.duration - entry.span.from);
    if (length > 1e-6) spans.push({ ...entry.span, length });
  };
  const stopBoxVideos = (at: number): void => {
    for (const [key, entry] of [...running]) {
      if (entry.span.block !== undefined) stop(key, at);
    }
  };
  for (const event of events) {
    if (event.kind === 'more-open' || event.kind === 'more-close') {
      stopBoxVideos(event.at);
    } else {
      const key = videoKey(event.element, event.block);
      stop(key, event.at);
      if (event.kind === 'video-play') {
        const span: VideoSpan = {
          element: event.element,
          ...(event.block === undefined ? {} : { block: event.block }),
          at: event.at,
          from: event.from,
          length: 0,
        };
        running.set(key, { span, duration: event.duration });
      }
    }
  }
  const end = sceneDuration(scene);
  for (const key of [...running.keys()]) stop(key, end);
  return spans.sort((a, b) => a.at - b.at);
}

export interface VideoAt {
  /** Where in the film the video is, in seconds. */
  time: number;
  playing: boolean;
}

/** Where every video that has been played stands `t` seconds into the slide. */
export function videosAt(scene: Timed, t: number): Map<string, VideoAt> {
  const state = new Map<string, VideoAt>();
  for (const span of videoSpans(scene)) {
    if (span.at > t) break;
    const played = Math.min(span.length, t - span.at);
    state.set(videoKey(span.element, span.block), {
      time: span.from + played,
      playing: t - span.at < span.length,
    });
  }
  return state;
}

/** True while something on the slide is still moving at `t`. */
export function isAnimatingAt(scene: Timed, t: number): boolean {
  // The closing animation is a film: every picture of it is a new one.
  if (scene.closingAnimation && t < scene.closingAnimation.seconds + 1 / VIDEO_FPS) return true;
  const open = moreAt(scene, t);
  if (open && open.since < POP_SECONDS + 1 / VIDEO_FPS) return true;
  for (const video of videosAt(scene, t).values()) if (video.playing) return true;
  const times = stepTimes(scene);
  return scene.timeline.some((step, index) => {
    const since = t - times[index]!;
    return since >= 0 && since < stepDuration(step);
  });
}

export interface ScheduleEntry {
  index: number;
  /** Seconds from the start of the lecture. */
  start: number;
  duration: number;
}

export interface Schedule {
  entries: ScheduleEntry[];
  total: number;
}

/** When each slide starts and how long it stands. */
export function schedule(scenes: ReadonlyArray<Timed>): Schedule {
  const entries: ScheduleEntry[] = [];
  let start = 0;
  scenes.forEach((scene, index) => {
    const duration = sceneDuration(scene);
    entries.push({ index, start, duration });
    start += duration;
  });
  return { entries, total: start };
}

export interface FrameState {
  /** The slide on screen. */
  index: number;
  /** Seconds into that slide. */
  t: number;
  /** While a new slide fades in: the slide before it, and how far the fade has come (0..1). */
  fade?: { from: number; progress: number };
}

/** What is on screen `time` seconds into the lecture. */
export function frameAt(plan: Schedule, time: number, transition: 'cut' | 'fade'): FrameState {
  const entries = plan.entries;
  if (entries.length === 0) return { index: 0, t: 0 };
  let entry = entries[entries.length - 1]!;
  for (const candidate of entries) {
    if (time < candidate.start + candidate.duration) {
      entry = candidate;
      break;
    }
  }
  const t = Math.max(0, Math.min(entry.duration, time - entry.start));
  const fadeLength = Math.min(FADE_SECONDS, entry.duration / 2);
  if (transition === 'fade' && entry.index > 0 && t < fadeLength) {
    return { index: entry.index, t, fade: { from: entry.index - 1, progress: t / fadeLength } };
  }
  return { index: entry.index, t };
}

/**
 * Until when (in seconds from the start) the picture stays exactly as it is
 * at `time`. Returns `time` itself while something is moving.
 */
export function stillUntil(
  scenes: ReadonlyArray<Timed>,
  plan: Schedule,
  time: number,
  transition: 'cut' | 'fade',
): number {
  const state = frameAt(plan, time, transition);
  const entry = plan.entries[state.index];
  const scene = scenes[state.index];
  if (!entry || !scene || state.fade || isAnimatingAt(scene, state.t)) return time;
  let until = entry.start + entry.duration;
  for (const at of stepTimes(scene)) {
    if (at > state.t) {
      until = Math.min(until, entry.start + at);
      break;
    }
  }
  for (const event of sceneEvents(scene)) {
    if (event.at > state.t) {
      until = Math.min(until, entry.start + event.at);
      break;
    }
  }
  return until;
}

// ---------- The lecture's own tracks ----------

export function trackClipDuration(clip: Pick<TrackClip, 'from' | 'to'>): number {
  return Math.max(0, clip.to - clip.from);
}

/** A clip on one of the lecture's tracks, with where it lies in the lecture. */
export interface PlacedClip {
  track: TrackName;
  clip: TrackClip;
  /** Seconds from the start of the lecture. */
  start: number;
  end: number;
}

/**
 * Where every clip on the lecture's tracks lies in time. A clip whose slide
 * is gone is left out.
 */
export function placeTracks(
  project: { scenes: ReadonlyArray<Timed & Pick<Scene, 'id'>> } & Pick<Project, 'tracks'>,
  plan: Schedule = schedule(project.scenes),
): PlacedClip[] {
  const tracks = project.tracks;
  if (!tracks) return [];
  const starts = new Map<string, number>();
  project.scenes.forEach((scene, index) => starts.set(scene.id, plan.entries[index]!.start));
  const placed: PlacedClip[] = [];
  for (const track of ['music', 'sound'] as const) {
    for (const clip of tracks[track]) {
      const base = starts.get(clip.scene);
      if (base === undefined) continue;
      const start = base + clip.offset;
      placed.push({ track, clip, start, end: start + trackClipDuration(clip) });
    }
  }
  return placed.sort((a, b) => a.start - b.start);
}

/** The slide and the time on it that lie `time` seconds into the lecture. */
export function anchorAt(
  scenes: ReadonlyArray<Pick<Scene, 'id'>>,
  plan: Schedule,
  time: number,
): { scene: string; offset: number } | undefined {
  if (plan.entries.length === 0) return undefined;
  let entry = plan.entries[plan.entries.length - 1]!;
  for (const candidate of plan.entries) {
    if (time < candidate.start + candidate.duration) {
      entry = candidate;
      break;
    }
  }
  return { scene: scenes[entry.index]!.id, offset: Math.max(0, time - entry.start) };
}

/** The video choices of a project, with the defaults filled in. */
export function videoOptions(project: Pick<Project, 'video'>): NonNullable<Project['video']> {
  return project.video ?? { transition: 'cut', evenLoudness: true, credits: false };
}

/** "1:05" or "1:02:03". */
export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
