// @vitest-environment happy-dom
// The figure «Nettverk»: the form says what nodes and connections there
// are, and the lecturer says where they are. How parts are made and taken
// away, how places and paths are kept, how ends dragged on the slide are
// taken into the form, «Ordne nodene», steps, and how it is read by those
// who cannot see it. Nothing here is real subject matter.
import { describe, expect, it } from 'vitest';
import { newProject, newScene, plainText } from '../src/shared/format/factory';
import { stageFor } from '../src/shared/format/constants';
import {
  parseProject,
  type FigureElement,
  type Project,
  type Scene,
  type ShapeElement,
  type Step,
} from '../src/shared/format/schema';
import {
  fastenEnd,
  followFigures,
  lineEnds,
  linePath,
  nearestOnPath,
  setLinePath,
} from '../src/shared/layout/groups';
import {
  arrangeNodes,
  freePlace,
  linkEndOnLink,
  removeNode,
  setLinkEnd,
  takeLinkEnds,
} from '../src/shared/layout/network';
import {
  NEW_FIGURE_SIZE,
  followTemplates,
  newFigure,
  releaseFigure,
  stepPerItem,
  writePart,
} from '../src/shared/layout/templates';
import { SCENE_STRINGS, renderScene, type RenderContext } from '../src/shared/render/scene';
import { THEME_REN } from '../src/shared/theme/theme';
import { cloneElements, deleteElements } from '../src/renderer/src/ops';
import { richText } from '../src/shared/format/factory';

let counter = 0;
const newId = (): string => `n${++counter}`;
const newStep = (targets: string[]): Step => ({
  id: newId(),
  actions: targets.map((target) => ({ target, effect: 'fade' as const, duration: 0.4 })),
});

function settle(scene: Scene): void {
  followTemplates(scene);
  followFigures(scene);
}

/** A slide with a network of the nodes given, in a frame at (200, 200). */
function slide(texts: string[]): { scene: Scene; figure: FigureElement } {
  const scene = newScene('content', 'A');
  const figure = newFigure('network', { x: 200, y: 200, ...NEW_FIGURE_SIZE.network, rotation: 0 }, newId);
  scene.elements.push(figure);
  figure.items = texts.map((text) => ({ id: newId(), text }));
  settle(scene);
  return { scene, figure: scene.elements[0] as FigureElement };
}

const node = (scene: Scene, figure: FigureElement, i: number): ShapeElement =>
  scene.elements.find(
    (el) => el.of?.figure === figure.id && el.of.part === `node:${figure.items[i]!.id}`,
  ) as ShapeElement;
const link = (scene: Scene, figure: FigureElement, id: string): ShapeElement =>
  scene.elements.find((el) => el.of?.figure === figure.id && el.of.part === `link:${id}`) as ShapeElement;
const connect = (figure: FigureElement, from: number, to: number, arrow = false): string => {
  const id = newId();
  figure.links = [
    ...(figure.links ?? []),
    { id, from: figure.items[from]!.id, to: figure.items[to]!.id, ...(arrow ? { arrow } : {}) },
  ];
  return id;
};
const overlaps = (a: ShapeElement, b: ShapeElement): boolean =>
  a.box.x < b.box.x + b.box.w &&
  b.box.x < a.box.x + a.box.w &&
  a.box.y < b.box.y + b.box.h &&
  b.box.y < a.box.y + a.box.h;

describe('a network made from its form', () => {
  it('starts with no nodes and no connections, and shows only the empty figure', () => {
    const scene = newScene('content', 'A');
    const figure = newFigure('network', { x: 0, y: 0, w: 1200, h: 640, rotation: 0 }, newId);
    expect(figure.items).toEqual([]);
    expect(figure.links).toEqual([]);
    scene.elements.push(figure);
    settle(scene);
    expect(scene.elements).toHaveLength(1);
  });

  it('makes a node for each row, in free places inside the frame, and a line for each connection', () => {
    const { scene, figure } = slide(['A', 'B', 'C']);
    const nodes = [0, 1, 2].map((i) => node(scene, figure, i));
    expect(nodes.map((el) => plainText(el.content!))).toEqual(['A', 'B', 'C']);
    for (const el of nodes) {
      expect(el.box.x).toBeGreaterThanOrEqual(figure.box.x);
      expect(el.box.x + el.box.w).toBeLessThanOrEqual(figure.box.x + figure.box.w);
      expect(el.box.y + el.box.h).toBeLessThanOrEqual(figure.box.y + figure.box.h);
      expect(el.group).toBe(figure.group);
    }
    expect(overlaps(nodes[0]!, nodes[1]!) || overlaps(nodes[1]!, nodes[2]!) || overlaps(nodes[0]!, nodes[2]!)).toBe(false);
    const ab = connect(figure, 0, 1, true);
    const bc = connect(figure, 1, 2);
    settle(scene);
    const arrow = link(scene, figure, ab);
    expect(arrow.geometry).toBe('arrow');
    expect(arrow.startAt).toBe(nodes[0]!.id);
    expect(arrow.endAt).toBe(nodes[1]!.id);
    expect(link(scene, figure, bc).geometry).toBe('line');
    // A new connection runs straight.
    expect(arrow.points).toBeUndefined();
  });

  it('never moves a node or reshapes a connection when the form changes', () => {
    const { scene, figure } = slide(['A', 'B']);
    const ab = connect(figure, 0, 1);
    settle(scene);
    node(scene, figure, 0).box.x += 300;
    node(scene, figure, 0).box.y += 100;
    settle(scene);
    const line = link(scene, figure, ab);
    setLinePath(line, [lineEnds(line).start, { x: 600, y: 900 }, lineEnds(line).end]);
    fastenEnd(line, 'end', { at: node(scene, figure, 1).id, side: 'bottom' });
    settle(scene);
    const before = structuredClone(scene.elements);
    figure.items[0]!.text = 'AA';
    figure.color = 'indigo';
    figure.nodeShape = 'ellipse';
    figure.items.push({ id: newId(), text: 'C' });
    settle(scene);
    const was = (id: string) => before.find((el) => el.id === id)!;
    expect(node(scene, figure, 0).box).toEqual(was(node(scene, figure, 0).id).box);
    expect(node(scene, figure, 0).geometry).toBe('ellipse');
    expect(node(scene, figure, 0).fill).toBe('indigo');
    expect(link(scene, figure, ab).points).toEqual((was(line.id) as ShapeElement).points);
    expect(link(scene, figure, ab).endSide).toBe('bottom');
    // The new node is put where there was room.
    expect(overlaps(node(scene, figure, 2), node(scene, figure, 1))).toBe(false);
  });

  it('takes away a node with its connections, and a connection by itself', () => {
    const { scene, figure } = slide(['A', 'B', 'C']);
    const ab = connect(figure, 0, 1);
    const bc = connect(figure, 1, 2);
    settle(scene);
    removeNode(figure, figure.items[0]!.id);
    settle(scene);
    expect(figure.links!.map((one) => one.id)).toEqual([bc]);
    expect(link(scene, figure, ab)).toBeUndefined();
    expect(scene.elements.filter((el) => el.of?.figure === figure.id)).toHaveLength(3);
    // Deleted on the slide: a connection leaves the form, and a node takes its connections.
    deleteElements(scene, [link(scene, figure, bc).id]);
    settle(scene);
    expect(figure.links).toEqual([]);
    connect(figure, 0, 1);
    settle(scene);
    deleteElements(scene, [node(scene, figure, 1).id]);
    settle(scene);
    expect(figure.items.map((item) => item.text)).toEqual(['B']);
    expect(figure.links).toEqual([]);
  });

  it('takes what is written in a node on the slide into the form', () => {
    const { scene, figure } = slide(['A']);
    expect(writePart(scene, node(scene, figure, 0), richText('B'))).toBe(true);
    expect(figure.items[0]!.text).toBe('B');
  });
});

describe('the ends of a connection on the slide', () => {
  it('keep a T-junction on another connection, and go back to their node when let go in the open', () => {
    const { scene, figure } = slide(['A', 'B', 'C']);
    const ab = connect(figure, 0, 1);
    const cb = connect(figure, 2, 1);
    settle(scene);
    const main = link(scene, figure, ab);
    const branch = link(scene, figure, cb);
    fastenEnd(branch, 'end', { at: main.id, along: 0.5 });
    settle(scene);
    expect(branch.endAt).toBe(main.id);
    expect(nearestOnPath(linePath(main), lineEnds(branch).end).distance).toBeLessThan(1);
    expect(linkEndOnLink(scene, figure, cb, 'end')).toEqual({
      link: figure.links![0],
      elsewhere: false,
    });
    // The form still says C to B.
    expect(figure.links![1]!.to).toBe(figure.items[1]!.id);
    // Let go in the open: fastened again to the node the form names.
    fastenEnd(branch, 'end', null);
    settle(scene);
    expect(branch.endAt).toBe(node(scene, figure, 1).id);
  });

  it('let go on another node goes to that node in the form, but never to the node at its other end', () => {
    const { scene, figure } = slide(['A', 'B', 'C']);
    const ab = connect(figure, 0, 1);
    settle(scene);
    const line = link(scene, figure, ab);
    fastenEnd(line, 'end', { at: node(scene, figure, 2).id, side: 'left' });
    takeLinkEnds(scene, line.id);
    settle(scene);
    expect(figure.links![0]!.to).toBe(figure.items[2]!.id);
    expect(line.endAt).toBe(node(scene, figure, 2).id);
    expect(line.endSide).toBe('left');
    fastenEnd(line, 'end', { at: node(scene, figure, 0).id });
    takeLinkEnds(scene, line.id);
    settle(scene);
    expect(figure.links![0]!.to).toBe(figure.items[2]!.id);
    expect(line.endAt).toBe(node(scene, figure, 2).id);
    // Changed in the form, the end on the slide follows.
    setLinkEnd(scene, figure, ab, 'end', figure.items[1]!.id);
    settle(scene);
    expect(line.endAt).toBe(node(scene, figure, 1).id);
  });
});

describe('«Ordne nodene»', () => {
  it('lays the nodes in a ring when nothing gives an order, and straightens the connections', () => {
    const { scene, figure } = slide(['A', 'B', 'C', 'D']);
    const ab = connect(figure, 0, 1);
    connect(figure, 1, 2);
    settle(scene);
    const line = link(scene, figure, ab);
    setLinePath(line, [lineEnds(line).start, { x: 300, y: 900 }, lineEnds(line).end]);
    fastenEnd(line, 'start', { at: node(scene, figure, 0).id, side: 'top' });
    arrangeNodes(scene, figure.id, stageFor('landscape'));
    settle(scene);
    const centre = (i: number) => {
      const b = node(scene, figure, i).box;
      return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    };
    const mid = { x: figure.box.x + figure.box.w / 2, y: figure.box.y + figure.box.h / 2 };
    // The first at the top, then round the ring clockwise.
    expect(Math.abs(centre(0).x - mid.x)).toBeLessThan(1);
    expect(centre(0).y).toBeLessThan(mid.y);
    expect(centre(1).x).toBeGreaterThan(mid.x);
    expect(centre(2).y).toBeGreaterThan(mid.y);
    expect(centre(3).x).toBeLessThan(mid.x);
    expect(line.points).toBeUndefined();
    expect(line.startSide).toBeUndefined();
    expect(line.startAt).toBe(node(scene, figure, 0).id);
  });

  it('lays the nodes in layers when arrows give an order: across a lying slide, down an upright one', () => {
    for (const [orientation, across] of [
      ['landscape', true],
      ['portrait', false],
    ] as const) {
      const { scene, figure } = slide(['A', 'B', 'C']);
      connect(figure, 0, 1, true);
      connect(figure, 1, 2, true);
      settle(scene);
      arrangeNodes(scene, figure.id, stageFor(orientation));
      settle(scene);
      const at = [0, 1, 2].map((i) => node(scene, figure, i).box);
      if (across) {
        expect(at[0]!.x).toBeLessThan(at[1]!.x);
        expect(at[1]!.x).toBeLessThan(at[2]!.x);
      } else {
        expect(at[0]!.y).toBeLessThan(at[1]!.y);
        expect(at[1]!.y).toBeLessThan(at[2]!.y);
      }
    }
    // Arrows that run in a ring give no order: a ring of nodes it is.
    const { scene, figure } = slide(['A', 'B']);
    connect(figure, 0, 1, true);
    connect(figure, 1, 0, true);
    settle(scene);
    expect(() => arrangeNodes(scene, figure.id, stageFor('landscape'))).not.toThrow();
  });

  it('puts a new node in a free place, or where it lies least on others', () => {
    const frame = { x: 0, y: 0, w: 600, h: 300, rotation: 0 };
    const size = { w: 200, h: 100 };
    const first = freePlace(frame, size, []);
    expect(first).toMatchObject({ x: 0, y: 0 });
    const second = freePlace(frame, size, [first]);
    expect(second.x).toBeGreaterThan(200);
    const full = freePlace({ ...frame, w: 200, h: 100 }, size, [first]);
    expect(full).toMatchObject({ x: 0, y: 0 });
  });
});

describe('steps, copies and a free figure', () => {
  it('gives one step per node in the order of the form, with each connection at the later of its nodes', () => {
    const { scene, figure } = slide(['A', 'B', 'C']);
    const ca = connect(figure, 2, 0, true);
    const ab = connect(figure, 0, 1);
    settle(scene);
    stepPerItem(scene, figure.id, newStep);
    expect(scene.timeline.map((step) => step.actions.map((a) => a.target))).toEqual([
      [node(scene, figure, 0).id],
      [node(scene, figure, 1).id, link(scene, figure, ab).id],
      [node(scene, figure, 2).id, link(scene, figure, ca).id],
    ]);
    // A connection added later comes in with the later of its two nodes.
    const bc = connect(figure, 1, 2);
    settle(scene);
    expect(scene.timeline[2]!.actions.map((a) => a.target)).toContain(link(scene, figure, bc).id);
  });

  it('is copied whole with its fastenings, and made free with paths and fastenings kept', () => {
    const { scene, figure } = slide(['A', 'B']);
    const ab = connect(figure, 0, 1);
    settle(scene);
    const line = link(scene, figure, ab);
    setLinePath(line, [lineEnds(line).start, { x: 700, y: 950 }, lineEnds(line).end]);
    settle(scene);
    const copies = cloneElements(scene.elements, 24);
    const copied = new Map(scene.elements.map((el, i) => [el.id, copies[i]!]));
    const lineCopy = copied.get(line.id) as ShapeElement;
    expect(lineCopy.startAt).toBe(copied.get(line.startAt!)!.id);
    expect(lineCopy.points).toEqual(line.points);
    scene.elements.push(...copies);
    settle(scene);
    expect(followFigures(scene)).toBe(false);
    releaseFigure(scene, figure.id);
    settle(scene);
    expect(scene.elements.some((el) => el.id === figure.id)).toBe(false);
    expect(line.of).toBeUndefined();
    const start = scene.elements.find((el) => el.id === line.startAt);
    expect(start?.type === 'shape' && plainText(start.content!)).toBe('A');
    expect(line.points).toBeDefined();
    expect(line.group).toBeDefined();
  });
});

describe('a network, read and stored', () => {
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

  it('has its connections as a list that is read and not shown, and its nodes in the order of the form', () => {
    const project = newProject('Testforelesning');
    const { scene, figure } = slide(['A', 'B', 'C']);
    connect(figure, 0, 1, true);
    connect(figure, 1, 2);
    settle(scene);
    // The nodes stand in another order on the slide than in the form.
    node(scene, figure, 0).box.y = 700;
    settle(scene);
    project.scenes.push(scene);
    const played = renderScene(context(project, 'play'), scene);
    const list = played.querySelector(`[data-el="${figure.id}"] .ls-figure-table li`)?.parentElement;
    expect(Array.from(list!.querySelectorAll('li')).map((li) => li.textContent)).toEqual([
      'A til B',
      'B og C',
    ]);
    const order = Array.from(played.querySelectorAll('.ls-shape-content')).map((el) => el.textContent);
    expect(order).toEqual(['A', 'B', 'C']);
    // Not in the editor.
    expect(renderScene(context(project, 'edit'), scene).querySelector('.ls-figure-table')).toBeNull();
  });

  it('is read back as it was written', () => {
    const project = newProject('Testforelesning');
    const { scene, figure } = slide(['A', 'B']);
    connect(figure, 0, 1, true);
    figure.nodeShape = 'rect';
    settle(scene);
    project.scenes.push(scene);
    const parsed = parseProject(JSON.parse(JSON.stringify(project)));
    expect(parsed.scenes[0]!.elements).toEqual(scene.elements);
    const again = parsed.scenes[0]!;
    followTemplates(again);
    expect(followFigures(again)).toBe(false);
    expect(again.elements).toEqual(scene.elements);
  });
});
