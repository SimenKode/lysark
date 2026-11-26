// @vitest-environment happy-dom
// Bar and line diagrams: figures with a form whose form is a table of
// numbers. How numbers are read and written, how the axes are chosen, how
// the bars and curves are laid out from the table, what is pasted from a
// spreadsheet, and how steps, deleting and writing on the slide go back to
// the table. The numbers are test numbers (1, 2, 3), not subject matter.
import { describe, expect, it } from 'vitest';
import { newProject, newScene, plainText, richText } from '../src/shared/format/factory';
import {
  FORMAT_VERSION,
  parseProject,
  type Element,
  type FigureElement,
  type Project,
  type Scene,
  type ShapeElement,
  type Step,
  type TextElement,
} from '../src/shared/format/schema';
import {
  addSeries,
  chartTable,
  formatNumber,
  niceScale,
  parseNumber,
  pasteTable,
  removeSeries,
  rowsByName,
  setAlong,
} from '../src/shared/layout/charts';
import { followFigures } from '../src/shared/layout/groups';
import {
  NEW_FIGURE_SIZE,
  followTemplates,
  newFigure,
  partsOf,
  releaseFigure,
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
function settle(scene: Scene): boolean {
  const a = followTemplates(scene);
  const b = followFigures(scene);
  return a || b;
}

/** A slide with a diagram in a frame at (200, 300), filled from what a spreadsheet would give. */
function slide(template: 'bars' | 'line', table: string): { scene: Scene; figure: FigureElement } {
  const scene = newScene('content', 'A');
  const figure = newFigure(
    template,
    { x: 200, y: 300, ...NEW_FIGURE_SIZE[template], rotation: 0 },
    newId,
  );
  figure.items = [];
  if (table) pasteTable(figure, 0, 0, table, newId);
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
const count = (scene: Scene, figure: FigureElement, kind: string): number =>
  kinds(scene, figure).filter((one) => one === kind).length;
const said = (el: TextElement): string => plainText(el.content);

describe('numbers as they are written', () => {
  it('reads a number with a comma or a full stop, and says what is not a number', () => {
    expect(parseNumber('1,5')).toBe(1.5);
    expect(parseNumber('1.5')).toBe(1.5);
    expect(parseNumber(' 1 000 ')).toBe(1000);
    expect(parseNumber('1.000,5')).toBe(1000.5);
    expect(parseNumber('−2')).toBe(-2);
    expect(parseNumber('-2,')).toBe(-2);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('  ')).toBeNull();
    expect(parseNumber('A')).toBeUndefined();
    expect(parseNumber('1,2,3')).toBeUndefined();
    expect(parseNumber('-')).toBeUndefined();
  });

  it('writes a number with a comma, and a space between thousands', () => {
    expect(formatNumber(1.5)).toBe('1,5');
    expect(formatNumber(2, 1)).toBe('2,0');
    expect(formatNumber(0.1 + 0.2)).toBe('0,3');
    expect(formatNumber(1000)).toBe('1000');
    expect(formatNumber(12345.5)).toBe('12 345,5');
    expect(formatNumber(-2)).toBe('−2');
    expect(formatNumber(-0.0001, 1)).toBe('0,0');
  });

  it('chooses an axis that begins and ends on round numbers', () => {
    expect(niceScale(0, 10)).toEqual({ min: 0, max: 10, ticks: [0, 2, 4, 6, 8, 10], decimals: 0 });
    expect(niceScale(0, 3).ticks).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3]);
    expect(niceScale(0, 3).decimals).toBe(1);
    expect(niceScale(1, 3)).toMatchObject({ min: 1, max: 3 });
    expect(niceScale(-2, 3)).toMatchObject({ min: -2, max: 3 });
    expect(niceScale(0, 97)).toMatchObject({ min: 0, max: 100 });
    expect(niceScale(0.1, 0.3).ticks).toEqual([0.1, 0.15, 0.2, 0.25, 0.3]);
    // One number only: from zero to it.
    expect(niceScale(2, 2)).toMatchObject({ min: 0, max: 2 });
    expect(niceScale(-2, -2)).toMatchObject({ min: -2, max: 0 });
    expect(niceScale(0, 0)).toMatchObject({ min: 0, max: 1 });
    // An end that is fixed is kept; one that leaves no room is not.
    expect(niceScale(1, 3, 0, 10)).toMatchObject({ min: 0, max: 10 });
    expect(niceScale(1, 3, 0.5).min).toBe(0.5);
    expect(niceScale(1, 3, 5)).toEqual(niceScale(1, 3));
  });
});

describe('the table of a diagram', () => {
  it('starts with three empty rows and one series without a name, and draws only its axes', () => {
    const scene = newScene('content', 'A');
    const figure = newFigure('bars', { x: 100, y: 100, w: 1100, h: 620, rotation: 0 }, newId);
    expect(figure.series).toEqual([{ id: figure.series![0]!.id, name: '' }]);
    expect(figure.items.map((row) => [row.text, row.values])).toEqual([
      ['', [null]],
      ['', [null]],
      ['', [null]],
    ]);
    scene.elements.push(figure);
    settle(scene);
    // No numbers are made up: there is nothing along the axes.
    expect(kinds(scene, figure)).toEqual(['axis', 'axis']);
    const line = newFigure('line', { x: 100, y: 100, w: 1100, h: 620, rotation: 0 }, newId);
    expect(line.items.every((row) => row.x === null)).toBe(true);
  });

  it('takes what is pasted from a spreadsheet, with the names of the series over it', () => {
    const { figure } = slide('bars', 'Navn\tEn\tTo\r\nA\t1\t2,5\r\nB\t3\t\r\nC\tx\t4\r\n');
    expect(figure.series!.map((one) => one.name)).toEqual(['En', 'To']);
    expect(figure.items.map((row) => [row.text, row.values])).toEqual([
      ['A', [1, 2.5]],
      ['B', [3, null]],
      // What is not a number is left as it was.
      ['C', [null, 4]],
    ]);
    // Pasted further in, it is laid from that cell, and the table grows.
    pasteTable(figure, 2, 2, '5\t6\n7\t8', newId);
    expect(figure.series).toHaveLength(3);
    expect(figure.items.map((row) => row.values)).toEqual([
      [1, 2.5, null],
      [3, null, null],
      [null, 5, 6],
      [null, 7, 8],
    ]);
    expect(figure.items[3]!.text).toBe('');

    const { figure: line } = slide('line', '0\t1\n0,5\t2\n2\t3');
    expect(line.items.map((row) => [row.x, row.values])).toEqual([
      [0, [1]],
      [0.5, [2]],
      [2, [3]],
    ]);
    // Without numbers under it, a first line is not names.
    expect(line.series!.map((one) => one.name)).toEqual(['']);
  });

  it('gets and loses a series in every row', () => {
    const { figure } = slide('bars', 'A\t1\nB\t2');
    addSeries(figure, newId(), 'To');
    expect(figure.items.map((row) => row.values)).toEqual([
      [1, null],
      [2, null],
    ]);
    removeSeries(figure, 0);
    expect(figure.series!.map((one) => one.name)).toEqual(['To']);
    expect(figure.items.map((row) => row.values)).toEqual([[null], [null]]);
  });
});

describe('a bar diagram', () => {
  it('stands bars on the zero line, as high as their numbers say', () => {
    const { scene, figure } = slide('bars', 'A\t1\nB\t2\nC\t4');
    const [a, b, c] = figure.items;
    const s = figure.series![0]!.id;
    const bar = (row: { id: string }): ShapeElement => part(scene, figure, `bar:${row.id}:${s}`);
    const axis = part(scene, figure, 'axis:x');
    const zero = axis.box.y;
    for (const row of figure.items) {
      expect(bar(row).geometry).toBe('rect');
      expect(bar(row).fill).toBe('lilla');
      expect(Math.abs(bar(row).box.y + bar(row).box.h - zero)).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(bar(b!).box.h - 2 * bar(a!).box.h)).toBeLessThanOrEqual(2);
    expect(Math.abs(bar(c!).box.h - 4 * bar(a!).box.h)).toBeLessThanOrEqual(3);
    // In the order of the table, with the name under each.
    expect(bar(a!).box.x).toBeLessThan(bar(b!).box.x);
    expect(bar(b!).box.x).toBeLessThan(bar(c!).box.x);
    const label = part<TextElement>(scene, figure, `label:${b!.id}`);
    expect(said(label)).toBe('B');
    expect(label.box.y).toBeGreaterThan(zero);
    const mid = (el: Element): number => el.box.x + el.box.w / 2;
    expect(Math.abs(mid(label) - mid(bar(b!)))).toBeLessThanOrEqual(1);
    // The numbers along the axis, written with a comma; the one for the top is level with it.
    const ticks = partsOf(scene, figure.id)
      .filter((el) => el.of!.part.startsWith('tick:'))
      .map((el) => said(el as TextElement));
    expect(ticks).toEqual(['0', '1', '2', '3', '4']);
    expect(count(scene, figure, 'grid')).toBe(4);
    // Everything is inside the frame, and nothing more is to be done.
    const f = figure.box;
    for (const el of partsOf(scene, figure.id)) {
      expect(el.box.x).toBeGreaterThanOrEqual(f.x - 1);
      expect(el.box.y).toBeGreaterThanOrEqual(f.y - 1);
      expect(el.box.x + el.box.w).toBeLessThanOrEqual(f.x + f.w + 1);
      expect(el.box.y + el.box.h).toBeLessThanOrEqual(f.y + f.h + 1);
    }
    expect(settle(scene)).toBe(false);
    // No names for the series: no legend.
    expect(count(scene, figure, 'key')).toBe(0);
  });

  it('always has zero on its axis, and lets bars hang under it', () => {
    const { scene, figure } = slide('bars', 'A\t5\nB\t6');
    const ticks = (): string[] =>
      partsOf(scene, figure.id)
        .filter((el) => el.of!.part.startsWith('tick:'))
        .map((el) => said(el as TextElement));
    expect(ticks()[0]).toBe('0');
    // An axis fixed to begin over zero still begins at zero for bars.
    figure.yMin = 4;
    figure.yMax = 10;
    settle(scene);
    expect(ticks()).toEqual(['0', '2', '4', '6', '8', '10']);
    delete figure.yMin;
    delete figure.yMax;
    figure.items[1]!.values = [-2];
    settle(scene);
    const s = figure.series![0]!.id;
    const zero = part(scene, figure, 'axis:x').box.y;
    const up = part(scene, figure, `bar:${figure.items[0]!.id}:${s}`);
    const down = part(scene, figure, `bar:${figure.items[1]!.id}:${s}`);
    expect(Math.abs(up.box.y + up.box.h - zero)).toBeLessThanOrEqual(1);
    expect(Math.abs(down.box.y - zero)).toBeLessThanOrEqual(1);
    expect(zero).toBeLessThan(figure.box.y + figure.box.h - 60);
    // A number that is zero is a thin bar; one that is missing is none.
    figure.items[0]!.values = [0];
    figure.items[1]!.values = [null];
    figure.items.push({ id: newId(), text: 'C', values: [3] });
    settle(scene);
    expect(part(scene, figure, `bar:${figure.items[0]!.id}:${s}`).box.h).toBe(2);
    expect(part(scene, figure, `bar:${figure.items[1]!.id}:${s}`)).toBeUndefined();
  });

  it('stands the series side by side in the colours of the theme, with a legend', () => {
    const { scene, figure } = slide('bars', '\tEn\tTo\nA\t1\t2\nB\t3\t4');
    const [one, two] = figure.series!;
    const a = figure.items[0]!;
    const first = part(scene, figure, `bar:${a.id}:${one!.id}`);
    const second = part(scene, figure, `bar:${a.id}:${two!.id}`);
    expect(first.fill).toBe('lilla');
    expect(second.fill).toBe('oransje');
    expect(second.box.x).toBeGreaterThanOrEqual(first.box.x + first.box.w);
    expect(second.box.x - (first.box.x + first.box.w)).toBeLessThan(10);
    // The legend: the colour and the name of each, over the plot.
    expect(part(scene, figure, `key:${two!.id}`).fill).toBe('oransje');
    expect(said(part<TextElement>(scene, figure, `name:${two!.id}`))).toBe('To');
    expect(part(scene, figure, `key:${one!.id}`).box.x).toBeLessThan(
      part(scene, figure, `key:${two!.id}`).box.x,
    );
    expect(part(scene, figure, `key:${one!.id}`).box.y).toBeLessThan(first.box.y);
    // The lecturer's own colour, and the texts at the axes.
    two!.color = 'indigo';
    figure.yTitle = 'Y';
    figure.xTitle = 'X';
    settle(scene);
    expect(part(scene, figure, `bar:${a.id}:${two!.id}`).fill).toBe('indigo');
    expect(part(scene, figure, `key:${two!.id}`).fill).toBe('indigo');
    const y = part<TextElement>(scene, figure, 'title:y');
    const x = part<TextElement>(scene, figure, 'title:x');
    expect([said(y), said(x)]).toEqual(['Y', 'X']);
    expect(y.box.y).toBe(figure.box.y);
    expect(x.box.y + x.box.h).toBe(figure.box.y + figure.box.h);
  });

  it('gives each row or each series its step, and lets what is new come in with its own', () => {
    const { scene, figure } = slide('bars', '\tEn\tTo\nA\t1\t2\nB\t3\t4');
    const ids = (key: string): string => part(scene, figure, key).id;
    const [a, b] = figure.items;
    const [one, two] = figure.series!;
    stepPerItem(scene, figure.id, step);
    expect(scene.timeline.map((s) => s.actions.map((x) => x.target))).toEqual([
      [ids(`bar:${a!.id}:${one!.id}`), ids(`bar:${a!.id}:${two!.id}`), ids(`label:${a!.id}`)],
      [ids(`bar:${b!.id}:${one!.id}`), ids(`bar:${b!.id}:${two!.id}`), ids(`label:${b!.id}`)],
    ]);
    // A third series: its bar in each row comes in with the row.
    addSeries(figure, newId(), 'Tre');
    a!.values![2] = 5;
    b!.values![2] = 6;
    settle(scene);
    const three = figure.series![2]!;
    expect(scene.timeline[0]!.actions.map((x) => x.target)).toContain(
      ids(`bar:${a!.id}:${three.id}`),
    );
    expect(scene.timeline[1]!.actions.map((x) => x.target)).toContain(
      ids(`bar:${b!.id}:${three.id}`),
    );
    // Its place in the legend is in no step: the legend was there from the start.
    const stepped = (): string[] => scene.timeline.flatMap((s) => s.actions.map((x) => x.target));
    expect(stepped()).not.toContain(ids(`name:${three.id}`));

    // One step for each series instead: its bars, and its colour and name in the legend.
    stepPerItem(scene, figure.id, step, 'series');
    expect(scene.timeline).toHaveLength(3);
    expect(scene.timeline[1]!.actions.map((x) => x.target).sort()).toEqual(
      [
        ids(`bar:${a!.id}:${two!.id}`),
        ids(`bar:${b!.id}:${two!.id}`),
        ids(`key:${two!.id}`),
        ids(`name:${two!.id}`),
      ].sort(),
    );
    // A new row: each of its bars comes in with its series.
    figure.items.push({ id: newId(), text: 'C', values: [7, 8, 9] });
    settle(scene);
    const c = figure.items[2]!;
    expect(scene.timeline[1]!.actions.map((x) => x.target)).toContain(
      ids(`bar:${c.id}:${two!.id}`),
    );
    // The axes, the numbers and the names under the bars are in no step.
    expect(stepped()).not.toContain(ids('axis:x'));
    expect(stepped()).not.toContain(ids(`label:${c.id}`));
  });

  it('takes a deleted bar, name or legend back to the table', () => {
    const { scene, figure } = slide('bars', '\tEn\tTo\nA\t1\t2\nB\t3\t4');
    const [a, b] = figure.items;
    const [one, two] = figure.series!;
    // A bar by itself: its number goes, the row stays.
    deleteElements(scene, [part(scene, figure, `bar:${a!.id}:${two!.id}`).id]);
    settle(scene);
    expect(a!.values).toEqual([1, null]);
    expect(figure.items).toHaveLength(2);
    // The legend and the axes are drawn again.
    deleteElements(scene, [
      part(scene, figure, `name:${one!.id}`).id,
      part(scene, figure, 'axis:x').id,
    ]);
    settle(scene);
    expect(figure.series).toHaveLength(2);
    expect(part(scene, figure, `name:${one!.id}`)).toBeDefined();
    expect(part(scene, figure, 'axis:x')).toBeDefined();
    // The name under a group of bars: the row goes.
    deleteElements(scene, [part(scene, figure, `label:${b!.id}`).id]);
    settle(scene);
    expect(figure.items.map((row) => row.text)).toEqual(['A']);
    expect(partsOf(scene, figure.id).some((el) => el.of!.part.includes(b!.id))).toBe(false);
  });

  it('takes names written on the slide into the table, and numbers only from the table', () => {
    const { scene, figure } = slide('bars', '\tEn\nA\t1\nB\t2');
    figure.yTitle = 'Y';
    settle(scene);
    const [a] = figure.items;
    const one = figure.series![0]!;
    expect(writePart(scene, part(scene, figure, `label:${a!.id}`), richText('A2'))).toBe(true);
    expect(writePart(scene, part(scene, figure, `name:${one.id}`), richText('En', 'to'))).toBe(
      true,
    );
    expect(writePart(scene, part(scene, figure, 'title:y'), richText('Y2'))).toBe(true);
    expect([a!.text, one.name, figure.yTitle]).toEqual(['A2', 'En to', 'Y2']);
    expect(writePart(scene, part(scene, figure, 'tick:1'), richText('9'))).toBe(false);
    expect(writePart(scene, part(scene, figure, `bar:${a!.id}:${one.id}`), richText('9'))).toBe(
      false,
    );
    // A title emptied on the slide is gone.
    writePart(scene, part(scene, figure, 'title:y'), richText(''));
    settle(scene);
    expect(figure.yTitle).toBeUndefined();
    expect(part(scene, figure, 'title:y')).toBeUndefined();
  });
});

describe('a line diagram', () => {
  it('places each point by its numbers, not by its place in the table', () => {
    const { scene, figure } = slide('line', '0\t0\n1\t2\n4\t4');
    const curve = part(scene, figure, `curve:${figure.series![0]!.id}`);
    expect(curve.geometry).toBe('curve');
    expect(curve.stroke).toBe('lilla');
    expect(curve.fill).toBeUndefined();
    // x from 0 to 4 and y from 0 to 4: the middle point is a quarter in, and half way up.
    expect(curve.points).toEqual([
      [0, 1],
      [0.25, 0.5],
      [1, 0],
    ]);
    // The curve fills the plot: from the vertical axis, down to the horizontal one.
    const x = part(scene, figure, 'axis:x');
    const y = part(scene, figure, 'axis:y');
    expect(curve.box.x).toBe(y.box.x);
    expect(curve.box.y + curve.box.h).toBe(x.box.y);
    const numbers = (kind: string): string[] =>
      partsOf(scene, figure.id)
        .filter((el) => el.of!.part.startsWith(`${kind}:`))
        .map((el) => said(el as TextElement));
    expect(numbers('xtick')).toEqual(['0', '1', '2', '3', '4']);
    expect(numbers('tick')).toEqual(['0', '1', '2', '3', '4']);
    // The number under the axis stands under its place on it.
    const two = partsOf(scene, figure.id).find((el) => el.of!.part === 'xtick:2')!;
    expect(Math.abs(two.box.x + two.box.w / 2 - (curve.box.x + curve.box.w / 2))).toBeLessThan(2);
    // Everything is inside the frame, also the numbers under the ends of the axis.
    const f = figure.box;
    for (const el of partsOf(scene, figure.id)) {
      expect(el.box.x).toBeGreaterThanOrEqual(f.x - 1);
      expect(el.box.x + el.box.w).toBeLessThanOrEqual(f.x + f.w + 1);
      expect(el.box.y + el.box.h).toBeLessThanOrEqual(f.y + f.h + 1);
    }
    expect(settle(scene)).toBe(false);
  });

  it('does not begin at zero by itself, and keeps an axis the lecturer has fixed', () => {
    const { scene, figure } = slide('line', '10\t100\n20\t300');
    const curve = (): ShapeElement => part(scene, figure, `curve:${figure.series![0]!.id}`);
    expect(curve().points).toEqual([
      [0, 1],
      [1, 0],
    ]);
    figure.yMin = 0;
    figure.yMax = 400;
    figure.xMin = 0;
    settle(scene);
    expect(curve().points).toEqual([
      [0.5, 0.75],
      [1, 0.25],
    ]);
    // A point outside an axis that is fixed is not drawn in a wrong place: the curve breaks.
    figure.items.push({ id: newId(), text: '', x: 15, values: [500] });
    figure.items.push({ id: newId(), text: '', x: 16, values: [200] });
    settle(scene);
    expect(curve().points).toEqual([[0.5, 0.75], [1, 0.25], null, [0.8, 0.5]]);
  });

  it('breaks a curve where a number is missing, and draws a curve for each series', () => {
    const { scene, figure } = slide('line', 'X\tEn\tTo\n0\t0\t4\n1\t\t3\n2\t2\t\n3\t3\t\n\t9\t9');
    const [one, two] = figure.series!;
    // The row without an x is not drawn.
    expect(part(scene, figure, `curve:${one!.id}`).points).toEqual([
      [0, 1],
      null,
      [Number((2 / 3).toFixed(5)), 0.5],
      [1, 0.25],
    ]);
    expect(part(scene, figure, `curve:${two!.id}`).points).toEqual([
      [0, 0],
      [Number((1 / 3).toFixed(5)), 0.25],
    ]);
    expect(part(scene, figure, `curve:${two!.id}`).stroke).toBe('oransje');
    expect(said(part<TextElement>(scene, figure, `name:${one!.id}`))).toBe('En');
    // Dots at the points when the lecturer asks for them.
    expect(part(scene, figure, `curve:${one!.id}`).dots).toBeUndefined();
    figure.dots = true;
    settle(scene);
    expect(part(scene, figure, `curve:${one!.id}`).dots).toBe(true);
    // One step for each series; a curve deleted by itself takes its series out of the table.
    stepPerItem(scene, figure.id, step, 'series');
    expect(scene.timeline).toHaveLength(2);
    expect(scene.timeline[0]!.actions).toHaveLength(3);
    deleteElements(scene, [part(scene, figure, `curve:${one!.id}`).id]);
    settle(scene);
    expect(figure.series!.map((s) => s.name)).toEqual(['To']);
    expect(figure.items.map((row) => row.values)).toEqual([[4], [3], [null], [null], [9]]);
    expect(scene.timeline).toHaveLength(1);
  });

  it('can have names along its axis, with the same distance between the points', () => {
    const { scene, figure } = slide('line', '0\t1\n1\t\n4\t3');
    expect(rowsByName(figure)).toBe(false);
    setAlong(figure, 'names');
    settle(scene);
    expect(rowsByName(figure)).toBe(true);
    // What stood as x is now the name of each row; the x is kept, should the lecturer go back.
    expect(figure.items.map((row) => [row.text, row.x])).toEqual([
      ['0', 0],
      ['1', 1],
      ['4', 4],
    ]);
    figure.items.forEach((row, i) => (row.text = ['A', 'B', 'C'][i]!));
    figure.items[1]!.values = [2];
    settle(scene);
    // Each point stands in the middle of its third of the plot, whatever its x was.
    const curve = part(scene, figure, `curve:${figure.series![0]!.id}`);
    expect(curve.points).toEqual([
      [0.16667, 1],
      [0.5, 0.5],
      [0.83333, 0],
    ]);
    // The names stand under the points, and no numbers along the axis.
    const labels = figure.items.map((row) => part<TextElement>(scene, figure, `label:${row.id}`));
    expect(labels.map(said)).toEqual(['A', 'B', 'C']);
    labels.forEach((label, i) => {
      const point = curve.box.x + curve.box.w * curve.points![i]![0];
      expect(Math.abs(label.box.x + label.box.w / 2 - point)).toBeLessThan(2);
    });
    expect(kinds(scene, figure)).not.toContain('xtick');
    // A missing number is a break in the curve, as with numbers along the axis.
    figure.items[1]!.values = [null];
    settle(scene);
    expect(part(scene, figure, `curve:${figure.series![0]!.id}`).points).toEqual([
      [0.16667, 1],
      null,
      [0.83333, 0],
    ]);
    // What is pasted from a spreadsheet: the first column is names now.
    pasteTable(figure, 0, 0, 'Uke 1\t5\nUke 2\t6', newId);
    expect(figure.items.map((row) => [row.text, row.values])).toEqual([
      ['Uke 1', [5]],
      ['Uke 2', [6]],
      ['C', [3]],
    ]);
    expect(chartTable(figure).rows).toEqual([
      ['Uke 1', '5'],
      ['Uke 2', '6'],
      ['C', '3'],
    ]);
    // A name written on the slide goes into the table.
    settle(scene);
    const first = part<TextElement>(scene, figure, `label:${figure.items[0]!.id}`);
    expect(writePart(scene, first, richText('Uke A'))).toBe(true);
    expect(figure.items[0]!.text).toBe('Uke A');
    // Back to numbers: a name that is a number becomes the x where there was none.
    figure.items.push({ id: newId(), text: '7,5', values: [1], x: null });
    setAlong(figure, 'numbers');
    expect(figure.along).toBeUndefined();
    expect(figure.items.map((row) => row.x)).toEqual([0, 1, 4, 7.5]);
    setAlong(figure, 'names');
    expect(() =>
      parseProject(
        JSON.parse(JSON.stringify({ ...newProject('A'), scenes: [{ ...scene }] })) as unknown,
      ),
    ).not.toThrow();
  });
});

describe('a diagram, drawn and stored', () => {
  const context = (project: Project, mode: 'edit' | 'play'): RenderContext => ({
    doc: document,
    project,
    theme: THEME_REN,
    mode,
    assetUrl: () => undefined,
    logo: {},
    strings: SCENE_STRINGS.nb,
  });

  it('draws a curve as one line through its points, broken where a point is missing', () => {
    const project = newProject('Testforelesning');
    const { scene, figure } = slide('line', '0\t0\n1\t2\n2\t\n3\t1\n4\t4');
    figure.dots = true;
    settle(scene);
    project.scenes.push(scene);
    const curve = part(scene, figure, `curve:${figure.series![0]!.id}`);
    const root = renderScene(context(project, 'play'), scene);
    const drawn = root.querySelector(`[data-el="${curve.id}"]`)!;
    const lines = Array.from(drawn.querySelectorAll('polyline'));
    expect(lines).toHaveLength(2);
    expect(lines[0]!.getAttribute('points')).toBe(
      `0,${curve.box.h} ${curve.box.w / 4},${curve.box.h / 2}`,
    );
    expect(lines[0]!.getAttribute('fill')).toBe('none');
    expect(drawn.querySelectorAll('circle')).toHaveLength(4);
    // A curve that has been made free is a shape like any other, and is drawn the same.
    releaseFigure(scene, figure.id);
    settle(scene);
    expect(scene.elements.find((el) => el.id === curve.id)).toMatchObject({ geometry: 'curve' });
    const again = renderScene(context(project, 'play'), scene);
    expect(again.querySelectorAll(`[data-el="${curve.id}"] polyline`)).toHaveLength(2);
  });

  it('gives those who cannot see the diagram its numbers as a table', () => {
    const project = newProject('Testforelesning');
    const { scene, figure } = slide('bars', '\tEn\tTo\nA\t1\t2,5\nB\t3\t');
    figure.xTitle = 'X';
    settle(scene);
    project.scenes.push(scene);
    expect(chartTable(figure)).toEqual({
      head: ['X', 'En', 'To'],
      rows: [
        ['A', '1', '2,5'],
        ['B', '3', ''],
      ],
    });
    const root = renderScene(context(project, 'play'), scene);
    const table = root.querySelector(`[data-el="${figure.id}"] table`)!;
    expect(Array.from(table.querySelectorAll('tr')).map((tr) => tr.textContent)).toEqual([
      'XEnTo',
      'A12,5',
      'B3',
    ]);
    expect(table.querySelector('tr:nth-child(2) th')!.getAttribute('scope')).toBe('row');
    expect(table.closest('[aria-hidden]')).toBeNull();
    // In the editor the frame says nothing: the table is in the properties.
    const edited = renderScene(context(project, 'edit'), scene);
    expect(edited.querySelector(`[data-el="${figure.id}"] table`)).toBeNull();
    // A diagram without numbers has no table.
    const { scene: empty, figure: none } = slide('bars', '');
    none.items = [{ id: newId(), text: 'A', values: [null] }];
    settle(empty);
    expect(renderScene(context(project, 'play'), empty).querySelector('table')).toBeNull();
  });

  it('is copied with its slide, read back as written, and older projects are still read', () => {
    const project = newProject('Testforelesning');
    const { scene, figure } = slide('line', 'X\tEn\tTo\n0\t0\t4\n1\t\t3\n2\t2\t');
    figure.dots = true;
    figure.yMax = 10;
    figure.yTitle = 'Y';
    settle(scene);
    project.scenes.push(scene);
    const parsed = parseProject(JSON.parse(JSON.stringify(project)));
    expect(parsed.scenes[0]!.elements).toEqual(scene.elements);
    expect(settle(parsed.scenes[0]!)).toBe(false);
    const copy = cloneScene(scene);
    const copied = copy.elements.find((el): el is FigureElement => el.type === 'figure')!;
    expect(partsOf(copy, copied.id)).toHaveLength(partsOf(scene, figure.id).length);
    expect(settle(copy)).toBe(false);
    const old = JSON.parse(JSON.stringify(newProject('A'))) as { version: number };
    old.version = 12;
    expect(parseProject(old).version).toBe(FORMAT_VERSION);
    expect(FORMAT_VERSION).toBe(17);
  });
});
