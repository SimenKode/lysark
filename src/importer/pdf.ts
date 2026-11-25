// The parts of the PDF import that need neither a canvas nor pdf.js: how a
// page is fitted to the stage, how the pieces of text pdf.js hands out
// become lines, paragraphs and text elements standing where the text stood,
// which of the page's drawing operations are text, pictures and the rest,
// and how the pages become a project. The drawing itself happens in the
// interface (src/renderer/src/pdfRender.ts).
import { STAGE } from '../shared/format/constants';
import { newId, newProject, newScene } from '../shared/format/factory';
import {
  SURFACES,
  type Asset,
  type Box,
  type Element,
  type ImportWarning,
  type PaletteColor,
  type Paragraph,
  type Project,
  type Run,
  type Scene,
  type Surface,
  type TextElement,
} from '../shared/format/schema';
import { isAllowedTextColor, isLargeText } from '../shared/theme/contrast';
import { PALETTE } from '../shared/theme/palette';
import { THEME_REN, defaultTextColor } from '../shared/theme/theme';

/** Pixels per stage unit: a page is drawn at double resolution. */
export const PDF_PIXEL_DENSITY = 2;

/**
 * Longest alternative text a page gets. A page of running text is some
 * thousand characters; beyond this the text is cut at a word, with "…",
 * so that one page cannot make the project file and the HTML file heavy.
 */
export const ALT_LIMIT = 4000;

/** Longest title a scene gets from the first line of its page. */
export const TITLE_LIMIT = 80;

export interface PageFit {
  /** Where the page stands on the stage: its own proportions, centred. */
  box: Box;
  /** Size of the picture of the whole page. */
  pixelWidth: number;
  pixelHeight: number;
}

/**
 * Fits a page (in any unit) to the stage. The page fills the stage in one
 * direction and is centred in the other. The picture is drawn at double
 * resolution, so it is at most 3840 x 2160 pixels.
 */
export function fitPage(width: number, height: number): PageFit {
  if (!(width > 0) || !(height > 0)) throw new Error('Siden har ingen størrelse.');
  const maxW = STAGE.width * PDF_PIXEL_DENSITY;
  const maxH = STAGE.height * PDF_PIXEL_DENSITY;
  const scale = Math.min(maxW / width, maxH / height);
  const pixelWidth = Math.min(maxW, Math.max(1, Math.round(width * scale)));
  const pixelHeight = Math.min(maxH, Math.max(1, Math.round(height * scale)));
  // The box is exactly half the picture, so every picture pixel is a quarter of a stage unit.
  const w = pixelWidth / PDF_PIXEL_DENSITY;
  const h = pixelHeight / PDF_PIXEL_DENSITY;
  return {
    box: { x: (STAGE.width - w) / 2, y: (STAGE.height - h) / 2, w, h, rotation: 0 },
    pixelWidth,
    pixelHeight,
  };
}

/** A piece of text as pdf.js hands it out. */
export interface PdfTextItem {
  str: string;
  /** The piece ends a line. */
  hasEOL: boolean;
}

/**
 * Joins the text pieces of a page into lines. The order is the one the PDF
 * itself has, which is the order the program that made it wrote the text
 * boxes in: a column or a text box stays together, and nothing is guessed
 * from positions. pdf.js has already put spaces between words and marked
 * where each line ends. Empty lines are dropped.
 */
export function pageLines(items: PdfTextItem[]): string[] {
  const lines: string[] = [];
  let current = '';
  const end = (): void => {
    const line = current.replace(/\s+/g, ' ').trim();
    if (line) lines.push(line);
    current = '';
  };
  for (const item of items) {
    current += item.str;
    if (item.hasEOL) end();
  }
  end();
  return lines;
}

/** Cuts a text at a word when it is longer than the limit, and marks the cut with "…". */
function cut(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const head = text.slice(0, limit - 1);
  const space = head.search(/\s\S*$/);
  // A cut in the middle of a very long word is better than losing most of the text.
  return `${(space > limit / 2 ? head.slice(0, space) : head).trimEnd()}…`;
}

/** The page's text as the alternative text of its picture. Empty when the page has no text. */
export function altText(lines: string[]): string {
  return cut(lines.join('\n'), ALT_LIMIT);
}

/** The first line of the page's text, or "Side N" when the page has none. */
export function pageTitle(lines: string[], pageNumber: number): string {
  const first = lines[0];
  return first ? cut(first, TITLE_LIMIT) : `Side ${pageNumber}`;
}

/** Titles programs fill in by themselves; they say nothing about the content. */
const GENERIC_TITLES = new Set([
  'powerpoint presentation',
  'powerpoint-presentasjon',
  'untitled',
  'uten navn',
  'uten tittel',
]);

function titleFromFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return base.replace(/\.pdf$/i, '').trim() || 'PDF';
}

/**
 * The project's title: the title in the PDF's own information when it is a
 * real one, otherwise the file's name. Titles that are only a file name
 * ("Microsoft PowerPoint - a.pptx", "a.pdf") are not counted as real.
 */
export function documentTitle(metaTitle: unknown, fileName: string): string {
  const title = typeof metaTitle === 'string' ? metaTitle.replace(/\s+/g, ' ').trim() : '';
  const real =
    title !== '' &&
    !GENERIC_TITLES.has(title.toLowerCase()) &&
    !/^Microsoft \w+ - /i.test(title) &&
    !/\.(pptx?|ppsx?|potx?|odp|key|docx?|pdf)$/i.test(title);
  return real ? cut(title, 200) : titleFromFileName(fileName);
}

// ---------- What a page draws ----------

/** A rectangle on the stage. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A transformation as PDF and the canvas write it: [a, b, c, d, e, f]. */
export type Matrix = [number, number, number, number, number, number];

/** `m` applied first, then `by`. */
export function multiply(by: Matrix, m: ArrayLike<number>): Matrix {
  return [
    by[0] * m[0]! + by[2] * m[1]!,
    by[1] * m[0]! + by[3] * m[1]!,
    by[0] * m[2]! + by[2] * m[3]!,
    by[1] * m[2]! + by[3] * m[3]!,
    by[0] * m[4]! + by[2] * m[5]! + by[4],
    by[1] * m[4]! + by[3] * m[5]! + by[5],
  ];
}

/**
 * What one operation of a page does when it is drawn: nothing that shows
 * by itself (it sets things up for the ones that follow, and must always be
 * run), text, a picture that can be taken out as an element of its own, or
 * anything else that paints.
 */
export const OP_SETUP = 0;
export const OP_TEXT = 1;
export const OP_PICTURE = 2;
export const OP_OTHER = 3;

/** A picture a page draws, as the PDF places it. */
export interface PagePicture {
  /** The operation that draws it. */
  index: number;
  /** From the picture's unit square to the page's own coordinates. */
  matrix: Matrix;
  /** Pixels the PDF holds for it. 0 when not known. */
  pixelWidth: number;
  pixelHeight: number;
}

/** A shape a page paints: the operation, and its bounds in the page's own coordinates. */
export interface PagePath {
  index: number;
  /** Two opposite corners: [x0, y0, x1, y1]. */
  bounds: [number, number, number, number];
  /** Only its outline is painted: a line, or the edge of a shape. */
  outline: boolean;
}

export interface PageOperations {
  /** One of OP_SETUP, OP_TEXT, OP_PICTURE and OP_OTHER for every operation. */
  kinds: Uint8Array;
  pictures: PagePicture[];
  /** The painted shapes that say how large they are, outside notes and groups. */
  paths: PagePath[];
  /**
   * The page is built in a way that makes it unsafe to draw its text,
   * pictures and the rest separately: text used as a cutting shape, or a
   * shape that is painted and used as a cutting shape in one go.
   */
  entangled: boolean;
}

/**
 * Sorts the operations of a page (pdf.js' operator list) into what they
 * draw, and follows the transformations far enough to know where every
 * picture stands. `ops` is the table of operation numbers from pdf.js.
 *
 * Everything inside a mask is setup: a mask decides how later things show,
 * and must be drawn whole whatever is being taken out. What a note on the
 * page (an annotation) draws, and what is drawn inside a transparency
 * group, is left with "the rest": pdf.js hands out no text pieces for the
 * first, and the second is composed in ways that taking parts out would break.
 */
export function sortOperations(
  fnArray: ArrayLike<number>,
  argsArray: ArrayLike<unknown>,
  ops: Record<string, number>,
): PageOperations {
  const op = (name: string): number => ops[name] ?? -1;
  const texts = new Set(
    ['showText', 'showSpacedText', 'nextLineShowText', 'nextLineSetSpacingShowText'].map(op),
  );
  const pictures = new Set([op('paintImageXObject'), op('paintInlineImageXObject')]);
  const others = new Set(
    [
      'paintImageMaskXObject',
      'paintImageMaskXObjectGroup',
      'paintImageXObjectRepeat',
      'paintImageMaskXObjectRepeat',
      'paintInlineImageXObjectGroup',
      'paintSolidColorImageMask',
      'shadingFill',
      'rawFillPath',
      'stroke',
      'closeStroke',
      'fill',
      'eoFill',
      'fillStroke',
      'eoFillStroke',
      'closeFillStroke',
      'closeEOFillStroke',
    ].map(op),
  );
  const kinds = new Uint8Array(fnArray.length);
  const found: PagePicture[] = [];
  const paths: PagePath[] = [];
  let entangled = false;
  let matrix: Matrix = [1, 0, 0, 1, 0, 0];
  const saved: Matrix[] = [];
  /** For each open group: whether it is a mask. */
  const groups: boolean[] = [];
  let masks = 0;
  let notes = 0;

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i]!;
    const args = (argsArray[i] ?? []) as unknown[];
    if (fn === op('save')) saved.push(matrix);
    else if (fn === op('restore')) matrix = saved.pop() ?? matrix;
    else if (fn === op('transform')) matrix = multiply(matrix, args as number[]);
    else if (fn === op('paintFormXObjectBegin')) {
      saved.push(matrix);
      if (args[0]) matrix = multiply(matrix, args[0] as ArrayLike<number>);
    } else if (fn === op('paintFormXObjectEnd')) matrix = saved.pop() ?? matrix;
    else if (fn === op('beginGroup')) {
      const mask = Boolean((args[0] as { smask?: unknown } | undefined)?.smask);
      groups.push(mask);
      if (mask) masks += 1;
      saved.push(matrix);
    } else if (fn === op('endGroup')) {
      if (groups.pop()) masks -= 1;
      matrix = saved.pop() ?? matrix;
    } else if (fn === op('beginAnnotation')) {
      notes += 1;
      saved.push(matrix);
    } else if (fn === op('endAnnotation')) {
      notes = Math.max(0, notes - 1);
      matrix = saved.pop() ?? matrix;
    }
    if (masks > 0) continue;

    if (fn === op('setTextRenderingMode')) {
      // Modes 4 to 7 add the letters to the cutting shape.
      if (Number(args[0]) >= 4) entangled = true;
    } else if (texts.has(fn)) {
      kinds[i] = notes > 0 ? OP_OTHER : OP_TEXT;
    } else if (pictures.has(fn)) {
      if (notes > 0 || groups.length > 0) {
        kinds[i] = OP_OTHER;
      } else {
        const inline = args[0] as { width?: unknown; height?: unknown } | undefined;
        const width = fn === op('paintImageXObject') ? args[1] : inline?.width;
        const height = fn === op('paintImageXObject') ? args[2] : inline?.height;
        kinds[i] = OP_PICTURE;
        found.push({
          index: i,
          matrix,
          pixelWidth: typeof width === 'number' && width > 0 ? width : 0,
          pixelHeight: typeof height === 'number' && height > 0 ? height : 0,
        });
      }
    } else if (fn === op('constructPath')) {
      // A path that is only ended sets up a cutting shape, or does nothing.
      if (args[0] !== op('endPath')) {
        kinds[i] = OP_OTHER;
        const before = i > 0 ? fnArray[i - 1] : -1;
        if (before === op('clip') || before === op('eoClip')) entangled = true;
        const limits = args[2] as ArrayLike<number> | null | undefined;
        if (limits && limits.length === 4 && notes === 0 && groups.length === 0) {
          const xs: number[] = [];
          const ys: number[] = [];
          for (const x of [limits[0]!, limits[2]!]) {
            for (const y of [limits[1]!, limits[3]!]) {
              xs.push(matrix[0] * x + matrix[2] * y + matrix[4]);
              ys.push(matrix[1] * x + matrix[3] * y + matrix[5]);
            }
          }
          paths.push({
            index: i,
            bounds: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
            outline: args[0] === op('stroke') || args[0] === op('closeStroke'),
          });
        }
      }
    } else if (others.has(fn)) {
      kinds[i] = OP_OTHER;
    }
  }
  return { kinds, pictures: found, paths, entangled };
}

/** A painted shape, with the upright rectangle around it on the stage. */
export interface PageShape {
  /** The operation that paints it. */
  index: number;
  box: Rect;
  /** Only its outline is painted. */
  outline: boolean;
}

/** Places the painted shapes of a page on the stage. */
export function placeShapes(paths: PagePath[], toStage: Matrix): PageShape[] {
  return paths.map((path) => {
    const [px0, py0, px1, py1] = path.bounds;
    const xs: number[] = [];
    const ys: number[] = [];
    for (const x of [px0, px1]) {
      for (const y of [py0, py1]) {
        xs.push(toStage[0] * x + toStage[2] * y + toStage[4]);
        ys.push(toStage[1] * x + toStage[3] * y + toStage[5]);
      }
    }
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return {
      index: path.index,
      box: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y },
      outline: path.outline,
    };
  });
}

/** True when two rectangles share ground, or lie no more than `slack` apart. */
export function touching(a: Rect, b: Rect, slack = 0): boolean {
  return (
    a.x <= b.x + b.w + slack &&
    a.x + a.w + slack >= b.x &&
    a.y <= b.y + b.h + slack &&
    a.y + a.h + slack >= b.y
  );
}

/**
 * The lines PowerPoint and others draw under the text of a link: thin, flat
 * shapes in the lower half of a link's rectangle. The stage underlines a
 * link itself, so these belong to the text and not to the background.
 * `links` are the rectangles (stage pixels) of the links that lie on text.
 */
export function linkUnderlines(shapes: PageShape[], links: Rect[]): number[] {
  const found: number[] = [];
  for (const { index, box } of shapes) {
    const { x, y, w, h } = box;
    const under = links.some(
      (link) =>
        h <= Math.max(3, 0.12 * link.h) &&
        w >= 3 * Math.max(h, 1) &&
        x >= link.x - 3 &&
        x + w <= link.x + link.w + 3 &&
        y + h / 2 >= link.y + link.h / 2 &&
        y + h / 2 <= link.y + link.h + 3,
    );
    if (under) found.push(index);
  }
  return found;
}

/**
 * The shapes painted on top of a picture: those painted after it that reach
 * more than `inset` into it, and those painted after it that touch one of
 * these, so that a sign comes with its edge and an arrow with its head.
 * A frame around the picture is not on top of it: an outline that goes
 * round it, or a thin shape along its rim. Empty when nothing lies on the
 * picture.
 */
export function shapesOver(
  shapes: PageShape[],
  picture: number,
  box: Rect,
  inset: number,
): number[] {
  const inner = {
    x: box.x + inset,
    y: box.y + inset,
    w: Math.max(0, box.w - 2 * inset),
    h: Math.max(0, box.h - 2 * inset),
  };
  const goesRound = (shape: PageShape): boolean =>
    shape.outline &&
    shape.box.x <= inner.x &&
    shape.box.y <= inner.y &&
    shape.box.x + shape.box.w >= inner.x + inner.w &&
    shape.box.y + shape.box.h >= inner.y + inner.h;
  const later = shapes.filter((shape) => shape.index > picture && !goesRound(shape));
  const found = later.filter((shape) => touching(shape.box, inner));
  if (found.length === 0) return [];
  // A drawing of thousands of strokes is not gone through stroke by stroke.
  if (later.length <= 1500) {
    // A thin shape along the rim of the picture is a side of its frame.
    const rim = (shape: PageShape): boolean =>
      Math.min(shape.box.w, shape.box.h) <= 2 * inset && touching(shape.box, box);
    const rest = new Set(later.filter((shape) => !found.includes(shape) && !rim(shape)));
    for (let i = 0; i < found.length; i++) {
      for (const shape of rest) {
        if (touching(shape.box, found[i]!.box, 2)) {
          found.push(shape);
          rest.delete(shape);
        }
      }
    }
  }
  return found.map((shape) => shape.index).sort((p, q) => p - q);
}

/** Gathers things that touch each other, directly or through others, into groups. */
export function groupTouching<T extends { box: Rect }>(members: T[]): T[][] {
  const groups: T[][] = [];
  const left = new Set(members);
  for (const member of members) {
    if (!left.has(member)) continue;
    left.delete(member);
    const group = [member];
    for (let i = 0; i < group.length; i++) {
      for (const other of left) {
        if (touching(other.box, group[i]!.box, 2)) {
          group.push(other);
          left.delete(other);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

/** The smallest rectangle around some rectangles. */
export function around(boxes: Rect[]): Rect {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
    h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
  };
}

/** Where a picture stands on the stage, before anything is cut from it. */
export interface PictureFrame {
  /** The smallest upright rectangle around it, in stage pixels. */
  box: Rect;
  /** Pixels of the picture per stage pixel, the way it is shown. */
  density: number;
}

/**
 * Places a picture on the stage. `toStage` takes the page's own coordinates
 * to stage pixels (the viewport of pdf.js, moved to where the page stands).
 */
export function pictureFrame(picture: PagePicture, toStage: Matrix): PictureFrame {
  const m = multiply(toStage, picture.matrix);
  const corners = [
    [m[4], m[5]],
    [m[0] + m[4], m[1] + m[5]],
    [m[2] + m[4], m[3] + m[5]],
    [m[0] + m[2] + m[4], m[1] + m[3] + m[5]],
  ] as const;
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const across = Math.hypot(m[0], m[1]);
  const down = Math.hypot(m[2], m[3]);
  const density =
    across > 0 && down > 0 && picture.pixelWidth > 0 && picture.pixelHeight > 0
      ? Math.max(picture.pixelWidth / across, picture.pixelHeight / down)
      : PDF_PIXEL_DENSITY;
  return { box: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }, density };
}

/** The smallest picture worth an element of its own, in stage pixels a side. */
export const PICTURE_MIN_SIDE = 12;
/** More pictures than this on one page are tiles of a pattern, not pictures; they stay in the page. */
export const PICTURE_LIMIT = 40;

/**
 * How many pixels per stage pixel a picture is stored with: what the PDF
 * holds, but never more than the stage can show at double resolution.
 */
export function pictureDensity(frame: PictureFrame): number {
  return Math.min(PDF_PIXEL_DENSITY, Math.max(0.25, frame.density));
}

function overlap(a: Rect, b: Rect): Rect | undefined {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x;
  const h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : undefined;
}

/** The part of a picture's frame that lies on the page, or undefined when it is too small to take out. */
export function pictureRegion(frame: PictureFrame, page: Rect): Rect | undefined {
  const region = overlap(frame.box, page);
  if (!region || region.w < PICTURE_MIN_SIDE || region.h < PICTURE_MIN_SIDE) return undefined;
  return region;
}

// ---------- The text of a page ----------

/** Which of the program's fonts a text is set in. */
export interface TextFace {
  serif: boolean;
  bold: boolean;
  italic: boolean;
}

/**
 * How wide and tall text is in the program's own fonts. The fonts of the
 * PDF are never taken along, so text is set in these, and they are a
 * little wider or narrower than the ones the page was made with.
 */
export interface TextMetrics {
  /** Width of a text for a font size of 1. */
  width(text: string, face: TextFace): number;
  /** How far a line of the font reaches above its baseline, for a font size of 1. */
  ascent(serif: boolean): number;
  /** How far a line of the font reaches below its baseline, for a font size of 1. */
  descent(serif: boolean): number;
}

/** A piece of text as pdf.js hands it out, placed on the stage and looked at. */
export interface PdfPiece {
  str: string;
  /** Where its baseline starts, in stage pixels. */
  x: number;
  y: number;
  /** How far it runs along the baseline, in stage pixels. */
  width: number;
  /** Font size in stage pixels. */
  size: number;
  /** Degrees it is turned, clockwise. 0 for upright text. */
  angle: number;
  /** Pieces with the same key are set in the same font of the PDF. */
  font: string;
  serif: boolean;
  bold: boolean;
  italic: boolean;
  /**
   * Text as the stage sets text: written from left to right along a line,
   * upright on that line, and painted solid.
   */
  plain: boolean;
  hasEOL: boolean;
  /**
   * The colour it is drawn in ("#rrggbb"). Undefined when nothing of it
   * shows on the page: invisible text, or text something else covers.
   */
  color?: string;
  /** The colour of what lies behind it. */
  behind?: string;
  /** Where it leads when it lies under a link. */
  link?: string;
}

/** Text smaller than this (stage pixels) cannot be read; PowerPoint writes the alternative text of pictures this way. */
export const TINY_TEXT = 6;

/** Letters from Unicode's block of mathematical letters: a formula. */
const MATH_LETTERS = /[\u{1D400}-\u{1D7FF}]/u;
const MATH_LETTERS_ALL = new RegExp(MATH_LETTERS.source, 'gu');
/** Those of them that are italic. */
const MATH_ITALIC =
  /[\u{1D434}-\u{1D49B}\u{1D608}-\u{1D66F}\u{1D6E2}-\u{1D755}\u{1D790}-\u{1D7C9}]/u;
/** Characters without a meaning of their own: a font whose letters cannot be read out. */
const UNREADABLE = /[\uFFFD\uE000-\uF8FF\u0000-\u0008\u000E-\u001F]/;
const UNREADABLE_ALL = new RegExp(UNREADABLE.source, 'g');

/**
 * True when so much of the text is characters without meaning that what
 * pdf.js read out cannot be trusted (a font that does not say which
 * letters its shapes are).
 */
export function isGarbled(pieces: PdfPiece[]): boolean {
  let all = 0;
  let bad = 0;
  for (const piece of pieces) {
    if (piece.size < TINY_TEXT) continue;
    const text = piece.str.replace(/\s/g, '');
    all += text.length;
    bad += text.match(UNREADABLE_ALL)?.length ?? 0;
  }
  // A few such characters are bullets and symbols; many are a font that cannot be read.
  return all >= 8 && bad / all > 0.2;
}

/** A stretch of text of the PDF, as it is measured to learn how wide the PDF's fonts are. */
export interface FitSample {
  /** Samples with the same key are set in the same font of the PDF. */
  font: string;
  serif: boolean;
  text: string;
  /** How wide it is in the PDF, for a font size of 1. */
  width: number;
}

/**
 * How much smaller text must be set in the program's fonts to be no wider
 * than it was in the PDF's. Learned from the text of the whole file, for
 * each font of the PDF, so that the same font gets the same size on every
 * page.
 */
export class FontFit {
  private readonly samples = new Map<string, FitSample[]>();
  private readonly factors = new Map<string, number>();

  constructor(private readonly metrics: TextMetrics) {}

  learn(sample: FitSample): void {
    if (sample.text.trim().length < 4 || !(sample.width > 0)) return;
    const list = this.samples.get(sample.font) ?? [];
    list.push(sample);
    this.samples.set(sample.font, list);
    this.factors.clear();
  }

  /**
   * The factor on the font size for text in a font of the PDF that the
   * program sets in `face`: between 0.7 and 1.
   */
  factor(font: string, face: TextFace): number {
    const drawn = drawnFace(face);
    const key = `${font}\n${faceKey(drawn)}`;
    const known = this.factors.get(key);
    if (known !== undefined) return known;
    const chars = (list: FitSample[]): number =>
      list.reduce((sum, sample) => sum + sample.text.trim().length, 0);
    let samples = this.samples.get(font) ?? [];
    if (chars(samples) < 24) {
      // Too little text to judge by: use all text of the same kind of font.
      samples = [...this.samples.values()].flat().filter((s) => s.serif === drawn.serif);
    }
    const ratios: Array<[ratio: number, weight: number]> = [];
    for (const sample of samples) {
      const own = this.metrics.width(sample.text, drawn);
      if (own > 0) ratios.push([sample.width / own, sample.text.trim().length]);
    }
    const total = ratios.reduce((sum, r) => sum + r[1], 0);
    // The ratio that 85 % of the text is at or above: most lines then fit.
    ratios.sort((p, q) => p[0] - q[0]);
    let seen = 0;
    let ratio = 1;
    for (const [value, weight] of ratios) {
      seen += weight;
      ratio = value;
      if (seen >= total * 0.15) break;
    }
    const factor = ratio >= 0.985 ? 1 : Math.max(0.7, Math.round(ratio * 1000) / 1000);
    this.factors.set(key, factor);
    return factor;
  }
}

function faceKey(face: TextFace): string {
  const drawn = drawnFace(face);
  return `${drawn.serif ? 's' : 'n'}${drawn.bold ? 'b' : ''}${drawn.italic ? 'i' : ''}`;
}

/** The face text is drawn in: the program has no bold serif font. */
function drawnFace(face: TextFace): TextFace {
  return { serif: face.serif, bold: face.bold && !face.serif, italic: face.italic };
}

/** A link on a page: where it lies (stage pixels) and where it leads. */
export interface PdfLink {
  rect: Rect;
  /** An address (http, https, mailto), or "#page:N" for another page of the PDF. */
  target?: string;
}

/**
 * Lays the links of a page on the pieces of text they cover. A piece that
 * only partly lies under a link is split, so that only the words under the
 * link become the link. Returns the pieces, and the links that had no text
 * under them.
 */
export function linkPieces(
  pieces: PdfPiece[],
  links: PdfLink[],
  metrics: TextMetrics,
): { pieces: PdfPiece[]; loose: PdfLink[] } {
  let current = pieces;
  const loose: PdfLink[] = [];
  for (const link of links) {
    let hit = false;
    const next: PdfPiece[] = [];
    for (const piece of current) {
      const middle = piece.y - piece.size * 0.3;
      const under =
        piece.angle === 0 &&
        piece.plain &&
        piece.size >= TINY_TEXT &&
        piece.str.trim() !== '' &&
        middle >= link.rect.y - 1 &&
        middle <= link.rect.y + link.rect.h + 1;
      const range = under ? charsUnder(piece, link.rect, metrics) : undefined;
      if (!range) {
        next.push(piece);
        continue;
      }
      hit = true;
      if (!link.target) {
        next.push(piece);
        continue;
      }
      const [from, to, edges] = range;
      const part = (a: number, b: number, linked: boolean): void => {
        if (b <= a) return;
        const made: PdfPiece = {
          ...piece,
          str: piece.str.slice(a, b),
          x: piece.x + edges[a]!,
          width: edges[b]! - edges[a]!,
          hasEOL: b === piece.str.length && piece.hasEOL,
        };
        if (linked) made.link = link.target;
        next.push(made);
      };
      part(0, from, false);
      part(from, to, true);
      part(to, piece.str.length, false);
    }
    current = next;
    if (!hit) loose.push(link);
  }
  return { pieces: current, loose };
}

/**
 * The characters of a piece that lie under a rectangle: [from, to, where
 * each character starts]. Undefined when none do. Spaces at the ends are
 * left out.
 */
function charsUnder(
  piece: PdfPiece,
  rect: Rect,
  metrics: TextMetrics,
): [number, number, number[]] | undefined {
  const face = drawnFace(piece);
  const edges = [0];
  for (let i = 1; i <= piece.str.length; i++) {
    edges.push(metrics.width(piece.str.slice(0, i), face));
  }
  // The program's font is not the PDF's: stretch its widths to the width the piece has.
  const full = edges[edges.length - 1]!;
  const stretch = full > 0 ? piece.width / full : 0;
  for (let i = 0; i < edges.length; i++) {
    edges[i] = full > 0 ? edges[i]! * stretch : (piece.width * i) / piece.str.length;
  }
  let from = -1;
  let to = -1;
  for (let i = 0; i < piece.str.length; i++) {
    const centre = piece.x + (edges[i]! + edges[i + 1]!) / 2;
    if (centre >= rect.x - 0.5 && centre <= rect.x + rect.w + 0.5) {
      if (from < 0) from = i;
      to = i + 1;
    }
  }
  if (from < 0) return undefined;
  while (from < to && /\s/.test(piece.str[from]!)) from += 1;
  while (to > from && /\s/.test(piece.str[to - 1]!)) to -= 1;
  return to > from ? [from, to, edges] : undefined;
}

/** A stretch of a line with one look. */
interface Part {
  text: string;
  x: number;
  /** Its own baseline. */
  y: number;
  width: number;
  size: number;
  bold: boolean;
  italic: boolean;
  serif: boolean;
  font: string;
  link?: string;
  script?: 'sub' | 'super';
  /** There is a space between this and the part before it. */
  spaced: boolean;
  color: string;
  behind: string;
}

/** A line of text: pieces that share a baseline and follow each other. */
interface Line {
  parts: Part[];
  /** Where the line starts: at its bullet when it has one. */
  x: number;
  /** Where its text starts. */
  textX: number;
  right: number;
  baseline: number;
  size: number;
  bullet: boolean;
  serif: boolean;
  font: string;
  color: string;
  behind: string;
  /** A formula standing by itself: laid out in ways a line of text cannot be. */
  formula: boolean;
  /** Holds characters that cannot be read out. */
  unreadable: boolean;
  text: string;
}

/** Bullets as fonts with symbols and PowerPoint's own lists write them. */
const BULLET =
  /^[\u2022\u25E6\u25AA\u25AB\u25A0\u25A1\u25CF\u25CB\u2023\u2219\u00B7\u2043\u27A2\u27A4\u25BA\u25B6\u2756\u2713\u2714\uF000-\uF0FF]$/;
/** Characters that are bullets only when they stand apart from the text, as a list writes them. */
const LOOSE_BULLET = /^[-\u2013\u2014o*>]$/;

function heaviest<T>(weights: Map<T, number>): T | undefined {
  let best: T | undefined;
  let bestWeight = -1;
  for (const [value, weight] of weights) {
    if (weight > bestWeight) {
      best = value;
      bestWeight = weight;
    }
  }
  return best;
}

function closeLine(parts: Part[], formulaFonts: Set<string>): Line | undefined {
  while (parts.length > 0 && parts[parts.length - 1]!.text.trim() === '') parts.pop();
  if (parts.length === 0) return undefined;
  const first = parts[0]!;
  let bullet = false;
  const x = first.x;
  const second = parts[1];
  if (second && !first.script) {
    const glyph = first.text.trim();
    const gap = second.x - (first.x + first.width);
    const apart =
      gap >= 0.38 * first.size && (first.font !== second.font || gap >= 0.5 * first.size);
    if (BULLET.test(glyph) || (LOOSE_BULLET.test(glyph) && apart)) {
      bullet = true;
      parts.shift();
      second.spaced = false;
    }
  }
  // A formula standing by itself is all in the font of formulas. Letters
  // of that font in running text (the O of O2, say) are ordinary letters
  // in italics; the program's fonts do not have the mathematical ones.
  const formula = parts.every((part) => formulaFonts.has(part.font));
  for (const part of parts) {
    if (!MATH_LETTERS.test(part.text)) continue;
    if (MATH_ITALIC.test(part.text)) part.italic = true;
    part.text = part.text.replace(MATH_LETTERS_ALL, (letter) => letter.normalize('NFKC'));
  }
  const head = parts[0]!;
  head.text = head.text.trimStart();
  head.spaced = false;
  const baseline = head.y;
  const last = parts[parts.length - 1]!;
  last.text = last.text.trimEnd();
  const sizes = new Map<number, number>();
  const fonts = new Map<string, number>();
  const colors = new Map<string, number>();
  const behinds = new Map<string, number>();
  let serif = 0;
  let chars = 0;
  for (const part of parts) {
    const n = part.text.length;
    chars += n;
    if (!part.script) sizes.set(part.size, (sizes.get(part.size) ?? 0) + n);
    fonts.set(part.font, (fonts.get(part.font) ?? 0) + n);
    colors.set(part.color, (colors.get(part.color) ?? 0) + n);
    behinds.set(part.behind, (behinds.get(part.behind) ?? 0) + n);
    if (part.serif) serif += n;
  }
  const text = parts.map((part) => (part.spaced ? ' ' : '') + part.text).join('');
  return {
    parts,
    x,
    textX: head.x,
    right: Math.max(...parts.map((part) => part.x + part.width)),
    baseline,
    size: heaviest(sizes) ?? first.size,
    bullet,
    serif: serif * 2 > chars,
    font: heaviest(fonts) ?? first.font,
    color: heaviest(colors) ?? first.color,
    behind: heaviest(behinds) ?? first.behind,
    formula,
    unreadable: UNREADABLE.test(text),
    text,
  };
}

/**
 * Joins pieces into lines: pieces on one baseline that follow each other
 * closely. A piece standing far to the right of the one before it (a new
 * column, the next cell of a table) starts a line of its own, so that
 * everything keeps its place. Small pieces a little above or below the
 * baseline are superscripts and subscripts.
 */
function buildLines(pieces: PdfPiece[]): Line[] {
  const formulaFonts = new Set(pieces.filter((p) => MATH_LETTERS.test(p.str)).map((p) => p.font));
  const lines: Line[] = [];
  let parts: Part[] = [];
  let right = 0;
  let gapSeen = false;
  const close = (): void => {
    const line = closeLine(parts, formulaFonts);
    if (line) lines.push(line);
    parts = [];
    gapSeen = false;
  };
  for (const piece of pieces) {
    if (piece.str === '') continue;
    const blank = piece.str.trim() === '';
    const first = parts[0];
    let script: Part['script'];
    let follows = false;
    if (first) {
      const dy = piece.y - first.y;
      const level = Math.abs(dy) <= 0.1 * Math.max(first.size, piece.size);
      const gap = piece.x - right;
      // A superscript or subscript stands right at what it belongs to. Small
      // text after a space is something else: the top of a fraction, say.
      const small =
        !level &&
        piece.size <= 0.85 * first.size &&
        Math.abs(dy) <= 0.7 * first.size &&
        !gapSeen &&
        gap <= 0.18 * first.size;
      if (small) script = dy < 0 ? 'super' : 'sub';
      const onlyBullet =
        parts.length === 1 &&
        (BULLET.test(first.text.trim()) || LOOSE_BULLET.test(first.text.trim()));
      const reach = (onlyBullet ? 6 : 1) * first.size;
      follows = (level || small) && gap >= -0.3 * first.size && gap <= reach;
    }
    if (blank) {
      if (follows) gapSeen = true;
      continue;
    }
    if (!follows) {
      close();
      script = undefined;
    }
    const before = parts[parts.length - 1];
    const gap = before ? piece.x - right : 0;
    const spaced =
      before !== undefined &&
      !/\s$/.test(before.text) &&
      !/^\s/.test(piece.str) &&
      (gapSeen || gap > 0.18 * piece.size);
    parts.push({
      text: piece.str,
      x: piece.x,
      y: piece.y,
      width: piece.width,
      size: piece.size,
      bold: piece.bold,
      italic: piece.italic,
      serif: piece.serif,
      font: piece.font,
      ...(piece.link ? { link: piece.link } : {}),
      ...(script ? { script } : {}),
      spaced,
      color: piece.color ?? '#000000',
      behind: piece.behind ?? '#ffffff',
    });
    right = Math.max(before ? right : -Infinity, piece.x + piece.width);
    gapSeen = false;
  }
  close();
  return lines;
}

type Align = 'left' | 'center' | 'right';

function near(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

/** How far apart two edges may be and still count as lined up. */
function edgeTolerance(size: number): number {
  return Math.max(1.5, 0.06 * size);
}

function rgbOf(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colorDistance(a: string, b: string): number {
  const p = rgbOf(a);
  const q = rgbOf(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/**
 * Gathers lines into runs that may be one text box: lines that follow each
 * other downwards in the PDF's own order, in the same colour and kind of
 * font, lined up at the left, at the middle or at the right.
 */
function gatherLines(lines: Line[]): Array<{ lines: Line[]; align: Align }> {
  const groups: Array<{ lines: Line[]; align: Align; settled: boolean }> = [];
  for (const line of lines) {
    const group = groups[groups.length - 1];
    const previous = group?.lines[group.lines.length - 1];
    let joins = false;
    if (group && previous) {
      const step = line.baseline - previous.baseline;
      const tall = Math.max(previous.size, line.size);
      const tolerance = edgeTolerance(line.size);
      const alike =
        line.serif === previous.serif &&
        line.formula === previous.formula &&
        line.unreadable === previous.unreadable &&
        colorDistance(line.color, previous.color) <= 40 &&
        colorDistance(line.behind, previous.behind) <= 60 &&
        (near(line.size, previous.size, 0.03 * previous.size) ||
          // A list goes on in another size at another level; a heading and
          // the list under it differ more, and are two boxes.
          (line.bullet && line.size >= 0.72 * previous.size && line.size <= 1.39 * previous.size));
      const below = step > 0.5 * Math.min(previous.size, line.size) && step <= 2.8 * tall;
      if (alike && below) {
        const starts = group.lines.flatMap((l) => [l.x, l.textX]);
        const left =
          (line.bullet && line.x >= Math.min(...starts) - tolerance) ||
          starts.some((x) => near(line.textX, x, tolerance));
        const plain = !line.bullet && group.lines.every((l) => !l.bullet);
        const centre =
          plain &&
          group.lines.every((l) => near((l.x + l.right) / 2, (line.x + line.right) / 2, tolerance));
        const flush = plain && group.lines.every((l) => near(l.right, line.right, tolerance));
        if (!group.settled) {
          const align: Align | undefined = left
            ? 'left'
            : centre
              ? 'center'
              : flush
                ? 'right'
                : undefined;
          if (align) {
            group.align = align;
            group.settled = true;
            joins = true;
          }
        } else {
          joins = group.align === 'left' ? left : group.align === 'center' ? centre : flush;
        }
      }
    }
    if (joins) group!.lines.push(line);
    else groups.push({ lines: [line], align: 'left', settled: false });
  }
  return groups;
}

interface ParagraphLines {
  lines: Line[];
  bullet: boolean;
  start: number;
  textX: number;
  size: number;
  level: number;
}

/** A text element as it is made from a block of lines, with what is needed to judge it. */
export interface TextDraft {
  element: Omit<TextElement, 'id'>;
  /** The colour the text has in the PDF, and the colour of what lies behind it. */
  color: string;
  behind: string;
  /** All of the text is bold. */
  bold: boolean;
  chars: number;
  /** Where the text stands in the PDF, in stage pixels. */
  area: Rect;
  text: string;
  /** Why it cannot be set as text by the program, when it cannot. */
  held?: 'formula' | 'unreadable';
}

const LEVELS = 5;
/** The line height text gets when the PDF does not show one: PowerPoint's single line. */
const PLAIN_LINE = 1.2;

const round = (value: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

/**
 * Makes one text element of a block of lines, or says where the block must
 * be divided because its lines do not stand the way one element would set
 * them. The element sets every line where it stood: the box starts where
 * the text started, the line height is the distance the lines had, and
 * paragraphs keep their space and indents.
 */
function fitBlock(
  lines: Line[],
  align: Align,
  metrics: TextMetrics,
  fit: FontFit,
): TextDraft | { divideAt: number } {
  const first = lines[0]!;
  const serif = first.serif;
  const ascent = metrics.ascent(serif);
  const descent = metrics.descent(serif);

  // The distance between lines that follow each other inside a paragraph.
  let pitch: number | undefined;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    const previous = lines[i - 1]!;
    if (line.bullet || !near(line.size, previous.size, 0.03 * previous.size)) continue;
    if (align === 'left' && !near(line.x, previous.textX, edgeTolerance(line.size))) continue;
    const ratio = (line.baseline - previous.baseline) / line.size;
    if (ratio >= 0.7 && ratio <= 1.9) pitch = Math.min(pitch ?? ratio, ratio);
  }

  const paragraphs: ParagraphLines[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const current = paragraphs[paragraphs.length - 1];
    const previous = lines[i - 1];
    let fresh = !current || !previous || line.bullet;
    if (!fresh && current && previous) {
      const ratio = (line.baseline - previous.baseline) / line.size;
      fresh =
        pitch === undefined ||
        ratio > pitch + 0.035 ||
        !near(line.size, current.size, 0.03 * current.size) ||
        (align === 'left' && !near(line.x, current.textX, edgeTolerance(line.size)));
    }
    if (fresh) {
      paragraphs.push({
        lines: [line],
        bullet: line.bullet,
        start: line.x,
        textX: line.textX,
        size: line.size,
        level: 0,
      });
    } else {
      current!.lines.push(line);
    }
  }
  const firstLineOf = (paragraph: ParagraphLines): number => lines.indexOf(paragraph.lines[0]!);

  // Levels: each way of indenting and each size is a level of its own.
  const kinds: ParagraphLines[] = [];
  for (const paragraph of paragraphs) {
    const tolerance = edgeTolerance(paragraph.size);
    const same = kinds.find(
      (k) =>
        k.bullet === paragraph.bullet &&
        near(k.size, paragraph.size, 0.03 * k.size) &&
        (align !== 'left' ||
          (near(k.start, paragraph.start, tolerance) && near(k.textX, paragraph.textX, tolerance))),
    );
    if (!same) {
      if (kinds.length === LEVELS) return { divideAt: firstLineOf(paragraph) };
      kinds.push(paragraph);
    }
  }
  const ordered = [...kinds].sort((a, b) => a.start - b.start || a.textX - b.textX);
  for (const paragraph of paragraphs) {
    const tolerance = edgeTolerance(paragraph.size);
    paragraph.level = ordered.findIndex(
      (k) =>
        k.bullet === paragraph.bullet &&
        near(k.size, paragraph.size, 0.03 * k.size) &&
        (align !== 'left' ||
          (near(k.start, paragraph.start, tolerance) && near(k.textX, paragraph.textX, tolerance))),
    );
  }

  // The element's own size is that of the level with the most text.
  const weights = new Map<number, number>();
  for (const paragraph of paragraphs) {
    const chars = paragraph.lines.reduce((sum, line) => sum + line.text.length, 0);
    weights.set(paragraph.level, (weights.get(paragraph.level) ?? 0) + chars);
  }
  const mainLevel = heaviest(weights) ?? 0;
  const fonts = new Map<string, number>();
  for (const line of lines) fonts.set(line.font, (fonts.get(line.font) ?? 0) + line.text.length);
  let bold = 0;
  let italic = 0;
  let all = 0;
  for (const line of lines) {
    for (const part of line.parts) {
      all += part.text.length;
      if (part.bold) bold += part.text.length;
      if (part.italic) italic += part.text.length;
    }
  }
  const narrow = fit.factor(heaviest(fonts) ?? first.font, {
    serif,
    bold: bold * 2 > all,
    italic: italic * 2 > all,
  });
  const pdfSize = ordered[mainLevel]!.size;
  const fontSize = Math.max(1, round(pdfSize * narrow, 1));
  const factor = fontSize / pdfSize;
  const scales = ordered.map((k) => round(k.size / pdfSize, 3));
  const sizeOf = (paragraph: ParagraphLines): number => fontSize * scales[paragraph.level]!;

  /** From the baseline of a last line to that of the next paragraph's first, with no space between. */
  const advance = (lineHeight: number, above: number, below: number): number =>
    (lineHeight * (above + below)) / 2 + ((ascent - descent) / 2) * (below - above);

  // The line height: the distance the lines have, but never more than the
  // paragraphs' own distances allow.
  let lineHeight = (pitch ?? PLAIN_LINE) / factor;
  for (let j = 1; j < paragraphs.length; j++) {
    const above = paragraphs[j - 1]!;
    const below = paragraphs[j]!;
    const step = below.lines[0]!.baseline - above.lines[above.lines.length - 1]!.baseline;
    const a = sizeOf(above);
    const b = sizeOf(below);
    const most = (step - ((ascent - descent) / 2) * (b - a)) / ((a + b) / 2);
    if (most < lineHeight - 0.01) {
      if (pitch !== undefined || most < 0.7) return { divideAt: firstLineOf(below) };
      lineHeight = most;
    }
  }
  lineHeight = round(lineHeight, 4);

  // The space above the paragraphs of each level.
  const spaces: Array<number | undefined> = Array.from({ length: LEVELS }, () => undefined);
  for (let j = 1; j < paragraphs.length; j++) {
    const above = paragraphs[j - 1]!;
    const below = paragraphs[j]!;
    const step = below.lines[0]!.baseline - above.lines[above.lines.length - 1]!.baseline;
    const tolerance = Math.max(1.5, 0.05 * sizeOf(below));
    const space = step - advance(lineHeight, sizeOf(above), sizeOf(below));
    if (space < -tolerance) return { divideAt: firstLineOf(below) };
    const known = spaces[below.level];
    if (known === undefined) spaces[below.level] = Math.max(0, space);
    else if (!near(known, space, tolerance)) return { divideAt: firstLineOf(below) };
  }

  // Where the box stands, and how wide the lines are in the program's fonts.
  const left = Math.min(...paragraphs.map((p) => p.start));
  const rightEdge = Math.max(...lines.map((l) => l.right));
  const widthOf = (line: Line, size: number): number =>
    line.parts.reduce(
      (sum, part) =>
        sum +
        metrics.width((part.spaced ? ' ' : '') + part.text, drawnFace(part)) *
          size *
          (part.script ? SCRIPT_SCALE : 1),
      0,
    );
  /** Where the text of a paragraph's lines starts, counted from the left edge of the box. */
  const textStart = (paragraph: ParagraphLines): number => {
    if (align !== 'left') return 0;
    const start = paragraph.start - left;
    // The stage gives a bullet at least half a letter of room.
    return paragraph.bullet
      ? start + Math.max(0.5 * fontSize, paragraph.textX - paragraph.start)
      : start;
  };
  const reach = new Map<Line, number>();
  for (const paragraph of paragraphs) {
    for (const line of paragraph.lines) {
      reach.set(line, textStart(paragraph) + widthOf(line, sizeOf(paragraph)));
    }
  }
  // The box is as wide as its widest line and a little more, so that no
  // line breaks that did not break in the PDF.
  const widest = Math.max(...reach.values());
  const width = widest + Math.max(3, 0.004 * widest);

  // The paragraphs. A line that ended where the next word had no room is
  // joined to the next with a space, and breaks at the same place by
  // itself; any other line end is kept as a line break.
  const made: Paragraph[] = [];
  for (const paragraph of paragraphs) {
    const runs: Run[] = [];
    const push = (run: Run): void => {
      const last = runs[runs.length - 1];
      const same =
        last &&
        last.bold === run.bold &&
        last.italic === run.italic &&
        last.link === run.link &&
        last.script === run.script;
      if (same) last.text += run.text;
      else runs.push(run);
    };
    paragraph.lines.forEach((line, index) => {
      let joiner = '';
      const previous = paragraph.lines[index - 1];
      if (previous) {
        const head = line.parts[0]!;
        // The first stretch of the next line that a line cannot be broken in.
        const word = /^[^\s\-\u2010-\u2014/]*[-\u2010-\u2014/]?/.exec(head.text)?.[0] ?? '';
        const size = sizeOf(paragraph);
        const next =
          metrics.width(` ${word}`, drawnFace(head)) * size * (head.script ? SCRIPT_SCALE : 1);
        // A line that ends a sentence or leads in to what follows more likely ends
        // a paragraph than breaks by chance; after a hyphen nothing may be added.
        const breaksItself =
          reach.get(previous)! + next > width + 2 && !/[-\u2010-\u2014/.:;!?]$/.test(previous.text);
        joiner = breaksItself ? ' ' : '\n';
      }
      line.parts.forEach((part, i) => {
        const lead = i === 0 ? joiner : part.spaced ? ' ' : '';
        const format: Omit<Run, 'text'> = {
          ...(part.bold ? { bold: true } : {}),
          ...(part.italic ? { italic: true } : {}),
          ...(part.link ? { link: part.link } : {}),
          ...(part.script ? { script: part.script } : {}),
        };
        // The space or break between two parts is not part of a link or a subscript.
        if (lead && (part.link || part.script) && runs.length > 0) {
          const last = runs[runs.length - 1]!;
          if (last.link || last.script) push({ text: lead });
          else last.text += lead;
          push({ text: part.text, ...format });
        } else {
          push({ text: lead + part.text, ...format });
        }
      });
    });
    made.push({ level: paragraph.level, list: paragraph.bullet ? 'bullet' : 'none', runs });
  }
  const textRuns = made.flatMap((p) => p.runs).filter((run) => run.text.trim() !== '');
  const allBold = textRuns.length > 0 && textRuns.every((run) => run.bold);
  // Sans-serif text that is bold throughout is a heading; the role carries the weight.
  const role: TextElement['role'] = serif ? 'title' : allBold ? 'heading' : 'body';
  if (role === 'heading') {
    for (const p of made) for (const run of p.runs) delete run.bold;
  }

  const firstSize = sizeOf(paragraphs[0]!);
  const lastParagraph = paragraphs[paragraphs.length - 1]!;
  const lastSize = sizeOf(lastParagraph);
  const top = first.baseline - (firstSize * (lineHeight + ascent - descent)) / 2;
  const bottom =
    lines[lines.length - 1]!.baseline + (lastSize * (lineHeight - ascent + descent)) / 2;
  const x =
    align === 'left'
      ? left
      : align === 'center'
        ? lines.reduce((sum, l) => sum + (l.x + l.right) / 2, 0) / lines.length - width / 2
        : rightEdge - width;

  const usesLevels = paragraphs.some((p) => p.level > 0);
  const lists = paragraphs.some((p) => p.bullet);
  const fill = <T>(values: T[], rest: T): T[] =>
    Array.from({ length: LEVELS }, (_, i) => values[i] ?? rest);
  const element: Omit<TextElement, 'id'> = {
    type: 'text',
    role,
    content: { paragraphs: made },
    fontSize,
    lineHeight,
    spaceBefore: spaces.map((space) => round((space ?? 0) / fontSize, 3)),
    align,
    valign: 'top',
    box: {
      x: round(x, 2),
      y: round(top, 2),
      w: round(width, 2),
      h: round(Math.max(1, bottom - top), 2),
      rotation: 0,
    },
  };
  if (usesLevels) element.levelScale = fill(scales, scales[scales.length - 1] ?? 1);
  if (align === 'left' && (usesLevels || lists || ordered.some((k) => k.start !== k.textX))) {
    const indents = ordered.map((k) => ({
      start: round(Math.max(0, k.start - left) / fontSize, 3),
      text: round(Math.max(0, k.textX - left) / fontSize, 3),
    }));
    element.indent = fill(indents, indents[indents.length - 1] ?? { start: 0, text: 0 });
  }

  const text = lines.map((line) => line.text).join('\n');
  const colors = new Map<string, number>();
  const behinds = new Map<string, number>();
  for (const line of lines) {
    colors.set(line.color, (colors.get(line.color) ?? 0) + line.text.length);
    behinds.set(line.behind, (behinds.get(line.behind) ?? 0) + line.text.length);
  }
  const draft: TextDraft = {
    element,
    color: heaviest(colors) ?? first.color,
    behind: heaviest(behinds) ?? first.behind,
    bold: allBold,
    chars: text.replace(/\s/g, '').length,
    area: {
      x: Math.min(...lines.map((l) => l.x)),
      y: first.baseline - first.size,
      w: rightEdge - Math.min(...lines.map((l) => l.x)),
      h: lines[lines.length - 1]!.baseline - first.baseline + first.size * 1.3,
    },
    text,
  };
  if (lines.some((l) => l.formula)) draft.held = 'formula';
  else if (lines.some((l) => l.unreadable)) draft.held = 'unreadable';
  return draft;
}

/** The size the stage draws subscripts and superscripts in (see STAGE_CSS). */
const SCRIPT_SCALE = 0.65;

function fitLines(lines: Line[], align: Align, metrics: TextMetrics, fit: FontFit): TextDraft[] {
  const result = fitBlock(lines, lines.length > 1 ? align : 'left', metrics, fit);
  if (!('divideAt' in result)) return [result];
  const at = Math.min(lines.length - 1, Math.max(1, result.divideAt));
  return [
    ...fitLines(lines.slice(0, at), align, metrics, fit),
    ...fitLines(lines.slice(at), align, metrics, fit),
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** How clearly one colour stands out on another: 1 (not at all) to 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The colour of the palette a text colour of the PDF becomes. Text can
 * only have the palette's colours. Greys become black or white; a colour
 * far from all of the palette's becomes black or white too, whichever is
 * closer, and `exact` is then false.
 */
export function paletteTextColor(hex: string): { color: PaletteColor; exact: boolean } {
  const [r, g, b] = rgbOf(hex);
  const grey = Math.max(r, g, b) - Math.min(r, g, b) < 36;
  const plain: PaletteColor = luminance(hex) > 0.4 ? 'hvit' : 'sort';
  if (grey) return { color: plain, exact: true };
  let best: PaletteColor = plain;
  let distance = Infinity;
  for (const name of Object.keys(PALETTE) as PaletteColor[]) {
    const d = colorDistance(hex, PALETTE[name]);
    if (d < distance) {
      distance = d;
      best = name;
    }
  }
  return distance <= 125 ? { color: best, exact: true } : { color: plain, exact: false };
}

/** What the text of a page becomes. */
export interface TextPlan {
  /** The surface the scene gets. It decides which text colours can be used. */
  surface: Surface;
  /** The text elements, in the PDF's own order. */
  texts: Array<Omit<TextElement, 'id'>>;
  /**
   * Text that shows on the page but cannot be set as text: where it stands,
   * what it says, and why. It is drawn into the background, or (`apart`)
   * into a picture of its own that lies on top of a picture.
   */
  kept: Array<{
    area: Rect;
    text: string;
    why: 'formula' | 'unreadable' | 'color' | 'not-plain';
    apart?: boolean;
  }>;
  /** Text that got another colour than it had, because the palette does not have its colour. */
  recoloured: boolean;
  /** The lines of the text that shows, in the PDF's own order. */
  lines: string[];
  /** Unreadably small text on the page (PowerPoint's alternative texts), with where it stands. */
  tiny: Array<{ x: number; y: number; text: string }>;
}

/**
 * Turns the pieces of text of a page into text elements. `pageColor` is
 * the colour most of the page has.
 *
 * Text can have the palette's colours only, and only those the contrast
 * table allows on the scene's surface. The page keeps its look, so the
 * surface is chosen to allow the colours the text has: a page where most
 * of the text is white gets a dark surface, which the picture of the page
 * covers anyway (`fillsStage`: the page covers the whole stage).
 * Text that would not stand out against what lies behind it in the colour
 * it can get, and text on a coloured field that cannot keep its colour,
 * stays in the picture instead, where it looks as it did.
 */
export function planText(
  pieces: PdfPiece[],
  metrics: TextMetrics,
  fit: FontFit,
  pageColor = '#ffffff',
  fillsStage = true,
): TextPlan {
  // The spaces between words show nothing themselves, but say where words part.
  const shown = pieces.filter((p) => p.str !== '' && (p.color !== undefined || !p.str.trim()));
  const tiny: TextPlan['tiny'] = [];
  for (const piece of pieces) {
    if (piece.size < TINY_TEXT && piece.str.trim() !== '') {
      tiny.push({ x: piece.x, y: piece.y, text: piece.str.trim() });
    }
  }
  const readable = shown.filter((p) => p.size >= TINY_TEXT);
  const kept: TextPlan['kept'] = [];
  const lines: string[] = [];
  const drafts: TextDraft[] = [];
  // Text that is turned is read in a frame turned with it, where its lines
  // lie flat, and the boxes made there are turned back. Pieces that follow
  // each other at the same angle are read together.
  const stretches: Array<{ angle: number; pieces: PdfPiece[] }> = [];
  for (const piece of readable) {
    if (!piece.plain) {
      if (piece.str.trim() !== '') {
        kept.push({ area: turnedArea(piece), text: piece.str.trim(), why: 'not-plain' });
      }
      continue;
    }
    const current = stretches[stretches.length - 1];
    if (current && (current.angle === piece.angle || piece.str.trim() === '')) {
      current.pieces.push(piece);
    } else {
      stretches.push({ angle: piece.angle, pieces: [piece] });
    }
  }
  for (const stretch of stretches) {
    const radians = (stretch.angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const flat =
      stretch.angle === 0
        ? stretch.pieces
        : stretch.pieces.map((p) => ({
            ...p,
            x: p.x * cos + p.y * sin,
            y: -p.x * sin + p.y * cos,
            angle: 0,
          }));
    const built = buildLines(flat);
    lines.push(...built.map((line) => line.text.replace(/\s+/g, ' ').trim()).filter(Boolean));
    for (const group of gatherLines(built)) {
      for (const draft of fitLines(group.lines, group.align, metrics, fit)) {
        if (stretch.angle !== 0) {
          // The box keeps its size and is turned about its middle.
          const { box } = draft.element;
          const cx = box.x + box.w / 2;
          const cy = box.y + box.h / 2;
          draft.element.box = {
            ...box,
            x: round(cx * cos - cy * sin - box.w / 2, 2),
            y: round(cx * sin + cy * cos - box.h / 2, 2),
            rotation: stretch.angle,
          };
          const { area } = draft;
          const corners = [
            [area.x, area.y],
            [area.x + area.w, area.y],
            [area.x, area.y + area.h],
            [area.x + area.w, area.y + area.h],
          ].map(([x, y]) => [x! * cos - y! * sin, x! * sin + y! * cos] as const);
          const xs = corners.map((c) => c[0]);
          const ys = corners.map((c) => c[1]);
          draft.area = {
            x: Math.min(...xs),
            y: Math.min(...ys),
            w: Math.max(...xs) - Math.min(...xs),
            h: Math.max(...ys) - Math.min(...ys),
          };
        }
        drafts.push(draft);
      }
    }
  }
  const free = drafts.filter((d) => !d.held);

  // The surface that lets most of the text keep its colour.
  const size = (d: TextDraft): number => d.element.fontSize ?? THEME_REN.roles.body.size;
  const colorOn = (d: TextDraft, surface: Surface): { color: PaletteColor; kept: boolean } => {
    const wanted = paletteTextColor(d.color);
    const large = isLargeText(size(d), d.bold);
    if (isAllowedTextColor(wanted.color, surface, large)) {
      return { color: wanted.color, kept: wanted.exact };
    }
    return { color: defaultTextColor(THEME_REN, surface, d.element.role, size(d)), kept: false };
  };
  const shows = (d: TextDraft, color: PaletteColor): boolean =>
    contrast(PALETTE[color], d.behind) >= Math.min(3, 0.9 * contrast(d.color, d.behind));
  // A surface unlike the page is chosen only when it lets much more of the
  // text keep its colour, and only when the picture of the page covers it.
  const like = (candidate: Surface): boolean => colorDistance(PALETTE[candidate], pageColor) <= 80;
  const allChars = free.reduce((sum, d) => sum + d.chars, 0);
  let surface: Surface = 'hvit';
  let best = -Infinity;
  for (const candidate of SURFACES) {
    if (!fillsStage && !like(candidate) && candidate !== 'hvit') continue;
    let score = like(candidate) ? 0 : -0.3 * allChars;
    for (const d of free) {
      const got = colorOn(d, candidate);
      if (shows(d, got.color)) score += d.chars * (got.kept ? 1 : 0.5);
    }
    // Between surfaces that serve the text equally, the one most like the page.
    score -= colorDistance(PALETTE[candidate], pageColor) / 1000;
    if (score > best) {
      best = score;
      surface = candidate;
    }
  }

  const texts: TextPlan['texts'] = [];
  let recoloured = false;
  for (const d of drafts) {
    if (d.held) {
      kept.push({ area: d.area, text: d.text, why: d.held });
      continue;
    }
    const got = colorOn(d, surface);
    if (!shows(d, got.color)) {
      kept.push({ area: d.area, text: d.text, why: 'color' });
      continue;
    }
    if (!got.kept && colorDistance(PALETTE[got.color], d.color) > 125) {
      // The text cannot keep its colour. On the page's own ground it is
      // set in the colour it can have; on a field of another colour (a
      // label on a coloured sign, say) it was made to go with that field,
      // and stays in the picture as it was.
      if (colorDistance(d.behind, pageColor) > 60) {
        kept.push({ area: d.area, text: d.text, why: 'color' });
        continue;
      }
      recoloured = true;
    }
    const element = { ...d.element };
    if (got.color !== defaultTextColor(THEME_REN, surface, element.role, size(d))) {
      element.color = got.color;
    }
    texts.push(element);
  }
  return {
    surface,
    texts,
    kept,
    recoloured,
    lines,
    tiny,
  };
}

/** The upright rectangle around a piece of text that is turned. */
function turnedArea(piece: PdfPiece): Rect {
  const angle = (piece.angle * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corners = [
    [0, piece.size * 0.3],
    [piece.width, piece.size * 0.3],
    [0, -piece.size],
    [piece.width, -piece.size],
  ].map(([u, v]) => [piece.x + u! * cos - v! * sin, piece.y + u! * sin + v! * cos] as const);
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/**
 * The alternative texts PowerPoint wrote for the pictures: each stands in
 * unreadably small letters at its picture. A text belongs to the smallest
 * picture it stands in. The sentence PowerPoint adds to the descriptions it
 * has made itself is left out.
 */
export function pictureAlts(boxes: Rect[], tiny: TextPlan['tiny']): string[] {
  const texts = boxes.map(() => [] as string[]);
  for (const t of tiny) {
    let owner = -1;
    boxes.forEach((box, i) => {
      const inside =
        t.x >= box.x - 2 && t.x <= box.x + box.w && t.y >= box.y - 2 && t.y <= box.y + box.h + 4;
      if (inside && (owner < 0 || box.w * box.h < boxes[owner]!.w * boxes[owner]!.h)) owner = i;
    });
    if (owner < 0) continue;
    if (/^(Automatisk generert beskrivelse|Description automatically generated)/i.test(t.text)) {
      continue;
    }
    texts[owner]!.push(t.text);
  }
  return texts.map((lines) => cut(lines.join(' ').replace(/\s+/g, ' ').trim(), ALT_LIMIT));
}

// ---------- Pages as scenes ----------

/** A picture stored for a page, with the asset that describes it. */
export interface StoredPicture {
  assetId: string;
  asset: Asset;
}

/** One page of the PDF, taken apart and stored. */
export interface PdfPage {
  /** From 1. */
  number: number;
  fit: PageFit;
  /** The lines of the page's text, in the PDF's own order. */
  lines: string[];
  /**
   * The whole page as one picture: a page without text that can be taken
   * out, or one that could not be taken apart safely. The other fields
   * about content are then not used.
   */
  whole?: StoredPicture & { why: 'no-text' | 'garbled' | 'entangled' };
  surface?: Surface;
  /** Everything on the page that is neither text nor a picture of its own. */
  background?: StoredPicture;
  /**
   * The pictures, back to front, with where they stand on the stage: the
   * pictures of the page, and what was painted on top of them (`decorative`
   * when it says nothing: an arrow, a frame).
   */
  pictures?: Array<StoredPicture & { box: Rect; alt: string; decorative?: boolean }>;
  /** The text elements, in the PDF's own order. */
  texts?: Array<Omit<TextElement, 'id'>>;
  /** Text that could not be set as text, and is in the background or in a picture on top of one. */
  kept?: TextPlan['kept'];
  recoloured?: boolean;
  /** Links that did not lie on text: where they led. */
  looseLinks?: Array<string | undefined>;
}

const NO_TEXT =
  'Siden har ingen tekst som kan hentes ut. Skriv en alternativ tekst for bildet, så skjermlesere får den med.';
const GARBLED =
  'Teksten på siden kan ikke leses ut av PDF-fila, så hele siden er lagt inn som ett bilde. Skriv en alternativ tekst for bildet, så skjermlesere får den med.';
const ENTANGLED =
  'Siden er bygd opp slik at tekst og bilder ikke kan tas ut hver for seg, så hele siden er lagt inn som ett bilde. Teksten på siden er lagt inn som alternativ tekst for bildet.';
const KEPT_FORMULA =
  'Tekst med formler er lagt inn som bilde, slik at formlene blir riktige. Den teksten kan ikke endres her.';
const KEPT_OTHER =
  'Noe av teksten kunne ikke gjøres om til tekst som kan endres, og er lagt inn som bilde. Det gjelder tekst på farget bunn i en farge som tekst ikke kan ha her, tekst med tegn som ikke kan leses ut av PDF-fila, og tekst som er gjennomsiktig, speilvendt, skrevet loddrett eller skrevet fra høyre mot venstre.';
const RECOLOURED =
  'Noe av teksten har fått en annen farge enn i PDF-fila, fordi fargen ikke finnes blant fargene tekst kan ha her.';

function linkWarnings(targets: Array<string | undefined>): ImportWarning[] {
  const warnings: ImportWarning[] = [];
  const seen = new Set<string>();
  for (const target of targets) {
    const message =
      target === undefined || target.startsWith('#')
        ? 'En lenke til et annet sted i PDF-fila følger ikke med.'
        : `En lenke som ikke lå på tekst, følger ikke med: ${cut(target, 300)}`;
    if (seen.has(message)) continue;
    seen.add(message);
    warnings.push({ code: 'other', message });
  }
  return warnings;
}

/** True for a scene that is one picture of a whole page. */
export function isPagePicture(scene: Scene): boolean {
  const only = scene.elements[0];
  return scene.elements.length === 1 && only?.type === 'image' && !only.decorative;
}

/**
 * A page as a scene. Text and pictures are elements of their own, standing
 * where they stood; the rest of the page lies behind them as one picture,
 * and what was painted on top of a picture lies on top of it as a picture.
 * No logo and no brand shapes are put on top of the page, and there are no
 * steps and no script until the owner adds them. Elements lie back to
 * front: the background, the pictures, then the text in the PDF's order.
 */
export function pdfScene(page: PdfPage): Scene {
  const scene = newScene('content', pageTitle(page.lines, page.number));
  scene.background = page.surface ?? 'hvit';
  scene.showLogo = false;
  scene.decoration = false;
  const warnings: ImportWarning[] = [];
  if (page.whole) {
    const alt = page.whole.why === 'garbled' ? '' : altText(page.lines);
    scene.background = 'hvit';
    scene.elements.push({
      id: newId('e'),
      type: 'image',
      asset: page.whole.assetId,
      alt,
      box: page.fit.box,
    });
    if (page.whole.why === 'garbled') {
      scene.title = `Side ${page.number}`;
      warnings.push({ code: 'text', message: GARBLED });
    } else if (page.whole.why === 'entangled') warnings.push({ code: 'text', message: ENTANGLED });
    else if (!alt) warnings.push({ code: 'text', message: NO_TEXT });
    scene.imported = { slide: page.number, warnings };
    return scene;
  }

  const kept = page.kept ?? [];
  if (page.background) {
    // Text that stays in the picture is what the picture says to a screen reader.
    const alt = cut(
      kept
        .filter((k) => !k.apart)
        .map((k) => k.text.replace(/\s+/g, ' '))
        .join('\n'),
      ALT_LIMIT,
    );
    const picture: Element = {
      id: newId('e'),
      type: 'image',
      asset: page.background.assetId,
      alt,
      box: page.fit.box,
    };
    if (!alt) picture.decorative = true;
    scene.elements.push(picture);
  }
  for (const picture of page.pictures ?? []) {
    const element: Element = {
      id: newId('e'),
      type: 'image',
      asset: picture.assetId,
      alt: picture.alt,
      box: {
        x: round(picture.box.x, 2),
        y: round(picture.box.y, 2),
        w: round(picture.box.w, 2),
        h: round(picture.box.h, 2),
        rotation: 0,
      },
    };
    if (picture.decorative && !picture.alt) element.decorative = true;
    scene.elements.push(element);
  }
  for (const text of page.texts ?? []) {
    scene.elements.push({ id: newId('e'), ...structuredClone(text) });
  }

  if (kept.some((k) => k.why === 'formula')) warnings.push({ code: 'text', message: KEPT_FORMULA });
  if (kept.some((k) => k.why !== 'formula')) warnings.push({ code: 'text', message: KEPT_OTHER });
  if (page.recoloured) warnings.push({ code: 'text', message: RECOLOURED });
  warnings.push(...linkWarnings(page.looseLinks ?? []));
  scene.imported = { slide: page.number, warnings };
  return scene;
}

const PAGE_LINK = /^#page:(\d+)$/;

export function pdfProject(title: string, pages: PdfPage[]): Project {
  const project = newProject(title);
  for (const page of pages) {
    for (const stored of [page.whole, page.background, ...(page.pictures ?? [])]) {
      if (stored) project.assets[stored.assetId] = stored.asset;
    }
    project.scenes.push(pdfScene(page));
  }
  // Links between pages become links between scenes, now that the scenes exist.
  const sceneOfPage = new Map(pages.map((page, i) => [page.number, project.scenes[i]!.id]));
  for (const scene of project.scenes) {
    let lost = false;
    for (const element of scene.elements) {
      if (element.type !== 'text') continue;
      for (const paragraph of element.content.paragraphs) {
        for (const run of paragraph.runs) {
          const page = PAGE_LINK.exec(run.link ?? '');
          if (!page) continue;
          const target = sceneOfPage.get(Number(page[1]));
          if (target) run.link = `#scene:${target}`;
          else {
            delete run.link;
            lost = true;
          }
        }
      }
    }
    if (lost && scene.imported) {
      const known = new Set(scene.imported.warnings.map((w) => w.message));
      scene.imported.warnings.push(
        ...linkWarnings([undefined]).filter((w) => !known.has(w.message)),
      );
    }
  }
  return project;
}

/** A readable message for what pdf.js reports when a file cannot be opened. */
export function pdfErrorMessage(error: unknown): string {
  const name =
    typeof error === 'object' && error !== null ? String((error as { name?: unknown }).name) : '';
  if (name === 'PasswordException') {
    return 'PDF-fila er beskyttet med passord og kan ikke importeres. Lagre en kopi uten passord, og prøv igjen.';
  }
  if (name === 'InvalidPDFException') {
    return 'Fila er ikke en PDF som kan leses. Den kan være skadet.';
  }
  return 'PDF-fila kan ikke leses. Den kan være skadet.';
}
