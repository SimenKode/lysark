// Reads an HTML file exported by Lysark back into a project. The exported
// file carries the whole project as JSON and its media as base64 (see
// src/exporter/html.ts), so nothing has to be guessed.
//
// The file is untrusted input. Nothing in it is run, the project is
// validated like any project file, media get new names made from their own
// content, and a video that lies next to the file is only named here as a
// path of plain folder and file names; the caller decides whether that path
// is inside the HTML file's own folder.
import { createHash } from 'node:crypto';
import { usedAssets } from '../exporter/html';
import { parseProject, type Asset, type Project } from '../shared/format/schema';
import { imageFormat, videoFormat, type ImportedMedia } from './media';

const GENERATOR = 'Lysark';
const DATA_ID = 'lysark-data';
const ASSET_PREFIX = 'ls-asset-';
/**
 * Asset ids are short random names that start with a letter (newId);
 * anything else, "__proto__" included, is not taken along.
 */
const SAFE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

const NOT_LYSARK =
  'Fila er ikke en forelesning eksportert fra Lysark. Bare HTML-filer laget med «Eksporter HTML» kan åpnes.';
const DAMAGED =
  'HTML-fila er laget av Lysark, men innholdet er skadet: prosjektet i fila kan ikke leses.';

/** What a large video next to the HTML file turned out to be. */
export interface SidecarContent {
  /** sha256 of the file's bytes, as hex. */
  hash: string;
  bytes: number;
}

/**
 * Looks up a file next to the HTML file. `path` is folder and file names
 * relative to the HTML file's folder. Returns undefined when it is not there.
 */
export type SidecarReader = (path: string[]) => SidecarContent | undefined;

export interface HtmlImport {
  /** The project, with every asset pointing at its new file in media/. */
  project: Project;
  /** Media that were written into the HTML file itself. */
  media: ImportedMedia[];
  /** Videos to copy from next to the HTML file: where they lie, and their new name. */
  sidecar: Array<{ path: string[]; file: string }>;
  /** What the owner should know, in Norwegian bokmål. */
  notes: string[];
}

interface ScriptElement {
  attrs: Record<string, string>;
  /** Where the element's text starts and ends in the file. */
  start: number;
  end: number;
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

function attributes(text: string): Record<string, string> {
  const out: Record<string, string> = Object.create(null) as Record<string, string>;
  const pattern = /([A-Za-z][-A-Za-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  for (const match of text.matchAll(pattern)) {
    const name = match[1]!.toLowerCase();
    if (!(name in out)) out[name] = unescapeHtml(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return out;
}

/** True when the file says, in its head, that Lysark made it. */
function madeByLysark(html: string): boolean {
  // The mark stands among the first lines, before any style or script.
  const top = html.slice(0, 100_000);
  const end = top.search(/<(?:style|script|body)\b/i);
  const head = end < 0 ? top : top.slice(0, end);
  for (const match of head.matchAll(/<meta\b([^>]{0,2000})>/gi)) {
    const attrs = attributes(match[1]!);
    if (attrs.name?.toLowerCase() === 'generator' && attrs.content === GENERATOR) return true;
  }
  return false;
}

/**
 * The script elements of the file, in order. The exporter never lets
 * "</script" stand inside one (JSON writes "<" as <, base64 has no
 * "<", and the player's code is escaped), so the first end tag after a
 * start tag is that element's own.
 */
function* scriptElements(html: string): Generator<ScriptElement> {
  const open = /<script\b([^>]{0,2000})>/gi;
  const close = /<\/script\s*>/gi;
  for (let match = open.exec(html); match; match = open.exec(html)) {
    const start = open.lastIndex;
    close.lastIndex = start;
    const end = close.exec(html);
    if (!end) return;
    yield { attrs: attributes(match[1]!), start, end: end.index };
    open.lastIndex = close.lastIndex;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function own(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

/**
 * Turns the address of a file next to the HTML file into folder and file
 * names. Only a plain relative path downwards is accepted: no web address,
 * no absolute path, no drive letter, no "..", no backslash.
 */
export function sidecarPath(href: string): string[] | null {
  if (!href || href.length > 2000) return null;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(href) || href.startsWith('/')) return null;
  if (/[\\?#\0]/.test(href)) return null;
  const path: string[] = [];
  for (const raw of href.split('/')) {
    let part: string;
    try {
      part = decodeURIComponent(raw);
    } catch {
      return null;
    }
    if (part === '' || part === '.' || part === '..') return null;
    if (/[\\/\0]/.test(part) || /^[A-Za-z]:$/.test(part)) return null;
    path.push(part);
  }
  return path;
}

function extensionOf(file: string): string {
  const dot = file.lastIndexOf('.');
  return dot < 0 ? '' : file.slice(dot + 1).toLowerCase();
}

/**
 * The sound of a slide in an exported file is one AAC file (M4A). The
 * caller turns it back into the project's own format (see restoreSound).
 */
function soundFormat(extension: string): { extension: string; mime: string } | undefined {
  if (extension === 'm4a') return { extension: 'm4a', mime: 'audio/mp4' };
  if (extension === 'wav') return { extension: 'wav', mime: 'audio/wav' };
  return undefined;
}

function hashOf(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** The same naming as everywhere else in a project: the content decides the name. */
function mediaName(hash: string, extension: string): string {
  return `media/${hash.slice(0, 16)}.${extension}`;
}

/** For each asset, the numbers (from 1) of the scenes that use it. */
function scenesUsing(project: Project): Map<string, number[]> {
  const out = new Map<string, number[]>();
  project.scenes.forEach((scene, index) => {
    for (const id of usedAssets({ ...project, scenes: [scene] })) {
      out.set(id, [...(out.get(id) ?? []), index + 1]);
    }
  });
  return out;
}

function listed(numbers: number[]): string {
  if (numbers.length === 0) return '';
  const text =
    numbers.length === 1
      ? String(numbers[0])
      : `${numbers.slice(0, -1).join(', ')} og ${numbers[numbers.length - 1]}`;
  return ` (lysark ${text})`;
}

function described(asset: Asset, scenes: number[]): string {
  const kind = asset.kind === 'video' ? 'Videoen' : asset.kind === 'audio' ? 'Lyden' : 'Bildet';
  const name = (asset.name ?? asset.credit?.title ?? '').trim();
  return `${kind}${name ? ` «${name}»` : ''}${listed(scenes)}`;
}

/**
 * Reads an exported HTML file. Throws with a readable message when the file
 * was not made by Lysark or cannot be read; otherwise everything that can be
 * taken along is, and `notes` says what could not.
 *
 * An asset whose content is not found (a large video whose folder is gone)
 * is left out of the project's assets. The element that used it stays where
 * it was and says that the file is missing, so the owner can put it in again.
 */
export function importHtml(html: string, readSidecar: SidecarReader): HtmlImport {
  if (!madeByLysark(html)) throw new Error(NOT_LYSARK);

  let dataElement: ScriptElement | undefined;
  const assetElements = new Map<string, ScriptElement>();
  for (const element of scriptElements(html)) {
    const id = element.attrs.id ?? '';
    if (id === DATA_ID) dataElement ??= element;
    else if (id.startsWith(ASSET_PREFIX)) {
      const assetId = id.slice(ASSET_PREFIX.length);
      if (!assetElements.has(assetId)) assetElements.set(assetId, element);
    }
  }
  if (!dataElement) throw new Error(DAMAGED);
  let data: unknown;
  try {
    data = JSON.parse(html.slice(dataElement.start, dataElement.end));
  } catch {
    throw new Error(DAMAGED);
  }
  if (!isRecord(data) || !isRecord(data.project)) throw new Error(DAMAGED);

  // Validates like any project file, and lifts older format versions.
  const project = parseProject(data.project);
  const refs = isRecord(data.assets) ? data.assets : {};
  const used = scenesUsing(project);

  const assets: Record<string, Asset> = {};
  const media = new Map<string, ImportedMedia>();
  const sidecar = new Map<string, { path: string[]; file: string }>();
  const notes: string[] = [];
  let unused = 0;

  for (const [id, asset] of Object.entries(project.assets)) {
    const scenes = used.get(id) ?? [];
    const ref = SAFE_ID.test(id) ? own(refs, id) : undefined;
    if (!isRecord(ref)) {
      // The export only carries what the scenes use.
      if (scenes.length === 0) unused += 1;
      else notes.push(`${described(asset, scenes)} fulgte ikke med i HTML-fila og er ikke med.`);
      continue;
    }
    const format =
      asset.kind === 'audio'
        ? soundFormat(extensionOf(asset.file))
        : (asset.kind === 'video' ? videoFormat : imageFormat)(extensionOf(asset.file));
    if (!format) {
      notes.push(
        `${described(asset, scenes)} er i et format Lysark ikke kan ta imot, og er ikke med.`,
      );
      continue;
    }
    const kept = (file: string, bytes: number): void => {
      assets[id] = { ...asset, file, mime: format.mime, bytes };
    };

    if (ref.inline === true) {
      const element = assetElements.get(id);
      const text = element ? html.slice(element.start, element.end).trim() : undefined;
      if (text === undefined || !BASE64.test(text)) {
        notes.push(`${described(asset, scenes)} kunne ikke hentes ut av HTML-fila og er ikke med.`);
        continue;
      }
      const bytes: Uint8Array = Buffer.from(text, 'base64');
      const file = mediaName(hashOf(bytes), format.extension);
      if (!media.has(file)) media.set(file, { file, data: bytes });
      kept(file, bytes.byteLength);
    } else {
      const path = typeof ref.href === 'string' ? sidecarPath(ref.href) : null;
      const found = path ? readSidecar(path) : undefined;
      if (!path || !found) {
        notes.push(
          `${described(asset, scenes)} lå ikke i mappa ved siden av HTML-fila og er ikke med. ` +
            'Lysarket viser at fila mangler; sett den inn på nytt.',
        );
        continue;
      }
      const file = mediaName(found.hash, format.extension);
      if (!sidecar.has(file)) sidecar.set(file, { path, file });
      kept(file, found.bytes);
    }
  }
  if (unused > 0) {
    notes.push(
      unused === 1
        ? 'Én mediefil som lå i prosjektet uten å være brukt i noe lysark, fulgte ikke med i HTML-fila.'
        : `${unused} mediefiler som lå i prosjektet uten å være brukt i noe lysark, fulgte ikke med i HTML-fila.`,
    );
  }

  return {
    project: { ...project, assets },
    media: [...media.values()],
    sidecar: [...sidecar.values()],
    notes,
  };
}
