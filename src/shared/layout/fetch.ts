// Figures that can be fetched from a slide into a "Lær mer" box. The owner
// chose this on 25.11.2026: a figure for a box is made on a slide, with the
// tools that are there, and the builder fetches a copy of it.
//
// What counts as a figure is what the lecturer made as one thing: a group
// (a figure with a form is one, with its parts), and a picture with marks.
import type { DrawnElement, Element, FigureTemplate, Scene } from '../format/schema';
import { unionBox } from './groups';
import { isMark } from './marks';

export interface SlideFigure {
  /** A figure with a form is known by its form; anything else is a group or a marked picture. */
  kind: FigureTemplate | 'group' | 'marked';
  /** The elements it is made of, back to front. */
  ids: string[];
}

/** A video and a "+ Lær mer" button are not drawn in a box; everything else is. */
function canBeDrawn(el: Element): boolean {
  return el.type !== 'video' && el.type !== 'deepdive';
}

/** The figures of a slide, in the order they lie on it. */
export function figuresOn(scene: Pick<Scene, 'elements'>): SlideFigure[] {
  const found: SlideFigure[] = [];
  const seen = new Set<string>();
  // The marks and the legend of a picture go where the picture goes.
  const withMarks = (members: Element[]): string[] => {
    const pictures = new Set(members.filter((el) => el.type === 'image').map((el) => el.id));
    return scene.elements
      .filter(
        (el) =>
          members.includes(el) ||
          ((el.type === 'mark' || el.type === 'legend') && pictures.has(el.on)),
      )
      .map((el) => el.id);
  };
  for (const el of scene.elements) {
    if (el.group !== undefined) {
      if (seen.has(el.group)) continue;
      seen.add(el.group);
      const members = scene.elements.filter((one) => one.group === el.group);
      if (!members.some((one) => canBeDrawn(one) && one.type !== 'figure')) continue;
      const forms = members.filter((one) => one.type === 'figure');
      const form = forms.length === 1 ? forms[0] : undefined;
      const onlyItsParts =
        form?.type === 'figure' &&
        members.every((one) => one === form || one.of?.figure === form.id);
      found.push({
        kind: onlyItsParts && form?.type === 'figure' ? form.template : 'group',
        ids: withMarks(members),
      });
    } else if (
      el.type === 'image' &&
      scene.elements.some((one) => isMark(one) && one.on === el.id)
    ) {
      found.push({ kind: 'marked', ids: withMarks([el]) });
    }
  }
  return found;
}

/** Room round a figure in its box, so that an outline or a dot at the very edge is whole. */
const MARGIN = 12;

export interface FetchedFigure {
  elements: DrawnElement[];
  frame: { x: number; y: number; w: number; h: number };
  /** How many elements could not come along (videos and "+ Lær mer" buttons). */
  left: number;
}

/**
 * A copy of a figure, for a "Lær mer" box: its elements with ids of their
 * own, where they stood on the slide, and the part of the slide they fill.
 * A copy has no steps and no "Lær mer" content inside it, and nothing in it
 * is held together or fastened: it is only drawn. Undefined when nothing of
 * the figure can be drawn.
 */
export function fetchFigure(
  scene: Pick<Scene, 'elements'>,
  figure: SlideFigure,
  newId: () => string,
): FetchedFigure | undefined {
  const all = scene.elements.filter((el) => figure.ids.includes(el.id));
  const chosen = all.filter(canBeDrawn);
  if (!chosen.some((el) => el.type !== 'figure')) return undefined;
  const ids = new Map(chosen.map((el) => [el.id, newId()]));
  const elements = chosen.map((el): DrawnElement => {
    const copy = structuredClone(el) as Element;
    delete copy.more;
    delete copy.group;
    copy.id = ids.get(el.id)!;
    if (copy.of) {
      const form = ids.get(copy.of.figure);
      if (form) copy.of = { ...copy.of, figure: form };
      else delete copy.of;
    }
    if (copy.type === 'shape') {
      delete copy.startAt;
      delete copy.endAt;
    }
    if (copy.type === 'mark' || copy.type === 'legend') copy.on = ids.get(copy.on) ?? copy.on;
    return copy as DrawnElement;
  });
  // What is seen: the boxes, and the point each label's line runs to.
  const seen = elements.filter((el) => el.type !== 'figure');
  const boxes = seen.map((el) => el.box);
  for (const el of seen) {
    if (el.type === 'mark') {
      boxes.push({ x: el.point.x - 9, y: el.point.y - 9, w: 18, h: 18, rotation: 0 });
    }
  }
  const around = unionBox(boxes);
  const x = Math.floor(around.x - MARGIN);
  const y = Math.floor(around.y - MARGIN);
  return {
    elements,
    frame: {
      x,
      y,
      w: Math.ceil(around.x + around.w + MARGIN) - x,
      h: Math.ceil(around.y + around.h + MARGIN) - y,
    },
    left: all.length - chosen.length,
  };
}
