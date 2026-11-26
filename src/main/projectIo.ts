// Reading and writing projects. A project is a folder with prosjekt.json
// and a media/ folder; media files are named after a hash of their content.
import { createHash } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { unzipSync, zipSync, type Zippable } from 'fflate';
import { newId, newProject } from '../shared/format/factory';
import { parseProject, type Asset, type Orientation, type Project } from '../shared/format/schema';
import { importHtml, type HtmlImport } from '../importer/html';
import { importPptx, layOutFrontScenes, type ImportReport } from '../importer/pptx';
import { PDF_PAGE_LIMIT_BYTES } from '../shared/limits';

export const PROJECT_FILE = 'prosjekt.json';

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};
const VIDEO_MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
};

const AUDIO_MIME: Record<string, string> = {
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
};

export const MEDIA_EXTENSIONS = {
  image: Object.keys(IMAGE_MIME).map((e) => e.slice(1)),
  video: Object.keys(VIDEO_MIME).map((e) => e.slice(1)),
};

export function mimeOf(file: string): string | undefined {
  const ext = extname(file).toLowerCase();
  return IMAGE_MIME[ext] ?? VIDEO_MIME[ext] ?? AUDIO_MIME[ext];
}

/** Absolute path of a media file, refusing anything outside media/. */
export function mediaPath(dir: string, file: string): string {
  const root = resolve(dir, 'media');
  const full = resolve(dir, file);
  if (!full.startsWith(root + sep)) throw new Error('Ugyldig filnavn i prosjektet.');
  return full;
}

/** True for the errors the system gives when it will not let a file be written or replaced. */
function isRefused(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === 'EPERM' || code === 'EACCES' || code === 'EBUSY' || code === 'EROFS';
}

function writeProjectFile(dir: string, project: Project): void {
  const target = join(dir, PROJECT_FILE);
  const temp = `${target}.ny`;
  try {
    writeFileSync(temp, JSON.stringify(project, null, 2), 'utf8');
    try {
      renameSync(temp, target); // replace in one step so a crash cannot leave half a file
    } catch (error) {
      if (!isRefused(error)) throw error;
      // Windows will not replace a file that is marked read-only, and every
      // file copied from a CD is (found in the Windows VM, 26.11.2026). The
      // mark is taken off, and the file is replaced after all.
      chmodSync(target, 0o666);
      renameSync(temp, target);
    }
  } catch (error) {
    if (!isRefused(error)) throw error;
    try {
      unlinkSync(temp);
    } catch {
      // Nothing was written, or it cannot be taken away: the project file itself is untouched.
    }
    throw new Error(
      'Prosjektet ble ikke lagret: Lysark får ikke skrive i prosjektmappa. Fila prosjekt.json ' +
        'kan være skrivebeskyttet eller åpen i et annet program, eller mappa ligger et sted du ' +
        'ikke kan skrive. Kopier prosjektmappa til for eksempel Dokumenter, og åpne den derfra.',
    );
  }
}

/** A project folder must be new or empty, so nothing is overwritten. */
function prepareFolder(dir: string): void {
  if (existsSync(dir)) {
    if (!statSync(dir).isDirectory()) throw new Error('Det finnes allerede en fil med det navnet.');
    if (readdirSync(dir).length > 0) {
      throw new Error('Mappa er ikke tom. Velg et nytt navn, så lager Lysark mappa.');
    }
  }
  mkdirSync(join(dir, 'media'), { recursive: true });
}

export function createProject(dir: string, orientation: Orientation = 'landscape'): Project {
  prepareFolder(dir);
  const project = newProject(basename(dir));
  if (orientation === 'portrait') project.orientation = 'portrait';
  writeProjectFile(dir, project);
  return project;
}

export function readProject(dir: string): Project {
  const file = join(dir, PROJECT_FILE);
  if (!existsSync(file))
    throw new Error('Mappa inneholder ikke et Lysark-prosjekt (prosjekt.json mangler).');
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error('Prosjektfila kan ikke leses.');
  }
  return parseProject(data);
}

export function saveProject(dir: string, project: Project): void {
  // Validate before writing: a bug must never save a project that cannot be opened again.
  const valid = parseProject(project);
  mkdirSync(join(dir, 'media'), { recursive: true });
  writeProjectFile(dir, valid);
}

export function importPptxToFolder(
  pptxPath: string,
  dir: string,
  orientation: Orientation = 'landscape',
): { project: Project; report: ImportReport } {
  const bytes = new Uint8Array(readFileSync(pptxPath));
  const result = importPptx(bytes, { fileName: basename(pptxPath), orientation });
  layOutFrontScenes(result.project);
  prepareFolder(dir);
  for (const media of result.media) {
    writeFileSync(mediaPath(dir, media.file), media.data);
  }
  writeProjectFile(dir, result.project);
  return { project: result.project, report: result.report };
}

/** Copies a file into the project's media folder and describes it as an asset. */
export function addMediaFile(
  dir: string,
  source: string,
  kind: 'image' | 'video',
): { id: string; asset: Asset } {
  const ext = extname(source).toLowerCase();
  const mime = (kind === 'image' ? IMAGE_MIME : VIDEO_MIME)[ext];
  if (!mime) {
    throw new Error(
      kind === 'image'
        ? 'Bildet må være PNG, JPG, GIF, SVG, WebP eller BMP.'
        : 'Videoen må være MP4 eller WebM.',
    );
  }
  const data = readFileSync(source);
  const hash = createHash('sha256').update(data).digest('hex').slice(0, 16);
  const file = `media/${hash}${ext === '.jpeg' ? '.jpg' : ext}`;
  mkdirSync(join(dir, 'media'), { recursive: true });
  const target = mediaPath(dir, file);
  if (!existsSync(target)) copyFileSync(source, target);
  return {
    id: newId('a'),
    asset: { kind, file, mime, bytes: data.byteLength, name: basename(source) },
  };
}

/** Stores bytes fetched from the web (a picture from Commons, a still picture) as an asset. */
export function addMediaBytes(
  dir: string,
  data: Uint8Array,
  extension: string,
  asset: Pick<Asset, 'name' | 'credit'>,
): { id: string; asset: Asset } {
  const mime = IMAGE_MIME[extension];
  if (!mime) throw new Error('Bildet er i et format som ikke kan vises.');
  const hash = createHash('sha256').update(data).digest('hex').slice(0, 16);
  const file = `media/${hash}${extension}`;
  mkdirSync(join(dir, 'media'), { recursive: true });
  const target = mediaPath(dir, file);
  if (!existsSync(target)) writeFileSync(target, data);
  return { id: newId('a'), asset: { kind: 'image', file, mime, bytes: data.byteLength, ...asset } };
}

// ---------- One-file packages ----------

const SAFE_MEDIA_NAME = /^media\/[A-Za-z0-9._-]+$/;

/** A file in the project's media folder that nothing uses. */
export interface UnusedMedia {
  /** `media/…`, as the project names it. */
  file: string;
  path: string;
  bytes: number;
}

/** The files in the project's media folder that are not in `keep` (names `media/…`). */
export function unusedMedia(dir: string, keep: readonly string[]): UnusedMedia[] {
  const mediaDir = join(dir, 'media');
  if (!existsSync(mediaDir)) return [];
  const used = new Set(keep);
  const unused: UnusedMedia[] = [];
  for (const name of readdirSync(mediaDir).sort()) {
    const file = `media/${name}`;
    if (!SAFE_MEDIA_NAME.test(file) || used.has(file)) continue;
    const path = join(mediaDir, name);
    const info = statSync(path);
    if (info.isFile()) unused.push({ file, path, bytes: info.size });
  }
  return unused;
}

/** "1,4 MB" or "820 kB", as a lecturer reads a size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('nb-NO')} kB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toLocaleString('nb-NO', { maximumFractionDigits: 1 })} MB`;
}

/** Packs a project folder into one zip file, for moving or archiving. */
export function packProject(dir: string, target: string): number {
  readProject(dir); // refuse to pack something that is not a readable project
  const files: Zippable = { [PROJECT_FILE]: new Uint8Array(readFileSync(join(dir, PROJECT_FILE))) };
  const mediaDir = join(dir, 'media');
  if (existsSync(mediaDir)) {
    for (const name of readdirSync(mediaDir)) {
      const entry = `media/${name}`;
      if (!SAFE_MEDIA_NAME.test(entry) || !statSync(join(mediaDir, name)).isFile()) continue;
      // Images and video are already compressed; store them as they are.
      files[entry] = [new Uint8Array(readFileSync(join(mediaDir, name))), { level: 0 }];
    }
  }
  const zipped = zipSync(files);
  writeFileSync(target, zipped);
  return zipped.byteLength;
}

/** Unpacks a packed project into a new folder. Only project files are accepted. */
export function unpackProject(source: string, dir: string): Project {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(readFileSync(source)));
  } catch {
    throw new Error('Fila er ikke et Lysark-prosjekt lagret som én fil.');
  }
  const projectBytes = entries[PROJECT_FILE];
  if (!projectBytes) throw new Error('Fila er ikke et Lysark-prosjekt lagret som én fil.');
  let project: Project;
  try {
    project = parseProject(JSON.parse(Buffer.from(projectBytes).toString('utf8')));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Prosjektfila kan ikke leses.');
  }
  prepareFolder(dir);
  for (const [name, data] of Object.entries(entries)) {
    // Anything else in the zip, and any path that tries to leave media/, is ignored.
    if (SAFE_MEDIA_NAME.test(name)) writeFileSync(mediaPath(dir, name), data);
  }
  writeProjectFile(dir, project);
  return project;
}

// ---------- An exported HTML file as a project again ----------

/** Path of a file below `base`, or undefined when it is not a file inside that folder. */
function fileBelow(base: string, path: string[]): string | undefined {
  try {
    const root = realpathSync(base);
    const inside = (full: string): boolean =>
      full.startsWith(root.endsWith(sep) ? root : root + sep);
    const full = join(root, ...path);
    if (!inside(full) || !existsSync(full)) return undefined;
    // A link that leads out of the folder is not followed.
    const real = realpathSync(full);
    return inside(real) && statSync(real).isFile() ? real : undefined;
  } catch {
    return undefined;
  }
}

/** sha256 of a file, read in pieces so that a large video does not fill the memory. */
function hashFile(file: string): { hash: string; bytes: number } {
  const hash = createHash('sha256');
  const buffer = Buffer.alloc(4 * 1024 * 1024);
  const handle = openSync(file, 'r');
  let bytes = 0;
  try {
    for (let read = readSync(handle, buffer); read > 0; read = readSync(handle, buffer)) {
      hash.update(buffer.subarray(0, read));
      bytes += read;
    }
  } finally {
    closeSync(handle);
  }
  return { hash: hash.digest('hex'), bytes };
}

/** An exported HTML file that has been read and checked, ready to become a project folder. */
export interface ReadHtmlExport {
  content: HtmlImport;
  /** Where each large video next to the HTML file lies, by its new name in media/. */
  copies: Map<string, string>;
}

/**
 * Reads an HTML file exported by Lysark. Nothing is written. Throws with a
 * readable message when the file is not such an export. Large videos are
 * looked for only inside the HTML file's own folder.
 */
export function readHtmlExport(source: string): ReadHtmlExport {
  let html: string;
  try {
    html = readFileSync(source, 'utf8');
  } catch (error) {
    throw new Error(
      (error as NodeJS.ErrnoException).code === 'ERR_STRING_TOO_LONG'
        ? 'HTML-fila er for stor til å åpnes.'
        : 'HTML-fila kan ikke leses.',
    );
  }
  const base = dirname(source);
  const found = new Map<string, string>();
  const content = importHtml(html, (path) => {
    const file = fileBelow(base, path);
    if (!file) return undefined;
    const result = hashFile(file);
    found.set(path.join('/'), file);
    return result;
  });
  const copies = new Map<string, string>();
  for (const item of content.sidecar) copies.set(item.file, found.get(item.path.join('/'))!);
  return { content, copies };
}

/** Writes what readHtmlExport found as a project in a new folder. */
export function writeHtmlExport(read: ReadHtmlExport, dir: string): Project {
  prepareFolder(dir);
  for (const media of read.content.media) writeFileSync(mediaPath(dir, media.file), media.data);
  for (const [file, source] of read.copies) copyFileSync(source, mediaPath(dir, file));
  writeProjectFile(dir, read.content.project);
  return read.content.project;
}

// ---------- A project that is filled in picture by picture (PDF import) ----------

/** The folder of a project under import, and what has been put into it so far. */
export interface ImportFolder {
  dir: string;
  /** The folder was there (empty) before the import, so it is left when the import is dropped. */
  existed: boolean;
  /** Media files this import has written: 'media/<name>'. */
  files: Set<string>;
}

/** Makes the folder for a project whose pictures arrive one by one. The project file is written last. */
export function beginImportFolder(dir: string): ImportFolder {
  const existed = existsSync(dir);
  prepareFolder(dir);
  return { dir, existed, files: new Set() };
}

/**
 * Stores one picture the interface has made from a page of a PDF. Only WebP
 * is accepted, and only up to a size no such picture should reach.
 */
export function addPagePicture(
  folder: ImportFolder,
  data: Uint8Array,
  name: string,
): { id: string; asset: Asset } {
  const text = (from: number, to: number): string =>
    Buffer.from(data.buffer, data.byteOffset + from, to - from).toString('latin1');
  const webp = data.byteLength >= 12 && text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP';
  if (!webp || data.byteLength > PDF_PAGE_LIMIT_BYTES) {
    throw new Error('Bildet av siden kan ikke lagres.');
  }
  const added = addMediaBytes(folder.dir, data, '.webp', { name });
  folder.files.add(added.asset.file);
  return added;
}

/** Writes the project file of a finished import. From then on it is an ordinary project. */
export function finishImportFolder(folder: ImportFolder, project: Project): Project {
  const valid = parseProject(project);
  writeProjectFile(folder.dir, valid);
  return valid;
}

/** Takes away what an import that was dropped has written, and nothing else. */
export function discardImportFolder(folder: ImportFolder): void {
  const remove = (action: () => void): void => {
    try {
      action();
    } catch {
      // Already gone, or not empty because someone else put something there: leave it.
    }
  };
  for (const file of folder.files) remove(() => unlinkSync(mediaPath(folder.dir, file)));
  remove(() => rmdirSync(join(folder.dir, 'media')));
  if (!folder.existed) remove(() => rmdirSync(folder.dir));
}
