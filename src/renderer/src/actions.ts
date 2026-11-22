// Things the owner can do that involve files: open, save, import, export,
// preview and inserting media. Errors end up as a notice, never silently.
import { mediaUrl, type LysarkApi } from '../../shared/api';
import { newId } from '../../shared/format/factory';
import type { Asset, Element } from '../../shared/format/schema';
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
    state.setNotice({ kind: 'error', text: 'Prosjektet har ingen scener å eksportere.' });
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
  if (summary.logoMissing) parts.push('Logoen er ikke med, fordi USNs logofiler ikke er valgt.');
  state.setNotice({ kind: 'info', text: parts.join(' '), path: summary.path });
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

function videoSize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () =>
      resolve({ w: video.videoWidth || 16, h: video.videoHeight || 9 });
    video.onerror = () => resolve({ w: 16, h: 9 });
    video.src = url;
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

function addElement(element: Element, assetId?: string, asset?: Asset): void {
  const state = useStore.getState();
  state.updateScene((scene, draft) => {
    if (assetId && asset) draft.assets[assetId] = asset;
    scene.elements.push(element);
  });
  state.select([element.id]);
}

export async function insertImage(): Promise<void> {
  const state = useStore.getState();
  const scene = currentScene(state);
  if (!state.dir || !state.project || !scene) return;
  const added = await guard(() => api().addMedia(state.dir!, 'image'));
  if (!added) return;
  const size = await guard(() => imageSize(mediaUrl(added.asset.file)));
  if (!size) return;
  const theme = getTheme(state.project);
  const fitted = fitInside(size, 900, 620);
  addElement(
    {
      id: newId('e'),
      type: 'image',
      asset: added.id,
      alt: '',
      box: placeNew(scene, theme, fitted.w, fitted.h),
    },
    added.id,
    added.asset,
  );
}

export async function replaceImage(elementId: string): Promise<void> {
  const state = useStore.getState();
  if (!state.dir) return;
  const added = await guard(() => api().addMedia(state.dir!, 'image'));
  if (!added) return;
  const size = await guard(() => imageSize(mediaUrl(added.asset.file)));
  if (!size) return;
  state.updateScene((scene, draft) => {
    const el = scene.elements.find((e) => e.id === elementId);
    if (!el || el.type !== 'image') return;
    draft.assets[added.id] = added.asset;
    el.asset = added.id;
    delete el.crop;
    el.box.h = Math.round(el.box.w * (size.h / size.w));
  });
}

export async function insertVideoFile(): Promise<void> {
  const state = useStore.getState();
  const scene = currentScene(state);
  if (!state.dir || !state.project || !scene) return;
  const added = await guard(() => api().addMedia(state.dir!, 'video'));
  if (!added) return;
  const size = await videoSize(mediaUrl(added.asset.file));
  const fitted = fitInside({ w: size.w * 100, h: size.h * 100 }, 960, 540);
  addElement(
    {
      id: newId('e'),
      type: 'video',
      source: { kind: 'asset', asset: added.id },
      title: '',
      box: placeNew(scene, getTheme(state.project), fitted.w, fitted.h),
    },
    added.id,
    added.asset,
  );
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

/** Adds a media file to the project and returns its asset id. */
export async function addAsset(kind: 'image' | 'video'): Promise<string | undefined> {
  const state = useStore.getState();
  if (!state.dir) return undefined;
  const added = await guard(() => api().addMedia(state.dir!, kind));
  if (!added) return undefined;
  state.update((draft) => {
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
