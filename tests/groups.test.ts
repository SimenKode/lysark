// Free figures: elements that are grouped, and lines and arrows fastened to
// other elements. How a group is made and broken up, how a fastened line
// follows what it is fastened to, and how both are copied. Nothing here is
// real subject matter.
import { describe, expect, it } from 'vitest';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import {
  FORMAT_VERSION,
  parseProject,
  type Element,
  type Scene,
  type ShapeElement,
  type Step,
} from '../src/shared/format/schema';
import {
  LINE_GAP,
  canGroup,
  connect,
  edgePoint,
  fastenTargetAt,
  followFigures,
  groupElements,
  letGoMoved,
  lineEnds,
  membersOf,
  scaleInto,
  setLineEnds,
  stepPerPart,
  ungroupElements,
  unionBox,
  wholeGroup,
  withGroups,
} from '../src/shared/layout/groups';
import { addMark, followMarks } from '../src/shared/layout/marks';
import { cloneElements, cloneScene } from '../src/renderer/src/ops';

let counter = 0;
const newId = (): string => `x_${++counter}`;
const step = (targets: string[]): Step => ({
  id: `st_${targets.join('_')}`,
  actions: targets.map((target) => ({ target, effect: 'fade' as const, duration: 0.4 })),
});

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

function line(id: string, from: [number, number], to: [number, number]): ShapeElement {
  const el: ShapeElement = {
    id,
    type: 'shape',
    geometry: 'arrow',
    box: { x: 0, y: 0, w: 1, h: 1, rotation: 0 },
  };
  setLineEnds(el, { x: from[0], y: from[1] }, { x: to[0], y: to[1] });
  return el;
}

/** Three boxes in a row, A, B and C, 100 apart, and nothing else. */
function slide(): Scene {
  const scene = newScene('content', 'A');
  scene.elements.push(box('a', 100, 400), box('b', 400, 400), box('c', 700, 400));
  return scene;
}

const shape = (scene: Scene, id: string): ShapeElement =>
  scene.elements.find((el) => el.id === id) as ShapeElement;

describe('groups', () => {
  it('are made of two or more elements, and broken up again', () => {
    const scene = slide();
    expect(canGroup(scene, ['a'])).toBe(false);
    expect(groupElements(scene, ['a'], newId)).toEqual([]);
    expect(canGroup(scene, ['a', 'b'])).toBe(true);
    expect(groupElements(scene, ['a', 'b'], newId)).toEqual(['a', 'b']);
    const group = shape(scene, 'a').group!;
    expect(shape(scene, 'b').group).toBe(group);
    expect(shape(scene, 'c').group).toBeUndefined();
    expect(membersOf(scene, group).map((el) => el.id)).toEqual(['a', 'b']);
    // One of them brings the other; the whole of it is known as the whole.
    expect(withGroups(scene, ['b'])).toEqual(['a', 'b']);
    expect(wholeGroup(scene, ['a', 'b'])).toBe(group);
    expect(wholeGroup(scene, ['a'])).toBeUndefined();
    expect(wholeGroup(scene, ['a', 'b', 'c'])).toBeUndefined();
    // What is one group already cannot be grouped again.
    expect(canGroup(scene, ['a', 'b'])).toBe(false);
    expect(canGroup(scene, ['a'])).toBe(false);
    ungroupElements(scene, ['b']);
    expect(scene.elements.every((el) => el.group === undefined)).toBe(true);
  });

  it('do not lie inside groups: a group and one more become one group', () => {
    const scene = slide();
    groupElements(scene, ['a', 'b'], newId);
    const before = shape(scene, 'a').group;
    // Only one member of the old group is named; the whole of it comes along.
    expect(groupElements(scene, ['b', 'c'], newId)).toEqual(['a', 'b', 'c']);
    const group = shape(scene, 'c').group!;
    expect(group).not.toBe(before);
    expect(membersOf(scene, group)).toHaveLength(3);
  });

  it('are no groups with one member left, and never hold marks', () => {
    const scene = slide();
    groupElements(scene, ['a', 'b'], newId);
    scene.elements = scene.elements.filter((el) => el.id !== 'b');
    expect(followFigures(scene)).toBe(true);
    expect(shape(scene, 'a').group).toBeUndefined();
    expect(followFigures(scene)).toBe(false);

    // A picture with a mark is grouped with a box: the mark is not a member.
    const marked = slide();
    marked.elements.push({
      id: 'p',
      type: 'image',
      asset: 'a_x',
      alt: '',
      box: { x: 100, y: 600, w: 400, h: 300, rotation: 0 },
    });
    const mark = addMark(marked, 'p', newId)!;
    const members = groupElements(marked, ['a', 'p', mark.id], newId);
    expect(members).toEqual(['a', 'p']);
    expect(marked.elements.find((el) => el.id === mark.id)!.group).toBeUndefined();
    expect(wholeGroup(marked, ['a', 'p', mark.id])).toBe(shape(marked, 'a').group);
  });

  it('get one step per part, with an arrow coming in with what it leads to', () => {
    const scene = slide();
    const first = connect(scene, 'a', 'b', newId)!;
    const second = connect(scene, 'b', 'c', newId)!;
    groupElements(scene, ['a', 'b', 'c', first.id, second.id], newId);
    const title: Element = {
      id: 't',
      type: 'text',
      role: 'title',
      content: richText('A'),
      align: 'left',
      valign: 'top',
      box: { x: 100, y: 100, w: 800, h: 90, rotation: 0 },
    };
    scene.elements.push(title);
    scene.timeline = [step(['t']), step(['b'])];
    stepPerPart(scene, shape(scene, 'a').group!, step);
    expect(scene.timeline.map((s) => s.actions.map((action) => action.target))).toEqual([
      ['t'],
      ['a'],
      ['b', first.id],
      ['c', second.id],
    ]);
  });
});

describe('a line fastened to elements', () => {
  it('runs between the edges of the two, a little outside them', () => {
    const scene = slide();
    const arrow = connect(scene, 'a', 'b', newId)!;
    expect(arrow.geometry).toBe('arrow');
    expect(arrow.startAt).toBe('a');
    expect(arrow.endAt).toBe('b');
    const ends = lineEnds(arrow);
    // From the right edge of A to the left edge of B, at the height of their middles.
    expect(ends.start.x).toBe(300 + LINE_GAP);
    expect(ends.end.x).toBe(400 - LINE_GAP);
    expect(Math.abs(ends.start.y - 450)).toBeLessThanOrEqual(1);
    expect(Math.abs(ends.end.y - 450)).toBeLessThanOrEqual(1);
    // It is in place already: nothing more to do.
    expect(followFigures(scene)).toBe(false);
  });

  it('follows what it is fastened to, wherever that goes', () => {
    const scene = slide();
    const arrow = connect(scene, 'a', 'b', newId)!;
    shape(scene, 'b').box = { x: 100, y: 800, w: 200, h: 100, rotation: 0 };
    expect(followFigures(scene)).toBe(true);
    const ends = lineEnds(arrow);
    // B is straight below A now: the line runs from the bottom of A to the top of B.
    expect(ends.start.y).toBe(500 + LINE_GAP);
    expect(ends.end.y).toBe(800 - LINE_GAP);
    expect(Math.abs(ends.start.x - 200)).toBeLessThanOrEqual(1);
    expect(Math.abs(ends.end.x - 200)).toBeLessThanOrEqual(1);
    // Asking again changes nothing: an upright line does not creep sideways.
    const settled = JSON.stringify(arrow);
    for (let i = 0; i < 5; i++) expect(followFigures(scene)).toBe(false);
    expect(JSON.stringify(arrow)).toBe(settled);

    // To the upper left: the arrow turns, and still points at B.
    shape(scene, 'b').box = { x: 0, y: 0, w: 60, h: 60, rotation: 0 };
    followFigures(scene);
    const turned = lineEnds(arrow);
    expect(turned.end.x).toBeLessThan(turned.start.x);
    expect(turned.end.y).toBeLessThan(turned.start.y);
    expect(arrow.flipH).toBe(true);
    expect(arrow.flipV).toBe(true);
    expect(arrow.box.rotation).toBe(0);
  });

  it('keeps its free end where it is when only one end is fastened', () => {
    const scene = slide();
    const free = line('l', [900, 900], [450, 520]);
    free.endAt = 'b';
    scene.elements.push(free);
    followFigures(scene);
    expect(lineEnds(free).start).toEqual({ x: 900, y: 900 });
    // The fastened end is on the edge of B that faces the free end.
    const end = lineEnds(free).end;
    expect(end.y).toBe(500 + LINE_GAP);
    expect(end.x).toBeGreaterThan(500);
    shape(scene, 'b').box.x += 300;
    followFigures(scene);
    expect(lineEnds(free).start).toEqual({ x: 900, y: 900 });
    expect(lineEnds(free).end.x).toBeGreaterThan(end.x);
  });

  it('meets an ellipse on its round edge, and a turned box on its turned edge', () => {
    const round = box('o', 0, 0, 200, 100);
    round.geometry = 'ellipse';
    const p = edgePoint(round, { x: 1000, y: 1000 }, 0);
    // On the ellipse itself, not in the corner of its box.
    expect(((p.x - 100) / 100) ** 2 + ((p.y - 50) / 50) ** 2).toBeCloseTo(1, 6);
    expect(p.x).toBeLessThan(200);
    const square = box('s', 0, 0, 100, 100);
    expect(edgePoint(square, { x: 1000, y: 50 }, 0)).toEqual({ x: 100, y: 50 });
    square.box.rotation = 45;
    const corner = edgePoint(square, { x: 1000, y: 50 }, 0);
    // Turned 45 degrees, the box has a corner to the right, further out than its side was.
    expect(corner.x).toBeCloseTo(50 + Math.SQRT2 * 50, 6);
    expect(corner.y).toBeCloseTo(50, 6);
  });

  it('is let go when what it was fastened to is gone, and lies where it lay', () => {
    const scene = slide();
    const arrow = connect(scene, 'a', 'b', newId)!;
    const before = { ...arrow.box };
    scene.elements = scene.elements.filter((el) => el.id !== 'b');
    expect(followFigures(scene)).toBe(true);
    expect(arrow.endAt).toBeUndefined();
    expect(arrow.startAt).toBe('a');
    expect(arrow.box).toEqual(before);
    // A line is never fastened to a line, to itself, or twice to the same element.
    const other = line('m', [0, 0], [50, 50]);
    scene.elements.push(other);
    arrow.endAt = 'm';
    followFigures(scene);
    expect(arrow.endAt).toBeUndefined();
    arrow.endAt = 'a';
    followFigures(scene);
    expect(arrow.endAt).toBeUndefined();
    // A shape that is no longer a line has nothing fastened.
    arrow.geometry = 'rect';
    followFigures(scene);
    expect(arrow.startAt).toBeUndefined();
  });

  it('is let go when it is moved by itself, but not when moved with what it joins', () => {
    const scene = slide();
    const arrow = connect(scene, 'a', 'b', newId)!;
    letGoMoved(scene, ['a', 'b', arrow.id]);
    expect([arrow.startAt, arrow.endAt]).toEqual(['a', 'b']);
    letGoMoved(scene, ['a', arrow.id]);
    expect([arrow.startAt, arrow.endAt]).toEqual(['a', undefined]);
    letGoMoved(scene, [arrow.id]);
    expect(arrow.startAt).toBeUndefined();
  });

  it('is fastened to what lies in front where its end is let go, but not to a background', () => {
    const scene = slide();
    scene.elements.unshift({
      id: 'bg',
      type: 'image',
      asset: 'a_x',
      alt: '',
      decorative: true,
      box: { x: 0, y: 0, w: 1920, h: 1080, rotation: 0 },
    });
    const arrow = line('l', [900, 900], [450, 450]);
    scene.elements.push(arrow);
    expect(fastenTargetAt(scene, { x: 450, y: 450 }, 'l')?.id).toBe('b');
    // On the background only, and on the line itself: nothing to fasten to.
    expect(fastenTargetAt(scene, { x: 1500, y: 200 }, 'l')).toBeUndefined();
    expect(fastenTargetAt(scene, { x: 900, y: 900 }, 'l')).toBeUndefined();
    // Of two that overlap, the one in front.
    scene.elements.push(box('d', 420, 420));
    expect(fastenTargetAt(scene, { x: 450, y: 450 }, 'l')?.id).toBe('d');
  });

  it('joins the group of the two it is put between', () => {
    const scene = slide();
    groupElements(scene, ['a', 'b'], newId);
    const inside = connect(scene, 'a', 'b', newId)!;
    expect(inside.group).toBe(shape(scene, 'a').group);
    const across = connect(scene, 'b', 'c', newId)!;
    expect(across.group).toBeUndefined();
    expect(connect(scene, 'a', 'a', newId)).toBeNull();
    expect(connect(scene, 'a', inside.id, newId)).toBeNull();
  });
});

describe('copying', () => {
  it('keeps a copied group together as a group of its own, with its lines fastened to the copies', () => {
    const scene = slide();
    const arrow = connect(scene, 'a', 'b', newId)!;
    groupElements(scene, ['a', 'b', arrow.id], newId);
    const group = shape(scene, 'a').group!;
    const copies = cloneElements(membersOf(scene, group), 24);
    scene.elements.push(...copies);
    expect(followFigures(scene)).toBe(false);
    const [a2, b2, arrow2] = copies as [ShapeElement, ShapeElement, ShapeElement];
    expect(a2.group).toBeDefined();
    expect(a2.group).not.toBe(group);
    expect(b2.group).toBe(a2.group);
    expect(arrow2.group).toBe(a2.group);
    expect(arrow2.startAt).toBe(a2.id);
    expect(arrow2.endAt).toBe(b2.id);
    expect(membersOf(scene, group)).toHaveLength(3);
  });

  it('lets a copied line go from what was not copied with it', () => {
    const scene = slide();
    const arrow = connect(scene, 'a', 'b', newId)!;
    const [copy] = cloneElements([arrow], 24) as [ShapeElement];
    expect(copy.startAt).toBeUndefined();
    expect(copy.endAt).toBeUndefined();
    scene.elements.push(copy);
    followFigures(scene);
    // The copy lies beside the original, not on top of it.
    expect(copy.box.x).toBe(arrow.box.x + 24);
    // One part copied out of a group is not in a group.
    groupElements(scene, ['a', 'b'], newId);
    const [part] = cloneElements([shape(scene, 'a')], 24);
    scene.elements.push(part!);
    followFigures(scene);
    expect(part!.group).toBeUndefined();
    expect(shape(scene, 'a').group).toBeDefined();
  });

  it('copies a slide with its groups, its fastened lines and the marks on its pictures', () => {
    const scene = slide();
    scene.elements.push({
      id: 'p',
      type: 'image',
      asset: 'a_x',
      alt: '',
      box: { x: 100, y: 600, w: 400, h: 300, rotation: 0 },
    });
    addMark(scene, 'p', newId);
    const arrow = connect(scene, 'a', 'b', newId)!;
    groupElements(scene, ['a', 'b', arrow.id], newId);
    const copy = cloneScene(scene);
    followMarks(copy);
    followFigures(copy);
    expect(copy.elements).toHaveLength(scene.elements.length);
    const ids = new Set(scene.elements.map((el) => el.id));
    expect(copy.elements.some((el) => ids.has(el.id))).toBe(false);
    const copied = copy.elements.find(
      (el): el is ShapeElement => el.type === 'shape' && el.geometry === 'arrow',
    )!;
    const own = new Set(copy.elements.map((el) => el.id));
    expect(own.has(copied.startAt!)).toBe(true);
    expect(own.has(copied.endAt!)).toBe(true);
    expect(copy.elements.filter((el) => el.group !== undefined)).toHaveLength(3);
    // The mark and the legend of the picture came along.
    expect(copy.elements.filter((el) => el.type === 'mark')).toHaveLength(1);
    expect(copy.elements.filter((el) => el.type === 'legend')).toHaveLength(1);
  });
});

describe('several elements resized as one', () => {
  it('keep their places and their shares of the frame round them', () => {
    const scene = slide();
    const frame = unionBox(scene.elements.map((el) => el.box));
    expect(frame).toEqual({ x: 100, y: 400, w: 800, h: 100, rotation: 0 });
    const to = { x: 100, y: 400, w: 1600, h: 200, rotation: 0 };
    expect(scaleInto(shape(scene, 'a').box, frame, to)).toEqual({
      x: 100,
      y: 400,
      w: 400,
      h: 200,
      rotation: 0,
    });
    expect(scaleInto(shape(scene, 'c').box, frame, to)).toEqual({
      x: 1300,
      y: 400,
      w: 400,
      h: 200,
      rotation: 0,
    });
    // A turned box takes the room its corners need.
    const turned = unionBox([{ x: 0, y: 0, w: 100, h: 100, rotation: 45 }]);
    expect(turned.w).toBeCloseTo(Math.SQRT2 * 100, 6);
    expect(turned.x).toBeCloseTo(50 - Math.SQRT2 * 50, 6);
  });
});

describe('groups and fastened lines in the format', () => {
  it('are read back as they were written, and older projects are still read', () => {
    const project = newProject('Testforelesning');
    const scene = slide();
    const arrow = connect(scene, 'a', 'b', newId)!;
    groupElements(scene, ['a', 'b', arrow.id], newId);
    project.scenes.push(scene);
    const parsed = parseProject(JSON.parse(JSON.stringify(project)));
    expect(parsed.scenes[0]!.elements).toEqual(scene.elements);
    expect(parsed.version).toBe(FORMAT_VERSION);
    const old = JSON.parse(JSON.stringify(newProject('A'))) as { version: number };
    old.version = 9;
    expect(parseProject(old).version).toBe(FORMAT_VERSION);
    expect(FORMAT_VERSION).toBe(11);
  });
});
