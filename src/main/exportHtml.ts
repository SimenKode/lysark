// Writes the exported HTML file, and the preview that shows exactly what
// an export would contain.
import { app } from 'electron';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { buildHtml, type ExportSources, type FontFace } from '../exporter/html';
import type { Project } from '../shared/format/schema';
import type { ExportSummary, LogoVariant } from '../shared/api';
import { hasSound, schedule } from '../shared/render/clock';
import { encodeLectureTracks, encodeSceneSound, hasTracks, sampleReader } from './audio';
import { requireFfmpeg } from './ffmpeg';
import { mediaPath } from './projectIo';
import { closingAnimation, logoFile } from './settings';

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

/** The id of the lecture's tracks in an exported file, put together as one sound file. */
const UNDER_ASSET = 'a_tracks';
/** The clip that holds it, on the track for other sound, so the file can be opened again. */
const UNDER_CLIP = 'k_tracks';

/**
 * The project as it goes into an HTML file. The sound of each slide is put
 * together (cuts, pauses, loudness) and encoded as one small AAC file; the
 * slide then points at that file instead of at the recordings, which are
 * left out. The lecture's own tracks (music, other sound) become one file
 * of their own for the whole lecture (`under`), so that "Spill av" can let
 * the music run on over the change of slide. Returns the bytes of the new
 * files by their media path.
 */
async function withEncodedSound(
  dir: string,
  project: Project,
): Promise<{ project: Project; generated: Map<string, Uint8Array>; under?: string }> {
  const generated = new Map<string, Uint8Array>();
  const tracks = hasTracks(project);
  if (!tracks && !project.scenes.some(hasSound)) return { project, generated };
  requireFfmpeg();
  const samplesOf = sampleReader(dir, project);
  const out = structuredClone(project);
  for (const scene of out.scenes) {
    if (!hasSound(scene)) continue;
    const key = createHash('sha256')
      .update(JSON.stringify(scene.audio ?? null))
      .digest('hex');
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
  // Music and other sound on the lecture's own tracks: one file from the
  // start of the lecture. (The sound of a film is not: the film plays itself
  // in the page.)
  const lecture =
    tracks && out.scenes.length > 0
      ? await encodeLectureTracks(project, schedule(project.scenes), samplesOf)
      : undefined;
  // The recordings themselves are not part of an exported file, and the
  // tracks are in that one file now. What is left of the clips themselves is
  // only who is to be credited: clips whose sound file carries a credit stay
  // as names in the list of sources, without their sound.
  const credited = new Set<string>();
  if (out.tracks) {
    const keep = (clips: NonNullable<Project['tracks']>['music']): typeof clips =>
      clips.filter((clip) => {
        const credit = out.assets[clip.asset]?.credit;
        const named = !!(
          credit?.author?.trim() ||
          credit?.license?.trim() ||
          credit?.title?.trim()
        );
        if (named) credited.add(clip.asset);
        return named;
      });
    out.tracks = { music: keep(out.tracks.music), sound: keep(out.tracks.sound) };
    if (credited.size === 0) delete out.tracks;
  }
  let under: string | undefined;
  if (lecture) {
    const key = createHash('sha256').update(lecture.data).digest('hex');
    const file = `media/lydspor-${key.slice(0, 16)}.m4a`;
    out.assets[UNDER_ASSET] = {
      kind: 'audio',
      file,
      mime: 'audio/mp4',
      bytes: lecture.data.byteLength,
      name: 'Musikk og lyd',
    };
    generated.set(file, lecture.data);
    // The clip lets the file be opened as a project again with its music.
    out.tracks ??= { music: [], sound: [] };
    out.tracks.sound.push({
      id: UNDER_CLIP,
      asset: UNDER_ASSET,
      scene: out.scenes[0]!.id,
      offset: 0,
      from: 0,
      to: lecture.seconds,
    });
    under = UNDER_ASSET;
  }
  for (const [id, asset] of Object.entries(out.assets)) {
    if (asset.kind === 'audio' && !generated.has(asset.file) && !credited.has(id)) {
      delete out.assets[id];
    }
  }
  withoutCamera(out);
  return { project: out, generated, ...(under ? { under } : {}) };
}

/**
 * The camera circle is part of the video, not of the HTML file (the owner's
 * choice, 25.11.2026): the films, where the circle stood and how it was
 * moved are left out of what is exported.
 */
function withoutCamera(project: Project): void {
  for (const [id, asset] of Object.entries(project.assets)) {
    if (asset.kind === 'camera') delete project.assets[id];
    else delete asset.camera;
  }
  for (const scene of project.scenes) {
    delete scene.camera;
    if (!scene.events) continue;
    scene.events = scene.events.filter((event) => event.kind !== 'camera-move');
    if (scene.events.length === 0) delete scene.events;
  }
}

function sources(
  dir: string,
  project: Project,
  sidecarHref: ExportSources['sidecarHref'],
  generated: Map<string, Uint8Array>,
  under: string | undefined,
): ExportSources {
  const logo: ExportSources['logo'] = {};
  for (const variant of ['light', 'dark'] as LogoVariant[]) {
    const file = logoFile(project.meta.language, variant);
    if (file) logo[variant] = { mime: file.mime, data: readFileSync(file.file) };
  }
  const film = closingAnimation();
  return {
    ...(film ? { closing: { mime: film.mime, data: readFileSync(film.file) } } : {}),
    playerJs: readFileSync(join(__dirname, '../player/player.js'), 'utf8'),
    readFont: (face) => readFileSync(join(app.getAppPath(), 'resources/fonts', FONT_FILES[face])),
    readAsset: (file) => generated.get(file) ?? readFileSync(mediaPath(dir, file)),
    logo,
    sidecarHref,
    ...(under ? { under } : {}),
  };
}

export async function exportHtml(
  dir: string,
  source: Project,
  outFile: string,
): Promise<ExportSummary> {
  const { project, generated, under } = await withEncodedSound(dir, source);
  const stem = basename(outFile, extname(outFile));
  const sidecarName = `${stem}_filer`;
  const result = buildHtml(
    project,
    sources(
      dir,
      project,
      (_id, file) => `${encodeURIComponent(sidecarName)}/${basename(file)}`,
      generated,
      under,
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
  const { project, generated, under } = await withEncodedSound(dir, source);
  return buildHtml(
    project,
    sources(dir, project, (_id, file) => `media/${basename(file)}`, generated, under),
  ).html;
}
