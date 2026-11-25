// Counting slides the way the lecturer does, and saying where the chapters
// are. A slide that is shown once more in a recording (a "repeat", see
// repeats.ts) is a scene of its own in the list, but it is not a slide of
// its own to the lecturer or the student: it has no number, and nobody
// goes to it by hand. Nothing here needs the validation library, so the
// HTML player can use it.
import type { Scene } from '../format/schema';

export function isRepeat(scene: Pick<Scene, 'repeat'>): boolean {
  return scene.repeat !== undefined;
}

/**
 * The number the lecturer knows each slide by, from 1. A repeat has the
 * number of the slide it repeats (0 when that slide is gone).
 */
export function slideNumbers(scenes: ReadonlyArray<Pick<Scene, 'id' | 'repeat'>>): number[] {
  const numbers = new Map<string, number>();
  let count = 0;
  for (const scene of scenes) if (!scene.repeat) numbers.set(scene.id, ++count);
  return scenes.map((scene) => numbers.get(scene.repeat ? scene.repeat.of : scene.id) ?? 0);
}

/** How many slides the lecture has, repeats not counted. */
export function slideCount(scenes: ReadonlyArray<Pick<Scene, 'repeat'>>): number {
  return scenes.reduce((n, scene) => n + (scene.repeat ? 0 : 1), 0);
}

/**
 * The index of the slide itself: for a repeat, the slide it repeats; -1
 * when there is none.
 */
export function ownIndex(
  scenes: ReadonlyArray<Pick<Scene, 'id' | 'repeat'>>,
  index: number,
): number {
  const scene = scenes[index];
  if (!scene) return -1;
  if (!scene.repeat) return index;
  const of = scene.repeat.of;
  return scenes.findIndex((s) => !s.repeat && s.id === of);
}

/**
 * Where a stretch of slides ends when it is to hold the slides numbered
 * `from` to `to` (as the lecturer counts, from 1): the indexes of the first
 * and the last scene, the repeats that follow the last slide included.
 * Undefined when the numbers do not name slides.
 */
export function slideSpan(
  scenes: ReadonlyArray<Pick<Scene, 'repeat'>>,
  from: number,
  to: number,
): [number, number] | undefined {
  let count = 0;
  let first = -1;
  let last = -1;
  scenes.forEach((scene, index) => {
    if (!scene.repeat) count += 1;
    if (count === from && first < 0 && !scene.repeat) first = index;
    if (count >= from && count <= to && first >= 0) last = index;
  });
  return first >= 0 && last >= first && to >= from ? [first, last] : undefined;
}

// ---------- Chapters ----------

export interface Chapter {
  /** Its name; empty for the slides before the first chapter. */
  name: string;
  /** Index of its first scene, and of its last (repeats included). */
  first: number;
  last: number;
}

/**
 * The chapters of the lecture, in order. Slides before the first chapter
 * are a stretch without a name. An empty list when no slide starts a chapter.
 */
export function chapters(scenes: ReadonlyArray<Pick<Scene, 'chapter' | 'repeat'>>): Chapter[] {
  if (!scenes.some((scene) => !scene.repeat && scene.chapter !== undefined)) return [];
  const list: Chapter[] = [];
  scenes.forEach((scene, index) => {
    const starts = !scene.repeat && scene.chapter !== undefined;
    if (starts || list.length === 0) {
      list.push({ name: starts ? scene.chapter! : '', first: index, last: index });
    } else {
      list[list.length - 1]!.last = index;
    }
  });
  return list;
}
