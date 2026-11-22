// The narrow, named set of calls the user interface can make to the main
// process. The interface itself has no access to files or to Node.
import type { Asset, Project } from './format/schema';
import type { ImportReport } from '../importer/pptx';

export type { ImportReport };

export interface OpenedProject {
  /** Absolute path of the project folder. */
  dir: string;
  project: Project;
}

export interface ImportedProject extends OpenedProject {
  report: ImportReport;
  sourceName: string;
}

export interface AddedMedia {
  id: string;
  asset: Asset;
}

export interface ExportSummary {
  path: string;
  bytes: number;
  /** Folder with large videos placed next to the HTML file, if any. */
  sidecarDir?: string;
  sidecarFiles: number;
  logoMissing: boolean;
}

export interface LogoStatus {
  light: boolean;
  dark: boolean;
  /** Changes whenever a logo file changes, to defeat caching. */
  version: number;
}

export type LogoVariant = 'light' | 'dark';

/** Commands sent from the application menu to the interface. */
export type MenuCommand =
  | 'new'
  | 'open'
  | 'import'
  | 'save'
  | 'save-then-close'
  | 'preview'
  | 'export'
  | 'settings'
  | 'undo'
  | 'redo'
  | 'delete'
  | 'duplicate'
  | 'toggle-grid'
  | 'pack'
  | 'unpack';

export interface LysarkApi {
  newProject(): Promise<OpenedProject | null>;
  openProject(dir?: string): Promise<OpenedProject | null>;
  importPptx(): Promise<ImportedProject | null>;
  saveProject(dir: string, project: Project): Promise<void>;
  addMedia(dir: string, kind: 'image' | 'video'): Promise<AddedMedia | null>;
  exportHtml(dir: string, project: Project): Promise<ExportSummary | null>;
  /** Packs the saved project folder into one zip file. */
  packProject(dir: string): Promise<{ path: string; bytes: number } | null>;
  /** Unpacks a packed project into a new folder and opens it. */
  unpackProject(): Promise<OpenedProject | null>;
  preview(dir: string, project: Project, sceneIndex: number): Promise<void>;
  recentProjects(): Promise<string[]>;
  /** A project the program was started with, if any. */
  initialProject(): Promise<string | null>;
  logoStatus(): Promise<LogoStatus>;
  chooseLogo(variant: LogoVariant): Promise<LogoStatus>;
  clearLogo(variant: LogoVariant): Promise<LogoStatus>;
  showInFolder(path: string): Promise<void>;
  /** Tells the main process whether there are unsaved changes. */
  setDocumentState(state: { dirty: boolean; title: string }): void;
  /** Closes the window after "save, then close". */
  closeWindow(): void;
  onCommand(listener: (command: MenuCommand) => void): () => void;
}

/** URL of a file in the open project's media folder. */
export function mediaUrl(file: string): string {
  return `lysark-media://project/${encodeURIComponent(file.replace(/^media\//, ''))}`;
}

/** URL of one of the owner's logo files. */
export function logoUrl(variant: LogoVariant, version: number): string {
  return `lysark-media://brand/${variant}?v=${version}`;
}
