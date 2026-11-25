// The bridge between the sandboxed interface and the main process. Only
// the calls listed in LysarkApi are exposed.
import { contextBridge, ipcRenderer } from 'electron';
import type { LysarkApi, MenuCommand, VideoProgress } from '../shared/api';

type Reply<T> = { ok: true; value: T } | { ok: false; message: string };

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const reply = (await ipcRenderer.invoke(channel, ...args)) as Reply<T>;
  if (!reply.ok) throw new Error(reply.message);
  return reply.value;
}

const api: LysarkApi = {
  newProject: () => call('lysark:new'),
  openProject: (dir) => call('lysark:open', dir),
  importPptx: () => call('lysark:import'),
  saveProject: (dir, project) => call('lysark:save', dir, project),
  addMedia: (dir, kind) => call('lysark:add-media', dir, kind),
  searchCommons: (query, offset) => call('lysark:commons-search', query, offset),
  commonsPreview: (title) => call('lysark:commons-preview', title),
  addCommonsPicture: (dir, title) => call('lysark:commons-add', dir, title),
  searchOpenverse: (query, page) => call('lysark:openverse-search', query, page),
  fetchOpenversePicture: (id) => call('lysark:openverse-fetch', id),
  addOpenversePicture: (dir, id, scaled) => call('lysark:openverse-add', dir, id, scaled),
  addYouTubeStill: (dir, url) => call('lysark:youtube-still', dir, url),
  exportHtml: (dir, project) => call('lysark:export', dir, project),
  exportVideo: (dir, project, request) => call('lysark:export-video', dir, project, request),
  cancelVideo: () => ipcRenderer.send('lysark:cancel-video'),
  onVideoProgress: (listener) => {
    const handler = (_event: unknown, progress: VideoProgress): void => listener(progress);
    ipcRenderer.on('lysark:video-progress', handler);
    return () => ipcRenderer.removeListener('lysark:video-progress', handler);
  },
  hasFfmpeg: () => call('lysark:has-ffmpeg'),
  addRecording: (dir, wav, name) => call('lysark:add-recording', dir, wav, name),
  beginCameraFilm: (dir) => call('lysark:camera-film-begin', dir),
  appendCameraFilm: (film, piece) => call('lysark:camera-film-append', film, piece),
  endCameraFilm: (film, name) => call('lysark:camera-film-end', film, name),
  dropCameraFilm: (film) => call('lysark:camera-film-drop', film),
  importSound: (dir) => call('lysark:import-sound', dir),
  packProject: (dir) => call('lysark:pack', dir),
  unpackProject: () => call('lysark:unpack'),
  openHtmlFile: () => call('lysark:open-html'),
  pickPdf: () => call('lysark:pdf-pick'),
  beginPdfImport: () => call('lysark:pdf-begin'),
  addPdfPage: (page, data) => call('lysark:pdf-page', page, data),
  finishPdfImport: (project) => call('lysark:pdf-finish', project),
  cancelPdfImport: () => call('lysark:pdf-cancel'),
  preview: (dir, project, sceneIndex) => call('lysark:preview', dir, project, sceneIndex),
  recentProjects: () => call('lysark:recent'),
  initialProject: () => call('lysark:initial'),
  logoStatus: () => call('lysark:logo-status'),
  chooseLogoFolder: () => call('lysark:choose-logo-folder'),
  clearLogos: () => call('lysark:clear-logos'),
  chooseClosingAnimation: () => call('lysark:choose-closing'),
  clearClosingAnimation: () => call('lysark:clear-closing'),
  showInFolder: (path) => call('lysark:show-in-folder', path),
  setDocumentState: (state) => ipcRenderer.send('lysark:document-state', state),
  closeWindow: () => ipcRenderer.send('lysark:close-window'),
  onCommand: (listener) => {
    const handler = (_event: unknown, command: MenuCommand): void => listener(command);
    ipcRenderer.on('lysark:command', handler);
    return () => ipcRenderer.removeListener('lysark:command', handler);
  },
};

contextBridge.exposeInMainWorld('lysark', api);
