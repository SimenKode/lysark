// The bridge between the sandboxed interface and the main process. Only
// the calls listed in LysarkApi are exposed.
import { contextBridge, ipcRenderer } from 'electron';
import type { LysarkApi, MenuCommand } from '../shared/api';

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
  exportHtml: (dir, project) => call('lysark:export', dir, project),
  packProject: (dir) => call('lysark:pack', dir),
  unpackProject: () => call('lysark:unpack'),
  preview: (dir, project, sceneIndex) => call('lysark:preview', dir, project, sceneIndex),
  recentProjects: () => call('lysark:recent'),
  initialProject: () => call('lysark:initial'),
  logoStatus: () => call('lysark:logo-status'),
  chooseLogo: (variant) => call('lysark:choose-logo', variant),
  clearLogo: (variant) => call('lysark:clear-logo', variant),
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
