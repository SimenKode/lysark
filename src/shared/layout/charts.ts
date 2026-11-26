// Bar and line diagrams: figures with a form whose form is a table of
// numbers. Like the other figures with a form they are drawn with ordinary
// elements: the bars are rectangles, a line is one curve, and the numbers
// and names at the axes are text boxes. This file works out those parts
// from the table (`chartParts`, used by `followTemplates` in
// ./templates.ts), reads and writes numbers the way they are written in
// Norwegian, and changes the table.
//
// Nothing here knows any numbers of its own: a diagram without numbers has
// axes and nothing on them. And like ./rows.ts this file takes only types
// from the project format, since the HTML player uses `chartTable`.
import type { Box, FigureElement, FigureItem, PaletteColor, RichText } from '../format/schema';
import { SERIES_ORDER } from '../theme/palette';
import type { PartSpec } from './templates';

/** The size of the letters in a new diagram, in stage pixels. */
export const CHART_FONT_SIZE = 28;
const NBSP = ' ';
const MINUS = '−';

export function isChart(figure: Pick<FigureElement, 'template'>): boolean {
  return figure.template === 'bars' || figure.template === 'line';
}

// ---------- Numbers as they are written ----------

/**
 * Reads a number the way it is written in Norwegian ("1,5", "1 000",
 * "1.000,5") or in English ("1.5"). Returns null for nothing written, and
 * undefined for what is not a number.
 */
export function parseNumber(text: string): number | null | undefined {
  let clean = text.replace(/[\s  ]/g, '').replace(MINUS, '-');
  if (clean === '') return null;
  if (clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(clean)) return undefined;
  const value = Number(clean);
  return Number.isFinite(value) ? value : undefined;
}

/** A number as it is written in Norwegian: comma for decimals, a space between thousands. */
export function formatNumber(value: number, decimals?: number): string {
  let text =
    decimals === undefined
      ? String(Number(value.toPrecision(12)))
      : (Math.abs(value) < 0.5 * 10 ** -decimals ? 0 : value).toFixed(decimals);
  if (/e/i.test(text)) return text.replace('.', ',').replace('-', MINUS);
  const negative = text.startsWith('-');
  if (negative) text = text.slice(1);
  let [whole, fraction] = text.split('.') as [string, string | undefined];
  if (whole.length > 4) whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${negative ? MINUS : ''}${whole}${fraction ? `,${fraction}` : ''}`;
}

export interface Scale {
  min: number;
  max: number;
  /** The numbers written along the axis. */
  ticks: number[];
  /** How many decimals those numbers are written with. */
  decimals: number;
}

/**
 * An axis for numbers from `lo` to `hi`: it begins and ends on round
 * numbers, with round numbers between (1, 2 or 5 times a power of ten). An
 * end the lecturer has fixed is kept as it is.
 */
export function niceScale(lo: number, hi: number, fixedMin?: number, fixedMax?: number): Scale {
  let a = fixedMin ?? lo;
  let b = fixedMax ?? hi;
  if (!(b > a)) {
    // What was fixed leaves no room: the numbers decide.
    if (fixedMin !== undefined || fixedMax !== undefined) return niceScale(lo, hi);
    // One number only: the axis runs from zero to it.
    if (a === 0) b = 1;
    else if (a > 0) a = 0;
    else b = 0;
  }
  const rough = (b - a) / 5;
  const power = 10 ** Math.floor(Math.log10(rough));
  const part = rough / power;
  const step = (part < 1.5 ? 1 : part < 3.5 ? 2 : part < 7.5 ? 5 : 10) * power;
  const decimals = Math.max(0, Math.min(8, -Math.floor(Math.log10(step) + 1e-9)));
  const round = (value: number): number => Number(value.toFixed(decimals + 2));
  const min = fixedMin ?? round(Math.floor(a / step + 1e-9) * step);
  const max = fixedMax ?? round(Math.ceil(b / step - 1e-9) * step);
  const ticks: number[] = [];
  for (let i = Math.ceil(min / step - 1e-9); i * step <= max + step * 1e-9; i++) {
    ticks.push(round(i * step));
  }
  return { min, max, ticks, decimals };
}

// ---------- The table ----------

/** The colour of a series: its own, or the theme's for a series in that place. */
export function seriesColor(figure: FigureElement, index: number): PaletteColor {
  return figure.series?.[index]?.color ?? SERIES_ORDER[index % SERIES_ORDER.length]!;
}

/** A row with nothing written in it, for a diagram with the series it has. */
export function emptyRow(figure: FigureElement, id: string): FigureItem {
  const row: FigureItem = {
    id,
    text: '',
    values: Array.from({ length: figure.series?.length ?? 0 }, () => null),
  };
  if (figure.template === 'line') row.x = null;
  return row;
}

export function addSeries(figure: FigureElement, id: string, name = ''): void {
  figure.series = [...(figure.series ?? []), { id, name }];
  for (const row of figure.items) {
    row.values = Array.from({ length: figure.series.length }, (_, i) => row.values?.[i] ?? null);
  }
}

export function removeSeries(figure: FigureElement, index: number): void {
  if (!figure.series || index < 0 || index >= figure.series.length) return;
  figure.series.splice(index, 1);
  for (const row of figure.items) row.values?.splice(index, 1);
}

/**
 * Lays what was copied from a spreadsheet (lines of cells with tabs
 * between) into the table from one cell and on, with new rows and series
 * where the table ends. Column 0 is the name of a bar diagram's row or the
 * x of a line diagram's; the series follow. A first line that holds no
 * numbers, pasted at the top, is taken as the names of the series.
 * A cell that is not a number where one belongs is left as it was.
 */
export function pasteTable(
  figure: FigureElement,
  row: number,
  column: number,
  text: string,
  newId: () => string,
): void {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/\n+$/, '')
    .split('\n')
    .map((line) => line.split('\t'));
  if (lines.length === 0) return;
  const bars = figure.template === 'bars';
  const isNumber = (cell: string): boolean => typeof parseNumber(cell) === 'number';
  const first = lines[0]!;
  const values = (line: string[]): string[] => line.slice(column === 0 ? 1 : 0);
  const heading =
    row === 0 &&
    lines.length > 1 &&
    values(first).some((cell) => cell.trim() !== '') &&
    !values(first).some(isNumber) &&
    lines.slice(1).some((line) => values(line).some(isNumber));
  const width = Math.max(...lines.map((line) => line.length));
  while ((figure.series?.length ?? 0) < column + width - 1) addSeries(figure, newId());
  if (heading) {
    first.forEach((cell, i) => {
      const at = column + i - 1;
      if (at >= 0 && cell.trim() !== '') figure.series![at]!.name = cell.trim();
    });
    lines.shift();
  }
  lines.forEach((line, r) => {
    while (figure.items.length <= row + r) figure.items.push(emptyRow(figure, newId()));
    const item = figure.items[row + r]!;
    item.values = Array.from(
      { length: figure.series?.length ?? 0 },
      (_, i) => item.values?.[i] ?? null,
    );
    line.forEach((cell, i) => {
      const at = column + i;
      if (at === 0 && bars) {
        item.text = cell.trim();
        return;
      }
      const value = parseNumber(cell);
      if (value === undefined) return;
      if (at === 0) item.x = value;
      else item.values![at - 1] = value;
    });
  });
}

/**
 * The diagram as a table of text, for those who cannot see it: the first
 * column is the names or the x, then one column for each series.
 */
export function chartTable(figure: FigureElement): { head: string[]; rows: string[][] } {
  const series = figure.series ?? [];
  const cell = (value: number | null | undefined): string =>
    typeof value === 'number' ? formatNumber(value) : '';
  return {
    head: [(figure.xTitle ?? '').trim(), ...series.map((one) => one.name.trim())],
    rows: figure.items.map((row) => [
      figure.template === 'line' ? cell(row.x) : row.text.trim(),
      ...series.map((_, i) => cell(row.values?.[i])),
    ]),
  };
}

// ---------- What a diagram consists of ----------

function words(text: string): RichText {
  return { paragraphs: [{ level: 0, list: 'none', runs: [{ text }] }] };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function whole(box: Omit<Box, 'rotation'>): Box {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    w: Math.max(1, Math.round(box.w)),
    h: Math.max(1, Math.round(box.h)),
    rotation: 0,
  };
}

/** How wide a text of that many letters is, about. The layout cannot measure it. */
function widthOf(text: string, size: number): number {
  return text.length * size * 0.6 + 14;
}

const numbers = (list: Array<number | null | undefined>): number[] =>
  list.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

/** The parts a diagram is drawn with, in the order they lie on the slide. */
export function chartParts(figure: FigureElement): PartSpec[] {
  const { x, y, w, h } = figure.box;
  const size = figure.fontSize ?? CHART_FONT_SIZE;
  const small = Math.round(size * 0.85);
  const series = figure.series ?? [];
  const bars = figure.template === 'bars';
  const specs: PartSpec[] = [];
  const text = (
    part: string,
    content: string,
    box: Omit<Box, 'rotation'>,
    align: 'left' | 'center' | 'right',
    valign: 'top' | 'middle' = 'middle',
    fontSize = small,
  ): void => {
    specs.push({
      part,
      words: { content: words(content), fontSize, align, valign },
      box: whole(box),
    });
  };

  // The rows that can be drawn, and the axes their numbers ask for.
  const rows = bars ? figure.items : figure.items.filter((row) => typeof row.x === 'number');
  const ys = numbers(rows.flatMap((row) => series.map((_, i) => row.values?.[i])));
  const xs = bars ? [] : numbers(rows.map((row) => row.x));
  const fixed = (value: number | undefined, zero: (v: number) => number): number | undefined =>
    value === undefined ? undefined : bars ? zero(value) : value;
  const sy =
    ys.length > 0
      ? niceScale(
          bars ? Math.min(0, ...ys) : Math.min(...ys),
          bars ? Math.max(0, ...ys) : Math.max(...ys),
          fixed(figure.yMin, (v) => Math.min(0, v)),
          fixed(figure.yMax, (v) => Math.max(0, v)),
        )
      : undefined;
  const sx =
    xs.length > 0 && ys.length > 0
      ? niceScale(Math.min(...xs), Math.max(...xs), figure.xMin, figure.xMax)
      : undefined;

  // The room round the plot: a row over it for the title of the vertical
  // axis and the legend, a column for the numbers, a row for the names or
  // numbers under it, and one for the title of the horizontal axis.
  const yTitle = (figure.yTitle ?? '').trim();
  const xTitle = (figure.xTitle ?? '').trim();
  const named = series.filter((one) => one.name.trim() !== '');
  const tickTexts = sy ? sy.ticks.map((tick) => formatNumber(tick, sy.decimals)) : [];
  const top = yTitle || named.length > 0 ? Math.round(size * 1.8) : Math.round(small * 0.8);
  // The numbers under a line diagram stand under their places, so the first
  // and the last need half their width outside the plot.
  const xTexts = sx ? sx.ticks.map((tick) => formatNumber(tick, sx.decimals)) : [];
  const half = (text: string | undefined): number => (text ? widthOf(text, small) / 2 : 0);
  const left = sy
    ? Math.round(
        clamp(
          Math.max(...tickTexts.map((t) => widthOf(t, small)), half(xTexts[0])) + 6,
          44,
          w * 0.3,
        ),
      )
    : 12;
  const under = Math.round(small * 1.7);
  const hasUnder = bars ? figure.items.some((row) => row.text.trim() !== '') : sx !== undefined;
  const titleH = Math.round(size * 1.7);
  const bottom = (hasUnder ? under : 8) + (xTitle ? titleH : 0);
  const right = bars
    ? 6
    : Math.round(clamp(Math.max(small * 0.8, half(xTexts[xTexts.length - 1])), 8, w * 0.2));
  const plot = {
    x: Math.round(x + left),
    y: Math.round(y + top),
    w: Math.max(40, Math.round(w - left - right)),
    h: Math.max(40, Math.round(h - top - bottom)),
  };
  const py = (value: number): number =>
    sy ? plot.y + plot.h * (1 - (value - sy.min) / (sy.max - sy.min)) : plot.y + plot.h;
  const px = (value: number): number =>
    sx ? plot.x + (plot.w * (value - sx.min)) / (sx.max - sx.min) : plot.x;
  const base = bars && sy ? py(0) : plot.y + plot.h;

  // The lines across at each number, but not where an axis lies.
  if (sy) {
    sy.ticks.forEach((tick, i) => {
      const at = py(tick);
      if (Math.abs(at - base) >= 1) {
        specs.push({
          part: `grid:${i}`,
          look: { geometry: 'line', strokeWidth: 1 },
          box: whole({ x: plot.x, y: at, w: plot.w, h: 1 }),
        });
      }
      text(
        `tick:${i}`,
        tickTexts[i]!,
        { x, y: at - small * 0.75, w: left - 10, h: small * 1.5 },
        'right',
      );
    });
  }

  if (bars) {
    const n = Math.max(1, figure.items.length);
    const slot = plot.w / n;
    const group = slot * 0.72;
    const each = group / Math.max(1, series.length);
    const gap = series.length > 1 ? Math.min(6, each * 0.12) : 0;
    figure.items.forEach((row, r) => {
      series.forEach((one, k) => {
        const value = row.values?.[k];
        if (!sy || typeof value !== 'number' || !Number.isFinite(value)) return;
        const shown = clamp(value, sy.min, sy.max);
        const from = py(Math.max(shown, 0));
        const to = py(Math.min(shown, 0));
        specs.push({
          part: `bar:${row.id}:${one.id}`,
          look: { geometry: 'rect', fill: seriesColor(figure, k) },
          box: whole({
            x: plot.x + slot * r + (slot - group) / 2 + each * k + gap / 2,
            // A bar of nothing is still seen, as a thin line on the axis.
            y: Math.min(from, to - 2),
            w: each - gap,
            h: Math.max(2, to - from),
          }),
        });
      });
      if (row.text.trim() !== '') {
        text(
          `label:${row.id}`,
          row.text.trim(),
          { x: plot.x + slot * r, y: plot.y + plot.h + 6, w: slot, h: under - 6 },
          'center',
          'top',
        );
      }
    });
  } else if (sx && sy) {
    const room = Math.min(220, plot.w / Math.max(1, sx.ticks.length - 1));
    sx.ticks.forEach((tick, i) => {
      // As wide as there is room for, but never out of the frame.
      const at = px(tick);
      const reach = Math.max(8, Math.min(room / 2, at - x, x + w - at));
      text(
        `xtick:${i}`,
        xTexts[i]!,
        { x: at - reach, y: plot.y + plot.h + 6, w: reach * 2, h: under - 6 },
        'center',
        'top',
      );
    });
    series.forEach((one, k) => {
      // A point without a number, or outside an axis that is fixed, is a break in the curve.
      const points = rows.map((row): [number, number] | null => {
        const value = row.values?.[k];
        const at = row.x as number;
        if (typeof value !== 'number' || !Number.isFinite(value)) return null;
        if (value < sy.min || value > sy.max || at < sx.min || at > sx.max) return null;
        const round = (fraction: number): number => Number(fraction.toFixed(5));
        return [
          round((at - sx.min) / (sx.max - sx.min)),
          round(1 - (value - sy.min) / (sy.max - sy.min)),
        ];
      });
      const tidy = points.filter(
        (point, i) => point !== null || (i > 0 && points[i - 1] !== null && i < points.length - 1),
      );
      while (tidy.length > 0 && tidy[tidy.length - 1] === null) tidy.pop();
      if (tidy.length === 0) return;
      specs.push({
        part: `curve:${one.id}`,
        look: {
          geometry: 'curve',
          stroke: seriesColor(figure, k),
          strokeWidth: 5,
          points: tidy,
          ...(figure.dots ? { dots: true } : {}),
        },
        box: whole(plot),
      });
    });
  }

  // The axes lie in front of the bars, so the line they stand on is whole.
  specs.push({
    part: 'axis:y',
    look: { geometry: 'line', strokeWidth: 3 },
    box: whole({ x: plot.x, y: plot.y, w: 1, h: plot.h }),
  });
  specs.push({
    part: 'axis:x',
    look: { geometry: 'line', strokeWidth: 3 },
    box: whole({ x: plot.x, y: base, w: plot.w, h: 1 }),
  });

  if (yTitle) {
    text('title:y', yTitle, { x, y, w: w * 0.45, h: top - 8 }, 'left', 'middle', size);
  }
  if (xTitle) {
    text(
      'title:x',
      xTitle,
      { x: plot.x, y: y + h - titleH, w: plot.w, h: titleH },
      'center',
      'middle',
      size,
    );
  }

  // The legend: the colour and name of each series that has a name, to the right over the plot.
  if (named.length > 0) {
    const key = Math.round(small * 0.8);
    const room = (yTitle ? w * 0.55 : w) - named.length * (key + 8) - (named.length - 1) * 24;
    const wanted = named.map((one) => Math.min(360, widthOf(one.name.trim(), small)));
    const total = wanted.reduce((sum, one) => sum + one, 0);
    const shrink = total > room ? Math.max(0.2, room / total) : 1;
    let at = x + w;
    for (let i = named.length - 1; i >= 0; i--) {
      const one = named[i]!;
      const width = wanted[i]! * shrink;
      at -= width;
      text(`name:${one.id}`, one.name.trim(), { x: at, y, w: width, h: top - 8 }, 'left');
      at -= key + 8;
      specs.push({
        part: `key:${one.id}`,
        look: { geometry: 'rect', fill: seriesColor(figure, series.indexOf(one)) },
        box: whole({ x: at, y: y + (top - 8 - key) / 2, w: key, h: key }),
      });
      at -= 24;
    }
  }
  return specs;
}
