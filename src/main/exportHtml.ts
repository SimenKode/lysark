// Writes the exported HTML file, and the preview that shows exactly what
// an export would contain.
import { app } from 'electron';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildHtml, type ExportSources, type FontFace } from '../exporter/html';
import type { Project } from '../shared/format/schema';
import type { ExportSummary, LogoVariant } from '../shared/api';
import { mediaPath } from './projectIo';
import { logoFile } from './settings';

const FONT_FILES: Record<FontFace, string> = {
  'sans-regular': 'LiberationSans-Regular.ttf',
  'sans-bold': 'LiberationSans-Bold.ttf',
  'sans-italic': 'LiberationSans-Italic.ttf',
  'sans-bolditalic': 'LiberationSans-BoldItalic.ttf',
  'serif-regular': 'LiberationSerif-Regular.ttf',
  'serif-italic': 'LiberationSerif-Italic.ttf',
};

function sources(dir: string, sidecarHref: ExportSources['sidecarHref']): ExportSources {
  const logo: ExportSources['logo'] = {};
  for (const variant of ['light', 'dark'] as LogoVariant[]) {
    const file = logoFile(variant);
    if (file) logo[variant] = { mime: file.mime, data: readFileSync(file.file) };
  }
  return {
    playerJs: readFileSync(join(__dirname, '../player/player.js'), 'utf8'),
    readFont: (face) => readFileSync(join(app.getAppPath(), 'resources/fonts', FONT_FILES[face])),
    readAsset: (file) => readFileSync(mediaPath(dir, file)),
    logo,
    sidecarHref,
  };
}

export function exportHtml(dir: string, project: Project, outFile: string): ExportSummary {
  const stem = basename(outFile, extname(outFile));
  const sidecarName = `${stem}_filer`;
  const result = buildHtml(
    project,
    sources(dir, (_id, file) => `${encodeURIComponent(sidecarName)}/${basename(file)}`),
  );
  writeFileSync(outFile, result.html, 'utf8');
  let sidecarDir: string | undefined;
  if (result.sidecar.length > 0) {
    sidecarDir = join(dirname(outFile), sidecarName);
    mkdirSync(sidecarDir, { recursive: true });
    for (const item of result.sidecar) {
      copyFileSync(mediaPath(dir, item.file), join(sidecarDir, basename(item.file)));
    }
  }
  return {
    path: outFile,
    bytes: Buffer.byteLength(result.html, 'utf8'),
    sidecarDir,
    sidecarFiles: result.sidecar.length,
    logoMissing: result.logoMissing,
  };
}

/** Writes a preview to the temp folder; large videos are linked, not copied. */
export function writePreview(dir: string, project: Project): string {
  const result = buildHtml(
    project,
    sources(dir, (_id, file) => pathToFileURL(mediaPath(dir, file)).toString()),
  );
  const folder = join(app.getPath('temp'), 'lysark-forhandsvisning');
  mkdirSync(folder, { recursive: true });
  const file = join(folder, 'index.html');
  writeFileSync(file, result.html, 'utf8');
  return file;
}
