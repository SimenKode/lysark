// Operations on scenes and elements used by the interface.
import { newId, plainText, richText } from '../../shared/format/factory';
import type {
  Box,
  Element,
  FigureTemplate,
  More,
  MoreBlock,
  MoreBlockKind,
  Scene,
  SceneKind,
  ShapeElement,
  Step,
  TextRole,
} from '../../shared/format/schema';
import type { SlideFigure } from '../../shared/layout/fetch';
import {
  HIDE_SECONDS,
  MARK_SECONDS,
  ZOOM_SECONDS,
  fitView,
  proposedAction,
  showStep,
  stepKind,
  stepSeconds,
  stepStands,
  type View,
} from '../../shared/layout/steps';
import { forgetParts } from '../../shared/layout/templates';
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

/**
 * Makes a slide play the brand's closing animation. The film has a white
 * ground and carries the logo itself, so the slide is white and shows no
 * logo or brand shapes of its own.
 */
export function playClosingAnimation(scene: Scene, seconds: number): void {
  scene.closingAnimation = { seconds };
  scene.background = 'hvit';
  scene.showLogo = false;
  scene.decoration = false;
}

/** The figures that draw themselves from a form, as the lecturer knows them. */
export const TEMPLATE_NAMES: Record<FigureTemplate, string> = {
  process: 'Prosess',
  layers: 'Lagvis oppbygging',
  comparison: 'Sammenligning',
  // Not "Tidslinje": that is the tab under the slide (the owner's choice, 26.11.2026).
  timeAxis: 'Tidsakse',
  bars: 'Søylediagram',
  line: 'Linjediagram',
};

/** What a figure on a slide is called where it is fetched into a "Lær mer" box. */
export function slideFigureName(figure: SlideFigure): string {
  if (figure.kind === 'group') return 'Gruppe';
  if (figure.kind === 'marked') return 'Bilde med merker';
  return TEMPLATE_NAMES[figure.kind];
}

/** What one row of a figure's form is called: a box of a process, a layer, a column, an event. */
export const ITEM_NAMES: Record<FigureTemplate, string> = {
  process: 'boks',
  layers: 'lag',
  comparison: 'kolonne',
  timeAxis: 'hendelse',
  bars: 'rad',
  line: 'rad',
};

export const GEOMETRY_NAMES: Record<ShapeElement['geometry'], string> = {
  rect: 'Rektangel',
  roundRect: 'Avrundet rektangel',
  ellipse: 'Ellipse',
  sign: 'Skilt (rektangel med spiss)',
  line: 'Linje',
  arrow: 'Pil',
  curve: 'Kurve',
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
    case 'mark':
      return el.text.trim() ? `Merke: ${shorten(el.text)}` : 'Merke';
    case 'legend':
      return 'Forklaring til merkene';
    case 'figure':
      return `Figur: ${TEMPLATE_NAMES[el.template]}`;
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
    box: placeNew(scene, theme, isLine ? 400 : 360, isLine ? 1 : geometry === 'sign' ? 140 : 220),
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
  figure: 'Figur',
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
  if (count === 0) return 'Boksen er tom.';
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

/**
 * A copy with new ids, nudged so it does not hide the original. What is
 * copied together stays together: a mark belongs to the copy of its
 * picture, a group that is copied becomes a group of its own, and a line
 * stays fastened to the copies of what it was fastened to. A line whose
 * element was not copied with it is let go there.
 */
export function cloneElements(elements: Element[], offset: number): Element[] {
  const ids = new Map(elements.map((el) => [el.id, newId('e')]));
  const groups = new Map<string, string>();
  for (const el of elements) {
    if (el.group && !groups.has(el.group)) groups.set(el.group, newId('g'));
  }
  return elements.map((el) => {
    const copy: Element = {
      ...structuredClone(el),
      id: ids.get(el.id)!,
      box: { ...el.box, x: el.box.x + offset, y: el.box.y + offset },
    };
    if (copy.group) copy.group = groups.get(copy.group)!;
    if (copy.of) {
      // A part copied with its figure belongs to the copy; copied without it, it is a shape like any other.
      const figure = ids.get(copy.of.figure);
      if (figure) copy.of = { ...copy.of, figure };
      else delete copy.of;
    }
    if (copy.type === 'shape') {
      if (copy.startAt) {
        const to = ids.get(copy.startAt);
        if (to) copy.startAt = to;
        else delete copy.startAt;
      }
      if (copy.endAt) {
        const to = ids.get(copy.endAt);
        if (to) copy.endAt = to;
        else delete copy.endAt;
      }
    }
    if (copy.type === 'mark' || copy.type === 'legend') {
      // A mark that is copied with its picture belongs to the copy of the picture.
      copy.on = ids.get(copy.on) ?? copy.on;
      if (copy.type === 'mark') {
        copy.point = { x: copy.point.x + offset, y: copy.point.y + offset };
        if (ids.has(el.type === 'mark' ? el.on : '')) {
          copy.anchor = { ...copy.anchor, x: copy.anchor.x + offset, y: copy.anchor.y + offset };
        }
      }
    }
    return copy;
  });
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
  for (const el of copy.elements) {
    // What points at another element of the slide points at the copy of it.
    if (el.type === 'mark' || el.type === 'legend') el.on = ids.get(el.on) ?? el.on;
    if (el.of) el.of.figure = ids.get(el.of.figure) ?? el.of.figure;
    if (el.type === 'shape') {
      if (el.startAt) el.startAt = ids.get(el.startAt) ?? el.startAt;
      if (el.endAt) el.endAt = ids.get(el.endAt) ?? el.endAt;
    }
  }
  for (const step of copy.timeline) {
    step.id = newId('t');
    for (const action of step.actions) action.target = ids.get(action.target) ?? action.target;
  }
  return copy;
}

export function deleteElements(scene: Scene, ids: string[]): void {
  // A part of a figure with a form that is deleted takes its row out of the form.
  forgetParts(scene, ids);
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

/**
 * A new step that brings the elements in, each with the movement the
 * program proposes for it: a line is drawn, a bar grows, a large number
 * counts up, and anything else tones in.
 */
export function newStep(scene: Pick<Scene, 'elements'>, targets: string[]): Step {
  return showStep(scene, targets, newId('t'));
}

/** For the functions that make several steps of a slide: they are given this to make each with. */
export function stepMaker(scene: Pick<Scene, 'elements'>): (targets: string[]) => Step {
  return (targets) => newStep(scene, targets);
}

/**
 * Takes elements out of the steps that bring them in, so that they are
 * there from the start. Steps that mark them or take them away are left.
 */
export function removeFromSteps(scene: Scene, ids: string[]): void {
  for (const step of scene.timeline) {
    if (stepKind(step) !== 'show') continue;
    step.actions = step.actions.filter((a) => !ids.includes(a.target));
  }
  scene.timeline = scene.timeline.filter(stepStands);
}

/** Takes elements out of one step. A step that is left with nothing goes. */
export function removeFromStep(scene: Scene, stepId: string, ids: string[]): void {
  const step = scene.timeline.find((s) => s.id === stepId);
  if (!step) return;
  step.actions = step.actions.filter((a) => !ids.includes(a.target));
  scene.timeline = scene.timeline.filter(stepStands);
}

export function addStep(scene: Scene, ids: string[]): void {
  if (ids.length === 0) return;
  removeFromSteps(scene, ids);
  scene.timeline.push(newStep(scene, ids));
}

export function addToStep(scene: Scene, stepId: string, ids: string[]): void {
  const step = scene.timeline.find((s) => s.id === stepId);
  if (!step || step.kind === 'zoom') return;
  const fresh = ids.filter((id) => !step.actions.some((a) => a.target === id));
  // An element comes in at one step only; it can be marked or taken away at several.
  if (stepKind(step) === 'show') removeFromSteps(scene, fresh);
  for (const id of fresh) {
    const el = scene.elements.find((one) => one.id === id);
    if (!el) continue;
    if (stepKind(step) === 'show') step.actions.push(proposedAction(el));
    else step.actions.push({ target: id, effect: 'fade', duration: stepSeconds(step) });
  }
  if (!scene.timeline.includes(step) && step.actions.length > 0) scene.timeline.push(step);
}

/** A new step that marks the elements, or takes them away. */
export function addKindStep(scene: Scene, kind: 'mark' | 'hide', ids: string[]): void {
  const targets = ids.filter((id) => scene.elements.some((el) => el.id === id));
  if (targets.length === 0) return;
  const duration = kind === 'mark' ? MARK_SECONDS : HIDE_SECONDS;
  scene.timeline.push({
    id: newId('t'),
    kind,
    actions: targets.map((target) => ({ target, effect: 'fade' as const, duration })),
  });
}

/**
 * A new step that zooms: in on a part of the slide, or (without one) out to
 * the whole slide again. Returns its id.
 */
export function addZoomStep(scene: Scene, view: View | undefined): string {
  const id = newId('t');
  scene.timeline.push({
    id,
    kind: 'zoom',
    actions: [],
    ...(view ? { zoom: fitView(view) } : {}),
    seconds: ZOOM_SECONDS,
  });
  return id;
}

/** One step per element, in reading order; titles stay visible from the start. */
export function stepPerElement(scene: Scene): void {
  const order = scene.elements
    .filter((e) => !(e.type === 'text' && e.role === 'title'))
    .sort((a, b) => (Math.abs(a.box.y - b.box.y) > 40 ? a.box.y - b.box.y : a.box.x - b.box.x));
  scene.timeline = order.map((e) => newStep(scene, [e.id]));
}

/** The step that brings an element in; -1 when it is there from the start. */
export function stepOf(scene: Scene, elementId: string): number {
  return scene.timeline.findIndex(
    (s) => stepKind(s) === 'show' && s.actions.some((a) => a.target === elementId),
  );
}
