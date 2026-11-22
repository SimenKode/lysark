// PPTX import: turns a PowerPoint file into a project plus the media files
// it refers to. Runs in the main process; synchronous and without any file
// system access, so the caller decides where things are read and written.
import { newId, newProject } from '../shared/format/factory';
import type { ImportWarning, Project, Scene } from '../shared/format/schema';
import { fitToGrid } from '../shared/layout/fitToGrid';
import { getTheme } from '../shared/theme/theme';
import { Deck } from './deck';
import { MediaStore, type ImportedMedia } from './media';
import { importSlide } from './slide';
import { child, type XmlNode } from './xml';

export type { ImportedMedia } from './media';

export interface ImportReport {
  /** Slides in the PPTX. */
  slides: number;
  /** Elements created, by type. */
  texts: number;
  images: number;
  tables: number;
  shapes: number;
  videos: number;
  /** Scenes that got a script from the notes. */
  notes: number;
  warnings: Array<{ slide: number; code: ImportWarning['code']; message: string }>;
}

export interface ImportResult {
  project: Project;
  media: ImportedMedia[];
  report: ImportReport;
}

// Titles PowerPoint fills in by itself; they say nothing about the lecture.
const GENERIC_TITLES = new Set(['powerpoint presentation', 'powerpoint-presentasjon']);

function titleFromFileName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  return (dot > 0 ? base.slice(0, dot) : base).trim();
}

function documentTitle(coreProperties: XmlNode | undefined): string | undefined {
  const title = child(coreProperties, 'dc:title')?.text.replace(/\s+/g, ' ').trim();
  return title && !GENERIC_TITLES.has(title.toLowerCase()) ? title : undefined;
}

/**
 * Title and section slides that hold nothing but a title and a subtitle
 * are laid out the theme's way: text in the left columns, the pair of
 * brand shapes on the right. PowerPoint centres such titles across the
 * whole slide, which would leave no room for the shapes. Everything else
 * keeps the position it had in PowerPoint.
 */
function isPlainFrontScene(scene: Scene): boolean {
  if (scene.kind !== 'title' && scene.kind !== 'section') return false;
  const onlyTitles = scene.elements.every(
    (e) => e.type === 'text' && (e.role === 'title' || e.role === 'subtitle'),
  );
  const titles = scene.elements.filter((e) => e.type === 'text' && e.role === 'title').length;
  const subtitles = scene.elements.filter((e) => e.type === 'text' && e.role === 'subtitle').length;
  return onlyTitles && titles === 1 && subtitles <= 1;
}

/** Applies the theme's layout to plain title and section scenes (see above). */
export function layOutFrontScenes(project: Project): void {
  const theme = getTheme(project);
  for (const scene of project.scenes) {
    if (isPlainFrontScene(scene)) fitToGrid(scene, theme);
  }
}

/**
 * Imports a PPTX. Throws an Error with a Norwegian message when the bytes
 * are not a readable PowerPoint presentation.
 */
export function importPptx(bytes: Uint8Array, options: { fileName: string }): ImportResult {
  const deck = new Deck(bytes);
  const corePart = deck.pkg.relatedPart('', '/metadata/core-properties') ?? 'docProps/core.xml';
  const project = newProject(
    documentTitle(deck.pkg.xml(corePart)) ?? titleFromFileName(options.fileName),
  );

  // Scene ids are assigned first so links between slides can point at them.
  const sceneIds = new Map<string, string>();
  const ids = deck.slideParts.map((part) => {
    const id = newId('s');
    if (!sceneIds.has(part.toLowerCase())) sceneIds.set(part.toLowerCase(), id);
    return id;
  });

  const media = new MediaStore();
  const report: ImportReport = {
    slides: deck.slideParts.length,
    texts: 0,
    images: 0,
    tables: 0,
    shapes: 0,
    videos: 0,
    notes: 0,
    warnings: [],
  };

  deck.slideParts.forEach((part, index) => {
    const { scene, counts } = importSlide(deck, part, index, ids[index]!, sceneIds, media);
    project.scenes.push(scene);
    report.texts += counts.texts;
    report.images += counts.images;
    report.tables += counts.tables;
    report.shapes += counts.shapes;
    report.videos += counts.videos;
    if (scene.script !== '') report.notes += 1;
    for (const warning of scene.imported?.warnings ?? []) {
      report.warnings.push({ slide: index + 1, code: warning.code, message: warning.message });
    }
  });

  project.assets = media.assets;
  return { project, media: media.media, report };
}
