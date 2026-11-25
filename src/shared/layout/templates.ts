// Figures that draw themselves from a form: a process, layers, a comparison.
// The figure element holds the form and a frame; what is seen are ordinary
// shapes, each an element of its own (so it can come in at a step and have
// "Lær mer" content) that carries `of`. One function makes, lays out and
// takes away those shapes as the form says, after every change. Nothing here
// draws anything: the render code sees only shapes. The functions change the
// slide they are given.
import { STAGE } from '../format/constants';
import { isEmptyRichText, paragraph, plainText, richText } from '../format/factory';
import type {
  Box,
  Element,
  FigureElement,
  FigureItem,
  FigureTemplate,
  PaletteColor,
  RichText,
  Scene,
  ShapeElement,
  Step,
} from '../format/schema';
import { edgePoint, setLineEnds } from './groups';

type Templated = Pick<Scene, 'elements' | 'timeline'>;

/** How many rows the form of a new figure starts with. They are empty. */
const NEW_ITEMS: Record<FigureTemplate, number> = { process: 3, layers: 3, comparison: 2 };
/** The size a new figure starts with, in stage pixels. */
export const NEW_FIGURE_SIZE: Record<FigureTemplate, { w: number; h: number }> = {
  process: { w: 1500, h: 200 },
  layers: { w: 900, h: 480 },
  comparison: { w: 1500, h: 560 },
};
const FONT_SIZE = 30;
/** The colours of layers that lie on each other, when the lecturer has chosen none. */
const LAYER_COLORS: PaletteColor[] = ['indigo', 'lilla', 'mediumLilla', 'lysLilla', 'lysIndigo'];
const SMALLEST = 8;

export function isFigure(el: Element): el is FigureElement {
  return el.type === 'figure';
}

/** The figure a part belongs to, or the figure itself. */
export function figureOf(scene: Pick<Scene, 'elements'>, el: Element): FigureElement | undefined {
  if (el.type === 'figure') return el;
  const id = el.of?.figure;
  return id === undefined
    ? undefined
    : (scene.elements.find((e) => e.id === id && isFigure(e)) as FigureElement | undefined);
}

/** The parts of a figure that are on the slide, back to front. */
export function partsOf(scene: Pick<Scene, 'elements'>, figureId: string): Element[] {
  return scene.elements.filter((el) => el.of?.figure === figureId);
}

/**
 * The figure that the ids are the whole of (the figure and all its parts,
 * and nothing else), when they are that.
 */
export function wholeFigure(
  scene: Pick<Scene, 'elements'>,
  ids: readonly string[],
): FigureElement | undefined {
  const chosen = scene.elements.filter((el) => ids.includes(el.id));
  const figure = chosen.map((el) => figureOf(scene, el)).find((f) => f !== undefined);
  if (!figure) return undefined;
  const all = [figure.id, ...partsOf(scene, figure.id).map((el) => el.id)];
  return all.length === chosen.length && all.every((id) => ids.includes(id)) ? figure : undefined;
}

/** Which row of the form a part shows, and what of it. An arrow leads to the row it names. */
export function partSource(
  part: string,
): { kind: 'box' | 'head' | 'body' | 'arrow'; item: string } | undefined {
  const at = part.indexOf(':');
  const kind = part.slice(0, at);
  if (kind !== 'box' && kind !== 'head' && kind !== 'body' && kind !== 'arrow') return undefined;
  return { kind, item: part.slice(at + 1) };
}

/** A new figure with an empty form, to stand in the box given. */
export function newFigure(template: FigureTemplate, box: Box, newId: () => string): FigureElement {
  return {
    id: newId(),
    type: 'figure',
    template,
    items: Array.from({ length: NEW_ITEMS[template] }, () => ({ id: newId(), text: '' })),
    box: { ...box, rotation: 0 },
  };
}

// ---------- What a figure consists of ----------

/** What a part is to look like. Everything named here is decided by the form. */
type Look = Pick<
  ShapeElement,
  'geometry' | 'fill' | 'stroke' | 'strokeWidth' | 'content' | 'fontSize' | 'align' | 'valign'
>;

interface PartSpec {
  part: string;
  look: Look;
  /** Where it stands. An arrow has none: it lies between the two parts it is fastened to. */
  box?: Box;
  between?: { start: string; end: string };
}

function lines(text: string): RichText | undefined {
  const rows = text.split('\n').map((row) => row.trim());
  return rows.some((row) => row !== '') ? richText(...rows.filter((row) => row !== '')) : undefined;
}

function points(text: string | undefined): RichText | undefined {
  const rows = (text ?? '')
    .split('\n')
    .map((row) => row.trim())
    .filter((row) => row !== '');
  if (rows.length === 0) return undefined;
  return { paragraphs: rows.map((row) => paragraph(row, { list: 'bullet' })) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Splits a length into `n` pieces with a gap between them; returns where each starts and ends. */
function split(from: number, length: number, n: number, gap: number): Array<[number, number]> {
  // When the pieces would become too small, the gap gives way first.
  const room = n > 1 ? Math.max(0, Math.min(gap, (length - n * 40) / (n - 1))) : 0;
  const piece = (length - (n - 1) * room) / n;
  return Array.from({ length: n }, (_, i) => {
    const start = Math.round(from + i * (piece + room));
    const end = Math.round(from + i * (piece + room) + piece);
    return [start, Math.max(start + SMALLEST, end)];
  });
}

/** The parts a figure is drawn with, in the order they lie on the slide. */
export function figureParts(figure: FigureElement): PartSpec[] {
  const { x, y, w, h } = figure.box;
  const n = figure.items.length;
  const size = figure.fontSize ?? FONT_SIZE;
  const specs: PartSpec[] = [];
  if (n === 0) return specs;

  if (figure.template === 'process') {
    const down = figure.direction === 'down';
    const gap = down ? clamp(h * 0.08, 36, 90) : clamp(w * 0.06, 44, 110);
    const places = down ? split(y, h, n, gap) : split(x, w, n, gap);
    figure.items.forEach((item, i) => {
      const [from, to] = places[i]!;
      specs.push({
        part: `box:${item.id}`,
        look: {
          geometry: 'roundRect',
          fill: figure.color ?? 'lilla',
          content: lines(item.text),
          fontSize: size,
        },
        box: down
          ? { x, y: from, w, h: to - from, rotation: 0 }
          : { x: from, y, w: to - from, h, rotation: 0 },
      });
      if (i > 0) {
        specs.push({
          part: `arrow:${item.id}`,
          look: { geometry: 'arrow' },
          between: { start: `box:${figure.items[i - 1]!.id}`, end: `box:${item.id}` },
        });
      }
    });
    return specs;
  }

  if (figure.template === 'layers') {
    // Layers of the lecturer's one colour are told apart by a gap; otherwise by their colours.
    const places = split(y, h, n, figure.color ? 6 : 0);
    figure.items.forEach((item, i) => {
      const [from, to] = places[i]!;
      specs.push({
        part: `box:${item.id}`,
        look: {
          geometry: 'rect',
          fill: figure.color ?? LAYER_COLORS[i % LAYER_COLORS.length]!,
          content: lines(item.text),
          fontSize: size,
        },
        box: { x, y: from, w, h: to - from, rotation: 0 },
      });
    });
    return specs;
  }

  // A comparison: columns side by side, each a heading over a box with its points.
  const places = split(x, w, n, 28);
  const head = Math.round(clamp(h * 0.2, 64, Math.min(120, h / 2)));
  const color = figure.color ?? 'lilla';
  figure.items.forEach((item, i) => {
    const [from, to] = places[i]!;
    specs.push({
      part: `head:${item.id}`,
      look: { geometry: 'rect', fill: color, content: lines(item.text), fontSize: size },
      box: { x: from, y, w: to - from, h: head, rotation: 0 },
    });
    specs.push({
      part: `body:${item.id}`,
      look: {
        geometry: 'rect',
        stroke: color,
        strokeWidth: 4,
        content: points(item.detail),
        fontSize: Math.round(size * 0.87),
        align: 'left',
        valign: 'top',
      },
      box: { x: from, y: y + head, w: to - from, h: Math.max(SMALLEST, h - head), rotation: 0 },
    });
  });
  return specs;
}

// ---------- Keeping the slide as the form says ----------

const LOOK_KEYS = [
  'geometry',
  'fill',
  'stroke',
  'strokeWidth',
  'content',
  'fontSize',
  'align',
  'valign',
] as const;

/** Gives a field the value the form says. Returns true when that changed it. */
function put<K extends keyof ShapeElement>(
  el: ShapeElement,
  key: K,
  value: ShapeElement[K] | undefined,
): boolean {
  const now = el[key];
  if (value === undefined) {
    if (now === undefined) return false;
    delete el[key];
    return true;
  }
  if (now !== undefined && JSON.stringify(now) === JSON.stringify(value)) return false;
  el[key] = value;
  return true;
}

function dropFromSteps(scene: Templated, gone: ReadonlySet<string>): void {
  for (const step of scene.timeline) {
    step.actions = step.actions.filter((action) => !gone.has(action.target));
  }
  scene.timeline = scene.timeline.filter((step) => step.actions.length > 0);
}

/**
 * Makes every figure on the slide what its form says. Called after every
 * change to a slide:
 *
 * - a part whose figure is gone is an ordinary shape from then on;
 * - a part the form no longer has is taken away, and one it has got is made,
 *   right in front of the rest of its figure;
 * - every part looks and stands as the form says, inside the figure's
 *   frame, and is grouped with the figure. Its id, its step and its "Lær
 *   mer" content are left alone, so they follow a row that is moved in the
 *   form.
 *
 * An arrow between two parts is only fastened to them here; where it lies
 * is for `followFigures` (./groups.ts), which is called after this.
 *
 * Returns true when anything was changed.
 */
export function followTemplates(scene: Templated): boolean {
  if (!scene.elements.some((el) => el.type === 'figure' || el.of !== undefined)) return false;
  let changed = false;
  const figures = scene.elements.filter(isFigure);
  const known = new Set(figures.map((figure) => figure.id));
  for (const el of scene.elements) {
    if (el.of !== undefined && (!known.has(el.of.figure) || el.type === 'figure')) {
      delete el.of;
      changed = true;
    }
  }

  for (const figure of figures) {
    if (figure.box.rotation !== 0) {
      figure.box.rotation = 0;
      changed = true;
    }
    const specs = figureParts(figure);
    const wanted = new Set(specs.map((spec) => spec.part));
    // What is there already, by which part it is. A part can only be a shape, and only once.
    const have = new Map<string, ShapeElement>();
    const gone = new Set<string>();
    for (const el of scene.elements) {
      if (el.of?.figure !== figure.id) continue;
      if (el.type === 'shape' && wanted.has(el.of.part) && !have.has(el.of.part)) {
        have.set(el.of.part, el);
      } else gone.add(el.id);
    }
    if (gone.size > 0) {
      scene.elements = scene.elements.filter((el) => !gone.has(el.id));
      dropFromSteps(scene, gone);
      changed = true;
    }
    if (specs.length > 0 && figure.group === undefined) {
      figure.group = `g_${figure.id}`;
      changed = true;
    }

    const taken = new Set(scene.elements.map((el) => el.id));
    const made: ShapeElement[] = [];
    const boxes = new Map(specs.flatMap((spec) => (spec.box ? [[spec.part, spec.box]] : [])));
    for (const spec of specs) {
      let el = have.get(spec.part);
      if (!el) {
        let id = `${figure.id}_${spec.part.replace(/[^A-Za-z0-9]+/g, '_')}`;
        while (taken.has(id)) id += 'x';
        taken.add(id);
        el = {
          id,
          type: 'shape',
          geometry: spec.look.geometry,
          of: { figure: figure.id, part: spec.part },
          box: spec.box ?? { x: figure.box.x, y: figure.box.y, w: 1, h: 1, rotation: 0 },
        };
        if (spec.between) {
          // Laid where `followFigures` would lay it, so it is in place from the start.
          const from = boxes.get(spec.between.start);
          const to = boxes.get(spec.between.end);
          if (from && to) {
            const a = { type: 'shape', geometry: 'rect', box: from } as Element;
            const b = { type: 'shape', geometry: 'rect', box: to } as Element;
            const mid = (box: Box): { x: number; y: number } => ({
              x: box.x + box.w / 2,
              y: box.y + box.h / 2,
            });
            setLineEnds(el, edgePoint(a, mid(to)), edgePoint(b, mid(from)));
          }
        }
        have.set(spec.part, el);
        made.push(el);
        changed = true;
      }
    }
    if (made.length > 0) {
      // New parts lie right in front of what the figure had.
      let last = scene.elements.findIndex((el) => el.id === figure.id);
      scene.elements.forEach((el, index) => {
        if (el.of?.figure === figure.id) last = Math.max(last, index);
      });
      scene.elements.splice(last + 1, 0, ...made);
    }

    for (const spec of specs) {
      // Read from the slide, so that what is changed is the slide's own element.
      const el = scene.elements.find(
        (e): e is ShapeElement =>
          e.type === 'shape' && e.of?.figure === figure.id && e.of.part === spec.part,
      )!;
      for (const key of LOOK_KEYS) {
        // A part being written in for the first time has an empty text; that is no text.
        const blank =
          key === 'content' &&
          spec.look.content === undefined &&
          el.content !== undefined &&
          isEmptyRichText(el.content);
        if (!blank && put(el, key, spec.look[key] as never)) changed = true;
      }
      if (put(el, 'group', figure.group)) changed = true;
      if (spec.between) {
        if (put(el, 'startAt', have.get(spec.between.start)?.id)) changed = true;
        if (put(el, 'endAt', have.get(spec.between.end)?.id)) changed = true;
      } else {
        if (put(el, 'box', spec.box)) changed = true;
        for (const key of ['startAt', 'endAt', 'flipH', 'flipV'] as const) {
          if (put(el, key, undefined)) changed = true;
        }
      }
    }
  }
  return changed;
}

// ---------- What the lecturer does with a figure ----------

/**
 * Makes a figure into a free one: the form goes, and the shapes stay where
 * they stand, as a group that can be changed by hand.
 */
export function releaseFigure(scene: Templated, figureId: string): void {
  if (!scene.elements.some((el) => el.id === figureId && isFigure(el))) return;
  scene.elements = scene.elements.filter((el) => el.id !== figureId);
  for (const el of scene.elements) if (el.of?.figure === figureId) delete el.of;
  dropFromSteps(scene, new Set([figureId]));
}

/**
 * Before elements are deleted: a part that is deleted by itself takes its
 * row out of the form, so it does not come back. (An arrow is not a row: it
 * is there as long as the two it joins are.)
 */
export function forgetParts(scene: Pick<Scene, 'elements'>, ids: readonly string[]): void {
  for (const el of scene.elements) {
    if (!ids.includes(el.id) || el.of === undefined || ids.includes(el.of.figure)) continue;
    const figure = figureOf(scene, el);
    const source = partSource(el.of.part);
    if (!figure || !source || source.kind === 'arrow') continue;
    figure.items = figure.items.filter((item) => item.id !== source.item);
  }
}

/**
 * What was written in a part on the slide goes into the form, which is
 * where the text of a figure lives. Returns false when the element is not
 * such a part.
 */
export function writePart(scene: Pick<Scene, 'elements'>, el: Element, content: RichText): boolean {
  if (el.of === undefined) return false;
  const figure = figureOf(scene, el);
  const source = partSource(el.of.part);
  const item = figure?.items.find((row) => row.id === source?.item);
  if (!item || !source || source.kind === 'arrow') return false;
  const text = plainText(content)
    .split('\n')
    .map((row) => row.trim())
    .filter((row) => row !== '')
    .join('\n');
  if (source.kind === 'body') {
    if (text) item.detail = text;
    else delete item.detail;
  } else item.text = text;
  return true;
}

/**
 * Turns a process to run across or down. The frame is given the shape that
 * suits the new way, where it stands, and is kept on the slide.
 */
export function setDirection(figure: FigureElement, direction: 'across' | 'down'): void {
  if ((figure.direction ?? 'across') === direction) return;
  if (direction === 'down') figure.direction = 'down';
  else delete figure.direction;
  const n = Math.max(1, figure.items.length);
  const size =
    direction === 'down'
      ? { w: 460, h: clamp(n * 130 + (n - 1) * 60, 200, 760) }
      : NEW_FIGURE_SIZE.process;
  figure.box = {
    x: Math.round(clamp(figure.box.x, 0, STAGE.width - size.w)),
    y: Math.round(clamp(figure.box.y, 0, STAGE.height - size.h)),
    w: size.w,
    h: size.h,
    rotation: 0,
  };
}

/** Moves a row of the form to another place in it. */
export function moveItem(figure: FigureElement, from: number, to: number): void {
  if (from === to || from < 0 || from >= figure.items.length) return;
  const [item] = figure.items.splice(from, 1);
  figure.items.splice(clamp(to, 0, figure.items.length), 0, item!);
}

/**
 * One step for each row of the form, in the order of the form: everything
 * that shows a row comes in together, and with it the arrow that leads to
 * it. Other steps stay.
 */
export function stepPerItem(
  scene: Templated,
  figureId: string,
  newStep: (targets: string[]) => Step,
): void {
  const figure = scene.elements.find(
    (el): el is FigureElement => el.id === figureId && isFigure(el),
  );
  if (!figure) return;
  const parts = partsOf(scene, figureId);
  dropFromSteps(scene, new Set([figureId, ...parts.map((el) => el.id)]));
  const of = (item: FigureItem): string[] =>
    parts.filter((el) => partSource(el.of!.part)?.item === item.id).map((el) => el.id);
  for (const item of figure.items) {
    const targets = of(item);
    if (targets.length > 0) scene.timeline.push(newStep(targets));
  }
}
