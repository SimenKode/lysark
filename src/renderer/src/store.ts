// Program state: the open project, what is selected, and undo history.
import { produce } from 'immer';
import { create } from 'zustand';
import type { ImportReport, LogoStatus } from '../../shared/api';
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
  clipboard: Element[];
  logo: LogoStatus;
  report: { report: ImportReport; sourceName: string } | null;
  notice: Notice | null;

  load(dir: string, project: Project): void;
  close(): void;
  /**
   * Changes the project. Changes with the same `coalesce` key made shortly
   * after each other become one undo step (typing, dragging).
   */
  update(recipe: (draft: Project) => void, coalesce?: string): void;
  updateScene(recipe: (scene: Scene, draft: Project) => void, coalesce?: string): void;
  undo(): void;
  redo(): void;
  markSaved(): void;
  setScene(id: string): void;
  select(ids: string[]): void;
  setEditing(editing: Editing | null): void;
  toggleGrid(): void;
  setPreviewSteps(steps: number | null): void;
  setClipboard(elements: Element[]): void;
  setLogo(logo: LogoStatus): void;
  setReport(report: State['report']): void;
  setNotice(notice: Notice | null): void;
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
  clipboard: [],
  logo: { nb: { light: false, dark: false }, en: { light: false, dark: false }, version: 0 },
  report: null,
  notice: null,

  load(dir, project) {
    set({
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

  update(recipe, coalesce) {
    const { project, past, coalesce: last } = get();
    if (!project) return;
    const next = produce(project, recipe);
    if (next === project) return;
    const now = Date.now();
    const merge =
      !!coalesce && !!last && last.key === coalesce && now - last.time < COALESCE_WINDOW;
    set({
      project: next,
      past: merge ? past : [...past, project].slice(-HISTORY_LIMIT),
      future: [],
      coalesce: coalesce ? { key: coalesce, time: now } : null,
    });
  },

  updateScene(recipe, coalesce) {
    const { sceneId } = get();
    get().update((draft) => {
      const scene = draft.scenes.find((s) => s.id === sceneId);
      if (scene) recipe(scene, draft);
    }, coalesce);
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
    set({ sceneId: id, selection: [], editing: null, previewSteps: null, coalesce: null });
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
