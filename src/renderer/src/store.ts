// Program state: the open project, what is selected, and undo history.
import { produce } from 'immer';
import { followFigures } from '../../shared/layout/groups';
import { followTemplates } from '../../shared/layout/templates';
import { followMarks } from '../../shared/layout/marks';
import { followRepeats } from '../../shared/layout/repeats';
import { create } from 'zustand';
import type { ImportReport, LogoStatus, VideoProgress } from '../../shared/api';
import type { Element, Project, Scene } from '../../shared/format/schema';

export interface Notice {
  kind: 'info' | 'error';
  text: string;
  /** Path offered as "Vis i mappe". */
  path?: string;
}

/** Which rich text is being edited in place on the stage. */
export interface Editing {
  elementId: string;
  /** For tables: "row:cell". */
  cell?: string;
}

/** The media dialog is open, and something waits for what the owner picks. */
export interface MediaRequest {
  kind: 'image' | 'video';
  /** Called with the chosen asset's id, or undefined when the dialog is closed. */
  resolve: (assetId: string | undefined) => void;
}

/** How far the import of a PDF has come. */
export interface PdfProgress {
  name: string;
  page: number;
  pages: number;
  /** A PDF of a PowerPoint file is being made, before anything can be read. */
  preparing?: boolean;
}

/** How the slides of an imported file are to look. */
export type ImportLook = 'keep' | 'theme';

/** A file has been picked for import, and the owner is asked how its slides are to look. */
export interface LookRequest {
  kind: 'pptx' | 'pdf';
  name: string;
  /** Called with the choice, or undefined when the owner breaks off. */
  resolve: (look: ImportLook | undefined) => void;
}

interface State {
  dir: string | null;
  project: Project | null;
  /** The project as it was last saved; used to know if there are changes. */
  saved: Project | null;
  sceneId: string | null;
  selection: string[];
  editing: Editing | null;
  past: Project[];
  future: Project[];
  coalesce: { key: string; time: number } | null;
  showGrid: boolean;
  /** Step preview in the editor: how many steps are shown; null = everything. */
  previewSteps: number | null;
  /** The step that zooms whose frame is shown on the slide, to be dragged into place. */
  zoomStep: string | null;
  /**
   * Where in the slide's sound the sound panel or the timeline stands, and
   * whether it is playing: the camera circle on the stage shows that moment.
   */
  soundAt: { t: number; playing: boolean } | null;
  clipboard: Element[];
  logo: LogoStatus;
  report: { report: ImportReport; sourceName: string; closingSlides?: number[] } | null;
  notice: Notice | null;
  /** Id of the element whose "Lær mer" content is open in the builder. */
  builder: string | null;
  mediaRequest: MediaRequest | null;
  /** Which panel is open under the slide: the manuscript or the sound. */
  bottomTab: 'script' | 'sound' | 'timeline';
  /**
   * The recording window is open, starting on the current slide. With
   * `keepBefore`, the slide's sound before that time is kept and the rest
   * is recorded anew.
   */
  recorder: { keepBefore?: number } | null;
  /** The dialog for exporting video is open. */
  videoDialog: boolean;
  /** How far a running video export has come. */
  videoProgress: VideoProgress | null;
  /** A PDF is being imported: how far it has come. `pages` is 0 until the file is read. */
  pdfProgress: PdfProgress | null;
  lookRequest: LookRequest | null;

  load(dir: string, project: Project): void;
  close(): void;
  /**
   * Changes the project. Changes with the same `coalesce` key made shortly
   * after each other become one undo step (typing, dragging). With `held`,
   * however long after: a drag is one step even when the pointer rests in it.
   */
  update(recipe: (draft: Project) => void, coalesce?: string, held?: boolean): void;
  updateScene(
    recipe: (scene: Scene, draft: Project) => void,
    coalesce?: string,
    held?: boolean,
  ): void;
  undo(): void;
  redo(): void;
  markSaved(): void;
  setScene(id: string): void;
  select(ids: string[]): void;
  setEditing(editing: Editing | null): void;
  toggleGrid(): void;
  setPreviewSteps(steps: number | null): void;
  setZoomStep(id: string | null): void;
  setSoundAt(at: { t: number; playing: boolean } | null): void;
  setClipboard(elements: Element[]): void;
  setLogo(logo: LogoStatus): void;
  setReport(report: State['report']): void;
  setNotice(notice: Notice | null): void;
  openBuilder(elementId: string | null): void;
  setMediaRequest(request: MediaRequest | null): void;
  setBottomTab(tab: 'script' | 'sound' | 'timeline'): void;
  openRecorder(recorder: State['recorder']): void;
  setVideoDialog(open: boolean): void;
  setVideoProgress(progress: VideoProgress | null): void;
  setPdfProgress(progress: PdfProgress | null): void;
  setLookRequest(request: LookRequest | null): void;
}

const HISTORY_LIMIT = 100;
const COALESCE_WINDOW = 1200;

export const useStore = create<State>((set, get) => ({
  dir: null,
  project: null,
  saved: null,
  sceneId: null,
  selection: [],
  editing: null,
  past: [],
  future: [],
  coalesce: null,
  showGrid: false,
  previewSteps: null,
  zoomStep: null,
  soundAt: null,
  clipboard: [],
  logo: { nb: { light: false, dark: false }, en: { light: false, dark: false }, version: 0 },
  report: null,
  notice: null,
  builder: null,
  mediaRequest: null,
  bottomTab: 'script',
  recorder: null,
  videoDialog: false,
  videoProgress: null,
  pdfProgress: null,
  lookRequest: null,

  load(dir, project) {
    set({
      builder: null,
      recorder: null,
      videoDialog: false,
      dir,
      project,
      saved: project,
      sceneId: project.scenes[0]?.id ?? null,
      selection: [],
      editing: null,
      past: [],
      future: [],
      coalesce: null,
      previewSteps: null,
    });
  },

  close() {
    set({
      builder: null,
      recorder: null,
      videoDialog: false,
      dir: null,
      project: null,
      saved: null,
      sceneId: null,
      selection: [],
      editing: null,
      past: [],
      future: [],
    });
  },

  update(recipe, coalesce, held) {
    const { project, past, coalesce: last } = get();
    if (!project) return;
    // A slide that is shown once more shows what its slide shows, whatever was changed.
    const next = followRepeats(
      produce(project, (draft) => {
        recipe(draft);
        for (const scene of draft.scenes) {
          // Marks and legends go where their pictures go,
          followMarks(scene);
          // A figure with a form is what its form says,
          followTemplates(scene);
          // and a fastened line goes where what it is fastened to goes.
          followFigures(scene);
        }
      }),
    );
    if (next === project) return;
    const now = Date.now();
    const merge =
      !!coalesce &&
      !!last &&
      last.key === coalesce &&
      (held === true || now - last.time < COALESCE_WINDOW);
    set({
      project: next,
      past: merge ? past : [...past, project].slice(-HISTORY_LIMIT),
      future: [],
      coalesce: coalesce ? { key: coalesce, time: now } : null,
    });
  },

  updateScene(recipe, coalesce, held) {
    const { sceneId } = get();
    get().update(
      (draft) => {
        const scene = draft.scenes.find((s) => s.id === sceneId);
        if (scene) recipe(scene, draft);
      },
      coalesce,
      held,
    );
  },

  undo() {
    const { project, past, future } = get();
    const previous = past[past.length - 1];
    if (!project || !previous) return;
    set({
      project: previous,
      past: past.slice(0, -1),
      future: [project, ...future],
      coalesce: null,
    });
    get().select(get().selection);
    fixScene(get, set);
  },

  redo() {
    const { project, past, future } = get();
    const next = future[0];
    if (!project || !next) return;
    set({ project: next, past: [...past, project], future: future.slice(1), coalesce: null });
    get().select(get().selection);
    fixScene(get, set);
  },

  markSaved() {
    set({ saved: get().project });
  },

  setScene(id) {
    if (get().sceneId === id) return;
    set({
      sceneId: id,
      selection: [],
      editing: null,
      previewSteps: null,
      coalesce: null,
      builder: null,
    });
  },

  select(ids) {
    const scene = currentScene(get());
    const valid = scene ? ids.filter((id) => scene.elements.some((e) => e.id === id)) : [];
    set({ selection: valid });
  },

  setEditing(editing) {
    set({ editing, coalesce: null });
  },

  toggleGrid() {
    set({ showGrid: !get().showGrid });
  },

  setPreviewSteps(steps) {
    set({ previewSteps: steps });
  },

  setZoomStep(id) {
    set({ zoomStep: id });
  },

  setSoundAt(at) {
    const before = get().soundAt;
    if (before === at) return;
    if (before && at && before.t === at.t && before.playing === at.playing) return;
    set({ soundAt: at });
  },

  setClipboard(elements) {
    set({ clipboard: elements });
  },

  setLogo(logo) {
    set({ logo });
  },

  setReport(report) {
    set({ report });
  },

  setNotice(notice) {
    set({ notice });
  },

  openBuilder(elementId) {
    set({ builder: elementId, editing: null, coalesce: null });
  },

  setMediaRequest(request) {
    set({ mediaRequest: request });
  },

  setBottomTab(tab) {
    set({ bottomTab: tab });
  },

  openRecorder(recorder) {
    set({ recorder, editing: null, coalesce: null, previewSteps: null });
  },

  setVideoDialog(open) {
    set({ videoDialog: open, editing: null });
  },

  setVideoProgress(progress) {
    set({ videoProgress: progress });
  },

  setPdfProgress(progress) {
    set({ pdfProgress: progress });
  },

  setLookRequest(request) {
    set({ lookRequest: request });
  },
}));

/** After undo/redo the current scene may no longer exist. */
function fixScene(get: () => State, set: (partial: Partial<State>) => void): void {
  const { project, sceneId } = get();
  if (project && !project.scenes.some((s) => s.id === sceneId)) {
    set({ sceneId: project.scenes[0]?.id ?? null, selection: [], editing: null });
  }
}

export function currentScene(state: Pick<State, 'project' | 'sceneId'>): Scene | undefined {
  return state.project?.scenes.find((s) => s.id === state.sceneId);
}

export function isDirty(state: Pick<State, 'project' | 'saved'>): boolean {
  return state.project !== state.saved;
}
