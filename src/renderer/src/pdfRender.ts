// Reads the pages of a PDF with pdf.js (Apache-2.0) and turns them into a
// project: one scene per page, where the text is text elements, the
// pictures are picture elements, and the rest of the page lies behind them
// as one picture. This file is only loaded when the owner imports a PDF.
//
// A page is drawn several times, each time with only some of its
// operations: everything (to see what the page looks like), only the text
// (to see which colour each piece of text has, and that it shows), each
// picture by itself (so it comes out as it appears: cut, turned and masked
// as on the page), and everything but the text and the pictures (the
// background). What the pieces become is decided in src/importer/pdf.ts.
//
// Everything pdf.js needs comes from the program's own files: its worker,
// and the two decoders for picture formats the browser engine cannot read
// itself (JPEG 2000 and JBIG2, both common in scanned PDFs). The font and
// character-map folders that come with pdf.js are not taken along (see
// docs/stakk.md), so a font that is not embedded in the PDF is drawn with a
// font from the machine instead.
import {
  GlobalWorkerOptions,
  OPS,
  VerbosityLevel,
  getDocument,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import jbig2Url from 'pdfjs-dist/wasm/jbig2.wasm?url';
import openJpegUrl from 'pdfjs-dist/wasm/openjpeg.wasm?url';
import type { AddedMedia } from '../../shared/api';
import { STAGE } from '../../shared/format/constants';
import type { Project } from '../../shared/format/schema';
import { THEME_REN } from '../../shared/theme/theme';
import {
  FontFit,
  OP_OTHER,
  OP_PICTURE,
  OP_SETUP,
  OP_TEXT,
  PDF_PIXEL_DENSITY,
  PICTURE_LIMIT,
  PICTURE_MIN_SIDE,
  documentTitle,
  fitPage,
  isGarbled,
  linkPieces,
  linkUnderlines,
  multiply,
  pageLines,
  pdfErrorMessage,
  pdfProject,
  pictureAlts,
  pictureDensity,
  pictureFrame,
  pictureRegion,
  planText,
  sortOperations,
  type Matrix,
  type PageFit,
  type PageOperations,
  type PdfLink,
  type PdfPage,
  type PdfPiece,
  type PdfTextItem,
  type Rect,
  type StoredPicture,
  type TextFace,
  type TextMetrics,
} from '../../importer/pdf';
import { pdfChapters, type PdfBookmark } from '../../importer/pdfChapters';

export { isPagePicture } from '../../importer/pdf';

/**
 * Pictures are stored as WebP, which the browser engine writes itself (no
 * library is needed). Every picture ends up inside the exported HTML file,
 * so size matters.
 *
 * Measured on the backgrounds of real lecture pages at 3840 x 2160 (what
 * is left of a page when its text and pictures are taken out): the engine's
 * WebP without loss is 0.9 to 2 MB a page, even for a white page with a
 * small logo, and its PNG 0.2 to 1 MB; WebP with loss at quality 0.95 is
 * 20 to 190 kB, and at double resolution no difference can be seen in
 * lines and edges. So drawings and backgrounds are stored with loss at
 * 0.95, and photographs at 0.9. A small drawing is stored without loss
 * (the engine does that at quality 1) when that costs little more.
 */
const PICTURE_TYPE = 'image/webp';
const PHOTO_QUALITY = 0.9;
const DRAWING_QUALITY = 0.95;
const NO_LOSS = 1;
/** Drawings up to this many pixels are tried without loss. */
const NO_LOSS_PIXELS = 1_500_000;

/** Thrown when the owner stops the import. Not an error to show. */
export class ImportCancelled extends Error {
  constructor() {
    super('Importen ble avbrutt.');
    this.name = 'ImportCancelled';
  }
}

const OWN_FILES: Record<string, string> = {
  'jbig2.wasm': jbig2Url,
  'openjpeg.wasm': openJpegUrl,
};

/**
 * Hands pdf.js the files it asks for, from the program's own files only.
 * Anything else (font data, character maps) is not there, and pdf.js then
 * does without.
 */
class OwnFiles {
  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    const url = kind === 'wasmUrl' ? OWN_FILES[filename] : undefined;
    if (!url) throw new Error(`Not part of the program: ${filename}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Cannot read ${filename}`);
    return new Uint8Array(await response.arrayBuffer());
  }
}

export interface PdfImportSteps {
  /** The file's name, used for the title when the PDF has none of its own. */
  name: string;
  signal: AbortSignal;
  /**
   * Called when the file has proved readable, before anything is drawn.
   * Resolves to false when the import is not to go on.
   */
  begin(pages: number): Promise<boolean>;
  /** Called before each page is read. */
  progress(page: number, pages: number): void;
  /** Stores a picture from a page and describes it as an asset. */
  store(page: number, data: Uint8Array): Promise<AddedMedia>;
}

// ---------- Canvases ----------

interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

/** A canvas that can be see-through and is read back often. */
function layer(width: number, height: number): Layer {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Bildet av siden kan ikke lages.');
  return { canvas, ctx };
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== PICTURE_TYPE) {
          reject(new Error('Bildet av siden kan ikke lages.'));
          return;
        }
        void blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
      },
      PICTURE_TYPE,
      quality,
    );
  });
}

/**
 * What a picture is like, read from its pixels: a key that two pictures
 * share only when they are the same, whether anything but white shows in
 * it, and whether it is a photograph (pixels next to each other nearly
 * always differ a little) rather than a drawing (they are mostly the same).
 */
function describe(image: ImageData): { key: string; blank: boolean; photo: boolean } {
  const pixels = new Uint32Array(image.data.buffer, image.data.byteOffset, image.data.length >> 2);
  let a = 0x811c9dc5;
  let b = 0x01000193;
  let blank = true;
  for (let i = 0; i < pixels.length; i++) {
    const value = pixels[i]!;
    a = Math.imul(a ^ value, 0x01000193);
    b = (Math.imul(b, 31) + value) | 0;
    // Little-endian: alpha in the top byte. See-through and white count as nothing.
    if (blank && value >>> 24 !== 0 && (value & 0x00f8f8f8) !== 0x00f8f8f8) blank = false;
  }
  const { data, width, height } = image;
  let pairs = 0;
  let soft = 0;
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 40_000)));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x + 1 < width; x += step) {
      const i = (y * width + x) * 4;
      if (data[i + 3]! < 255 || data[i + 7]! < 255) continue;
      pairs += 1;
      const difference =
        Math.abs(data[i]! - data[i + 4]!) +
        Math.abs(data[i + 1]! - data[i + 5]!) +
        Math.abs(data[i + 2]! - data[i + 6]!);
      if (difference > 0 && difference <= 36) soft += 1;
    }
  }
  return {
    key: `${width}x${height}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`,
    blank,
    photo: pairs > 0 && soft / pairs > 0.12,
  };
}

/** The colour most of a picture has. */
function commonColor(image: ImageData): string {
  const { data, width, height } = image;
  const counts = new Map<number, number>();
  let best = 0xffffff;
  let most = 0;
  for (let y = 4; y < height; y += 16) {
    for (let x = 4; x < width; x += 16) {
      const i = (y * width + x) * 4;
      const key = ((data[i]! >> 2) << 12) | ((data[i + 1]! >> 2) << 6) | (data[i + 2]! >> 2);
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      if (count > most) {
        most = count;
        best = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
      }
    }
  }
  return `#${best.toString(16).padStart(6, '0')}`;
}

// ---------- The program's fonts ----------

/**
 * Measures text in the program's own fonts, the ones the stage sets text
 * in. The stage has no bold serif font, so serif text is measured upright.
 */
async function programMetrics(): Promise<TextMetrics> {
  const { fonts } = THEME_REN;
  const fontOf = (face: TextFace): string =>
    `${face.italic ? 'italic ' : ''}${face.bold && !face.serif ? 700 : 400} 100px ${
      face.serif ? fonts.title : fonts.body
    }`;
  const faces: TextFace[] = [];
  for (const serif of [false, true]) {
    for (const bold of [false, true]) {
      for (const italic of [false, true]) faces.push({ serif, bold, italic });
    }
  }
  await Promise.all(faces.map((face) => document.fonts.load(fontOf(face)).catch(() => undefined)));
  const ctx = layer(1, 1).ctx;
  const widths = new Map<string, number>();
  const lines = new Map<boolean, { ascent: number; descent: number }>();
  const lineOf = (serif: boolean): { ascent: number; descent: number } => {
    let line = lines.get(serif);
    if (!line) {
      ctx.font = fontOf({ serif, bold: false, italic: false });
      const measured = ctx.measureText('x');
      line = {
        ascent: measured.fontBoundingBoxAscent / 100,
        descent: measured.fontBoundingBoxDescent / 100,
      };
      lines.set(serif, line);
    }
    return line;
  };
  return {
    width(text, face) {
      const font = fontOf(face);
      const key = `${font}\n${text}`;
      let width = widths.get(key);
      if (width === undefined) {
        ctx.font = font;
        width = ctx.measureText(text).width / 100;
        widths.set(key, width);
      }
      return width;
    },
    ascent: (serif) => lineOf(serif).ascent,
    descent: (serif) => lineOf(serif).descent,
  };
}

// ---------- One page ----------

/**
 * How far inside the edge of a picture (stage pixels) something must be
 * painted to count as painted over it: a frame drawn around a picture, or
 * a neighbour that touches it, does not keep it from being taken out.
 */
const PAINTED_OVER_INSET = 6;

/** What is remembered through the whole file. */
interface ImportState {
  doc: PDFDocumentProxy;
  steps: PdfImportSteps;
  metrics: TextMetrics;
  fit: FontFit;
  /** The text of every page, read before any page is taken apart. */
  texts: PageText[];
  /** Pictures already stored, by what they show: a background most pages share is stored once. */
  stored: Map<string, StoredPicture>;
  stopIfCancelled(): void;
}

type Filter = (index: number, operations: unknown) => boolean;

/** The text of a page as pdf.js hands it out. */
type PageText = Awaited<ReturnType<PDFPageProxy['getTextContent']>>;

function readText(page: PDFPageProxy): Promise<PageText> {
  return page.getTextContent().catch(() => ({ items: [], styles: {}, lang: null }));
}

/**
 * Draws a page, or the operations of it the filter lets through. With
 * `see-through` nothing is painted behind the page.
 *
 * "print" draws the page as it is meant to look on paper, and, what matters
 * here, without waiting for the screen to ask for a new frame: a window
 * that is hidden or minimised never asks.
 */
async function draw(
  page: PDFPageProxy,
  target: Layer,
  viewport: ReturnType<PDFPageProxy['getViewport']>,
  mode: 'white' | 'see-through',
  filter?: Filter,
): Promise<void> {
  target.ctx.setTransform(1, 0, 0, 1, 0, 0);
  target.ctx.clearRect(0, 0, target.canvas.width, target.canvas.height);
  await page.render({
    // pdf.js makes a context without transparency for a canvas it is handed;
    // a context of our own keeps what is not painted see-through.
    canvas: null,
    canvasContext: target.ctx,
    viewport,
    intent: 'print',
    background: mode === 'white' ? '#ffffff' : 'rgba(0, 0, 0, 0)',
    ...(filter ? { operationsFilter: filter } : {}),
  }).promise;
  target.ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * Keeps what pdf.js has read of a page while it is drawn several times.
 * After a drawing for "print", pdf.js throws the page's operations and
 * pictures away as soon as no drawing of the page is under way, and would
 * read them from the file again for the next one. A drawing that is asked
 * for but not let start keeps them; `release` drops it.
 */
function hold(page: PDFPageProxy): { release(): Promise<void> } {
  const task = page.render({
    canvas: null,
    canvasContext: layer(1, 1).ctx,
    viewport: page.getViewport({ scale: 0.01 }),
    intent: 'print',
    // Never resolved: the drawing waits for it, and is dropped instead.
    optionalContentConfigPromise: new Promise(() => undefined),
  });
  return {
    async release() {
      task.cancel();
      await task.promise.catch(() => undefined);
    },
  };
}

/** The upright rectangle a piece of text covers, in stage pixels. */
function pieceArea(piece: PdfPiece): Rect {
  const angle = (piece.angle * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corners = [
    [0, piece.size * 0.25],
    [piece.width, piece.size * 0.25],
    [0, -piece.size * 0.85],
    [piece.width, -piece.size * 0.85],
  ].map(([u, v]) => [piece.x + u! * cos - v! * sin, piece.y + u! * sin + v! * cos] as const);
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

const hex = (r: number, g: number, b: number): string =>
  `#${((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1)}`;

/**
 * Looks at every piece of text on the page: the colour it is drawn in, the
 * colour of what lies behind it, and whether it shows at all. `text` is
 * the page with only its text drawn, `whole` the page as it looks; both at
 * `density` pixels per stage pixel, with the page's corner at `origin`.
 * A piece shows when its letters are in the picture of the whole page too:
 * invisible text leaves no letters, and covered text leaves letters that
 * are not seen. Text painted see-through is marked as not plain.
 */
function lookAtText(
  pieces: PdfPiece[],
  text: ImageData,
  whole: ImageData,
  density: number,
  origin: { x: number; y: number },
): void {
  const { width, height } = text;
  for (const piece of pieces) {
    if (piece.str.trim() === '') continue;
    const area = pieceArea(piece);
    const x0 = Math.max(0, Math.floor((area.x - origin.x) * density));
    const y0 = Math.max(0, Math.floor((area.y - origin.y) * density));
    const x1 = Math.min(width, Math.ceil((area.x + area.w - origin.x) * density));
    const y1 = Math.min(height, Math.ceil((area.y + area.h - origin.y) * density));
    if (x1 <= x0 || y1 <= y0) continue;
    const step = (x1 - x0) * (y1 - y0) > 120_000 ? 2 : 1;
    let strong = 0;
    let seen = 0;
    let ink = 0;
    let most = 0;
    const solid = [0, 0, 0];
    const faint = [0, 0, 0, 0];
    const behind = [0, 0, 0, 0];
    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        const i = (y * width + x) * 4;
        const alpha = text.data[i + 3]!;
        if (alpha === 0) {
          behind[0]! += whole.data[i]!;
          behind[1]! += whole.data[i + 1]!;
          behind[2]! += whole.data[i + 2]!;
          behind[3]! += 1;
          continue;
        }
        if (alpha > most) most = alpha;
        if (alpha > 24) {
          ink += 1;
          faint[0]! += text.data[i]! * alpha;
          faint[1]! += text.data[i + 1]! * alpha;
          faint[2]! += text.data[i + 2]! * alpha;
          faint[3]! += alpha;
        }
        if (alpha >= 250) {
          strong += 1;
          solid[0]! += text.data[i]!;
          solid[1]! += text.data[i + 1]!;
          solid[2]! += text.data[i + 2]!;
          const off = Math.max(
            Math.abs(text.data[i]! - whole.data[i]!),
            Math.abs(text.data[i + 1]! - whole.data[i + 1]!),
            Math.abs(text.data[i + 2]! - whole.data[i + 2]!),
          );
          if (off <= 40) seen += 1;
        }
      }
    }
    piece.behind =
      behind[3]! > 0
        ? hex(behind[0]! / behind[3]!, behind[1]! / behind[3]!, behind[2]! / behind[3]!)
        : '#ffffff';
    if (strong >= 3) {
      if (seen / strong >= 0.5) {
        piece.color = hex(solid[0]! / strong, solid[1]! / strong, solid[2]! / strong);
      }
    } else if (ink > 0 && faint[3]! > 0) {
      // Letters too thin to have one whole pixel: take them as showing.
      piece.color = hex(faint[0]! / faint[3]!, faint[1]! / faint[3]!, faint[2]! / faint[3]!);
      // Letters that are see-through all over (a watermark, a shadow) are
      // not text the stage can set: it has no see-through text.
      if (ink >= 12 && most < 200) piece.plain = false;
    }
  }
}

/** The smallest rectangle that holds everything that is not see-through. */
function inked(image: ImageData): { x: number; y: number; w: number; h: number } | undefined {
  const { data, width, height } = image;
  let top = -1;
  let bottom = -1;
  let left = width;
  let right = -1;
  for (let y = 0; y < height; y++) {
    let first = -1;
    let last = -1;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] !== 0) {
        if (first < 0) first = x;
        last = x;
      }
    }
    if (first < 0) continue;
    if (top < 0) top = y;
    bottom = y;
    if (first < left) left = first;
    if (last > right) right = last;
  }
  if (top < 0) return undefined;
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

async function readLinks(
  state: ImportState,
  page: PDFPageProxy,
  number: number,
  toStage: (rect: number[]) => Rect,
): Promise<PdfLink[]> {
  const pageOf = async (dest: unknown): Promise<number | undefined> => {
    try {
      const explicit = typeof dest === 'string' ? await state.doc.getDestination(dest) : dest;
      const ref: unknown = Array.isArray(explicit) ? explicit[0] : undefined;
      if (typeof ref === 'number' && Number.isInteger(ref)) return ref + 1;
      if (ref && typeof ref === 'object') {
        return (await state.doc.getPageIndex(ref as { num: number; gen: number })) + 1;
      }
    } catch {
      // A destination that is not in the file leads nowhere.
    }
    return undefined;
  };
  const steps: Record<string, number> = {
    NextPage: number + 1,
    PrevPage: number - 1,
    FirstPage: 1,
    LastPage: state.doc.numPages,
  };
  const links: PdfLink[] = [];
  const annotations = (await page.getAnnotations().catch(() => [])) as Array<{
    subtype?: string;
    rect?: number[];
    url?: string;
    dest?: unknown;
    action?: string;
  }>;
  for (const annotation of annotations) {
    if (annotation.subtype !== 'Link' || !Array.isArray(annotation.rect)) continue;
    const link: PdfLink = { rect: toStage(annotation.rect) };
    if (typeof annotation.url === 'string' && /^(https?:|mailto:)/i.test(annotation.url)) {
      link.target = annotation.url;
    } else {
      const target = annotation.dest
        ? await pageOf(annotation.dest)
        : steps[annotation.action ?? ''];
      if (target !== undefined && target >= 1 && target <= state.doc.numPages) {
        link.target = `#page:${target}`;
      }
    }
    links.push(link);
  }
  return links;
}

async function importPage(state: ImportState, number: number): Promise<PdfPage> {
  const { steps, stopIfCancelled } = state;
  const page = await state.doc.getPage(number);
  // The viewport takes the page's own rotation into account.
  const size = page.getViewport({ scale: 1 });
  const fit: PageFit = fitPage(size.width, size.height);
  const stageScale = fit.box.w / size.width;
  const pixelScale = fit.pixelWidth / size.width;
  const density = fit.pixelWidth / fit.box.w;
  const origin = { x: fit.box.x, y: fit.box.y };
  const failed = (): never => {
    stopIfCancelled();
    throw new Error(`Side ${number} i PDF-fila kan ikke tegnes.`);
  };

  /** Stores a picture, or hands out the one already stored that shows the same. */
  const store = async (canvas: HTMLCanvasElement, image: ImageData): Promise<StoredPicture> => {
    const about = describe(image);
    const known = state.stored.get(about.key);
    if (known) return known;
    let bytes = await encode(canvas, about.photo ? PHOTO_QUALITY : DRAWING_QUALITY);
    if (!about.photo && image.width * image.height <= NO_LOSS_PIXELS) {
      const exact = await encode(canvas, NO_LOSS);
      if (exact.byteLength <= bytes.byteLength * 1.5) bytes = exact;
    }
    stopIfCancelled();
    const added = await steps.store(number, bytes);
    const stored = { assetId: added.id, asset: added.asset };
    state.stored.set(about.key, stored);
    return stored;
  };

  const held = hold(page);
  try {
    // The page as it looks. This drawing also brings its operations and fonts.
    const full = page.getViewport({ scale: pixelScale });
    const whole = layer(fit.pixelWidth, fit.pixelHeight);
    // pdf.js hands the list of operations to the filter of a drawing.
    let list: { fnArray: ArrayLike<number>; argsArray: ArrayLike<unknown> } | undefined;
    await draw(page, whole, full, 'white', (_index, operations) => {
      list = operations as typeof list;
      return true;
    }).catch(failed);
    stopIfCancelled();
    const wholeImage = whole.ctx.getImageData(0, 0, fit.pixelWidth, fit.pixelHeight);

    const content = state.texts[number - 1] ?? (await readText(page));
    const stage = page.getViewport({ scale: stageScale });
    const toStage: Matrix = multiply(
      [1, 0, 0, 1, origin.x, origin.y],
      stage.transform as unknown as Matrix,
    );
    const items: PdfTextItem[] = [];
    const pieces: PdfPiece[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      items.push({ str: item.str, hasEOL: item.hasEOL });
      const m = multiply(toStage, item.transform as number[]);
      const turned = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
      const style = (content.styles as Record<string, { fontFamily?: string; vertical?: boolean }>)[
        item.fontName
      ];
      const font = page.commonObjs.has(item.fontName)
        ? (page.commonObjs.get(item.fontName) as {
            name?: string;
            bold?: boolean;
            black?: boolean;
            italic?: boolean;
          })
        : undefined;
      // pdf.js says whether a font is bold or italic only for fonts that are
      // not embedded; for the others the font's name says it ("Calibri-Bold").
      const fontName = font?.name ?? '';
      pieces.push({
        str: item.str,
        x: m[4],
        y: m[5],
        width: item.width * stageScale,
        size: Math.hypot(m[2], m[3]),
        angle: Math.abs(turned) < 0.5 ? 0 : Math.round(turned * 10) / 10,
        font: item.fontName,
        serif: style?.fontFamily === 'serif',
        bold: Boolean(font?.bold || font?.black) || /bold|black|heavy/i.test(fontName),
        italic: Boolean(font?.italic) || /italic|oblique/i.test(fontName),
        // Along a line from left to right, with the letters upright on the
        // line: not vertical writing, mirrored or slanted by the page.
        plain:
          item.dir === 'ltr' &&
          !style?.vertical &&
          m[0] * m[3] - m[1] * m[2] < 0 &&
          Math.abs(m[0] * m[2] + m[1] * m[3]) <=
            0.02 * Math.hypot(m[0], m[1]) * Math.hypot(m[2], m[3]),
        hasEOL: item.hasEOL,
      });
    }
    const lines = pageLines(items);
    const wholePage = async (why: NonNullable<PdfPage['whole']>['why']): Promise<PdfPage> => ({
      number,
      fit,
      lines,
      whole: { ...(await store(whole.canvas, wholeImage)), why },
    });

    if (!list || pieces.every((piece) => piece.str.trim() === '')) return wholePage('no-text');
    const operations: PageOperations = sortOperations(
      list.fnArray,
      list.argsArray,
      OPS as unknown as Record<string, number>,
    );
    const { kinds } = operations;
    if (operations.entangled) return wholePage('entangled');

    // The links, laid on the text they cover. The line drawn under such
    // text belongs to the text: the stage underlines links itself.
    const links = await readLinks(state, page, number, (rect) => {
      const [x0, y0] = stage.convertToViewportPoint(rect[0]!, rect[1]!) as [number, number];
      const [x1, y1] = stage.convertToViewportPoint(rect[2]!, rect[3]!) as [number, number];
      return {
        x: Math.min(x0, x1) + origin.x,
        y: Math.min(y0, y1) + origin.y,
        w: Math.abs(x1 - x0),
        h: Math.abs(y1 - y0),
      };
    });
    const linked = linkPieces(pieces, links, state.metrics);
    const onText = links.filter((link) => !linked.loose.includes(link)).map((link) => link.rect);
    for (const index of linkUnderlines(operations.paths, onText, toStage)) kinds[index] = OP_TEXT;

    // Only the text, to see its colours and whether it shows.
    const textLayer = layer(fit.pixelWidth, fit.pixelHeight);
    await draw(page, textLayer, full, 'see-through', (i) => {
      const kind = kinds[i];
      return kind === OP_SETUP || kind === OP_TEXT;
    }).catch(failed);
    stopIfCancelled();
    const textImage = textLayer.ctx.getImageData(0, 0, fit.pixelWidth, fit.pixelHeight);
    lookAtText(linked.pieces, textImage, wholeImage, density, origin);
    const visible = linked.pieces.filter((piece) => piece.color !== undefined);
    if (visible.length === 0) return wholePage('no-text');
    if (isGarbled(visible)) return wholePage('garbled');

    const plan = planText(
      linked.pieces,
      state.metrics,
      state.fit,
      commonColor(wholeImage),
      fit.box.w >= STAGE.width - 1 && fit.box.h >= STAGE.height - 1,
    );
    if (plan.texts.length === 0 && plan.kept.length === 0) return wholePage('no-text');

    // The pictures, each drawn by itself.
    const pageRect: Rect = { ...origin, w: fit.box.w, h: fit.box.h };
    const taken = new Set<number>();
    const pictures: NonNullable<PdfPage['pictures']> = [];
    /** What is painted on top of a picture later, by the first such operation. */
    const above = new Map<number, ImageData>();
    const paintedOver = async (index: number, box: Rect): Promise<boolean> => {
      let next = index + 1;
      while (next < kinds.length && kinds[next] !== OP_OTHER) next += 1;
      if (next >= kinds.length) return false;
      let later = above.get(next);
      if (later === undefined) {
        // Half the stage's resolution is enough to see whether something is there.
        const small = layer(fit.box.w / 2, fit.box.h / 2);
        await draw(page, small, page.getViewport({ scale: stageScale / 2 }), 'see-through', (i) => {
          const kind = kinds[i];
          return kind === OP_SETUP || (kind === OP_OTHER && i >= next);
        }).catch(failed);
        later = small.ctx.getImageData(0, 0, small.canvas.width, small.canvas.height);
        above.set(next, later);
      }
      const inset = PAINTED_OVER_INSET;
      const x0 = Math.max(0, Math.ceil((box.x - origin.x + inset) / 2));
      const y0 = Math.max(0, Math.ceil((box.y - origin.y + inset) / 2));
      const x1 = Math.min(later.width, Math.floor((box.x - origin.x + box.w - inset) / 2));
      const y1 = Math.min(later.height, Math.floor((box.y - origin.y + box.h - inset) / 2));
      let painted = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (later.data[(y * later.width + x) * 4 + 3]! > 48) painted += 1;
        }
      }
      return painted > 8;
    };
    /**
     * Where pictures that stay in the page stand. A picture taken out lies
     * on top of the background, so nothing that stays may lie on top of it
     * in the PDF: the pictures are gone through from the top one down.
     */
    const staying: Rect[] = [];
    const keptText = plan.kept.map((k) => k.area);
    const touches = (box: Rect, others: Rect[], inset: number): boolean =>
      others.some(
        (other) =>
          other.x < box.x + box.w - inset &&
          other.x + other.w > box.x + inset &&
          other.y < box.y + box.h - inset &&
          other.y + other.h > box.y + inset,
      );
    const candidates = operations.pictures.length <= PICTURE_LIMIT ? operations.pictures : [];
    for (const picture of [...candidates].reverse()) {
      stopIfCancelled();
      const frame = pictureFrame(picture, toStage);
      const region = pictureRegion(frame, pageRect);
      if (!region) {
        staying.push(frame.box);
        continue;
      }
      // Text that stays in the background must not end up under a picture.
      if (touches(region, keptText, 0)) {
        staying.push(region);
        continue;
      }
      const scale = pictureDensity(frame);
      const left = Math.floor((region.x - origin.x) * scale) - 1;
      const top = Math.floor((region.y - origin.y) * scale) - 1;
      const alone = layer(Math.ceil(region.w * scale) + 3, Math.ceil(region.h * scale) + 3);
      const view = page.getViewport({ scale: stageScale * scale, offsetX: -left, offsetY: -top });
      await draw(page, alone, view, 'see-through', (i) => {
        return kinds[i] === OP_SETUP || i === picture.index;
      }).catch(failed);
      const drawn = alone.ctx.getImageData(0, 0, alone.canvas.width, alone.canvas.height);
      const mark = inked(drawn);
      // Nothing of it shows (cut away, or switched off in the PDF).
      if (!mark) {
        taken.add(picture.index);
        continue;
      }
      // Where it shows. A picture with few pixels is drawn with few, and its
      // edges are then only known to a pixel of its own; where an edge is
      // the edge of the picture's frame, the frame says exactly where it is.
      const edge = (drawn: number, framed: number): number =>
        Math.abs(drawn - framed) <= 1.5 / scale ? framed : drawn;
      const x0 = edge(origin.x + (left + mark.x) / scale, region.x);
      const y0 = edge(origin.y + (top + mark.y) / scale, region.y);
      const x1 = edge(origin.x + (left + mark.x + mark.w) / scale, region.x + region.w);
      const y1 = edge(origin.y + (top + mark.y + mark.h) / scale, region.y + region.h);
      const box: Rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      const stays =
        box.w < PICTURE_MIN_SIDE ||
        box.h < PICTURE_MIN_SIDE ||
        touches(box, staying, PAINTED_OVER_INSET) ||
        (await paintedOver(picture.index, box));
      if (stays) {
        staying.push(box);
        continue;
      }
      const cut = layer(mark.w, mark.h);
      cut.ctx.drawImage(alone.canvas, -mark.x, -mark.y);
      try {
        const stored = await store(cut.canvas, cut.ctx.getImageData(0, 0, mark.w, mark.h));
        pictures.unshift({ ...stored, box, alt: '' });
        taken.add(picture.index);
      } catch {
        // A picture that cannot be stored by itself stays in the background picture.
        stopIfCancelled();
        staying.push(box);
      }
    }
    pictureAlts(
      pictures.map((p) => p.box),
      plan.tiny,
    ).forEach((alt, i) => {
      pictures[i]!.alt = alt;
    });

    // The rest of the page: everything but the text and the pictures taken out.
    stopIfCancelled();
    const rest = layer(fit.pixelWidth, fit.pixelHeight);
    await draw(page, rest, full, 'see-through', (i) => {
      const kind = kinds[i];
      return kind === OP_SETUP || kind === OP_OTHER || (kind === OP_PICTURE && !taken.has(i));
    }).catch(failed);
    // Text that could not be made into text elements is put back where it stood.
    for (const k of plan.kept) {
      const pad = 4;
      const x = Math.max(0, Math.floor((k.area.x - origin.x) * density) - pad);
      const y = Math.max(0, Math.floor((k.area.y - origin.y) * density) - pad);
      const w = Math.min(fit.pixelWidth - x, Math.ceil(k.area.w * density) + 2 * pad);
      const h = Math.min(fit.pixelHeight - y, Math.ceil(k.area.h * density) + 2 * pad);
      if (w > 0 && h > 0) rest.ctx.drawImage(textLayer.canvas, x, y, w, h, x, y, w, h);
    }
    const restImage = rest.ctx.getImageData(0, 0, fit.pixelWidth, fit.pixelHeight);
    const about = describe(restImage);
    const result: PdfPage = {
      number,
      fit,
      lines: plan.lines,
      surface: plan.surface,
      pictures,
      texts: plan.texts,
      kept: plan.kept,
      recoloured: plan.recoloured,
      looseLinks: linked.loose.map((link) => link.target),
    };
    // A plain white page needs no picture behind it.
    if (!(about.blank && plan.surface === 'hvit')) {
      result.background = await store(rest.canvas, restImage);
    }
    return result;
  } finally {
    await held.release();
    page.cleanup();
  }
}

/**
 * The bookmarks at the top of the PDF's list, with the page each leads to
 * (from 0) and the pages the bookmarks under it lead to. PowerPoint writes
 * a bookmark for every section, with its slides under it.
 */
async function bookmarks(doc: PDFDocumentProxy): Promise<PdfBookmark[]> {
  const pageOf = async (dest: unknown): Promise<number | undefined> => {
    try {
      const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
      const ref: unknown = Array.isArray(explicit) ? explicit[0] : undefined;
      if (typeof ref === 'number' && Number.isInteger(ref)) return ref;
      if (ref && typeof ref === 'object') {
        return await doc.getPageIndex(ref as { num: number; gen: number });
      }
    } catch {
      // A bookmark that leads to nothing in the file begins no chapter.
    }
    return undefined;
  };
  const outline = await doc.getOutline().catch(() => null);
  const list: PdfBookmark[] = [];
  for (const item of outline ?? []) {
    list.push({
      title: item.title,
      page: await pageOf(item.dest),
      children: await Promise.all(item.items.map((child) => pageOf(child.dest))),
    });
  }
  return list;
}

/**
 * Reads a PDF and takes every page apart. Resolves to the finished
 * project, or to null when `begin` said no. Throws ImportCancelled when the
 * signal fires, and an Error with a readable message when the file cannot
 * be read.
 */
export async function importPdfPages(
  data: Uint8Array,
  steps: PdfImportSteps,
): Promise<Project | null> {
  const stopIfCancelled = (): void => {
    if (steps.signal.aborted) throw new ImportCancelled();
  };
  GlobalWorkerOptions.workerSrc = workerUrl;
  const task = getDocument({
    data,
    BinaryDataFactory: OwnFiles,
    useWorkerFetch: false,
    // Pages are drawn here, one at a time.
    disableWorkerRendering: true,
    // The names of the fonts, which say whether text is bold or italic.
    fontExtraProperties: true,
    enableXfa: false,
    verbosity: VerbosityLevel.WARNINGS,
  });
  try {
    const doc = await task.promise.catch((error: unknown) => {
      throw new Error(pdfErrorMessage(error));
    });
    stopIfCancelled();
    if (!(await steps.begin(doc.numPages))) return null;

    const info = await doc.getMetadata().then(
      (meta) => meta.info as { Title?: unknown },
      () => ({}) as { Title?: unknown },
    );
    const metrics = await programMetrics();
    // First the text of the whole file, to learn how wide its fonts are:
    // the same font then gets the same size on every page.
    const fontFit = new FontFit(metrics);
    const texts: PageText[] = [];
    for (let number = 1; number <= doc.numPages; number++) {
      stopIfCancelled();
      const page = await doc.getPage(number);
      const content = await readText(page);
      texts.push(content);
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const size = Math.hypot(Number(item.transform[2]), Number(item.transform[3]));
        const style = content.styles[item.fontName];
        if (!(size > 0) || item.dir !== 'ltr' || style?.vertical) continue;
        fontFit.learn({
          font: item.fontName,
          serif: style?.fontFamily === 'serif',
          text: item.str,
          width: item.width / size,
        });
      }
      page.cleanup();
    }
    const state: ImportState = {
      doc,
      steps,
      metrics,
      fit: fontFit,
      texts,
      stored: new Map(),
      stopIfCancelled,
    };
    const pages: PdfPage[] = [];
    for (let number = 1; number <= doc.numPages; number++) {
      stopIfCancelled();
      steps.progress(number, doc.numPages);
      pages.push(await importPage(state, number));
    }
    stopIfCancelled();
    const chapters = pdfChapters(await bookmarks(doc), doc.numPages);
    return pdfProject(documentTitle(info.Title, steps.name), pages, chapters);
  } finally {
    await task.destroy().catch(() => undefined);
  }
}
