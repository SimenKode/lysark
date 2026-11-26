// The narrow, named set of calls the user interface can make to the main
// process. The interface itself has no access to files or to Node.
import type { PptxSlide } from '../importer/pptxSlides';
import type { Asset, Credit, Orientation, Project } from './format/schema';
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
  /** Slides (numbered from 1) that were set to play USN's closing animation by themselves. */
  closingSlides?: number[];
}

/** An HTML file exported by Lysark, opened as a new project. */
export interface OpenedHtml extends OpenedProject {
  sourceName: string;
  /** What could not be taken along, in Norwegian bokmål. */
  notes: string[];
}

/** A PDF of a PowerPoint file the owner has picked, and where it came from. */
export interface PptxPdf extends PickedPdf {
  by: 'powerpoint' | 'beside' | 'libreoffice';
  /** The name of the PDF that lay next to the PowerPoint file, when that was used. */
  file?: string;
}

/** A PDF the owner has picked for import. Its pages are read and drawn in the interface. */
export interface PickedPdf {
  name: string;
  data: Uint8Array;
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

/** A picture found in Openverse. */
export interface OpenversePicture {
  /** Openverse's own name for the picture. */
  id: string;
  /** Address of a picture the interface can show (handed out by the main process). */
  thumbUrl: string;
  credit: Credit;
}

export interface OpenverseResult {
  hits: OpenversePicture[];
  /** Number of the next page, when there is one. */
  next?: number;
}

/** A picture as bytes, with its type. */
export interface PictureBytes {
  data: Uint8Array;
  mime: string;
}

export interface ExportSummary {
  path: string;
  bytes: number;
  /** Folder with large videos placed next to the HTML file, if any. */
  sidecarDir?: string;
  sidecarFiles: number;
  logoMissing: boolean;
  /** The file carries the owner's voice, and can play itself ("Spill av"). */
  hasSound: boolean;
}

/** A sound file that has been added to the project. */
export interface AddedSound extends AddedMedia {
  /** Its length. */
  seconds: number;
}

/** What to export as video: which slides, and as what kind of file. */
export interface VideoRequest {
  /** MP4 with sound and captions, or a GIF (short clips, no sound). */
  format: 'mp4' | 'gif';
  /** The first and the last slide to take, counted from 0. */
  from: number;
  to: number;
  /** Width of a GIF in pixels; the height follows (16:9). */
  gifWidth: number;
}

export interface VideoProgress {
  phase: 'sound' | 'frames' | 'finishing' | 'gif';
  /** Pictures handed to FFmpeg so far, and how many there will be. */
  frame: number;
  frames: number;
}

export interface VideoSummary {
  format: 'mp4' | 'gif';
  path: string;
  bytes: number;
  seconds: number;
  /** The captions file (WebVTT) written next to the video, when any slide has a manuscript. */
  captions?: string;
}

export type LogoVariant = 'light' | 'dark';
export type LogoLanguage = 'nb' | 'en';

/** Which of USN's logo files have been found in the owner's logo package. */
export interface LogoStatus {
  nb: Record<LogoVariant, boolean>;
  en: Record<LogoVariant, boolean>;
  /** Changes whenever a logo file changes, to defeat caching. */
  version: number;
  /** USN's closing animation is in place; `seconds` is its length. */
  closing?: { seconds: number };
}

/** True when a logo can be shown for the language (English falls back to Norwegian). */
export function hasLogo(status: LogoStatus, language: LogoLanguage, variant: LogoVariant): boolean {
  return status[language][variant] || status.nb[variant];
}

/** Commands sent from the application menu to the interface. */
/** What «Rydd i prosjektmappa» found and did. */
export interface TidyResult {
  /** Files that nothing uses, and how large they are together. */
  found: number;
  bytes: number;
  /** The owner said yes: these files (`media/…`) are in the waste bin now. */
  trashed: string[];
  /** Files that could not be moved to the waste bin. */
  failed: number;
}

export type MenuCommand =
  | 'new'
  | 'open'
  | 'import'
  | 'save'
  | 'save-then-close'
  | 'preview'
  | 'export'
  | 'export-video'
  | 'record'
  | 'settings'
  | 'undo'
  | 'redo'
  | 'delete'
  | 'duplicate'
  | 'toggle-grid'
  | 'pack'
  | 'unpack'
  | 'open-html'
  | 'import-pdf'
  | 'tidy'
  /** The program was asked to close while a recording is being saved: it stays open. */
  | 'close-while-saving';

export interface LysarkApi {
  /**
   * Lets the owner say where a new, empty project is to lie. The project is
   * made by `newProject` once the shape of its slides is chosen. Null when
   * the owner breaks off.
   */
  pickNewFolder(): Promise<{ name: string } | null>;
  /** Makes the new, empty project in the folder just picked, with slides of the shape. */
  newProject(orientation: Orientation): Promise<OpenedProject | null>;
  openProject(dir?: string): Promise<OpenedProject | null>;
  /**
   * Lets the owner pick a PowerPoint file for import. What happens to it is
   * chosen afterwards: `importPptx` makes it over into the theme;
   * `pptxAsPdf` and `pptxSlides` let it keep its look.
   */
  pickPptx(): Promise<{ name: string; shape: Orientation } | null>;
  /** Imports the picked PowerPoint file into a new project folder, in the theme, on slides of the shape. */
  importPptx(orientation: Orientation): Promise<ImportedProject | null>;
  /**
   * A PDF of the picked PowerPoint file, to be imported like any PDF: made
   * by PowerPoint, found next to the file, or made by LibreOffice. Null when
   * there is none to be had.
   */
  pptxAsPdf(): Promise<PptxPdf | null>;
  /** The names, notes and chapters of the slides of the picked PowerPoint file. */
  pptxSlides(): Promise<PptxSlide[]>;
  saveProject(dir: string, project: Project): Promise<void>;
  addMedia(dir: string, kind: 'image' | 'video'): Promise<AddedMedia | null>;
  /** Sends the owner's search words to Wikimedia Commons. Contacts the network. */
  searchCommons(query: string, offset: number): Promise<CommonsResult>;
  /** A larger picture of one search hit. Contacts the network. */
  commonsPreview(title: string): Promise<CommonsPicture>;
  /** Downloads the chosen picture into the project, with its credit. Contacts the network. */
  addCommonsPicture(dir: string, title: string): Promise<AddedMedia>;
  /** Sends the owner's search words to Openverse. `page` counts from 1. Contacts the network. */
  searchOpenverse(query: string, page: number): Promise<OpenverseResult>;
  /**
   * Fetches the chosen picture from Openverse and hands it over, so the
   * interface can see how large it is. Contacts the network.
   */
  fetchOpenversePicture(id: string): Promise<PictureBytes>;
  /**
   * Puts the picture that was just fetched into the project, with its
   * credit. `scaled` is the same picture made smaller, when it was too wide.
   */
  addOpenversePicture(dir: string, id: string, scaled?: PictureBytes): Promise<AddedMedia>;
  /** Fetches YouTube's still picture of a video into the project. Contacts the network. */
  addYouTubeStill(dir: string, url: string): Promise<AddedMedia>;
  exportHtml(dir: string, project: Project): Promise<ExportSummary | null>;
  /**
   * Exports the lecture as an MP4 video with captions next to it. Resolves
   * with null when the owner cancels. Progress arrives through onVideoProgress.
   */
  exportVideo(dir: string, project: Project, request: VideoRequest): Promise<VideoSummary | null>;
  cancelVideo(): void;
  onVideoProgress(listener: (progress: VideoProgress) => void): () => void;
  /** True when FFmpeg, which video and sound export need, is in place. */
  hasFfmpeg(): Promise<boolean>;
  /** Stores a recording (a WAV file: mono, 48 kHz, 16 bit) in the project folder. */
  addRecording(dir: string, wav: Uint8Array, name: string): Promise<AddedSound>;
  /**
   * The film the camera takes while the lecture is read in. It is handed
   * over a piece at a time (as the interface makes it), and stored in the
   * project folder, in the project's own form, when it ends. `endCameraFilm`
   * resolves with null when the film has no pictures.
   */
  beginCameraFilm(dir: string): Promise<string>;
  appendCameraFilm(film: string, piece: Uint8Array): Promise<void>;
  endCameraFilm(film: string, name: string): Promise<AddedMedia | null>;
  dropCameraFilm(film: string): Promise<void>;
  /** Lets the owner pick a sound file; it is converted and stored in the project folder. */
  importSound(dir: string): Promise<AddedSound | null>;
  /** Packs the saved project folder into one zip file. */
  packProject(dir: string): Promise<{ path: string; bytes: number } | null>;
  /** Unpacks a packed project into a new folder and opens it. */
  unpackProject(): Promise<OpenedProject | null>;
  /**
   * «Rydd i prosjektmappa»: counts the files in the project's media folder
   * that are not in `keep`, asks the owner, and on a yes moves them to the
   * system's waste bin. Never deletes anything outright.
   */
  tidyMedia(dir: string, keep: string[]): Promise<TidyResult>;
  /** Makes a project in a new folder out of an HTML file exported by Lysark, and opens it. */
  openHtmlFile(): Promise<OpenedHtml | null>;
  /** Lets the owner pick a PDF and hands over its bytes. */
  pickPdf(): Promise<PickedPdf | null>;
  /**
   * Asks where the project made from the picked PDF is to lie, and makes the
   * folder. False when the owner cancels.
   */
  beginPdfImport(): Promise<boolean>;
  /**
   * Stores a picture (WebP) from one page in the folder of the import that is
   * under way: a picture that stands on the page, what lies behind its text
   * and pictures, or the whole page.
   */
  addPdfPage(page: number, data: Uint8Array): Promise<AddedMedia>;
  /** Writes the project of the import that is under way, and opens it. */
  finishPdfImport(project: Project): Promise<OpenedProject>;
  /** Drops the import that is under way and takes away what it has written. */
  cancelPdfImport(): Promise<void>;
  preview(dir: string, project: Project, sceneIndex: number): Promise<void>;
  recentProjects(): Promise<string[]>;
  /** A project the program was started with, if any. */
  initialProject(): Promise<string | null>;
  logoStatus(): Promise<LogoStatus>;
  /** Lets the owner pick the folder with USN's unpacked logo package. */
  chooseLogoFolder(): Promise<LogoStatus>;
  clearLogos(): Promise<LogoStatus>;
  /** Lets the owner pick USN's closing animation (a video file); a copy is kept in the settings. */
  chooseClosingAnimation(): Promise<LogoStatus>;
  clearClosingAnimation(): Promise<LogoStatus>;
  showInFolder(path: string): Promise<void>;
  /** Tells the main process whether there are unsaved changes. */
  /** What the main process must know to close the window: `saving` keeps it open. */
  setDocumentState(state: { dirty: boolean; title: string; saving?: boolean }): void;
  /** Closes the window after "save, then close". */
  closeWindow(): void;
  /**
   * Asks what is to be done with the unsaved changes before the project is
   * left for another: save them, throw them away, or stay.
   */
  askUnsaved(): Promise<UnsavedAnswer>;
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

/** URL of USN's closing animation, from the owner's settings. */
export function closingUrl(version: number): string {
  return `lysark-media://brand/closing?v=${version}`;
}

/** Address the interface uses to show a gallery picture; the main process fetches it. */
export function webPictureUrl(address: string): string {
  return `lysark-web://picture/${encodeURIComponent(address)}`;
}

/** What the lecturer answers when a project with unsaved changes is about to be left. */
export type UnsavedAnswer = 'save' | 'discard' | 'cancel';
