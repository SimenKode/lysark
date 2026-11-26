// @vitest-environment happy-dom
// Lines and arrows that bend through points, and whose ends are fastened to
// a fastening point of a box or to another line (a T-junction). How the path
// is stored, how a fastened end follows, how rings are refused, how a line
// is copied, and how it is drawn. Nothing here is real subject matter.
import { describe, expect, it } from 'vitest';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import {
  FORMAT_VERSION,
  parseProject,
  type Scene,
  type ShapeElement,
  type Step,
} from '../src/shared/format/schema';
import {
  LINE_GAP,
  addPathPoint,
  canFastenToLine,
  connect,
  fastenEnd,
  followFigures,
  groupElements,
  letGoMoved,
  lineEnds,
  linePath,
  nearestOnPath,
  pointAlong,
  removePathPoint,
  scaleInto,
  setLineEnds,
  setLinePath,
  sidePoint,
  snapPathPoint,
  stepPerPart,
  straighten,
  unionBox,
} from '../src/shared/layout/groups';
import { fetchFigure, figuresOn } from '../src/shared/layout/fetch';
import { SCENE_STRINGS, renderScene, type RenderContext } from '../src/shared/render/scene';
import { THEME_REN } from '../src/shared/theme/theme';
import { cloneElements, cloneScene } from '../src/renderer/src/ops';

let counter = 0;
const newId = (): string => `l_${++counter}`;

function box(id: string, x: number, y: number, w = 200, h = 100): ShapeElement {
  return {
    id,
    type: 'shape',
    geometry: 'rect',
    fill: 'lilla',
    content: richText(id.toUpperCase()),
    box: { x, y, w, h, rotation: 0 },
  };
}

function line(id: string, ...points: Array<[number, number]>): ShapeElement {
  const el: ShapeElement = {
    id,
    type: 'shape',
    geometry: 'arrow',
    box: { x: 0, y: 0, w: 1, h: 1, rotation: 0 },
  };
  setLinePath(
    el,
    points.map(([x, y]) => ({ x, y })),
  );
  return el;
}

const shape = (scene: Scene, id: string): ShapeElement =>
  scene.elements.find((el) => el.id === id) as ShapeElement;

/** Two boxes, A at (100, 400) and B at (700, 400), each 200 x 100. */
function slide(): Scene {
  const scene = newScene('content', 'A');
  scene.elements.push(box('a', 100, 400), box('b', 700, 400));
  return scene;
}

const close = (p: { x: number; y: number }, q: { x: number; y: number }, by = 0.6): void => {
  expect(Math.abs(p.x - q.x)).toBeLessThanOrEqual(by);
  expect(Math.abs(p.y - q.y)).toBeLessThanOrEqual(by);
};

describe('the path of a line', () => {
  it('is the diagonal of its box without points, as every line was before', () => {
    const el = line('l', [300, 200], [100, 400]);
    expect(el.points).toBeUndefined();
    expect(el.flipH).toBe(true);
    expect(linePath(el)).toEqual([
      { x: 300, y: 200 },
      { x: 100, y: 400 },
    ]);
  });

  it('is stored as fractions of the smallest box that holds it, and stands where it was given', () => {
    const el = line('l', [100, 100], [400, 100], [400, 300]);
    expect(el.box).toEqual({ x: 100, y: 100, w: 300, h: 200, rotation: 0 });
    expect(el.points).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
    expect(el.flipH).toBeUndefined();
    expect(lineEnds(el)).toEqual({ start: { x: 100, y: 100 }, end: { x: 400, y: 300 } });
    // A point between whole pixels stays where it is: the box is in whole pixels round it.
    const odd = line('m', [10.5, 20.25], [50, 80], [90.75, 20]);
    expect(odd.box).toEqual({ x: 10, y: 20, w: 81, h: 60, rotation: 0 });
    linePath(odd).forEach((p, i) => close(p, [{ x: 10.5, y: 20.25 }, { x: 50, y: 80 }, { x: 90.75, y: 20 }][i]!, 1e-3));
  });

  it('gets a point where it is double-clicked, loses it again, and is straightened', () => {
    // A flat line is drawn through the middle of its one pixel, and bends from there.
    const el = line('l', [100, 100], [500, 100]);
    expect(addPathPoint(el, { x: 300, y: 130 })).toBe(1);
    expect(linePath(el)).toEqual([
      { x: 100, y: 100.5 },
      { x: 300, y: 100.5 },
      { x: 500, y: 100.5 },
    ]);
    setLinePath(el, [
      { x: 100, y: 100 },
      { x: 300, y: 300 },
      { x: 500, y: 100 },
    ]);
    removePathPoint(el, 1);
    expect(el.points).toBeUndefined();
    // Straight again, it is the diagonal of a box one pixel thin, drawn through its middle.
    expect(el.box).toEqual({ x: 100, y: 100, w: 400, h: 1, rotation: 0 });
    const bent = line('m', [0, 0], [100, 50], [200, 0], [300, 50]);
    // The ends are never taken away.
    removePathPoint(bent, 0);
    removePathPoint(bent, 3);
    expect(linePath(bent)).toHaveLength(4);
    straighten(bent);
    expect(bent.points).toBeUndefined();
    expect(lineEnds(bent)).toEqual({ start: { x: 0, y: 0 }, end: { x: 300, y: 50 } });
  });

  it('is measured by length, for an end that lies along it', () => {
    const path = linePath(line('l', [0, 0], [300, 0], [300, 100]));
    expect(pointAlong(path, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(path, 0.5)).toEqual({ x: 200, y: 0 });
    expect(pointAlong(path, 0.875)).toEqual({ x: 300, y: 50 });
    expect(pointAlong(path, 1)).toEqual({ x: 300, y: 100 });
    const near = nearestOnPath(path, { x: 320, y: 50 });
    expect(near.point).toEqual({ x: 300, y: 50 });
    expect(near.along).toBeCloseTo(0.875, 6);
    expect(near.segment).toBe(1);
  });

  it('scales with its points when the group it is in changes size', () => {
    const el = line('l', [100, 100], [300, 100], [300, 200]);
    const from = unionBox([el.box]);
    el.box = scaleInto(el.box, from, { x: 100, y: 100, w: 400, h: 200, rotation: 0 });
    expect(linePath(el)).toEqual([
      { x: 100, y: 100 },
      { x: 500, y: 100 },
      { x: 500, y: 300 },
    ]);
  });
});

describe('an end fastened to a fastening point of a box', () => {
  it('lies at the middle of that side, a little outside it, and follows the box', () => {
    const scene = slide();
    const el = line('l', [500, 200], [600, 200]);
    fastenEnd(el, 'start', { at: 'a', side: 'top' });
    fastenEnd(el, 'end', { at: 'b', side: 'bottom' });
    scene.elements.push(el);
    followFigures(scene);
    expect(lineEnds(el).start).toEqual({ x: 200, y: 400 - LINE_GAP });
    expect(lineEnds(el).end).toEqual({ x: 800, y: 500 + LINE_GAP });
    shape(scene, 'a').box.y = 100;
    followFigures(scene);
    expect(lineEnds(el).start).toEqual({ x: 200, y: 100 - LINE_GAP });
    // A turned box has turned fastening points.
    expect(sidePoint({ box: { x: 0, y: 0, w: 200, h: 100, rotation: 90 } }, 'top', 0)).toEqual({
      x: expect.closeTo(150, 6) as number,
      y: expect.closeTo(50, 6) as number,
    });
  });

  it('moves only its end when the box moves; the points between stay where they are', () => {
    const scene = slide();
    const el = line('l', [310, 450], [500, 450], [500, 250], [690, 250]);
    fastenEnd(el, 'start', { at: 'a', side: 'right' });
    fastenEnd(el, 'end', { at: 'b' });
    scene.elements.push(el);
    followFigures(scene);
    const before = linePath(el);
    expect(before[0]).toEqual({ x: 300 + LINE_GAP, y: 450 });
    shape(scene, 'b').box.y = 200;
    followFigures(scene);
    const after = linePath(el);
    expect(after.slice(1, 3)).toEqual(before.slice(1, 3));
    // By itself, the end lies on the side of B that faces the line's last point before it.
    close(after[3]!, { x: 700 - LINE_GAP, y: 250 });
  });

  it('is fastened by itself to the side that faces the next point, as before', () => {
    const scene = slide();
    const plain = connect(scene, 'a', 'b', newId)!;
    expect(lineEnds(plain).start.x).toBe(300 + LINE_GAP);
    expect(followFigures(scene)).toBe(false);
    // With a point above the boxes, both ends leave from the tops.
    setLinePath(plain, [lineEnds(plain).start, { x: 500, y: 100 }, lineEnds(plain).end]);
    followFigures(scene);
    const path = linePath(plain);
    close(path[0]!, edgeToward(shape(scene, 'a'), { x: 500, y: 100 }), 0.01);
    expect(path[0]!.y).toBeLessThan(400);
    expect(path[2]!.y).toBeLessThan(400);
  });
});

function edgeToward(el: ShapeElement, p: { x: number; y: number }): { x: number; y: number } {
  // The point on the edge of a rectangle, LINE_GAP outside it, on the way from its middle to p.
  const mx = el.box.x + el.box.w / 2;
  const my = el.box.y + el.box.h / 2;
  const dx = p.x - mx;
  const dy = p.y - my;
  const k = Math.min((el.box.w / 2 + LINE_GAP) / Math.abs(dx), (el.box.h / 2 + LINE_GAP) / Math.abs(dy));
  return { x: mx + dx * k, y: my + dy * k };
}

describe('an end fastened to another line', () => {
  it('lies on that line, as far along it as it says, and follows it when it moves or bends', () => {
    const scene = slide();
    const main = connect(scene, 'a', 'b', newId)!;
    const branch = line('t', [500, 700], [500, 600]);
    fastenEnd(branch, 'end', { at: main.id, along: 0.5 });
    scene.elements.push(branch);
    followFigures(scene);
    expect(lineEnds(branch).end).toEqual(pointAlong(linePath(main), 0.5));
    expect(lineEnds(branch).start).toEqual({ x: 500, y: 700 });
    // B goes up: the line between A and B slants, and the T-junction stays on it.
    shape(scene, 'b').box.y = 100;
    followFigures(scene);
    const on = nearestOnPath(linePath(main), lineEnds(branch).end);
    expect(on.distance).toBeLessThan(0.75);
    expect(on.along).toBeCloseTo(0.5, 2);
    // The main line is bent: still on it, halfway along it by length.
    setLinePath(main, [lineEnds(main).start, { x: 500, y: 900 }, lineEnds(main).end]);
    followFigures(scene);
    close(lineEnds(branch).end, pointAlong(linePath(main), 0.5), 0.75);
  });

  it('is laid after the line it is fastened to, wherever they lie on the slide', () => {
    const scene = slide();
    const branch = line('t', [500, 800], [500, 700]);
    scene.elements.push(branch);
    const main = connect(scene, 'a', 'b', newId)!;
    fastenEnd(branch, 'end', { at: main.id, along: 0.25 });
    followFigures(scene);
    expect(followFigures(scene)).toBe(false);
    close(lineEnds(branch).end, pointAlong(linePath(main), 0.25));
  });

  it('is refused when it would close a ring, and a ring that is there is broken', () => {
    const scene = slide();
    const one = line('one', [100, 700], [400, 700]);
    const two = line('two', [400, 600], [400, 900]);
    const three = line('three', [100, 900], [400, 900]);
    scene.elements.push(one, two, three);
    expect(canFastenToLine(scene, 'one', 'one')).toBe(false);
    fastenEnd(two, 'start', { at: 'one', along: 1 });
    fastenEnd(three, 'end', { at: 'two', along: 1 });
    expect(canFastenToLine(scene, 'one', 'two')).toBe(false);
    expect(canFastenToLine(scene, 'one', 'three')).toBe(false);
    expect(canFastenToLine(scene, 'three', 'one')).toBe(true);
    // Written into the file all the same, the end that closes the ring is let go.
    fastenEnd(one, 'end', { at: 'three', along: 0 });
    followFigures(scene);
    const fastened = [one, two, three].filter((el) => el.endAt !== undefined || el.startAt !== undefined);
    expect(fastened).toHaveLength(2);
    // The ring was broken where it closed: TWO is no longer fastened to ONE.
    expect(two.startAt).toBeUndefined();
    expect(one.endAt).toBe('three');
    // Snapping never offers an end that would close it again.
    const snap = snapPathPoint(scene, 'two', linePath(two), 0, lineEnds(one).start, { reach: 10 });
    expect(snap.fasten?.at).not.toBe('one');
    expect(snap.line?.id).not.toBe('one');
  });

  it('is let go when the line it was fastened to is gone, and lies where it lay', () => {
    const scene = slide();
    const main = connect(scene, 'a', 'b', newId)!;
    const branch = line('t', [500, 700], [500, 600]);
    fastenEnd(branch, 'end', { at: main.id, along: 0.5 });
    scene.elements.push(branch);
    followFigures(scene);
    const end = lineEnds(branch).end;
    scene.elements = scene.elements.filter((el) => el.id !== main.id);
    followFigures(scene);
    expect(branch.endAt).toBeUndefined();
    expect(branch.endAlong).toBeUndefined();
    expect(lineEnds(branch).end).toEqual(end);
  });
});

describe('a line that is moved', () => {
  it('is let go when moved by itself, and stays fastened, with its points, when moved with what it joins', () => {
    const scene = slide();
    const el = line('l', [310, 450], [500, 300], [690, 450]);
    fastenEnd(el, 'start', { at: 'a', side: 'right' });
    fastenEnd(el, 'end', { at: 'b', side: 'left' });
    scene.elements.push(el);
    followFigures(scene);
    const before = linePath(el);
    // Moved together with both boxes: everything moves 50 to the right.
    for (const id of ['a', 'b', 'l']) shape(scene, id).box.x += 50;
    letGoMoved(scene, ['a', 'b', 'l']);
    followFigures(scene);
    expect(el.startSide).toBe('right');
    expect(el.endAt).toBe('b');
    linePath(el).forEach((p, i) => close(p, { x: before[i]!.x + 50, y: before[i]!.y }));
    // Moved by itself, it is let go and keeps its shape where it was put.
    el.box.y += 100;
    letGoMoved(scene, ['l']);
    expect(el.startAt).toBeUndefined();
    expect(el.startSide).toBeUndefined();
    expect(el.endAt).toBeUndefined();
    followFigures(scene);
    expect(linePath(el)[1]).toEqual({ x: before[1]!.x + 50, y: before[1]!.y + 100 });
  });
});

describe('snapping an end or a point that is dragged', () => {
  const reach = 10;

  it('takes a fastening point of a box it comes near, or the box by itself', () => {
    const scene = slide();
    const el = line('l', [500, 200], [600, 200]);
    scene.elements.push(el);
    const path = linePath(el);
    const onDot = snapPathPoint(scene, 'l', path, 1, { x: 205, y: 395 }, { reach });
    expect(onDot.box).toEqual({ id: 'a', chosen: 'top' });
    expect(onDot.fasten).toEqual({ at: 'a', side: 'top' });
    expect(onDot.point).toEqual({ x: 200, y: 400 - LINE_GAP });
    const inside = snapPathPoint(scene, 'l', path, 1, { x: 150, y: 470 }, { reach });
    expect(inside.box).toEqual({ id: 'a' });
    expect(inside.fasten).toEqual({ at: 'a' });
    // Near the box but on none of its dots: the dots are shown, and the end is not fastened.
    const nearby = snapPathPoint(scene, 'l', path, 1, { x: 120, y: 385 }, { reach });
    expect(nearby.box).toEqual({ id: 'a' });
    expect(nearby.fasten).toBeNull();
  });

  it('takes another line: its own points first, otherwise anywhere along it', () => {
    const scene = slide();
    const other = line('o', [100, 800], [400, 800], [400, 1000]);
    const el = line('l', [700, 700], [800, 700]);
    scene.elements.push(other, el);
    const path = linePath(el);
    const corner = snapPathPoint(scene, 'l', path, 0, { x: 408, y: 808 }, { reach });
    expect(corner.point).toEqual({ x: 400, y: 800 });
    expect(corner.line?.id).toBe('o');
    expect(corner.fasten).toEqual({ at: 'o', along: 0.6 });
    const along = snapPathPoint(scene, 'l', path, 0, { x: 250, y: 806 }, { reach });
    expect(along.point).toEqual({ x: 250, y: 800 });
    expect(along.fasten).toEqual({ at: 'o', along: 0.3 });
    // A point between the ends only snaps to the place; it is not fastened.
    const bent = line('b', [700, 700], [750, 650], [800, 700]);
    scene.elements.push(bent);
    const middle = snapPathPoint(scene, 'b', linePath(bent), 1, { x: 250, y: 806 }, { reach });
    expect(middle.point).toEqual({ x: 250, y: 800 });
    expect(middle.fasten).toBeNull();
  });

  it('lies straight across or up from the points beside it, and on the grid', () => {
    const scene = newScene('content', 'A');
    const el = line('l', [100, 100], [300, 300], [500, 300]);
    scene.elements.push(el);
    const snap = snapPathPoint(scene, 'l', linePath(el), 1, { x: 106, y: 296 }, { reach });
    expect(snap.point).toEqual({ x: 100, y: 300 });
    expect(snap.guides).toHaveLength(2);
    const grid = snapPathPoint(scene, 'l', linePath(el), 1, { x: 207, y: 203 }, {
      reach,
      grid: { x: [200], y: [210] },
    });
    expect(grid.point).toEqual({ x: 200, y: 210 });
    expect(grid.grid).toEqual({ x: 200, y: 210 });
  });
});

describe('copies of lines', () => {
  it('keep their paths and fastenings, with the ids of the copies', () => {
    const scene = slide();
    const main = connect(scene, 'a', 'b', newId)!;
    setLinePath(main, [lineEnds(main).start, { x: 500, y: 200 }, lineEnds(main).end]);
    fastenEnd(main, 'start', { at: 'a', side: 'top' });
    const branch = line('t', [500, 700], [500, 600]);
    fastenEnd(branch, 'end', { at: main.id, along: 0.5 });
    scene.elements.push(branch);
    followFigures(scene);
    const copies = cloneElements(scene.elements, 24);
    const ids = new Map(scene.elements.map((el, i) => [el.id, copies[i]!.id]));
    const mainCopy = copies.find((el) => el.id === ids.get(main.id)) as ShapeElement;
    const branchCopy = copies.find((el) => el.id === ids.get('t')) as ShapeElement;
    expect(mainCopy.points).toEqual(main.points);
    expect(mainCopy.startAt).toBe(ids.get('a'));
    expect(mainCopy.startSide).toBe('top');
    expect(branchCopy.endAt).toBe(mainCopy.id);
    expect(branchCopy.endAlong).toBe(0.5);
    // Copied without the line it is fastened to, the end is let go.
    const alone = cloneElements([branch], 24)[0] as ShapeElement;
    expect(alone.endAt).toBeUndefined();
    expect(alone.endAlong).toBeUndefined();
    // A copy of the slide maps them too.
    const slideCopy = cloneScene(scene);
    const t = slideCopy.elements.find((el) => el.type === 'shape' && el.endAlong === 0.5) as ShapeElement;
    expect(slideCopy.elements.some((el) => el.id === t.endAt)).toBe(true);
    expect(followFigures(slideCopy)).toBe(false);
  });

  it('come with their group into a "Lær mer" box, and come in at a step with what they join', () => {
    const scene = slide();
    const main = connect(scene, 'a', 'b', newId)!;
    const branch = line('t', [500, 700], [500, 600]);
    fastenEnd(branch, 'end', { at: main.id, along: 0.5 });
    scene.elements.push(branch, box('c', 400, 750));
    fastenEnd(branch, 'start', { at: 'c' });
    followFigures(scene);
    groupElements(scene, ['a', 'b', 'c', main.id, 't'], newId);
    const fetched = fetchFigure(scene, figuresOn(scene)[0]!, newId)!;
    const copy = fetched.elements.find((el) => el.type === 'shape' && el.endAlong === 0.5) as ShapeElement;
    expect(fetched.elements.some((el) => el.id === copy.endAt)).toBe(true);
    const steps: Step[] = [];
    stepPerPart(scene, shape(scene, 'a').group!, (targets) => {
      const made: Step = { id: newId(), actions: targets.map((target) => ({ target, effect: 'fade', duration: 0.4 })) };
      steps.push(made);
      return made;
    });
    // C comes last; the line from C to the line between A and B comes with it.
    expect(scene.timeline.map((one) => one.actions.map((a) => a.target))).toEqual([
      ['a'],
      ['b', main.id],
      ['c', 't'],
    ]);
  });
});

describe('a bent line, drawn and stored', () => {
  function context(): RenderContext {
    return {
      doc: document,
      project: newProject('Testforelesning'),
      theme: THEME_REN,
      mode: 'play',
      assetUrl: () => undefined,
      logo: {},
      strings: SCENE_STRINGS.nb,
    };
  }

  it('is drawn through its points, with the head of an arrow along its last stretch', () => {
    const scene = newScene('content', 'A');
    const el = line('l', [100, 100], [400, 100], [400, 300]);
    el.strokeWidth = 4;
    scene.elements.push(el);
    const drawn = renderScene(context(), scene).querySelector('[data-el="l"]')!;
    const polyline = drawn.querySelector('svg > polyline')!;
    const head = drawn.querySelector('svg > polygon')!;
    const points = polyline
      .getAttribute('points')!
      .split(' ')
      .map((pair) => pair.split(',').map(Number));
    expect(points[0]).toEqual([0, 0]);
    expect(points[1]).toEqual([300, 0]);
    // The stroke stops where the head begins (a head of 4 * 3 + 6 = 18), straight down.
    expect(points[2]![0]).toBe(300);
    expect(points[2]![1]).toBeCloseTo(200 - 18 * 0.9, 6);
    const tip = head.getAttribute('points')!.split(' ')[0]!.split(',').map(Number);
    expect(tip).toEqual([300, 200]);
    const wings = head
      .getAttribute('points')!
      .split(' ')
      .slice(1)
      .map((pair) => pair.split(',').map(Number));
    // Both wings lie 18 above the tip: the head points down, the way the last stretch runs.
    expect(wings.every((p) => Math.abs(p[1]! - (200 - 18)) < 0.01)).toBe(true);
    // A straight line is drawn as before.
    const straight = newScene('content', 'B');
    straight.elements.push(line('s', [100, 100], [300, 200]));
    expect(renderScene(context(), straight).querySelector('[data-el="s"] svg > line')).not.toBeNull();
  });

  it('is read back as it was written, and older projects are still read', () => {
    const project = newProject('Testforelesning');
    const scene = slide();
    const main = connect(scene, 'a', 'b', newId)!;
    setLinePath(main, [lineEnds(main).start, { x: 500, y: 200 }, lineEnds(main).end]);
    fastenEnd(main, 'end', { at: 'b', side: 'top' });
    const branch = line('t', [500, 700], [500, 600]);
    fastenEnd(branch, 'end', { at: main.id, along: 0.5 });
    scene.elements.push(branch);
    followFigures(scene);
    project.scenes.push(scene);
    const parsed = parseProject(JSON.parse(JSON.stringify(project)));
    expect(parsed.scenes[0]!.elements).toEqual(scene.elements);
    expect(followFigures(parsed.scenes[0]!)).toBe(false);
    const old = JSON.parse(JSON.stringify(newProject('A'))) as { version: number };
    old.version = 19;
    expect(parseProject(old).version).toBe(FORMAT_VERSION);
    expect(FORMAT_VERSION).toBe(20);
    // A straight line from before keeps its diagonal.
    const straight = line('s', [300, 100], [100, 200]);
    setLineEnds(straight, { x: 300, y: 100 }, { x: 100, y: 200 });
    expect(lineEnds(straight)).toEqual({ start: { x: 300, y: 100 }, end: { x: 100, y: 200 } });
  });
});
