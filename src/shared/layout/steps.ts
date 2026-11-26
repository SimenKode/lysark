// What the steps of a slide do: which movement suits an element that comes
// in, how fast it is, and the steps that mark, take away and zoom (the
// owner's choices, 26.11.2026). Types only from the project format: the HTML
// player uses this file, and it must not bring the format's checking code
// into the exported file.
import type { Element, Scene, Step, StepAction, StepEffect, StepKind } from '../format/schema';
import { stageFor, type Stage } from '../format/constants';

/** What a step does: brings something in, when it says nothing else. */
export function stepKind(step: Pick<Step, 'kind'>): StepKind {
  return step.kind ?? 'show';
}

/** A step with nothing in it is taken away, except one that zooms: it has no elements. */
export function stepStands(step: Pick<Step, 'kind' | 'actions'>): boolean {
  return step.actions.length > 0 || step.kind === 'zoom';
}

function isStroke(el: Element): boolean {
  return (
    el.type === 'shape' &&
    (el.geometry === 'line' || el.geometry === 'arrow' || el.geometry === 'curve')
  );
}

function textOf(el: Element): string {
  if (el.type !== 'text') return '';
  return el.content.paragraphs.map((p) => p.runs.map((run) => run.text).join('')).join('\n');
}

/** True when the element is a text with a number in it, which can count up. */
function hasNumber(el: Element): boolean {
  return /\d/.test(textOf(el));
}

/** The movements an element can be given: a line can be drawn, a number can count up. */
export function effectsFor(el: Element): StepEffect[] {
  return [
    'fade',
    'slide',
    'grow',
    ...(isStroke(el) ? (['draw'] as const) : []),
    ...(hasNumber(el) ? (['count'] as const) : []),
    'appear',
  ];
}

/**
 * The movement the program proposes for an element that comes in: a line,
 * an arrow or a curve is drawn, a bar of a diagram grows from the axis, a
 * large number counts up, and anything else tones in.
 */
export function proposedEffect(el: Element): StepEffect {
  if (isStroke(el)) return 'draw';
  if (el.of?.part.startsWith('bar:')) return 'grow';
  if (el.type === 'text' && el.role === 'number' && hasNumber(el)) return 'count';
  return 'fade';
}

/** How many seconds each movement takes at the ordinary speed. */
export const EFFECT_SECONDS: Record<StepEffect, number> = {
  appear: 0,
  fade: 0.4,
  slide: 0.5,
  grow: 0.6,
  draw: 0.8,
  count: 1,
};

export const SPEEDS = ['fast', 'normal', 'slow'] as const;
export type Speed = (typeof SPEEDS)[number];
const SPEED_FACTOR: Record<Speed, number> = { fast: 0.5, normal: 1, slow: 2 };

export function effectSeconds(effect: StepEffect, speed: Speed = 'normal'): number {
  return Number((EFFECT_SECONDS[effect] * SPEED_FACTOR[speed]).toFixed(3));
}

/** How fast a movement is, from how long it takes. */
export function speedOf(action: Pick<StepAction, 'effect' | 'duration'>): Speed {
  const ordinary = EFFECT_SECONDS[action.effect];
  if (ordinary <= 0) return 'normal';
  const ratio = action.duration / ordinary;
  return ratio < 0.75 ? 'fast' : ratio > 1.5 ? 'slow' : 'normal';
}

/** How an element comes in when nothing else is said: as the program proposes, at the ordinary speed. */
export function proposedAction(el: Element): StepAction {
  const effect = proposedEffect(el);
  return { target: el.id, effect, duration: effectSeconds(effect) };
}

/** A new step that brings the elements in, each with the movement that suits it. */
export function showStep(
  scene: Pick<Scene, 'elements'>,
  targets: readonly string[],
  id: string,
): Step {
  const byId = new Map(scene.elements.map((el) => [el.id, el]));
  return {
    id,
    actions: targets.flatMap((target) => {
      const el = byId.get(target);
      return el ? [proposedAction(el)] : [];
    }),
  };
}

// ---------- Steps that mark, take away and zoom ----------

/** How many seconds marking and taking away take, and a zoom, at the ordinary speed. */
export const MARK_SECONDS = 0.4;
export const HIDE_SECONDS = 0.4;
export const ZOOM_SECONDS = 0.9;

export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The whole of a slide on a stage. */
export function wholeView(stage: Stage): View {
  return { x: 0, y: 0, w: stage.width, h: stage.height };
}

/** The whole of a lying slide. Code that works on a project uses `wholeView`. */
export const WHOLE: View = wholeView(stageFor('landscape'));

/** The smallest part of the slide a zoom may show: a fifth of its width. */
export function smallestView(stage: Stage): number {
  return stage.width / 5;
}

/**
 * A part of the slide in the shape of the slide, inside the slide: as wide
 * as asked for (within what is allowed), round the same middle where that
 * is possible.
 */
export function fitView(wanted: View, stage: Stage = stageFor('landscape')): View {
  const w = Math.max(smallestView(stage), Math.min(stage.width, wanted.w));
  const h = (w * stage.height) / stage.width;
  const midX = wanted.x + wanted.w / 2;
  const midY = wanted.y + wanted.h / 2;
  return {
    x: Math.round(Math.max(0, Math.min(stage.width - w, midX - w / 2))),
    y: Math.round(Math.max(0, Math.min(stage.height - h, midY - h / 2))),
    w: Math.round(w),
    h: Math.round(h),
  };
}

/** The part of the slide that holds the boxes, with air round them, in the shape of the slide. */
export function viewAround(
  boxes: ReadonlyArray<{ x: number; y: number; w: number; h: number }>,
  stage: Stage = stageFor('landscape'),
): View {
  if (boxes.length === 0)
    return fitView({ x: stage.width / 4, y: stage.height / 4, w: stage.width / 2, h: 1 }, stage);
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  const air = 60;
  // Wide enough for the width, and for the height at the shape of the slide.
  const w = Math.max(
    right - left + 2 * air,
    ((bottom - top + 2 * air) * stage.width) / stage.height,
  );
  return fitView({ x: (left + right) / 2 - w / 2, y: (top + bottom) / 2, w, h: 0 }, stage);
}

/** True when the zoom that is in force after the steps before `index` shows only a part of the slide. */
export function zoomedBefore(timeline: readonly Step[], index: number): boolean {
  let zoomed = false;
  for (const step of timeline.slice(0, index)) {
    if (step.kind === 'zoom') zoomed = step.zoom !== undefined;
  }
  return zoomed;
}

/** How many seconds a step that marks, takes away or zooms takes. */
export function stepSeconds(step: Pick<Step, 'kind' | 'actions' | 'seconds'>): number {
  if (step.kind === 'zoom') return step.seconds ?? ZOOM_SECONDS;
  return step.actions[0]?.duration ?? (step.kind === 'mark' ? MARK_SECONDS : HIDE_SECONDS);
}

/** How fast a step is: for one that brings elements in, how fast the first that moves is. */
export function stepSpeed(step: Step): Speed {
  if (stepKind(step) === 'show') {
    const moving = step.actions.find((action) => EFFECT_SECONDS[action.effect] > 0);
    return moving ? speedOf(moving) : 'normal';
  }
  const ordinary =
    step.kind === 'zoom' ? ZOOM_SECONDS : step.kind === 'mark' ? MARK_SECONDS : HIDE_SECONDS;
  const ratio = stepSeconds(step) / ordinary;
  return ratio < 0.75 ? 'fast' : ratio > 1.5 ? 'slow' : 'normal';
}

/** Makes everything a step does go fast, at the ordinary speed, or slowly. */
export function setStepSpeed(step: Step, speed: Speed): void {
  const factor = SPEED_FACTOR[speed];
  if (step.kind === 'zoom') {
    step.seconds = Number((ZOOM_SECONDS * factor).toFixed(3));
    return;
  }
  for (const action of step.actions) {
    action.duration =
      stepKind(step) === 'show'
        ? effectSeconds(action.effect, speed)
        : Number(((step.kind === 'mark' ? MARK_SECONDS : HIDE_SECONDS) * factor).toFixed(3));
  }
}
