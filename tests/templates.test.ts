// @vitest-environment happy-dom
// Figures that draw themselves from a form: a process, layers, a comparison.
// How their parts are made, laid out and taken away as the form says, how a
// part keeps its step and its "Lær mer" content, and how a figure is made
// into a free one. Nothing here is real subject matter.
import { describe, expect, it } from 'vitest';
import { newProject, newScene, plainText, richText } from '../src/shared/format/factory';
import {
  FORMAT_VERSION,
  parseProject,
  type Element,
  type FigureElement,
  type FigureTemplate,
  type Project,
  type Scene,
  type ShapeElement,
  type Step,
} from '../src/shared/format/schema';
import { followFigures, lineEnds, membersOf, wholeGroup } from '../src/shared/layout/groups';
import {
  NEW_FIGURE_SIZE,
  figureOf,
  followTemplates,
  forgetParts,
  moveItem,
  newFigure,
  partsOf,
  releaseFigure,
  setDirection,
  stepPerItem,
  wholeFigure,
  writePart,
} from '../src/shared/layout/templates';
import { SCENE_STRINGS, renderScene, type RenderContext } from '../src/shared/render/scene';
import { THEME_REN } from '../src/shared/theme/theme';
import { cloneElements, cloneScene, deleteElements } from '../src/renderer/src/ops';

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

/** A slide with one figure with the texts given, in a frame at (200, 300). */
function slide(template: FigureTemplate, texts: string[]): { scene: Scene; figure: FigureElement } {
  const scene = newScene('content', 'A');
  const size = NEW_FIGURE_SIZE[template];
  const figure = newFigure(template, { x: 200, y: 300, ...size, rotation: 0 }, newId);
  figure.items = texts.map((text) => ({ id: newId(), text }));
  scene.elements.push(figure);
  settle(scene);
  return { scene, figure };
}

const part = (scene: Scene, figure: FigureElement, key: string): ShapeElement =>
  scene.elements.find((el) => el.of?.figure === figure.id && el.of.part === key) as ShapeElement;
const texts = (scene: Scene, figure: FigureElement, kind = 'box'): string[] =>
  figure.items.map((item) => {
    const content = part(scene, figure, `${kind}:${item.id}`).content;
    return content ? plainText(content) : '';
  });

describe('a figure that draws itself from its form', () => {
  it('starts with an empty form, and shows nothing but its parts', () => {
    const scene = newScene('content', 'A');
    const figure = newFigure('process', { x: 100, y: 100, w: 900, h: 200, rotation: 0 }, newId);
    expect(figure.items).toHaveLength(3);
    expect(figure.items.every((item) => item.text === '')).toBe(true);
    scene.elements.push(figure);
    expect(settle(scene)).toBe(true);
    // Three boxes without text and two arrows, grouped with the figure.
    const parts = partsOf(scene, figure.id) as ShapeElement[];
    expect(parts.map((el) => el.geometry)).toEqual([
      'roundRect',
      'roundRect',
      'arrow',
      'roundRect',
      'arrow',
    ]);
    expect(parts.every((el) => el.content === undefined)).toBe(true);
    expect(figure.group).toBeDefined();
    expect(membersOf(scene, figure.group!)).toHaveLength(6);
    expect(wholeGroup(scene, [figure.id, ...parts.map((el) => el.id)])).toBe(figure.group);
    expect(wholeFigure(scene, [figure.id, ...parts.map((el) => el.id)])).toBe(figure);
    expect(wholeFigure(scene, [figure.id])).toBeUndefined();
    // Everything is in place: asking again changes nothing.
    expect(settle(scene)).toBe(false);
  });

  it('lays a process out across its frame, with arrows between the boxes', () => {
    const { scene, figure } = slide('process', ['A', 'B', 'C']);
    expect(texts(scene, figure)).toEqual(['A', 'B', 'C']);
    const boxes = figure.items.map((item) => part(scene, figure, `box:${item.id}`).box);
    // The boxes fill the frame from side to side, are equally wide, and as high as the frame.
    expect(boxes[0]!.x).toBe(200);
    expect(boxes[2]!.x + boxes[2]!.w).toBe(200 + figure.box.w);
    expect(Math.abs(boxes[0]!.w - boxes[1]!.w)).toBeLessThanOrEqual(1);
    expect(boxes.every((box) => box.y === 300 && box.h === figure.box.h)).toBe(true);
    expect(boxes[1]!.x).toBeGreaterThan(boxes[0]!.x + boxes[0]!.w + 40);
    // The arrow that leads to B is fastened to A and B, and lies in the gap between them.
    const arrow = part(scene, figure, `arrow:${figure.items[1]!.id}`);
    expect(arrow.startAt).toBe(part(scene, figure, `box:${figure.items[0]!.id}`).id);
    expect(arrow.endAt).toBe(part(scene, figure, `box:${figure.items[1]!.id}`).id);
    const ends = lineEnds(arrow);
    expect(ends.start.x).toBeGreaterThan(boxes[0]!.x + boxes[0]!.w);
    expect(ends.end.x).toBeLessThan(boxes[1]!.x);
    expect(ends.end.x).toBeGreaterThan(ends.start.x);
    expect(scene.elements.filter((el) => el.of?.part.startsWith('arrow:'))).toHaveLength(2);
  });

  it('follows its frame when the frame is moved or resized', () => {
    const { scene, figure } = slide('process', ['A', 'B']);
    figure.box = { x: 100, y: 600, w: 800, h: 120, rotation: 0 };
    expect(settle(scene)).toBe(true);
    const first = part(scene, figure, `box:${figure.items[0]!.id}`);
    const second = part(scene, figure, `box:${figure.items[1]!.id}`);
    expect(first.box).toMatchObject({ x: 100, y: 600, h: 120 });
    expect(second.box.x + second.box.w).toBe(900);
    const arrow = part(scene, figure, `arrow:${figure.items[1]!.id}`);
    expect(lineEnds(arrow).start.x).toBeGreaterThan(first.box.x + first.box.w);
    // A part that is moved by hand is put back: the form decides.
    first.box.x = 1500;
    first.fill = 'oransje';
    expect(settle(scene)).toBe(true);
    expect(first.box.x).toBe(100);
    expect(first.fill).toBe('lilla');
    expect(settle(scene)).toBe(false);
  });

  it('turns a process to run down, in a frame that suits it', () => {
    const { scene, figure } = slide('process', ['A', 'B', 'C']);
    setDirection(figure, 'down');
    settle(scene);
    expect(figure.direction).toBe('down');
    expect(figure.box.h).toBeGreaterThan(figure.box.w);
    const boxes = figure.items.map((item) => part(scene, figure, `box:${item.id}`).box);
    expect(boxes.every((box) => box.x === figure.box.x && box.w === figure.box.w)).toBe(true);
    expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y + boxes[0]!.h);
    const arrow = part(scene, figure, `arrow:${figure.items[1]!.id}`);
    expect(lineEnds(arrow).end.y).toBeGreaterThan(lineEnds(arrow).start.y);
    // And back: the field for the direction is gone, as before it was chosen.
    setDirection(figure, 'across');
    settle(scene);
    expect(figure.direction).toBeUndefined();
    expect(figure.box).toMatchObject(NEW_FIGURE_SIZE.process);
    // A frame near the edge of the slide is kept on the slide when it is turned.
    figure.box.x = 1900 - figure.box.w;
    figure.box.y = 900;
    setDirection(figure, 'down');
    expect(figure.box.y + figure.box.h).toBeLessThanOrEqual(1080);
  });

  it('lays layers on each other, in colours that tell them apart', () => {
    const { scene, figure } = slide('layers', ['A', 'B', 'C']);
    const layers = figure.items.map((item) => part(scene, figure, `box:${item.id}`));
    expect(layers.map((el) => el.geometry)).toEqual(['rect', 'rect', 'rect']);
    // They tile the frame from top to bottom, without gaps.
    expect(layers[0]!.box.y).toBe(300);
    expect(layers[1]!.box.y).toBe(layers[0]!.box.y + layers[0]!.box.h);
    expect(layers[2]!.box.y + layers[2]!.box.h).toBe(300 + figure.box.h);
    expect(new Set(layers.map((el) => el.fill)).size).toBe(3);
    expect(partsOf(scene, figure.id)).toHaveLength(3);
    // In the lecturer's one colour they are told apart by a gap instead.
    figure.color = 'oransje';
    settle(scene);
    expect(layers.every((el) => el.fill === 'oransje')).toBe(true);
    expect(layers[1]!.box.y).toBeGreaterThan(layers[0]!.box.y + layers[0]!.box.h);
  });

  it('lays a comparison out in columns: a heading over its points', () => {
    const { scene, figure } = slide('comparison', ['A', 'B']);
    figure.items[0]!.detail = 'En\n\n  To  ';
    settle(scene);
    const head = part(scene, figure, `head:${figure.items[0]!.id}`);
    const body = part(scene, figure, `body:${figure.items[0]!.id}`);
    const other = part(scene, figure, `body:${figure.items[1]!.id}`);
    expect(plainText(head.content!)).toBe('A');
    // One point for each line that has something on it.
    expect(body.content!.paragraphs.map((p) => [p.list, p.runs[0]!.text])).toEqual([
      ['bullet', 'En'],
      ['bullet', 'To'],
    ]);
    expect(other.content).toBeUndefined();
    expect(body.box.y).toBe(head.box.y + head.box.h);
    expect(body.box.y + body.box.h).toBe(300 + figure.box.h);
    expect(body.box.x).toBe(head.box.x);
    expect(other.box.x).toBeGreaterThan(body.box.x + body.box.w);
    // The body is an outline in the colour of the heading, with its text from the top left.
    expect(body.fill).toBeUndefined();
    expect(body.stroke).toBe(head.fill);
    expect([body.align, body.valign]).toEqual(['left', 'top']);
    expect(body.fontSize!).toBeLessThan(head.fontSize!);
  });

  it('keeps the step and the "Lær mer" of a part when its row is changed or moved', () => {
    const { scene, figure } = slide('process', ['A', 'B', 'C']);
    const b = part(scene, figure, `box:${figure.items[1]!.id}`);
    b.more = { title: '', blocks: [{ id: 'm1', kind: 'heading', text: 'Overskrift' }] };
    scene.timeline = [step([b.id])];
    figure.items[1]!.text = 'B2';
    moveItem(figure, 1, 0);
    settle(scene);
    expect(texts(scene, figure)).toEqual(['B2', 'A', 'C']);
    // The same element, now first in the row, with what it had.
    expect(part(scene, figure, `box:${figure.items[0]!.id}`).id).toBe(b.id);
    expect(b.more?.blocks).toHaveLength(1);
    expect(scene.timeline[0]!.actions[0]!.target).toBe(b.id);
    expect(b.box.x).toBe(200);
    // The arrows lead to the second and the third box, whichever rows those are now.
    const arrows = scene.elements.filter((el) =>
      el.of?.part.startsWith('arrow:'),
    ) as ShapeElement[];
    expect(arrows.map((el) => el.of!.part).sort()).toEqual(
      [`arrow:${figure.items[1]!.id}`, `arrow:${figure.items[2]!.id}`].sort(),
    );
    expect(settle(scene)).toBe(false);
  });

  it('takes away the parts of a row that is removed, and their steps', () => {
    const { scene, figure } = slide('process', ['A', 'B', 'C']);
    const c = part(scene, figure, `box:${figure.items[2]!.id}`);
    const arrow = part(scene, figure, `arrow:${figure.items[2]!.id}`);
    scene.timeline = [step([c.id, arrow.id]), step([figure.id])];
    figure.items.pop();
    settle(scene);
    expect(partsOf(scene, figure.id)).toHaveLength(3);
    expect(scene.elements.some((el) => el.id === c.id || el.id === arrow.id)).toBe(false);
    expect(scene.timeline.map((s) => s.actions.map((a) => a.target))).toEqual([[figure.id]]);
    // A row that is added gets its parts, in front of the rest of the figure.
    scene.elements.push({
      id: 'last',
      type: 'shape',
      geometry: 'rect',
      box: { x: 0, y: 0, w: 10, h: 10, rotation: 0 },
    });
    figure.items.push({ id: 'ny', text: 'D' });
    settle(scene);
    expect(texts(scene, figure)).toEqual(['A', 'B', 'D']);
    expect(scene.elements[scene.elements.length - 1]!.id).toBe('last');
    expect(settle(scene)).toBe(false);
  });

  it('deletes a row when its part is deleted by itself, and everything when all is deleted', () => {
    const { scene, figure } = slide('comparison', ['A', 'B', 'C']);
    const body = part(scene, figure, `body:${figure.items[1]!.id}`);
    deleteElements(scene, [body.id]);
    settle(scene);
    // The heading of the column went with its body.
    expect(figure.items.map((item) => item.text)).toEqual(['A', 'C']);
    expect(partsOf(scene, figure.id)).toHaveLength(4);
    const all = [figure.id, ...partsOf(scene, figure.id).map((el) => el.id)];
    deleteElements(scene, all);
    settle(scene);
    expect(scene.elements).toHaveLength(0);
    // An arrow of a process is not a row: deleted, it is there again as long as its boxes are.
    const process = slide('process', ['A', 'B']);
    const arrow = part(process.scene, process.figure, `arrow:${process.figure.items[1]!.id}`);
    forgetParts(process.scene, [arrow.id]);
    expect(process.figure.items).toHaveLength(2);
  });

  it('takes what is written in a part on the slide into the form', () => {
    const { scene, figure } = slide('comparison', ['A', 'B']);
    const head = part(scene, figure, `head:${figure.items[0]!.id}`);
    const body = part(scene, figure, `body:${figure.items[0]!.id}`);
    expect(writePart(scene, head, richText('A2'))).toBe(true);
    expect(writePart(scene, body, richText('En', '', 'To'))).toBe(true);
    settle(scene);
    expect(figure.items[0]).toMatchObject({ text: 'A2', detail: 'En\nTo' });
    expect(plainText(head.content!)).toBe('A2');
    expect(body.content!.paragraphs).toHaveLength(2);
    expect(writePart(scene, body, richText(''))).toBe(true);
    expect(figure.items[0]!.detail).toBeUndefined();
    // A part that is being written in for the first time has an empty text, which is left there.
    const empty = part(scene, figure, `body:${figure.items[1]!.id}`);
    empty.content = richText();
    expect(settle(scene)).toBe(true);
    expect(empty.content).toBeDefined();
    // Something that is no part of a figure is not written anywhere.
    const loose: Element = {
      id: 'x',
      type: 'shape',
      geometry: 'rect',
      box: { x: 0, y: 0, w: 10, h: 10, rotation: 0 },
    };
    expect(writePart(scene, loose, richText('A'))).toBe(false);
  });

  it('gives each row its step, with the arrow that leads to it', () => {
    const { scene, figure } = slide('process', ['A', 'B', 'C']);
    scene.timeline = [step(['other']), step([figure.id])];
    stepPerItem(scene, figure.id, step);
    const id = (key: string): string => part(scene, figure, key).id;
    const [a, b, c] = figure.items;
    expect(scene.timeline.map((s) => s.actions.map((action) => action.target))).toEqual([
      ['other'],
      [id(`box:${a!.id}`)],
      [id(`box:${b!.id}`), id(`arrow:${b!.id}`)],
      [id(`box:${c!.id}`), id(`arrow:${c!.id}`)],
    ]);
    // In a comparison a heading comes in with its points.
    const compared = slide('comparison', ['A', 'B']);
    stepPerItem(compared.scene, compared.figure.id, step);
    expect(compared.scene.timeline.map((s) => s.actions.length)).toEqual([2, 2]);
  });

  it('is made into a free figure: the form goes, and the shapes stay as a group', () => {
    const { scene, figure } = slide('process', ['A', 'B']);
    const ids = partsOf(scene, figure.id).map((el) => el.id);
    const group = figure.group!;
    scene.timeline = [step([ids[0]!]), step([figure.id])];
    releaseFigure(scene, figure.id);
    expect(settle(scene)).toBe(false);
    expect(scene.elements.map((el) => el.id)).toEqual(ids);
    expect(scene.elements.every((el) => el.of === undefined && el.group === group)).toBe(true);
    expect(scene.timeline).toHaveLength(1);
    // The arrow is still fastened, and a box can now be changed by hand.
    const arrow = scene.elements.find(
      (el): el is ShapeElement => el.type === 'shape' && el.geometry === 'arrow',
    )!;
    expect([arrow.startAt, arrow.endAt]).toEqual([ids[0], ids[1]]);
    const box = scene.elements[0] as ShapeElement;
    box.fill = 'oransje';
    box.box.y += 300;
    settle(scene);
    expect(box.fill).toBe('oransje');
    expect(lineEnds(arrow).start.y).toBeGreaterThan(300 + NEW_FIGURE_SIZE.process.h);
    // A figure whose frame is deleted by itself is a free figure in the same way.
    const other = slide('layers', ['A', 'B']);
    deleteElements(other.scene, [other.figure.id]);
    settle(other.scene);
    expect(other.scene.elements).toHaveLength(2);
    expect(other.scene.elements.every((el) => el.of === undefined)).toBe(true);
  });

  it('is copied whole, and a part copied by itself is a shape like any other', () => {
    const { scene, figure } = slide('process', ['A', 'B']);
    const all = [figure, ...partsOf(scene, figure.id)];
    const copies = cloneElements(all, 24);
    scene.elements.push(...copies);
    settle(scene);
    const copy = copies[0] as FigureElement;
    expect(copy.type).toBe('figure');
    expect(copy.group).not.toBe(figure.group);
    expect(partsOf(scene, copy.id)).toHaveLength(3);
    expect(partsOf(scene, figure.id)).toHaveLength(3);
    expect(scene.elements).toHaveLength(8);
    expect(figureOf(scene, copies[1]!)).toBe(copy);
    expect((copies[1] as ShapeElement).box.x).toBe(224);
    const [alone] = cloneElements([part(scene, figure, `box:${figure.items[0]!.id}`)], 24);
    expect(alone!.of).toBeUndefined();
    // A copy of the slide has its own figure, with its own parts.
    const second = cloneScene(scene);
    settle(second);
    expect(second.elements).toHaveLength(scene.elements.length + 0);
    const ids = new Set(scene.elements.map((el) => el.id));
    expect(second.elements.some((el) => ids.has(el.id) || (el.of && ids.has(el.of.figure)))).toBe(
      false,
    );
  });
});

describe('a figure with a form, drawn and stored', () => {
  function context(project: Project, mode: 'play' | 'edit'): RenderContext {
    return {
      doc: document,
      project,
      theme: THEME_REN,
      mode,
      assetUrl: () => undefined,
      logo: {},
      strings: SCENE_STRINGS.nb,
    };
  }

  it('is drawn as its shapes; the frame itself shows nothing to a student', () => {
    const project = newProject('Testforelesning');
    const { scene, figure } = slide('process', ['A', 'B']);
    project.scenes.push(scene);
    const played = renderScene(context(project, 'play'), scene);
    const frame = played.querySelector(`[data-el="${figure.id}"]`)!;
    expect(frame.textContent).toBe('');
    expect(frame.querySelector('.ls-figure')!.getAttribute('aria-hidden')).toBe('true');
    expect(played.querySelectorAll('.ls-el-shape')).toHaveLength(3);
    expect(
      Array.from(played.querySelectorAll('.ls-shape-content')).map((el) => el.textContent),
    ).toEqual(['A', 'B']);
    // With an empty form it says so in the editor, and still nothing to a student.
    figure.items = [];
    settle(scene);
    expect(scene.elements).toHaveLength(1);
    expect(renderScene(context(project, 'edit'), scene).textContent).toContain(
      'Figuren er tom. Legg til i skjemaet.',
    );
    expect(renderScene(context(project, 'play'), scene).textContent).toBe('');
  });

  it('is read back as it was written, and older projects are still read', () => {
    const project = newProject('Testforelesning');
    const { scene, figure } = slide('comparison', ['A', 'B']);
    figure.items[0]!.detail = 'En\nTo';
    figure.color = 'indigo';
    figure.fontSize = 40;
    settle(scene);
    project.scenes.push(scene);
    const parsed = parseProject(JSON.parse(JSON.stringify(project)));
    expect(parsed.scenes[0]!.elements).toEqual(scene.elements);
    // What was read is already as the form says.
    expect(settle(parsed.scenes[0]!)).toBe(false);
    const old = JSON.parse(JSON.stringify(newProject('A'))) as { version: number };
    old.version = 10;
    expect(parseProject(old).version).toBe(FORMAT_VERSION);
    expect(FORMAT_VERSION).toBe(17);
  });
});
