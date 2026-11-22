// The narrow, named set of calls the user interface can make to the main
// process. The interface itself has no access to files or to Node.
import type { Asset, Credit, Project } from './format/schema';
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

/** A picture found in Wikimedia Commons. */
export interface CommonsPicture {
  /** The file's name on Commons. */
  title: string;
  /** Address of a picture the interface can show (handed out by the main process). */
  thumbUrl: string;
  /** Size of the original, in pixels. */
  width: number;
  height: number;
  credit: Credit;
}

export interface CommonsResult {
  hits: CommonsPicture[];
  /** Offset of the next page, when there is one. */
  next?: number;
}

export interface ExportSummary {
  path: string;
  bytes: number;
  /** Folder with large videos placed next to the HTML file, if any. */
  sidecarDir?: string;
  sidecarFiles: number;
  logoMissing: boolean;
}

export type LogoVariant = 'light' | 'dark';
export type LogoLanguage = 'nb' | 'en';

/** Which of USN's logo files have been found in the owner's logo package. */
export interface LogoStatus {
  nb: Record<LogoVariant, boolean>;
  en: Record<LogoVariant, boolean>;
  /** Changes whenever a logo file changes, to defeat caching. */
  version: number;
}

/** True when a logo can be shown for the language (English falls back to Norwegian). */
export function hasLogo(status: LogoStatus, language: LogoLanguage, variant: LogoVariant): boolean {
  return status[language][variant] || status.nb[variant];
}

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
  /** Sends the owner's search words to Wikimedia Commons. Contacts the network. */
  searchCommons(query: string, offset: number): Promise<CommonsResult>;
  /** A larger picture of one search hit. Contacts the network. */
  commonsPreview(title: string): Promise<CommonsPicture>;
  /** Downloads the chosen picture into the project, with its credit. Contacts the network. */
  addCommonsPicture(dir: string, title: string): Promise<AddedMedia>;
  /** Fetches YouTube's still picture of a video into the project. Contacts the network. */
  addYouTubeStill(dir: string, url: string): Promise<AddedMedia>;
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
  /** Lets the owner pick the folder with USN's unpacked logo package. */
  chooseLogoFolder(): Promise<LogoStatus>;
  clearLogos(): Promise<LogoStatus>;
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
export function logoUrl(language: LogoLanguage, variant: LogoVariant, version: number): string {
  return `lysark-media://brand/${language}-${variant}?v=${version}`;
}

/** Address the interface uses to show a gallery picture; the main process fetches it. */
export function webPictureUrl(address: string): string {
  return `lysark-web://picture/${encodeURIComponent(address)}`;
}
