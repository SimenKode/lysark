// The list of scenes with small live pictures of each. Chapters are
// headings in the list; a slide that is shown once more in a recording
// stands where that happened, marked "igjen" and with the number of the
// slide it shows.
import { useEffect, useRef, useState } from 'react';
import { newScene } from '../../shared/format/factory';
import { releaseScene } from '../../shared/audio/tracks';
import type { SceneKind } from '../../shared/format/schema';
import { handOnChapter } from '../../shared/layout/repeats';
import { slideNumbers } from '../../shared/layout/slides';
import { Icon } from './Icon';
import { SceneView } from './SceneView';
import { KIND_NAMES, cloneScene, playClosingAnimation } from './ops';
import { useStore } from './store';

const STAGE_WIDTH = 1920;

export function SceneList() {
  const project = useStore((s) => s.project)!;
  const sceneId = useStore((s) => s.sceneId);
  const logo = useStore((s) => s.logo);
  const setScene = useStore((s) => s.setScene);
  const update = useStore((s) => s.update);
  const [menuOpen, setMenuOpen] = useState(false);
  const current = useRef<HTMLLIElement>(null);
  const list = useRef<HTMLOListElement>(null);
  // The thumbnails fill the width the list has left after margins, the
  // number column and the scrollbar (whose width differs between systems).
  const [thumbScale, setThumbScale] = useState(0);

  useEffect(() => {
    const ol = list.current;
    if (!ol) return;
    const measure = (): void => {
      const width = ol.querySelector<HTMLElement>('.scene-thumb')?.clientWidth ?? 0;
      if (width > 0) setThumbScale(width / STAGE_WIDTH);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(ol);
    return () => observer.disconnect();
  }, [project.scenes.length]);

  useEffect(() => {
    current.current?.scrollIntoView({ block: 'nearest' });
  }, [sceneId]);

  const index = project.scenes.findIndex((s) => s.id === sceneId);
  const numbers = slideNumbers(project.scenes);
  const currentIsRepeat = project.scenes[index]?.repeat !== undefined;
  /** The chapter whose name is to be typed: it was just made. */
  const [namingChapter, setNamingChapter] = useState<string | null>(null);

  const add = (kind: SceneKind): void => {
    const scene = newScene(kind);
    // A new closing slide plays USN's closing animation when the owner has supplied it.
    if (kind === 'closing' && logo.closing) playClosingAnimation(scene, logo.closing.seconds);
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
    const name = source.title.trim() || `lysark ${numbers[index]}`;
    const again = project.scenes.filter((s) => s.repeat?.of === source.id).length;
    const question = source.repeat
      ? `Slette stedet der lysark ${numbers[index]} vises igjen? Lyden som hører til, blir borte fra forelesningen. Du kan angre etterpå.`
      : again > 0
        ? `Slette «${name}»? Det vises igjen ${again === 1 ? 'ett sted' : `${again} steder`} i opptaket; de blir også borte. Du kan angre etterpå.`
        : `Slette «${name}»? Du kan angre etterpå.`;
    if (!window.confirm(question)) return;
    const left = project.scenes.filter(
      (s, i) => i !== index && s.id !== source.id && s.repeat?.of !== source.id,
    );
    const next = left.find((s) => project.scenes.indexOf(s) > index) ?? left[left.length - 1];
    update((draft) => {
      // Music fastened to the slide moves to its neighbour instead of going with it,
      // and a chapter that began on it begins on the next slide.
      releaseScene(draft, source.id);
      handOnChapter(draft.scenes, index);
      draft.scenes.splice(index, 1);
    });
    if (next) setScene(next.id);
  };

  /** A chapter begins on the current slide; its name is typed in the list. */
  const startChapter = (): void => {
    const source = project.scenes[index];
    setMenuOpen(false);
    if (!source || source.repeat || source.chapter !== undefined) return;
    update((draft) => {
      const scene = draft.scenes.find((s) => s.id === source.id);
      if (scene) scene.chapter = 'Nytt kapittel';
    });
    setNamingChapter(source.id);
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
    // In the name of a chapter the arrow keys belong to the text.
    if ((event.target as HTMLElement).tagName === 'INPUT') return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const to = index + (event.key === 'ArrowDown' ? 1 : -1);
      const target = project.scenes[to];
      if (target) setScene(target.id);
      event.preventDefault();
    }
  };

  return (
    <nav className="scene-list" aria-label="Lysark">
      <div className="scene-tools">
        <div className="menu-anchor">
          <button
            type="button"
            className="strong with-icon"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name="plus" />
            Nytt lysark
          </button>
          {menuOpen && (
            <div className="menu" role="menu">
              {(['content', 'title', 'section', 'closing'] as SceneKind[]).map((kind) => (
                <button key={kind} type="button" role="menuitem" onClick={() => add(kind)}>
                  {KIND_NAMES[kind]}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                className="menu-divided"
                disabled={
                  index < 0 || currentIsRepeat || project.scenes[index]?.chapter !== undefined
                }
                onClick={startChapter}
              >
                Kapittel som begynner her
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="icon-only"
          aria-label="Lag kopi av lysarket"
          title="Lag kopi av lysarket"
          disabled={index < 0 || currentIsRepeat}
          onClick={duplicate}
        >
          <Icon name="copy" />
        </button>
        <button
          type="button"
          className="icon-only"
          aria-label="Flytt lysarket opp"
          title="Flytt lysarket opp"
          disabled={index <= 0}
          onClick={() => move(-1)}
        >
          <Icon name="up" />
        </button>
        <button
          type="button"
          className="icon-only"
          aria-label="Flytt lysarket ned"
          title="Flytt lysarket ned"
          disabled={index < 0 || index >= project.scenes.length - 1}
          onClick={() => move(1)}
        >
          <Icon name="down" />
        </button>
        <button
          type="button"
          className="icon-only danger"
          aria-label="Slett lysarket"
          title="Slett lysarket"
          disabled={index < 0}
          onClick={remove}
        >
          <Icon name="trash" />
        </button>
      </div>
      <ol ref={list} onKeyDown={onKeyDown}>
        {project.scenes.map((scene, i) => {
          const warnings = scene.imported?.warnings.length ?? 0;
          const selected = scene.id === sceneId;
          const repeat = scene.repeat !== undefined;
          const chapter = repeat ? undefined : scene.chapter;
          return (
            <li key={scene.id} ref={selected ? current : undefined}>
              {chapter !== undefined && (
                <div className="scene-chapter">
                  <input
                    type="text"
                    aria-label="Navn på kapittelet"
                    value={chapter}
                    placeholder="Kapittel uten navn"
                    autoFocus={namingChapter === scene.id}
                    onFocus={(event) => {
                      if (namingChapter === scene.id) event.target.select();
                    }}
                    onBlur={() => namingChapter === scene.id && setNamingChapter(null)}
                    onChange={(event) =>
                      update((draft) => {
                        const target = draft.scenes.find((s) => s.id === scene.id);
                        if (target) target.chapter = event.target.value;
                      }, `chapter-${scene.id}`)
                    }
                  />
                  <button
                    type="button"
                    title="Fjern kapittelet. Lysarkene blir stående."
                    onClick={() =>
                      update((draft) => {
                        const target = draft.scenes.find((s) => s.id === scene.id);
                        if (target) delete target.chapter;
                      })
                    }
                  >
                    Fjern
                  </button>
                </div>
              )}
              <button
                type="button"
                className={`scene-item${repeat ? ' is-repeat' : ''}`}
                aria-current={selected ? 'true' : undefined}
                onClick={() => setScene(scene.id)}
              >
                <span className="scene-number">{repeat ? '↩' : numbers[i]}</span>
                <span className="scene-thumb">
                  {thumbScale > 0 && (
                    <span
                      className="scene-thumb-inner"
                      style={{ transform: `scale(${thumbScale})` }}
                    >
                      <SceneView scene={scene} project={project} logo={logo} />
                    </span>
                  )}
                </span>
                <span className="scene-caption">
                  {repeat ? (
                    <span className="scene-title">Lysark {numbers[i]} igjen</span>
                  ) : (
                    <span className="scene-title">{scene.title.trim() || 'Uten navn'}</span>
                  )}
                  {warnings > 0 && !repeat && (
                    <span className="scene-warning" title="Merknader fra importen">
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
