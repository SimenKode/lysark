// Reading and writing projects. A project is a folder with prosjekt.json
// and a media/ folder; media files are named after a hash of their content.
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, extname, join, resolve, sep } from 'node:path';
import { unzipSync, zipSync, type Zippable } from 'fflate';
import { newId, newProject } from '../shared/format/factory';
import { parseProject, type Asset, type Project } from '../shared/format/schema';
import { importPptx, layOutFrontScenes, type ImportReport } from '../importer/pptx';

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

function writeProjectFile(dir: string, project: Project): void {
  const target = join(dir, PROJECT_FILE);
  const temp = `${target}.ny`;
  writeFileSync(temp, JSON.stringify(project, null, 2), 'utf8');
  renameSync(temp, target); // replace in one step so a crash cannot leave half a file
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

export function createProject(dir: string): Project {
  prepareFolder(dir);
  const project = newProject(basename(dir));
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
): { project: Project; report: ImportReport } {
  const bytes = new Uint8Array(readFileSync(pptxPath));
  const result = importPptx(bytes, { fileName: basename(pptxPath) });
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
    throw new Error('Fila er ikke et pakket Lysark-prosjekt.');
  }
  const projectBytes = entries[PROJECT_FILE];
  if (!projectBytes) throw new Error('Fila er ikke et pakket Lysark-prosjekt.');
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
