// Marks on a picture: numbered points with a legend, or labels with a line
// to what they point at. A mark is an element of its own (so it can come in
// at a step and have "Lær mer" content), but it belongs to a picture. The
// functions here keep the two together. They change the slide they are given.
import { stageFor, type Stage } from '../format/constants';
import type {
  Box,
  Element,
  ImageElement,
  LegendElement,
  MarkElement,
  MarkStyle,
  Scene,
} from '../format/schema';
import { stepStands } from './steps';

/** How wide a numbered mark is, in stage pixels. */
export const MARK_SIZE = 52;
/** The size a new label starts with. */
export const LABEL_SIZE = { w: 260, h: 56 } as const;
/** The size a new legend starts with: wide enough for a few words per mark. */
const LEGEND_WIDTH = 420;
const LEGEND_ROW = 50;
const GAP = 32;

type Marked = Pick<Scene, 'elements' | 'timeline'>;

export function isMark(el: Element): el is MarkElement {
  return el.type === 'mark';
}

/** The marks of a picture, in the order they are numbered. */
export function marksOf(scene: Pick<Scene, 'elements'>, imageId: string): MarkElement[] {
  return scene.elements.filter((el): el is MarkElement => el.type === 'mark' && el.on === imageId);
}

/** The legend of a picture, if it has one. */
export function legendOf(
  scene: Pick<Scene, 'elements'>,
  imageId: string,
): LegendElement | undefined {
  return scene.elements.find(
    (el): el is LegendElement => el.type === 'legend' && el.on === imageId,
  );
}

/** The picture a mark or a legend belongs to. */
export function pictureOf(
  scene: Pick<Scene, 'elements'>,
  el: MarkElement | LegendElement,
): ImageElement | undefined {
  return scene.elements.find((e): e is ImageElement => e.type === 'image' && e.id === el.on);
}

export function markStyle(image: ImageElement | undefined): MarkStyle {
  return image?.marks ?? 'numbers';
}

/** The number a mark has on its picture, counted from 1. */
export function markNumber(scene: Pick<Scene, 'elements'>, mark: MarkElement): number {
  return marksOf(scene, mark.on).findIndex((m) => m.id === mark.id) + 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function anchorOf(box: Box): MarkElement['anchor'] {
  return { x: box.x, y: box.y, w: box.w, h: box.h };
}

function sameBox(a: MarkElement['anchor'], b: Box): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/** The box of a numbered mark whose middle is at a point. */
function numberBox(point: { x: number; y: number }): Box {
  return {
    x: point.x - MARK_SIZE / 2,
    y: point.y - MARK_SIZE / 2,
    w: MARK_SIZE,
    h: MARK_SIZE,
    rotation: 0,
  };
}

/**
 * Where the label of a point is put at first: beside the picture, on the
 * side the point is nearest. When there is no room there, on the other
 * side; a label is not laid on top of the picture as long as it can be helped.
 */
function labelBoxFor(stage: Stage, image: Box, point: { x: number; y: number }): Box {
  const after = image.x + image.w + GAP;
  const before = image.x - GAP - LABEL_SIZE.w;
  const fits = (x: number): boolean => x >= 0 && x + LABEL_SIZE.w <= stage.width;
  const right = point.x >= image.x + image.w / 2;
  const [first, second] = right ? [after, before] : [before, after];
  const x = fits(first) || !fits(second) ? first : second;
  return {
    x: clamp(x, 0, stage.width - LABEL_SIZE.w),
    y: clamp(point.y - LABEL_SIZE.h / 2, 0, stage.height - LABEL_SIZE.h),
    w: LABEL_SIZE.w,
    h: LABEL_SIZE.h,
    rotation: 0,
  };
}

/** Where a new legend is put: beside the picture when there is room, otherwise under it. */
function legendBoxFor(stage: Stage, image: Box, marks: number): Box {
  const h = Math.max(LEGEND_ROW, marks * LEGEND_ROW);
  const beside = image.x + image.w + GAP + LEGEND_WIDTH <= stage.width;
  if (beside) {
    return { x: image.x + image.w + GAP, y: image.y, w: LEGEND_WIDTH, h, rotation: 0 };
  }
  const before = image.x - GAP - LEGEND_WIDTH >= 0;
  if (before) {
    return { x: image.x - GAP - LEGEND_WIDTH, y: image.y, w: LEGEND_WIDTH, h, rotation: 0 };
  }
  return {
    x: image.x,
    y: clamp(image.y + image.h + GAP, 0, stage.height - h),
    w: Math.min(image.w, stage.width - image.x),
    h,
    rotation: 0,
  };
}

/**
 * Keeps marks and legends with their pictures. Called after every change to
 * a slide:
 *
 * - a mark or a legend whose picture is gone goes too;
 * - a mark lies in front of its picture;
 * - when a picture has been moved or resized, what its marks point at is
 *   moved the same way, and each mark's own box is worked out from that
 *   anew (so it does not matter whether the mark was moved along with the
 *   picture or left behind); a legend is put as far from the picture as it
 *   lay;
 * - when only the mark was moved, that is where it now is;
 * - a numbered mark keeps its size, and what a mark points at stays on the
 *   picture.
 *
 * Returns true when anything was changed.
 */
export function followMarks(scene: Marked): boolean {
  if (!scene.elements.some((el) => el.type === 'mark' || el.type === 'legend')) return false;
  let changed = false;
  const pictures = new Map<string, ImageElement>();
  for (const el of scene.elements) if (el.type === 'image') pictures.set(el.id, el);

  const kept = scene.elements.filter(
    (el) => !((el.type === 'mark' || el.type === 'legend') && !pictures.has(el.on)),
  );
  if (kept.length !== scene.elements.length) {
    scene.elements = kept;
    const ids = new Set(kept.map((el) => el.id));
    for (const step of scene.timeline) {
      step.actions = step.actions.filter((action) => ids.has(action.target));
    }
    scene.timeline = scene.timeline.filter(stepStands);
    changed = true;
  }

  // A picture that has been brought to the front takes its marks with it.
  const order = new Map(scene.elements.map((el, index) => [el.id, index]));
  const behind = scene.elements.some(
    (el) => el.type === 'mark' && order.get(el.id)! < order.get(el.on)!,
  );
  if (behind) {
    const late = new Map<string, Element[]>();
    const rest: Element[] = [];
    for (const el of scene.elements) {
      if (el.type === 'mark' && order.get(el.id)! < order.get(el.on)!) {
        late.set(el.on, [...(late.get(el.on) ?? []), el]);
      } else rest.push(el);
    }
    scene.elements = rest.flatMap((el) => [el, ...(late.get(el.id) ?? [])]);
    changed = true;
  }

  const set = (el: MarkElement, box: Box): void => {
    const b = el.box;
    if (b.x === box.x && b.y === box.y && b.w === box.w && b.h === box.h && b.rotation === 0) {
      return;
    }
    el.box = box;
    changed = true;
  };
  const middle = (box: Box): { x: number; y: number } => ({
    x: box.x + box.w / 2,
    y: box.y + box.h / 2,
  });
  for (const el of scene.elements) {
    if (el.type !== 'mark') continue;
    const image = pictures.get(el.on)!;
    const numbers = markStyle(image) === 'numbers';
    const onPicture = (p: { x: number; y: number }): { x: number; y: number } => ({
      x: clamp(p.x, image.box.x, image.box.x + image.box.w),
      y: clamp(p.y, image.box.y, image.box.y + image.box.h),
    });
    let point = el.point;
    if (!sameBox(el.anchor, image.box)) {
      // The picture has another box than when the mark was placed: the same
      // change is made to what the mark points at, and the mark follows.
      const from = el.anchor;
      const kx = from.w > 0 ? image.box.w / from.w : 1;
      const ky = from.h > 0 ? image.box.h / from.h : 1;
      point = onPicture({
        x: image.box.x + (el.point.x - from.x) * kx,
        y: image.box.y + (el.point.y - from.y) * ky,
      });
      el.anchor = anchorOf(image.box);
      if (numbers) set(el, numberBox(point));
      else {
        const offset = el.offset ?? { x: 0, y: 0 };
        set(el, {
          ...el.box,
          x: point.x + offset.x - el.box.w / 2,
          y: point.y + offset.y - el.box.h / 2,
          rotation: 0,
        });
      }
      changed = true;
    } else if (numbers) {
      // The mark itself was dragged: what it points at is where it was put.
      const sized = el.box.w === MARK_SIZE && el.box.h === MARK_SIZE;
      point = onPicture(sized ? middle(el.box) : el.point);
      set(el, numberBox(point));
    } else {
      point = onPicture(el.point);
      if (el.box.rotation !== 0) set(el, { ...el.box, rotation: 0 });
    }
    if (point.x !== el.point.x || point.y !== el.point.y) {
      el.point = point;
      changed = true;
    }
    if (numbers) {
      if (el.offset) {
        delete el.offset;
        changed = true;
      }
    } else {
      // Where the label lies in relation to what it points at, for the next time the picture is moved.
      const at = middle(el.box);
      const offset = { x: at.x - el.point.x, y: at.y - el.point.y };
      if (!el.offset || el.offset.x !== offset.x || el.offset.y !== offset.y) {
        el.offset = offset;
        changed = true;
      }
    }
  }
  for (const el of scene.elements) {
    if (el.type !== 'legend') continue;
    const corner = pictures.get(el.on)!.box;
    if (el.anchor && el.offset && (el.anchor.x !== corner.x || el.anchor.y !== corner.y)) {
      // The picture has been moved: the legend is put as far from it as it lay.
      const x = corner.x + el.offset.x;
      const y = corner.y + el.offset.y;
      if (x !== el.box.x || y !== el.box.y) el.box = { ...el.box, x, y };
      el.anchor = { x: corner.x, y: corner.y };
      changed = true;
      continue;
    }
    const offset = { x: el.box.x - corner.x, y: el.box.y - corner.y };
    const same =
      el.anchor?.x === corner.x &&
      el.anchor.y === corner.y &&
      el.offset?.x === offset.x &&
      el.offset.y === offset.y;
    if (!same) {
      el.anchor = { x: corner.x, y: corner.y };
      el.offset = offset;
      changed = true;
    }
  }
  return changed;
}

/**
 * Puts a new mark on a picture, in the middle of it (or a little to the
 * side of the marks that are there already), and returns it. With numbers,
 * the picture gets its legend when it has none.
 */
export function addMark(
  scene: Marked,
  imageId: string,
  newId: () => string,
  /** The stage of the project the slide is in (lying when not given). */
  stage: Stage = stageFor('landscape'),
): MarkElement | null {
  const image = scene.elements.find(
    (e): e is ImageElement => e.type === 'image' && e.id === imageId,
  );
  if (!image) return null;
  const count = marksOf(scene, imageId).length;
  // New marks are spread a little, so one does not hide the one before it.
  const spread = ((count % 5) - 2) * 0.12;
  const point = {
    x: image.box.x + image.box.w * (0.5 + spread),
    y: image.box.y + image.box.h * (0.5 + spread * 0.6),
  };
  const numbers = markStyle(image) === 'numbers';
  const mark: MarkElement = {
    id: newId(),
    type: 'mark',
    on: imageId,
    text: '',
    point,
    anchor: anchorOf(image.box),
    box: numbers ? numberBox(point) : labelBoxFor(stage, image.box, point),
  };
  scene.elements.push(mark);
  if (numbers && !legendOf(scene, imageId)) {
    scene.elements.push({
      id: newId(),
      type: 'legend',
      on: imageId,
      box: legendBoxFor(stage, image.box, count + 1),
    });
  }
  return mark;
}

/**
 * Changes how the marks of a picture are drawn. The marks keep what they
 * point at and what they say; numbers get their legend, and labels are laid
 * out beside the picture.
 */
export function setMarkStyle(
  scene: Marked,
  imageId: string,
  style: MarkStyle,
  newId: () => string,
  /** The stage of the project the slide is in (lying when not given). */
  stage: Stage = stageFor('landscape'),
): void {
  const image = scene.elements.find(
    (e): e is ImageElement => e.type === 'image' && e.id === imageId,
  );
  if (!image || markStyle(image) === style) return;
  if (style === 'numbers') delete image.marks;
  else image.marks = style;
  const marks = marksOf(scene, imageId);
  if (style === 'numbers') {
    for (const mark of marks) mark.box = numberBox(mark.point);
    if (marks.length > 0 && !legendOf(scene, imageId)) {
      scene.elements.push({
        id: newId(),
        type: 'legend',
        on: imageId,
        box: legendBoxFor(stage, image.box, marks.length),
      });
    }
    return;
  }
  // Labels say what the legend said, so the legend goes.
  const legend = legendOf(scene, imageId);
  if (legend) {
    scene.elements = scene.elements.filter((el) => el.id !== legend.id);
    for (const step of scene.timeline) {
      step.actions = step.actions.filter((action) => action.target !== legend.id);
    }
    scene.timeline = scene.timeline.filter(stepStands);
  }
  // Labels on the same side are spread out below one another, so they do not lie on top of each other.
  const taken: Box[] = [];
  for (const mark of [...marks].sort((a, b) => a.point.y - b.point.y)) {
    const box = labelBoxFor(stage, image.box, mark.point);
    for (const other of taken) {
      const overlaps = Math.abs(other.x - box.x) < box.w && Math.abs(other.y - box.y) < box.h + 8;
      if (overlaps) box.y = Math.min(stage.height - box.h, other.y + other.h + 8);
    }
    taken.push(box);
    mark.box = box;
  }
}

/** One step for each mark of a picture, in the order they are numbered. Other steps stay. */
export function stepPerMark(
  scene: Marked,
  imageId: string,
  newStep: (target: string) => Scene['timeline'][number],
): void {
  const marks = marksOf(scene, imageId);
  const ids = new Set(marks.map((mark) => mark.id));
  for (const step of scene.timeline) {
    step.actions = step.actions.filter((action) => !ids.has(action.target));
  }
  scene.timeline = scene.timeline.filter(stepStands);
  for (const mark of marks) scene.timeline.push(newStep(mark.id));
}

/**
 * Where the line of a label starts: the point on the edge of the label's
 * box that lies nearest to what it points at.
 */
export function labelLineStart(
  box: Box,
  point: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: clamp(point.x, box.x, box.x + box.w),
    y: clamp(point.y, box.y, box.y + box.h),
  };
}
