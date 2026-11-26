// @vitest-environment happy-dom
// Marks on a picture: numbered points with a legend, or labels with a line.
// How they keep with their picture, how they are numbered and drawn, and
// how they come in at steps. Nothing here is real subject matter.
import { describe, expect, it } from 'vitest';
import { newScene } from '../src/shared/format/factory';
import {
  FORMAT_VERSION,
  parseProject,
  type ImageElement,
  type MarkElement,
  type Project,
  type Scene,
  type Step,
} from '../src/shared/format/schema';
import { fitToGrid } from '../src/shared/layout/fitToGrid';
import {
  MARK_SIZE,
  addMark,
  followMarks,
  labelLineStart,
  legendOf,
  markNumber,
  markStyle,
  marksOf,
  setMarkStyle,
  stepPerMark,
} from '../src/shared/layout/marks';
import { SCENE_STRINGS, renderScene, type RenderContext } from '../src/shared/render/scene';
import { applySceneState, sceneState } from '../src/shared/render/timeline';
import { THEME_REN } from '../src/shared/theme/theme';
import { sampleProject } from './fixtures/sampleProject';

function context(project: Project, mode: 'play' | 'edit' = 'play'): RenderContext {
  return {
    doc: document,
    project,
    theme: THEME_REN,
    mode,
    assetUrl: (id) => (project.assets[id] ? `asset:${id}` : undefined),
    logo: {},
    strings: SCENE_STRINGS.nb,
  };
}

let counter = 0;
const newId = (): string => `e_test_${++counter}`;
const step = (target: string): Step => ({
  id: `st_${target}`,
  actions: [{ target, effect: 'fade', duration: 0.4 }],
});

/** A slide with one picture, 800 x 400, at (200, 300). */
function slide(): { scene: Scene; image: ImageElement; project: Project } {
  const { project } = sampleProject();
  const scene = newScene('content', 'A');
  const image: ImageElement = {
    id: 'e_bilde',
    type: 'image',
    asset: Object.keys(project.assets)[0]!,
    alt: 'Bilde A',
    box: { x: 200, y: 300, w: 800, h: 400, rotation: 0 },
  };
  scene.elements.push(image);
  project.scenes = [scene];
  return { scene, image, project };
}

describe('marks on a picture', () => {
  it('are numbered points at first, with a legend that is made with the first one', () => {
    const { scene, image } = slide();
    expect(markStyle(image)).toBe('numbers');
    const first = addMark(scene, image.id, newId)!;
    const second = addMark(scene, image.id, newId)!;
    expect(marksOf(scene, image.id).map((m) => m.id)).toEqual([first.id, second.id]);
    expect(markNumber(scene, first)).toBe(1);
    expect(markNumber(scene, second)).toBe(2);
    // The mark is round, of one size, with its middle on what it points at, on the picture.
    expect(first.box.w).toBe(MARK_SIZE);
    expect(first.box.h).toBe(MARK_SIZE);
    expect(first.box.x + MARK_SIZE / 2).toBe(first.point.x);
    expect(first.point.x).toBeGreaterThan(200);
    expect(first.point.x).toBeLessThan(1000);
    expect(second.point).not.toEqual(first.point);
    // One legend, beside the picture, however many marks there are.
    const legend = legendOf(scene, image.id)!;
    expect(scene.elements.filter((el) => el.type === 'legend')).toHaveLength(1);
    expect(legend.box.x).toBeGreaterThanOrEqual(1000);
    expect(addMark(scene, 'finnes-ikke', newId)).toBeNull();
    expect(followMarks(scene)).toBe(true); // the legend learns where its picture is
    expect(followMarks(scene)).toBe(false); // and then all is in place
  });

  it('follow the picture when it is moved, whether they were moved along or left behind', () => {
    const { scene, image } = slide();
    const mark = addMark(scene, image.id, newId)!;
    followMarks(scene);
    const legend = legendOf(scene, image.id)!;
    const before = { point: { ...mark.point }, legend: { ...legend.box } };
    // Only the picture is moved.
    image.box = { ...image.box, x: image.box.x + 100, y: image.box.y - 50 };
    expect(followMarks(scene)).toBe(true);
    expect(mark.point).toEqual({ x: before.point.x + 100, y: before.point.y - 50 });
    expect(mark.box.x + MARK_SIZE / 2).toBe(mark.point.x);
    expect(legend.box.x).toBe(before.legend.x + 100);
    expect(legend.box.y).toBe(before.legend.y - 50);
    // Picture, mark and legend are all moved at once (a selection that is dragged):
    // nothing is moved twice.
    for (const el of scene.elements) el.box = { ...el.box, x: el.box.x + 30, y: el.box.y + 30 };
    followMarks(scene);
    expect(mark.point).toEqual({ x: before.point.x + 130, y: before.point.y - 20 });
    expect(mark.box.x + MARK_SIZE / 2).toBe(mark.point.x);
    expect(legend.box.x).toBe(before.legend.x + 130);
    expect(followMarks(scene)).toBe(false);
  });

  it('keep their place in the picture when it is made larger', () => {
    const { scene, image } = slide();
    const mark = addMark(scene, image.id, newId)!;
    mark.box = { ...mark.box, x: 400 - MARK_SIZE / 2, y: 400 - MARK_SIZE / 2 };
    followMarks(scene);
    expect(mark.point).toEqual({ x: 400, y: 400 }); // a quarter in, a quarter down
    image.box = { x: 200, y: 300, w: 1600, h: 800, rotation: 0 };
    followMarks(scene);
    expect(mark.point).toEqual({ x: 600, y: 500 });
    expect(mark.box.w).toBe(MARK_SIZE);
  });

  it('are where they are dragged, but never off the picture, and never another size', () => {
    const { scene, image } = slide();
    const mark = addMark(scene, image.id, newId)!;
    followMarks(scene);
    mark.box = { ...mark.box, x: 50, y: 900 };
    followMarks(scene);
    expect(mark.point).toEqual({ x: 200, y: 700 }); // the corner of the picture
    expect(mark.box.x).toBe(200 - MARK_SIZE / 2);
    const point = { ...mark.point };
    mark.box = { ...mark.box, w: 300, h: 20 };
    followMarks(scene);
    expect(mark.box.w).toBe(MARK_SIZE);
    expect(mark.box.h).toBe(MARK_SIZE);
    expect(mark.point).toEqual(point);
  });

  it('go when their picture goes, out of the steps too, and lie in front of it', () => {
    const { scene, image } = slide();
    const mark = addMark(scene, image.id, newId)!;
    scene.timeline = [step(mark.id), step(image.id)];
    // The picture is brought to the front: its marks come along.
    scene.elements = [mark, ...scene.elements.filter((el) => el.id !== mark.id)];
    followMarks(scene);
    const order = scene.elements.map((el) => el.id);
    expect(order.indexOf(mark.id)).toBeGreaterThan(order.indexOf(image.id));
    scene.elements = scene.elements.filter((el) => el.id !== image.id);
    followMarks(scene);
    expect(scene.elements).toHaveLength(0);
    expect(scene.timeline).toEqual([]);
  });

  it('can be labels with a line instead: the legend goes, and the labels lie beside the picture', () => {
    const { scene, image } = slide();
    image.box = { x: 400, y: 300, w: 800, h: 400, rotation: 0 };
    const left = addMark(scene, image.id, newId)!;
    const right = addMark(scene, image.id, newId)!;
    left.box = { ...left.box, x: 500 - MARK_SIZE / 2, y: 400 - MARK_SIZE / 2 };
    right.box = { ...right.box, x: 1100 - MARK_SIZE / 2, y: 400 - MARK_SIZE / 2 };
    left.text = 'A';
    right.text = 'B';
    followMarks(scene);
    scene.timeline = [step(legendOf(scene, image.id)!.id), step(left.id)];
    setMarkStyle(scene, image.id, 'labels', newId);
    followMarks(scene);
    expect(image.marks).toBe('labels');
    expect(legendOf(scene, image.id)).toBeUndefined();
    expect(scene.timeline).toHaveLength(1);
    // Each label lies on the side of the picture its point is nearest, and keeps what it says.
    expect(left.box.x + left.box.w).toBeLessThanOrEqual(400);
    expect(right.box.x).toBeGreaterThanOrEqual(1200);
    expect(left.point).toEqual({ x: 500, y: 400 });
    expect(left.text).toBe('A');
    // The line starts on the edge of the label nearest the point.
    expect(labelLineStart(right.box, right.point)).toEqual({ x: right.box.x, y: 400 });
    // A label is moved freely; what it points at stays, and follows the picture.
    right.box = { ...right.box, x: 1500, y: 100 };
    followMarks(scene);
    expect(right.point).toEqual({ x: 1100, y: 400 });
    image.box = { ...image.box, x: 500 };
    followMarks(scene);
    expect(right.point).toEqual({ x: 1200, y: 400 });
    expect(right.box.x).toBe(1600);
    expect(right.box.y).toBe(100);
    // And back to numbers: round marks on the points, and a legend again.
    setMarkStyle(scene, image.id, 'numbers', newId);
    followMarks(scene);
    expect(image.marks).toBeUndefined();
    expect(right.box.w).toBe(MARK_SIZE);
    expect(right.box.x + MARK_SIZE / 2).toBe(1200);
    expect(legendOf(scene, image.id)).toBeDefined();
  });

  it('puts a label on the other side when there is no room on the side of its point', () => {
    const { scene, image } = slide(); // the picture begins 200 from the left edge: too little for a label
    const mark = addMark(scene, image.id, newId)!;
    mark.box = { ...mark.box, x: 300 - MARK_SIZE / 2, y: 400 - MARK_SIZE / 2 };
    followMarks(scene);
    setMarkStyle(scene, image.id, 'labels', newId);
    followMarks(scene);
    expect(mark.box.x).toBeGreaterThanOrEqual(1000);
    expect(mark.point).toEqual({ x: 300, y: 400 });
  });

  it('get one step each, in the order they are numbered, beside the steps that were there', () => {
    const { scene, image } = slide();
    const a = addMark(scene, image.id, newId)!;
    const b = addMark(scene, image.id, newId)!;
    scene.timeline = [step(image.id), step(b.id)];
    stepPerMark(scene, image.id, step);
    expect(scene.timeline.map((s) => s.actions[0]!.target)).toEqual([image.id, a.id, b.id]);
  });

  it('are left alone when the slide is tidied, and follow the picture to its new place', () => {
    const { scene, image } = slide();
    const mark = addMark(scene, image.id, newId)!;
    followMarks(scene);
    const inPicture = {
      x: (mark.point.x - image.box.x) / image.box.w,
      y: (mark.point.y - image.box.y) / image.box.h,
    };
    fitToGrid(scene, THEME_REN);
    followMarks(scene);
    expect(mark.box.w).toBe(MARK_SIZE);
    expect((mark.point.x - image.box.x) / image.box.w).toBeCloseTo(inPicture.x, 5);
    expect((mark.point.y - image.box.y) / image.box.h).toBeCloseTo(inPicture.y, 5);
  });
});

describe('marks as they are drawn', () => {
  it('shows numbers on the picture and a legend that explains them', () => {
    const { scene, image, project } = slide();
    const a = addMark(scene, image.id, newId)!;
    const b = addMark(scene, image.id, newId)!;
    a.text = 'Del A';
    followMarks(scene);
    const root = renderScene(context(project), scene);
    const marks = Array.from(root.querySelectorAll('.ls-mark-number'));
    expect(marks.map((m) => m.textContent)).toEqual(['1', '2']);
    const rows = Array.from(root.querySelectorAll('.ls-legend li'));
    expect(rows.map((row) => row.querySelector('.ls-legend-number')!.textContent)).toEqual([
      '1',
      '2',
    ]);
    expect(rows[0]!.querySelector('.ls-legend-text')!.textContent).toBe('Del A');
    // A mark without text shows nothing to students; in the editor it asks for its text.
    expect(rows[1]!.querySelector('.ls-legend-text')!.textContent).toBe('');
    const edited = renderScene(context(project, 'edit'), scene);
    expect(edited.querySelectorAll('.ls-legend .ls-mark-empty')).toHaveLength(1);
    // A mark gets no "+" badge of its own, and without "Lær mer" it is not something to press.
    expect(root.querySelector(`[data-el="${a.id}"] .ls-more-badge`)).toBeNull();
    expect(root.querySelector(`[data-el="${a.id}"] button`)).toBeNull();
    expect(root.querySelector(`[data-el="${b.id}"]`)!.getAttribute('data-on')).toBe(image.id);
  });

  it('draws a label with a line from its edge to what it points at', () => {
    const { scene, image, project } = slide();
    const mark = addMark(scene, image.id, newId)!;
    setMarkStyle(scene, image.id, 'labels', newId);
    mark.text = 'Del A';
    followMarks(scene);
    const root = renderScene(context(project), scene);
    const node = root.querySelector(`[data-el="${mark.id}"] .ls-mark-label`)!;
    expect(node.querySelector('.ls-mark-text')!.textContent).toBe('Del A');
    const line = node.querySelector('.ls-mark-line-over')!;
    const from = labelLineStart(mark.box, mark.point);
    expect(Number(line.getAttribute('x1'))).toBe(from.x - mark.box.x);
    expect(Number(line.getAttribute('x2'))).toBe(mark.point.x - mark.box.x);
    expect(Number(line.getAttribute('y2'))).toBe(mark.point.y - mark.box.y);
    expect(node.querySelector('.ls-mark-dot')).not.toBeNull();
    expect(root.querySelector('.ls-legend')).toBeNull();
  });

  it('makes a mark with "Lær mer" something to press, with a name for screen readers', () => {
    const { scene, image, project } = slide();
    const mark = addMark(scene, image.id, newId)!;
    mark.text = 'Del A';
    mark.more = { title: '', blocks: [{ id: 'm1', kind: 'heading', text: 'Overskrift A' }] };
    const root = renderScene(context(project), scene);
    const button = root.querySelector<HTMLElement>(`[data-el="${mark.id}"] button.ls-mark`)!;
    expect(button.dataset.more).toBe(mark.id);
    expect(button.getAttribute('aria-label')).toBe('Lær mer om: Del A');
    expect(button.classList.contains('ls-mark-more')).toBe(true);
    expect(root.querySelector(`[data-el="${mark.id}"]`)!.classList.contains('ls-has-more')).toBe(
      true,
    );
    // In the editor it is not a button, so it can be dragged.
    const edited = renderScene(context(project, 'edit'), scene);
    expect(edited.querySelector(`[data-el="${mark.id}"] button`)).toBeNull();
  });

  it('brings a row of the legend in with its mark, and shows no mark before its picture', () => {
    const { scene, image, project } = slide();
    const a = addMark(scene, image.id, newId)!;
    const b = addMark(scene, image.id, newId)!;
    followMarks(scene);
    scene.timeline = [step(image.id), step(b.id)];
    const root = renderScene(context(project), scene);
    const shown = (selector: string): boolean =>
      root.querySelector<HTMLElement>(selector)!.style.visibility !== 'hidden';
    const row = (mark: MarkElement): string => `.ls-legend [data-follows="${mark.id}"]`;
    // Before any step: the picture is not there, so neither are its marks or its legend.
    applySceneState(root, sceneState(scene, 0, Infinity));
    expect(shown(`[data-el="${image.id}"]`)).toBe(false);
    expect(shown(`[data-el="${a.id}"]`)).toBe(false);
    expect(shown(`[data-el="${legendOf(scene, image.id)!.id}"]`)).toBe(false);
    // The picture has come: the mark without a step is there, the other one waits, row and all.
    applySceneState(root, sceneState(scene, 1, Infinity));
    expect(shown(`[data-el="${a.id}"]`)).toBe(true);
    expect(shown(row(a))).toBe(true);
    expect(shown(`[data-el="${b.id}"]`)).toBe(false);
    expect(shown(row(b))).toBe(false);
    applySceneState(root, sceneState(scene, 2, Infinity));
    expect(shown(`[data-el="${b.id}"]`)).toBe(true);
    expect(shown(row(b))).toBe(true);
  });
});

describe('marks in the format', () => {
  it('are read back as they were written, and older projects are still read', () => {
    const { scene, image, project } = slide();
    const mark = addMark(scene, image.id, newId)!;
    setMarkStyle(scene, image.id, 'labels', newId);
    mark.text = 'Del A';
    followMarks(scene);
    const parsed = parseProject(JSON.parse(JSON.stringify(project)));
    const read = parsed.scenes[0]!.elements.find((el) => el.type === 'mark')!;
    expect(read).toEqual(mark);
    expect(parsed.scenes[0]!.elements.find((el) => el.type === 'image')).toMatchObject({
      marks: 'labels',
    });
    const old = JSON.parse(JSON.stringify(sampleProject().project)) as { version: number };
    old.version = 7;
    expect(parseProject(old).version).toBe(FORMAT_VERSION);
    expect(FORMAT_VERSION).toBe(12);
  });
});
