// Things the owner can do that involve files: open, save, import, export,
// preview and inserting media. Errors end up as a notice, never silently.
import {
  mediaUrl,
  type AddedMedia,
  type CommonsPicture,
  type CommonsResult,
  type LysarkApi,
} from '../../shared/api';
import { appendSound, continueSound, replaceSound } from '../../shared/audio/edit';
import { encodeWav, wavSamples } from '../../shared/audio/wav';
import { newId } from '../../shared/format/factory';
import type { Element, Project } from '../../shared/format/schema';
import { formatTime, trackDuration } from '../../shared/render/clock';
import { rememberSamples } from './audio/engine';
import { getTheme } from '../../shared/theme/theme';
import { placeNew } from './ops';
import { currentScene, isDirty, useStore } from './store';

declare global {
  interface Window {
    lysark: LysarkApi;
  }
}

const api = (): LysarkApi => window.lysark;

function fail(error: unknown): void {
  const text = error instanceof Error ? error.message : String(error);
  // Electron prefixes errors from the main process; show only our own text.
  useStore.getState().setNotice({
    kind: 'error',
    text: text.replace(/^Error invoking remote method '[^']+': Error: /, ''),
  });
}

async function guard<T>(work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work();
  } catch (error) {
    fail(error);
    return undefined;
  }
}

/** Asks before throwing away unsaved changes. Returns false when the owner cancels. */
async function leaveCurrent(): Promise<boolean> {
  const state = useStore.getState();
  if (!state.project || !isDirty(state)) return true;
  const answer = window.confirm(
    'Prosjektet har endringer som ikke er lagret. Vil du lagre dem først?',
  );
  if (answer) return (await save()) === true;
  return window.confirm('Fortsette uten å lagre? Endringene går tapt.');
}

export async function newProject(): Promise<void> {
  if (!(await leaveCurrent())) return;
  const opened = await guard(() => api().newProject());
  if (opened) useStore.getState().load(opened.dir, opened.project);
}

export async function openProject(dir?: string): Promise<void> {
  if (!(await leaveCurrent())) return;
  const opened = await guard(() => api().openProject(dir));
  if (opened) useStore.getState().load(opened.dir, opened.project);
}

export async function importPptx(): Promise<void> {
  if (!(await leaveCurrent())) return;
  const imported = await guard(() => api().importPptx());
  if (!imported) return;
  const state = useStore.getState();
  state.load(imported.dir, imported.project);
  state.setReport({ report: imported.report, sourceName: imported.sourceName });
}

export async function save(): Promise<boolean> {
  const { dir, project } = useStore.getState();
  if (!dir || !project) return false;
  const ok = await guard(async () => {
    await api().saveProject(dir, project);
    return true;
  });
  // What was written is what counts as saved, even if editing went on meanwhile.
  if (ok) useStore.setState({ saved: project });
  return ok === true;
}

export async function preview(): Promise<void> {
  const state = useStore.getState();
  if (!state.dir || !state.project) return;
  const index = Math.max(
    0,
    state.project.scenes.findIndex((s) => s.id === state.sceneId),
  );
  await guard(() => api().preview(state.dir!, state.project!, index));
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} MB`;
}

export async function exportHtml(): Promise<void> {
  const state = useStore.getState();
  if (!state.dir || !state.project) return;
  if (state.project.scenes.length === 0) {
    state.setNotice({ kind: 'error', text: 'Prosjektet har ingen lysark å eksportere.' });
    return;
  }
  const summary = await guard(() => api().exportHtml(state.dir!, state.project!));
  if (!summary) return;
  const parts = [`HTML-fila er lagret (${megabytes(summary.bytes)}).`];
  if (summary.sidecarFiles > 0) {
    parts.push(
      `${summary.sidecarFiles} stor${summary.sidecarFiles === 1 ? '' : 'e'} video${summary.sidecarFiles === 1 ? '' : 'er'} ligger i mappa ved siden av og må følge med fila.`,
    );
  }
  if (summary.hasSound) parts.push('Stemmen din er med: studentene kan trykke «Spill av».');
  if (summary.logoMissing) parts.push('Logoen er ikke med, fordi USNs logofiler ikke er valgt.');
  state.setNotice({ kind: 'info', text: parts.join(' '), path: summary.path });
}

/** Exports the lecture as video with the given choices. The dialog shows the progress. */
export async function exportVideo(choices: NonNullable<Project['video']>): Promise<void> {
  const state = useStore.getState();
  if (!state.dir || !state.project) return;
  if (state.project.scenes.length === 0) {
    state.setNotice({ kind: 'error', text: 'Prosjektet har ingen lysark å lage video av.' });
    return;
  }
  // The choices are part of the project, so the next export starts from them.
  state.update((draft) => {
    draft.video = choices;
  });
  const { dir, project } = useStore.getState();
  state.setVideoProgress({ phase: 'sound', frame: 0, frames: 1 });
  const stop = api().onVideoProgress((progress) => useStore.getState().setVideoProgress(progress));
  try {
    const summary = await guard(() => api().exportVideo(dir!, project!));
    if (!summary) return;
    const parts = [
      `Videoen er lagret (${formatTime(summary.seconds)}, ${megabytes(summary.bytes)}).`,
      summary.captions
        ? 'Tekstingen ligger i en egen fil ved siden av (samme navn, .vtt).'
        : 'Ingen lysark har manus, så det er ikke laget teksting.',
    ];
    useStore.getState().setNotice({ kind: 'info', text: parts.join(' '), path: summary.path });
    useStore.getState().setVideoDialog(false);
  } finally {
    stop();
    useStore.getState().setVideoProgress(null);
  }
}

export function cancelVideo(): void {
  api().cancelVideo();
}

export function hasFfmpeg(): Promise<boolean> {
  return api()
    .hasFfmpeg()
    .catch(() => false);
}

/**
 * Stores what was recorded for one slide and makes it the slide's sound.
 * `stepAts` are the times the owner pressed on to each step, in seconds
 * from the start of this recording. With `keepBefore`, the slide's sound
 * before that time is kept and the recording follows it.
 */
export async function saveRecording(
  sceneId: string,
  samples: Float32Array,
  stepAts: ReadonlyArray<number | undefined>,
  keepBefore?: number,
): Promise<boolean> {
  const { dir, project } = useStore.getState();
  const index = project?.scenes.findIndex((s) => s.id === sceneId) ?? -1;
  if (!dir || !project || index < 0) return false;
  const wav = encodeWav(samples);
  const added = await guard(() => api().addRecording(dir, wav, `Opptak lysark ${index + 1}`));
  if (!added) return false;
  rememberSamples(added.asset.file, wavSamples(wav));
  useStore.getState().update((draft) => {
    const scene = draft.scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    draft.assets[added.id] = added.asset;
    const id = (): string => newId('c');
    if (keepBefore !== undefined && keepBefore > 0 && trackDuration(scene.audio) > 0) {
      continueSound(scene, keepBefore, added.id, added.seconds, stepAts, id);
    } else {
      replaceSound(scene, added.id, added.seconds, stepAts, id);
    }
  });
  return true;
}

/** Lets the owner pick a sound file and puts it at the end of the current slide's sound. */
export async function importSoundFile(): Promise<void> {
  const state = useStore.getState();
  const scene = currentScene(state);
  if (!state.dir || !scene) return;
  const added = await guard(() => api().importSound(state.dir!));
  if (!added) return;
  useStore.getState().update((draft) => {
    const target = draft.scenes.find((s) => s.id === scene.id);
    if (!target) return;
    draft.assets[added.id] = added.asset;
    appendSound(target, added.id, added.seconds, () => newId('c'));
  });
}

export async function packProject(): Promise<void> {
  const state = useStore.getState();
  if (!state.dir || !state.project) return;
  // The package is made from the files on disk, so save first.
  if (isDirty(state) && !(await save())) return;
  const packed = await guard(() => api().packProject(state.dir!));
  if (packed) {
    state.setNotice({
      kind: 'info',
      text: `Prosjektet er pakket til én fil (${megabytes(packed.bytes)}).`,
      path: packed.path,
    });
  }
}

export async function unpackProject(): Promise<void> {
  if (!(await leaveCurrent())) return;
  const opened = await guard(() => api().unpackProject());
  if (opened) useStore.getState().load(opened.dir, opened.project);
}

function imageSize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 400, h: img.naturalHeight || 300 });
    img.onerror = () => reject(new Error('Bildet kan ikke leses.'));
    img.src = url;
  });
}

/** Size of a video, and whether this program can show its picture at all. */
function videoSize(url: string): Promise<{ w: number; h: number; playable: boolean }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () =>
      resolve({
        w: video.videoWidth || 16,
        h: video.videoHeight || 9,
        playable: video.videoWidth > 0,
      });
    video.onerror = () => resolve({ w: 16, h: 9, playable: false });
    video.src = url;
  });
}

/** Tells the owner when a video file was added whose picture cannot be shown. */
function warnIfUnplayable(playable: boolean): void {
  if (playable) return;
  useStore.getState().setNotice({
    kind: 'error',
    text:
      'Lysark kan ikke vise bildet i denne videoen, fordi den er kodet på en måte som ikke støttes ' +
      '(for eksempel H.265 fra mobil). Den vil heller ikke virke i alle nettlesere. ' +
      'Lagre den som MP4 med H.264 eller som WebM, og bytt fila.',
  });
}

/** Largest size that fits a box while keeping the proportions. */
function fitInside(
  size: { w: number; h: number },
  maxW: number,
  maxH: number,
): { w: number; h: number } {
  const k = Math.min(maxW / size.w, maxH / size.h, 1);
  return { w: Math.max(8, Math.round(size.w * k)), h: Math.max(8, Math.round(size.h * k)) };
}

function addElement(element: Element): void {
  const state = useStore.getState();
  state.updateScene((scene) => {
    scene.elements.push(element);
  });
  state.select([element.id]);
}

/**
 * Opens the media dialog (search in Wikimedia Commons, upload, or what the
 * project already has) and resolves with the asset the owner chose.
 */
export function pickMedia(kind: 'image' | 'video'): Promise<string | undefined> {
  return new Promise((resolve) => {
    const state = useStore.getState();
    state.mediaRequest?.resolve(undefined);
    state.setMediaRequest({
      kind,
      resolve: (assetId) => {
        useStore.getState().setMediaRequest(null);
        resolve(assetId);
      },
    });
  });
}

function assetFile(assetId: string): string | undefined {
  return useStore.getState().project?.assets[assetId]?.file;
}

export async function insertImage(): Promise<void> {
  const assetId = await pickMedia('image');
  const file = assetId ? assetFile(assetId) : undefined;
  if (!assetId || !file) return;
  const size = await guard(() => imageSize(mediaUrl(file)));
  const state = useStore.getState();
  const scene = currentScene(state);
  if (!size || !state.project || !scene) return;
  const fitted = fitInside(size, 900, 620);
  addElement({
    id: newId('e'),
    type: 'image',
    asset: assetId,
    alt: '',
    box: placeNew(scene, getTheme(state.project), fitted.w, fitted.h),
  });
}

export async function replaceImage(elementId: string): Promise<void> {
  const assetId = await pickMedia('image');
  const file = assetId ? assetFile(assetId) : undefined;
  if (!assetId || !file) return;
  const size = await guard(() => imageSize(mediaUrl(file)));
  if (!size) return;
  useStore.getState().updateScene((scene) => {
    const el = scene.elements.find((e) => e.id === elementId);
    if (!el || el.type !== 'image') return;
    el.asset = assetId;
    delete el.crop;
    el.box.h = Math.round(el.box.w * (size.h / size.w));
  });
}

export async function insertVideoFile(): Promise<void> {
  const assetId = await pickMedia('video');
  const file = assetId ? assetFile(assetId) : undefined;
  if (!assetId || !file) return;
  const size = await videoSize(mediaUrl(file));
  const state = useStore.getState();
  const scene = currentScene(state);
  if (!state.project || !scene) return;
  const fitted = fitInside({ w: size.w * 100, h: size.h * 100 }, 960, 540);
  addElement({
    id: newId('e'),
    type: 'video',
    source: { kind: 'asset', asset: assetId },
    title: '',
    box: placeNew(scene, getTheme(state.project), fitted.w, fitted.h),
  });
}

export function insertVideoLink(): void {
  const state = useStore.getState();
  const scene = currentScene(state);
  if (!state.project || !scene) return;
  addElement({
    id: newId('e'),
    type: 'video',
    source: { kind: 'url', url: '' },
    title: '',
    box: placeNew(scene, getTheme(state.project), 640, 360),
  });
}

/** Lets the owner choose a media file through the media dialog; returns its asset id. */
export function addAsset(kind: 'image' | 'video'): Promise<string | undefined> {
  return pickMedia(kind);
}

/** Opens the system's file dialog and copies the chosen file into the project folder. */
export async function uploadMedia(kind: 'image' | 'video'): Promise<AddedMedia | undefined> {
  const state = useStore.getState();
  if (!state.dir) return undefined;
  const added = await guard(() => api().addMedia(state.dir!, kind));
  if (!added) return undefined;
  if (kind === 'video') {
    warnIfUnplayable((await videoSize(mediaUrl(added.asset.file))).playable);
  }
  return added;
}

/** Sends the owner's search words to Wikimedia Commons. */
export function searchCommons(query: string, offset: number): Promise<CommonsResult> {
  return api().searchCommons(query, offset);
}

export function commonsPreview(title: string): Promise<CommonsPicture> {
  return api().commonsPreview(title);
}

/** Downloads a picture from Commons into the project folder, with its credit. */
export async function downloadCommonsPicture(title: string): Promise<AddedMedia> {
  const { dir } = useStore.getState();
  if (!dir) throw new Error('Ingen prosjekt er åpent.');
  return api().addCommonsPicture(dir, title);
}

/** Fetches YouTube's still picture of a video and adds it to the project. Returns its asset id. */
export async function fetchYouTubeStill(url: string): Promise<string | undefined> {
  const state = useStore.getState();
  if (!state.dir) return undefined;
  const added = await guard(() => api().addYouTubeStill(state.dir!, url));
  if (!added) return undefined;
  useStore.getState().update((draft) => {
    draft.assets[added.id] = added.asset;
  });
  return added.id;
}

export async function refreshLogo(): Promise<void> {
  const status = await guard(() => api().logoStatus());
  if (status) useStore.getState().setLogo(status);
}

export async function chooseLogoFolder(): Promise<void> {
  const status = await guard(() => api().chooseLogoFolder());
  if (status) useStore.getState().setLogo(status);
}

export async function clearLogos(): Promise<void> {
  const status = await guard(() => api().clearLogos());
  if (status) useStore.getState().setLogo(status);
}

export function showInFolder(path: string): void {
  void guard(() => api().showInFolder(path));
}

export { megabytes };
