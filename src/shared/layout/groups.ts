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
  for (const el of members) {
    const ends = joins(el);
    if (ends.length === 0) continue;
    const at = Math.max(...ends.map((id) => place.get(id) ?? 0));
    steps[at]!.push(el.id);
  }
  for (const targets of steps) scene.timeline.push(newStep(targets));
}

// ---------- Lines fastened to elements ----------

/** True when a line can be fastened to the element. */
export function canFasten(el: Element): boolean {
  // The frame of a figure with a form shows nothing; a line is fastened to its parts.
  return el.type !== 'mark' && el.type !== 'legend' && el.type !== 'figure' && !isLine(el);
}

/** An element that fills most of the slide lies behind the rest; an end let go on it is not fastened. */
// Both shapes of stage, lying and upright, have the same area.
function isBackground(el: Element): boolean {
  const stage = stageFor('landscape');
  return el.box.w * el.box.h >= stage.width * stage.height * BACKGROUND_SHARE;
}

/** Where a line or an arrow starts and ends. The head of an arrow is at its end. */
export function lineEnds(el: Pick<ShapeElement, 'box' | 'flipH' | 'flipV'>): {
  start: Point;
  end: Point;
} {
  const { x, y, w, h } = el.box;
  return {
    start: { x: el.flipH ? x + w : x, y: el.flipV ? y + h : y },
    end: { x: el.flipH ? x : x + w, y: el.flipV ? y : y + h },
  };
}

/** Lays a line between two points. A box always has some width and height, so a line is never quite upright. */
export function setLineEnds(el: ShapeElement, start: Point, end: Point): void {
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

/** True when a point lies on the element's box. */
function covers(el: Element, p: Point): boolean {
  const mid = centre(el.box);
  const local = turn({ x: p.x - mid.x, y: p.y - mid.y }, -el.box.rotation);
  return Math.abs(local.x) <= el.box.w / 2 && Math.abs(local.y) <= el.box.h / 2;
}

/** The element an end of a line is fastened to when it is let go at a point: the one in front there. */
export function fastenTargetAt(
  scene: Pick<Scene, 'elements'>,
  p: Point,
  lineId: string,
): Element | undefined {
  for (let i = scene.elements.length - 1; i >= 0; i--) {
    const el = scene.elements[i]!;
    if (el.id !== lineId && canFasten(el) && !isBackground(el) && covers(el, p)) return el;
  }
  return undefined;
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
 *   cannot be fastened to, is let go there and lies where it lay;
 * - a fastened end is put on the edge of what it is fastened to, on the
 *   side that faces the line's other end. With both ends fastened the line
 *   runs between the two elements, the way their middles lie.
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

  let byId: Map<string, Element> | undefined;
  for (const el of scene.elements) {
    if (el.type !== 'shape' || (el.startAt === undefined && el.endAt === undefined)) continue;
    byId ??= new Map(scene.elements.map((e) => [e.id, e]));
    const target = (id: string | undefined): Element | undefined => {
      const found = id === undefined ? undefined : byId!.get(id);
      return found && found.id !== el.id && canFasten(found) ? found : undefined;
    };
    const from = isLine(el) ? target(el.startAt) : undefined;
    let to = isLine(el) ? target(el.endAt) : undefined;
    // A line does not run from an element to itself.
    if (from && to && from.id === to.id) to = undefined;
    if (!from && el.startAt !== undefined) {
      delete el.startAt;
      changed = true;
    }
    if (!to && el.endAt !== undefined) {
      delete el.endAt;
      changed = true;
    }
    if (!from && !to) continue;
    const now = lineEnds(el);
    const start = from ? edgePoint(from, to ? centre(to.box) : now.end) : now.start;
    const end = to ? edgePoint(to, from ? centre(from.box) : now.start) : now.end;
    if (near(start, now.start) && near(end, now.end) && el.box.rotation === 0) continue;
    setLineEnds(el, start, end);
    changed = true;
  }
  return changed;
}

/**
 * A line that is moved by itself is let go from what it was fastened to;
 * one that is moved together with what it is fastened to stays fastened.
 */
export function letGoMoved(scene: Pick<Scene, 'elements'>, moved: readonly string[]): void {
  for (const el of scene.elements) {
    if (!isLine(el) || !moved.includes(el.id)) continue;
    if (el.startAt !== undefined && !moved.includes(el.startAt)) delete el.startAt;
    if (el.endAt !== undefined && !moved.includes(el.endAt)) delete el.endAt;
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
