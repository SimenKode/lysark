// Electron main process: the window, the Norwegian menu, file dialogs and
// the calls the interface is allowed to make. The interface runs sandboxed
// and reaches files only through these calls.
import { BrowserWindow, Menu, app, dialog, ipcMain, protocol, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import type {
  AddedMedia,
  ExportSummary,
  ImportedProject,
  LogoStatus,
  LogoVariant,
  MenuCommand,
  OpenedProject,
} from '../shared/api';
import type { Project } from '../shared/format/schema';
import { exportHtml, writePreview } from './exportHtml';
import {
  MEDIA_EXTENSIONS,
  PROJECT_FILE,
  addMediaFile,
  createProject,
  importPptxToFolder,
  mediaPath,
  mimeOf,
  packProject,
  readProject,
  saveProject,
  unpackProject,
} from './projectIo';
import {
  clearLogo,
  logoFile,
  logoStatus,
  recentProjects,
  rememberProject,
  setLogo,
} from './settings';

const APP_NAME = 'Lysark';
// Tests run the program without putting a window on the screen.
const HIDDEN = process.env.LYSARK_HIDDEN === '1';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lysark-media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

let mainWindow: BrowserWindow | null = null;
let previewWindow: BrowserWindow | null = null;
/** Folder of the project that is open; media is only served from here. */
let currentDir: string | null = null;
let documentState = { dirty: false, title: '' };
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
      if (url.hostname === 'brand') {
        const variant = url.pathname.slice(1) as LogoVariant;
        const file = variant === 'light' || variant === 'dark' ? logoFile(variant) : undefined;
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

// ---------- Window and menu ----------

function showAbout(): void {
  if (!mainWindow) return;
  void dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: `Om ${APP_NAME}`,
    message: `${APP_NAME} ${app.getVersion()}`,
    detail:
      'Gjør PowerPoint-forelesninger om til interaktiv HTML i USNs visuelle profil.\n\n' +
      'Bygd med fri programvare (Electron, React, ProseMirror, Zod, fflate, fast-xml-parser). ' +
      'Skriftene Liberation Sans og Liberation Serif følger med under SIL Open Font License 1.1.\n\n' +
      'Programmet kontakter ikke nettet og samler ingenting.',
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
        { type: 'separator' },
        { label: 'Lagre', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { type: 'separator' },
        { label: 'Forhåndsvis', accelerator: 'F5', click: () => send('preview') },
        { label: 'Eksporter HTML …', accelerator: 'CmdOrCtrl+E', click: () => send('export') },
        { type: 'separator' },
        { label: 'Pakk prosjektet til én fil …', click: () => send('pack') },
        { label: 'Åpne pakket prosjekt …', click: () => send('unpack') },
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
    const { project, report } = importPptxToFolder(source, dir);
    return { ...opened(dir, project), report, sourceName: basename(source) };
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
    return exportHtml(dir, project, result.filePath);
  });

  handle('lysark:pack', async (dir: string): Promise<{ path: string; bytes: number } | null> => {
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Pakk prosjektet til én fil',
      buttonLabel: 'Pakk',
      defaultPath: join(dirname(dir), `${basename(dir)}.lysark.zip`),
      filters: [{ name: 'Pakket Lysark-prosjekt', extensions: ['zip'] }],
    });
    if (result.canceled || !result.filePath) return null;
    return { path: result.filePath, bytes: packProject(dir, result.filePath) };
  });

  handle('lysark:unpack', async (): Promise<OpenedProject | null> => {
    if (!mainWindow) return null;
    const pick = await dialog.showOpenDialog(mainWindow, {
      title: 'Åpne pakket prosjekt',
      buttonLabel: 'Åpne',
      filters: [{ name: 'Pakket Lysark-prosjekt', extensions: ['zip'] }],
      properties: ['openFile'],
    });
    const source = pick.filePaths[0];
    if (pick.canceled || !source) return null;
    const dir = await askForNewFolder(basename(source).replace(/(\.lysark)?\.zip$/i, ''));
    if (!dir) return null;
    return opened(dir, unpackProject(source, dir));
  });

  handle(
    'lysark:preview',
    async (dir: string, project: Project, sceneIndex: number): Promise<void> => {
      const file = writePreview(dir, project);
      if (!previewWindow || previewWindow.isDestroyed()) {
        previewWindow = new BrowserWindow({
          width: 1280,
          height: 800,
          show: !HIDDEN,
          title: `Forhåndsvisning – ${APP_NAME}`,
          autoHideMenuBar: true,
          backgroundColor: '#2f0b63',
          webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
        });
        previewWindow.setMenu(null);
        previewWindow.webContents.setWindowOpenHandler(({ url }) => {
          if (/^https?:/i.test(url)) void shell.openExternal(url);
          return { action: 'deny' };
        });
        previewWindow.on('closed', () => {
          previewWindow = null;
        });
      }
      await previewWindow.loadFile(file, { hash: String(sceneIndex + 1) });
      if (!HIDDEN) previewWindow.focus();
    },
  );

  handle('lysark:recent', (): string[] => recentProjects());
  handle('lysark:logo-status', (): LogoStatus => logoStatus());

  handle('lysark:choose-logo', async (variant: LogoVariant): Promise<LogoStatus> => {
    if (!mainWindow) return logoStatus();
    const result = await dialog.showOpenDialog(mainWindow, {
      title:
        variant === 'light'
          ? 'Velg logo til lyse flater (lilla eller sort)'
          : 'Velg logo til mørke flater (hvit)',
      buttonLabel: 'Velg',
      filters: [{ name: 'Logo (SVG eller PNG)', extensions: ['svg', 'png'] }],
      properties: ['openFile'],
    });
    const file = result.filePaths[0];
    if (!result.canceled && file) setLogo(variant, file);
    return logoStatus();
  });

  handle('lysark:clear-logo', (variant: LogoVariant): LogoStatus => {
    clearLogo(variant);
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
    registerMediaProtocol();
    registerHandlers();
    buildMenu();
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
