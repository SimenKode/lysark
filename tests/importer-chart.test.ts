// Charts in a PowerPoint file: standing bars, and lines whose points have
// numbers along the axis, become Lysark diagrams with the chart's own
// numbers. Every other chart stays what it was before, a picture or a
// note. The decks are built in the test, with test numbers.
import { describe, expect, it } from 'vitest';
import { importPptx, type ImportResult } from '../src/importer/pptx';
import {
  Project,
  type FigureElement,
  type ShapeElement,
  type TextElement,
} from '../src/shared/format/schema';
import { plainText } from '../src/shared/format/factory';
import { followFigures } from '../src/shared/layout/groups';
import { followTemplates, partsOf } from '../src/shared/layout/templates';
import {
  LAYOUT_BLANK,
  REL,
  URI,
  buildPptx,
  graphicFrame,
  type DeckSpec,
} from './fixtures/buildPptx';

const NS =
  'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const points = (values: Array<string | number | null>): string =>
  `<c:ptCount val="${values.length}"/>` +
  values
    .map((value, i) => (value === null ? '' : `<c:pt idx="${i}"><c:v>${value}</c:v></c:pt>`))
    .join('');
const strings = (values: string[]): string =>
  `<c:strRef><c:f>Ark1!$A$1</c:f><c:strCache>${points(values)}</c:strCache></c:strRef>`;
const numbers = (values: Array<number | null>): string =>
  `<c:numRef><c:f>Ark1!$B$1</c:f><c:numCache><c:formatCode>General</c:formatCode>${points(values)}</c:numCache></c:numRef>`;
const title = (text: string): string =>
  `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>${text}</a:t></a:r></a:p></c:rich></c:tx></c:title>`;
/** A series of a bar or line chart: its name, what stands along the axis, and its numbers. */
const series = (name: string, along: string, values: Array<number | null>, more = ''): string =>
  `<c:ser><c:idx val="0"/><c:order val="0"/><c:tx>${strings([name])}</c:tx>${more}` +
  `<c:cat>${along}</c:cat><c:val>${numbers(values)}</c:val></c:ser>`;
/** A series of a scatter chart. */
const xy = (name: string, xs: Array<number | null>, ys: Array<number | null>, more = ''): string =>
  `<c:ser><c:idx val="0"/><c:order val="0"/><c:tx>${strings([name])}</c:tx>${more}` +
  `<c:xVal>${numbers(xs)}</c:xVal><c:yVal>${numbers(ys)}</c:yVal></c:ser>`;
const axes = (across = '', up = ''): string =>
  `<c:catAx><c:axId val="1"/><c:scaling/><c:axPos val="b"/>${across}</c:catAx>` +
  `<c:valAx><c:axId val="2"/>${up}<c:axPos val="l"/></c:valAx>`;
const space = (plot: string, before = ''): string =>
  `<c:chartSpace ${NS}><c:chart>${before}<c:plotArea><c:layout/>${plot}</c:plotArea></c:chart></c:chartSpace>`;
const bars = (inner: string, direction = 'col', grouping = 'clustered'): string =>
  `<c:barChart><c:barDir val="${direction}"/><c:grouping val="${grouping}"/>${inner}</c:barChart>`;

/** Imports a deck with one slide that holds the chart, at (200, 300) and 1000 by 500. */
function load(chart: string, spec: Partial<DeckSpec> = {}): ImportResult {
  const result = importPptx(
    buildPptx({
      layouts: [LAYOUT_BLANK],
      parts: { 'ppt/charts/chart1.xml': chart },
      slides: [
        {
          rels: [{ id: 'rIdChart', type: REL.chart, target: '../charts/chart1.xml' }],
          shapes: graphicFrame(
            200,
            300,
            1000,
            500,
            URI.chart,
            '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rIdChart"/>',
          ),
        },
      ],
      ...spec,
    }),
    { fileName: 'Test.pptx' },
  );
  expect(() => Project.parse(result.project)).not.toThrow();
  return result;
}
const figureOf = (result: ImportResult): FigureElement | undefined =>
  result.project.scenes[0]!.elements.find((el): el is FigureElement => el.type === 'figure');
const CONVERTED =
  'Diagrammet er gjort om til et Lysark-diagram med tallene fra PowerPoint. Se over at det stemmer.';
const NOT = 'Diagrammet følger ikke med og må lages på nytt.';
const said = (result: ImportResult): string[] => result.report.warnings.map((w) => w.message);

describe('a chart in a PowerPoint file', () => {
  it('becomes a bar diagram with the names, the series and the numbers it had', () => {
    const result = load(
      space(
        bars(
          series('En', strings(['A', 'B', 'C']), [1, 2.5, null]) +
            series('To', strings(['A', 'B', 'C']), [3, -1, 4]),
        ) + axes(title('X'), `<c:scaling><c:max val="10"/></c:scaling>${title('Y')}`),
        title('Diagram A') + '<c:autoTitleDeleted val="0"/>',
      ),
    );
    const scene = result.project.scenes[0]!;
    const figure = figureOf(result)!;
    expect(figure.template).toBe('bars');
    expect(figure.series!.map((one) => one.name)).toEqual(['En', 'To']);
    expect(figure.items.map((row) => [row.text, row.values])).toEqual([
      ['A', [1, 3]],
      ['B', [2.5, -1]],
      ['C', [null, 4]],
    ]);
    expect(figure).toMatchObject({ xTitle: 'X', yTitle: 'Y', yMax: 10 });
    expect(figure.yMin).toBeUndefined();
    // The chart's own heading stands over the diagram, in the room the chart had.
    const heading = scene.elements.find((el): el is TextElement => el.type === 'text' && !el.of)!;
    expect(plainText(heading.content)).toBe('Diagram A');
    expect(heading.box).toMatchObject({ x: 200, y: 300, w: 1000 });
    expect(figure.box.y).toBe(300 + heading.box.h);
    expect(figure.box.y + figure.box.h).toBe(800);
    // The bars are drawn already: nothing is left for the editor to do.
    const parts = partsOf(scene, figure.id);
    expect(parts.filter((el) => el.of!.part.startsWith('bar:'))).toHaveLength(5);
    const copy = structuredClone(scene);
    expect(followTemplates(copy) || followFigures(copy)).toBe(false);
    // The lecturer is told, and asked to look it over. No picture is kept beside it.
    expect(said(result)).toEqual([CONVERTED]);
    expect(result.report.warnings[0]!.code).toBe('chart');
    expect(scene.elements.some((el) => el.type === 'image')).toBe(false);
  });

  it('becomes a line diagram when every name along the axis is a number', () => {
    const result = load(
      space(
        `<c:lineChart><c:grouping val="standard"/>` +
          series('En', numbers([0, 1, 4]), [0, 2, 4]) +
          series('To', numbers([0, 1, 4]), [4, null, 3]) +
          `<c:marker val="1"/></c:lineChart>` +
          axes(),
      ),
    );
    const figure = figureOf(result)!;
    expect(figure.template).toBe('line');
    expect(figure.items.map((row) => [row.x, row.values, row.text])).toEqual([
      [0, [0, 4], ''],
      [1, [2, null], ''],
      [4, [4, 3], ''],
    ]);
    expect(figure.dots).toBe(true);
    const scene = result.project.scenes[0]!;
    const curves = partsOf(scene, figure.id).filter(
      (el): el is ShapeElement => el.type === 'shape' && el.geometry === 'curve',
    );
    expect(curves.map((el) => el.points)).toEqual([
      [
        [0, 1],
        [0.25, 0.5],
        [1, 0],
      ],
      [[0, 0], null, [1, 0.25]],
    ]);
    expect(said(result)).toEqual([CONVERTED]);

    // With names along the axis PowerPoint gives them the same distance, and
    // so does Lysark: the diagram keeps the names, and its points stand in order.
    const named = load(
      space(
        `<c:lineChart><c:grouping val="standard"/>` +
          series('En', strings(['A', 'B', 'C']), [1, null, 3]) +
          series('To', strings(['A', 'B', 'C']), [3, 2, 1]) +
          `</c:lineChart>` +
          axes(title('X')),
      ),
    );
    const byName = figureOf(named)!;
    expect(byName).toMatchObject({ template: 'line', along: 'names', xTitle: 'X' });
    expect(byName.items.map((row) => [row.text, row.x, row.values])).toEqual([
      ['A', undefined, [1, 3]],
      ['B', undefined, [null, 2]],
      ['C', undefined, [3, 1]],
    ]);
    const namedScene = named.project.scenes[0]!;
    const namedCurves = partsOf(namedScene, byName.id).filter(
      (el): el is ShapeElement => el.type === 'shape' && el.geometry === 'curve',
    );
    // Each point stands in the middle of its third of the plot.
    expect(namedCurves.map((el) => el.points!.map((point) => point?.[0]))).toEqual([
      [0.16667, undefined, 0.83333],
      [0.16667, 0.5, 0.83333],
    ]);
    expect(said(named)).toEqual([CONVERTED]);
    expect(followTemplates(structuredClone(namedScene))).toBe(false);
    // A name that is not a number among numbers: names, all of them.
    const mixed = figureOf(
      load(
        space(
          `<c:lineChart><c:grouping val="standard"/>` +
            series('En', strings(['1', 'B', '3']), [1, 2, 3]) +
            `</c:lineChart>` +
            axes(),
        ),
      ),
    )!;
    expect(mixed.along).toBe('names');
    expect(mixed.items.map((row) => row.text)).toEqual(['1', 'B', '3']);
    // Nothing along the axis at all: PowerPoint numbers the points from 1.
    const bare = figureOf(
      load(
        space(
          `<c:lineChart><c:grouping val="standard"/>` +
            `<c:ser><c:idx val="0"/><c:order val="0"/><c:tx>${strings(['En'])}</c:tx>` +
            `<c:val>${numbers([4, 5])}</c:val></c:ser></c:lineChart>` +
            axes(),
        ),
      ),
    )!;
    expect(bare.along).toBe('names');
    expect(bare.items.map((row) => [row.text, row.values])).toEqual([
      ['1', [4]],
      ['2', [5]],
    ]);
    // A chart with dates along the axis stays as it was, and so does one whose series has no line.
    const dated = space(
      `<c:lineChart><c:grouping val="standard"/>${series('En', numbers([1, 2]), [1, 2])}</c:lineChart>` +
        `<c:dateAx><c:axId val="1"/></c:dateAx><c:valAx><c:axId val="2"/><c:axPos val="l"/></c:valAx>`,
    );
    expect(figureOf(load(dated))).toBeUndefined();
    const dotsOnly = space(
      `<c:lineChart><c:grouping val="standard"/>` +
        series('En', numbers([1, 2]), [1, 2], '<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>') +
        `</c:lineChart>` +
        axes(),
    );
    expect(figureOf(load(dotsOnly))).toBeUndefined();
  });

  it('becomes a line diagram from a chart of points with lines, when the series share their x', () => {
    const scatterAxes =
      `<c:valAx><c:axId val="1"/><c:scaling><c:min val="0"/><c:max val="8"/></c:scaling><c:axPos val="b"/>${title('X')}</c:valAx>` +
      `<c:valAx><c:axId val="2"/><c:scaling/><c:axPos val="l"/>${title('Y')}</c:valAx>`;
    const scatter = (inner: string, style = 'lineMarker'): string =>
      space(
        `<c:scatterChart><c:scatterStyle val="${style}"/>${inner}</c:scatterChart>${scatterAxes}`,
      );
    const result = load(scatter(xy('En', [0, 2, 4], [1, 2, 3]) + xy('To', [0, 2, 4], [3, 2, 1])));
    const figure = figureOf(result)!;
    expect(figure.template).toBe('line');
    expect(figure.items.map((row) => [row.x, row.values])).toEqual([
      [0, [1, 3]],
      [2, [2, 2]],
      [4, [3, 1]],
    ]);
    expect(figure).toMatchObject({ xTitle: 'X', yTitle: 'Y', xMin: 0, xMax: 8, dots: true });
    expect(figure.yMin).toBeUndefined();
    // Without marks at the points, there are no dots.
    const plain = figureOf(load(scatter(xy('En', [0, 1], [1, 2]), 'line')))!;
    expect(plain.dots).toBeUndefined();
    // Series with different x cannot share one table, and points without lines are not lines.
    expect(
      figureOf(load(scatter(xy('En', [0, 2], [1, 2]) + xy('To', [0, 3], [3, 2])))),
    ).toBeUndefined();
    expect(figureOf(load(scatter(xy('En', [0, 2], [1, 2]), 'marker')))).toBeUndefined();
    expect(
      figureOf(
        load(scatter(xy('En', [0, 2], [1, 2], '<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>'))),
      ),
    ).toBeUndefined();
  });

  it('stays as it was when Lysark cannot draw it truthfully', () => {
    const one = series('En', strings(['A', 'B']), [1, 2]);
    const others: Record<string, string> = {
      'lying bars': space(bars(one, 'bar') + axes()),
      'stacked bars': space(bars(one, 'col', 'stacked') + axes()),
      'bars as parts of a hundred': space(bars(one, 'col', 'percentStacked') + axes()),
      'a pie': space(`<c:pieChart><c:varyColors val="1"/>${one}</c:pieChart>`),
      'bars in three dimensions': space(
        `<c:bar3DChart><c:barDir val="col"/><c:grouping val="clustered"/>${one}</c:bar3DChart>${axes()}`,
      ),
      'bars and a line in one': space(
        bars(one) + `<c:lineChart><c:grouping val="standard"/>${one}</c:lineChart>` + axes(),
      ),
      'a stacked line': space(
        `<c:lineChart><c:grouping val="stacked"/>${series('En', numbers([1, 2]), [1, 2])}</c:lineChart>${axes()}`,
      ),
      'bars without a series': space(bars('') + axes()),
      'nothing that can be read': '<c:chartSpace ' + NS + '/>',
    };
    for (const [what, chart] of Object.entries(others)) {
      const result = load(chart);
      expect(figureOf(result), what).toBeUndefined();
      expect(result.project.scenes[0]!.elements, what).toHaveLength(0);
      expect(said(result), what).toEqual([NOT]);
    }
    // A chart too small to hold axes and numbers is left alone too.
    const small = importPptx(
      buildPptx({
        layouts: [LAYOUT_BLANK],
        parts: { 'ppt/charts/chart1.xml': space(bars(one) + axes()) },
        slides: [
          {
            rels: [{ id: 'rIdChart', type: REL.chart, target: '../charts/chart1.xml' }],
            shapes: graphicFrame(
              0,
              0,
              200,
              100,
              URI.chart,
              '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rIdChart"/>',
            ),
          },
        ],
      }),
      { fileName: 'Test.pptx' },
    );
    expect(figureOf(small)).toBeUndefined();
  });
});
