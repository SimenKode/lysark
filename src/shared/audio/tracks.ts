// Editing the lecture's own tracks: music and other sound that run under
// the slides. Every function changes the project it is given (the editor
// calls them on a draft, so each is one undo step). A clip is fastened to a
// slide and a time on it; here it is moved and cut by its time in the
// whole lecture, and fastened again where it lands.
import type { Asset, Project, Scene, TrackClip, TrackName } from '../format/schema';
import { GAIN_DB, TRACK_NAMES } from '../format/schema';
import {
  SAMPLE_RATE,
  anchorAt,
  clipDuration,
  schedule,
  sceneDuration,
  trackClipDuration,
  trackDuration,
} from '../render/clock';
import { MIN_PAUSE } from './edit';

type NewId = () => string;
type Lecture = Pick<Project, 'scenes' | 'tracks' | 'assets'>;

/** The shortest piece of a clip that is worth keeping. */
export const MIN_CLIP = 0.1;
/** The longest fade in or out. */
export const MAX_FADE = 30;

/** How long a sound file of the project is, from its size: mono, 16 bit, 48 kHz, 44 bytes of header. */
export function assetSeconds(asset: Asset | undefined): number {
  if (!asset || asset.kind !== 'audio') return 0;
  return Math.max(0, (asset.bytes - 44) / (2 * SAMPLE_RATE));
}

function tracksOf(project: Lecture): NonNullable<Project['tracks']> {
  if (!project.tracks) project.tracks = { music: [], sound: [] };
  return project.tracks;
}

/** Drops the tracks when nothing is left on them. */
function tidy(project: Lecture): void {
  const tracks = project.tracks;
  if (tracks && tracks.music.length === 0 && tracks.sound.length === 0) delete project.tracks;
}

/** A clip and the track it is on. */
export function findTrackClip(
  project: Pick<Project, 'tracks'>,
  clipId: string,
): { track: TrackName; clip: TrackClip; index: number } | undefined {
  for (const track of TRACK_NAMES) {
    const index = project.tracks?.[track].findIndex((c) => c.id === clipId) ?? -1;
    if (index >= 0) return { track, clip: project.tracks![track][index]!, index };
  }
  return undefined;
}

/** Where a clip starts in the lecture, in seconds; undefined when its slide is gone. */
export function clipStart(project: Pick<Project, 'scenes'>, clip: TrackClip): number | undefined {
  const plan = schedule(project.scenes);
  const index = project.scenes.findIndex((s) => s.id === clip.scene);
  return index < 0 ? undefined : plan.entries[index]!.start + clip.offset;
}

/** Fastens a clip so that it starts `time` seconds into the lecture. */
function fasten(project: Pick<Project, 'scenes'>, clip: TrackClip, time: number): void {
  const plan = schedule(project.scenes);
  // A clip must start inside the lecture to be heard at all.
  const latest = Math.max(0, plan.total - MIN_CLIP);
  const anchor = anchorAt(project.scenes, plan, Math.max(0, Math.min(latest, time)));
  if (!anchor) return;
  clip.scene = anchor.scene;
  clip.offset = anchor.offset;
}

/** Puts a sound file on a track, starting `time` seconds into the lecture. Returns the new clip's id. */
export function addTrackClip(
  project: Lecture,
  track: TrackName,
  asset: string,
  seconds: number,
  time: number,
  newId: NewId,
): string | undefined {
  if (!(seconds > MIN_CLIP) || project.scenes.length === 0) return undefined;
  const clip: TrackClip = { id: newId(), asset, scene: '', offset: 0, from: 0, to: seconds };
  fasten(project, clip, time);
  if (!clip.scene) return undefined;
  tracksOf(project)[track].push(clip);
  return clip.id;
}

/** Moves a clip so that it starts `time` seconds into the lecture. */
export function moveTrackClip(project: Lecture, clipId: string, time: number): void {
  const found = findTrackClip(project, clipId);
  if (found) fasten(project, found.clip, time);
}

/**
 * Moves the start or the end of a clip to `time` (in the lecture). What is
 * cut off is not lost: the edge can be drawn out again, as far as the file
 * goes.
 */
export function trimTrackClip(
  project: Lecture,
  clipId: string,
  edge: 'start' | 'end',
  time: number,
): void {
  const found = findTrackClip(project, clipId);
  const start = found && clipStart(project, found.clip);
  if (!found || start === undefined) return;
  const { clip } = found;
  const whole = assetSeconds(project.assets[clip.asset]) || clip.to;
  if (edge === 'end') {
    clip.to = Math.max(clip.from + MIN_CLIP, Math.min(whole, clip.from + (time - start)));
  } else {
    // The start moves in the lecture and in the file by the same amount.
    const delta = Math.max(
      -clip.from,
      -start,
      Math.min(clip.to - clip.from - MIN_CLIP, time - start),
    );
    clip.from += delta;
    fasten(project, clip, start + delta);
  }
  clampFades(clip);
}

/** Divides a clip in two at `time` (in the lecture). Returns the id of the second part. */
export function splitTrackClip(
  project: Lecture,
  clipId: string,
  time: number,
  newId: NewId,
): string | undefined {
  const found = findTrackClip(project, clipId);
  const start = found && clipStart(project, found.clip);
  if (!found || start === undefined) return undefined;
  const { clip, track, index } = found;
  const into = time - start;
  if (into < MIN_CLIP || into > trackClipDuration(clip) - MIN_CLIP) return undefined;
  const second: TrackClip = { ...clip, id: newId(), from: clip.from + into };
  delete second.fadeIn;
  clip.to = clip.from + into;
  delete clip.fadeOut;
  fasten(project, second, time);
  clampFades(clip);
  clampFades(second);
  project.tracks![track].splice(index + 1, 0, second);
  return second.id;
}

export function removeTrackClip(project: Lecture, clipId: string): void {
  const found = findTrackClip(project, clipId);
  if (!found) return;
  project.tracks![found.track].splice(found.index, 1);
  tidy(project);
}

function clampFades(clip: TrackClip): void {
  const length = trackClipDuration(clip);
  const fit = (value: number | undefined): number | undefined => {
    const fade = Math.max(0, Math.min(MAX_FADE, length, value ?? 0));
    return fade < 0.005 ? undefined : fade;
  };
  const fadeIn = fit(clip.fadeIn);
  const fadeOut = fit(clip.fadeOut);
  if (fadeIn === undefined) delete clip.fadeIn;
  else clip.fadeIn = fadeIn;
  if (fadeOut === undefined) delete clip.fadeOut;
  else clip.fadeOut = fadeOut;
}

/** Sets the loudness change (decibels) and the fades (seconds) of a clip. */
export function setTrackClip(
  project: Lecture,
  clipId: string,
  change: { gain?: number; fadeIn?: number; fadeOut?: number },
): void {
  const clip = findTrackClip(project, clipId)?.clip;
  if (!clip) return;
  if (change.gain !== undefined) {
    const gain = Math.max(GAIN_DB.min, Math.min(GAIN_DB.max, change.gain));
    if (Math.abs(gain) < 0.05) delete clip.gain;
    else clip.gain = gain;
  }
  if (change.fadeIn !== undefined) clip.fadeIn = change.fadeIn;
  if (change.fadeOut !== undefined) clip.fadeOut = change.fadeOut;
  clampFades(clip);
}

/**
 * Before a slide is removed: clips fastened to it are fastened to the slide
 * that takes its place (or, for the last slide, the one before it), so the
 * music is not lost with the slide.
 */
export function releaseScene(project: Lecture, sceneId: string): void {
  const tracks = project.tracks;
  if (!tracks) return;
  const index = project.scenes.findIndex((s) => s.id === sceneId);
  if (index < 0) return;
  const next = project.scenes[index + 1];
  const previous = project.scenes[index - 1];
  for (const track of TRACK_NAMES) {
    tracks[track] = tracks[track].filter((clip) => {
      if (clip.scene !== sceneId) return true;
      if (next) {
        clip.scene = next.id;
        clip.offset = 0;
        return true;
      }
      if (previous) {
        clip.scene = previous.id;
        clip.offset = Math.max(0, Math.min(clip.offset, sceneDuration(previous) - MIN_CLIP));
        return true;
      }
      return false;
    });
  }
  tidy(project);
}

/** The shortest a slide can be made by drawing its edge: its sound up to the last pause. */
export function leastSceneLength(scene: Pick<Scene, 'audio'>): number {
  const clips = scene.audio?.clips ?? [];
  const last = clips[clips.length - 1];
  const body = trackDuration(scene.audio) - (last?.kind === 'pause' ? clipDuration(last) : 0);
  return Math.max(body, 0.5);
}

/**
 * Makes a slide stand for `seconds`, by the pause at its end: the pause is
 * made longer or shorter, put in or taken away. What is said is never cut;
 * the slide cannot be made shorter than that.
 */
export function setSceneLength(scene: Pick<Scene, 'audio'>, seconds: number, newId: NewId): void {
  const least = leastSceneLength(scene);
  const want = Math.max(least, seconds);
  if (!scene.audio) scene.audio = { clips: [] };
  const clips = scene.audio.clips;
  const last = clips[clips.length - 1];
  const body = trackDuration(scene.audio) - (last?.kind === 'pause' ? clipDuration(last) : 0);
  const pause = want - body;
  if (last?.kind === 'pause') {
    if (pause < MIN_PAUSE) clips.pop();
    else last.duration = pause;
  } else if (pause >= MIN_PAUSE) {
    clips.push({ id: newId(), kind: 'pause', duration: pause });
  }
  if (clips.length === 0 && scene.audio.gain === undefined) delete scene.audio;
}
