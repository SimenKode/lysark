// Slides that are shown once more, and chapters. While recording, the
// lecturer moves freely: back to an earlier slide, on again, back one step.
// The recording is a film of what was done, so a slide can be shown several
// times. Each further showing is a slide of its own in the list (a
// "repeat"), standing where it happened, with its own sound and its own
// times; what it shows is always the slide it repeats. The functions here
// keep the two alike. Counting slides and chapters is in slides.ts.
import { releaseScene } from '../audio/tracks';
import type { Project, Scene, Step } from '../format/schema';

type Lecture = Pick<Project, 'scenes' | 'tracks' | 'assets'>;

/** The steps of a repeat: those of the slide it repeats, with the repeat's own times. */
function repeatSteps(repeat: Scene, of: Scene): { timeline: Step[]; shown: string[] } {
  const mine = new Map(repeat.timeline.map((step) => [step.id, step]));
  const shown = new Set(repeat.repeat?.shown ?? []);
  const timeline = of.timeline.map((step) => {
    const own = mine.get(step.id);
    // A step that was made after the recording was there, as far as the recording goes.
    if (!own) shown.add(step.id);
    if (
      own &&
      own.actions === step.actions &&
      own.kind === step.kind &&
      own.zoom === step.zoom &&
      own.seconds === step.seconds
    ) {
      return own;
    }
    // What the step does is the slide's; when it happens is the repeat's own.
    const { at: _at, ...does } = step;
    return { ...does, ...(own?.at === undefined ? {} : { at: own.at }) };
  });
  const ids = new Set(of.timeline.map((step) => step.id));
  const kept = of.timeline.filter((step) => shown.has(step.id) && ids.has(step.id));
  return { timeline, shown: kept.map((step) => step.id) };
}

function sameList<T>(a: ReadonlyArray<T>, b: ReadonlyArray<T>): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Makes every repeat show what its slide shows now, and takes away repeats
 * whose slide is gone (music fastened to them moves to a neighbour). The
 * project is not changed: a new one is returned when something had to be
 * done, the same one otherwise. The editor calls this after every change.
 */
export function followRepeats<P extends Lecture>(project: P): P {
  if (!project.scenes.some((scene) => scene.repeat)) return project;
  const own = new Map(project.scenes.filter((s) => !s.repeat).map((s) => [s.id, s]));
  let lecture = project;
  const orphans = project.scenes.filter((s) => s.repeat && !own.has(s.repeat.of));
  if (orphans.length > 0) {
    const copy = {
      ...project,
      scenes: [...project.scenes],
      ...(project.tracks ? { tracks: structuredClone(project.tracks) } : {}),
    };
    for (const orphan of orphans) {
      releaseScene(copy, orphan.id);
      copy.scenes = copy.scenes.filter((scene) => scene.id !== orphan.id);
    }
    lecture = copy;
  }
  let changed = lecture !== project;
  const scenes = lecture.scenes.map((scene) => {
    if (!scene.repeat) return scene;
    const of = own.get(scene.repeat.of)!;
    const steps = repeatSteps(scene, of);
    const timeline = sameList(steps.timeline, scene.timeline) ? scene.timeline : steps.timeline;
    const shown = sameList(steps.shown, scene.repeat.shown) ? scene.repeat.shown : steps.shown;
    if (
      scene.elements === of.elements &&
      timeline === scene.timeline &&
      shown === scene.repeat.shown &&
      scene.title === of.title &&
      scene.kind === of.kind &&
      scene.background === of.background &&
      scene.decoration === of.decoration &&
      scene.shapeVariant === of.shapeVariant &&
      scene.showLogo === of.showLogo &&
      scene.chapter === undefined &&
      scene.closingAnimation === undefined
    ) {
      return scene;
    }
    changed = true;
    const next: Scene = {
      ...scene,
      title: of.title,
      kind: of.kind,
      decoration: of.decoration,
      shapeVariant: of.shapeVariant,
      showLogo: of.showLogo,
      elements: of.elements,
      timeline,
      repeat: { of: of.id, shown },
    };
    if (of.background === undefined) delete next.background;
    else next.background = of.background;
    // A chapter begins on a slide, never on its repeat; and the closing film
    // is played where the closing slide itself stands.
    delete next.chapter;
    delete next.closingAnimation;
    return next;
  });
  return changed ? { ...lecture, scenes } : project;
}

/**
 * Before a slide is removed: the chapter that begins on it begins on the
 * next slide instead, unless that slide begins a chapter itself.
 */
export function handOnChapter(scenes: Scene[], index: number): void {
  const scene = scenes[index];
  if (!scene || scene.repeat || scene.chapter === undefined) return;
  for (let i = index + 1; i < scenes.length; i++) {
    const next = scenes[i]!;
    if (next.repeat) continue;
    if (next.chapter === undefined) next.chapter = scene.chapter;
    return;
  }
}
