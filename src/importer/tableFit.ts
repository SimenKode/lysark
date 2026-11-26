// How tall an imported table will be drawn, worked out from the widths of
// the letters, so that a table whose text needs more room than PowerPoint
// gave it can be made to fit its box: the text in it is made smaller,
// evenly, down to a size that can still be read.
//
// The estimate follows what the render code does with a table
// (renderTable in src/shared/render/scene.ts and .ls-table in css.ts):
// lines break at spaces and after hyphens, and a word wider than its cell
// is broken inside it. It errs on the side of too tall, since the letters'
// kerning is left out.
import type { Inset, RichText } from '../shared/format/schema';
import { charWidth } from './metrics';

/** The smallest font size, in stage pixels (7 pt on the slide), text in a table is made down to. */
export const MIN_TABLE_FONT = 14;

/** The cell margins of the theme (.ls-table td in css.ts). */
const THEME_INSET: Inset = { l: 14, t: 7, r: 14, b: 7 };
/** The rule under each row that is not a header (.ls-table td in css.ts). */
const RULE = 2;
/** Room taken by a list marker and the gap after it, in em (.ls-li, .ls-marker in css.ts). */
const MARKER = 1.1;
/** Sub- and superscripts are this much smaller (.ls-scene sub, sup in css.ts). */
const SCRIPT = 0.65;
/** The theme's space between paragraphs in em, when the table has none of its own (css.ts). */
const THEME_GAP = 0.4;
/** The theme's line height of a table (renderTable). */
const THEME_LINE = 1.3;

export interface FitCell {
  row: number;
  /** The first grid column the cell stands in. */
  column: number;
  colSpan: number;
  rowSpan: number;
  content: RichText;
  /** Font size as a factor on the table's. */
  scale: number;
  /** A header cell is set in bold. */
  header: boolean;
}

export interface FitTable {
  /** Width of each grid column, in stage pixels. */
  columns: number[];
  /** Least height of each row, in stage pixels. */
  rowHeights: number[];
  cells: FitCell[];
  inset?: Inset;
  lineHeight?: number;
  spaceBefore?: readonly number[];
  /** Font size factor per list level (the theme's). */
  levelScale: readonly number[];
}

interface Piece {
  width: number;
  /** True for a space or tab, where a line may break and which is not counted at the end of a line. */
  space: boolean;
  /** A line may break after this piece (after a hyphen). */
  breakAfter: boolean;
  /** A forced line break. */
  newline: boolean;
}

/** The characters of a paragraph as pieces, each with its width in pixels at `size`. */
function piecesOf(
  runs: RichText['paragraphs'][number]['runs'],
  size: number,
  bold: boolean,
): Piece[] {
  const pieces: Piece[] = [];
  for (const run of runs) {
    const factor = run.script ? SCRIPT : 1;
    for (const char of run.text) {
      if (char === '\n') {
        pieces.push({ width: 0, space: false, breakAfter: false, newline: true });
        continue;
      }
      // A space or a tab is where a line may break; a no-break space is not.
      const space = char === ' ' || char === '\t';
      pieces.push({
        width: charWidth(char === '\t' ? ' ' : char, bold || run.bold === true) * size * factor,
        space,
        breakAfter: char === '-' || char === '\u2013',
        newline: false,
      });
    }
  }
  return pieces;
}

/** How many lines a paragraph takes in a cell `room` pixels wide. */
export function lineCount(pieces: Piece[], room: number): number {
  let lines = 1;
  let width = 0; // of the line so far, without spaces at its end
  let pending = 0; // spaces at the end of the line so far
  let word: Piece[] = [];
  const place = (): void => {
    // The word goes on this line if it fits, otherwise it starts a new one;
    // a word wider than a whole line is broken where it reaches the edge.
    const wordWidth = word.reduce((sum, piece) => sum + piece.width, 0);
    if (width > 0 && width + pending + wordWidth > room) {
      lines += 1;
      width = 0;
    } else {
      width += width > 0 ? pending : 0;
    }
    pending = 0;
    for (const piece of word) {
      if (width > 0 && width + piece.width > room) {
        lines += 1;
        width = 0;
      }
      width += piece.width;
    }
    word = [];
  };
  for (const piece of pieces) {
    if (piece.newline) {
      place();
      lines += 1;
      width = 0;
      pending = 0;
      continue;
    }
    if (piece.space) {
      place();
      pending += piece.width;
      continue;
    }
    word.push(piece);
    if (piece.breakAfter) place();
  }
  place();
  return lines;
}

/** The height of a cell's text, in pixels, in a cell `room` pixels wide. */
function textHeight(table: FitTable, cell: FitCell, size: number, room: number): number {
  const line = table.lineHeight ?? THEME_LINE;
  let height = 0;
  cell.content.paragraphs.forEach((paragraph, index) => {
    const own = size * (table.levelScale[paragraph.level] ?? 1);
    const marker = paragraph.list === 'none' ? 0 : MARKER * own;
    const indent =
      paragraph.level > 0 && paragraph.list === 'none' ? paragraph.level * 1.3 * own : 0;
    const lines = lineCount(
      piecesOf(paragraph.runs, own, cell.header),
      Math.max(1, room - marker - indent),
    );
    if (index > 0) {
      height += table.spaceBefore
        ? (table.spaceBefore[paragraph.level] ?? 0) * size
        : THEME_GAP * size;
    }
    height += lines * line * own;
  });
  return Math.max(height, line * size);
}

/** The height the table is drawn with when its font size is `fontSize` stage pixels. */
export function tableHeight(table: FitTable, fontSize: number): number {
  const inset = table.inset ?? THEME_INSET;
  const rows = table.rowHeights.map((least) => least);
  const spanning: Array<{ cell: FitCell; height: number }> = [];
  for (const cell of table.cells) {
    if (cell.row >= rows.length) continue;
    const width = table.columns
      .slice(cell.column, cell.column + cell.colSpan)
      .reduce((sum, column) => sum + column, 0);
    const room = Math.max(1, width - inset.l - inset.r);
    const height =
      textHeight(table, cell, fontSize * cell.scale, room) +
      inset.t +
      inset.b +
      (cell.header ? 0 : RULE);
    if (cell.rowSpan > 1) spanning.push({ cell, height });
    else rows[cell.row] = Math.max(rows[cell.row]!, height);
  }
  // A cell over several rows makes the last of them taller when it needs the room.
  for (const { cell, height } of spanning) {
    const last = Math.min(rows.length, cell.row + cell.rowSpan) - 1;
    const sum = rows.slice(cell.row, last + 1).reduce((a, b) => a + b, 0);
    if (sum < height) rows[last]! += height - sum;
  }
  return rows.reduce((a, b) => a + b, 0);
}

/**
 * The font size that makes the table fit `room` pixels of height: its own
 * when it fits as it is, otherwise smaller, but never so small that the
 * smallest text in it goes under MIN_TABLE_FONT. `fits` is false when the
 * table is still too tall at that limit.
 */
export function fitTable(
  table: FitTable,
  fontSize: number,
  room: number,
): { fontSize: number; fits: boolean } {
  if (tableHeight(table, fontSize) <= room) return { fontSize, fits: true };
  const scales = table.cells
    .filter((cell) => cell.content.paragraphs.some((p) => p.runs.some((r) => r.text.trim())))
    .map((cell) => cell.scale);
  const smallest = fontSize * Math.min(1, ...scales);
  const least = Math.min(1, MIN_TABLE_FONT / smallest);
  if (least >= 1) return { fontSize, fits: false };
  const floor = Math.ceil(fontSize * least * 10) / 10;
  if (tableHeight(table, floor) > room) return { fontSize: floor, fits: false };
  // The largest size, in tenths of a pixel, that fits.
  let low = floor;
  let high = fontSize;
  while (high - low > 0.1) {
    const middle = Math.round(((low + high) / 2) * 10) / 10;
    if (middle <= low || middle >= high) break;
    if (tableHeight(table, middle) <= room) low = middle;
    else high = middle;
  }
  return { fontSize: low, fits: true };
}
