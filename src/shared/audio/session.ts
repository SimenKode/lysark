// Putting a recording into the lecture. A recording is a film of what the
// lecturer did: the slides in the order they were shown, back and forth,
// each for as long as it was shown. Here that row of takes becomes sound on
// the slides, and slides that are shown once more ("repeats") where the
// lecturer went back. The function changes the project it is given (the
// editor calls it on a draft, so a whole recording is one undo step).
import type { CameraPlace, Project, Scene, SceneEvent } from '../format/schema';
import { cameraPlaceAt, trackDuration } from '../render/clock';
import { continueSound, replaceSound } from './edit';
import { releaseScene } from './tracks';

type Lecture = Pick<Project, 'scenes' | 'tracks' | 'assets'>;

/** One stretch of a recording: a slide, from the lecturer came to it until they left it. */
export interface Take {
  /** The slide that was shown (never a repeat). */
  scene: string;
  /** The sound of the stretch (an asset of the project), and its length. */
  asset: string;
  seconds: number;
  /** The steps that were already on the slide when the lecturer came to it. */
  shown: string[];
  /** When each further step was shown, in seconds from the start of the stretch. */
  stepAts: Record<string, number>;
  /** What was opened, played and moved meanwhile. */
  events: SceneEvent[];
  /** Where the camera circle stood when the stretch began, when it was filmed. */
  camera?: CameraPlace;
  /**
   * The first stretch of a recording that goes on from a point in the
   * slide's sound: the sound before this time is kept.
   */
  keepBefore?: number;
}

export interface Applied {
  /** The slide (or repeat) the recording ended on. */
  last?: string;
  /** How many slides got sound, and how many times a slide was shown once more. */
  slides: number;
  repeats: number;
}

/** Takes away the repeats that stand right after a slide. */
function removeFollowers(project: Lecture, index: number): void {
  while (project.scenes[index + 1]?.repeat) {
    releaseScene(project, project.scenes[index + 1]!.id);
    project.scenes.splice(index + 1, 1);
  }
}

/**
 * Puts a recording into the lecture.
 *
 * - A stretch on a slide further on than any slide of the recording so far
 *   is that slide's own sound; it takes the place of the sound the slide
 *   had. Steps the lecturer did not come to are not shown.
 * - A stretch on a slide the recording has already passed (the lecturer
 *   went back, or back one step) becomes a repeat: a slide of its own in
 *   the list, right after the stretch before it.
 * - Repeats from an earlier recording that stood after a slide are taken
 *   away when this recording went on from that slide: what follows it now
 *   is what the lecturer did this time.
 */
export function applyRecording(
  project: Lecture,
  takes: ReadonlyArray<Take>,
  newId: (prefix: string) => string,
): Applied {
  const clipId = (): string => newId('c');
  const applied: Applied = { slides: 0, repeats: 0 };
  /** How far the recording has come in the list, counted in slides. */
  let frontier = -1;
  /** The slide or repeat the stretch before this one became. */
  let cursor: string | undefined;
  takes.forEach((take, number) => {
    const index = project.scenes.findIndex((s) => s.id === take.scene && !s.repeat);
    const scene = project.scenes[index];
    if (!scene) return;
    const place = project.scenes.slice(0, index).filter((s) => !s.repeat).length;
    const shown = new Set(take.shown);

    if (cursor === undefined || place > frontier) {
      if (number < takes.length - 1) removeFollowers(project, index);
      const keep = take.keepBefore;
      const goesOn = keep !== undefined && keep > 0 && trackDuration(scene.audio) > 0;
      let events = take.events;
      if (take.camera) {
        if (goesOn && scene.camera) {
          // The part that is kept has its own place for the circle. Where the
          // new part starts with the circle somewhere else, that is a move.
          const was = cameraPlaceAt(scene, keep);
          if (Math.hypot(was.x - take.camera.x, was.y - take.camera.y) > 1) {
            events = [
              { id: newId('h'), at: 0, kind: 'camera-move', x: take.camera.x, y: take.camera.y },
              ...events,
            ];
          }
          scene.camera = { x: scene.camera.x, y: scene.camera.y, size: take.camera.size };
        } else {
          scene.camera = { ...take.camera };
        }
      }
      if (goesOn) {
        const pressed = scene.timeline.map((step) => take.stepAts[step.id]);
        continueSound(scene, keep, take.asset, take.seconds, pressed, clipId, events);
        // A step neither the kept part nor the new part came to is not shown.
        const end = trackDuration(scene.audio);
        for (const step of scene.timeline) if (step.at === undefined) step.at = end;
      } else {
        const times = scene.timeline.map((step) =>
          shown.has(step.id) ? 0 : (take.stepAts[step.id] ?? take.seconds),
        );
        replaceSound(scene, take.asset, take.seconds, times, clipId, events);
      }
      frontier = place;
      cursor = scene.id;
      applied.slides += 1;
      return;
    }

    const repeat: Scene = {
      id: newId('s'),
      title: scene.title,
      kind: scene.kind,
      ...(scene.background === undefined ? {} : { background: scene.background }),
      decoration: scene.decoration,
      shapeVariant: scene.shapeVariant,
      showLogo: scene.showLogo,
      elements: scene.elements,
      timeline: scene.timeline.map((step) => ({ id: step.id, actions: step.actions })),
      script: '',
      repeat: {
        of: scene.id,
        shown: scene.timeline.filter((step) => shown.has(step.id)).map((step) => step.id),
      },
      ...(take.camera ? { camera: { ...take.camera } } : {}),
    };
    // A step without a time is, on a repeat, one the lecturer did not come to.
    const times = repeat.timeline.map((step) => take.stepAts[step.id]);
    replaceSound(repeat, take.asset, take.seconds, times, clipId, take.events);
    const after = project.scenes.findIndex((s) => s.id === cursor);
    project.scenes.splice(after + 1, 0, repeat);
    cursor = repeat.id;
    applied.repeats += 1;
  });
  if (cursor !== undefined) applied.last = cursor;
  return applied;
}
