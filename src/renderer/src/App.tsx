// The main window: welcome screen, top bar, scene list, stage, side panel
// and script panel.
import { useEffect, useState } from 'react';
import type { MenuCommand } from '../../shared/api';
import type { ShapeElement, TextRole } from '../../shared/format/schema';
import { getTheme } from '../../shared/theme/theme';
import { formatTime, sceneDuration } from '../../shared/render/clock';
import { AudioPanel } from './AudioPanel';
import { ImportReportDialog, SettingsDialog } from './Dialogs';
import { Inspector } from './Inspector';
import { MediaDialog } from './MediaDialog';
import { MoreBuilder } from './MoreBuilder';
import { Recorder } from './Recorder';
import { VideoDialog } from './VideoDialog';
import { SceneList } from './SceneList';
import { Stage } from './Stage';
import {
  exportHtml,
  importPptx,
  insertImage,
  insertVideoFile,
  insertVideoLink,
  newProject,
  openProject,
  packProject,
  preview,
  refreshLogo,
  save,
  showInFolder,
  unpackProject,
} from './actions';
import {
  GEOMETRY_NAMES,
  ROLE_NAMES,
  cloneElements,
  deleteElements,
  newDeepDiveElement,
  newShapeElement,
  newTableElement,
  newTextElement,
} from './ops';
import { currentScene, isDirty, useStore } from './store';

function isTextInput(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable
  );
}

function Welcome() {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    void window.lysark.recentProjects().then(setRecent, () => setRecent([]));
  }, []);
  return (
    <main className="welcome">
      <div className="welcome-box">
        <h1>Lysark</h1>
        <p>Gjør en PowerPoint-forelesning om til en interaktiv HTML-fil i USNs visuelle profil.</p>
        <div className="welcome-actions">
          <button type="button" className="strong big" onClick={() => void importPptx()}>
            Importer PowerPoint …
          </button>
          <button type="button" className="big" onClick={() => void openProject()}>
            Åpne prosjekt …
          </button>
          <button type="button" className="big" onClick={() => void newProject()}>
            Nytt, tomt prosjekt …
          </button>
        </div>
        {recent.length > 0 && (
          <section className="recent">
            <h2>Sist brukt</h2>
            <ul>
              {recent.map((dir) => (
                <li key={dir}>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => void openProject(dir)}
                    title={dir}
                  >
                    {dir.split(/[\\/]/).pop()}
                  </button>
                  <span className="hint">{dir}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function TopBar({ onSettings }: { onSettings: () => void }) {
  const project = useStore((s) => s.project)!;
  const dirty = useStore(isDirty);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const update = useStore((s) => s.update);
  return (
    <header className="topbar">
      <span className="brand">Lysark</span>
      <input
        className="project-title"
        aria-label="Forelesningens tittel"
        value={project.meta.title}
        onChange={(e) =>
          update((d) => {
            d.meta.title = e.target.value;
          }, 'meta-title')
        }
      />
      <div className="topbar-actions">
        <button
          type="button"
          onClick={() => useStore.getState().undo()}
          disabled={!canUndo}
          title="Angre (Ctrl+Z)"
        >
          Angre
        </button>
        <button
          type="button"
          onClick={() => useStore.getState().redo()}
          disabled={!canRedo}
          title="Gjør om (Ctrl+Shift+Z)"
        >
          Gjør om
        </button>
        <span className="gap" />
        <button type="button" onClick={() => void save()} title="Lagre (Ctrl+S)">
          {dirty ? 'Lagre •' : 'Lagret'}
        </button>
        <button type="button" onClick={onSettings}>
          Innstillinger
        </button>
        <button type="button" onClick={() => void preview()} title="Forhåndsvis (F5)">
          Forhåndsvis
        </button>
        <button
          type="button"
          className="strong"
          onClick={() => void exportHtml()}
          title="Eksporter HTML (Ctrl+E)"
        >
          Eksporter HTML
        </button>
        <button
          type="button"
          className="strong"
          onClick={() => useStore.getState().setVideoDialog(true)}
          title="Eksporter video (Ctrl+Shift+E)"
        >
          Eksporter video
        </button>
      </div>
    </header>
  );
}

function InsertBar() {
  const project = useStore((s) => s.project)!;
  const scene = useStore(currentScene);
  const showGrid = useStore((s) => s.showGrid);
  const [menu, setMenu] = useState<'text' | 'shape' | 'video' | null>(null);
  if (!scene) return null;
  const theme = getTheme(project);
  const add = (make: () => ReturnType<typeof newTextElement>, edit: boolean): void => {
    const element = make();
    const state = useStore.getState();
    state.updateScene((s) => {
      s.elements.push(element);
    });
    state.select([element.id]);
    if (edit) state.setEditing({ elementId: element.id });
    setMenu(null);
  };
  const toggle = (name: typeof menu) => () => setMenu(menu === name ? null : name);
  return (
    <div className="insertbar" role="toolbar" aria-label="Sett inn">
      <span className="bar-label">Sett inn</span>
      <div className="menu-anchor">
        <button type="button" aria-expanded={menu === 'text'} onClick={toggle('text')}>
          Tekst
        </button>
        {menu === 'text' && (
          <div className="menu" role="menu">
            {(Object.keys(ROLE_NAMES) as TextRole[]).map((role) => (
              <button
                key={role}
                type="button"
                role="menuitem"
                onClick={() => add(() => newTextElement(scene, theme, role), true)}
              >
                {ROLE_NAMES[role]}
              </button>
            ))}
          </div>
        )}
      </div>
      <button type="button" onClick={() => void insertImage()}>
        Bilde
      </button>
      <div className="menu-anchor">
        <button type="button" aria-expanded={menu === 'shape'} onClick={toggle('shape')}>
          Form
        </button>
        {menu === 'shape' && (
          <div className="menu" role="menu">
            {(Object.keys(GEOMETRY_NAMES) as ShapeElement['geometry'][]).map((g) => (
              <button
                key={g}
                type="button"
                role="menuitem"
                onClick={() => add(() => newShapeElement(scene, theme, g), false)}
              >
                {GEOMETRY_NAMES[g]}
              </button>
            ))}
          </div>
        )}
      </div>
      <button type="button" onClick={() => add(() => newTableElement(scene, theme), false)}>
        Tabell
      </button>
      <div className="menu-anchor">
        <button type="button" aria-expanded={menu === 'video'} onClick={toggle('video')}>
          Video
        </button>
        {menu === 'video' && (
          <div className="menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(null);
                void insertVideoFile();
              }}
            >
              Fra fil …
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(null);
                insertVideoLink();
              }}
            >
              Lenke
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          // The simple way in: a button in the scene, and straight into the builder.
          const element = newDeepDiveElement(scene, theme);
          add(() => element, false);
          useStore.getState().openBuilder(element.id);
        }}
        title="Knapp som åpner et panel med mer stoff. Du kan også høyreklikke på et element i lysarket."
      >
        + Lær mer
      </button>
      <span className="gap" />
      <button
        type="button"
        aria-pressed={showGrid}
        onClick={() => useStore.getState().toggleGrid()}
        title="Vis rutenett (Ctrl+G)"
      >
        Rutenett
      </button>
    </div>
  );
}

/** Under the slide: its manuscript, or its sound. */
function BottomPanel() {
  const scene = useStore(currentScene);
  const tab = useStore((s) => s.bottomTab);
  const setTab = useStore((s) => s.setBottomTab);
  if (!scene) return null;
  return (
    <section className="bottom-panel">
      <div className="bottom-tabs" role="tablist" aria-label="Manus og lyd">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'script'}
          onClick={() => setTab('script')}
        >
          Manus
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sound'}
          onClick={() => setTab('sound')}
        >
          Lyd ({formatTime(sceneDuration(scene))})
        </button>
      </div>
      {tab === 'script' ? <ScriptPanel /> : <AudioPanel />}
    </section>
  );
}

function ScriptPanel() {
  const scene = useStore(currentScene);
  const updateScene = useStore((s) => s.updateScene);
  if (!scene) return null;
  return (
    <section className="script-panel">
      <label>
        <span className="field-label">
          Manus for lysarket (fra notatene; blir stemmen i videoen, og kan vises for studentene)
        </span>
        <textarea
          rows={4}
          value={scene.script}
          onChange={(e) =>
            updateScene((s) => {
              s.script = e.target.value;
            }, 'script')
          }
        />
      </label>
    </section>
  );
}

function NoticeBar() {
  const notice = useStore((s) => s.notice);
  const setNotice = useStore((s) => s.setNotice);
  if (!notice) return null;
  return (
    <div
      className={`notice notice-${notice.kind}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
    >
      <span>{notice.text}</span>
      {notice.path && (
        <button type="button" onClick={() => showInFolder(notice.path!)}>
          Vis i mappe
        </button>
      )}
      <button type="button" onClick={() => setNotice(null)}>
        Lukk
      </button>
    </div>
  );
}

export function App() {
  const project = useStore((s) => s.project);
  const dirty = useStore(isDirty);
  const title = project?.meta.title ?? '';
  const report = useStore((s) => s.report);
  const builder = useStore((s) => s.builder);
  const mediaRequest = useStore((s) => s.mediaRequest);
  const recorder = useStore((s) => s.recorder);
  const videoDialog = useStore((s) => s.videoDialog);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void refreshLogo();
    void window.lysark.initialProject().then((dir) => {
      if (dir && !useStore.getState().project) void openProject(dir);
    });
  }, []);

  useEffect(() => {
    window.lysark.setDocumentState({ dirty, title });
  }, [dirty, title]);

  // Commands from the application menu.
  useEffect(() => {
    const run = async (command: MenuCommand): Promise<void> => {
      const state = useStore.getState();
      const active = document.activeElement;
      switch (command) {
        case 'new':
          return newProject();
        case 'open':
          return openProject();
        case 'import':
          return importPptx();
        case 'save':
          state.setEditing(null);
          await save();
          return;
        case 'save-then-close':
          state.setEditing(null);
          if (await save()) window.lysark.closeWindow();
          return;
        case 'preview':
          state.setEditing(null);
          return preview();
        case 'export':
          state.setEditing(null);
          return exportHtml();
        case 'export-video':
          if (state.project && !state.recorder) state.setVideoDialog(true);
          return;
        case 'record':
          if (state.project && currentScene(state) && !state.builder && !state.videoProgress) {
            state.setBottomTab('sound');
            state.openRecorder({});
          }
          return;
        case 'settings':
          setSettingsOpen(true);
          return;
        case 'undo':
        case 'redo':
          // In a text field, the field's own undo applies.
          if (isTextInput(active)) document.execCommand(command);
          else if (command === 'undo') state.undo();
          else state.redo();
          return;
        case 'delete':
          if (!isTextInput(active) && state.selection.length && !state.builder) {
            state.updateScene((s) => deleteElements(s, state.selection));
          }
          return;
        case 'duplicate': {
          const scene = currentScene(state);
          if (!scene || isTextInput(active) || state.selection.length === 0 || state.builder) {
            return;
          }
          const copies = cloneElements(
            scene.elements.filter((e) => state.selection.includes(e.id)),
            24,
          );
          state.updateScene((s) => {
            s.elements.push(...copies);
          });
          state.select(copies.map((c) => c.id));
          return;
        }
        case 'toggle-grid':
          state.toggleGrid();
          return;
        case 'pack':
          state.setEditing(null);
          return packProject();
        case 'unpack':
          return unpackProject();
      }
    };
    return window.lysark.onCommand((command) => void run(command));
  }, []);

  return (
    <>
      {project ? (
        // While the builder is open, nothing behind it can be reached by keyboard or screen reader.
        <div className="app" inert={!!builder || !!recorder}>
          <TopBar onSettings={() => setSettingsOpen(true)} />
          <div className="workspace">
            <SceneList />
            <div className="centre">
              <InsertBar />
              <Stage />
              <BottomPanel />
            </div>
            <Inspector onLogo={() => setSettingsOpen(true)} />
          </div>
        </div>
      ) : (
        <Welcome />
      )}
      <NoticeBar />
      {report && (
        <ImportReportDialog
          report={report.report}
          sourceName={report.sourceName}
          onClose={() => useStore.getState().setReport(null)}
        />
      )}
      {project && builder && <MoreBuilder elementId={builder} />}
      {project && mediaRequest && <MediaDialog request={mediaRequest} />}
      {project && recorder && <Recorder keepBefore={recorder.keepBefore} />}
      {project && videoDialog && <VideoDialog />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
