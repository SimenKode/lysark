// Electron main process: the window, the Norwegian menu, file dialogs and
// the calls the interface is allowed to make. The interface runs sandboxed
// and reaches files only through these calls.
import { BrowserWindow, Menu, app, dialog, ipcMain, protocol, session, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import type {
  AddedMedia,
  AddedSound,
  CommonsPicture,
  CommonsResult,
  ExportSummary,
  ImportedProject,
  LogoLanguage,
  LogoStatus,
  LogoVariant,
  MenuCommand,
  OpenedHtml,
  OpenedProject,
  VideoProgress,
  VideoRequest,
  VideoSummary,
  PickedPdf,
} from '../shared/api';
import type { Project } from '../shared/format/schema';
import { webPictureUrl } from '../shared/api';
import { PDF_LIMIT_BYTES } from '../shared/limits';
import type { CommonsHit } from './commons';
import { SOUND_EXTENSIONS, addRecording, importSound, restoreSound } from './audio';
import { buildPreview, exportHtml } from './exportHtml';
import { adoptClosingAnimation } from './closing';
import { ffmpegPath, mediaSeconds } from './ffmpeg';
import { exportVideo, type VideoJob } from './video';
import { isPreviewUrl, servePreview, stopPreviewServer } from './previewServer';
import { commonsPreview, downloadCommons, proxyPicture, searchCommons, youtubeStill } from './web';
import {
  MEDIA_EXTENSIONS,
  PROJECT_FILE,
  addMediaBytes,
  addMediaFile,
  addPagePicture,
  beginImportFolder,
  createProject,
  discardImportFolder,
  finishImportFolder,
  importPptxToFolder,
  mediaPath,
  mimeOf,
  packProject,
  readHtmlExport,
  readProject,
  saveProject,
  unpackProject,
  writeHtmlExport,
  type ImportFolder,
} from './projectIo';
import {
  CLOSING_EXTENSIONS,
  clearClosingAnimation,
  clearLogos,
  closingAnimation,
  logoFile,
  logoStatus,
  recentProjects,
  rememberProject,
  setClosingAnimation,
  setLogosFromFolder,
} from './settings';

const APP_NAME = 'Lysark';
// The same settings folder whether the program is run from source or installed.
app.setName(APP_NAME);
// Tests run the program without putting a window on the screen.
const HIDDEN = process.env.LYSARK_HIDDEN === '1';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lysark-media',
    // The interface reads recordings with fetch (to draw and play them). Its own
    // page has another origin than this scheme, so the scheme must take part in
    // CORS, and the answers must say that the interface may read them.
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
  // Gallery pictures from Wikimedia Commons, fetched by the main process.
  { scheme: 'lysark-web', privileges: { standard: true, secure: true } },
]);

let mainWindow: BrowserWindow | null = null;
let previewWindow: BrowserWindow | null = null;
/** Folder of the project that is open; media is only served from here. */
let currentDir: string | null = null;
/**
 * The PDF import that is under way: the file the owner picked, and, once he
 * has said where the project goes, its folder. The interface draws the pages
 * and can only add pictures to this folder.
 */
let pdfImport: { sourceName: string; folder: ImportFolder | null } | null = null;
let documentState = { dirty: false, title: '' };
/** The video export that is running, if any. One at a time. */
let videoJob: VideoJob | null = null;
let closeConfirmed = false;

function send(command: MenuCommand): void {
  mainWindow?.webContents.send('lysark:command', command);
}

function updateTitle(): void {
  if (!mainWindow) return;
  const name = documentState.title ? `${documentState.title} – ${APP_NAME}` : APP_NAME;
  mainWindow.setTitle(documentState.dirty ? `• ${name}` : name);
}

// ---------- Media protocol ----------

/** Serves a file with support for byte ranges, which video seeking needs. */
function serveFile(file: string, mime: string, request: Request): Response {
  if (!existsSync(file)) return new Response('Not found', { status: 404 });
  const size = statSync(file).size;
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  const headers: Record<string, string> = {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
    // Only the program's own interface can ask at all; it may read what it gets.
    'Access-Control-Allow-Origin': '*',
  };
  if (range && (range[1] || range[2])) {
    let start = range[1] ? parseInt(range[1], 10) : size - parseInt(range[2]!, 10);
    let end = range[1] && range[2] ? parseInt(range[2], 10) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1),
      },
    });
  }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, {
    status: 200,
    headers: { ...headers, 'Content-Length': String(size) },
  });
}

function registerMediaProtocol(): void {
  protocol.handle('lysark-media', (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname === 'brand' && url.pathname === '/closing') {
        const film = closingAnimation();
        return film
          ? serveFile(film.file, film.mime, request)
          : new Response(null, { status: 404 });
      }
      if (url.hostname === 'brand') {
        const match = /^\/(nb|en)-(light|dark)$/.exec(url.pathname);
        const file = match
          ? logoFile(match[1] as LogoLanguage, match[2] as LogoVariant)
          : undefined;
        return file
          ? serveFile(file.file, file.mime, request)
          : new Response(null, { status: 404 });
      }
      if (url.hostname === 'project' && currentDir) {
        const name = decodeURIComponent(url.pathname.slice(1));
        if (!/^[A-Za-z0-9._-]+$/.test(name)) return new Response(null, { status: 400 });
        const file = mediaPath(currentDir, `media/${name}`);
        return serveFile(file, mimeOf(file) ?? 'application/octet-stream', request);
      }
    } catch {
      // Fall through to "not found".
    }
    return new Response(null, { status: 404 });
  });
}

/**
 * The interface itself never reaches the network. Whatever it asks for over
 * http(s) is refused here, except its own development server. What the owner
 * asks for in the media dialog goes through the main process (web.ts).
 */
function blockNetworkInInterface(): void {
  const dev = process.env.ELECTRON_RENDERER_URL;
  const devOrigin = dev ? new URL(dev).origin : null;
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (details, callback) => {
      let allowed = false;
      try {
        const url = new URL(details.url);
        const asHttp = url.origin.replace(/^ws/, 'http');
        allowed = devOrigin !== null && asHttp === devOrigin;
      } catch {
        allowed = false;
      }
      callback({ cancel: !allowed });
    },
  );
}

/**
 * The program gives itself leave to use the microphone, and nothing else:
 * sound only, never the camera, and only for its own window. Recordings are
 * stored in the project folder and sent nowhere.
 */
function allowMicrophoneOnly(): void {
  const own = (contents: Electron.WebContents | null): boolean =>
    !!contents && !!mainWindow && contents.id === mainWindow.webContents.id;
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    const types = (details as { mediaTypes?: string[] }).mediaTypes ?? [];
    const soundOnly = types.length > 0 && types.every((type) => type === 'audio');
    callback(permission === 'media' && soundOnly && own(contents));
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) => {
    if (permission !== 'media') return false;
    const type = (details as { mediaType?: string }).mediaType;
    return own(contents) && type !== 'video';
  });
  // Every other session (the preview, the network session) is given nothing.
  for (const partition of ['lysark-preview', 'lysark-web']) {
    const other = session.fromPartition(partition);
    other.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    other.setPermissionCheckHandler(() => false);
  }
}

function registerWebPictureProtocol(): void {
  protocol.handle('lysark-web', (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname === 'picture') {
        return proxyPicture(decodeURIComponent(url.pathname.slice(1)));
      }
    } catch {
      // Fall through to "not found".
    }
    return new Response(null, { status: 404 });
  });
}

function toPicture(hit: CommonsHit): CommonsPicture {
  return {
    title: hit.title,
    thumbUrl: webPictureUrl(hit.thumbUrl),
    width: hit.width,
    height: hit.height,
    credit: hit.credit,
  };
}

// ---------- Window and menu ----------

function showAbout(): void {
  if (!mainWindow) return;
  void dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: `Om ${APP_NAME}`,
    message: `${APP_NAME} ${app.getVersion()}`,
    detail:
      'Gjør PowerPoint-forelesninger om til interaktiv HTML og video med stemme, i USNs visuelle profil.\n\n' +
      'Lysark er fri programvare under GNU General Public License, versjon 3 eller senere, ' +
      'og kommer uten noen garanti. Forelesningene du eksporterer, er dine egne.\n\n' +
      'Bygd med fri programvare (Electron, React, ProseMirror, Zod, fflate, fast-xml-parser, pdf.js). ' +
      'Skriftene Liberation Sans og Liberation Serif følger med under SIL Open Font License 1.1.\n\n' +
      'Video og lyd lages med FFmpeg, et eget program som ligger ved siden av Lysark (mappa ' +
      '«ffmpeg» blant programfilene). FFmpeg har lisensen GNU GPL versjon 3; lisensteksten og ' +
      'lenke til kildekoden ligger i den mappa. Lisenstekstene til alt som er bygd inn i ' +
      'Lysark, ligger i mappa «licenses» samme sted.\n\n' +
      'Programmet samler ingenting. Det kontakter nettet bare når du selv søker etter et bilde i ' +
      'Wikimedia Commons eller henter et forhåndsbilde fra YouTube, og sender da bare søkeordene. ' +
      'Mikrofonen brukes bare når du leser inn; opptakene lagres i prosjektmappa og sendes ingen steder.',
    buttons: ['Lukk'],
  });
}

function buildMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Fil',
      submenu: [
        { label: 'Nytt prosjekt …', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: 'Åpne prosjekt …', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { label: 'Importer PowerPoint …', accelerator: 'CmdOrCtrl+I', click: () => send('import') },
        { label: 'Importer PDF …', click: () => send('import-pdf') },
        { type: 'separator' },
        { label: 'Lagre', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { type: 'separator' },
        { label: 'Forhåndsvis', accelerator: 'F5', click: () => send('preview') },
        { label: 'Eksporter HTML …', accelerator: 'CmdOrCtrl+E', click: () => send('export') },
        {
          label: 'Eksporter video …',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => send('export-video'),
        },
        { type: 'separator' },
        { label: 'Les inn stemme …', accelerator: 'CmdOrCtrl+R', click: () => send('record') },
        { type: 'separator' },
        { label: 'Lagre som én fil …', click: () => send('pack') },
        { label: 'Åpne prosjekt lagret som én fil …', click: () => send('unpack') },
        { label: 'Åpne HTML-fil …', click: () => send('open-html') },
        { type: 'separator' },
        { label: 'Logo fra USN …', click: () => send('settings') },
        { type: 'separator' },
        { label: 'Avslutt', role: 'quit' },
      ],
    },
    {
      label: 'Rediger',
      submenu: [
        { label: 'Angre', accelerator: 'CmdOrCtrl+Z', click: () => send('undo') },
        { label: 'Gjør om', accelerator: 'CmdOrCtrl+Shift+Z', click: () => send('redo') },
        { type: 'separator' },
        { label: 'Klipp ut', role: 'cut' },
        { label: 'Kopier', role: 'copy' },
        { label: 'Lim inn', role: 'paste' },
        { label: 'Merk alt', role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Lag kopi av element',
          accelerator: 'CmdOrCtrl+D',
          click: () => send('duplicate'),
        },
        { label: 'Slett element', click: () => send('delete') },
      ],
    },
    {
      label: 'Vis',
      submenu: [
        { label: 'Vis rutenett', accelerator: 'CmdOrCtrl+G', click: () => send('toggle-grid') },
        { type: 'separator' },
        { label: 'Fullskjerm', role: 'togglefullscreen' },
        ...(app.isPackaged
          ? []
          : ([
              { type: 'separator' },
              { label: 'Utviklerverktøy', role: 'toggleDevTools' },
            ] as MenuItemConstructorOptions[])),
      ],
    },
    {
      label: 'Hjelp',
      submenu: [{ label: `Om ${APP_NAME}`, click: showAbout }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: APP_NAME,
    backgroundColor: '#fff5ee',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  mainWindow.once('ready-to-show', () => {
    if (!HIDDEN) mainWindow?.show();
  });
  // Links never open inside the program; real web links go to the browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.on('page-title-updated', (event) => event.preventDefault());

  mainWindow.on('close', (event) => {
    if (!documentState.dirty || closeConfirmed || !mainWindow) return;
    event.preventDefault();
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      message: 'Vil du lagre endringene før du avslutter?',
      buttons: ['Lagre', 'Ikke lagre', 'Avbryt'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    if (choice === 0) send('save-then-close');
    else if (choice === 1) {
      closeConfirmed = true;
      mainWindow.close();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    previewWindow?.close();
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) void mainWindow.loadURL(devUrl);
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
}

// ---------- Calls from the interface ----------

/** Wraps a handler so that errors reach the interface as readable text. */
function handle<A extends unknown[], R>(channel: string, fn: (...args: A) => R | Promise<R>): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true, value: await fn(...(args as A)) };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  });
}

function opened(dir: string, project: Project): OpenedProject {
  currentDir = dir;
  rememberProject(dir);
  return { dir, project };
}

async function askForNewFolder(suggestedName: string): Promise<string | null> {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Hvor skal prosjektet ligge?',
    message: 'Lysark lager en mappe med dette navnet.',
    buttonLabel: 'Opprett',
    defaultPath: join(app.getPath('documents'), suggestedName),
    properties: ['createDirectory'],
  });
  return result.canceled || !result.filePath ? null : result.filePath;
}

/** Drops a PDF import that was not finished, and takes away what it wrote. */
function dropPdfImport(): void {
  if (pdfImport?.folder) discardImportFolder(pdfImport.folder);
  pdfImport = null;
}

/** A project folder (or its prosjekt.json) given on the command line. */
function initialProjectDir(): string | null {
  for (const arg of process.argv.slice(1)) {
    if (arg.startsWith('-')) continue;
    try {
      const dir = statSync(arg).isDirectory()
        ? arg
        : basename(arg) === PROJECT_FILE
          ? dirname(arg)
          : null;
      if (dir && existsSync(join(dir, PROJECT_FILE))) return resolve(dir);
    } catch {
      // Not a path; ignore.
    }
  }
  return null;
}

function registerHandlers(): void {
  handle('lysark:initial', (): string | null => initialProjectDir());

  handle('lysark:new', async (): Promise<OpenedProject | null> => {
    const dir = await askForNewFolder('Ny forelesning');
    if (!dir) return null;
    return opened(dir, createProject(dir));
  });

  handle('lysark:open', async (dir?: string): Promise<OpenedProject | null> => {
    let target = dir;
    if (!target) {
      if (!mainWindow) return null;
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Åpne prosjekt',
        buttonLabel: 'Åpne',
        filters: [{ name: 'Lysark-prosjekt', extensions: ['json'] }],
        properties: ['openFile'],
      });
      const file = result.filePaths[0];
      if (result.canceled || !file) return null;
      if (basename(file) !== PROJECT_FILE) {
        throw new Error(`Velg fila ${PROJECT_FILE} i prosjektmappa.`);
      }
      target = dirname(file);
    }
    return opened(target, readProject(target));
  });

  handle('lysark:import', async (): Promise<ImportedProject | null> => {
    if (!mainWindow) return null;
    const pick = await dialog.showOpenDialog(mainWindow, {
      title: 'Importer PowerPoint',
      buttonLabel: 'Importer',
      filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
      properties: ['openFile'],
    });
    const source = pick.filePaths[0];
    if (pick.canceled || !source) return null;
    const dir = await askForNewFolder(basename(source, '.pptx'));
    if (!dir) return null;
    const imported = importPptxToFolder(source, dir);
    // USN's closing animation on the last slide plays by itself from now on.
    const adopted = adoptClosingAnimation(dir, imported.project);
    const { project } = adopted;
    if (project !== imported.project) saveProject(dir, project);
    // The report said the video covered the logo's place on those slides; that is settled.
    const report = {
      ...imported.report,
      warnings: imported.report.warnings.filter(
        (w) => !(adopted.slides.includes(w.slide) && w.message.startsWith('Logoen er slått av')),
      ),
    };
    return {
      ...opened(dir, project),
      report,
      sourceName: basename(source),
      ...(adopted.slides.length > 0 ? { closingSlides: adopted.slides } : {}),
    };
  });

  handle('lysark:save', (dir: string, project: Project): void => {
    saveProject(dir, project);
  });

  handle(
    'lysark:add-media',
    async (dir: string, kind: 'image' | 'video'): Promise<AddedMedia | null> => {
      if (!mainWindow) return null;
      const result = await dialog.showOpenDialog(mainWindow, {
        title: kind === 'image' ? 'Velg bilde' : 'Velg video',
        buttonLabel: 'Sett inn',
        filters: [
          { name: kind === 'image' ? 'Bilder' : 'Video', extensions: MEDIA_EXTENSIONS[kind] },
        ],
        properties: ['openFile'],
      });
      const file = result.filePaths[0];
      if (result.canceled || !file) return null;
      return addMediaFile(dir, file, kind);
    },
  );

  handle('lysark:commons-search', async (query: string, offset: number): Promise<CommonsResult> => {
    const result = await searchCommons(String(query ?? ''), Number(offset) || 0);
    return { hits: result.hits.map(toPicture), ...(result.next ? { next: result.next } : {}) };
  });

  handle('lysark:commons-preview', async (title: string): Promise<CommonsPicture> => {
    return toPicture(await commonsPreview(String(title)));
  });

  handle('lysark:commons-add', async (dir: string, title: string): Promise<AddedMedia> => {
    const picture = await downloadCommons(String(title));
    return addMediaBytes(dir, picture.data, picture.extension, {
      name: picture.hit.title.replace(/^[^:]+:/, ''),
      credit: picture.hit.credit,
    });
  });

  handle('lysark:youtube-still', async (dir: string, url: string): Promise<AddedMedia> => {
    const still = await youtubeStill(String(url));
    return addMediaBytes(dir, still.data, '.jpg', { name: `youtube-${still.id}.jpg` });
  });

  handle('lysark:export', async (dir: string, project: Project): Promise<ExportSummary | null> => {
    if (!mainWindow) return null;
    const safeName = (project.meta.title || 'forelesning').replace(/[\\/:*?"<>|]+/g, ' ').trim();
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Eksporter HTML',
      buttonLabel: 'Eksporter',
      defaultPath: join(dirname(dir), `${safeName || 'forelesning'}.html`),
      filters: [{ name: 'HTML', extensions: ['html'] }],
    });
    if (result.canceled || !result.filePath) return null;
    return await exportHtml(dir, project, result.filePath);
  });

  handle(
    'lysark:export-video',
    async (dir: string, project: Project, asked: VideoRequest): Promise<VideoSummary | null> => {
      if (!mainWindow) return null;
      if (videoJob) throw new Error('En video eksporteres allerede.');
      const request: VideoRequest = {
        format: asked?.format === 'gif' ? 'gif' : 'mp4',
        from: Number(asked?.from) || 0,
        to: Number.isFinite(Number(asked?.to)) ? Number(asked.to) : project.scenes.length - 1,
        gifWidth: Number(asked?.gifWidth) || 640,
      };
      const gif = request.format === 'gif';
      const extension = gif ? 'gif' : 'mp4';
      const safeName = (project.meta.title || 'forelesning').replace(/[\\/:*?"<>|]+/g, ' ').trim();
      const result = await dialog.showSaveDialog(mainWindow, {
        title: gif ? 'Eksporter GIF' : 'Eksporter video',
        buttonLabel: 'Eksporter',
        defaultPath: join(dirname(dir), `${safeName || 'forelesning'}.${extension}`),
        filters: [
          gif ? { name: 'GIF', extensions: ['gif'] } : { name: 'MP4-video', extensions: ['mp4'] },
        ],
      });
      if (result.canceled || !result.filePath) return null;
      const outFile = new RegExp(`\\.${extension}$`, 'i').test(result.filePath)
        ? result.filePath
        : `${result.filePath}.${extension}`;
      const devUrl = process.env.ELECTRON_RENDERER_URL;
      videoJob = exportVideo({
        dir,
        project,
        request,
        outFile,
        logo: logoStatus(),
        loadFramePage: (window) =>
          devUrl
            ? window.loadURL(`${devUrl}/frame.html`)
            : window.loadFile(join(__dirname, '../renderer/frame.html')),
        onProgress: (progress: VideoProgress) =>
          mainWindow?.webContents.send('lysark:video-progress', progress),
      });
      try {
        return await videoJob.done;
      } finally {
        videoJob = null;
      }
    },
  );

  ipcMain.on('lysark:cancel-video', () => videoJob?.cancel());

  handle('lysark:has-ffmpeg', (): boolean => ffmpegPath() !== undefined);

  handle('lysark:add-recording', (dir: string, wav: Uint8Array, name: string): AddedSound => {
    if (!currentDir || resolve(dir) !== resolve(currentDir)) {
      throw new Error('Opptaket hører ikke til prosjektet som er åpent.');
    }
    return addRecording(dir, wav, String(name ?? ''));
  });

  handle('lysark:import-sound', async (dir: string): Promise<AddedSound | null> => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Velg lydfil',
      buttonLabel: 'Sett inn',
      filters: [{ name: 'Lyd', extensions: SOUND_EXTENSIONS }],
      properties: ['openFile'],
    });
    const file = result.filePaths[0];
    if (result.canceled || !file) return null;
    return importSound(dir, file);
  });

  handle('lysark:pack', async (dir: string): Promise<{ path: string; bytes: number } | null> => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Lagre som én fil',
      buttonLabel: 'Pakk',
      defaultPath: join(dirname(dir), `${basename(dir)}.lysark.zip`),
      filters: [{ name: 'Lysark-prosjekt i én fil', extensions: ['zip'] }],
    });
    if (result.canceled || !result.filePath) return null;
    return { path: result.filePath, bytes: packProject(dir, result.filePath) };
  });

  handle('lysark:unpack', async (): Promise<OpenedProject | null> => {
    if (!mainWindow) return null;
    const pick = await dialog.showOpenDialog(mainWindow, {
      title: 'Åpne prosjekt lagret som én fil',
      buttonLabel: 'Åpne',
      filters: [{ name: 'Lysark-prosjekt i én fil', extensions: ['zip'] }],
      properties: ['openFile'],
    });
    const source = pick.filePaths[0];
    if (pick.canceled || !source) return null;
    const dir = await askForNewFolder(basename(source).replace(/(\.lysark)?\.zip$/i, ''));
    if (!dir) return null;
    return opened(dir, unpackProject(source, dir));
  });

  handle('lysark:open-html', async (): Promise<OpenedHtml | null> => {
    if (!mainWindow) return null;
    const pick = await dialog.showOpenDialog(mainWindow, {
      title: 'Åpne HTML-fil',
      buttonLabel: 'Åpne',
      filters: [{ name: 'HTML eksportert fra Lysark', extensions: ['html', 'htm'] }],
      properties: ['openFile'],
    });
    const source = pick.filePaths[0];
    if (pick.canceled || !source) return null;
    // Read and check the file first, so that a file Lysark did not make is
    // refused before the owner is asked where the project is to lie.
    const read = readHtmlExport(source);
    const dir = await askForNewFolder(basename(source, extname(source)));
    if (!dir) return null;
    // A file with the lecturer's voice carries it as AAC; the project keeps WAV.
    const restored = await restoreSound(dir, writeHtmlExport(read, dir));
    if (restored.project !== read.content.project) saveProject(dir, restored.project);
    return {
      ...opened(dir, restored.project),
      sourceName: basename(source),
      notes: [...read.content.notes, ...restored.notes],
    };
  });

  // PDF import. The pages are drawn in the interface (pdf.js needs a canvas);
  // the main process picks the file, makes the folder and stores the pictures.
  handle('lysark:pdf-pick', async (): Promise<PickedPdf | null> => {
    if (!mainWindow) return null;
    const pick = await dialog.showOpenDialog(mainWindow, {
      title: 'Importer PDF',
      buttonLabel: 'Importer',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      properties: ['openFile'],
    });
    const source = pick.filePaths[0];
    if (pick.canceled || !source) return null;
    if (statSync(source).size > PDF_LIMIT_BYTES) {
      throw new Error(
        `PDF-fila er for stor til å importeres (over ${PDF_LIMIT_BYTES / (1024 * 1024)} MB).`,
      );
    }
    const data = new Uint8Array(readFileSync(source));
    dropPdfImport();
    pdfImport = { sourceName: basename(source), folder: null };
    return { name: pdfImport.sourceName, data };
  });

  handle('lysark:pdf-begin', async (): Promise<boolean> => {
    if (!pdfImport || pdfImport.folder) throw new Error('Ingen PDF er valgt.');
    const dir = await askForNewFolder(pdfImport.sourceName.replace(/\.pdf$/i, ''));
    if (!dir || !pdfImport) {
      pdfImport = null;
      return false;
    }
    pdfImport.folder = beginImportFolder(dir);
    return true;
  });

  handle('lysark:pdf-page', (page: number, data: Uint8Array): AddedMedia => {
    if (!pdfImport?.folder) throw new Error('Ingen PDF-import er i gang.');
    if (!Number.isInteger(page) || page < 1 || !(data instanceof Uint8Array)) {
      throw new Error('Bildet av siden kan ikke lagres.');
    }
    const stem = pdfImport.sourceName.replace(/\.pdf$/i, '');
    return addPagePicture(pdfImport.folder, data, `${stem} – side ${page}.webp`);
  });

  handle('lysark:pdf-finish', (project: Project): OpenedProject => {
    if (!pdfImport?.folder) throw new Error('Ingen PDF-import er i gang.');
    const folder = pdfImport.folder;
    const valid = finishImportFolder(folder, project);
    pdfImport = null;
    return opened(folder.dir, valid);
  });

  handle('lysark:pdf-cancel', (): void => {
    dropPdfImport();
  });

  handle(
    'lysark:preview',
    async (dir: string, project: Project, sceneIndex: number): Promise<void> => {
      const address = await servePreview({
        html: await buildPreview(dir, project),
        mediaFile: (name) => {
          const file = mediaPath(dir, `media/${name}`);
          return { file, mime: mimeOf(file) ?? 'application/octet-stream' };
        },
      });
      if (!previewWindow || previewWindow.isDestroyed()) {
        previewWindow = new BrowserWindow({
          width: 1280,
          height: 800,
          show: !HIDDEN,
          title: `Forhåndsvisning – ${APP_NAME}`,
          autoHideMenuBar: true,
          backgroundColor: '#2f0b63',
          webPreferences: {
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            // Its own session, kept in memory only. Here, and only here, web
            // content the owner has put in can be fetched when he presses
            // play, just as it will be for a student.
            partition: 'lysark-preview',
          },
        });
        previewWindow.setMenu(null);
        previewWindow.webContents.setWindowOpenHandler(({ url }) => {
          if (/^https?:/i.test(url)) void shell.openExternal(url);
          return { action: 'deny' };
        });
        // The window shows the preview and nothing else.
        previewWindow.webContents.on('will-navigate', (event, url) => {
          if (!isPreviewUrl(url)) event.preventDefault();
        });
        previewWindow.on('closed', () => {
          previewWindow = null;
        });
        // The exported page names itself after the lecture; the window says what it is.
        previewWindow.on('page-title-updated', (event) => event.preventDefault());
      }
      previewWindow.setTitle(
        project.meta.title
          ? `Forhåndsvisning – ${project.meta.title}`
          : `Forhåndsvisning – ${APP_NAME}`,
      );
      await previewWindow.loadURL(`${address}#${sceneIndex + 1}`);
      if (!HIDDEN) previewWindow.focus();
    },
  );

  handle('lysark:recent', (): string[] => recentProjects());
  handle('lysark:logo-status', (): LogoStatus => logoStatus());

  handle('lysark:choose-logo-folder', async (): Promise<LogoStatus> => {
    if (!mainWindow) return logoStatus();
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Velg mappa der USNs logopakke er pakket ut',
      buttonLabel: 'Velg mappe',
      properties: ['openDirectory'],
    });
    const folder = result.filePaths[0];
    if (!result.canceled && folder) setLogosFromFolder(folder);
    return logoStatus();
  });

  handle('lysark:choose-closing', async (): Promise<LogoStatus> => {
    if (!mainWindow) return logoStatus();
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Velg USNs avslutningsanimasjon',
      buttonLabel: 'Velg fil',
      filters: [{ name: 'Video', extensions: CLOSING_EXTENSIONS }],
      properties: ['openFile'],
    });
    const file = result.filePaths[0];
    if (result.canceled || !file) return logoStatus();
    const seconds = mediaSeconds(file);
    if (seconds === undefined) {
      throw new Error(
        ffmpegPath()
          ? 'Videofila kan ikke leses.'
          : 'FFmpeg mangler, så lengden på videoen kan ikke måles.',
      );
    }
    setClosingAnimation(file, seconds);
    return logoStatus();
  });

  handle('lysark:clear-closing', (): LogoStatus => {
    clearClosingAnimation();
    return logoStatus();
  });

  handle('lysark:clear-logos', (): LogoStatus => {
    clearLogos();
    return logoStatus();
  });

  handle('lysark:show-in-folder', (path: string): void => {
    shell.showItemInFolder(path);
  });

  ipcMain.on('lysark:document-state', (_event, state: { dirty: boolean; title: string }) => {
    documentState = { dirty: !!state.dirty, title: String(state.title ?? '') };
    updateTitle();
  });

  ipcMain.on('lysark:close-window', () => {
    closeConfirmed = true;
    mainWindow?.close();
  });
}

// ---------- Start ----------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  void app.whenReady().then(() => {
    blockNetworkInInterface();
    allowMicrophoneOnly();
    registerMediaProtocol();
    registerWebPictureProtocol();
    registerHandlers();
    buildMenu();
    createWindow();
  });

  // An export that is running when the program closes is stopped, FFmpeg included.
  app.on('before-quit', () => videoJob?.cancel());

  app.on('window-all-closed', () => {
    videoJob?.cancel();
    dropPdfImport();
    stopPreviewServer();
    app.quit();
  });
}
