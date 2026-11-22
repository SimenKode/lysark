// Writes the exported HTML file, and the preview that shows exactly what
// an export would contain.
import { app } from 'electron';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { buildHtml, type ExportSources, type FontFace } from '../exporter/html';
import type { Project } from '../shared/format/schema';
import type { ExportSummary, LogoVariant } from '../shared/api';
import { secondsToSamples } from '../shared/audio/wav';
import { hasSound, placeTracks, schedule } from '../shared/render/clock';
import { encodeSceneSound, hasTracks, sampleReader, trackSound } from './audio';
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
  const tracks = hasTracks(project);
  if (!tracks && !project.scenes.some(hasSound)) return { project, generated };
  requireFfmpeg();
  const samplesOf = sampleReader(dir, project);
  const out = structuredClone(project);
  // Music and other sound on the lecture's own tracks are put into the sound
  // of the slides they lie under, so "Spill av" plays them with the voice.
  // (The sound of a film is not: the film plays itself in the page.)
  const plan = schedule(project.scenes);
  const placed = tracks ? placeTracks(project, plan) : [];
  const mixes = tracks ? [trackSound(project, samplesOf)] : [];
  // Tells one lecture's music from another's, so the sound kept from an earlier export is not used for the wrong one.
  const mixKey = tracks ? JSON.stringify([project.tracks, project.video?.duckMusic]) : '';
  for (const [index, scene] of out.scenes.entries()) {
    const { start, duration } = plan.entries[index]!;
    const under = placed.some((p) => p.end > start && p.start < start + duration);
    if (!hasSound(scene) && !under) continue;
    const key = createHash('sha256')
      .update(JSON.stringify(scene.audio ?? null))
      .update(tracks ? `${mixKey}|${start}|${duration}` : '')
      .digest('hex');
    // With music, every slide is put together anew and in order: how far the
    // music is lowered at the start of a slide depends on the slide before it.
    let sound = tracks ? undefined : encoded.get(key);
    if (!sound) {
      sound = await encodeSceneSound(scene, samplesOf, secondsToSamples(start), mixes);
      if (!tracks) {
        if (encoded.size >= ENCODED_LIMIT) encoded.delete(encoded.keys().next().value!);
        encoded.set(key, sound);
      }
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
  // The recordings themselves are not part of an exported file, and the
  // tracks are in the sound of the slides now. What is left of the tracks is
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
  for (const [id, asset] of Object.entries(out.assets)) {
    if (asset.kind === 'audio' && !generated.has(asset.file) && !credited.has(id)) {
      delete out.assets[id];
    }
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
  const film = closingAnimation();
  return {
    ...(film ? { closing: { mime: film.mime, data: readFileSync(film.file) } } : {}),
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
