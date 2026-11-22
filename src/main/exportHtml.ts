// Writes the exported HTML file, and the preview that shows exactly what
// an export would contain.
import { app } from 'electron';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { buildHtml, type ExportSources, type FontFace } from '../exporter/html';
import type { Project } from '../shared/format/schema';
import type { ExportSummary, LogoVariant } from '../shared/api';
import { hasSound } from '../shared/render/clock';
import { encodeSceneSound, sampleReader } from './audio';
import { requireFfmpeg } from './ffmpeg';
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

/** Sound that has been encoded for export, by slide sound: previews need not encode it again. */
const encoded = new Map<string, { data: Uint8Array; seconds: number }>();
const ENCODED_LIMIT = 400;

/**
 * The project as it goes into an HTML file. The sound of each slide is put
 * together (cuts, pauses, loudness) and encoded as one small AAC file; the
 * slide then points at that file instead of at the recordings, which are
 * left out. Returns the bytes of the new files by their media path.
 */
async function withEncodedSound(
  dir: string,
  project: Project,
): Promise<{ project: Project; generated: Map<string, Uint8Array> }> {
  const generated = new Map<string, Uint8Array>();
  if (!project.scenes.some(hasSound)) return { project, generated };
  requireFfmpeg();
  const samplesOf = sampleReader(dir, project);
  const out = structuredClone(project);
  for (const scene of out.scenes) {
    if (!hasSound(scene)) continue;
    const key = createHash('sha256').update(JSON.stringify(scene.audio)).digest('hex');
    let sound = encoded.get(key);
    if (!sound) {
      sound = await encodeSceneSound(scene, samplesOf);
      if (encoded.size >= ENCODED_LIMIT) encoded.delete(encoded.keys().next().value!);
      encoded.set(key, sound);
    }
    const id = `a_voice_${scene.id}`;
    const file = `media/stemme-${key.slice(0, 16)}.m4a`;
    out.assets[id] = { kind: 'audio', file, mime: 'audio/mp4', bytes: sound.data.byteLength };
    generated.set(file, sound.data);
    // The loudness change is in the encoded sound; the slide carries one clip.
    scene.audio = {
      clips: [{ id: `c_voice_${scene.id}`, kind: 'sound', asset: id, from: 0, to: sound.seconds }],
    };
  }
  // The recordings themselves are not part of an exported file.
  for (const [id, asset] of Object.entries(out.assets)) {
    if (asset.kind === 'audio' && !generated.has(asset.file)) delete out.assets[id];
  }
  return { project: out, generated };
}

function sources(
  dir: string,
  project: Project,
  sidecarHref: ExportSources['sidecarHref'],
  generated: Map<string, Uint8Array>,
): ExportSources {
  const logo: ExportSources['logo'] = {};
  for (const variant of ['light', 'dark'] as LogoVariant[]) {
    const file = logoFile(project.meta.language, variant);
    if (file) logo[variant] = { mime: file.mime, data: readFileSync(file.file) };
  }
  return {
    playerJs: readFileSync(join(__dirname, '../player/player.js'), 'utf8'),
    readFont: (face) => readFileSync(join(app.getAppPath(), 'resources/fonts', FONT_FILES[face])),
    readAsset: (file) => generated.get(file) ?? readFileSync(mediaPath(dir, file)),
    logo,
    sidecarHref,
  };
}

export async function exportHtml(
  dir: string,
  source: Project,
  outFile: string,
): Promise<ExportSummary> {
  const { project, generated } = await withEncodedSound(dir, source);
  const stem = basename(outFile, extname(outFile));
  const sidecarName = `${stem}_filer`;
  const result = buildHtml(
    project,
    sources(
      dir,
      project,
      (_id, file) => `${encodeURIComponent(sidecarName)}/${basename(file)}`,
      generated,
    ),
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
    hasSound: generated.size > 0,
  };
}

/**
 * Builds the preview: exactly what an export would contain. Large videos are
 * not copied; the preview server hands them out from the project's folder.
 */
export async function buildPreview(dir: string, source: Project): Promise<string> {
  const { project, generated } = await withEncodedSound(dir, source);
  return buildHtml(
    project,
    sources(dir, project, (_id, file) => `media/${basename(file)}`, generated),
  ).html;
}
