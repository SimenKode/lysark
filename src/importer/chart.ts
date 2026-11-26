// Reads a chart of a PowerPoint file (a chart part, ppt/charts/chartN.xml)
// into the table of a Lysark diagram. The numbers are those PowerPoint has
// stored in the chart itself (its cache of the spreadsheet behind it); the
// embedded spreadsheet is never opened.
//
// Only what Lysark draws truthfully is read: standing bars side by side, and
// lines. A line chart with numbers along its axis has its points placed by
// them; one with names along it (PowerPoint's ordinary line chart) keeps the
// names, with the same distance between the points, as PowerPoint draws it
// (the owner's choice, 26.11.2026). Anything else (stacked or lying bars,
// pie, area, 3D, several kinds in one chart, a line chart with dates along
// the axis, points without lines) gives `undefined`, and the caller keeps
// the chart as what it was.
import { attr, child, children, descend, type XmlNode } from './xml';

export interface ChartTable {
  template: 'bars' | 'line';
  /** The names of the series. */
  series: string[];
  rows: Array<{ text: string; x: number | null; values: Array<number | null> }>;
  /** The chart's own heading. */
  title?: string;
  xTitle?: string;
  yTitle?: string;
  yMin?: number;
  yMax?: number;
  xMin?: number;
  xMax?: number;
  dots?: boolean;
  /** A line diagram whose rows stand by name, with the same distance between them. */
  along?: 'names';
}

/** The text of a rich-text title, its paragraphs joined by spaces. */
function richTitle(title: XmlNode | undefined): string | undefined {
  const paragraphs = children(descend(title, 'c:tx', 'c:rich'), 'a:p').map((p) =>
    children(p, 'a:r')
      .map((r) => child(r, 'a:t')?.text ?? '')
      .join(''),
  );
  const text = paragraphs.join(' ').replace(/\s+/g, ' ').trim();
  return text === '' ? undefined : text;
}

/** The cached cells a reference holds, by their place. Undefined for what cannot be read. */
function cells(ref: XmlNode | undefined): { count: number; at: Map<number, string> } | undefined {
  const cache =
    descend(ref, 'c:numRef', 'c:numCache') ??
    descend(ref, 'c:strRef', 'c:strCache') ??
    child(ref, 'c:numLit') ??
    child(ref, 'c:strLit');
  if (!cache) return undefined;
  const at = new Map<number, string>();
  for (const point of children(cache, 'c:pt')) {
    const index = Number(attr(point, 'idx'));
    const value = child(point, 'c:v')?.text;
    if (Number.isInteger(index) && index >= 0 && value !== undefined) at.set(index, value);
  }
  const said = Number(attr(child(cache, 'c:ptCount'), 'val'));
  const count = Math.max(Number.isInteger(said) ? said : 0, ...[...at.keys()].map((i) => i + 1));
  return { count, at };
}

function number(text: string | undefined): number | null {
  if (text === undefined || text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function seriesName(series: XmlNode): string {
  const tx = child(series, 'c:tx');
  const cached = cells(tx)?.at.get(0);
  return (cached ?? child(tx, 'c:v')?.text ?? '').replace(/\s+/g, ' ').trim();
}

/** True when the series is drawn without a line between its points. */
function withoutLine(series: XmlNode): boolean {
  return child(descend(series, 'c:spPr', 'a:ln'), 'a:noFill') !== undefined;
}

function hasMarkers(chart: XmlNode, all: XmlNode[], byDefault: boolean): boolean {
  const said = all.map((series) => attr(descend(series, 'c:marker', 'c:symbol'), 'val'));
  if (said.some((symbol) => symbol !== undefined && symbol !== 'none')) return true;
  if (said.length > 0 && said.every((symbol) => symbol === 'none')) return false;
  const marker = attr(child(chart, 'c:marker'), 'val');
  return marker === undefined ? byDefault : marker === '1' || marker === 'true';
}

function limits(axis: XmlNode | undefined): { min?: number; max?: number } {
  const scaling = child(axis, 'c:scaling');
  const min = number(attr(child(scaling, 'c:min'), 'val'));
  const max = number(attr(child(scaling, 'c:max'), 'val'));
  return { ...(min === null ? {} : { min }), ...(max === null ? {} : { max }) };
}

/** The table of a chart, when it is one Lysark can draw as its own diagram. */
export function readChart(root: XmlNode | undefined): ChartTable | undefined {
  const chartNode = child(root, 'c:chart');
  const plot = child(chartNode, 'c:plotArea');
  if (!plot) return undefined;
  const kinds = plot.children.filter((node) => /^c:\w+Chart$/.test(node.name));
  if (kinds.length !== 1) return undefined;
  const chart = kinds[0]!;
  const all = children(chart, 'c:ser');
  if (all.length === 0) return undefined;
  const title = richTitle(child(chartNode, 'c:title'));
  const table = (rest: Omit<ChartTable, 'series' | 'title'>): ChartTable => ({
    series: all.map(seriesName),
    ...(title ? { title } : {}),
    ...rest,
  });
  const grouping = attr(child(chart, 'c:grouping'), 'val') ?? 'standard';
  const valueAxes = children(plot, 'c:valAx');

  if (chart.name === 'c:barChart' || chart.name === 'c:lineChart') {
    const bars = chart.name === 'c:barChart';
    if (bars && (attr(child(chart, 'c:barDir'), 'val') ?? 'col') !== 'col') return undefined;
    if (grouping !== 'standard' && !(bars && grouping === 'clustered')) return undefined;
    if (valueAxes.length !== 1 || child(plot, 'c:dateAx')) return undefined;
    const names = all.map((series) => cells(child(series, 'c:cat'))).find((c) => c !== undefined);
    const values = all.map((series) => cells(child(series, 'c:val')));
    if (values.some((one) => one === undefined)) return undefined;
    const count = Math.max(names?.count ?? 0, ...values.map((one) => one!.count));
    if (count === 0) return undefined;
    const rows = Array.from({ length: count }, (_, i) => ({
      text: (names?.at.get(i) ?? '').replace(/\s+/g, ' ').trim(),
      x: null as number | null,
      values: values.map((one) => number(one!.at.get(i))),
    }));
    const xTitle = richTitle(child(child(plot, 'c:catAx'), 'c:title'));
    const yTitle = richTitle(child(valueAxes[0], 'c:title'));
    const y = limits(valueAxes[0]);
    const common = {
      ...(xTitle ? { xTitle } : {}),
      ...(yTitle ? { yTitle } : {}),
      ...(y.min === undefined ? {} : { yMin: y.min }),
      ...(y.max === undefined ? {} : { yMax: y.max }),
    };
    if (bars) return table({ template: 'bars', rows, ...common });
    if (all.some(withoutLine)) return undefined;
    const dots = hasMarkers(chart, all, false) ? { dots: true } : {};
    // Numbers along the axis: the points stand where the numbers say.
    const isNumber = (text: string): boolean =>
      /^\s*[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?\s*$/i.test(text);
    if (names && rows.every((row) => isNumber(row.text))) {
      for (const row of rows) {
        row.x = Number(row.text);
        row.text = '';
      }
      return table({ template: 'line', rows, ...common, ...dots });
    }
    // Names along the axis, as in PowerPoint's ordinary line chart: the
    // points stand in order, with the same distance between them. A chart
    // with nothing along its axis is numbered by PowerPoint, from 1.
    if (!names) rows.forEach((row, i) => (row.text = String(i + 1)));
    return table({ template: 'line', along: 'names', rows, ...common, ...dots });
  }

  if (chart.name === 'c:scatterChart') {
    const style = attr(child(chart, 'c:scatterStyle'), 'val') ?? 'lineMarker';
    if (style === 'marker' || style === 'none' || all.some(withoutLine)) return undefined;
    if (valueAxes.length !== 2) return undefined;
    const xs = all.map((series) => cells(child(series, 'c:xVal')));
    const ys = all.map((series) => cells(child(series, 'c:yVal')));
    if (xs.some((one) => one === undefined) || ys.some((one) => one === undefined)) {
      return undefined;
    }
    // One table has one column of x: the series must share theirs.
    const count = Math.max(...xs.map((one) => one!.count), ...ys.map((one) => one!.count));
    if (count === 0) return undefined;
    const rows = [];
    for (let i = 0; i < count; i++) {
      const x = number(xs[0]!.at.get(i));
      if (xs.some((one) => number(one!.at.get(i)) !== x)) return undefined;
      rows.push({ text: '', x, values: ys.map((one) => number(one!.at.get(i))) });
    }
    const across = valueAxes.find((axis) =>
      /^[bt]$/.test(attr(child(axis, 'c:axPos'), 'val') ?? ''),
    );
    const up = valueAxes.find((axis) => axis !== across);
    if (!across || !up) return undefined;
    const xTitle = richTitle(child(across, 'c:title'));
    const yTitle = richTitle(child(up, 'c:title'));
    const x = limits(across);
    const y = limits(up);
    return table({
      template: 'line',
      rows,
      ...(xTitle ? { xTitle } : {}),
      ...(yTitle ? { yTitle } : {}),
      ...(x.min === undefined ? {} : { xMin: x.min }),
      ...(x.max === undefined ? {} : { xMax: x.max }),
      ...(y.min === undefined ? {} : { yMin: y.min }),
      ...(y.max === undefined ? {} : { yMax: y.max }),
      ...(hasMarkers(chart, all, style.endsWith('Marker')) ? { dots: true } : {}),
    });
  }
  return undefined;
}
