// The list of scenes with small live pictures of each.
import { useEffect, useRef, useState } from 'react';
import { newScene } from '../../shared/format/factory';
import type { SceneKind } from '../../shared/format/schema';
import { SceneView } from './SceneView';
import { KIND_NAMES, cloneScene } from './ops';
import { useStore } from './store';

const THUMB_SCALE = 0.1;

export function SceneList() {
  const project = useStore((s) => s.project)!;
  const sceneId = useStore((s) => s.sceneId);
  const logo = useStore((s) => s.logo);
  const setScene = useStore((s) => s.setScene);
  const update = useStore((s) => s.update);
  const [menuOpen, setMenuOpen] = useState(false);
  const current = useRef<HTMLLIElement>(null);

  useEffect(() => {
    current.current?.scrollIntoView({ block: 'nearest' });
  }, [sceneId]);

  const index = project.scenes.findIndex((s) => s.id === sceneId);

  const add = (kind: SceneKind): void => {
    const scene = newScene(kind);
    update((draft) => {
      draft.scenes.splice(index + 1, 0, scene);
    });
    setScene(scene.id);
    setMenuOpen(false);
  };

  const duplicate = (): void => {
    const source = project.scenes[index];
    if (!source) return;
    const copy = cloneScene(source);
    update((draft) => {
      draft.scenes.splice(index + 1, 0, copy);
    });
    setScene(copy.id);
  };

  const remove = (): void => {
    const source = project.scenes[index];
    if (!source) return;
    const name = source.title.trim() || `scene ${index + 1}`;
    if (!window.confirm(`Slette «${name}»? Du kan angre etterpå.`)) return;
    const next = project.scenes[index + 1] ?? project.scenes[index - 1];
    update((draft) => {
      draft.scenes.splice(index, 1);
    });
    if (next) setScene(next.id);
  };

  const move = (delta: number): void => {
    const to = index + delta;
    if (index < 0 || to < 0 || to >= project.scenes.length) return;
    update((draft) => {
      const [scene] = draft.scenes.splice(index, 1);
      draft.scenes.splice(to, 0, scene!);
    });
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const to = index + (event.key === 'ArrowDown' ? 1 : -1);
      const target = project.scenes[to];
      if (target) setScene(target.id);
      event.preventDefault();
    }
  };

  return (
    <nav className="scene-list" aria-label="Scener">
      <div className="scene-tools">
        <div className="menu-anchor">
          <button
            type="button"
            className="strong"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            Ny scene
          </button>
          {menuOpen && (
            <div className="menu" role="menu">
              {(['content', 'title', 'section', 'closing'] as SceneKind[]).map((kind) => (
                <button key={kind} type="button" role="menuitem" onClick={() => add(kind)}>
                  {KIND_NAMES[kind]}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" title="Lag kopi av scenen" disabled={index < 0} onClick={duplicate}>
          Kopi
        </button>
        <button
          type="button"
          title="Flytt scenen opp"
          disabled={index <= 0}
          onClick={() => move(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          title="Flytt scenen ned"
          disabled={index < 0 || index >= project.scenes.length - 1}
          onClick={() => move(1)}
        >
          ↓
        </button>
        <button type="button" title="Slett scenen" disabled={index < 0} onClick={remove}>
          Slett
        </button>
      </div>
      <ol onKeyDown={onKeyDown}>
        {project.scenes.map((scene, i) => {
          const warnings = scene.imported?.warnings.length ?? 0;
          const selected = scene.id === sceneId;
          return (
            <li key={scene.id} ref={selected ? current : undefined}>
              <button
                type="button"
                className="scene-item"
                aria-current={selected ? 'true' : undefined}
                onClick={() => setScene(scene.id)}
              >
                <span className="scene-number">{i + 1}</span>
                <span
                  className="scene-thumb"
                  style={{ width: 1920 * THUMB_SCALE, height: 1080 * THUMB_SCALE }}
                >
                  <span
                    className="scene-thumb-inner"
                    style={{ transform: `scale(${THUMB_SCALE})` }}
                  >
                    <SceneView scene={scene} project={project} logo={logo} />
                  </span>
                </span>
                <span className="scene-caption">
                  <span className="scene-title">{scene.title.trim() || 'Uten navn'}</span>
                  {warnings > 0 && (
                    <span className="scene-warning" title="Noe fra PowerPoint må lages på nytt">
                      {warnings} å ordne
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
