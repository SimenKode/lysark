// Charts that PowerPoint itself has made: imports the presentation that
// tools/vm/diagrammer.ps1 lets PowerPoint make in the Windows VM (one chart
// of test numbers on each slide) and checks what becomes of each. The file
// is not in git; put it in eksempler/fra-powerpoint/diagram.pptx (see
// tools/windows-vm.py). Skipped when it is not there.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importPptx } from '../src/importer/pptx';
import { Project, type FigureElement, type TextElement } from '../src/shared/format/schema';
import { plainText } from '../src/shared/format/factory';

const file = resolve(__dirname, '../eksempler/fra-powerpoint/diagram.pptx');
const CONVERTED =
  'Diagrammet er gjort om til et Lysark-diagram med tallene fra PowerPoint. Se over at det stemmer.';
const NOT = 'Diagrammet følger ikke med og må lages på nytt.';

describe.skipIf(!existsSync(file))('charts made by PowerPoint itself', () => {
  const result = existsSync(file)
    ? importPptx(new Uint8Array(readFileSync(file)), { fileName: 'diagram.pptx' })
    : undefined;
  const figure = (slide: number): FigureElement | undefined =>
    result!.project.scenes[slide - 1]!.elements.find(
      (el): el is FigureElement => el.type === 'figure',
    );
  const heading = (slide: number): string | undefined => {
    const text = result!.project.scenes[slide - 1]!.elements.find(
      (el): el is TextElement => el.type === 'text' && !el.of,
    );
    return text ? plainText(text.content) : undefined;
  };
  const table = (one: FigureElement): unknown => ({
    series: one.series!.map((s) => s.name),
    rows: one.items.map((row) =>
      one.template === 'line' ? [row.x, row.values] : [row.text, row.values],
    ),
  });
  const said = (slide: number): string[] =>
    result!.report.warnings.filter((w) => w.slide === slide).map((w) => w.message);

  it('gives a valid project with thirteen slides', () => {
    expect(() => Project.parse(result!.project)).not.toThrow();
    expect(result!.project.scenes).toHaveLength(13);
  });

  it('makes standing bars into a bar diagram, as PowerPoint makes them and with test numbers', () => {
    // Slide 1 is a chart nobody has touched: PowerPoint's own three series and four names.
    const untouched = figure(1)!;
    expect(untouched.template).toBe('bars');
    expect(untouched.series).toHaveLength(3);
    expect(untouched.items).toHaveLength(4);
    expect(untouched.items.every((row) => row.values!.every((v) => typeof v === 'number'))).toBe(
      true,
    );
    const bars = figure(2)!;
    expect(bars.template).toBe('bars');
    expect(table(bars)).toEqual({
      series: ['Serie A', 'Serie B'],
      rows: [
        ['A', [1, 3]],
        ['B', [2.5, -1]],
        ['C', [null, 4]],
      ],
    });
    expect(bars).toMatchObject({ xTitle: 'Akse X', yTitle: 'Akse Y', yMax: 10 });
    expect(bars.yMin).toBeUndefined();
    expect(heading(2)).toBe('Diagram A');
    expect(said(1)).toEqual([CONVERTED]);
    expect(said(2)).toEqual([CONVERTED]);
  });

  it('makes a line chart into a line diagram only when numbers stand along its axis', () => {
    // Names along the axis: where the points stand would have to be made up.
    expect(figure(3)).toBeUndefined();
    expect(said(3)).toEqual([NOT]);
    const rows = [
      [0, [0, 4]],
      [1, [2, null]],
      [4, [4, 3]],
    ];
    const plain = figure(4)!;
    expect(plain.template).toBe('line');
    expect(table(plain)).toEqual({ series: ['Serie A', 'Serie B'], rows });
    expect(plain.dots).toBeUndefined();
    const marked = figure(5)!;
    expect(table(marked)).toEqual({ series: ['Serie A', 'Serie B'], rows });
    expect(marked).toMatchObject({ xTitle: 'Akse X', yTitle: 'Akse Y', dots: true });
    expect(heading(5)).toBe('Diagram A');
  });

  it('makes points with lines into a line diagram', () => {
    const rows = [
      [0, [1, 3]],
      [2, [2, 2]],
      [4, [3, 1]],
    ];
    const lines = figure(6)!;
    expect(lines.template).toBe('line');
    expect(table(lines)).toEqual({ series: ['Serie A', 'Serie B'], rows });
    expect(lines).toMatchObject({
      xTitle: 'Akse X',
      yTitle: 'Akse Y',
      xMin: 0,
      xMax: 8,
      dots: true,
    });
    // Without marks at the points there are no dots; smooth lines become straight ones.
    expect(table(figure(7)!)).toEqual({ series: ['Serie A', 'Serie B'], rows });
    expect(figure(7)!.dots).toBeUndefined();
    expect(table(figure(8)!)).toEqual({ series: ['Serie A', 'Serie B'], rows });
  });

  it('leaves every other chart as it was, and says so', () => {
    // Points without lines, stacked bars, lying bars, a pie and an area.
    for (const slide of [9, 10, 11, 12, 13]) {
      expect(figure(slide), `slide ${slide}`).toBeUndefined();
      expect(said(slide), `slide ${slide}`).toEqual([NOT]);
    }
  });
});
