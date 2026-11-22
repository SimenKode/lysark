// Draws the pages of a PDF with pdf.js (Apache-2.0) and turns them into a
// project: one scene per page, with the page as a picture. This file is
// only loaded when the owner imports a PDF.
//
// Everything pdf.js needs comes from the program's own files: its worker,
// and the two decoders for picture formats the browser engine cannot read
// itself (JPEG 2000 and JBIG2, both common in scanned PDFs). The font and
// character-map folders that come with pdf.js are not taken along (see
// docs/stakk.md), so a font that is not embedded in the PDF is drawn with a
// font from the machine instead.
import { GlobalWorkerOptions, VerbosityLevel, getDocument } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import jbig2Url from 'pdfjs-dist/wasm/jbig2.wasm?url';
import openJpegUrl from 'pdfjs-dist/wasm/openjpeg.wasm?url';
import type { AddedMedia } from '../../shared/api';
import type { Project } from '../../shared/format/schema';
import {
  documentTitle,
  fitPage,
  pageLines,
  pdfErrorMessage,
  pdfProject,
  type PdfPage,
  type PdfTextItem,
} from '../../importer/pdf';

/**
 * Page pictures are stored as WebP at high quality, not without loss.
 * Every picture ends up inside the exported HTML file, so size matters.
 * Measured on 16:9 pages drawn at 3840 x 2160: a page of bullet points is
 * about 0.13 MB like this and 0.8 MB as lossless WebP; a page filled by a
 * photograph is about 0.65 MB like this and 4 MB as lossless WebP. At
 * double resolution text and lines still have clean edges at this quality.
 * The browser engine writes WebP itself, so no library is needed.
 */
const PICTURE_TYPE = 'image/webp';
const PICTURE_QUALITY = 0.9;

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
  /** Called before each page is drawn. */
  progress(page: number, pages: number): void;
  /** Stores the picture of a page and describes it as an asset. */
  store(page: number, data: Uint8Array): Promise<AddedMedia>;
}

function picture(canvas: HTMLCanvasElement): Promise<Uint8Array> {
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
      PICTURE_QUALITY,
    );
  });
}

/**
 * Reads a PDF and draws every page. Resolves to the finished project, or to
 * null when `begin` said no. Throws ImportCancelled when the signal fires,
 * and an Error with a readable message when the file cannot be read.
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
    // Pages are drawn here, one at a time, into one canvas.
    disableWorkerRendering: true,
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
    const canvas = document.createElement('canvas');
    const pages: PdfPage[] = [];
    for (let number = 1; number <= doc.numPages; number++) {
      stopIfCancelled();
      steps.progress(number, doc.numPages);
      const page = await doc.getPage(number);
      // The viewport takes the page's own rotation into account.
      const size = page.getViewport({ scale: 1 });
      const fit = fitPage(size.width, size.height);
      canvas.width = fit.pixelWidth;
      canvas.height = fit.pixelHeight;
      try {
        // "print" draws the page as it is meant to look on paper, and, what
        // matters here, without waiting for the screen to ask for a new
        // frame: a window that is hidden or minimised never asks.
        await page.render({
          canvas,
          viewport: page.getViewport({ scale: fit.pixelWidth / size.width }),
          intent: 'print',
          background: '#ffffff',
        }).promise;
      } catch {
        stopIfCancelled();
        throw new Error(`Side ${number} i PDF-fila kan ikke tegnes.`);
      }
      const text = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const item of text.items) {
        if ('str' in item) items.push({ str: item.str, hasEOL: item.hasEOL });
      }
      const bytes = await picture(canvas);
      stopIfCancelled();
      const added = await steps.store(number, bytes);
      pages.push({ number, assetId: added.id, asset: added.asset, fit, lines: pageLines(items) });
      page.cleanup();
    }
    stopIfCancelled();
    return pdfProject(documentTitle(info.Title, steps.name), pages);
  } finally {
    await task.destroy().catch(() => undefined);
  }
}
