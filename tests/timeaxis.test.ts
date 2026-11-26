// @vitest-environment happy-dom
// The time axis: a figure that draws itself from a form of events, each with
// when it is and what it is. How the line, the points, the boxes and the
// texts are made and laid out, how the text of an event comes and goes with
// what is written, and how a part that is new in a row comes in with the
// rest of the row. Nothing here is real subject matter.
import { describe, expect, it } from 'vitest';
import { newProject, newScene, plainText, richText } from '../src/shared/format/factory';
import {
  parseProject,
  type Box,
  type Element,
  type FigureElement,
  type Project,
  type Scene,
  type ShapeElement,
  type Step,
  type TextElement,
} from '../src/shared/format/schema';
import { followFigures, membersOf } from '../src/shared/layout/groups';
import {
  NEW_FIGURE_SIZE,
  followTemplates,
  forgetParts,
  moveItem,
  newFigure,
  partsOf,
  releaseFigure,
  setDirection,
  stepPerItem,
  writePart,
} from '../src/shared/layout/templates';
import { SCENE_STRINGS, renderScene, type RenderContext } from '../src/shared/render/scene';
import { THEME_REN } from '../src/shared/theme/theme';
import { cloneScene, deleteElements } from '../src/renderer/src/ops';

let counter = 0;
const newId = (): string => `n${++counter}`;
const step = (targets: string[]): Step => ({
  id: `st_${targets.join('_')}`,
  actions: targets.map((target) => ({ target, effect: 'fade' as const, duration: 0.4 })),
});

/** What the store does after every change. */
function settle(scene: Scene): boolean {
  const a = followTemplates(scene);
  const b = followFigures(scene);
  return a || b;
}

/** A slide with a time axis of the events given (when, and perhaps what), in a frame at (200, 300). */
function slide(events: Array<[string, string?]>): { scene: Scene; figure: FigureElement } {
  const scene = newScene('content', 'A');
  const figure = newFigure(
    'timeAxis',
    { x: 200, y: 300, ...NEW_FIGURE_SIZE.timeAxis, rotation: 0 },
    newId,
  );
  figure.items = events.map(([text, detail]) => ({
    id: newId(),
    text,
    ...(detail === undefined ? {} : { detail }),
  }));
  scene.elements.push(figure);
  settle(scene);
  return { scene, figure };
}

const part = <T extends Element = ShapeElement>(
  scene: Scene,
  figure: FigureElement,
  key: string,
): T => scene.elements.find((el) => el.of?.figure === figure.id && el.of.part === key) as T;
const kinds = (scene: Scene, figure: FigureElement): string[] =>
  partsOf(scene, figure.id).map((el) => el.of!.part.split(':')[0]!);
const middle = (box: Box): { x: number; y: number } => ({
  x: box.x + box.w / 2,
  y: box.y + box.h / 2,
});
const inside = (box: Box, frame: Box): boolean =>
  box.x >= frame.x - 1 &&
  box.y >= frame.y - 1 &&
  box.x + box.w <= frame.x + frame.w + 1 &&
  box.y + box.h <= frame.y + frame.h + 1;

describe('a time axis', () => {
  it('starts with three empty events: a line, and a point and a box for each', () => {
    const scene = newScene('content', 'A');
    const figure = newFigure('timeAxis', { x: 100, y: 100, w: 1500, h: 360, rotation: 0 }, newId);
    expect(figure.items).toHaveLength(3);
    expect(figure.items.every((item) => item.text === '' && item.detail === undefined)).toBe(true);
    scene.elements.push(figure);
    expect(settle(scene)).toBe(true);
    // The line first, so it lies behind the points. No text boxes: nothing is written.
    expect(kinds(scene, figure)).toEqual(['axis', 'dot', 'head', 'dot', 'head', 'dot', 'head']);
    const parts = partsOf(scene, figure.id);
    expect(parts.every((el) => el.type === 'shape' && el.content === undefined)).toBe(true);
    expect(membersOf(scene, figure.group!)).toHaveLength(8);
    // Settled: nothing more to do.
    expect(settle(scene)).toBe(false);
  });

  it('lies across its frame: when over the line, a point on it, and what under it', () => {
    const { scene, figure } = slide([['1', 'A'], ['2', 'B\nC'], ['3']]);
    const frame = figure.box;
    const axis = part(scene, figure, 'axis:line');
    expect(axis.geometry).toBe('line');
    expect(axis.box).toMatchObject({ x: frame.x, w: frame.w, h: 1 });
    expect(axis.startAt).toBeUndefined();
    const line = axis.box.y;
    let before = -Infinity;
    for (const item of figure.items) {
      const dot = part(scene, figure, `dot:${item.id}`);
      const head = part(scene, figure, `head:${item.id}`);
      expect(dot.geometry).toBe('ellipse');
      expect(dot.box.w).toBe(dot.box.h);
      // The point is on the line, under the middle of its box.
      expect(Math.abs(middle(dot.box).y - line)).toBeLessThanOrEqual(1);
      expect(Math.abs(middle(dot.box).x - middle(head.box).x)).toBeLessThanOrEqual(1);
      expect(head.box.y).toBe(frame.y);
      expect(head.box.y + head.box.h).toBeLessThan(dot.box.y);
      expect(plainText(head.content!)).toBe(item.text);
      // The events stand in the order of the form, and do not lie on each other.
      expect(head.box.x).toBeGreaterThan(before);
      before = head.box.x + head.box.w;
      for (const el of [dot, head]) expect(inside(el.box, frame)).toBe(true);
    }
    // What an event is, is a text box with nothing around it, under the line.
    const first = part<TextElement>(scene, figure, `body:${figure.items[0]!.id}`);
    expect(first.type).toBe('text');
    expect(first.role).toBe('body');
    expect(first.align).toBe('center');
    expect(first.valign).toBe('top');
    expect(first.box.y).toBeGreaterThan(line + 13);
    expect(first.box.y + first.box.h).toBe(frame.y + frame.h);
    expect(first.box.x).toBe(part(scene, figure, `head:${figure.items[0]!.id}`).box.x);
    // Each line written is a paragraph of its own.
    const second = part<TextElement>(scene, figure, `body:${figure.items[1]!.id}`);
    expect(second.content.paragraphs.map((p) => p.runs[0]!.text)).toEqual(['B', 'C']);
    // An event with nothing written about it has no text box.
    expect(part(scene, figure, `body:${figure.items[2]!.id}`)).toBeUndefined();
  });

  it('follows its frame, and its colour and size of letters', () => {
    const { scene, figure } = slide([['1', 'A'], ['2']]);
    figure.box = { x: 100, y: 500, w: 900, h: 300, rotation: 0 };
    figure.color = 'indigo';
    figure.fontSize = 40;
    expect(settle(scene)).toBe(true);
    for (const el of partsOf(scene, figure.id)) expect(inside(el.box, figure.box)).toBe(true);
    expect(part(scene, figure, 'axis:line').stroke).toBe('indigo');
    const [a] = figure.items;
    expect(part(scene, figure, `dot:${a!.id}`).fill).toBe('indigo');
    expect(part(scene, figure, `head:${a!.id}`).fill).toBe('indigo');
    expect(part(scene, figure, `head:${a!.id}`).fontSize).toBe(40);
    expect(part<TextElement>(scene, figure, `body:${a!.id}`).fontSize).toBe(35);
    // A part moved by hand is laid back.
    part(scene, figure, `dot:${a!.id}`).box.x += 200;
    part<TextElement>(scene, figure, `body:${a!.id}`).box.y += 90;
    expect(settle(scene)).toBe(true);
    expect(settle(scene)).toBe(false);
    expect(
      Math.abs(
        middle(part(scene, figure, `dot:${a!.id}`).box).x -
          middle(part(scene, figure, `head:${a!.id}`).box).x,
      ),
    ).toBeLessThanOrEqual(1);
  });

  it('is turned to run down: when to the left of the line, and what to the right', () => {
    const { scene, figure } = slide([
      ['1', 'A'],
      ['2', 'B'],
      ['3', 'C'],
    ]);
    setDirection(figure, 'down');
    settle(scene);
    expect(figure.direction).toBe('down');
    expect(figure.box).toMatchObject({ x: 200, y: 300, w: 900 });
    expect(figure.box.y + figure.box.h).toBeLessThanOrEqual(1080);
    const frame = figure.box;
    const axis = part(scene, figure, 'axis:line');
    expect(axis.box).toMatchObject({ y: frame.y, w: 1, h: frame.h });
    const line = axis.box.x;
    let before = -Infinity;
    for (const item of figure.items) {
      const dot = part(scene, figure, `dot:${item.id}`);
      const head = part(scene, figure, `head:${item.id}`);
      const body = part<TextElement>(scene, figure, `body:${item.id}`);
      expect(Math.abs(middle(dot.box).x - line)).toBeLessThanOrEqual(1);
      expect(Math.abs(middle(dot.box).y - middle(head.box).y)).toBeLessThanOrEqual(1);
      expect(Math.abs(middle(dot.box).y - middle(body.box).y)).toBeLessThanOrEqual(1);
      expect(head.box.x).toBe(frame.x);
      expect(head.box.x + head.box.w).toBeLessThan(dot.box.x);
      expect(body.box.x).toBeGreaterThan(dot.box.x + dot.box.w);
      expect(body.box.x + body.box.w).toBe(frame.x + frame.w);
      expect(body.align).toBe('left');
      expect(body.valign).toBe('middle');
      expect(head.box.y).toBeGreaterThan(before);
      before = head.box.y + head.box.h;
      for (const el of [dot, head, body]) expect(inside(el.box, frame)).toBe(true);
    }
    // And back across, in the frame a new time axis has.
    setDirection(figure, 'across');
    settle(scene);
    expect(figure.direction).toBeUndefined();
    expect(figure.box).toMatchObject(NEW_FIGURE_SIZE.timeAxis);
    expect(part(scene, figure, 'axis:line').box.h).toBe(1);
  });

  it('gets the text of an event when it is written, and loses it when it is emptied', () => {
    const { scene, figure } = slide([['1'], ['2']]);
    const [a, b] = figure.items;
    const dot = part(scene, figure, `dot:${a!.id}`).id;
    expect(kinds(scene, figure)).toEqual(['axis', 'dot', 'head', 'dot', 'head']);
    a!.detail = 'A';
    settle(scene);
    const body = part<TextElement>(scene, figure, `body:${a!.id}`);
    expect(plainText(body.content)).toBe('A');
    expect(body.group).toBe(figure.group);
    // The text is changed in the element that is there; the point is still the same one.
    a!.detail = 'A2';
    settle(scene);
    expect(part<TextElement>(scene, figure, `body:${a!.id}`).id).toBe(body.id);
    expect(plainText(part<TextElement>(scene, figure, `body:${a!.id}`).content)).toBe('A2');
    expect(part(scene, figure, `dot:${a!.id}`).id).toBe(dot);
    // Only blanks is nothing written.
    a!.detail = '  \n ';
    settle(scene);
    expect(part(scene, figure, `body:${a!.id}`)).toBeUndefined();
    expect(figure.items).toHaveLength(2);
    expect(part(scene, figure, `head:${b!.id}`)).toBeDefined();
  });

  it('lets a part that is new in a row come in with the rest of the row', () => {
    const { scene, figure } = slide([['1'], ['2', 'B']]);
    const [a, b] = figure.items;
    stepPerItem(scene, figure.id, step);
    expect(scene.timeline).toHaveLength(2);
    const ids = (key: string): string => part(scene, figure, key).id;
    expect(scene.timeline[0]!.actions.map((x) => x.target)).toEqual([
      ids(`dot:${a!.id}`),
      ids(`head:${a!.id}`),
    ]);
    expect(scene.timeline[1]!.actions.map((x) => x.target)).toEqual([
      ids(`dot:${b!.id}`),
      ids(`head:${b!.id}`),
      ids(`body:${b!.id}`),
    ]);
    // The line is there from the start.
    const stepped = scene.timeline.flatMap((s) => s.actions.map((x) => x.target));
    expect(stepped).not.toContain(ids('axis:line'));
    // The text of the first event is written afterwards: it comes in with its event.
    a!.detail = 'A';
    settle(scene);
    expect(scene.timeline[0]!.actions.map((x) => x.target)).toEqual([
      ids(`dot:${a!.id}`),
      ids(`head:${a!.id}`),
      ids(`body:${a!.id}`),
    ]);
    expect(scene.timeline[0]!.actions[2]).toMatchObject({ effect: 'fade', duration: 0.4 });
    expect(scene.timeline[1]!.actions).toHaveLength(3);
    // Emptied again, it leaves its step; a step with nothing left would go too.
    delete a!.detail;
    settle(scene);
    expect(scene.timeline[0]!.actions).toHaveLength(2);
    // A new event is in no step: nothing of it was there before.
    figure.items.push({ id: newId(), text: '3', detail: 'C' });
    settle(scene);
    expect(scene.timeline.flatMap((s) => s.actions)).toHaveLength(5);
  });

  it('gives a new arrow of a process the step of the box it leads to', () => {
    const scene = newScene('content', 'A');
    const figure = newFigure('process', { x: 200, y: 300, w: 1500, h: 200, rotation: 0 }, newId);
    figure.items = ['A', 'B', 'C'].map((text) => ({ id: newId(), text }));
    scene.elements.push(figure);
    settle(scene);
    stepPerItem(scene, figure.id, step);
    const [a] = figure.items;
    // The first box had no arrow leading to it. Moved last, it gets one.
    moveItem(figure, 0, 2);
    settle(scene);
    const arrow = part(scene, figure, `arrow:${a!.id}`);
    const box = part(scene, figure, `box:${a!.id}`);
    const its = scene.timeline.find((s) => s.actions.some((x) => x.target === box.id))!;
    expect(its.actions.map((x) => x.target)).toEqual([box.id, arrow.id]);
  });

  it('takes what is written on the slide into the form', () => {
    const { scene, figure } = slide([['1', 'A'], ['2']]);
    const [a, b] = figure.items;
    expect(writePart(scene, part(scene, figure, `head:${b!.id}`), richText('B2'))).toBe(true);
    expect(b!.text).toBe('B2');
    const body = part<TextElement>(scene, figure, `body:${a!.id}`);
    expect(writePart(scene, body, richText('En', '', ' To '))).toBe(true);
    expect(a!.detail).toBe('En\nTo');
    // Nothing is written in a point or in the line.
    expect(writePart(scene, part(scene, figure, `dot:${a!.id}`), richText('X'))).toBe(false);
    expect(writePart(scene, part(scene, figure, 'axis:line'), richText('X'))).toBe(false);
    settle(scene);
    expect(plainText(part<TextElement>(scene, figure, `body:${a!.id}`).content)).toBe('En\nTo');
    // A text emptied on the slide is gone from the form, and the event stays.
    writePart(scene, part(scene, figure, `body:${a!.id}`), richText(''));
    settle(scene);
    expect(a!.detail).toBeUndefined();
    expect(part(scene, figure, `body:${a!.id}`)).toBeUndefined();
    expect(figure.items).toHaveLength(2);
  });

  it('keeps the event when its text is deleted, and loses it when its point or box is', () => {
    const { scene, figure } = slide([
      ['1', 'A'],
      ['2', 'B'],
      ['3', 'C'],
    ]);
    const [a, b, c] = figure.items;
    // The text alone: the field is emptied.
    deleteElements(scene, [part(scene, figure, `body:${a!.id}`).id]);
    settle(scene);
    expect(figure.items.map((item) => item.id)).toEqual([a!.id, b!.id, c!.id]);
    expect(a!.detail).toBeUndefined();
    expect(part(scene, figure, `body:${a!.id}`)).toBeUndefined();
    // The box with when it is: the event goes, with all that showed it.
    forgetParts(scene, [part(scene, figure, `head:${b!.id}`).id]);
    settle(scene);
    expect(figure.items.map((item) => item.id)).toEqual([a!.id, c!.id]);
    expect(partsOf(scene, figure.id).some((el) => el.of!.part.endsWith(`:${b!.id}`))).toBe(false);
    // The point: the same.
    deleteElements(scene, [part(scene, figure, `dot:${c!.id}`).id]);
    settle(scene);
    expect(figure.items.map((item) => item.id)).toEqual([a!.id]);
    // The line is no event: deleted by itself, it is drawn again.
    deleteElements(scene, [part(scene, figure, 'axis:line').id]);
    settle(scene);
    expect(figure.items).toHaveLength(1);
    expect(part(scene, figure, 'axis:line')).toBeDefined();
    // The whole figure deleted leaves nothing.
    deleteElements(scene, [figure.id, ...partsOf(scene, figure.id).map((el) => el.id)]);
    settle(scene);
    expect(scene.elements).toHaveLength(0);
  });

  it('is made into a free figure, and copied with its slide', () => {
    const { scene, figure } = slide([
      ['1', 'A'],
      ['2', 'B'],
    ]);
    const copy = cloneScene(scene);
    const copied = copy.elements.find((el): el is FigureElement => el.type === 'figure')!;
    expect(copied.id).not.toBe(figure.id);
    expect(partsOf(copy, copied.id)).toHaveLength(partsOf(scene, figure.id).length);
    expect(settle(copy)).toBe(false);

    const group = figure.group!;
    const before = partsOf(scene, figure.id).map((el) => ({ id: el.id, box: el.box }));
    releaseFigure(scene, figure.id);
    settle(scene);
    expect(scene.elements.some((el) => el.type === 'figure' || el.of)).toBe(false);
    expect(scene.elements.map((el) => ({ id: el.id, box: el.box }))).toEqual(before);
    expect(scene.elements.every((el) => el.group === group)).toBe(true);
    // The texts are text boxes like any other now.
    expect(scene.elements.filter((el) => el.type === 'text')).toHaveLength(2);
  });
});

describe('a time axis, drawn and stored', () => {
  const context = (project: Project, mode: 'edit' | 'play'): RenderContext => ({
    doc: document,
    project,
    theme: THEME_REN,
    mode,
    assetUrl: () => undefined,
    logo: {},
    strings: SCENE_STRINGS.nb,
  });

  it('is drawn as its shapes and texts, in the order of the form', () => {
    const project = newProject('Testforelesning');
    const { scene } = slide([
      ['1', 'A'],
      ['2', 'B'],
    ]);
    project.scenes.push(scene);
    const { figure } = { figure: scene.elements.find((el) => el.type === 'figure')! };
    const root = renderScene(context(project, 'play'), scene);
    expect(root.textContent).toBe('1A2B');
    // The line, the points and the boxes are shapes; the frame shows nothing.
    expect(root.querySelectorAll('.ls-el-shape')).toHaveLength(5);
    expect(root.querySelectorAll('.ls-el-text')).toHaveLength(2);
    expect(root.querySelector(`[data-el="${figure.id}"]`)!.textContent).toBe('');
  });

  it('is read one event at a time, as a comparison is read one column at a time', () => {
    const project = newProject('Testforelesning');
    const { scene, figure } = slide([
      ['1', 'A'],
      ['2', 'B'],
      ['3', 'C'],
    ]);
    // A text box that stands under the figure is read after all of it, a title before.
    scene.elements.unshift({
      id: 'under',
      type: 'text',
      role: 'body',
      content: richText('Under'),
      align: 'left',
      valign: 'top',
      box: { x: 200, y: 800, w: 600, h: 80, rotation: 0 },
    });
    scene.elements.push({
      id: 'tittel',
      type: 'text',
      role: 'title',
      content: richText('Tittel'),
      align: 'left',
      valign: 'top',
      box: { x: 200, y: 900, w: 600, h: 80, rotation: 0 },
    });
    project.scenes.push(scene);
    expect(renderScene(context(project, 'play'), scene).textContent).toBe('Tittel1A2B3CUnder');
    // The order is that of the form, also after a row is moved in it.
    moveItem(figure, 2, 0);
    settle(scene);
    expect(renderScene(context(project, 'play'), scene).textContent).toBe('Tittel3C1A2BUnder');

    const columns = newScene('content', 'B');
    const comparison = newFigure(
      'comparison',
      { x: 200, y: 300, ...NEW_FIGURE_SIZE.comparison, rotation: 0 },
      newId,
    );
    comparison.items = [
      { id: newId(), text: 'A', detail: 'En\nTo' },
      { id: newId(), text: 'B', detail: 'Tre' },
    ];
    columns.elements.push(comparison);
    settle(columns);
    expect(renderScene(context(project, 'play'), columns).textContent).toBe('AEnToBTre');
  });

  it('is read back as it was written, and a project from before it is still read', () => {
    const project = newProject('Testforelesning');
    const { scene, figure } = slide([['1', 'A'], ['2']]);
    setDirection(figure, 'down');
    settle(scene);
    project.scenes.push(scene);
    const parsed = parseProject(JSON.parse(JSON.stringify(project)));
    expect(parsed.scenes[0]!.elements).toEqual(scene.elements);
    expect(settle(parsed.scenes[0]!)).toBe(false);
    const old = JSON.parse(JSON.stringify(newProject('A'))) as { version: number };
    old.version = 11;
    expect(parseProject(old).version).toBe(14);
  });
});
