// The parts of the PDF import that need no canvas: fitting a page to the
// stage, the page's text as lines, alternative text and title, the scenes,
// and the folder the page pictures are stored in.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ALT_LIMIT,
  TITLE_LIMIT,
  altText,
  documentTitle,
  fitPage,
  pageLines,
  pageTitle,
  pdfErrorMessage,
  pdfProject,
  type PdfPage,
} from '../src/importer/pdf';
import {
  addPagePicture,
  beginImportFolder,
  discardImportFolder,
  finishImportFolder,
  readProject,
} from '../src/main/projectIo';
import { parseProject, type Asset } from '../src/shared/format/schema';
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

describe('a PDF as a project', () => {
  const asset = (n: number): Asset => ({
    kind: 'image',
    file: `media/${String(n).repeat(16)}.webp`,
    mime: 'image/webp',
    bytes: 10,
    name: `Fil A – side ${n}.webp`,
  });
  const pages: PdfPage[] = [
    { number: 1, assetId: 'a_1', asset: asset(1), fit: fitPage(720, 405), lines: ['A', 'B'] },
    { number: 2, assetId: 'a_2', asset: asset(2), fit: fitPage(595, 842), lines: [] },
  ];

  it('makes one scene per page, with the page as a picture and its text as alternative text', () => {
    const project = pdfProject('Fil A', pages);
    expect(parseProject(project)).toEqual(project);
    expect(project.meta.title).toBe('Fil A');
    expect(project.assets).toEqual({ a_1: asset(1), a_2: asset(2) });
    expect(project.scenes).toHaveLength(2);
    const [first, second] = project.scenes;
    expect(first).toMatchObject({
      title: 'A',
      kind: 'content',
      background: 'hvit',
      showLogo: false,
      decoration: false,
      timeline: [],
      script: '',
      imported: { slide: 1, warnings: [] },
    });
    expect(first!.elements).toEqual([
      {
        id: expect.stringMatching(/^e_/),
        type: 'image',
        asset: 'a_1',
        alt: 'A\nB',
        box: { x: 0, y: 0, w: 1920, h: 1080, rotation: 0 },
      },
    ]);
  });

  it('marks a page without text, and gives it its page number as title', () => {
    const second = pdfProject('Fil A', pages).scenes[1]!;
    expect(second.title).toBe('Side 2');
    expect(second.elements[0]).toMatchObject({ type: 'image', alt: '' });
    expect(second.imported?.warnings).toEqual([
      { code: 'text', message: expect.stringContaining('ingen tekst') },
    ]);
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
      assetId: added.id,
      asset: added.asset,
      fit: fitPage(720, 405),
      lines: ['A'],
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
