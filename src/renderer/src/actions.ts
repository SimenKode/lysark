// Things the owner can do that involve files: open, save, import, export,
// preview and inserting media. Errors end up as a notice, never silently.
import {
  mediaUrl,
  type AddedMedia,
  type AddedSound,
  type CommonsPicture,
  type CommonsResult,
  type LysarkApi,
  type OpenverseResult,
  type PickedPdf,
  type PptxPdf,
  type PictureBytes,
  type VideoRequest,
} from '../../shared/api';
import { appendSound } from '../../shared/audio/edit';
import { applyPptxSlides, type PptxSlide } from '../../importer/pptxSlides';
import { applyRecording, type Applied, type Take } from '../../shared/audio/session';
import { addTrackClip } from '../../shared/audio/tracks';
import { encodeWav, wavSamples } from '../../shared/audio/wav';
import { newId } from '../../shared/format/factory';
import { FETCHED_PICTURE_MAX_WIDTH } from '../../shared/limits';
import type { CameraPlace, Element, Project, Scene, TrackName } from '../../shared/format/schema';
import { formatTime, videoOptions } from '../../shared/render/clock';
import { rememberSamples } from './audio/engine';
import { getTheme } from '../../shared/theme/theme';
import { placeNew } from './ops';
import { currentScene, isDirty, useStore, type ImportLook, type LookRequest } from './store';

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

/** Asks how the slides of the picked file are to look. Undefined when the owner breaks off. */
function askLook(kind: LookRequest['kind'], name: string): Promise<ImportLook | undefined> {
  return new Promise((resolve) => {
    useStore.getState().setLookRequest({ kind, name, resolve });
  });
}

/**
 * Imports a PowerPoint file. The owner chooses freely whether the slides
 * keep the look they have or are made over into the theme.
 */
export async function importPptx(): Promise<void> {
  if (pdfImport) return;
  if (!(await leaveCurrent())) return;
  const picked = await guard(() => api().pickPptx());
  if (!picked) return;
  const look = await askLook('pptx', picked.name);
  if (!look) return;
  if (look === 'keep') {
    await importPptxWithItsLook(picked.name);
    return;
  }
  const imported = await guard(() => api().importPptx());
  if (!imported) return;
  // The import may have taken USN's closing animation into the settings.
  await refreshLogo();
  const state = useStore.getState();
  state.load(imported.dir, imported.project);
  state.setReport({
    report: imported.report,
    sourceName: imported.sourceName,
    closingSlides: imported.closingSlides,
  });
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

/**
 * Exports the lecture, or some of its slides, as video or as a GIF with
 * the given choices. The dialog shows the progress.
 */
export async function exportVideo(
  choices: NonNullable<Project['video']>,
  request: VideoRequest,
): Promise<void> {
  const state = useStore.getState();
  if (!state.dir || !state.project) return;
  if (state.project.scenes.length === 0) {
    state.setNotice({ kind: 'error', text: 'Prosjektet har ingen lysark å lage video av.' });
    return;
  }
  // The choices are part of the project, so the next export starts from them.
  // A project whose choices were not touched is not changed by exporting.
  const before = videoOptions(state.project);
  if (
    before.transition !== choices.transition ||
    before.evenLoudness !== choices.evenLoudness ||
    before.credits !== choices.credits
  ) {
    state.update((draft) => {
      draft.video = choices;
    });
  }
  const { dir, project } = useStore.getState();
  // Progress is shown from the first word from the main process, which
  // comes when the owner has said where the file is to go.
  const stop = api().onVideoProgress((progress) => useStore.getState().setVideoProgress(progress));
  try {
    const summary = await guard(() => api().exportVideo(dir!, project!, request));
    if (!summary) return;
    const size = `${formatTime(summary.seconds)}, ${megabytes(summary.bytes)}`;
    const parts =
      summary.format === 'gif'
        ? [`GIF-fila er lagret (${size}). Den har ikke lyd.`]
        : [
            `Videoen er lagret (${size}).`,
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

/** One stretch of a recording, as the recording window hands it over. */
export interface RecordedTake extends Omit<Take, 'asset' | 'seconds' | 'camera'> {
  /** The sound of the stretch, being stored; undefined when it could not be. */
  sound: Promise<AddedSound | undefined>;
  /**
   * When the camera was on: where the circle stood when the stretch began,
   * and which moment of the recording's film that was, in seconds.
   */
  camera?: { place: CameraPlace; filmAt: number };
}

/** Stores the sound of one stretch of a recording in the project folder. */
export async function storeTakeSound(
  samples: Float32Array,
  name: string,
): Promise<AddedSound | undefined> {
  const { dir } = useStore.getState();
  if (!dir) return undefined;
  const wav = encodeWav(samples);
  const added = await guard(() => api().addRecording(dir, wav, name));
  if (added) rememberSamples(added.asset.file, wavSamples(wav));
  return added;
}

/**
 * The film of a recording, on its way to the project folder: `write` takes
 * it a piece at a time while the lecturer reads, `end` stores it (undefined
 * when there was nothing to store, or it could not be stored), and `drop`
 * throws it away.
 */
export interface FilmStore {
  write(piece: Uint8Array): Promise<void>;
  end(): Promise<AddedMedia | undefined>;
  drop(): void;
}

export function openFilmStore(): FilmStore | null {
  const { dir } = useStore.getState();
  if (!dir) return null;
  const film = api().beginCameraFilm(dir);
  return {
    async write(piece) {
      await api().appendCameraFilm(await film, piece);
    },
    async end() {
      // The sound is kept even when the film cannot be: the owner is told,
      // and the slides are then simply without the camera circle.
      return (await guard(async () => api().endCameraFilm(await film, 'Kamera'))) ?? undefined;
    },
    drop() {
      void film.then((id) => api().dropCameraFilm(id)).catch(() => undefined);
    },
  };
}

/**
 * Puts a recording into the lecture: the sound of every stretch, the film
 * when the camera was on, and slides shown once more where the lecturer
 * went back. All of it is one change, so one undo takes the recording away.
 */
export async function saveRecording(
  takes: ReadonlyArray<RecordedTake>,
  film: AddedMedia | undefined,
): Promise<Applied | null> {
  const sounds = await Promise.all(takes.map((take) => take.sound));
  let applied: Applied | null = null;
  useStore.getState().update((draft) => {
    if (film) draft.assets[film.id] = film.asset;
    const ready: Take[] = [];
    takes.forEach((take, index) => {
      const sound = sounds[index];
      if (!sound) return;
      const filmed = film && take.camera;
      draft.assets[sound.id] = filmed
        ? // The film has the recording's own time: this stretch began `filmAt` into it.
          { ...sound.asset, camera: { asset: film.id, offset: -take.camera!.filmAt } }
        : sound.asset;
      const { sound: _sound, camera: _camera, ...rest } = take;
      ready.push({
        ...rest,
        asset: sound.id,
        seconds: sound.seconds,
        ...(filmed ? { camera: take.camera!.place } : {}),
      });
    });
    applied = applyRecording(draft, ready, newId);
  });
  return applied;
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

/**
 * Lets the owner pick a sound file and puts it on one of the lecture's own
 * tracks, starting `time` seconds into the lecture. Returns the new clip's id.
 */
export async function addTrackSound(track: TrackName, time: number): Promise<string | undefined> {
  const state = useStore.getState();
  if (!state.dir) return undefined;
  const added = await guard(() => api().importSound(state.dir!));
  if (!added) return undefined;
  let made: string | undefined;
  useStore.getState().update((draft) => {
    draft.assets[added.id] = added.asset;
    made = addTrackClip(draft, track, added.id, added.seconds, time, () => newId('k'));
  });
  return made;
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
      text: `Prosjektet er lagret som én fil (${megabytes(packed.bytes)}).`,
      path: packed.path,
    });
  }
}

export async function unpackProject(): Promise<void> {
  if (!(await leaveCurrent())) return;
  const opened = await guard(() => api().unpackProject());
  if (opened) useStore.getState().load(opened.dir, opened.project);
}

/** Opens an HTML file exported by Lysark as a new project. */
export async function openHtmlFile(): Promise<void> {
  if (!(await leaveCurrent())) return;
  const opened = await guard(() => api().openHtmlFile());
  if (!opened) return;
  const state = useStore.getState();
  state.load(opened.dir, opened.project);
  state.setNotice({
    kind: 'info',
    text: [`${opened.sourceName} er åpnet som et nytt prosjekt.`, ...opened.notes].join(' '),
  });
}

/** The PDF import that is under way, so that it can be stopped. */
let pdfImport: AbortController | null = null;

function listed(numbers: number[]): string {
  return numbers.length === 1
    ? String(numbers[0])
    : `${numbers.slice(0, -1).join(', ')} og ${numbers[numbers.length - 1]}`;
}

/**
 * Imports a PDF: every page becomes a scene, with its text and pictures as
 * elements of their own. The pages are read and drawn here, in the
 * interface; the main process picks the file, makes the project folder and
 * stores the pictures. Nothing is opened
 * until every page is in place, and an import that is stopped or fails
 * leaves nothing behind.
 */
export async function importPdf(): Promise<void> {
  if (pdfImport) return;
  if (!(await leaveCurrent())) return;
  const picked = await guard(() => api().pickPdf());
  if (!picked) return;
  const look = await askLook('pdf', picked.name);
  if (!look) return;
  pdfImport = new AbortController();
  await importPickedPdf(picked, pdfImport, { look });
}

/**
 * A PowerPoint file that keeps its look. A program on the machine that can
 * draw PowerPoint slides makes a PDF of it, which is imported like any PDF;
 * the names of the slides, the manuscript and the chapters come from the
 * PowerPoint file itself. When no such program is there, the owner is asked
 * for a PDF of the presentation.
 */
async function importPptxWithItsLook(name: string): Promise<void> {
  const control = new AbortController();
  pdfImport = control;
  const setProgress = useStore.getState().setPdfProgress;
  setProgress({ name, page: 0, pages: 0, preparing: true });
  let pdf: PickedPdf | PptxPdf | null | undefined;
  let slides: PptxSlide[] | undefined;
  try {
    pdf = await guard(() => api().pptxAsPdf());
    if (pdf !== undefined && !control.signal.aborted) {
      slides = await guard(() => api().pptxSlides());
    }
  } finally {
    setProgress(null);
  }
  if (pdf === undefined || slides === undefined || control.signal.aborted) {
    pdfImport = null;
    return;
  }
  if (pdf === null) {
    const go = window.confirm(
      'Lysark fant verken PowerPoint eller LibreOffice på denne maskinen, og kan ikke selv tegne ' +
        'lysarkene slik de ser ut i PowerPoint.\n\n' +
        'Lagre presentasjonen som PDF (i PowerPoint: Fil, Lagre som, PDF), og velg PDF-fila her. ' +
        'Manus og kapitler hentes fra PowerPoint-fila.\n\nVil du velge PDF-fila nå?',
    );
    pdf = go ? await guard(() => api().pickPdf()) : null;
    if (!pdf) {
      pdfImport = null;
      return;
    }
  }
  const from =
    'by' in pdf && pdf.by === 'beside'
      ? `Utseendet er hentet fra ${pdf.file ?? 'PDF-fila'}, som lå ved siden av PowerPoint-fila.`
      : 'by' in pdf && pdf.by === 'libreoffice'
        ? 'LibreOffice har tegnet lysarkene. Det kan avvike litt fra PowerPoint, særlig der skriftene ' +
          'i presentasjonen ikke finnes på maskinen. Vil du ha det helt likt, lagrer du presentasjonen ' +
          'som PDF i PowerPoint, legger PDF-fila ved siden av med samme navn, og importerer på nytt.'
        : 'by' in pdf && pdf.by === 'powerpoint'
          ? 'PowerPoint har tegnet lysarkene.'
          : undefined;
  await importPickedPdf({ name, data: pdf.data }, control, { look: 'keep', slides, from });
}

/** Reads a PDF that has been picked (or made) and opens it as a new project. */
async function importPickedPdf(
  picked: PickedPdf,
  control: AbortController,
  options: { look: ImportLook; slides?: PptxSlide[]; from?: string },
): Promise<void> {
  const setProgress = useStore.getState().setPdfProgress;
  setProgress({ name: picked.name, page: 0, pages: 0 });
  let finished = false;
  try {
    const { importPdfPages, isPagePicture } = await import('./pdfRender');
    const project = await importPdfPages(picked.data, {
      name: picked.name.replace(/\.pptx$/i, '.pdf'),
      signal: control.signal,
      begin: () => api().beginPdfImport(),
      progress: (page, pages) => setProgress({ name: picked.name, page, pages }),
      store: (page, data) => api().addPdfPage(page, data),
      look: options.look,
    });
    if (!project) return;
    // What the PowerPoint file knows that the PDF of it does not.
    const fitted = options.slides ? applyPptxSlides(project, options.slides) : undefined;
    const opened = await api().finishPdfImport(project);
    finished = true;
    const state = useStore.getState();
    state.load(opened.dir, opened.project);
    const scenes = opened.project.scenes;
    const numbers = (wanted: (scene: Scene) => boolean): number[] =>
      scenes.flatMap((scene, index) => (wanted(scene) ? [index + 1] : []));
    const pictures = numbers(isPagePicture);
    const noText = numbers(
      (scene) =>
        isPagePicture(scene) && scene.elements[0]?.type === 'image' && !scene.elements[0].alt,
    );
    const noted = numbers(
      (scene) => !isPagePicture(scene) && (scene.imported?.warnings.length ?? 0) > 0,
    );
    const parts = [`${picked.name} er importert: ${scenes.length} lysark.`];
    if (pictures.length === scenes.length) {
      parts.push('Hver side er et bilde, med teksten på siden som alternativ tekst.');
    } else {
      parts.push('Tekst og bilder er egne elementer som kan flyttes og endres.');
      if (pictures.length > 0) {
        parts.push(
          pictures.length <= 10
            ? `Lysark ${listed(pictures)} er lagt inn som ett bilde av hele siden.`
            : `${pictures.length} lysark er lagt inn som ett bilde av hele siden.`,
        );
      }
    }
    if (noText.length > 0) {
      parts.push(
        noText.length === scenes.length
          ? 'Ingen tekst kunne hentes ut av sidene; skriv alternativ tekst for bildene.'
          : noText.length <= 10
            ? `Lysark ${listed(noText)} har ingen tekst som kunne hentes ut; skriv alternativ tekst der.`
            : `${noText.length} lysark har ingen tekst som kunne hentes ut; de er merket i lista.`,
      );
    }
    if (options.look === 'theme') {
      parts.push(
        'Lysarkene er gjort om til USN-stil; streker, former og bakgrunn fra PDF-en er ikke med.',
      );
    }
    if (options.from) parts.push(options.from);
    if (fitted === true) parts.push('Manus og kapitler er hentet fra PowerPoint-fila.');
    if (fitted === false) {
      parts.push(
        'Manus og kapitler kunne ikke hentes fra PowerPoint-fila: antallet lysark stemmer ikke med PDF-en.',
      );
    }
    if (noted.length > 0) {
      parts.push(
        noted.length <= 10
          ? `Lysark ${listed(noted)} har merknader fra importen; de står under «Fra importen» når lysarket er valgt.`
          : `${noted.length} lysark har merknader fra importen; de er merket i lista.`,
      );
    }
    state.setNotice({ kind: 'info', text: parts.join(' ') });
  } catch (error) {
    if (!(error instanceof Error && error.name === 'ImportCancelled')) fail(error);
  } finally {
    // Takes away the folder and the pictures of an import that did not get to the end.
    if (!finished) {
      await api()
        .cancelPdfImport()
        .catch(() => undefined);
    }
    pdfImport = null;
    setProgress(null);
  }
}

/** Stops the PDF import that is under way. */
export function cancelPdfImport(): void {
  pdfImport?.abort();
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
  if (!size || !state.project || !scene || scene.repeat) return;
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
  if (!state.project || !scene || scene.repeat) return;
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
  if (!state.project || !scene || scene.repeat) return;
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

/** Sends the owner's search words to Openverse. `page` counts from 1. */
export function searchOpenverse(query: string, page: number): Promise<OpenverseResult> {
  return api().searchOpenverse(query, page);
}

/**
 * The picture made smaller, when it is wider than the stage; undefined when
 * it is fine as it is. Openverse hands pictures out in the size their
 * collection has them, which can be many times what a slide can show.
 */
async function scaledDown(picture: PictureBytes): Promise<PictureBytes | undefined> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([picture.data as BlobPart], { type: picture.mime }));
  } catch {
    throw new Error('Bildet kunne ikke leses.');
  }
  try {
    if (bitmap.width <= FETCHED_PICTURE_MAX_WIDTH) return undefined;
    const canvas = document.createElement('canvas');
    canvas.width = FETCHED_PICTURE_MAX_WIDTH;
    canvas.height = Math.max(
      1,
      Math.round((bitmap.height * FETCHED_PICTURE_MAX_WIDTH) / bitmap.width),
    );
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Bildet kunne ikke gjøres mindre.');
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // A photo stays a JPEG; anything else may have see-through parts, which WebP keeps.
    const mime = picture.mime === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, mime, 0.9));
    if (!blob) throw new Error('Bildet kunne ikke gjøres mindre.');
    return { data: new Uint8Array(await blob.arrayBuffer()), mime };
  } finally {
    bitmap.close();
  }
}

/** Fetches a picture from Openverse into the project folder, with its credit. */
export async function downloadOpenversePicture(id: string): Promise<AddedMedia> {
  const { dir } = useStore.getState();
  if (!dir) throw new Error('Ingen prosjekt er åpent.');
  const fetched = await api().fetchOpenversePicture(id);
  return api().addOpenversePicture(dir, id, await scaledDown(fetched));
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

export async function chooseClosingAnimation(): Promise<void> {
  const status = await guard(() => api().chooseClosingAnimation());
  if (status) useStore.getState().setLogo(status);
}

export async function clearClosingAnimation(): Promise<void> {
  const status = await guard(() => api().clearClosingAnimation());
  if (status) useStore.getState().setLogo(status);
}

export function showInFolder(path: string): void {
  void guard(() => api().showInFolder(path));
}

export { megabytes };
