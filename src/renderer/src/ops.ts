// Operations on scenes and elements used by the interface.
import { newId, plainText, richText } from '../../shared/format/factory';
import type {
  Box,
  Element,
  More,
  MoreBlock,
  MoreBlockKind,
  Scene,
  SceneKind,
  ShapeElement,
  Step,
  TextRole,
} from '../../shared/format/schema';
import { pruneTimeline } from '../../shared/render/timeline';
import { columnEdges, type Theme } from '../../shared/theme/theme';

export const ROLE_NAMES: Record<TextRole, string> = {
  title: 'Tittel',
  subtitle: 'Undertittel',
  heading: 'Overskrift',
  body: 'Brødtekst',
  caption: 'Bildetekst',
  number: 'Stort tall',
};

export const KIND_NAMES: Record<SceneKind, string> = {
  title: 'Tittel',
  section: 'Seksjon',
  content: 'Innhold',
  closing: 'Avslutning',
};

export const GEOMETRY_NAMES: Record<ShapeElement['geometry'], string> = {
  rect: 'Rektangel',
  roundRect: 'Avrundet rektangel',
  ellipse: 'Ellipse',
  line: 'Linje',
  arrow: 'Pil',
};

function shorten(text: string, max = 40): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** A short description of an element for lists. */
export function describeElement(el: Element): string {
  switch (el.type) {
    case 'text': {
      const text = shorten(plainText(el.content));
      return text ? `${ROLE_NAMES[el.role]}: ${text}` : ROLE_NAMES[el.role];
    }
    case 'image':
      return el.alt ? `Bilde: ${shorten(el.alt)}` : 'Bilde';
    case 'shape': {
      const text = el.content ? shorten(plainText(el.content)) : '';
      return text ? `${GEOMETRY_NAMES[el.geometry]}: ${text}` : GEOMETRY_NAMES[el.geometry];
    }
    case 'table':
      return `Tabell (${el.rows.length} rader)`;
    case 'video':
      return el.title ? `Video: ${shorten(el.title)}` : 'Video';
    case 'deepdive':
      return `Lær mer: ${shorten(el.label) || 'uten tittel'}`;
  }
}

/** Where a new element of a given size is placed: on the grid, clear of the title. */
export function placeNew(scene: Scene, theme: Theme, w: number, h: number): Box {
  const { starts } = columnEdges(theme);
  const x = starts[0]!;
  let y = theme.grid.marginTop;
  // Stack below what is already there, as long as it fits.
  for (const el of scene.elements) {
    const bottom = el.box.y + el.box.h + 24;
    if (el.box.x < x + w && el.box.x + el.box.w > x && bottom > y) y = bottom;
  }
  const limit = 1080 - theme.grid.marginBottom - h;
  if (y > limit) y = Math.max(theme.grid.marginTop, limit);
  return { x: Math.round(x), y: Math.round(y), w, h, rotation: 0 };
}

export function newTextElement(scene: Scene, theme: Theme, role: TextRole): Element {
  const { starts, ends } = columnEdges(theme);
  const width = role === 'title' ? ends[7]! - starts[0]! : ends[4]! - starts[0]!;
  const height = role === 'title' ? 110 : 160;
  return {
    id: newId('e'),
    type: 'text',
    role,
    content: richText(),
    align: 'left',
    valign: 'top',
    box: placeNew(scene, theme, Math.round(width), height),
  };
}

export function newShapeElement(
  scene: Scene,
  theme: Theme,
  geometry: ShapeElement['geometry'],
): Element {
  const isLine = geometry === 'line' || geometry === 'arrow';
  return {
    id: newId('e'),
    type: 'shape',
    geometry,
    ...(isLine ? {} : { fill: 'lilla' as const }),
    box: placeNew(scene, theme, isLine ? 400 : 360, isLine ? 1 : 220),
  };
}

export function newTableElement(scene: Scene, theme: Theme): Element {
  const { starts, ends } = columnEdges(theme);
  const cell = () => ({ content: richText() });
  return {
    id: newId('e'),
    type: 'table',
    columns: [1, 1, 1],
    headerRow: true,
    rows: [
      [cell(), cell(), cell()],
      [cell(), cell(), cell()],
      [cell(), cell(), cell()],
    ],
    box: placeNew(scene, theme, Math.round(ends[5]! - starts[0]!), 240),
  };
}

export function newDeepDiveElement(scene: Scene, theme: Theme): Element {
  return {
    id: newId('e'),
    type: 'deepdive',
    label: '',
    more: { title: '', blocks: [] },
    box: placeNew(scene, theme, 320, 76),
  };
}

// ---------- "Lær mer" content ----------

export const BLOCK_NAMES: Record<MoreBlockKind, string> = {
  heading: 'Overskrift',
  text: 'Tekst',
  image: 'Bilde',
  video: 'Video',
  table: 'Tabell',
  embed: 'Nettside',
};

export const CORNER_NAMES: Record<NonNullable<More['corner']>, string> = {
  tr: 'Oppe til høyre',
  tl: 'Oppe til venstre',
  br: 'Nede til høyre',
  bl: 'Nede til venstre',
};

/** A new, empty block. Pictures and video files are made where the file is chosen. */
export function newBlock(kind: 'heading' | 'text' | 'table' | 'embed' | 'video-link'): MoreBlock {
  const id = newId('b');
  switch (kind) {
    case 'heading':
      return { id, kind: 'heading', text: '' };
    case 'text':
      return { id, kind: 'text', content: richText() };
    case 'table': {
      const cell = () => ({ content: richText() });
      return {
        id,
        kind: 'table',
        columns: [1, 1],
        headerRow: true,
        rows: [
          [cell(), cell()],
          [cell(), cell()],
        ],
      };
    }
    case 'embed':
      return { id, kind: 'embed', url: '', title: '' };
    case 'video-link':
      return { id, kind: 'video', source: { kind: 'url', url: '' }, title: '' };
  }
}

/** A short description of what a panel holds, for the side panel. */
export function describeMore(more: More | undefined): string {
  const count = more?.blocks.length ?? 0;
  if (count === 0) return 'Panelet er tomt.';
  const kinds = [...new Set(more!.blocks.map((b) => BLOCK_NAMES[b.kind].toLowerCase()))];
  return `${count} ${count === 1 ? 'del' : 'deler'}: ${kinds.join(', ')}.`;
}

/** Moves a block to a new place in the list. */
export function moveBlock(more: More, from: number, to: number): void {
  if (from === to || from < 0 || from >= more.blocks.length) return;
  const clamped = Math.max(0, Math.min(more.blocks.length - 1, to));
  const [block] = more.blocks.splice(from, 1);
  more.blocks.splice(clamped, 0, block!);
}

/** A copy with new ids, nudged so it does not hide the original. */
export function cloneElements(elements: Element[], offset: number): Element[] {
  return elements.map((el) => ({
    ...structuredClone(el),
    id: newId('e'),
    box: { ...el.box, x: el.box.x + offset, y: el.box.y + offset },
  }));
}

export function cloneScene(scene: Scene): Scene {
  const copy = structuredClone(scene);
  copy.id = newId('s');
  const ids = new Map<string, string>();
  for (const el of copy.elements) {
    const id = newId('e');
    ids.set(el.id, id);
    el.id = id;
  }
  for (const step of copy.timeline) {
    step.id = newId('t');
    for (const action of step.actions) action.target = ids.get(action.target) ?? action.target;
  }
  return copy;
}

export function deleteElements(scene: Scene, ids: string[]): void {
  scene.elements = scene.elements.filter((e) => !ids.includes(e.id));
  pruneTimeline(scene);
}

export type OrderMove = 'front' | 'forward' | 'backward' | 'back';

export function reorderElement(scene: Scene, id: string, move: OrderMove): void {
  const from = scene.elements.findIndex((e) => e.id === id);
  if (from < 0) return;
  const last = scene.elements.length - 1;
  const to =
    move === 'front'
      ? last
      : move === 'back'
        ? 0
        : move === 'forward'
          ? Math.min(last, from + 1)
          : Math.max(0, from - 1);
  const [el] = scene.elements.splice(from, 1);
  scene.elements.splice(to, 0, el!);
}

// ---------- Steps ----------

const DEFAULT_FADE = 0.4;

export function newStep(targets: string[]): Step {
  return {
    id: newId('t'),
    actions: targets.map((target) => ({ target, effect: 'fade' as const, duration: DEFAULT_FADE })),
  };
}

/** Removes elements from whatever step they are in. */
export function removeFromSteps(scene: Scene, ids: string[]): void {
  for (const step of scene.timeline) {
    step.actions = step.actions.filter((a) => !ids.includes(a.target));
  }
  scene.timeline = scene.timeline.filter((s) => s.actions.length > 0);
}

export function addStep(scene: Scene, ids: string[]): void {
  if (ids.length === 0) return;
  removeFromSteps(scene, ids);
  scene.timeline.push(newStep(ids));
}

export function addToStep(scene: Scene, stepId: string, ids: string[]): void {
  removeFromSteps(
    scene,
    ids.filter(
      (id) => !scene.timeline.find((s) => s.id === stepId)?.actions.some((a) => a.target === id),
    ),
  );
  const step = scene.timeline.find((s) => s.id === stepId);
  if (!step) return;
  for (const id of ids) {
    if (!step.actions.some((a) => a.target === id)) {
      step.actions.push({ target: id, effect: 'fade', duration: DEFAULT_FADE });
    }
  }
}

/** One step per element, in reading order; titles stay visible from the start. */
export function stepPerElement(scene: Scene): void {
  const order = scene.elements
    .filter((e) => !(e.type === 'text' && e.role === 'title'))
    .sort((a, b) => (Math.abs(a.box.y - b.box.y) > 40 ? a.box.y - b.box.y : a.box.x - b.box.x));
  scene.timeline = order.map((e) => newStep([e.id]));
}

export function stepOf(scene: Scene, elementId: string): number {
  return scene.timeline.findIndex((s) => s.actions.some((a) => a.target === elementId));
}
