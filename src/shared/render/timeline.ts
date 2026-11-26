// What is visible at a given point in a scene's timeline, and how it moves.
// Pure functions: the same inputs always give the same state, with no clock
// involved.
import type { Scene, Step, StepEffect } from '../format/schema';
import { STAGE } from '../format/constants';
import { PALETTE } from '../theme/palette';
import {
  HIDE_SECONDS,
  MARK_SECONDS,
  WHOLE,
  ZOOM_SECONDS,
  stepKind,
  stepStands,
  type View,
} from '../layout/steps';

/** Seconds a step needs before everything in it has happened. */
export function stepDuration(step: Step): number {
  if (step.kind === 'zoom') return step.seconds ?? ZOOM_SECONDS;
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

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** How one element stands and moves at a moment. */
export interface Move {
  /** How far it has come in: 0 is not there, 1 is in its place. */
  shown: number;
  /** How it comes in. */
  effect: StepEffect;
  /** How far it has gone away again: 0 is there, 1 is gone. */
  gone: number;
  /** How strongly it is marked: 0 is not, 1 is fully. */
  marked: number;
}

export interface Moves {
  /** The elements that a step does something with. The others are there, unmarked. */
  elements: Map<string, Move>;
  /** The part of the slide that fills the picture. The whole slide when absent. */
  view: View | undefined;
}

/** How long a mark takes to go when the next step comes. */
const UNMARK_SECONDS = 0.25;

/** How far something that takes `seconds` has come, `since` seconds after it began. */
function progress(since: number, seconds: number): number {
  if (!(since >= 0)) return 0;
  if (since === Infinity || seconds <= 0) return 1;
  return Math.min(1, since / seconds);
}

/**
 * What the steps have done, when `since[i]` seconds have gone since step i
 * was triggered: negative for a step that has not come yet, Infinity for
 * one that is long done.
 *
 * - A step that brings an element in decides how it comes in; the first
 *   such step for an element decides, until a step has taken it away.
 * - A step that takes an element away lets it tone out. Without a step that
 *   brings it in, the element is there from the start.
 * - A step that marks an element marks it until the next step comes.
 * - A step that zooms lets the picture glide from what it showed to the
 *   part of the slide the step names.
 */
export function movesFrom(scene: Pick<Scene, 'timeline'>, since: readonly number[]): Moves {
  const elements = new Map<string, Move>();
  const entered = new Set<string>();
  /** Elements that a step earlier in the list takes away. */
  const taken = new Set<string>();
  const get = (id: string): Move => {
    let move = elements.get(id);
    if (!move) {
      move = { shown: 1, effect: 'appear', gone: 0, marked: 0 };
      elements.set(id, move);
    }
    return move;
  };
  let view: View = WHOLE;
  scene.timeline.forEach((step, index) => {
    const at = since[index] ?? -1;
    const kind = stepKind(step);
    if (kind === 'zoom') {
      const p = easeInOutCubic(progress(at, step.seconds ?? ZOOM_SECONDS));
      const to = step.zoom ?? WHOLE;
      view = {
        x: view.x + (to.x - view.x) * p,
        y: view.y + (to.y - view.y) * p,
        w: view.w + (to.w - view.w) * p,
        h: view.h + (to.h - view.h) * p,
      };
      return;
    }
    for (const action of step.actions) {
      const move = get(action.target);
      const local = at - (action.delay ?? 0);
      if (kind === 'show') {
        if (entered.has(action.target)) continue; // the first step that brings it in decides
        entered.add(action.target);
        const p =
          action.effect === 'appear'
            ? progress(local, 0)
            : easeOutCubic(progress(local, action.duration));
        if (taken.has(action.target)) {
          // A step before this one takes it away: it is as that step left it
          // (there, or gone) until this step comes and brings it in again.
          if (p <= 0) continue;
          move.gone = 0;
        }
        move.shown = p;
        move.effect = action.effect;
      } else if (kind === 'hide') {
        const p = easeOutCubic(progress(local, action.duration || HIDE_SECONDS));
        move.gone = Math.max(move.gone, p);
        taken.add(action.target);
        entered.delete(action.target); // a later step can bring it in again
      } else {
        const next = since[index + 1];
        const leaving = next === undefined ? 0 : progress(next, UNMARK_SECONDS);
        const p = easeOutCubic(progress(local, action.duration || MARK_SECONDS));
        move.marked = Math.max(move.marked, p * (1 - leaving));
      }
    }
  });
  const whole = view.w >= WHOLE.w - 0.01 && view.h >= WHOLE.h - 0.01;
  return { elements, view: whole ? undefined : view };
}

/** `since` for stepping by hand: the latest step runs, those before it are done. */
function sinceByHand(
  scene: Pick<Scene, 'timeline'>,
  stepsShown: number,
  elapsed: number,
): number[] {
  return scene.timeline.map((_, index) =>
    index >= stepsShown ? -1 : index < stepsShown - 1 ? Infinity : elapsed,
  );
}

/**
 * How the slide stands when `stepsShown` steps have been triggered, and
 * `elapsed` seconds have gone since the latest of them (Infinity = settled).
 */
export function sceneMoves(
  scene: Pick<Scene, 'timeline'>,
  stepsShown: number,
  elapsed: number,
): Moves {
  return movesFrom(scene, sinceByHand(scene, stepsShown, elapsed));
}

/** How visible each element in the moves is: 0 is not there, 1 is fully there. */
export function visibility(moves: Moves): Map<string, number> {
  const state = new Map<string, number>();
  for (const [id, move] of moves.elements) state.set(id, move.shown * (1 - move.gone));
  return state;
}

/**
 * Opacity (0..1) of every element that takes part in the timeline.
 * `stepsShown` is how many steps have been triggered; `elapsed` is seconds
 * since the latest of them was triggered (Infinity = settled). Elements
 * that are not in the returned map are always fully visible.
 */
export function sceneState(scene: Scene, stepsShown: number, elapsed: number): Map<string, number> {
  return visibility(sceneMoves(scene, stepsShown, elapsed));
}

/** How far below its place (in stage pixels) an element starts when it tones in. */
export const STEP_RISE = 28;
/** How far to the left of its place an element starts when it glides in. */
export const STEP_SLIDE = 160;
/** The colour of the frame round what is marked. */
const MARK_COLOR = PALETTE.oransje;

function withAlpha(color: string, alpha: number): string {
  const n = parseInt(color.slice(1), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${alpha.toFixed(3)})`;
}

/** The length of a line or of a line through many points, as it is drawn. */
function strokeLength(node: Element): number {
  if (node.tagName.toLowerCase() === 'line') {
    const n = (name: string): number => Number(node.getAttribute(name) ?? 0);
    return Math.hypot(n('x2') - n('x1'), n('y2') - n('y1'));
  }
  const points = (node.getAttribute('points') ?? '')
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number));
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i]![0]! - points[i - 1]![0]!, points[i]![1]! - points[i - 1]![1]!);
  }
  return length;
}

/**
 * Draws the lines of an element as far as `p` says (1 = all of it): each
 * line from its start, the head of an arrow when the line has reached it,
 * and each dot of a curve when the curve has reached it. Returns false when
 * the element has no line to draw.
 */
function drawStrokes(el: HTMLElement, p: number | undefined): boolean {
  const strokes = Array.from(
    el.querySelectorAll<SVGElement>('.ls-shape svg > line, .ls-shape svg > polyline'),
  );
  if (strokes.length === 0) return false;
  for (const stroke of strokes) {
    if (p === undefined) {
      stroke.style.strokeDasharray = '';
      stroke.style.strokeDashoffset = '';
    } else {
      const length = Math.max(1, strokeLength(stroke));
      stroke.style.strokeDasharray = `${length.toFixed(2)} ${length.toFixed(2)}`;
      stroke.style.strokeDashoffset = (length * (1 - p)).toFixed(2);
    }
    // The dots of this line, in the order the line reaches them.
    const dots: SVGElement[] = [];
    for (let next = stroke.nextElementSibling; next?.tagName.toLowerCase() === 'circle';) {
      dots.push(next as SVGElement);
      next = next.nextElementSibling;
    }
    dots.forEach((dot, i) => {
      const reached = dots.length > 1 ? i / (dots.length - 1) : 0;
      dot.style.opacity = p === undefined || p >= reached - 0.001 ? '' : '0';
    });
  }
  for (const head of Array.from(el.querySelectorAll<SVGElement>('.ls-shape svg > polygon'))) {
    head.style.opacity = p === undefined || p >= 0.92 ? '' : '0';
  }
  return true;
}

/** The first number in a text, with how it is written: its decimals and what parts its thousands. */
const NUMBER = /(\d[\d \u00a0\u202f]*\d|\d)([.,]\d+)?/;

/** A text with its first number counted up to the share `p` of what it says. */
export function countedText(text: string, p: number): string {
  const found = NUMBER.exec(text);
  if (!found) return text;
  const whole = found[1]!;
  const fraction = found[2] ?? '';
  const value = Number(
    whole.replace(/[ \u00a0\u202f]/g, '') + (fraction ? `.${fraction.slice(1)}` : ''),
  );
  if (!Number.isFinite(value)) return text;
  const decimals = Math.max(0, fraction.length - 1);
  const [counted, rest] = (value * p).toFixed(decimals).split('.') as [string, string | undefined];
  const gap = /[ \u00a0\u202f]/.exec(whole)?.[0];
  const grouped = gap ? counted.replace(/\B(?=(\d{3})+(?!\d))/g, gap) : counted;
  const written = grouped + (rest === undefined ? '' : fraction[0]! + rest);
  return text.slice(0, found.index) + written + text.slice(found.index + found[0].length);
}

/**
 * Lets the number in an element's text stand at the share `p` of what it
 * says; undefined puts the text back as it was written. Returns false when
 * the element has no number.
 */
function countNumber(el: HTMLElement, p: number | undefined): boolean {
  if (p === undefined && el.dataset.counts === undefined) return false;
  // The first piece of text with a number in it; counted, it still has one.
  const walker = el.ownerDocument.createTreeWalker(el, 4 /* text nodes */);
  let node = walker.nextNode();
  while (node && !NUMBER.test(node.nodeValue ?? '')) node = walker.nextNode();
  if (!node) return false;
  if (p === undefined) {
    node.nodeValue = el.dataset.counts!;
    delete el.dataset.counts;
    return true;
  }
  el.dataset.counts ??= node.nodeValue ?? '';
  node.nodeValue = countedText(el.dataset.counts, p);
  return true;
}

function clearMove(el: HTMLElement): void {
  el.style.opacity = '';
  el.style.visibility = '';
  el.style.translate = '';
  el.style.scale = '';
  el.style.transformOrigin = '';
  el.removeAttribute('aria-hidden');
  if (el.dataset.moved !== undefined) {
    drawStrokes(el, undefined);
    countNumber(el, undefined);
    delete el.dataset.moved;
  }
}

/**
 * Applies the moves to a rendered scene: what has not come is hidden, what
 * is on its way in moves as its step says, what is marked has a frame
 * round it, and the picture shows the part of the slide the zoom has come
 * to.
 */
export function applySceneMoves(sceneEl: Element, moves: Moves): void {
  for (const el of Array.from(sceneEl.querySelectorAll<HTMLElement>('[data-el], [data-follows]'))) {
    // A row of a legend follows its mark. What belongs to a picture (a mark,
    // a legend) is never more visible than the picture.
    const own = moves.elements.get(el.dataset.el ?? el.dataset.follows!);
    const host = el.dataset.on === undefined ? undefined : moves.elements.get(el.dataset.on);
    const level = (move: Move | undefined): number | undefined =>
      move === undefined ? undefined : move.shown * (1 - move.gone);
    const mine = level(own);
    const theirs = level(host);
    const opacity =
      mine === undefined ? theirs : theirs === undefined ? mine : Math.min(mine, theirs);

    // The frame round what is marked. It is an outline, so nothing moves for it.
    const marked = el.dataset.el === undefined ? 0 : (own?.marked ?? 0);
    if (marked > 0.001 && (opacity === undefined || opacity > 0)) {
      el.style.outline = `8px solid ${withAlpha(MARK_COLOR, marked)}`;
      el.style.outlineOffset = `${(6 + (1 - marked) * 14).toFixed(1)}px`;
      el.style.borderRadius = '10px';
      el.dataset.marked = '';
    } else if (el.dataset.marked !== undefined) {
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.borderRadius = '';
      delete el.dataset.marked;
    }

    if (opacity === undefined || opacity >= 1) {
      clearMove(el);
      continue;
    }
    if (opacity <= 0) {
      clearMove(el);
      el.style.opacity = '0';
      el.style.visibility = 'hidden';
      el.setAttribute('aria-hidden', 'true');
      continue;
    }
    // On its way in or out. Only an element that comes in by its own step
    // moves in its own way; one that goes, or follows another, only tones.
    const coming =
      own !== undefined && own.gone === 0 && mine === opacity && el.dataset.el !== undefined;
    const effect: StepEffect = coming ? own.effect : 'appear';
    const p = coming ? own.shown : opacity;
    el.style.visibility = '';
    el.removeAttribute('aria-hidden');
    el.style.translate = '';
    el.style.scale = '';
    el.style.transformOrigin = '';
    el.dataset.moved = '';
    if (effect === 'draw' && drawStrokes(el, p)) {
      el.style.opacity = '';
      continue;
    }
    if (effect === 'count' && countNumber(el, p)) {
      el.style.opacity = String(Math.min(1, p * 4));
      continue;
    }
    if (effect === 'slide') {
      el.style.opacity = String(Math.min(1, p * 1.6));
      // "translate" is its own property, so an element that is turned keeps its turn.
      el.style.translate = `${(-(1 - p) * STEP_SLIDE).toFixed(2)}px 0`;
    } else if (effect === 'grow') {
      el.style.opacity = String(Math.min(1, p * 4));
      const from = el.dataset.grows;
      if (from === 'bottom' || from === 'top') {
        // A bar grows from the axis it stands on, or hangs from.
        el.style.scale = `1 ${Math.max(0.001, p).toFixed(4)}`;
        el.style.transformOrigin = from === 'bottom' ? '50% 100%' : '50% 0';
      } else {
        el.style.scale = (0.6 + 0.4 * p).toFixed(4);
      }
    } else {
      el.style.opacity = String(opacity);
      // What goes away tones out where it stands; what comes glides up the last bit.
      if (!(own !== undefined && own.gone > 0)) {
        el.style.translate = `0 ${((1 - opacity) * STEP_RISE).toFixed(2)}px`;
      }
    }
  }

  // The zoom: everything on the slide is made larger round the part that is shown.
  const layer = sceneEl.querySelector<HTMLElement>(':scope > .ls-zoom');
  if (layer) {
    if (moves.view) {
      const k = STAGE.width / moves.view.w;
      layer.style.transform = `scale(${k.toFixed(5)}) translate(${(-moves.view.x).toFixed(2)}px, ${(-moves.view.y).toFixed(2)}px)`;
    } else {
      layer.style.transform = '';
    }
  }
}

/**
 * Applies a state of opacities to a rendered scene. An element that is on
 * its way in is partly see-through and glides up the last bit to its place.
 */
export function applySceneState(sceneEl: Element, state: Map<string, number>): void {
  const elements = new Map<string, Move>();
  for (const [id, opacity] of state) {
    elements.set(id, { shown: opacity, effect: 'fade', gone: 0, marked: 0 });
  }
  applySceneMoves(sceneEl, { elements, view: undefined });
}

/** Removes references to elements that no longer exist, and steps that are left with nothing. */
export function pruneTimeline(scene: Scene): void {
  const ids = new Set(scene.elements.map((e) => e.id));
  for (const step of scene.timeline) {
    step.actions = step.actions.filter((a) => ids.has(a.target));
  }
  scene.timeline = scene.timeline.filter(stepStands);
}
