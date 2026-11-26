// @vitest-environment happy-dom
// Movements: how an element comes in at a step (toned in, glided in, grown,
// drawn, counted up), which of them the program proposes, how fast they
// are, and the steps that mark, take away and zoom. Nothing here is real
// subject matter.
import { describe, expect, it } from 'vitest';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import {
  FORMAT_VERSION,
  parseProject,
  type Element,
  type Project,
  type Scene,
  type ShapeElement,
  type Step,
  type TextElement,
} from '../src/shared/format/schema';
import { pasteTable } from '../src/shared/layout/charts';
import { followFigures } from '../src/shared/layout/groups';
import { followRepeats } from '../src/shared/layout/repeats';
import {
  WHOLE,
  effectSeconds,
  effectsFor,
  fitView,
  proposedEffect,
  setStepSpeed,
  showStep,
  speedOf,
  stepSpeed,
  viewAround,
  zoomedBefore,
} from '../src/shared/layout/steps';
import {
  NEW_FIGURE_SIZE,
  followTemplates,
  newFigure,
  partsOf,
} from '../src/shared/layout/templates';
import { sceneMovesAt, sceneStateAt } from '../src/shared/render/clock';
import { SCENE_STRINGS, renderScene, type RenderContext } from '../src/shared/render/scene';
import {
  applySceneMoves,
  countedText,
  movesFrom,
  pruneTimeline,
  sceneMoves,
  sceneState,
  stepDuration,
} from '../src/shared/render/timeline';
import { THEME_REN } from '../src/shared/theme/theme';
import {
  addKindStep,
  addStep,
  addToStep,
  addZoomStep,
  removeFromStep,
  removeFromSteps,
  stepOf,
} from '../src/renderer/src/ops';

let counter = 0;
const newId = (): string => `n${++counter}`;

const context = (project: Project): RenderContext => ({
  doc: document,
  project,
  theme: THEME_REN,
  mode: 'play',
  assetUrl: () => undefined,
  logo: {},
  strings: SCENE_STRINGS.nb,
});

const box = (id: string, x = 100, y = 100): ShapeElement => ({
  id,
  type: 'shape',
  geometry: 'rect',
  fill: 'lilla',
  content: richText(id),
  box: { x, y, w: 200, h: 100, rotation: 0 },
});
const arrow = (id: string): ShapeElement => ({
  id,
  type: 'shape',
  geometry: 'arrow',
  box: { x: 400, y: 100, w: 300, h: 400, rotation: 0 },
});
const text = (id: string, said: string, role: TextElement['role'] = 'body'): TextElement => ({
  id,
  type: 'text',
  role,
  content: richText(said),
  align: 'left',
  valign: 'top',
  box: { x: 100, y: 600, w: 600, h: 120, rotation: 0 },
});
const show = (
  id: string,
  targets: string[],
  effect: Step['actions'][number]['effect'] = 'fade',
): Step => ({
  id,
  actions: targets.map((target) => ({ target, effect, duration: 1 })),
});

describe('the movement the program proposes', () => {
  it('draws a line, lets a bar grow and a large number count up, and tones in the rest', () => {
    const scene = newScene('content', 'A');
    const bars = newFigure('bars', { x: 200, y: 300, ...NEW_FIGURE_SIZE.bars, rotation: 0 }, newId);
    bars.items = [];
    pasteTable(bars, 0, 0, 'A\t1\nB\t-2', newId);
    scene.elements.push(
      bars,
      box('boks'),
      arrow('pil'),
      { ...arrow('linje'), geometry: 'line' },
      text('tall', '1 250', 'number'),
      text('tekst', 'Uten tall', 'number'),
      text('ord', 'I 2024 var det slik'),
    );
    followTemplates(scene);
    followFigures(scene);
    const by = (id: string): Element => scene.elements.find((el) => el.id === id)!;
    const bar = partsOf(scene, bars.id).find((el) => el.of!.part.startsWith('bar:'))!;
    const curve: ShapeElement = {
      ...arrow('kurve'),
      geometry: 'curve',
      points: [
        [0, 0],
        [1, 1],
      ],
    };
    expect(proposedEffect(by('pil'))).toBe('draw');
    expect(proposedEffect(by('linje'))).toBe('draw');
    expect(proposedEffect(curve)).toBe('draw');
    expect(proposedEffect(bar)).toBe('grow');
    expect(proposedEffect(by('tall'))).toBe('count');
    // A heading in large type without a number, and a number in running text, tone in.
    expect(proposedEffect(by('tekst'))).toBe('fade');
    expect(proposedEffect(by('ord'))).toBe('fade');
    expect(proposedEffect(by('boks'))).toBe('fade');
    // What can be chosen: a line can be drawn, a text with a number can count up.
    expect(effectsFor(by('boks'))).toEqual(['fade', 'slide', 'grow', 'appear']);
    expect(effectsFor(by('pil'))).toEqual(['fade', 'slide', 'grow', 'draw', 'appear']);
    expect(effectsFor(by('ord'))).toEqual(['fade', 'slide', 'grow', 'count', 'appear']);

    // A new step gives each element its own, at the ordinary speed.
    const step = showStep(scene, ['boks', 'pil', 'tall', bar.id, 'finnes-ikke'], 's1');
    expect(step.actions).toEqual([
      { target: 'boks', effect: 'fade', duration: 0.4 },
      { target: 'pil', effect: 'draw', duration: 0.8 },
      { target: 'tall', effect: 'count', duration: 1 },
      { target: bar.id, effect: 'grow', duration: 0.6 },
    ]);
    expect(stepSpeed(step)).toBe('normal');
    setStepSpeed(step, 'slow');
    expect(step.actions.map((action) => action.duration)).toEqual([0.8, 1.6, 2, 1.2]);
    expect(stepSpeed(step)).toBe('slow');
    setStepSpeed(step, 'fast');
    expect(step.actions.map((action) => action.duration)).toEqual([0.2, 0.4, 0.5, 0.3]);
    expect(speedOf(step.actions[1]!)).toBe('fast');
    expect(effectSeconds('appear', 'slow')).toBe(0);
  });
});

describe('what the steps have done', () => {
  const scene = newScene('content', 'A');
  scene.elements.push(box('a'), box('b'), box('c'), box('d'));
  scene.timeline = [
    show('s1', ['a']),
    { id: 's2', kind: 'mark', actions: [{ target: 'b', effect: 'fade', duration: 1 }] },
    { id: 's3', kind: 'hide', actions: [{ target: 'b', effect: 'fade', duration: 1 }] },
    show('s4', ['b', 'a'], 'slide'),
    { id: 's5', kind: 'zoom', actions: [], zoom: { x: 960, y: 540, w: 960, h: 540 }, seconds: 2 },
    { id: 's6', kind: 'zoom', actions: [], seconds: 2 },
  ];

  it('brings in, marks until the next step, takes away, and brings in again', () => {
    // Before any step: a comes in later, b is there (nothing brings it in before it is taken away).
    let moves = sceneMoves(scene, 0, Infinity);
    expect(moves.elements.get('a')).toMatchObject({ shown: 0, gone: 0 });
    expect(moves.elements.get('b')).toMatchObject({ shown: 1, gone: 0, marked: 0 });
    expect(moves.elements.has('c')).toBe(false);
    expect([...sceneState(scene, 0, Infinity)]).toEqual([
      ['a', 0],
      ['b', 1],
    ]);
    // Half way into the first step a is on its way in, as its step says.
    moves = sceneMoves(scene, 1, 0.5);
    expect(moves.elements.get('a')!.shown).toBeCloseTo(0.875);
    expect(moves.elements.get('a')!.effect).toBe('fade');
    // The second step marks b, and the mark stays while it is the latest step.
    expect(sceneMoves(scene, 2, 0.5).elements.get('b')!.marked).toBeCloseTo(0.875);
    expect(sceneMoves(scene, 2, Infinity).elements.get('b')!.marked).toBe(1);
    // When the next step comes the mark goes, while b itself tones away.
    moves = sceneMoves(scene, 3, 0.125);
    expect(moves.elements.get('b')!.marked).toBeCloseTo(0.5);
    expect(moves.elements.get('b')!.gone).toBeGreaterThan(0.3);
    moves = sceneMoves(scene, 3, Infinity);
    expect(moves.elements.get('b')).toMatchObject({ marked: 0, gone: 1 });
    expect(sceneState(scene, 3, Infinity).get('b')).toBe(0);
    // A later step brings b in again, its own way. a came in at the first step, and that stands.
    moves = sceneMoves(scene, 4, 0.5);
    expect(moves.elements.get('b')).toMatchObject({ effect: 'slide', gone: 0 });
    expect(moves.elements.get('b')!.shown).toBeCloseTo(0.875);
    expect(moves.elements.get('a')).toMatchObject({ effect: 'fade', shown: 1 });
    expect(sceneState(scene, 6, Infinity).get('b')).toBe(1);
  });

  it('glides in on a part of the slide, and out to the whole of it again', () => {
    expect(sceneMoves(scene, 4, Infinity).view).toBeUndefined();
    // Half way: half way between the whole slide and the part.
    expect(sceneMoves(scene, 5, 1).view).toEqual({ x: 480, y: 270, w: 1440, h: 810 });
    expect(sceneMoves(scene, 5, Infinity).view).toEqual({ x: 960, y: 540, w: 960, h: 540 });
    expect(sceneMoves(scene, 6, 1).view).toEqual({ x: 480, y: 270, w: 1440, h: 810 });
    expect(sceneMoves(scene, 6, Infinity).view).toBeUndefined();
    expect(stepDuration(scene.timeline[4]!)).toBe(2);
    expect(zoomedBefore(scene.timeline, 5)).toBe(true);
    expect(zoomedBefore(scene.timeline, 4)).toBe(false);
    expect(zoomedBefore(scene.timeline, 6)).toBe(false);
  });

  it('does the same by the clock, each step from its own time', () => {
    const timed: Scene = {
      ...scene,
      timeline: scene.timeline.map((step, i) => ({ ...step, at: (i + 1) * 10 })),
      audio: { clips: [{ id: 'p', kind: 'pause', duration: 100 }] },
    };
    expect(sceneStateAt(timed, 5).get('a')).toBe(0);
    expect(sceneStateAt(timed, 10.5).get('a')).toBeCloseTo(0.875);
    expect(sceneMovesAt(timed, 25).elements.get('b')!.marked).toBe(1);
    expect(sceneMovesAt(timed, 30.125).elements.get('b')!.marked).toBeCloseTo(0.5);
    expect(sceneStateAt(timed, 35).get('b')).toBe(0);
    expect(sceneMovesAt(timed, 51).view).toEqual({ x: 480, y: 270, w: 1440, h: 810 });
    expect(sceneMovesAt(timed, 70).view).toBeUndefined();
    // Asked for directly: seconds since each step, negative for one that has not come.
    expect(movesFrom(timed, [5, -1, -1, -1, -1, -1]).elements.get('a')!.shown).toBe(1);
  });

  it('is stored, read back, and kept by a slide that is shown once more', () => {
    const project = newProject('A');
    project.scenes.push(structuredClone(scene));
    const parsed = parseProject(JSON.parse(JSON.stringify(project)));
    expect(parsed.scenes[0]!.timeline).toEqual(scene.timeline);
    const old = JSON.parse(JSON.stringify(newProject('A'))) as { version: number };
    old.version = 15;
    expect(parseProject(old).version).toBe(FORMAT_VERSION);
    expect(FORMAT_VERSION).toBe(18);
    // A step that zooms has no elements, and stands all the same; one that marks nothing goes.
    const pruned = structuredClone(scene);
    pruned.elements = pruned.elements.filter((el) => el.id !== 'b');
    pruneTimeline(pruned);
    expect(pruned.timeline.map((step) => step.id)).toEqual(['s1', 's4', 's5', 's6']);
    // A repeat does what its slide does, at its own times.
    const repeat: Scene = {
      ...newScene('content', 'A igjen'),
      repeat: { of: project.scenes[0]!.id, shown: [] },
      timeline: [{ id: 's5', actions: [], at: 3 }],
    };
    project.scenes.push(repeat);
    const followed = followRepeats(project).scenes[1]!;
    expect(followed.timeline[4]).toEqual({ ...scene.timeline[4]!, at: 3 });
    expect(followed.timeline[1]).toEqual(scene.timeline[1]);
  });
});

describe('the movements, drawn', () => {
  function drawn(): { scene: Scene; root: HTMLElement; node: (id: string) => HTMLElement } {
    const project = newProject('A');
    const scene = newScene('content', 'A');
    const bars = newFigure('bars', { x: 900, y: 300, ...NEW_FIGURE_SIZE.bars, rotation: 0 }, newId);
    bars.id = 'diagram';
    bars.items = [];
    pasteTable(bars, 0, 0, 'A\t1\nB\t-2', newId);
    const curve: ShapeElement = {
      ...arrow('kurve'),
      geometry: 'curve',
      dots: true,
      points: [
        [0, 0],
        [0.5, 0],
        [1, 0],
      ],
      box: { x: 0, y: 800, w: 400, h: 100, rotation: 0 },
    };
    scene.elements.push(bars, box('boks'), arrow('pil'), curve, text('tall', 'Om lag 1 250,5 kr'));
    followTemplates(scene);
    followFigures(scene);
    project.scenes.push(scene);
    const root = renderScene(context(project), scene);
    document.body.replaceChildren(root);
    return { scene, root, node: (id) => root.querySelector<HTMLElement>(`[data-el="${id}"]`)! };
  }
  const at = (effect: Step['actions'][number]['effect'], shown: number) => ({
    shown,
    effect,
    gone: 0,
    marked: 0,
  });

  it('draws a line from its start, with the head when it is there, and a curve dot by dot', () => {
    const { root, node } = drawn();
    applySceneMoves(root, { elements: new Map([['pil', at('draw', 0.5)]]), view: undefined });
    const line = node('pil').querySelector('line')!;
    // The line of an arrow of 300 by 400 stops where its head begins.
    const length = Number(line.style.strokeDasharray.split(' ')[0]);
    expect(length).toBeGreaterThan(450);
    expect(length).toBeLessThan(500);
    expect(Number(line.style.strokeDashoffset)).toBeCloseTo(length / 2, 1);
    expect(node('pil').querySelector('polygon')!.style.opacity).toBe('0');
    expect(node('pil').style.opacity).toBe('');
    applySceneMoves(root, { elements: new Map([['pil', at('draw', 0.95)]]), view: undefined });
    expect(node('pil').querySelector('polygon')!.style.opacity).toBe('');
    // Done: nothing of the drawing is left on it.
    applySceneMoves(root, { elements: new Map([['pil', at('draw', 1)]]), view: undefined });
    expect(line.style.strokeDasharray).toBe('');
    expect(line.style.strokeDashoffset).toBe('');

    applySceneMoves(root, { elements: new Map([['kurve', at('draw', 0.5)]]), view: undefined });
    const curve = node('kurve');
    expect(curve.querySelector('polyline')!.style.strokeDasharray).toBe('400.00 400.00');
    expect(curve.querySelector('polyline')!.style.strokeDashoffset).toBe('200.00');
    // The dots the curve has reached are there; the last one is not yet.
    expect(Array.from(curve.querySelectorAll('circle')).map((dot) => dot.style.opacity)).toEqual([
      '',
      '',
      '0',
    ]);
    // An element without a line that is asked to be drawn tones in instead.
    applySceneMoves(root, { elements: new Map([['boks', at('draw', 0.5)]]), view: undefined });
    expect(node('boks').style.opacity).toBe('0.5');
  });

  it('counts a number up as it is written, and puts the text back', () => {
    expect(countedText('Om lag 1 250,5 kr', 0)).toBe('Om lag 0,0 kr');
    expect(countedText('Om lag 1 250,5 kr', 0.5)).toBe('Om lag 625,3 kr');
    expect(countedText('Om lag 1 250,5 kr', 1)).toBe('Om lag 1 250,5 kr');
    expect(countedText('12 000 stykker', 0.5)).toBe('6 000 stykker');
    expect(countedText('3.75', 0.2)).toBe('0.75');
    expect(countedText('40 %', 0.5)).toBe('20 %');
    expect(countedText('Uten tall', 0.5)).toBe('Uten tall');
    const { root, node } = drawn();
    applySceneMoves(root, { elements: new Map([['tall', at('count', 0.5)]]), view: undefined });
    expect(node('tall').textContent).toBe('Om lag 625,3 kr');
    applySceneMoves(root, { elements: new Map([['tall', at('count', 0.8)]]), view: undefined });
    expect(node('tall').textContent).toBe('Om lag 1 000,4 kr');
    applySceneMoves(root, { elements: new Map([['tall', at('count', 1)]]), view: undefined });
    expect(node('tall').textContent).toBe('Om lag 1 250,5 kr');
    expect(node('tall').dataset.counts).toBeUndefined();
  });

  it('lets a bar grow from the axis, glides from the side, and tones up into place', () => {
    const { scene, root, node } = drawn();
    const [up, down] = partsOf(scene, 'diagram').filter((el) => el.of!.part.startsWith('bar:'));
    expect(node(up!.id).dataset.grows).toBe('bottom');
    expect(node(down!.id).dataset.grows).toBe('top');
    expect(node('boks').dataset.grows).toBeUndefined();
    applySceneMoves(root, {
      elements: new Map([
        [up!.id, at('grow', 0.5)],
        [down!.id, at('grow', 0.5)],
        ['boks', at('grow', 0.5)],
        ['pil', at('slide', 0.5)],
        ['tall', at('fade', 0.5)],
      ]),
      view: undefined,
    });
    expect(node(up!.id).style.scale).toBe('1 0.5000');
    expect(node(up!.id).style.transformOrigin).toBe('50% 100%');
    expect(node(down!.id).style.transformOrigin).toBe('50% 0');
    expect(node('boks').style.scale).toBe('0.8000');
    expect(node('pil').style.translate).toBe('-80.00px 0');
    expect(node('tall').style.translate).toBe('0 14.00px');
    expect(node('tall').style.opacity).toBe('0.5');
    // In place: nothing is left on any of them.
    applySceneMoves(root, { elements: new Map(), view: undefined });
    for (const id of [up!.id, 'boks', 'pil', 'tall']) {
      expect(node(id).style.cssText.replace(/(left|top|width|height|z-index):[^;]+;\s*/g, '')).toBe(
        '',
      );
    }
  });

  it('frames what is marked, tones away what goes, and makes the slide larger round a part', () => {
    const { root, node } = drawn();
    applySceneMoves(root, {
      elements: new Map([
        ['boks', { shown: 1, effect: 'appear', gone: 0, marked: 1 }],
        ['pil', { shown: 1, effect: 'appear', gone: 0.5, marked: 0 }],
        ['tall', { shown: 1, effect: 'appear', gone: 1, marked: 1 }],
      ]),
      view: { x: 960, y: 540, w: 960, h: 540 },
    });
    expect(node('boks').style.outline).toContain('solid');
    expect(node('boks').style.outline).toContain('8px');
    expect(node('boks').style.opacity).toBe('');
    // What goes away tones out where it stands.
    expect(node('pil').style.opacity).toBe('0.5');
    expect(node('pil').style.translate).toBe('');
    // What is gone is hidden, also from those who do not see, and is not framed.
    expect(node('tall').style.visibility).toBe('hidden');
    expect(node('tall').getAttribute('aria-hidden')).toBe('true');
    expect(node('tall').style.outline).toBe('');
    // Everything on the slide lies in the layer that is made larger; the slide itself stays.
    const layer = root.querySelector<HTMLElement>(':scope > .ls-zoom')!;
    expect(layer.contains(node('boks'))).toBe(true);
    expect(layer.style.transform).toBe('scale(2.00000) translate(-960.00px, -540.00px)');
    applySceneMoves(root, { elements: new Map(), view: undefined });
    expect(layer.style.transform).toBe('');
    expect(node('boks').style.outline).toBe('');
    expect(node('tall').style.visibility).toBe('');
  });
});

describe('making and changing the steps', () => {
  it('lets an element come in at one step, and be marked and taken away at others', () => {
    const scene = newScene('content', 'A');
    scene.elements.push(box('a'), box('b'), arrow('pil'));
    addStep(scene, ['a', 'pil']);
    addKindStep(scene, 'mark', ['a', 'finnes-ikke']);
    addKindStep(scene, 'hide', ['a']);
    addKindStep(scene, 'mark', []);
    expect(scene.timeline.map((step) => [step.kind, step.actions.map((a) => a.effect)])).toEqual([
      [undefined, ['fade', 'draw']],
      ['mark', ['fade']],
      ['hide', ['fade']],
    ]);
    expect(stepOf(scene, 'a')).toBe(0);
    expect(stepOf(scene, 'b')).toBe(-1);
    // Put in a new step that brings it in, it leaves the first; the steps that mark it stand.
    addStep(scene, ['a']);
    expect(scene.timeline.map((step) => step.actions.map((a) => a.target))).toEqual([
      ['pil'],
      ['a'],
      ['a'],
      ['a'],
    ]);
    // More is marked in the same step, and taken out of that step only.
    addToStep(scene, scene.timeline[1]!.id, ['b', 'a']);
    expect(scene.timeline[1]!.actions.map((a) => a.target)).toEqual(['a', 'b']);
    removeFromStep(scene, scene.timeline[1]!.id, ['a']);
    expect(scene.timeline[1]!.actions.map((a) => a.target)).toEqual(['b']);
    expect(stepOf(scene, 'a')).toBe(3);
    // Taken out of the steps that bring it in, it is there from the start, and still taken away.
    removeFromSteps(scene, ['a']);
    expect(scene.timeline.map((step) => step.kind)).toEqual([undefined, 'mark', 'hide']);
    expect(stepOf(scene, 'a')).toBe(-1);

    const zoomIn = addZoomStep(scene, { x: 1000, y: 600, w: 5000, h: 10 });
    addZoomStep(scene, undefined);
    const steps = scene.timeline.slice(-2);
    expect(steps[0]).toMatchObject({ id: zoomIn, kind: 'zoom', actions: [], seconds: 0.9 });
    // Never larger than the slide.
    expect(steps[0]!.zoom).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
    expect(steps[1]!.zoom).toBeUndefined();
    setStepSpeed(steps[0]!, 'slow');
    expect(steps[0]!.seconds).toBe(1.8);
    expect(stepSpeed(steps[0]!)).toBe('slow');
    // Nothing can be put into a step that zooms.
    addToStep(scene, zoomIn, ['b']);
    expect(steps[0]!.actions).toEqual([]);
  });

  it('keeps the part a zoom shows in the shape of the slide, and inside it', () => {
    expect(fitView({ x: 100, y: 100, w: 960, h: 300 })).toEqual({ x: 100, y: 0, w: 960, h: 540 });
    expect(fitView({ x: 1700, y: 900, w: 960, h: 540 })).toEqual({
      x: 960,
      y: 540,
      w: 960,
      h: 540,
    });
    // Not smaller than a fifth of the slide.
    expect(fitView({ x: 500, y: 500, w: 10, h: 10 }).w).toBe(384);
    // Round what is chosen, with air: wide enough for its height too.
    const around = viewAround([
      { x: 800, y: 400, w: 200, h: 100 },
      { x: 1000, y: 500, w: 100, h: 300 },
    ]);
    expect(around.w / around.h).toBeCloseTo(16 / 9, 2);
    expect(around.x).toBeLessThanOrEqual(740);
    expect(around.x + around.w).toBeGreaterThanOrEqual(1160);
    expect(around.y).toBeLessThanOrEqual(340);
    expect(around.y + around.h).toBeGreaterThanOrEqual(860);
    expect(viewAround([]).w).toBe(960);
    expect(WHOLE).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
  });
});
