// The recording window. The owner reads the manuscript aloud and presses
// the right arrow to go on: to the next step, which gets its time from the
// press, or to the next slide, where the recording is divided. A whole
// lecture can be read in one go and still be edited slide by slide.
// While reading, the owner can open a "Lær mer" box and play a video on the
// slide; the program remembers when, like it does for the steps, and the
// video and "Spill av" do the same at the same times.
// Sound only, stored in the project folder, sent nowhere.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { newId } from '../../shared/format/factory';
import type { Scene, SceneEvent } from '../../shared/format/schema';
import {
  SAMPLE_RATE,
  formatTime,
  moreAt,
  stepsShownAt,
  videoKey,
  videosAt,
} from '../../shared/render/clock';
import { createPopover, type SlidePopover } from '../../shared/render/popover';
import { moreOf } from '../../shared/render/scene';
import { saveRecording } from './actions';
import {
  MicrophoneError,
  blockPeak,
  joinBlocks,
  listMicrophones,
  openMicrophone,
  type Capture,
  type MicrophoneChoice,
} from './audio/capture';
import { SceneView, renderContext } from './SceneView';
import { useStore } from './store';

type Phase = 'setup' | 'countdown' | 'recording' | 'paused' | 'saving';

const SETTINGS_KEY = 'lysark.mikrofon';
/** A slide where less than this was recorded keeps the sound it had. */
const MIN_RECORDING_SECONDS = 0.3;

interface MicSettings {
  deviceId: string;
  noiseSuppression: boolean;
  autoGain: boolean;
  /** Let a video that is played while reading be heard. */
  videoSound: boolean;
}

function readSettings(): MicSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<MicSettings>;
    return {
      deviceId: typeof saved.deviceId === 'string' ? saved.deviceId : '',
      noiseSuppression: saved.noiseSuppression !== false,
      autoGain: saved.autoGain === true,
      videoSound: saved.videoSound !== false,
    };
  } catch {
    return { deviceId: '', noiseSuppression: true, autoGain: false, videoSound: true };
  }
}

/** True when the slide has something that can be opened or played while it is read in. */
function canInteract(scene: Scene, project: { assets: Record<string, unknown> }): boolean {
  return scene.elements.some(
    (element) =>
      moreOf(element) !== undefined ||
      (element.type === 'video' &&
        element.source.kind === 'asset' &&
        project.assets[element.source.asset] !== undefined),
  );
}

/** A slide drawn as large as the space allows. */
function FittedScene({
  scene,
  steps,
  live,
  inner,
  onPress,
}: {
  scene: Scene;
  steps: number;
  /** True while what is pressed on the slide is remembered. */
  live: boolean;
  inner: React.RefObject<HTMLDivElement | null>;
  onPress: (target: HTMLElement) => void;
}) {
  const project = useStore((s) => s.project)!;
  const logo = useStore((s) => s.logo);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = (): void =>
      setScale(Math.max(0.05, Math.min(el.clientWidth / 1920, el.clientHeight / 1080)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="recorder-stage" ref={box}>
      {scale > 0 && (
        <div className="recorder-stage-box" style={{ width: 1920 * scale, height: 1080 * scale }}>
          <div
            className={`recorder-stage-inner${live ? ' is-live' : ''}`}
            style={{ transform: `scale(${scale})` }}
            ref={inner}
            onClick={(event) => onPress(event.target as HTMLElement)}
          >
            <SceneView scene={scene} project={project} logo={logo} previewSteps={steps} />
          </div>
        </div>
      )}
    </div>
  );
}

export function Recorder({ keepBefore }: { keepBefore?: number }) {
  const project = useStore((s) => s.project)!;
  const startId = useRef(useStore.getState().sceneId).current;
  const startIndex = Math.max(
    0,
    project.scenes.findIndex((s) => s.id === startId),
  );
  const [index, setIndex] = useState(startIndex);
  const scene = project.scenes[index] ?? project.scenes[0]!;
  const firstSteps =
    keepBefore !== undefined ? stepsShownAt(project.scenes[startIndex]!, keepBefore) : 0;
  const [stepsShown, setStepsShown] = useState(firstSteps);
  const [phase, setPhase] = useState<Phase>('setup');
  const [count, setCount] = useState(3);
  const [settings, setSettings] = useState<MicSettings>(readSettings);
  const [microphones, setMicrophones] = useState<MicrophoneChoice[]>([]);
  const [micError, setMicError] = useState<string | null>(null);
  const [micLabel, setMicLabel] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [recorded, setRecorded] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const box = useRef<SlidePopover | null>(null);

  // What the sound thread fills, kept outside React's state.
  const live = useRef({
    capture: null as Capture | null,
    keeping: false,
    blocks: [] as Float32Array[],
    samples: 0,
    stepAts: [] as Array<number | undefined>,
    /** What was opened and played on the slide that is being read. */
    events: [] as SceneEvent[],
    peak: 0,
    saves: [] as Array<Promise<boolean>>,
    index: startIndex,
    stepsShown: firstSteps,
  });

  // The microphone is open while the window is, so the level can be seen before recording.
  useEffect(() => {
    let alive = true;
    let opened: Capture | null = null;
    setMicError(null);
    void openMicrophone(settings)
      .then(async (capture) => {
        if (!alive) {
          capture.stop();
          return;
        }
        opened = capture;
        live.current.capture = capture;
        setMicLabel(capture.label);
        capture.onSamples = (block) => {
          const state = live.current;
          state.peak = Math.max(state.peak, blockPeak(block));
          if (state.keeping) {
            state.blocks.push(block);
            state.samples += block.length;
          }
        };
        setMicrophones(await listMicrophones());
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setMicError(error instanceof MicrophoneError ? error.message : String(error));
        void listMicrophones().then((list) => alive && setMicrophones(list));
      });
    return () => {
      alive = false;
      opened?.stop();
      live.current.capture = null;
    };
    // Only what concerns the microphone: the choice about video sound must not open it anew.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.deviceId, settings.noiseSuppression, settings.autoGain]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // The choice is then simply not remembered.
    }
  }, [settings]);

  // The level meter and the clock.
  useEffect(() => {
    let frame = 0;
    const tick = (): void => {
      const state = live.current;
      if (meter.current) {
        // Roughly how loud it sounds: the peak on a decibel scale from -48 to 0.
        const db = state.peak > 0 ? 20 * Math.log10(state.peak) : -100;
        meter.current.style.width = `${Math.max(0, Math.min(100, ((db + 48) / 48) * 100))}%`;
        meter.current.dataset.hot = db > -3 ? 'true' : 'false';
      }
      state.peak *= 0.86;
      setSeconds(state.samples / SAMPLE_RATE);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    root.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);

  // 3, 2, 1, and then the samples are kept.
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count <= 0) {
      live.current.keeping = true;
      setPhase('recording');
      return;
    }
    const timer = window.setTimeout(() => setCount((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, count]);

  // ---------- "Lær mer" and video on the slide ----------
  const now = (): number => live.current.samples / SAMPLE_RATE;

  /** Every video on the slide and in the open box that is a file in the project. */
  const videos = (): HTMLVideoElement[] =>
    Array.from(stage.current?.querySelectorAll<HTMLVideoElement>('video:not(.ls-closing)') ?? []);

  /** Which video of the slide a video node is: its element, and its block when it is in a box. */
  const whichVideo = (video: HTMLVideoElement): { element: string; block?: string } | null => {
    const inBox = video.closest<HTMLElement>('.ls-pop');
    if (inBox) {
      const block = video.closest<HTMLElement>('[data-block]')?.dataset.block;
      const element = inBox.dataset.popFor;
      return element && block ? { element, block } : null;
    }
    const element = video.closest<HTMLElement>('[data-el]')?.dataset.el;
    return element ? { element } : null;
  };

  const showPlaying = (video: HTMLVideoElement, playing: boolean): void => {
    video.closest('.ls-video')?.classList.toggle('is-playing', playing);
  };

  const stopVideo = (video: HTMLVideoElement, remember: boolean): void => {
    if (video.paused || video.ended) {
      showPlaying(video, false);
      return;
    }
    video.pause();
    showPlaying(video, false);
    const which = whichVideo(video);
    if (remember && which && live.current.keeping) {
      live.current.events.push({ id: newId('h'), at: now(), kind: 'video-pause', ...which });
    }
  };

  const toggleVideo = (video: HTMLVideoElement): void => {
    const which = whichVideo(video);
    if (!which || !live.current.keeping) return;
    if (!video.paused && !video.ended) {
      stopVideo(video, true);
      return;
    }
    if (!Number.isFinite(video.duration) || !(video.duration > 0)) return;
    if (video.ended || video.currentTime >= video.duration - 0.05) video.currentTime = 0;
    video.muted = !settings.videoSound;
    video.onended = () => showPlaying(video, false);
    live.current.events.push({
      id: newId('h'),
      at: now(),
      kind: 'video-play',
      ...which,
      from: video.currentTime,
      duration: video.duration,
    });
    showPlaying(video, true);
    void video.play().catch(() => showPlaying(video, false));
  };

  /** Puts the open box away. With `remember`, the video and "Spill av" do the same at this time. */
  const closeBox = (remember: boolean): void => {
    const open = box.current;
    if (!open) return;
    for (const video of Array.from(open.layer.querySelectorAll('video'))) video.pause();
    open.layer.remove();
    box.current = null;
    if (remember && live.current.keeping) {
      live.current.events.push({ id: newId('h'), at: now(), kind: 'more-close' });
    }
  };

  const openBox = (elementId: string, remember: boolean): void => {
    const state = useStore.getState();
    const current = state.project?.scenes[live.current.index];
    const element = current?.elements.find((e) => e.id === elementId);
    if (!state.project || !element || !stage.current) return;
    const made = createPopover(renderContext(state.project, state.logo), element, {
      closeLabel: 'Lukk',
    });
    if (!made) return;
    closeBox(false);
    stage.current.appendChild(made.layer);
    made.place();
    // A picture in the box can change its height when it has been fetched.
    for (const img of Array.from(made.layer.querySelectorAll('img'))) {
      img.addEventListener('load', () => made.place(), { once: true });
    }
    for (const video of Array.from(made.layer.querySelectorAll('video'))) {
      video.addEventListener('loadedmetadata', () => made.place(), { once: true });
    }
    made.panel.classList.add('ls-pop-in');
    box.current = made;
    if (remember && live.current.keeping) {
      live.current.events.push({
        id: newId('h'),
        at: now(),
        kind: 'more-open',
        element: elementId,
      });
    }
  };

  /** Stops what plays and puts the box away, when the slide is left or read again. */
  const clearSlide = useCallback((): void => {
    for (const video of videos()) {
      video.pause();
      showPlaying(video, false);
    }
    box.current?.layer.remove();
    box.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A press on the slide while it is read in: open or close a box, start or stop a video. */
  const onPress = (target: HTMLElement): void => {
    if (!live.current.keeping) return;
    if (target.closest('.ls-pop-close')) {
      closeBox(true);
      return;
    }
    const video = target.closest('video');
    if (video && !video.classList.contains('ls-closing')) {
      toggleVideo(video);
      return;
    }
    const figure = target.closest<HTMLElement>('.ls-video');
    const inFigure = figure?.querySelector<HTMLVideoElement>('video');
    if (inFigure) {
      toggleVideo(inFigure);
      return;
    }
    if (target.closest('.ls-pop')) return;
    const elementId = target.closest<HTMLElement>('[data-el]')?.dataset.el;
    const current = useStore.getState().project?.scenes[live.current.index];
    const element = current?.elements.find((e) => e.id === elementId);
    if (element && moreOf(element)) {
      if (box.current?.element === element.id) closeBox(true);
      else openBox(element.id, true);
    } else if (box.current) {
      // A press on the slide beside the box puts the box away, as in the player.
      closeBox(true);
    }
  };

  /**
   * When the reading goes on from a point in the slide's sound: the box that
   * was open there is open, and every film stands where it had come to.
   */
  const restoreKept = (): void => {
    if (keepBefore === undefined) return;
    const first = useStore.getState().project?.scenes[startIndex];
    if (!first) return;
    const open = moreAt(first, keepBefore);
    if (open) openBox(open.element, false);
    const states = videosAt(first, keepBefore);
    for (const video of videos()) {
      const which = whichVideo(video);
      const state = which && states.get(videoKey(which.element, which.block));
      if (state) video.currentTime = state.time;
    }
  };

  const begin = (): void => {
    if (live.current.index === startIndex) restoreKept();
    setCount(3);
    setPhase('countdown');
    root.current?.focus();
  };

  /** Stores what was read for the slide that is being left, in the background. */
  const finishSlide = useCallback((): void => {
    const state = live.current;
    const samples = joinBlocks(state.blocks);
    const sceneId = useStore.getState().project?.scenes[state.index]?.id;
    const keep = state.index === startIndex ? keepBefore : undefined;
    const stepAts = state.stepAts.slice();
    const events = state.events.slice();
    state.blocks = [];
    state.samples = 0;
    state.stepAts = [];
    state.events = [];
    clearSlide();
    if (!sceneId || samples.length < SAMPLE_RATE * MIN_RECORDING_SECONDS) return;
    state.saves.push(saveRecording(sceneId, samples, stepAts, keep, events));
    setRecorded((n) => n + 1);
  }, [keepBefore, startIndex, clearSlide]);

  /** The right arrow: the next step, or the next slide. */
  const advance = useCallback((): void => {
    const state = live.current;
    if (!state.keeping) return;
    const scenes = useStore.getState().project?.scenes ?? [];
    const current = scenes[state.index];
    if (!current) return;
    if (state.stepsShown < current.timeline.length) {
      state.stepAts[state.stepsShown] = state.samples / SAMPLE_RATE;
      state.stepsShown += 1;
      setStepsShown(state.stepsShown);
    } else if (state.index < scenes.length - 1) {
      finishSlide();
      state.index += 1;
      state.stepsShown = 0;
      setIndex(state.index);
      setStepsShown(0);
    }
  }, [finishSlide]);

  const retake = (): void => {
    const state = live.current;
    state.keeping = false;
    state.blocks = [];
    state.samples = 0;
    state.stepAts = [];
    state.events = [];
    clearSlide();
    for (const video of videos()) video.currentTime = 0;
    state.stepsShown = state.index === startIndex ? firstSteps : 0;
    setStepsShown(state.stepsShown);
    begin();
  };

  const togglePause = (): void => {
    const state = live.current;
    if (phase === 'recording') {
      // A film that plays stops with the reading; it is started again by hand.
      for (const video of videos()) stopVideo(video, true);
      state.keeping = false;
      setPhase('paused');
    } else if (phase === 'paused') {
      state.keeping = true;
      setPhase('recording');
    }
  };

  const close = async (keepCurrent: boolean): Promise<void> => {
    const state = live.current;
    state.keeping = false;
    if (keepCurrent) finishSlide();
    else clearSlide();
    setPhase('saving');
    const results = await Promise.all(state.saves);
    const saved = results.filter(Boolean).length;
    const store = useStore.getState();
    const last = store.project?.scenes[state.index];
    if (last && saved > 0) {
      store.setScene(last.id);
      store.setBottomTab('sound');
      store.setNotice({
        kind: 'info',
        text:
          saved === 1
            ? 'Opptaket er lagt på lysarket. Husk å lagre prosjektet.'
            : `Opptaket er lagt på ${saved} lysark. Husk å lagre prosjektet.`,
      });
    }
    store.openRecorder(null);
  };

  const cancel = (): void => {
    const unsaved = live.current.samples > SAMPLE_RATE * MIN_RECORDING_SECONDS;
    if (
      unsaved &&
      !window.confirm('Avbryte? Det som er lest inn på dette lysarket, blir ikke tatt vare på.')
    ) {
      return;
    }
    void close(false);
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const tag = (event.target as HTMLElement).tagName;
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
      return;
    }
    if (tag === 'SELECT' || tag === 'INPUT') return;
    const forward = ['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key);
    if (forward && (phase === 'recording' || phase === 'paused')) {
      // A button that has the focus must not also be pressed by the space bar.
      event.preventDefault();
      if (phase === 'recording') advance();
    }
  };

  const total = project.scenes.length;
  const lastSlide = index >= total - 1;
  const stepsLeft = scene.timeline.length - stepsShown;
  const lines = scene.script.split(/\n+/).filter((line) => line.trim() !== '');
  const next = project.scenes[index + 1];
  const active = phase === 'recording' || phase === 'paused' || phase === 'countdown';

  return (
    <div
      className="recorder"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recorder-title"
      ref={root}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <header className="recorder-head">
        <h2 id="recorder-title">Les inn stemme</h2>
        <span className="recorder-where">
          Lysark {index + 1} av {total}
          {scene.title.trim() ? `: ${scene.title.trim()}` : ''}
        </span>
        <span className="gap" />
        <span className={`recorder-clock${phase === 'recording' ? ' is-on' : ''}`} aria-live="off">
          {phase === 'recording' ? 'Tar opp ' : phase === 'paused' ? 'Pause ' : ''}
          {formatTime(seconds)}
        </span>
      </header>

      <div className="recorder-body">
        <div className="recorder-left">
          <FittedScene
            scene={scene}
            steps={stepsShown}
            live={phase === 'recording'}
            inner={stage}
            onPress={onPress}
          />
          {phase === 'countdown' && (
            <div className="recorder-count" role="status" aria-live="assertive">
              {count > 0 && (
                <span key={count} className="recorder-count-number">
                  {count}
                </span>
              )}
            </div>
          )}
        </div>
        <aside className="recorder-side">
          <h3>Manus</h3>
          <div className="recorder-script">
            {lines.length === 0 ? (
              <p className="hint">Lysarket har ikke manus.</p>
            ) : (
              lines.map((line, i) => <p key={i}>{line}</p>)
            )}
          </div>
          <p className="recorder-next">
            {stepsLeft > 0
              ? `Pil høyre: neste steg (${stepsLeft} igjen på lysarket).`
              : lastSlide
                ? 'Dette er siste lysark. Trykk «Ferdig» når du er ferdig.'
                : `Pil høyre: neste lysark${next?.title.trim() ? ` («${next.title.trim()}»)` : ''}.`}
          </p>
          {canInteract(scene, project) && (
            <p className="recorder-press">
              Mens du leser inn, kan du trykke på lysarket: «+» åpner «Lær mer», og en video spilles
              når du trykker på den. Det kommer med i videoen på samme tidspunkt.
            </p>
          )}
        </aside>
      </div>

      <footer className="recorder-foot">
        <div className="recorder-mic">
          <label>
            <span className="field-label">Mikrofon</span>
            <select
              value={settings.deviceId}
              disabled={active}
              onChange={(e) => setSettings({ ...settings, deviceId: e.target.value })}
            >
              <option value="">Systemets valg</option>
              {microphones
                .filter((m) => m.deviceId && m.deviceId !== 'default')
                .map((m) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label}
                  </option>
                ))}
            </select>
          </label>
          <div
            className="recorder-meter"
            role="img"
            aria-label={
              micError ? 'Ingen lyd fra mikrofonen' : `Lydnivå fra ${micLabel || 'mikrofonen'}`
            }
          >
            <span ref={meter} />
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.noiseSuppression}
              disabled={active}
              onChange={(e) => setSettings({ ...settings, noiseSuppression: e.target.checked })}
            />
            Støydemping
          </label>
          <label
            className="check"
            title="Lar systemet endre styrken underveis. Av er best for tale."
          >
            <input
              type="checkbox"
              checked={settings.autoGain}
              disabled={active}
              onChange={(e) => setSettings({ ...settings, autoGain: e.target.checked })}
            />
            Automatisk styrke
          </label>
          <label
            className="check"
            title="Lyden fra en video du spiller mens du leser inn. Bruk hodetelefoner, ellers tar mikrofonen den opp en gang til."
          >
            <input
              type="checkbox"
              checked={settings.videoSound}
              onChange={(e) => {
                setSettings({ ...settings, videoSound: e.target.checked });
                for (const video of videos()) video.muted = !e.target.checked;
              }}
            />
            Lyd fra video
          </label>
        </div>

        <div className="recorder-actions">
          {phase === 'setup' && (
            <>
              <button type="button" onClick={cancel}>
                Avbryt
              </button>
              <button
                type="button"
                className="strong big"
                data-autofocus
                disabled={!!micError}
                onClick={begin}
              >
                {keepBefore !== undefined ? 'Start opptak herfra' : 'Start opptak'}
              </button>
            </>
          )}
          {active && (
            <>
              <button type="button" onClick={cancel}>
                Avbryt
              </button>
              <button type="button" disabled={phase === 'countdown'} onClick={retake}>
                Ta om dette lysarket
              </button>
              <button type="button" disabled={phase === 'countdown'} onClick={togglePause}>
                {phase === 'paused' ? 'Fortsett' : 'Pause'}
              </button>
              <button
                type="button"
                disabled={phase !== 'recording' || (stepsLeft <= 0 && lastSlide)}
                onClick={advance}
              >
                {stepsLeft > 0 ? 'Neste steg →' : 'Neste lysark →'}
              </button>
              <button
                type="button"
                className="strong big"
                disabled={phase === 'countdown'}
                onClick={() => void close(true)}
              >
                Ferdig
              </button>
            </>
          )}
          {phase === 'saving' && <span role="status">Lagrer opptaket …</span>}
        </div>
      </footer>

      {micError ? (
        <p className="recorder-note recorder-error" role="alert">
          {micError}
        </p>
      ) : (
        <p className="recorder-note">
          {phase === 'setup'
            ? keepBefore !== undefined
              ? `Lyden fram til ${formatTime(keepBefore)} beholdes. Det du leser inn nå, kommer etter. Si noe og se at nivået rører seg før du starter.`
              : 'Si noe og se at nivået rører seg før du starter. Lysark som har lyd fra før, får den nye i stedet; det kan angres.'
            : recorded > 0
              ? `${recorded} lysark er lest inn så langt.`
              : 'Opptaket deles automatisk når du går til neste lysark.'}
        </p>
      )}
    </div>
  );
}
