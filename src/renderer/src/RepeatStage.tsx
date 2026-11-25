// What the editor shows for a slide that is shown once more (a "repeat"):
// while recording, the lecturer went back to a slide, and the recording
// shows it again at that place. A repeat always shows what its slide shows,
// so nothing on it can be changed here; its sound, its manuscript and the
// place of the camera circle are its own and are edited as on any slide.
import { useLayoutEffect, useRef, useState } from 'react';
import { STAGE } from '../../shared/format/constants';
import { slideNumbers } from '../../shared/layout/slides';
import { sceneDuration, stepsShownAt } from '../../shared/render/clock';
import { SceneView } from './SceneView';
import { StageCamera } from './StageCamera';
import { currentScene, useStore } from './store';

/** The number of the slide the current repeat shows, and that slide's id. */
function useRepeat(): { number: number; of: string } | null {
  const project = useStore((s) => s.project);
  const scene = useStore(currentScene);
  if (!project || !scene?.repeat) return null;
  const at = project.scenes.findIndex((s) => s.id === scene.id);
  return { number: slideNumbers(project.scenes)[at] ?? 0, of: scene.repeat.of };
}

export function RepeatStage() {
  const project = useStore((s) => s.project)!;
  const scene = useStore(currentScene)!;
  const logo = useStore((s) => s.logo);
  const previewSteps = useStore((s) => s.previewSteps);
  const repeat = useRepeat();
  const area = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const measure = (): void =>
      setScale(
        Math.max(
          0.05,
          Math.min((el.clientWidth - 48) / STAGE.width, (el.clientHeight - 48) / STAGE.height),
        ),
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // Without the sound panel saying otherwise: the slide as it stood when it was left.
  const steps = previewSteps ?? stepsShownAt(scene, Math.max(0, sceneDuration(scene) - 0.001));
  return (
    <div className="stage-column">
      <p className="repeat-note" role="note">
        <span>
          <strong>Lysark {repeat?.number} vises her en gang til.</strong> Under opptaket gikk du
          tilbake til det. Innholdet endrer du på lysark {repeat?.number}; lyden, manuset og
          kamerasirkelen her hører til dette stedet i opptaket.
        </span>
        <button
          type="button"
          onClick={() => repeat && useStore.getState().setScene(repeat.of)}
        >{`Gå til lysark ${repeat?.number}`}</button>
      </p>
      <div className="stage-area" ref={area}>
        {scale > 0 && (
          <div
            className="recorder-stage-box"
            style={{ width: STAGE.width * scale, height: STAGE.height * scale }}
          >
            <div className="recorder-stage-inner" style={{ transform: `scale(${scale})` }}>
              <SceneView scene={scene} project={project} logo={logo} previewSteps={steps} />
              <StageCamera scene={scene} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function RepeatInspector() {
  const repeat = useRepeat();
  return (
    <aside className="inspector" aria-label="Egenskaper">
      <div className="repeat-panel">
        <h3>Lysark {repeat?.number}, en gang til</h3>
        <p>
          Dette stedet kom til da du gikk tilbake til lysark {repeat?.number} mens du leste inn.
          Videoen og «Spill av» viser lysarkene i den rekkefølgen du viste dem.
        </p>
        <p>
          Her kan du klippe i lyden, skrive manus (det blir teksting), flytte kamerasirkelen, flytte
          stedet opp eller ned i lista, eller slette det. Sletter du det, blir lyden som hører til,
          borte fra forelesningen.
        </p>
      </div>
    </aside>
  );
}
