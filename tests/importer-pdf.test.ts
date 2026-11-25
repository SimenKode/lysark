// The parts of the PDF import that need no canvas: fitting a page to the
// stage, sorting what a page draws, the page's text as lines, paragraphs
// and text elements, links, colours, the scenes, and the folder the
// pictures are stored in.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ALT_LIMIT,
  FontFit,
  OP_OTHER,
  OP_PICTURE,
  OP_SETUP,
  OP_TEXT,
  TITLE_LIMIT,
  altText,
  contrast,
  documentTitle,
  fitPage,
  isGarbled,
  isPagePicture,
  linkPieces,
  linkUnderlines,
  placeShapes,
  shapesOver,
  groupTouching,
  around,
  touching,
  pageLines,
  pageTitle,
  paletteTextColor,
  pdfErrorMessage,
  pdfProject,
  pictureAlts,
  pictureDensity,
  pictureFrame,
  pictureRegion,
  planText,
  sortOperations,
  type PdfPage,
  type PdfPiece,
  type TextMetrics,
} from '../src/importer/pdf';
import {
  addPagePicture,
  beginImportFolder,
  discardImportFolder,
  finishImportFolder,
  readProject,
} from '../src/main/projectIo';
import { parseProject, type Asset, type TextElement } from '../src/shared/format/schema';
import { PDF_PAGE_LIMIT_BYTES } from '../src/shared/limits';

describe('fitting a PDF page to the stage', () => {
  it('lets a 16:9 page fill the stage at double resolution', () => {
    expect(fitPage(720, 405)).toEqual({
      box: { x: 0, y: 0, w: 1920, h: 1080, rotation: 0 },
      pixelWidth: 3840,
      pixelHeight: 2160,
    });
    expect(fitPage(1920, 1080).pixelWidth).toBe(3840);
  });

  it('keeps the proportions of other pages and centres them', () => {
    // 4:3 fills the height.
    expect(fitPage(720, 540)).toEqual({
      box: { x: 240, y: 0, w: 1440, h: 1080, rotation: 0 },
      pixelWidth: 2880,
      pixelHeight: 2160,
    });
    // A portrait page.
    expect(fitPage(595, 842)).toEqual({
      box: { x: 578.5, y: 0, w: 763, h: 1080, rotation: 0 },
      pixelWidth: 1526,
      pixelHeight: 2160,
    });
    // A page wider than the stage fills the width.
    expect(fitPage(1000, 250)).toEqual({
      box: { x: 0, y: 300, w: 1920, h: 480, rotation: 0 },
      pixelWidth: 3840,
      pixelHeight: 960,
    });
  });

  it('never makes a picture larger than 3840 x 2160, or without size', () => {
    for (const [w, h] of [
      [1, 1],
      [10000, 3],
      [3, 10000],
      [841.89, 595.28],
      [0.5, 0.25],
    ] as const) {
      const fit = fitPage(w, h);
      expect(fit.pixelWidth).toBeLessThanOrEqual(3840);
      expect(fit.pixelHeight).toBeLessThanOrEqual(2160);
      expect(fit.pixelWidth).toBeGreaterThanOrEqual(1);
      expect(fit.pixelHeight).toBeGreaterThanOrEqual(1);
      expect(fit.box.w).toBe(fit.pixelWidth / 2);
      expect(fit.box.x + fit.box.w / 2).toBeCloseTo(960);
      expect(fit.box.y + fit.box.h / 2).toBeCloseTo(540);
    }
    expect(() => fitPage(0, 100)).toThrow();
    expect(() => fitPage(100, Number.NaN)).toThrow();
  });
});

describe('the text of a PDF page', () => {
  const item = (str: string, hasEOL = false) => ({ str, hasEOL });

  it('joins the pieces into lines, in the order the PDF has them', () => {
    expect(
      pageLines([
        item('Overskrift'),
        item(' '),
        item('A', true),
        item('Punkt'),
        item(' '),
        item('B'),
        item('', true),
        item('  ', true),
        item('Punkt   C  '),
      ]),
    ).toEqual(['Overskrift A', 'Punkt B', 'Punkt C']);
    expect(pageLines([])).toEqual([]);
    expect(pageLines([item(' ', true), item('')])).toEqual([]);
  });

  it('makes the alternative text from the lines, cut at a word when very long', () => {
    expect(altText(['A', 'B'])).toBe('A\nB');
    expect(altText([])).toBe('');
    const long = altText(Array.from({ length: 2000 }, () => 'ord A'));
    expect(long.length).toBeLessThanOrEqual(ALT_LIMIT);
    expect(long.endsWith('…')).toBe(true);
    // Cut between words, not inside one.
    expect(long.slice(0, -1)).toMatch(/(ord|A)$/);
    // One endless word is cut where it must be.
    expect(altText(['x'.repeat(ALT_LIMIT + 50)])).toHaveLength(ALT_LIMIT);
  });

  it('takes the title from the first line, or the page number', () => {
    expect(pageTitle(['Overskrift A', 'Punkt B'], 3)).toBe('Overskrift A');
    expect(pageTitle([], 3)).toBe('Side 3');
    const title = pageTitle(['A '.repeat(100)], 1);
    expect(title.length).toBeLessThanOrEqual(TITLE_LIMIT);
    expect(title.endsWith('…')).toBe(true);
  });

  it('uses the title in the PDF only when it is a real one', () => {
    expect(documentTitle('  Forelesning  A ', 'fil.pdf')).toBe('Forelesning A');
    for (const title of [
      undefined,
      null,
      7,
      '',
      '   ',
      'PowerPoint Presentation',
      'PowerPoint-presentasjon',
      'Untitled',
      'Microsoft PowerPoint - a.pptx',
      'Microsoft Word - a.docx',
      'a.pptx',
      'A.PDF',
    ]) {
      expect(documentTitle(title, '/mappe/Fil A.pdf'), String(title)).toBe('Fil A');
    }
    expect(documentTitle('', 'C:\\mappe\\Fil B.PDF')).toBe('Fil B');
  });

  it('explains in Norwegian why a file cannot be opened', () => {
    expect(pdfErrorMessage({ name: 'PasswordException' })).toContain('beskyttet med passord');
    expect(pdfErrorMessage({ name: 'InvalidPDFException' })).toContain('ikke en PDF som kan leses');
    expect(pdfErrorMessage(new Error('x'))).toBe('PDF-fila kan ikke leses. Den kan være skadet.');
    expect(pdfErrorMessage(undefined)).toBe('PDF-fila kan ikke leses. Den kan være skadet.');
  });
});

/**
 * A font for the tests: every letter is half as wide as the font size, and
 * a bold one a tenth wider. A line reaches 0.9 above and 0.2 below its baseline.
 */
const metrics: TextMetrics = {
  width: (text, face) => text.length * (face.bold ? 0.55 : 0.5),
  ascent: () => 0.9,
  descent: () => 0.2,
};

/** A piece of text set in the test font, black on white, so that it is as wide in the PDF as here. */
const piece = (str: string, x: number, y: number, extra: Partial<PdfPiece> = {}): PdfPiece => {
  const size = extra.size ?? 40;
  const bold = extra.bold ?? false;
  return {
    str,
    x,
    y,
    width: str.length * size * (bold ? 0.55 : 0.5),
    size,
    angle: 0,
    font: 'f1',
    serif: false,
    bold,
    italic: false,
    plain: true,
    hasEOL: false,
    color: '#000000',
    behind: '#ffffff',
    ...extra,
  };
};
const plan = (pieces: PdfPiece[], pageColor = '#ffffff') =>
  planText(pieces, metrics, new FontFit(metrics), pageColor);
const textOf = (element: Omit<TextElement, 'id'>): string[] =>
  element.content.paragraphs.map((p) => p.runs.map((r) => r.text).join(''));

describe('what a PDF page draws', () => {
  // The numbers pdf.js gives its operations do not matter here, only their names.
  const names = [
    'save',
    'restore',
    'transform',
    'constructPath',
    'endPath',
    'fill',
    'clip',
    'showText',
    'paintImageXObject',
    'paintInlineImageXObject',
    'paintImageMaskXObject',
    'paintFormXObjectBegin',
    'paintFormXObjectEnd',
    'beginGroup',
    'endGroup',
    'beginAnnotation',
    'endAnnotation',
    'setTextRenderingMode',
    'setFont',
    'shadingFill',
  ];
  const OPS = Object.fromEntries(names.map((name, i) => [name, i + 1]));
  const sort = (list: Array<[string, ...unknown[]]>) =>
    sortOperations(
      list.map(([name]) => OPS[name]!),
      list.map(([, ...args]) => args),
      OPS,
    );

  it('tells text, pictures and the rest apart, and leaves what only sets things up', () => {
    const sorted = sort([
      ['save'],
      ['clip'],
      ['constructPath', OPS.endPath],
      ['constructPath', OPS.fill],
      ['setFont', 'f1', 12],
      ['showText', []],
      ['transform', 200, 0, 0, 100, 50, 60],
      ['paintImageXObject', 'img_1', 400, 100],
      ['paintImageMaskXObject', {}],
      ['shadingFill', 'p1'],
      ['restore'],
    ]);
    expect([...sorted.kinds]).toEqual([
      OP_SETUP,
      OP_SETUP,
      OP_SETUP,
      OP_OTHER,
      OP_SETUP,
      OP_TEXT,
      OP_SETUP,
      OP_PICTURE,
      OP_OTHER,
      OP_OTHER,
      OP_SETUP,
    ]);
    expect(sorted.entangled).toBe(false);
    expect(sorted.pictures).toEqual([
      { index: 7, matrix: [200, 0, 0, 100, 50, 60], pixelWidth: 400, pixelHeight: 100 },
    ]);
    expect(sorted.paths).toEqual([]);
  });

  it('knows how large the painted shapes are, and finds the lines under links', () => {
    const sorted = sort([
      ['transform', 2, 0, 0, 2, 10, 10],
      // A thin line and a large field, each with its smallest and largest x and y.
      ['constructPath', OPS.fill, [], [100, 50, 180, 51]],
      ['constructPath', OPS.fill, [], [0, 0, 400, 200]],
      ['constructPath', OPS.endPath, [], [0, 0, 400, 200]],
    ]);
    expect(sorted.paths).toEqual([
      { index: 1, bounds: [210, 110, 370, 112], outline: false },
      { index: 2, bounds: [10, 10, 810, 410], outline: false },
    ]);
    // On a page 540 high at one stage pixel a point, y turned: the line lies at y = 428 to 430.
    const toStage = [1, 0, 0, -1, 0, 540] as [number, number, number, number, number, number];
    const shapes = placeShapes(sorted.paths, toStage);
    expect(shapes).toEqual([
      { index: 1, box: { x: 210, y: 428, w: 160, h: 2 }, outline: false },
      { index: 2, box: { x: 10, y: 130, w: 800, h: 400 }, outline: false },
    ]);
    const link = { x: 205, y: 400, w: 170, h: 34 };
    expect(linkUnderlines(shapes, [link])).toEqual([1]);
    // Not under a link that lies elsewhere, and not without links.
    expect(linkUnderlines(shapes, [{ ...link, y: 100 }])).toEqual([]);
    expect(linkUnderlines(shapes, [])).toEqual([]);
  });

  it('finds the shapes painted on top of a picture, with what belongs to them', () => {
    const shape = (index: number, x: number, y: number, w: number, h: number, outline = false) => ({
      index,
      box: { x, y, w, h },
      outline,
    });
    const picture = { x: 100, y: 100, w: 400, h: 300 };
    const shapes = [
      // Painted before the picture: under it.
      shape(1, 150, 150, 50, 50),
      // A sign that reaches into the picture, its edge, and the line from it to a word outside.
      shape(6, 450, 80, 120, 60),
      shape(7, 450, 80, 120, 60),
      shape(8, 570, 110, 80, 2),
      // The top of a frame around the picture, a frame drawn in one go, and something far away.
      shape(9, 98, 98, 404, 4),
      shape(10, 900, 900, 50, 50),
      shape(11, 98, 98, 404, 304, true),
    ];
    expect(shapesOver(shapes, 5, picture, 6)).toEqual([6, 7, 8]);
    // A sign that only reaches the rim of the picture, but lies on the sign that is on it, comes too.
    expect(shapesOver([...shapes, shape(13, 440, 60, 65, 45)], 5, picture, 6)).toEqual([
      6, 7, 8, 13,
    ]);
    expect(shapesOver([...shapes, shape(13, 60, 150, 44, 45)], 5, picture, 6)).toEqual([6, 7, 8]);
    // Nothing lies on a picture that is painted last, or one that stands elsewhere.
    expect(shapesOver(shapes, 11, picture, 6)).toEqual([]);
    // A field that is filled covers the picture; the same shape as an outline goes round it.
    expect(shapesOver([shape(12, 98, 98, 404, 304)], 5, picture, 6)).toEqual([12]);
    expect(shapesOver(shapes, 5, { x: 100, y: 500, w: 100, h: 100 }, 6)).toEqual([]);
    // Things that touch, directly or through others, are one group.
    const groups = groupTouching([shapes[1]!, shapes[5]!, shapes[3]!, shapes[2]!]);
    expect(groups.map((group) => group.map((member) => member.index))).toEqual([[6, 8, 7], [10]]);
    expect(around(groups[0]!.map((member) => member.box))).toEqual({
      x: 450,
      y: 80,
      w: 200,
      h: 60,
    });
    expect(touching({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 0, w: 5, h: 5 })).toBe(false);
    expect(touching({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 0, w: 5, h: 5 }, 2)).toBe(true);
  });

  it('follows saved and restored transformations, also through forms', () => {
    const sorted = sort([
      ['transform', 2, 0, 0, 2, 10, 10],
      ['save'],
      ['transform', 1, 0, 0, 1, 5, 0],
      ['paintFormXObjectBegin', [10, 0, 0, 10, 0, 0], null],
      ['paintInlineImageXObject', { width: 8, height: 4 }],
      ['paintFormXObjectEnd'],
      ['restore'],
      ['paintImageXObject', 'img_1', 1, 1],
      ['restore'],
      ['paintImageXObject', 'img_2', 1, 1],
    ]);
    expect(sorted.pictures.map((p) => p.matrix)).toEqual([
      [20, 0, 0, 20, 20, 10],
      [2, 0, 0, 2, 10, 10],
      [2, 0, 0, 2, 10, 10],
    ]);
    expect(sorted.pictures[0]).toMatchObject({ pixelWidth: 8, pixelHeight: 4 });
  });

  it('leaves masks whole, and keeps what notes and groups draw with the rest', () => {
    const sorted = sort([
      ['beginGroup', { smask: { subtype: 'Alpha' } }],
      ['constructPath', OPS.fill],
      ['showText', []],
      ['paintImageXObject', 'img_1', 1, 1],
      ['endGroup', {}],
      ['beginGroup', { isolated: true }],
      ['paintImageXObject', 'img_2', 1, 1],
      ['showText', []],
      ['endGroup', {}],
      ['beginAnnotation', 'a1'],
      ['showText', []],
      ['paintImageXObject', 'img_3', 1, 1],
      ['endAnnotation'],
    ]);
    expect([...sorted.kinds]).toEqual([
      OP_SETUP,
      OP_SETUP,
      OP_SETUP,
      OP_SETUP,
      OP_SETUP,
      OP_SETUP,
      OP_OTHER,
      OP_TEXT,
      OP_SETUP,
      OP_SETUP,
      OP_OTHER,
      OP_OTHER,
      OP_SETUP,
    ]);
    expect(sorted.pictures).toEqual([]);
  });

  it('says when a page cannot be taken apart safely', () => {
    // A shape that is painted and used as a cutting shape in one go.
    expect(sort([['clip'], ['constructPath', OPS.fill]]).entangled).toBe(true);
    // Letters used as a cutting shape.
    expect(
      sort([
        ['setTextRenderingMode', 7],
        ['showText', []],
      ]).entangled,
    ).toBe(true);
    expect(
      sort([
        ['setTextRenderingMode', 3],
        ['showText', []],
      ]).entangled,
    ).toBe(false);
  });

  it('places a picture on the stage, with no more pixels than the PDF holds or the stage shows', () => {
    // A page of 960 x 540 points on the stage: 2 stage pixels a point, y turned.
    const toStage = [2, 0, 0, -2, 0, 1080] as [number, number, number, number, number, number];
    const picture = {
      index: 0,
      matrix: [200, 0, 0, 100, 50, 60],
      pixelWidth: 400,
      pixelHeight: 100,
    };
    const frame = pictureFrame(picture as never, toStage);
    expect(frame.box).toEqual({ x: 100, y: 760, w: 400, h: 200 });
    // 400 pixels over 400 stage pixels, 100 over 200: the denser direction counts.
    expect(frame.density).toBe(1);
    expect(pictureDensity(frame)).toBe(1);
    expect(pictureDensity({ ...frame, density: 7 })).toBe(2);
    expect(pictureDensity({ ...frame, density: 0.01 })).toBe(0.25);
    const page = { x: 0, y: 0, w: 1920, h: 1080 };
    expect(pictureRegion(frame, page)).toEqual(frame.box);
    // The part on the page counts; a sliver or a dot is not worth an element.
    expect(pictureRegion({ ...frame, box: { x: -300, y: 760, w: 400, h: 200 } }, page)).toEqual({
      x: 0,
      y: 760,
      w: 100,
      h: 200,
    });
    expect(pictureRegion({ ...frame, box: { x: 5, y: 5, w: 8, h: 300 } }, page)).toBeUndefined();
    expect(
      pictureRegion({ ...frame, box: { x: 2000, y: 5, w: 80, h: 300 } }, page),
    ).toBeUndefined();
    // A picture that is turned gets the upright rectangle around it.
    const turned = pictureFrame(
      { ...picture, matrix: [0, 100, -100, 0, 300, 100] } as never,
      toStage,
    );
    expect(turned.box).toEqual({ x: 400, y: 680, w: 200, h: 200 });
  });
});

describe('the text of a PDF page as text elements', () => {
  it('makes one element of a line, standing where the line stood', () => {
    const result = plan([
      piece('Overskrift', 100, 200),
      piece(' ', 300, 200),
      piece('A', 320, 200),
    ]);
    expect(result.lines).toEqual(['Overskrift A']);
    expect(result.surface).toBe('hvit');
    expect(result.kept).toEqual([]);
    expect(result.texts).toHaveLength(1);
    const [text] = result.texts;
    expect(text).toMatchObject({
      type: 'text',
      role: 'body',
      fontSize: 40,
      lineHeight: 1.2,
      align: 'left',
      valign: 'top',
      content: { paragraphs: [{ level: 0, list: 'none', runs: [{ text: 'Overskrift A' }] }] },
    });
    expect(text!.color).toBeUndefined();
    // The baseline is where it was: the line is 48 high, and the font reaches 36 above it
    // and 8 below, so the baseline lies 2 + 36 under the top of the box.
    expect(text!.box.x).toBe(100);
    expect(text!.box.y).toBeCloseTo(200 - 38);
    expect(text!.box.h).toBeCloseTo(48);
    // Wide enough for the line in the program's font, and a little more.
    expect(text!.box.w).toBeGreaterThan(12 * 20);
    expect(text!.box.w).toBeLessThan(12 * 20 + 5);
  });

  it('joins lines of a paragraph, and keeps the breaks the PDF had', () => {
    // Three lines 48 apart. The first is full: the next word has no room,
    // so the line breaks there by itself. The second ends early.
    const result = plan([
      piece('A A A A A A A A A A', 100, 200),
      piece('B B B', 100, 248),
      piece('C C C C C', 100, 296),
    ]);
    expect(result.texts).toHaveLength(1);
    const [text] = result.texts;
    expect(textOf(text!)).toEqual(['A A A A A A A A A A B B B\nC C C C C']);
    expect(text!.lineHeight).toBe(1.2);
    expect(text!.box.h).toBeCloseTo(3 * 48);
    expect(result.lines).toEqual(['A A A A A A A A A A', 'B B B', 'C C C C C']);
  });

  it('keeps a break after a hyphen or the end of a sentence as a break', () => {
    const [hyphen] = plan([
      piece('A A A A A A A A-', 100, 200),
      piece('B B B B B B B B', 100, 248),
    ]).texts;
    expect(textOf(hyphen!)).toEqual(['A A A A A A A A-\nB B B B B B B B']);
    const [colon] = plan([piece('A A A A A A A A:', 100, 200), piece('B B B', 100, 248)]).texts;
    expect(textOf(colon!)).toEqual(['A A A A A A A A:\nB B B']);
  });

  it('makes paragraphs where the distance is larger, with the space the PDF had', () => {
    const result = plan([
      piece('A A A A A A', 100, 200),
      piece('B B B B B B', 100, 248),
      // 30 more than a line.
      piece('C C C C C C', 100, 326),
      piece('D D D D D D', 100, 404),
    ]);
    expect(result.texts).toHaveLength(1);
    const [text] = result.texts;
    expect(text!.content.paragraphs).toHaveLength(3);
    expect(text!.spaceBefore).toEqual([0.75, 0, 0, 0, 0]);
    expect(text!.box.h).toBeCloseTo(4 * 48 + 2 * 30);
  });

  it('divides a block whose paragraphs are not evenly spaced', () => {
    const result = plan([
      piece('A A A A A A', 100, 200),
      piece('B B B B B B', 100, 278),
      piece('C C C C C C', 100, 356),
      // Not the distance the others have.
      piece('D D D D D D', 100, 456),
    ]);
    expect(result.texts.map(textOf)).toEqual([
      ['A A A A A A', 'B B B B B B', 'C C C C C C'],
      ['D D D D D D'],
    ]);
    // Each stands where it stood.
    expect(result.texts[1]!.box.y).toBeCloseTo(456 - 38);
  });

  it('reads bullets as a list, with levels, indents and sizes', () => {
    const result = plan([
      piece('•', 100, 200, { font: 'f2' }),
      piece(' ', 120, 200, { font: 'f2' }),
      piece('A A A A A A A A', 140, 200),
      piece('B B B', 140, 248),
      piece('•', 140, 304, { font: 'f2', size: 32 }),
      piece('C C', 172, 304, { size: 32 }),
      piece('•', 100, 360, { font: 'f2' }),
      piece('D D', 140, 360),
    ]);
    expect(result.texts).toHaveLength(1);
    const [text] = result.texts;
    expect(text!.content.paragraphs).toEqual([
      // The widest line of a box is always full: it runs on into the next.
      { level: 0, list: 'bullet', runs: [{ text: 'A A A A A A A A B B B' }] },
      { level: 1, list: 'bullet', runs: [{ text: 'C C' }] },
      { level: 0, list: 'bullet', runs: [{ text: 'D D' }] },
    ]);
    expect(text!.fontSize).toBe(40);
    expect(text!.levelScale).toEqual([1, 0.8, 0.8, 0.8, 0.8]);
    expect(text!.indent!.slice(0, 2)).toEqual([
      { start: 0, text: 1 },
      { start: 1, text: 1.8 },
    ]);
    expect(text!.box.x).toBe(100);
    // The lines of the list say nothing of the bullets.
    expect(result.lines).toEqual(['A A A A A A A A', 'B B B', 'C C', 'D D']);
  });

  it('takes a dash for a bullet only when it stands apart as in a list', () => {
    const list = plan([piece('–', 100, 200, { font: 'f2' }), piece('A A', 150, 200)]).texts[0]!;
    expect(list.content.paragraphs[0]).toMatchObject({ list: 'bullet', runs: [{ text: 'A A' }] });
    const typed = plan([piece('–', 100, 200), piece(' ', 120, 200), piece('A A', 130, 200)]);
    expect(typed.texts[0]!.content.paragraphs[0]).toMatchObject({
      list: 'none',
      runs: [{ text: '– A A' }],
    });
  });

  it('keeps a heading and the list under it apart, and text in other columns', () => {
    const result = plan([
      piece('Overskrift', 100, 150, { size: 72 }),
      piece('•', 100, 300, { font: 'f2' }),
      piece('A', 140, 300),
      // Far to the right on the same line: another box.
      piece('B', 900, 300),
    ]);
    expect(result.texts.map(textOf)).toEqual([['Overskrift'], ['A'], ['B']]);
    expect(result.texts[2]!.box.x).toBe(900);
  });

  it('carries bold, italics, sub- and superscripts, and makes all-bold text a heading', () => {
    const mixed = plan([
      piece('A', 100, 200),
      piece('B', 120, 200, { bold: true }),
      piece('C', 142, 200, { italic: true }),
      piece('2', 162, 210, { size: 26 }),
      piece('3', 175, 180, { size: 26 }),
    ]).texts[0]!;
    expect(mixed.role).toBe('body');
    expect(mixed.content.paragraphs[0]!.runs).toEqual([
      { text: 'A' },
      { text: 'B', bold: true },
      { text: 'C', italic: true },
      { text: '2', script: 'sub' },
      { text: '3', script: 'super' },
    ]);
    const heading = plan([piece('Overskrift', 100, 200, { bold: true })]).texts[0]!;
    expect(heading.role).toBe('heading');
    expect(heading.content.paragraphs[0]!.runs).toEqual([{ text: 'Overskrift' }]);
    // Serif text is set in the program's serif font.
    expect(plan([piece('Overskrift', 100, 200, { serif: true })]).texts[0]!.role).toBe('title');
  });

  it('lines centred and right-aligned text up as it was', () => {
    const centred = plan([piece('A A A A A A', 400, 200), piece('B B', 480, 248)]).texts;
    expect(centred).toHaveLength(1);
    expect(centred[0]!.align).toBe('center');
    // Both lines have their middle at 510.
    expect(centred[0]!.box.x + centred[0]!.box.w / 2).toBeCloseTo(510);
    const right = plan([piece('A A A A A A', 400, 200), piece('B B', 560, 248)]).texts;
    expect(right).toHaveLength(1);
    expect(right[0]!.align).toBe('right');
    expect(right[0]!.box.x + right[0]!.box.w).toBeCloseTo(620);
  });

  it('sets text smaller when the program’s font is wider than the PDF’s, never larger', () => {
    // In the PDF every letter of f1 is 0.45 of the size; the program's is 0.5.
    const narrow = new FontFit(metrics);
    narrow.learn({ font: 'f1', serif: false, text: 'A'.repeat(40), width: 40 * 0.45 });
    narrow.learn({ font: 'f3', serif: false, text: 'A'.repeat(40), width: 40 * 0.6 });
    expect(narrow.factor('f1', { serif: false, bold: false, italic: false })).toBe(0.9);
    expect(narrow.factor('f3', { serif: false, bold: false, italic: false })).toBe(1);
    // A font with too little text follows the others of its kind.
    narrow.learn({ font: 'f4', serif: false, text: 'AAAA', width: 4 * 0.3 });
    expect(narrow.factor('f4', { serif: false, bold: false, italic: false })).toBeGreaterThan(0.7);
    const pieces = [
      piece('A A A A A A A A', 100, 200, { width: 15 * 40 * 0.45 }),
      piece('B B B B B B B B', 100, 248, { width: 15 * 40 * 0.45 }),
    ];
    const [text] = planText(pieces, metrics, narrow).texts;
    expect(text!.fontSize).toBe(36);
    // The lines keep their distance of 48 and their place.
    expect(text!.lineHeight).toBeCloseTo(48 / 36, 3);
    expect(text!.box.h).toBeCloseTo(96);
    expect(text!.box.y).toBeCloseTo(200 - (36 * (48 / 36 + 0.9 - 0.2)) / 2);
    // No line is wider than it was.
    expect(text!.box.w).toBeLessThan(15 * 40 * 0.45 + 5);
  });

  it('leaves out text that does not show, and text too small to read', () => {
    const result = plan([
      piece('A', 100, 200),
      piece('Usynlig', 100, 300, { color: undefined }),
      piece('Bildetekst B', 500, 500, { size: 2.4, color: undefined }),
    ]);
    expect(result.texts.map(textOf)).toEqual([['A']]);
    expect(result.lines).toEqual(['A']);
    expect(result.tiny).toEqual([{ x: 500, y: 500, text: 'Bildetekst B' }]);
  });

  it('sets turned text as a turned text element, where it stood', () => {
    // Running upwards from (300, 600): turned a quarter anticlockwise.
    const result = plan([piece('A', 100, 100), piece('På skrå', 300, 600, { angle: -90 })]);
    expect(result.texts.map(textOf)).toEqual([['A'], ['På skrå']]);
    expect(result.lines).toEqual(['A', 'På skrå']);
    const { box } = result.texts[1]!;
    expect(box.rotation).toBe(-90);
    // Lying flat the box would be 143 wide and 48 high, with the baseline 38 under its top.
    expect(box.h).toBeCloseTo(48);
    // Turned about its middle, the baseline is the upright line x = 300, and the text ends at y = 600.
    const middle = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    expect(middle.x - box.h / 2 + 38).toBeCloseTo(300);
    expect(middle.y + box.w / 2).toBeCloseTo(600);
    expect(result.kept).toEqual([]);
  });

  it('keeps formulas, unreadable characters and vertical writing in the picture of the page', () => {
    const result = plan([
      piece('A', 100, 100),
      piece('\u{1D439} = \u{1D45A}\u{1D44E}', 100, 300, { font: 'math' }),
      piece('B ', 100, 500),
      piece('Loddrett', 900, 500, { plain: false }),
    ]);
    expect(result.texts.map(textOf)).toEqual([['A']]);
    expect(result.kept.map((k) => [k.why, k.text])).toEqual([
      ['not-plain', 'Loddrett'],
      ['formula', 'F = ma'],
      ['unreadable', 'B '],
    ]);
  });

  it('sets letters of a formula in running text as ordinary letters in italics', () => {
    const [text] = plan([
      piece('\u{1D442}', 100, 200, { font: 'math', width: 20 }),
      piece('2', 120, 208, { font: 'math', size: 26 }),
      piece(' ', 133, 200),
      piece('og A', 143, 200),
    ]).texts;
    expect(text!.content.paragraphs[0]!.runs).toEqual([
      { text: 'O', italic: true },
      { text: '2', script: 'sub' },
      { text: ' og A' },
    ]);
  });

  it('does not take the top of a fraction for a superscript', () => {
    // Small text above the line, but after a space: it does not belong to the word before it.
    const result = plan([
      piece('A er', 100, 200),
      piece(' ', 180, 200),
      piece('3', 200, 185, { font: 'math', size: 26 }),
      piece('\u{1D45B}', 200, 215, { font: 'math', size: 26, width: 13 }),
    ]);
    expect(result.texts.map(textOf)).toEqual([['A er']]);
    // The fraction is a formula, and stays whole in the picture.
    expect(result.kept.map((k) => [k.why, k.text])).toEqual([['formula', '3\nn']]);
  });

  it('knows text that cannot be trusted', () => {
    expect(isGarbled([piece('���� abc�', 0, 0)])).toBe(true);
    expect(isGarbled([piece('• Punkt A og punkt B', 0, 0), piece('', 0, 40)])).toBe(false);
    expect(isGarbled([])).toBe(false);
  });
});

describe('the colours of text from a PDF', () => {
  it('gives text the colour of the palette it had, when the surface allows it', () => {
    const [text] = plan([piece('A A A A', 100, 200, { color: '#2f0b63' })]).texts;
    expect(text!.color).toBe('indigo');
    // Black on a white page is what text has anyway.
    expect(
      plan([piece('A A A A', 100, 200, { color: '#242424' })]).texts[0]!.color,
    ).toBeUndefined();
  });

  it('chooses a dark surface for a page with white text, so the text can stay white', () => {
    const result = plan(
      [piece('A A A A', 100, 200, { color: '#ffffff', behind: '#d9d0ff', size: 80 })],
      '#d9d0ff',
    );
    expect(['lilla', 'mediumLilla', 'indigo']).toContain(result.surface);
    expect(result.texts).toHaveLength(1);
    // White: said outright, or what text has on that surface anyway.
    expect([undefined, 'hvit']).toContain(result.texts[0]!.color);
    if (result.texts[0]!.color === undefined) expect(result.surface).not.toBe('mediumLilla');
    expect(result.kept).toEqual([]);
    expect(result.recoloured).toBe(false);
    // A page that does not cover the stage keeps a surface like itself; the text then turns dark.
    const narrow = planText(
      [piece('A A A A', 100, 200, { color: '#ffffff', behind: '#d9d0ff', size: 80 })],
      metrics,
      new FontFit(metrics),
      '#d9d0ff',
      false,
    );
    expect(['lysLilla', 'lysIndigo', 'hvit']).toContain(narrow.surface);
  });

  it('keeps text in the picture when it would not show in a colour it can get', () => {
    // Mostly black text on white, and a white label on a dark sign.
    const result = plan([
      piece('A A A A A A A A A A A A', 100, 200),
      piece('B', 900, 500, { color: '#ffffff', behind: '#2f0b63' }),
    ]);
    expect(result.surface).toBe('hvit');
    expect(result.texts.map(textOf)).toEqual([['A A A A A A A A A A A A']]);
    expect(result.kept).toEqual([
      { area: { x: 900, y: 460, w: 20, h: 52 }, text: 'B', why: 'color' },
    ]);
    expect(result.recoloured).toBe(false);
  });

  it('keeps a label on a coloured field as it was, and sets other text in a colour it can have', () => {
    // White on pink would become black on pink: it stays in the picture.
    const label = plan([
      piece('A A A A A A A A A A A A', 100, 200),
      piece('B', 900, 500, { color: '#ffffff', behind: '#ef7dbb' }),
    ]);
    expect(label.kept.map((k) => k.why)).toEqual(['color']);
    // Green on the page's own white becomes black, and the owner is told.
    const green = plan([piece('A A A A', 100, 200, { color: '#00b050' })]);
    expect(green.texts).toHaveLength(1);
    expect(green.texts[0]!.color).toBeUndefined();
    expect(green.kept).toEqual([]);
    expect(green.recoloured).toBe(true);
  });

  it('maps colours to the palette, greys to black and white', () => {
    expect(paletteTextColor('#333333')).toEqual({ color: 'sort', exact: true });
    expect(paletteTextColor('#f2f2f2')).toEqual({ color: 'hvit', exact: true });
    expect(paletteTextColor('#7800f0')).toEqual({ color: 'lilla', exact: true });
    expect(paletteTextColor('#ff0000')).toEqual({ color: 'oransje', exact: true });
    expect(paletteTextColor('#00b050')).toEqual({ color: 'sort', exact: false });
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrast('#ffffff', '#ffffff')).toBe(1);
  });
});

describe('links on a PDF page', () => {
  it('lays a link on the words it covers, and nothing else', () => {
    const pieces = [piece('Les mer om A her', 100, 200)];
    // Letters are 20 wide: "om A" starts at 260 and ends at 340.
    const { pieces: linked, loose } = linkPieces(
      pieces,
      [{ rect: { x: 258, y: 165, w: 84, h: 45 }, target: 'https://example.org/a' }],
      metrics,
    );
    expect(loose).toEqual([]);
    expect(linked.map((p) => [p.str, p.x, p.width, p.link])).toEqual([
      ['Les mer ', 100, 160, undefined],
      ['om A', 260, 80, 'https://example.org/a'],
      [' her', 340, 80, undefined],
    ]);
    const [text] = plan(linked).texts;
    expect(text!.content.paragraphs[0]!.runs).toEqual([
      { text: 'Les mer ' },
      { text: 'om A', link: 'https://example.org/a' },
      { text: ' her' },
    ]);
  });

  it('hands back links that lie on no text', () => {
    const { pieces: linked, loose } = linkPieces(
      [piece('A', 100, 200)],
      [
        { rect: { x: 600, y: 600, w: 300, h: 200 }, target: 'https://example.org/b' },
        { rect: { x: 90, y: 160, w: 40, h: 50 } },
      ],
      metrics,
    );
    expect(loose).toEqual([
      { rect: { x: 600, y: 600, w: 300, h: 200 }, target: 'https://example.org/b' },
    ]);
    // A link that leads nowhere lies on the text, and the text is left as it is.
    expect(linked.map((p) => p.link)).toEqual([undefined]);
  });

  it('finds the alternative texts PowerPoint wrote at its pictures', () => {
    const boxes = [
      { x: 100, y: 100, w: 800, h: 600 },
      { x: 300, y: 300, w: 200, h: 100 },
      { x: 1000, y: 100, w: 200, h: 100 },
    ];
    expect(
      pictureAlts(boxes, [
        { x: 100, y: 102, text: 'Et bilde av A' },
        { x: 100, y: 105, text: 'Automatisk generert beskrivelse' },
        { x: 300, y: 302, text: 'B' },
        { x: 1500, y: 900, text: 'C' },
      ]),
    ).toEqual(['Et bilde av A', 'B', '']);
  });
});

describe('a PDF as a project', () => {
  const asset = (n: number): Asset => ({
    kind: 'image',
    file: `media/${String(n).repeat(16)}.webp`,
    mime: 'image/webp',
    bytes: 10,
    name: `Fil A – side ${n}.webp`,
  });
  const stored = (n: number) => ({ assetId: `a_${n}`, asset: asset(n) });
  const text = (
    line: string,
    extra: Partial<Omit<TextElement, 'id'>> = {},
  ): Omit<TextElement, 'id'> => ({
    type: 'text',
    role: 'body',
    content: { paragraphs: [{ level: 0, list: 'none', runs: [{ text: line }] }] },
    fontSize: 40,
    align: 'left',
    valign: 'top',
    box: { x: 100, y: 100, w: 300, h: 48, rotation: 0 },
    ...extra,
  });
  const pages: PdfPage[] = [
    {
      number: 1,
      fit: fitPage(720, 405),
      lines: ['A', 'B'],
      whole: { ...stored(1), why: 'entangled' },
    },
    { number: 2, fit: fitPage(595, 842), lines: [], whole: { ...stored(2), why: 'no-text' } },
    {
      number: 3,
      fit: fitPage(720, 405),
      lines: ['Overskrift', 'A'],
      surface: 'lilla',
      background: stored(3),
      pictures: [
        { ...stored(4), box: { x: 200.123, y: 300, w: 400, h: 300 }, alt: 'Et bilde av A' },
      ],
      texts: [
        text('Overskrift'),
        {
          ...text('A'),
          content: {
            paragraphs: [
              {
                level: 0,
                list: 'none',
                runs: [
                  { text: 'A', link: '#page:1' },
                  { text: 'B', link: '#page:9' },
                  { text: 'C', link: 'https://example.org/c' },
                ],
              },
            ],
          },
        },
      ],
      looseLinks: ['https://example.org/d', 'https://example.org/d', '#page:2', undefined],
    },
  ];

  it('makes a scene of a page with its text and pictures as elements, back to front', () => {
    const project = pdfProject('Fil A', pages);
    expect(parseProject(project)).toEqual(project);
    expect(project.meta.title).toBe('Fil A');
    expect(project.assets).toEqual({ a_1: asset(1), a_2: asset(2), a_3: asset(3), a_4: asset(4) });
    expect(project.scenes).toHaveLength(3);
    const third = project.scenes[2]!;
    expect(third).toMatchObject({
      title: 'Overskrift',
      kind: 'content',
      background: 'lilla',
      showLogo: false,
      decoration: false,
      timeline: [],
      script: '',
    });
    expect(third.elements.map((e) => e.type)).toEqual(['image', 'image', 'text', 'text']);
    // The rest of the page lies behind everything, and says nothing to a screen reader.
    expect(third.elements[0]).toEqual({
      id: expect.stringMatching(/^e_/),
      type: 'image',
      asset: 'a_3',
      alt: '',
      decorative: true,
      box: { x: 0, y: 0, w: 1920, h: 1080, rotation: 0 },
    });
    expect(third.elements[1]).toEqual({
      id: expect.stringMatching(/^e_/),
      type: 'image',
      asset: 'a_4',
      alt: 'Et bilde av A',
      box: { x: 200.12, y: 300, w: 400, h: 300, rotation: 0 },
    });
    expect(third.elements[2]).toMatchObject({ type: 'text', role: 'body', fontSize: 40 });
    expect(new Set(third.elements.map((e) => e.id)).size).toBe(4);
    expect(isPagePicture(third)).toBe(false);
  });

  it('turns links between pages into links between scenes, and tells of links it could not keep', () => {
    const project = pdfProject('Fil A', pages);
    const third = project.scenes[2]!;
    const linked = third.elements[3]!;
    if (linked.type !== 'text') throw new Error('not text');
    expect(linked.content.paragraphs[0]!.runs).toEqual([
      { text: 'A', link: `#scene:${project.scenes[0]!.id}` },
      // There is no page 9.
      { text: 'B' },
      { text: 'C', link: 'https://example.org/c' },
    ]);
    expect(third.imported).toEqual({
      slide: 3,
      warnings: [
        {
          code: 'other',
          message: 'En lenke som ikke lå på tekst, følger ikke med: https://example.org/d',
        },
        { code: 'other', message: 'En lenke til et annet sted i PDF-fila følger ikke med.' },
      ],
    });
  });

  it('lets the background speak for text that stays in it, and says why it stays', () => {
    const page: PdfPage = {
      number: 1,
      fit: fitPage(720, 405),
      lines: ['A'],
      surface: 'hvit',
      background: stored(1),
      texts: [text('A')],
      kept: [
        { area: { x: 0, y: 0, w: 10, h: 10 }, text: 'F = ma', why: 'formula' },
        { area: { x: 0, y: 0, w: 10, h: 10 }, text: 'På  skrå', why: 'not-plain' },
      ],
      recoloured: true,
    };
    const scene = pdfProject('Fil A', [page]).scenes[0]!;
    expect(scene.elements[0]).toMatchObject({ type: 'image', alt: 'F = ma\nPå skrå' });
    // Text that has a picture of its own is spoken for by that picture, not by the background.
    const apart = pdfProject('Fil A', [
      {
        ...page,
        kept: [{ ...page.kept![0]!, apart: true }],
        pictures: [
          { ...stored(2), box: { x: 0, y: 0, w: 10, h: 10 }, alt: 'F = ma' },
          { ...stored(3), box: { x: 0, y: 0, w: 10, h: 10 }, alt: '', decorative: true },
        ],
      },
    ]).scenes[0]!;
    expect(apart.elements.slice(0, 3)).toMatchObject([
      { type: 'image', alt: '', decorative: true },
      { type: 'image', alt: 'F = ma' },
      { type: 'image', alt: '', decorative: true },
    ]);
    expect(apart.elements[1]).not.toHaveProperty('decorative');
    expect(scene.elements[0]).not.toHaveProperty('decorative');
    expect(scene.imported!.warnings.map((w) => w.code)).toEqual(['text', 'text', 'text']);
    expect(scene.imported!.warnings[0]!.message).toContain('formler');
    expect(scene.imported!.warnings[1]!.message).toContain('loddrett');
    expect(scene.imported!.warnings[2]!.message).toContain('annen farge');
  });

  it('adds no background to a page that has nothing but its text and pictures', () => {
    const scene = pdfProject('Fil A', [
      { number: 1, fit: fitPage(720, 405), lines: ['A'], surface: 'hvit', texts: [text('A')] },
    ]).scenes[0]!;
    expect(scene.elements.map((e) => e.type)).toEqual(['text']);
    expect(scene.imported).toEqual({ slide: 1, warnings: [] });
  });

  it('keeps a page that cannot be taken apart as one picture, with its text as alternative text', () => {
    const [first, second] = pdfProject('Fil A', pages).scenes;
    expect(first).toMatchObject({ title: 'A', background: 'hvit' });
    expect(first!.elements).toEqual([
      {
        id: expect.stringMatching(/^e_/),
        type: 'image',
        asset: 'a_1',
        alt: 'A\nB',
        box: { x: 0, y: 0, w: 1920, h: 1080, rotation: 0 },
      },
    ]);
    expect(first!.imported?.warnings).toEqual([
      { code: 'text', message: expect.stringContaining('ikke kan tas ut hver for seg') },
    ]);
    expect(isPagePicture(first!)).toBe(true);
    // A page without text gets its page number as title, and a note to write the text.
    expect(second!.title).toBe('Side 2');
    expect(second!.elements[0]).toMatchObject({ type: 'image', alt: '' });
    expect(second!.imported?.warnings).toEqual([
      { code: 'text', message: expect.stringContaining('ingen tekst') },
    ]);
    // Text that cannot be read out is not handed on as alternative text.
    const garbled = pdfProject('Fil A', [
      { number: 4, fit: fitPage(720, 405), lines: ['��'], whole: { ...stored(1), why: 'garbled' } },
    ]).scenes[0]!;
    expect(garbled.title).toBe('Side 4');
    expect(garbled.elements[0]).toMatchObject({ alt: '' });
    expect(garbled.imported?.warnings[0]!.message).toContain('kan ikke leses ut');
  });
});

describe('the folder a PDF is imported into', () => {
  let work: string;
  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), 'lysark-pdfio-'));
  });
  afterEach(() => {
    rmSync(work, { recursive: true, force: true });
  });

  /** The smallest thing that says it is a WebP file. */
  const webp = (fill: number, length = 64): Uint8Array => {
    const data = new Uint8Array(length).fill(fill);
    data.set(Buffer.from('RIFF'), 0);
    data.set(Buffer.from('WEBP'), 8);
    return data;
  };

  it('stores page pictures under names made from their content, and only WebP', () => {
    const folder = beginImportFolder(join(work, 'Ny'));
    const added = addPagePicture(folder, webp(1), 'Fil A – side 1.webp');
    expect(added.asset).toMatchObject({
      kind: 'image',
      mime: 'image/webp',
      bytes: 64,
      name: 'Fil A – side 1.webp',
    });
    expect(added.asset.file).toMatch(/^media\/[0-9a-f]{16}\.webp$/);
    expect(existsSync(join(work, 'Ny', added.asset.file))).toBe(true);
    // Two pages that look the same share one file.
    expect(addPagePicture(folder, webp(1), 'Fil A – side 2.webp').asset.file).toBe(
      added.asset.file,
    );

    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0]);
    expect(() => addPagePicture(folder, png, 'x.webp')).toThrow('Bildet av siden kan ikke lagres.');
    expect(() => addPagePicture(folder, new Uint8Array(4), 'x.webp')).toThrow();
    expect(() => addPagePicture(folder, webp(2, PDF_PAGE_LIMIT_BYTES + 1), 'x.webp')).toThrow();
    expect(readdirSync(join(work, 'Ny', 'media'))).toHaveLength(1);
  });

  it('writes the project last, and only a project that can be opened again', () => {
    const dir = join(work, 'Ny');
    const folder = beginImportFolder(dir);
    expect(existsSync(join(dir, 'prosjekt.json'))).toBe(false);
    const added = addPagePicture(folder, webp(1), 'Fil A – side 1.webp');
    const page: PdfPage = {
      number: 1,
      fit: fitPage(720, 405),
      lines: ['A'],
      whole: { assetId: added.id, asset: added.asset, why: 'entangled' },
    };
    const project = pdfProject('Fil A', [page]);
    expect(() => finishImportFolder(folder, { ...project, scenes: 'x' } as never)).toThrow();
    expect(existsSync(join(dir, 'prosjekt.json'))).toBe(false);
    finishImportFolder(folder, project);
    expect(readProject(dir)).toEqual(project);
  });

  it('takes away what a dropped import has written, and nothing else', () => {
    const dir = join(work, 'Ny');
    const folder = beginImportFolder(dir);
    addPagePicture(folder, webp(1), 'a.webp');
    addPagePicture(folder, webp(2), 'b.webp');
    discardImportFolder(folder);
    expect(existsSync(dir)).toBe(false);

    // A folder that was there before, empty, is left as it was.
    const empty = join(work, 'Tom');
    mkdirSync(empty);
    const second = beginImportFolder(empty);
    addPagePicture(second, webp(1), 'a.webp');
    discardImportFolder(second);
    expect(existsSync(empty)).toBe(true);
    expect(readdirSync(empty)).toEqual([]);

    // Something that appeared in the folder meanwhile is not touched.
    const third = beginImportFolder(join(work, 'Med annet'));
    addPagePicture(third, webp(1), 'a.webp');
    writeFileSync(join(work, 'Med annet', 'notat.txt'), 'A');
    discardImportFolder(third);
    expect(readdirSync(join(work, 'Med annet'))).toEqual(['notat.txt']);
  });

  it('never starts an import on top of existing files', () => {
    const dir = join(work, 'Opptatt');
    mkdirSync(dir);
    writeFileSync(join(dir, 'fil.txt'), 'A');
    expect(() => beginImportFolder(dir)).toThrow(/ikke tom/);
    expect(readdirSync(dir)).toEqual(['fil.txt']);
  });
});
