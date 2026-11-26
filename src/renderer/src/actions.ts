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
import { slideNumbers } from '../../shared/layout/slides';
import { usedMediaFiles } from '../../shared/format/media';
import { encodeSound } from './audio/capture';
import { newId } from '../../shared/format/factory';
import { FETCHED_PICTURE_MAX_WIDTH } from '../../shared/limits';
import type { CameraPlace, Element, Project, Scene, TrackName } from '../../shared/format/schema';
import { formatTime, videoOptions } from '../../shared/render/clock';
import { rememberSamples } from './audio/engine';
import { getTheme, roomWidth } from '../../shared/theme/theme';
import { placeNew } from './ops';
import {
  WAIT_FOR_SAVING,
  currentScene,
  isDirty,
  useStore,
  type ImportLook,
  type LookChoice,
  type LookRequest,
} from './store';
import type { Orientation } from '../../shared/format/constants';
import type { Film } from './audio/camera';

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

/**
 * Asks what is to be done with unsaved changes before the project is left:
 * one question, with "Lagre", "Ikke lagre" and "Avbryt". Returns false when
 * the lecturer stays (or the saving did not go through).
 */
async function leaveCurrent(): Promise<boolean> {
  const state = useStore.getState();
  if (!state.project || !isDirty(state)) return true;
  const answer = await guard(() => api().askUnsaved());
  if (answer === 'save') return (await save()) === true;
  return answer === 'discard';
}

export async function newProject(): Promise<void> {
  if (waitsForSaving()) return;
  if (!(await leaveCurrent())) return;
  const folder = await guard(() => api().pickNewFolder());
  if (!folder) return;
  // Lying is chosen until the lecturer says otherwise.
  const choice = await askLook('new', folder.name);
  if (!choice) return;
  const opened = await guard(() => api().newProject(choice.orientation));
  if (opened) useStore.getState().load(opened.dir, opened.project);
}

export async function openProject(dir?: string): Promise<void> {
  if (waitsForSaving()) return;
  if (!(await leaveCurrent())) return;
  const opened = await guard(() => api().openProject(dir));
  if (opened) useStore.getState().load(opened.dir, opened.project);
}

/**
 * Asks how the slides of the picked file are to look, and which shape they
 * are to have (with the shape of its pages recommended). Undefined when the
 * owner breaks off.
 */
function askLook(
  kind: LookRequest['kind'],
  name: string,
  recommended?: Orientation,
): Promise<LookChoice | undefined> {
  return new Promise((resolve) => {
    useStore
      .getState()
      .setLookRequest({ kind, name, ...(recommended ? { recommended } : {}), resolve });
  });
}

/**
 * Imports a PowerPoint file. The owner chooses freely whether the slides
 * keep the look they have or are made over into the theme.
 */
export async function importPptx(): Promise<void> {
  if (pdfImport) return;
  if (waitsForSaving()) return;
  if (!(await leaveCurrent())) return;
  const picked = await guard(() => api().pickPptx());
  if (!picked) return;
  const choice = await askLook('pptx', picked.name, picked.shape);
  if (!choice) return;
  if (choice.look === 'keep') {
    await importPptxWithItsLook(picked.name, choice.orientation);
    return;
  }
  const imported = await guard(() => api().importPptx(choice.orientation));
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
  if (waitsForSaving()) return;
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
  if (waitsForSaving()) return;
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

/**
 * Stores the sound of one stretch of a recording in the project folder. The
 * pieces are handed over: the file is made in a thread of its own.
 */
export async function storeTakeSound(
  pieces: Float32Array[],
  name: string,
): Promise<AddedSound | undefined> {
  const { dir } = useStore.getState();
  if (!dir) return undefined;
  try {
    const sound = await encodeSound(pieces);
    const stored = await api().addRecording(dir, sound.wav, name);
    rememberSamples(stored.asset.file, sound.samples);
    return stored;
  } catch {
    // Said when the recording has been saved, with what could be kept.
    return undefined;
  }
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
      try {
        return (await api().endCameraFilm(await film, 'Kamera')) ?? undefined;
      } catch {
        return undefined;
      }
    },
    drop() {
      void film.then((id) => api().dropCameraFilm(id)).catch(() => undefined);
    },
  };
}

/** What became of a recording when it was put into the lecture. */
export interface SavedRecording extends Applied {
  /** Takes whose sound could not be stored. */
  lost: number;
  /** Slides that were read in and deleted meanwhile. */
  deleted: number;
  /** The numbers (as the lecturer counts) of the slides the recording jumped over and left out. */
  leftOut: number[];
}

/**
 * Puts a recording into the lecture as it is now: the sound of every
 * stretch, the film when the camera was on, and slides shown once more
 * where the lecturer went back. All of it is one change, so one undo takes
 * the recording away. A take whose slide has been deleted meanwhile is left
 * out (its sound file stays in the project folder).
 */
export async function saveRecording(
  takes: ReadonlyArray<RecordedTake>,
  film: AddedMedia | undefined,
): Promise<SavedRecording> {
  const sounds = await Promise.all(takes.map((take) => take.sound));
  let saved: SavedRecording = { slides: 0, repeats: 0, lost: 0, deleted: 0, leftOut: [] };
  useStore.getState().update((draft) => {
    if (film) draft.assets[film.id] = film.asset;
    const ready: Take[] = [];
    /** Which sound asset each take that is put in has. */
    const assetOf: string[] = [];
    let lost = 0;
    takes.forEach((take, index) => {
      const sound = sounds[index];
      if (!sound) {
        lost += 1;
        return;
      }
      const filmed = film && take.camera;
      draft.assets[sound.id] = filmed
        ? // The film has the recording's own time: this stretch began `filmAt` into it.
          { ...sound.asset, camera: { asset: film.id, offset: -take.camera!.filmAt } }
        : sound.asset;
      const { sound: _sound, camera: _camera, ...rest } = take;
      assetOf.push(sound.id);
      ready.push({
        ...rest,
        asset: sound.id,
        seconds: sound.seconds,
        ...(filmed ? { camera: take.camera!.place } : {}),
      });
    });
    const applied = applyRecording(draft, ready, newId);
    for (const number of applied.skipped ?? []) delete draft.assets[assetOf[number]!];
    const deleted = new Set((applied.skipped ?? []).map((number) => ready[number]!.scene));
    if (film && !Object.values(draft.assets).some((asset) => asset.camera?.asset === film.id)) {
      delete draft.assets[film.id];
    }
    const numbers = slideNumbers(draft.scenes);
    const leftOut = (applied.left ?? [])
      .map((id) => numbers[draft.scenes.findIndex((scene) => scene.id === id)] ?? 0)
      .filter((n) => n > 0);
    saved = { ...applied, lost, deleted: deleted.size, leftOut };
  });
  return saved;
}

/** Says what became of a recording, in the words the lecturer meets. */
function recordingNotice(saved: SavedRecording, filmLost: boolean): void {
  const parts: string[] = [];
  const placed = saved.slides + saved.repeats > 0;
  if (placed) {
    parts.push(
      saved.slides === 1
        ? 'Opptaket er lagt på lysarket.'
        : `Opptaket er lagt på ${saved.slides} lysark.`,
    );
    if (saved.repeats === 1) {
      parts.push('Ett sted gikk du tilbake til et lysark; det står i lista som «igjen».');
    } else if (saved.repeats > 1) {
      parts.push(
        `${saved.repeats} steder gikk du tilbake til et lysark; de står i lista som «igjen».`,
      );
    }
  }
  if (saved.leftOut.length > 0) {
    const one = saved.leftOut.length === 1;
    parts.push(
      `${one ? 'Lysark' : 'Lysarkene'} ${listed(saved.leftOut)} er ikke med i videoen, fordi du hoppet over ${one ? 'det' : 'dem'} i opptaket. Du kan ta ${one ? 'det' : 'dem'} med igjen i fanen «Lysark».`,
    );
  }
  if (saved.deleted > 0) {
    parts.push(
      saved.deleted === 1
        ? 'Ett lysark du leste inn, ble slettet mens opptaket ble lagret. Det du sa der, er ikke lagt på.'
        : `${saved.deleted} lysark du leste inn, ble slettet mens opptaket ble lagret. Det du sa der, er ikke lagt på.`,
    );
  }
  if (saved.lost > 0) {
    parts.push(
      placed
        ? 'Noe av lyden kunne ikke lagres. Det som ble lagret, er lagt på.'
        : 'Lyden kunne ikke lagres. Se at det er plass på disken, og prøv igjen.',
    );
  }
  if (filmLost && placed) {
    parts.push('Kameraopptaket kunne ikke lagres, så lysarkene har lyd uten kamerasirkel.');
  }
  if (placed) parts.push('Husk å lagre prosjektet.');
  if (parts.length === 0) return;
  const failed = saved.lost > 0 || (filmLost && placed) || !placed;
  useStore.getState().setNotice({ kind: failed ? 'error' : 'info', text: parts.join(' ') });
}

/** The camera's part of a recording that is being saved. */
export interface FilmParts {
  film: Film;
  store: FilmStore;
}

/**
 * Saves a recording after the recording window has closed: the film is
 * finished and stored, the sound of every stretch is stored, and then all
 * of it is put on the project as it is at that moment, as one change. The
 * lecturer works on meanwhile; the slide that is selected and the panel
 * that is open are left as they are. While it runs, the store knows
 * (`savingRecording`), and what must wait for it says so.
 */
export function saveRecordingLater(takes: RecordedTake[], camera: FilmParts | null): void {
  if (takes.length === 0) {
    // Nothing was read in: a film that was begun is thrown away.
    if (camera) {
      void camera.film
        .end()
        .catch(() => 0)
        .then(() => camera.store.drop());
    }
    return;
  }
  const app = useStore.getState();
  app.setSavingRecording(true);
  void (async () => {
    try {
      let film: AddedMedia | undefined;
      let filmLost = false;
      if (camera) {
        const pictures = await camera.film.end().catch(() => 0);
        if (pictures > 0) {
          film = await camera.store.end();
          filmLost = !film && takes.some((take) => take.camera);
        } else {
          camera.store.drop();
        }
      }
      recordingNotice(await saveRecording(takes, film), filmLost);
    } catch (error) {
      const reason = error instanceof Error ? ` (${error.message})` : '';
      useStore.getState().setNotice({
        kind: 'error',
        text: `Opptaket kunne ikke lagres helt${reason}. Det som ble lagret, ligger i prosjektmappa.`,
      });
    } finally {
      useStore.getState().setSavingRecording(false);
    }
  })();
}

/**
 * True, with the lecturer told why, when a recording is being saved and
 * what was asked for must wait until it is done.
 */
function waitsForSaving(): boolean {
  const state = useStore.getState();
  if (!state.savingRecording) return false;
  state.setNotice({ kind: 'info', text: WAIT_FOR_SAVING });
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

/**
 * «Rydd i prosjektmappa»: the files in the media folder that nothing uses
 * (no slide, no "Lær mer" box, no track, and nothing "Angre" or "Gjør om"
 * can bring back) are counted, the owner is asked, and on a yes they go to
 * the system's waste bin. They are then taken out of the project's list of
 * media too, in every state of the undo history.
 */
export async function tidyProjectFolder(): Promise<void> {
  if (waitsForSaving()) return;
  const state = useStore.getState();
  if (!state.dir || !state.project || state.recorder) return;
  const projects = [
    state.project,
    ...(state.saved ? [state.saved] : []),
    ...state.past,
    ...state.future,
  ];
  const keep = [...usedMediaFiles(projects)];
  const result = await guard(() => api().tidyMedia(state.dir!, keep));
  if (!result) return;
  if (result.found === 0) {
    useStore.getState().setNotice({
      kind: 'info',
      text: 'Prosjektmappa er ryddig. Alle filene i den er i bruk.',
    });
    return;
  }
  if (result.trashed.length === 0 && result.failed === 0) return; // the owner said no
  if (result.trashed.length > 0) useStore.getState().forgetMedia(result.trashed);
  const parts: string[] = [];
  if (result.trashed.length > 0) {
    parts.push(
      result.trashed.length === 1
        ? 'Én fil er lagt i papirkurven.'
        : `${result.trashed.length} filer er lagt i papirkurven.`,
    );
  }
  if (result.failed > 0) {
    parts.push(
      result.failed === 1
        ? 'Én fil kunne ikke legges i papirkurven, og ligger fortsatt i prosjektmappa.'
        : `${result.failed} filer kunne ikke legges i papirkurven, og ligger fortsatt i prosjektmappa.`,
    );
  }
  if (result.trashed.length > 0) parts.push('Husk å lagre prosjektet.');
  useStore.getState().setNotice({
    kind: result.failed > 0 ? 'error' : 'info',
    text: parts.join(' '),
  });
}

export async function unpackProject(): Promise<void> {
  if (waitsForSaving()) return;
  if (!(await leaveCurrent())) return;
  const opened = await guard(() => api().unpackProject());
  if (opened) useStore.getState().load(opened.dir, opened.project);
}

/** Opens an HTML file exported by Lysark as a new project. */
export async function openHtmlFile(): Promise<void> {
  if (waitsForSaving()) return;
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
  if (waitsForSaving()) return;
  if (pdfImport) return;
  if (!(await leaveCurrent())) return;
  const picked = await guard(() => api().pickPdf());
  if (!picked) return;
  // The shape of the pages is what Lysark recommends.
  const { pdfShape } = await import('./pdfRender');
  const shape = await pdfShape(picked.data);
  const choice = await askLook('pdf', picked.name, shape);
  if (!choice) return;
  pdfImport = new AbortController();
  await importPickedPdf(picked, pdfImport, choice);
}

/**
 * A PowerPoint file that keeps its look. A program on the machine that can
 * draw PowerPoint slides makes a PDF of it, which is imported like any PDF;
 * the names of the slides, the manuscript and the chapters come from the
 * PowerPoint file itself. When no such program is there, the owner is asked
 * for a PDF of the presentation.
 */
async function importPptxWithItsLook(name: string, orientation: Orientation): Promise<void> {
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
  await importPickedPdf({ name, data: pdf.data }, control, {
    look: 'keep',
    orientation,
    slides,
    from,
  });
}

/** Reads a PDF that has been picked (or made) and opens it as a new project. */
async function importPickedPdf(
  picked: PickedPdf,
  control: AbortController,
  options: { look: ImportLook; orientation: Orientation; slides?: PptxSlide[]; from?: string },
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
      orientation: options.orientation,
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
  // Never wider than the room between the margins (an upright slide has less of it).
  const fitted = fitInside(size, Math.min(900, roomWidth(getTheme(state.project))), 620);
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
  const fitted = fitInside(
    { w: size.w * 100, h: size.h * 100 },
    Math.min(960, roomWidth(getTheme(state.project))),
    540,
  );
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
