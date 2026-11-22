// What is visible at a given point in a scene's timeline. Pure functions:
// the same inputs always give the same state, with no clock involved.
import type { Scene, Step } from '../format/schema';

/** Seconds a step needs before everything in it has arrived. */
export function stepDuration(step: Step): number {
  let longest = 0;
  for (const action of step.actions) {
    longest = Math.max(longest, (action.delay ?? 0) + action.duration);
  }
  return longest;
}

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

/**
 * Opacity (0..1) of every element that takes part in the timeline.
 * `stepsShown` is how many steps have been triggered; `elapsed` is seconds
 * since the latest of them was triggered (Infinity = settled). Elements
 * that are not in the returned map are always fully visible.
 */
export function sceneState(scene: Scene, stepsShown: number, elapsed: number): Map<string, number> {
  const state = new Map<string, number>();
  scene.timeline.forEach((step, index) => {
    for (const action of step.actions) {
      if (state.has(action.target)) continue; // the first step that brings it in decides
      let opacity: number;
      if (index >= stepsShown) {
        opacity = 0;
      } else if (index < stepsShown - 1) {
        opacity = 1;
      } else {
        const t = elapsed - (action.delay ?? 0);
        if (t < 0) opacity = 0;
        else if (action.effect === 'appear' || action.duration <= 0) opacity = 1;
        else opacity = easeOutCubic(Math.min(1, t / action.duration));
      }
      state.set(action.target, opacity);
    }
  });
  return state;
}

/** How far below its place (in stage pixels) an element starts when it glides in. */
export const STEP_RISE = 28;

/**
 * Applies a state to a rendered scene. An element that is on its way in is
 * partly see-through and glides up the last bit to its place.
 */
export function applySceneState(sceneEl: Element, state: Map<string, number>): void {
  for (const el of Array.from(sceneEl.querySelectorAll<HTMLElement>('[data-el]'))) {
    const opacity = state.get(el.dataset.el!);
    if (opacity === undefined || opacity >= 1) {
      el.style.opacity = '';
      el.style.visibility = '';
      el.style.translate = '';
      el.removeAttribute('aria-hidden');
    } else if (opacity <= 0) {
      el.style.opacity = '0';
      el.style.visibility = 'hidden';
      el.style.translate = '';
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.style.opacity = String(opacity);
      el.style.visibility = '';
      // "translate" is its own property, so an element that is turned keeps its turn.
      el.style.translate = `0 ${((1 - opacity) * STEP_RISE).toFixed(2)}px`;
      el.removeAttribute('aria-hidden');
    }
  }
}

/** Removes references to elements that no longer exist, and empty steps. */
export function pruneTimeline(scene: Scene): void {
  const ids = new Set(scene.elements.map((e) => e.id));
  for (const step of scene.timeline) {
    step.actions = step.actions.filter((a) => ids.has(a.target));
  }
  scene.timeline = scene.timeline.filter((s) => s.actions.length > 0);
}
