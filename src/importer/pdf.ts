// The parts of the PDF import that need neither a canvas nor pdf.js: how a
// page is fitted to the stage, how its text becomes lines, an alternative
// text and a title, and how the pages become a project. The drawing itself
// happens in the interface (src/renderer/src/pdfRender.ts).
import { STAGE } from '../shared/format/constants';
import { newId, newProject, newScene } from '../shared/format/factory';
import type { Asset, Box, Project, Scene } from '../shared/format/schema';

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
  /** Where the page picture stands on the stage: its own proportions, centred. */
  box: Box;
  /** Size of the picture to draw. */
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

/** One page of the PDF, drawn and stored. */
export interface PdfPage {
  /** From 1. */
  number: number;
  assetId: string;
  asset: Asset;
  fit: PageFit;
  lines: string[];
}

const NO_TEXT =
  'Siden har ingen tekst som kan hentes ut. Skriv en alternativ tekst for bildet, så skjermlesere får den med.';

/**
 * A page as a scene: the page picture on a white surface, with the page's
 * text as its alternative text. No logo and no brand shapes are put on top
 * of the page, and there are no steps and no script until the owner adds them.
 */
export function pdfScene(page: PdfPage): Scene {
  const scene = newScene('content', pageTitle(page.lines, page.number));
  scene.background = 'hvit';
  scene.showLogo = false;
  scene.decoration = false;
  const alt = altText(page.lines);
  scene.elements.push({
    id: newId('e'),
    type: 'image',
    asset: page.assetId,
    alt,
    box: page.fit.box,
  });
  scene.imported = {
    slide: page.number,
    warnings: alt ? [] : [{ code: 'text', message: NO_TEXT }],
  };
  return scene;
}

export function pdfProject(title: string, pages: PdfPage[]): Project {
  const project = newProject(title);
  for (const page of pages) {
    project.assets[page.assetId] = page.asset;
    project.scenes.push(pdfScene(page));
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
