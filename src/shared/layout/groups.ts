// Free figures: elements that are grouped, and lines and arrows whose ends
// are fastened to other elements. A grouped element is still an element of
// its own (so it can come in at a step and have "Lær mer" content), and a
// fastened line is still an ordinary line with a box: what is drawn, in the
// editor, the HTML player and the video, never looks at groups or at what a
// line is fastened to. The functions here keep the boxes right. They change
// the slide they are given.
import { stageFor } from '../format/constants';
import type { Box, Element, Scene, ShapeElement, Step } from '../format/schema';
import { stepStands } from './steps';

type Figured = Pick<Scene, 'elements' | 'timeline'>;
export interface Point {
  x: number;
  y: number;
}

/** How far from the edge of an element a fastened end stops, in stage pixels. */
export const LINE_GAP = 6;
/** An element that covers more of the slide than this is a background, not something a line is fastened to. */
const BACKGROUND_SHARE = 0.5;

export function isLine(el: Element): el is ShapeElement {
  return el.type === 'shape' && (el.geometry === 'line' || el.geometry === 'arrow');
}

// ---------- Groups ----------

/** Marks and legends belong to their picture; they are never members of a group themselves. */
function canBeGrouped(el: Element): boolean {
  return el.type !== 'mark' && el.type !== 'legend';
}

/** The members of a group, back to front. */
export function membersOf(scene: Pick<Scene, 'elements'>, group: string): Element[] {
  return scene.elements.filter((el) => el.group === group);
}

/** The ids given, and those of everything grouped with them, back to front. */
export function withGroups(scene: Pick<Scene, 'elements'>, ids: readonly string[]): string[] {
  const chosen = new Set(ids);
  const groups = new Set<string>();
  for (const el of scene.elements) if (chosen.has(el.id) && el.group) groups.add(el.group);
  return scene.elements
    .filter((el) => chosen.has(el.id) || (el.group !== undefined && groups.has(el.group)))
    .map((el) => el.id);
}

/**
 * The group that the ids are exactly the whole of, when they are that.
 * Marks and legends of grouped pictures may be among the ids or not.
 */
export function wholeGroup(
  scene: Pick<Scene, 'elements'>,
  ids: readonly string[],
): string | undefined {
  const chosen = scene.elements.filter((el) => ids.includes(el.id) && canBeGrouped(el));
  const group = chosen[0]?.group;
  if (!group || chosen.some((el) => el.group !== group)) return undefined;
  return membersOf(scene, group).length === chosen.length ? group : undefined;
}

/** True when the ids can be made into a group: at least two elements that are not one group already. */
export function canGroup(scene: Pick<Scene, 'elements'>, ids: readonly string[]): boolean {
  const all = withGroups(scene, ids);
  const members = scene.elements.filter((el) => all.includes(el.id) && canBeGrouped(el));
  return members.length >= 2 && wholeGroup(scene, all) === undefined;
}

/**
 * Makes one group of the elements, and of everything they were grouped with
 * before (groups do not lie inside groups). Returns the ids of its members.
 */
export function groupElements(
  scene: Pick<Scene, 'elements'>,
  ids: readonly string[],
  newId: () => string,
): string[] {
  if (!canGroup(scene, ids)) return [];
  const all = new Set(withGroups(scene, ids));
  const group = newId();
  const members: string[] = [];
  for (const el of scene.elements) {
    if (!all.has(el.id) || !canBeGrouped(el)) continue;
    el.group = group;
    members.push(el.id);
  }
  return members;
}

/** Breaks up every group that one of the elements is a member of. */
export function ungroupElements(scene: Pick<Scene, 'elements'>, ids: readonly string[]): void {
  const all = new Set(withGroups(scene, ids));
  for (const el of scene.elements) if (all.has(el.id)) delete el.group;
}

/**
 * One step for each part of a group, in reading order. A line or an arrow
 * that is fastened comes in together with the last of what it joins, so a
 * box and the arrow that leads to it arrive as one. Other steps stay.
 */
export function stepPerPart(
  scene: Figured,
  group: string,
  newStep: (targets: string[]) => Step,
): void {
  // The frame of a figure with a form shows nothing, so it has no step.
  const members = membersOf(scene, group).filter((el) => el.type !== 'figure');
  const ids = new Set(members.map((el) => el.id));
  for (const step of scene.timeline) {
    step.actions = step.actions.filter((action) => !ids.has(action.target));
  }
  scene.timeline = scene.timeline.filter(stepStands);
  const joins = (el: Element): string[] =>
    isLine(el) ? [el.startAt, el.endAt].filter((id): id is string => !!id && ids.has(id)) : [];
  const own = members
    .filter((el) => joins(el).length === 0)
    .sort((a, b) => (Math.abs(a.box.y - b.box.y) > 40 ? a.box.y - b.box.y : a.box.x - b.box.x));
  const steps = own.map((el) => [el.id]);
  const place = new Map(own.map((el, index) => [el.id, index]));
  // A line fastened to another line comes in with what that line comes in with.
  const byId = new Map(members.map((el) => [el.id, el]));
  const stepOfLine = (el: Element, seen: Set<string>): number => {
    if (place.has(el.id)) return place.get(el.id)!;
    if (seen.has(el.id)) return 0;
    seen.add(el.id);
    const at = Math.max(0, ...joins(el).map((id) => stepOfLine(byId.get(id)!, seen)));
    place.set(el.id, at);
    return at;
  };
  for (const el of members) {
    if (joins(el).length === 0) continue;
    const at = Math.max(0, Math.min(stepOfLine(el, new Set()), steps.length - 1));
    (steps[at] ??= []).push(el.id);
  }
  for (const targets of steps) scene.timeline.push(newStep(targets));
}

// ---------- The path of a line ----------

/** The four fastening points of a box: the middle of each side. */
export type Side = 'top' | 'right' | 'bottom' | 'left';
export const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];

type Pathed = Pick<ShapeElement, 'box' | 'flipH' | 'flipV' | 'points'>;

/** The points a line or an arrow runs through as fractions of its box, when it has them. */
function ownPoints(el: Pick<ShapeElement, 'points'>): Array<[number, number]> {
  const points = (el.points ?? []).filter((p): p is [number, number] => p !== null);
  return points.length >= 2 ? points : [];
}

/** True when a line or an arrow runs through points of its own, not only along the diagonal of its box. */
export function hasPath(el: Pick<ShapeElement, 'points'>): boolean {
  return ownPoints(el).length >= 2;
}

/**
 * The points a line or an arrow runs through, in stage pixels, from its
 * start to its end. A line without points of its own is the diagonal of
 * its box. The head of an arrow is at the last point.
 */
export function linePath(el: Pathed): Point[] {
  const { x, y, w, h } = el.box;
  const own = ownPoints(el);
  // To a hundredth of a pixel: what a fraction loses is far less, so a point stays where it was put.
  const exact = (value: number): number => Math.round(value * 100) / 100;
  if (own.length >= 2) return own.map(([fx, fy]) => ({ x: exact(x + fx * w), y: exact(y + fy * h) }));
  return [
    { x: el.flipH ? x + w : x, y: el.flipV ? y + h : y },
    { x: el.flipH ? x : x + w, y: el.flipV ? y : y + h },
  ];
}

/**
 * The path as it is drawn: a straight line that lies flat or stands upright
 * has a box one pixel thin, and is drawn through the middle of that pixel.
 * Where a line begins to bend, it bends from there.
 */
export function drawnPath(el: Pathed): Point[] {
  const path = linePath(el);
  if (hasPath(el)) return path;
  const { x, y, w, h } = el.box;
  return path.map((p) => ({ x: w <= 1 ? x + w / 2 : p.x, y: h <= 1 ? y + h / 2 : p.y }));
}

/** Where a line or an arrow starts and ends. The head of an arrow is at its end. */
export function lineEnds(el: Pathed): { start: Point; end: Point } {
  const path = linePath(el);
  return { start: path[0]!, end: path[path.length - 1]! };
}

/** Lays a line between two points. A box always has some width and height, so a line is never quite upright. */
export function setLineEnds(el: ShapeElement, start: Point, end: Point): void {
  delete el.points;
  el.box = {
    x: Math.round(Math.min(start.x, end.x)),
    y: Math.round(Math.min(start.y, end.y)),
    w: Math.max(1, Math.round(Math.abs(end.x - start.x))),
    h: Math.max(1, Math.round(Math.abs(end.y - start.y))),
    rotation: 0,
  };
  if (start.x > end.x) el.flipH = true;
  else delete el.flipH;
  if (start.y > end.y) el.flipV = true;
  else delete el.flipV;
}

/**
 * Lays a line through the points given, from its start to its end. With
 * two points it is the diagonal of its box, as every line was before it
 * could bend (whose corners are whole pixels); with more, the box is the smallest that holds them all (in
 * whole pixels) and the points are stored as fractions of it, so they stand
 * exactly where they were given.
 */
export function setLinePath(
  el: ShapeElement,
  path: readonly Point[],
  /** Two points are stored as points too, so that the ends lie exactly where they are given. */
  exact = false,
): void {
  if (path.length < 2) return;
  if (path.length === 2 && !exact) {
    setLineEnds(el, path[0]!, path[1]!);
    return;
  }
  const xs = path.map((p) => p.x);
  const ys = path.map((p) => p.y);
  const x = Math.floor(Math.min(...xs));
  const y = Math.floor(Math.min(...ys));
  const w = Math.max(1, Math.ceil(Math.max(...xs)) - x);
  const h = Math.max(1, Math.ceil(Math.max(...ys)) - y);
  const share = (value: number): number => Math.round(value * 1e6) / 1e6;
  el.box = { x, y, w, h, rotation: 0 };
  el.points = path.map((p) => [share((p.x - x) / w), share((p.y - y) / h)]);
  delete el.flipH;
  delete el.flipV;
}

/** How long a path is, in stage pixels. */
export function pathLength(path: readonly Point[]): number {
  let length = 0;
  for (let i = 1; i < path.length; i++) {
    length += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
  }
  return length;
}

/** The point that lies the share `t` (0 to 1) of the way along a path, by length. */
export function pointAlong(path: readonly Point[], t: number): Point {
  const total = pathLength(path);
  if (total <= 0 || path.length < 2) return { ...path[0]! };
  let left = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const piece = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= piece || i === path.length - 1) {
      const k = piece > 0 ? Math.min(1, left / piece) : 0;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    left -= piece;
  }
  return { ...path[path.length - 1]! };
}

/** The share of the way along a path, by length, at which one of its own points lies. */
export function shareAt(path: readonly Point[], index: number): number {
  const total = pathLength(path);
  return total > 0 ? pathLength(path.slice(0, index + 1)) / total : 0;
}

export interface OnPath {
  /** The nearest point on the path. */
  point: Point;
  /** How far along the path it lies, by length (0 to 1). */
  along: number;
  /** The stretch it lies on: between point `segment` and the next. */
  segment: number;
  distance: number;
}

/** The point on a path that lies nearest to `p`. */
export function nearestOnPath(path: readonly Point[], p: Point): OnPath {
  const total = pathLength(path);
  let best: OnPath = {
    point: { ...path[0]! },
    along: 0,
    segment: 0,
    distance: Math.hypot(p.x - path[0]!.x, p.y - path[0]!.y),
  };
  let before = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const piece2 = dx * dx + dy * dy;
    const k = piece2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / piece2)) : 0;
    const q = { x: a.x + dx * k, y: a.y + dy * k };
    const distance = Math.hypot(p.x - q.x, p.y - q.y);
    if (distance < best.distance) {
      best = {
        point: q,
        along: total > 0 ? (before + Math.sqrt(piece2) * k) / total : 0,
        segment: i - 1,
        distance,
      };
    }
    before += Math.sqrt(piece2);
  }
  return best;
}

// ---------- Lines fastened to elements, and to other lines ----------

/** True when a line can be fastened to the element (the box itself; lines are fastened to lines by `canFastenToLine`). */
export function canFasten(el: Element): boolean {
  // The frame of a figure with a form shows nothing; a line is fastened to its parts.
  return el.type !== 'mark' && el.type !== 'legend' && el.type !== 'figure' && !isLine(el);
}

/** An element that fills most of the slide lies behind the rest; an end let go on it is not fastened. */
// Both shapes of stage, lying and upright, have the same area.
export function isBackground(el: Element): boolean {
  const stage = stageFor('landscape');
  return el.box.w * el.box.h >= stage.width * stage.height * BACKGROUND_SHARE;
}

function centre(box: Box): Point {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

function turn(p: Point, degrees: number): Point {
  const a = (degrees * Math.PI) / 180;
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
}

/**
 * The point on the edge of an element (a little outside it) that lies on
 * the way from its middle towards another point. An ellipse has a round
 * edge; everything else has that of its box.
 */
export function edgePoint(el: Element, toward: Point, gap = LINE_GAP): Point {
  const mid = centre(el.box);
  const d = turn({ x: toward.x - mid.x, y: toward.y - mid.y }, -el.box.rotation);
  const a = el.box.w / 2 + gap;
  const b = el.box.h / 2 + gap;
  if (Math.abs(d.x) < 1e-6 && Math.abs(d.y) < 1e-6) return { x: mid.x, y: mid.y - b };
  const k =
    el.type === 'shape' && el.geometry === 'ellipse'
      ? 1 / Math.sqrt((d.x / a) ** 2 + (d.y / b) ** 2)
      : Math.min(
          Math.abs(d.x) < 1e-6 ? Infinity : a / Math.abs(d.x),
          Math.abs(d.y) < 1e-6 ? Infinity : b / Math.abs(d.y),
        );
  const out = turn({ x: d.x * k, y: d.y * k }, el.box.rotation);
  return { x: mid.x + out.x, y: mid.y + out.y };
}

/**
 * A fastening point of an element: the middle of one of its sides, `gap`
 * outside it (a fastened end stops that far from the edge), turned with it.
 */
export function sidePoint(el: Pick<Element, 'box'>, side: Side, gap = LINE_GAP): Point {
  const { w, h, rotation } = el.box;
  const mid = centre(el.box);
  const local =
    side === 'top'
      ? { x: 0, y: -(h / 2 + gap) }
      : side === 'bottom'
        ? { x: 0, y: h / 2 + gap }
        : side === 'left'
          ? { x: -(w / 2 + gap), y: 0 }
          : { x: w / 2 + gap, y: 0 };
  const out = turn(local, rotation);
  return { x: mid.x + out.x, y: mid.y + out.y };
}

/** True when a point lies on the element's box. */
export function covers(el: Pick<Element, 'box'>, p: Point, margin = 0): boolean {
  const mid = centre(el.box);
  const local = turn({ x: p.x - mid.x, y: p.y - mid.y }, -el.box.rotation);
  return (
    Math.abs(local.x) <= el.box.w / 2 + margin && Math.abs(local.y) <= el.box.h / 2 + margin
  );
}

/** The element an end of a line is fastened to when it is let go at a point: the one in front there. */
export function fastenTargetAt(
  scene: Pick<Scene, 'elements'>,
  p: Point,
  lineId: string,
  /** How far outside its box an element still counts as under the point. */
  margin = 0,
): Element | undefined {
  for (let i = scene.elements.length - 1; i >= 0; i--) {
    const el = scene.elements[i]!;
    if (el.id !== lineId && canFasten(el) && !isBackground(el) && covers(el, p, margin)) return el;
  }
  return undefined;
}

type End = 'start' | 'end';
const AT = { start: 'startAt', end: 'endAt' } as const;
const SIDE = { start: 'startSide', end: 'endSide' } as const;
const ALONG = { start: 'startAlong', end: 'endAlong' } as const;

/** Lets one end of a line go: it is fastened to nothing, and lies where it lies. */
export function letGoEnd(el: ShapeElement, end: End): boolean {
  let changed = false;
  for (const key of [AT[end], SIDE[end], ALONG[end]]) {
    if (el[key] !== undefined) {
      delete el[key];
      changed = true;
    }
  }
  return changed;
}

/** Where an end of a line is to be fastened: to an element, at one of its fastening points or by itself, or to a line, so far along it. */
export interface Fastening {
  at: string;
  side?: Side;
  along?: number;
}

/** Fastens one end of a line as given, or lets it go (`null`). */
export function fastenEnd(el: ShapeElement, end: End, to: Fastening | null): void {
  letGoEnd(el, end);
  if (!to) return;
  el[AT[end]] = to.at;
  if (to.side) el[SIDE[end]] = to.side;
  if (to.along !== undefined) el[ALONG[end]] = Math.max(0, Math.min(1, to.along));
}

/** The lines a line is fastened to, by their ids. */
function lineTargets(el: ShapeElement, byId: ReadonlyMap<string, Element>): string[] {
  return [el.startAt, el.endAt].filter((id): id is string => {
    const target = id === undefined ? undefined : byId.get(id);
    return target !== undefined && target.id !== el.id && isLine(target);
  });
}

/**
 * True when an end of the line can be fastened to the other line: it is
 * not the line itself, and that line is not fastened to this one, directly
 * or through others (an end that would close such a ring is not fastened).
 */
export function canFastenToLine(
  scene: Pick<Scene, 'elements'>,
  lineId: string,
  targetId: string,
): boolean {
  if (lineId === targetId) return false;
  const byId = new Map(scene.elements.map((el) => [el.id, el]));
  const target = byId.get(targetId);
  if (!target || !isLine(target)) return false;
  const seen = new Set<string>();
  const queue = [targetId];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (id === lineId) return false;
    if (seen.has(id)) continue;
    seen.add(id);
    const el = byId.get(id);
    if (el && isLine(el)) queue.push(...lineTargets(el, byId));
  }
  return true;
}

function near(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= 1.5 && Math.abs(a.y - b.y) <= 1.5;
}

/**
 * Keeps groups and fastened lines right. Called after every change to a slide:
 *
 * - a group with fewer than two members is no group, and marks and legends
 *   are not members of one;
 * - a line that was fastened to something that is gone, or that a line
 *   cannot be fastened to, is let go there and lies where it lay; so is an
 *   end that would close a ring of lines fastened to each other;
 * - an end fastened to a fastening point of an element lies there; one
 *   fastened to the element by itself lies on its edge, on the side that
 *   faces the line's next point (for a straight line, its other end; with
 *   both ends fastened so, the line runs between the two elements, the way
 *   their middles lie);
 * - an end fastened to another line lies on it, as far along it as it
 *   says. Lines that others are fastened to are laid first.
 *
 * The points between the ends of a line stay where they are.
 *
 * Returns true when anything was changed.
 */
export function followFigures(scene: Pick<Scene, 'elements'>): boolean {
  let changed = false;
  const grouped = scene.elements.some((el) => el.group !== undefined);
  if (grouped) {
    const count = new Map<string, number>();
    for (const el of scene.elements) {
      if (el.group && canBeGrouped(el)) count.set(el.group, (count.get(el.group) ?? 0) + 1);
    }
    for (const el of scene.elements) {
      if (el.group && (!canBeGrouped(el) || (count.get(el.group) ?? 0) < 2)) {
        delete el.group;
        changed = true;
      }
    }
  }

  const fastened = scene.elements.filter(
    (el): el is ShapeElement =>
      el.type === 'shape' &&
      (['start', 'end'] as const).some(
        (end) => el[AT[end]] !== undefined || el[SIDE[end]] !== undefined || el[ALONG[end]] !== undefined,
      ),
  );
  if (fastened.length === 0) return changed;
  const byId = new Map(scene.elements.map((e) => [e.id, e]));

  // What each end is fastened to, when it can be.
  for (const el of fastened) {
    for (const end of ['start', 'end'] as const) {
      const id = el[AT[end]];
      const found = id === undefined ? undefined : byId.get(id);
      const ok =
        isLine(el) && found && found.id !== el.id && (canFasten(found) || isLine(found));
      if (!ok || !found) {
        if (letGoEnd(el, end)) changed = true;
        continue;
      }
      if (isLine(found)) {
        if (el[SIDE[end]] !== undefined) {
          delete el[SIDE[end]];
          changed = true;
        }
        const along = el[ALONG[end]];
        if (along === undefined || along < 0 || along > 1) {
          // Fastened to a line without saying where: where the end lies now.
          const here = end === 'start' ? lineEnds(el).start : lineEnds(el).end;
          el[ALONG[end]] =
            along === undefined
              ? nearestOnPath(linePath(found), here).along
              : Math.max(0, Math.min(1, along));
          changed = true;
        }
      } else if (el[ALONG[end]] !== undefined) {
        delete el[ALONG[end]];
        changed = true;
      }
    }
    // A line does not run from an element to itself (it may run from a line back to the same line).
    const from = el.startAt === undefined ? undefined : byId.get(el.startAt);
    if (from && el.startAt === el.endAt && !isLine(from)) {
      if (letGoEnd(el, 'end')) changed = true;
    }
  }

  // Lines fastened to lines: a ring is broken where it closes, and the
  // lines that others are fastened to come first.
  const order: ShapeElement[] = [];
  const state = new Map<string, 'busy' | 'done'>();
  const visit = (el: ShapeElement): void => {
    state.set(el.id, 'busy');
    for (const end of ['start', 'end'] as const) {
      const id = el[AT[end]];
      const target = id === undefined ? undefined : byId.get(id);
      if (!target || !isLine(target)) continue;
      if (state.get(target.id) === 'busy') {
        if (letGoEnd(el, end)) changed = true;
      } else if (!state.has(target.id)) visit(target);
    }
    state.set(el.id, 'done');
    order.push(el);
  };
  for (const el of fastened) if (!state.has(el.id)) visit(el);

  for (const el of order) {
    if (!isLine(el)) continue;
    const from = el.startAt === undefined ? undefined : byId.get(el.startAt);
    const to = el.endAt === undefined ? undefined : byId.get(el.endAt);
    if (!from && !to) continue;
    const path = linePath(el);
    const n = path.length;
    // Where an end must lie, when that does not depend on the rest of the line.
    const fixed = (end: End, target: Element | undefined): Point | undefined => {
      if (!target) return undefined;
      if (isLine(target)) return pointAlong(linePath(target), el[ALONG[end]] ?? 0.5);
      const side = el[SIDE[end]];
      return side ? sidePoint(target, side) : undefined;
    };
    const startFixed = fixed('start', from);
    const endFixed = fixed('end', to);
    // An end on a line lies exactly on it, not on the nearest whole pixel.
    const exact = (!!from && isLine(from)) || (!!to && isLine(to));
    const start = !from
      ? path[0]!
      : (startFixed ??
        edgePoint(from, n > 2 ? path[1]! : (endFixed ?? (to ? centre(to.box) : path[n - 1]!))));
    const end = !to
      ? path[n - 1]!
      : (endFixed ??
        edgePoint(to, n > 2 ? path[n - 2]! : (startFixed ?? (from ? centre(from.box) : path[0]!))));
    const still = near(start, path[0]!) && near(end, path[n - 1]!) && el.box.rotation === 0;
    if (still && (!exact || hasPath(el))) continue;
    setLinePath(el, [start, ...path.slice(1, n - 1), end], exact);
    changed = true;
  }
  return changed;
}

/**
 * A line that is moved by itself is let go from what it was fastened to;
 * one that is moved together with what it is fastened to stays fastened,
 * with its points.
 */
export function letGoMoved(scene: Pick<Scene, 'elements'>, moved: readonly string[]): void {
  for (const el of scene.elements) {
    if (!isLine(el) || !moved.includes(el.id)) continue;
    if (el.startAt !== undefined && !moved.includes(el.startAt)) letGoEnd(el, 'start');
    if (el.endAt !== undefined && !moved.includes(el.endAt)) letGoEnd(el, 'end');
  }
}

/**
 * Puts an arrow between two elements, fastened at both ends, and returns
 * it. When the two are in the same group, the arrow joins it.
 */
export function connect(
  scene: Pick<Scene, 'elements'>,
  fromId: string,
  toId: string,
  newId: () => string,
): ShapeElement | null {
  const from = scene.elements.find((el) => el.id === fromId);
  const to = scene.elements.find((el) => el.id === toId);
  if (!from || !to || from.id === to.id || !canFasten(from) || !canFasten(to)) return null;
  const arrow: ShapeElement = {
    id: newId(),
    type: 'shape',
    geometry: 'arrow',
    startAt: from.id,
    endAt: to.id,
    box: { x: 0, y: 0, w: 1, h: 1, rotation: 0 },
    ...(from.group && from.group === to.group ? { group: from.group } : {}),
  };
  setLineEnds(arrow, edgePoint(from, centre(to.box)), edgePoint(to, centre(from.box)));
  scene.elements.push(arrow);
  return arrow;
}

/**
 * Where an end or a point of a line is put when it is dragged to `p`, and
 * what that shows. In this order, it snaps to:
 * 1. a fastening point of an element it comes near (an end let go
 *    elsewhere on the element is fastened to it by itself);
 * 2. another line: its own points and ends first, otherwise anywhere along
 *    it (an end is fastened there);
 * 3. straight across or straight up from the point before or after it;
 * 4. the lines of the grid given.
 * Only ends are fastened; a point between them only snaps to places.
 */
export interface PathSnap {
  point: Point;
  /** For an end: what it is fastened to when let go here, or null when it is let go. */
  fasten: Fastening | null;
  /** The element whose fastening points are shown, and the one that is taken. */
  box?: { id: string; chosen?: Side };
  /** The line that is lit, and the place on it. */
  line?: { id: string; at: Point };
  /** Thin guides from the point before or after it. */
  guides: Array<{ from: Point; to: Point }>;
  /** Lines of the grid it lies on. */
  grid: { x?: number; y?: number };
}

export function snapPathPoint(
  scene: Pick<Scene, 'elements'>,
  lineId: string,
  /** The path of the line as it is, and which of its points is dragged. */
  path: readonly Point[],
  index: number,
  p: Point,
  options: {
    /** How near, in stage pixels, a place must be to be snapped to. */
    reach: number;
    grid?: { x: readonly number[]; y: readonly number[] };
  },
): PathSnap {
  const isEnd = index === 0 || index === path.length - 1;
  const { reach } = options;
  const result: PathSnap = { point: { ...p }, fasten: null, guides: [], grid: {} };

  // 1. The fastening points of an element it comes near.
  const box = fastenTargetAt(scene, p, lineId, reach * 2);
  if (box) {
    let chosen: Side | undefined;
    let best = reach;
    for (const side of SIDES) {
      const at = sidePoint(box, side, 0);
      const distance = Math.hypot(p.x - at.x, p.y - at.y);
      if (distance <= best) {
        best = distance;
        chosen = side;
      }
    }
    result.box = { id: box.id, ...(chosen ? { chosen } : {}) };
    if (chosen) {
      result.point = sidePoint(box, chosen);
      if (isEnd) result.fasten = { at: box.id, side: chosen };
      return result;
    }
    if (covers(box, p)) {
      if (isEnd) result.fasten = { at: box.id };
      return result;
    }
  }

  // 2. Another line: its own points first, otherwise along it.
  let found: { id: string; at: Point; along: number; distance: number } | undefined;
  for (let i = scene.elements.length - 1; i >= 0; i--) {
    const other = scene.elements[i]!;
    if (!isLine(other) || other.id === lineId) continue;
    if (isEnd && !canFastenToLine(scene, lineId, other.id)) continue;
    const otherPath = linePath(other);
    for (let k = 0; k < otherPath.length; k++) {
      const q = otherPath[k]!;
      const distance = Math.hypot(p.x - q.x, p.y - q.y);
      // A point counts for more than a place between points, so lines meet in a point.
      if (distance <= reach * 1.5 && (!found || distance - reach < found.distance)) {
        found = { id: other.id, at: q, along: shareAt(otherPath, k), distance: distance - reach };
      }
    }
    const on = nearestOnPath(otherPath, p);
    if (on.distance <= reach && (!found || on.distance < found.distance)) {
      found = { id: other.id, at: on.point, along: on.along, distance: on.distance };
    }
  }
  if (found) {
    result.point = { ...found.at };
    result.line = { id: found.id, at: found.at };
    if (isEnd) result.fasten = { at: found.id, along: found.along };
    return result;
  }

  // 3. Straight across or straight up from the points beside it.
  const point = result.point;
  let snappedX = false;
  let snappedY = false;
  for (const k of [index - 1, index + 1]) {
    const nb = path[k];
    if (!nb) continue;
    if (!snappedX && Math.abs(point.x - nb.x) <= reach) {
      point.x = nb.x;
      snappedX = true;
      result.guides.push({ from: nb, to: point });
    } else if (!snappedY && Math.abs(point.y - nb.y) <= reach) {
      point.y = nb.y;
      snappedY = true;
      result.guides.push({ from: nb, to: point });
    }
  }
  // The guides end where the point ends.
  result.guides = result.guides.map((guide) => ({ from: guide.from, to: { ...point } }));

  // 4. The grid.
  if (options.grid) {
    if (!snappedX) {
      const x = nearestValue(point.x, options.grid.x, reach);
      if (x !== undefined) {
        point.x = x;
        result.grid.x = x;
      }
    }
    if (!snappedY) {
      const y = nearestValue(point.y, options.grid.y, reach);
      if (y !== undefined) {
        point.y = y;
        result.grid.y = y;
      }
    }
  }
  return result;
}

function nearestValue(value: number, targets: readonly number[], reach: number): number | undefined {
  let best: number | undefined;
  for (const target of targets) {
    if (Math.abs(target - value) <= reach && (best === undefined || Math.abs(target - value) < Math.abs(best - value))) {
      best = target;
    }
  }
  return best;
}

/** Puts a new point on a line where it is nearest to `p`. Returns the index of the new point. */
export function addPathPoint(el: ShapeElement, p: Point): number {
  const path = drawnPath(el);
  const on = nearestOnPath(path, p);
  const at = { x: Math.round(on.point.x * 100) / 100, y: Math.round(on.point.y * 100) / 100 };
  path.splice(on.segment + 1, 0, at);
  setLinePath(el, path);
  return on.segment + 1;
}

/** Takes a point between the ends of a line away. */
export function removePathPoint(el: ShapeElement, index: number): void {
  const path = linePath(el);
  if (index <= 0 || index >= path.length - 1) return;
  path.splice(index, 1);
  setLinePath(el, path);
}

/** Takes every point between the ends of a line away: it runs straight from its start to its end. */
export function straighten(el: ShapeElement): void {
  const { start, end } = lineEnds(el);
  setLineEnds(el, start, end);
}

// ---------- Resizing several elements as one ----------

/** The smallest upright box that holds all the boxes. */
export function unionBox(boxes: readonly Box[]): Box {
  const corners = boxes.flatMap((box) => {
    const mid = centre(box);
    return [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([sx, sy]) => {
      const p = turn({ x: (sx! * box.w) / 2, y: (sy! * box.h) / 2 }, box.rotation);
      return { x: mid.x + p.x, y: mid.y + p.y };
    });
  });
  const x = Math.min(...corners.map((p) => p.x));
  const y = Math.min(...corners.map((p) => p.y));
  return {
    x,
    y,
    w: Math.max(1, Math.max(...corners.map((p) => p.x)) - x),
    h: Math.max(1, Math.max(...corners.map((p) => p.y)) - y),
    rotation: 0,
  };
}

/**
 * A box as it becomes when the frame round several boxes is changed from
 * one upright box to another: it keeps its place and its share of the frame.
 */
export function scaleInto(box: Box, from: Box, to: Box): Box {
  const kx = to.w / from.w;
  const ky = to.h / from.h;
  const mid = centre(box);
  const w = Math.max(1, Math.round(box.w * kx));
  const h = Math.max(1, Math.round(box.h * ky));
  return {
    x: Math.round(to.x + (mid.x - from.x) * kx - w / 2),
    y: Math.round(to.y + (mid.y - from.y) * ky - h / 2),
    w,
    h,
    rotation: box.rotation,
  };
}
