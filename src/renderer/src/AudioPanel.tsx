// The sound panel under the slide: the whole lecture as a strip of slides,
// and the current slide's sound as a track that can be played and edited.
// Every edit is one undo step; recordings themselves are never changed.
import { slideNumbers } from '../../shared/layout/slides';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  MIN_PAUSE,
  clipSpans,
  cutRange,
  insertPause,
  removeSound,
  setGain,
  setPauseDuration,
  setSilentSeconds,
  removeEvent,
  setEventTime,
  setStepTime,
} from '../../shared/audio/edit';
import { peaks, secondsToSamples } from '../../shared/audio/wav';
import { newId } from '../../shared/format/factory';
import { GAIN_DB, type Project, type Scene, type SceneEvent } from '../../shared/format/schema';
import {
  SILENT_SECONDS,
  formatTime,
  hasSound,
  ownsSeconds,
  schedule,
  sceneDuration,
  sceneEvents,
  stepTimes,
  stepsShownAt,
  trackDuration,
} from '../../shared/render/clock';
import { Icon } from './Icon';
import { SecondsInput } from './SecondsInput';
import { importSoundFile } from './actions';
import { loadSceneSamples, playScene, samplesOf, type Playback } from './audio/engine';
import { WAIT_FOR_SAVING, currentScene, useStore } from './store';

const clipId = (): string => newId('c');

/** "0:03,4": minutes, seconds and tenths, with a Norwegian decimal comma. */
function preciseTime(seconds: number): string {
  const tenths = Math.max(0, Math.round(seconds * 10));
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  return `${m}:${String(s).padStart(2, '0')},${tenths % 10}`;
}

function parseSeconds(text: string): number | undefined {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) ? value : undefined;
}

/** The lecture as a row of slides, each as wide as it is long. */
function LectureStrip({ project, sceneId }: { project: Project; sceneId: string }) {
  const setScene = useStore((s) => s.setScene);
  const plan = schedule(project.scenes);
  const numbers = slideNumbers(project.scenes);
  return (
    <div className="lecture-strip" role="group" aria-label="Hele forelesningen">
      <div className="lecture-blocks">
        {plan.entries.map((entry) => {
          const scene = project.scenes[entry.index]!;
          // A slide that is shown once more has the number of the slide it shows.
          const number = numbers[entry.index]!;
          const label = scene.repeat ? `Lysark ${number} igjen` : `Lysark ${number}`;
          const name = scene.title.trim() || `Lysark ${number}`;
          return (
            <button
              key={scene.id}
              type="button"
              className={`lecture-block${hasSound(scene) ? ' has-sound' : ''}`}
              style={{ flexGrow: Math.max(0.2, entry.duration) }}
              aria-current={scene.id === sceneId ? 'true' : undefined}
              aria-label={`${label}: ${name}, ${formatTime(entry.duration)}${hasSound(scene) ? '' : ', uten lyd'}`}
              title={`${label}: ${name} – ${formatTime(entry.duration)}${hasSound(scene) ? '' : ' (uten lyd)'}`}
              onClick={() => setScene(scene.id)}
            >
              {scene.repeat ? '↩' : number}
            </button>
          );
        })}
      </div>
      <span className="lecture-total">Hele forelesningen: {formatTime(plan.total)}</span>
    </div>
  );
}

interface TrackProps {
  project: Project;
  scene: Scene;
  playhead: number;
  range: [number, number] | null;
  selectedPause: string | null;
  /** Bumped when recordings have been read, so the waveform is drawn. */
  loaded: number;
  onSeek: (t: number) => void;
  onRange: (range: [number, number] | null) => void;
  onSelectPause: (id: string | null) => void;
  onKey: (event: React.KeyboardEvent) => void;
}

/** The slide's sound: waveform, pauses, steps, the marked stretch and the playhead. */
/** What the marks for things opened and played while reading say. */
const EVENT_TEXT: Record<SceneEvent['kind'], { label: string; mark: string }> = {
  'more-open': { label: '«Lær mer» åpnes', mark: '+' },
  'more-close': { label: '«Lær mer» lukkes', mark: '×' },
  'video-play': { label: 'Video starter', mark: '▶' },
  'video-pause': { label: 'Video stopper', mark: 'Ⅱ' },
  'camera-move': { label: 'Kamerasirkelen flyttes', mark: '○' },
};

function Track(props: TrackProps) {
  const { project, scene, playhead, range } = props;
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const duration = sceneDuration(scene);
  const spans = clipSpans(scene);
  const times = stepTimes(scene);
  const updateScene = useStore((s) => s.updateScene);
  const percent = (t: number): string =>
    `${(Math.max(0, Math.min(duration, t)) / duration) * 100}%`;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = (): void => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The waveform.
  useEffect(() => {
    const el = canvas.current;
    if (!el || width <= 0) return;
    const ratio = window.devicePixelRatio || 1;
    const height = el.clientHeight;
    el.width = Math.round(width * ratio);
    el.height = Math.round(height * ratio);
    const g = el.getContext('2d');
    if (!g) return;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, width, height);
    const read = samplesOf(project);
    const middle = height / 2;
    g.fillStyle = '#7800f0';
    for (const { clip, start, end } of spans) {
      if (clip.kind !== 'sound') continue;
      const x0 = (start / duration) * width;
      const w = Math.max(1, ((end - start) / duration) * width);
      const source = read(clip.asset);
      if (!source) {
        g.fillRect(x0, middle - 1, w, 2);
        continue;
      }
      const part = source.subarray(secondsToSamples(clip.from), secondsToSamples(clip.to));
      const columns = Math.max(1, Math.floor(w));
      const levels = peaks(part, columns);
      for (let i = 0; i < columns; i++) {
        const h = Math.max(1, levels[i]! * (height - 8));
        g.fillRect(x0 + i, middle - h / 2, 1, h);
      }
    }
    // `spans` is derived from scene.audio, which is what matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, scene.audio, duration, props.loaded, project.assets]);

  const timeAt = (clientX: number): number => {
    const rect = box.current!.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration));
  };

  const drag = useRef<{ from: number; x: number; moved: boolean } | null>(null);
  const onPointerDown = (event: React.PointerEvent): void => {
    if (event.button !== 0) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { from: timeAt(event.clientX), x: event.clientX, moved: false };
    props.onSelectPause(null);
  };
  const onPointerMove = (event: React.PointerEvent): void => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.abs(event.clientX - d.x) < 4) return;
    d.moved = true;
    const to = timeAt(event.clientX);
    props.onRange([Math.min(d.from, to), Math.max(d.from, to)]);
  };
  const onPointerUp = (event: React.PointerEvent): void => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      props.onRange(null);
      props.onSeek(timeAt(event.clientX));
    }
  };

  // Dragging a step mark changes when the step happens.
  const stepDrag = useRef<string | null>(null);
  const moveStep = (stepId: string, t: number): void =>
    updateScene((s) => setStepTime(s, stepId, t), `step-time-${stepId}`);
  // The same for what was opened and played while the slide was read in.
  const moveEvent = (eventId: string, t: number): void =>
    updateScene((s) => setEventTime(s, eventId, t), `event-time-${eventId}`);
  const events = sceneEvents(scene);

  return (
    <div className="track-wrap">
      <div
        ref={box}
        className="track"
        role="slider"
        tabIndex={0}
        aria-label="Lyden på lysarket. Piltaster flytter spillehodet, mellomrom spiller av."
        aria-valuemin={0}
        aria-valuemax={Math.round(duration * 10) / 10}
        aria-valuenow={Math.round(playhead * 10) / 10}
        aria-valuetext={`${preciseTime(playhead)} av ${preciseTime(duration)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={props.onKey}
      >
        <canvas ref={canvas} className="track-wave" aria-hidden="true" />
        {spans.map(({ clip, start, end }) =>
          clip.kind === 'pause' ? (
            <button
              key={clip.id}
              type="button"
              className="track-pause"
              style={{ left: percent(start), width: `${((end - start) / duration) * 100}%` }}
              aria-pressed={props.selectedPause === clip.id}
              aria-label={`Pause på ${preciseTime(clip.duration)} sekunder`}
              title={`Pause, ${preciseTime(clip.duration)}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => props.onSelectPause(props.selectedPause === clip.id ? null : clip.id)}
            >
              <span>pause</span>
            </button>
          ) : (
            <span
              key={clip.id}
              className="track-clip"
              style={{ left: percent(start), width: `${((end - start) / duration) * 100}%` }}
            />
          ),
        )}
        {range && (
          <span
            className="track-range"
            style={{
              left: percent(range[0]),
              width: `${((range[1] - range[0]) / duration) * 100}%`,
            }}
          />
        )}
        {scene.timeline.map((step, i) =>
          // On a slide that is shown once more, the steps that were there from before have no time to move.
          scene.repeat?.shown.includes(step.id) ? null : (
            <button
              key={step.id}
              type="button"
              className={`track-step${step.at === undefined ? ' is-auto' : ''}`}
              style={{ left: percent(times[i]!) }}
              aria-label={`Steg ${i + 1} ved ${preciseTime(times[i]!)}. Piltaster flytter det.`}
              title={`Steg ${i + 1} ved ${preciseTime(times[i]!)}${step.at === undefined ? ' (fordelt jevnt)' : ''}. Dra for å flytte.`}
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                stepDrag.current = step.id;
              }}
              onPointerMove={(e) => {
                if (stepDrag.current === step.id) moveStep(step.id, timeAt(e.clientX));
              }}
              onPointerUp={() => {
                stepDrag.current = null;
              }}
              onKeyDown={(e) => {
                const delta = e.key === 'ArrowLeft' ? -0.1 : e.key === 'ArrowRight' ? 0.1 : 0;
                if (!delta) return;
                e.preventDefault();
                e.stopPropagation();
                moveStep(step.id, times[i]! + delta * (e.shiftKey ? 10 : 1));
              }}
            >
              {i + 1}
            </button>
          ),
        )}
        {events.map((event) => {
          const what = EVENT_TEXT[event.kind];
          return (
            <button
              key={event.id}
              type="button"
              className={`track-event is-${event.kind}`}
              style={{ left: percent(event.at) }}
              aria-label={`${what.label} ved ${preciseTime(event.at)}. Piltaster flytter, Delete fjerner.`}
              title={`${what.label} ved ${preciseTime(event.at)}. Dra for å flytte, Delete fjerner.`}
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                stepDrag.current = event.id;
              }}
              onPointerMove={(e) => {
                if (stepDrag.current === event.id) moveEvent(event.id, timeAt(e.clientX));
              }}
              onPointerUp={() => {
                stepDrag.current = null;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                  e.preventDefault();
                  e.stopPropagation();
                  updateScene((s) => removeEvent(s, event.id));
                  return;
                }
                const delta = e.key === 'ArrowLeft' ? -0.1 : e.key === 'ArrowRight' ? 0.1 : 0;
                if (!delta) return;
                e.preventDefault();
                e.stopPropagation();
                moveEvent(event.id, event.at + delta * (e.shiftKey ? 10 : 1));
              }}
            >
              <span aria-hidden="true">{what.mark}</span>
            </button>
          );
        })}
        <span className="track-playhead" style={{ left: percent(playhead) }} />
      </div>
      <div className="track-scale" aria-hidden="true">
        <span>0:00</span>
        <span>{preciseTime(duration)}</span>
      </div>
    </div>
  );
}

export function AudioPanel() {
  const project = useStore((s) => s.project)!;
  const saving = useStore((s) => s.savingRecording);
  const scene = useStore(currentScene);
  const updateScene = useStore((s) => s.updateScene);
  const setScene = useStore((s) => s.setScene);
  const [playhead, setPlayhead] = useState(0);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [selectedPause, setSelectedPause] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [goOn, setGoOn] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [pauseText, setPauseText] = useState('1');
  const playback = useRef<Playback | null>(null);
  const frame = useRef(0);
  const sceneId = scene?.id;

  const stop = useCallback((): void => {
    cancelAnimationFrame(frame.current);
    playback.current?.stop();
    playback.current = null;
    setPlaying(false);
    useStore.getState().setPreviewSteps(null);
  }, []);

  // A new slide starts from its beginning, with nothing marked.
  useEffect(() => {
    setPlayhead(0);
    setRange(null);
    setSelectedPause(null);
  }, [sceneId]);

  // Stop when the panel goes away.
  useEffect(() => stop, [stop]);

  // The camera circle on the stage shows the moment the playhead stands at.
  useEffect(() => {
    useStore.getState().setSoundAt({ t: playhead, playing });
  }, [playhead, playing]);
  useEffect(() => () => useStore.getState().setSoundAt(null), []);

  // Read the recordings of the slide so that they can be drawn.
  useEffect(() => {
    if (!scene) return;
    let alive = true;
    void loadSceneSamples(project, scene).then(() => {
      if (alive) setLoaded((n) => n + 1);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.audio, project.assets]);

  const play = useCallback(
    async (from: number, fromScene?: string): Promise<void> => {
      const state = useStore.getState();
      const current = fromScene
        ? state.project?.scenes.find((s) => s.id === fromScene)
        : currentScene(state);
      if (!state.project || !current) return;
      await loadSceneSamples(state.project, current);
      const duration = sceneDuration(current);
      const start = from >= duration - 0.05 ? 0 : from;
      const running = await playScene(state.project, current, hasSound(current) ? start : 0);
      playback.current = running;
      setPlaying(true);
      // A slide without sound has nothing to play; the playhead still runs its length.
      const silentFrom = performance.now() - start * 1000;
      const position = (): number =>
        hasSound(current)
          ? running.position()
          : Math.min(duration, (performance.now() - silentFrom) / 1000);
      const tick = (): void => {
        if (playback.current !== running) return;
        const t = position();
        setPlayhead(t);
        useStore.getState().setPreviewSteps(stepsShownAt(current, t));
        if (!hasSound(current) && t >= duration) {
          finish(true);
          return;
        }
        frame.current = requestAnimationFrame(tick);
      };
      const finish = (toEnd: boolean): void => {
        if (playback.current !== running) return;
        cancelAnimationFrame(frame.current);
        running.stop();
        playback.current = null;
        const latest = useStore.getState();
        const scenes = latest.project?.scenes ?? [];
        const next = scenes[scenes.findIndex((s) => s.id === current.id) + 1];
        if (toEnd && goOnRef.current && next) {
          setScene(next.id);
          setPlayhead(0);
          void play(0, next.id);
          return;
        }
        setPlaying(false);
        latest.setPreviewSteps(null);
        if (toEnd) setPlayhead(duration);
      };
      if (hasSound(current)) void running.ended.then(finish);
      frame.current = requestAnimationFrame(tick);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setScene],
  );
  const goOnRef = useRef(goOn);
  goOnRef.current = goOn;

  if (!scene) return null;
  const duration = sceneDuration(scene);
  const track = trackDuration(scene.audio);
  const sound = hasSound(scene);
  const repeat = scene.repeat !== undefined;
  const spans = clipSpans(scene);
  const pause = spans.find((s) => s.clip.id === selectedPause && s.clip.kind === 'pause');
  const gain = scene.audio?.gain ?? 0;
  const edit = (recipe: (s: Scene) => void, key?: string): void => {
    stop();
    updateScene(recipe, key);
  };

  const cutMarked = (): void => {
    if (!range) return;
    edit((s) => cutRange(s, range[0], range[1], clipId));
    setPlayhead(range[0]);
    setRange(null);
  };
  const cutBefore = (): void => {
    edit((s) => cutRange(s, 0, playhead, clipId));
    setPlayhead(0);
    setRange(null);
  };
  const cutAfter = (): void => {
    edit((s) => cutRange(s, playhead, trackDuration(s.audio), clipId));
    setRange(null);
  };
  const addPause = (): void => {
    const seconds = parseSeconds(pauseText);
    if (seconds === undefined || seconds < MIN_PAUSE) return;
    edit((s) => insertPause(s, track > 0 ? playhead : 0, Math.min(600, seconds), clipId));
    setRange(null);
  };

  const onKey = (event: React.KeyboardEvent): void => {
    const step = event.shiftKey ? 1 : 0.1;
    let handled = true;
    if (event.key === 'ArrowLeft') setPlayhead((t) => Math.max(0, t - step));
    else if (event.key === 'ArrowRight') setPlayhead((t) => Math.min(duration, t + step));
    else if (event.key === 'Home') setPlayhead(0);
    else if (event.key === 'End') setPlayhead(duration);
    else if (event.key === ' ') {
      if (playing) stop();
      else void play(playhead);
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && range) cutMarked();
    else if (event.key === 'Escape' && range) setRange(null);
    else handled = false;
    if (handled) {
      if (event.key !== ' ' && playing) stop();
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <div className="audio-panel">
      <LectureStrip project={project} sceneId={scene.id} />
      <div className="audio-bar" role="toolbar" aria-label="Lyd">
        {playing ? (
          <button type="button" className="strong with-icon" onClick={stop}>
            <Icon name="stop" />
            Stopp
          </button>
        ) : (
          <button type="button" className="strong with-icon" onClick={() => void play(playhead)}>
            <Icon name="play" />
            Spill av
          </button>
        )}
        <span className="audio-time" aria-live="off">
          {preciseTime(playhead)} / {preciseTime(duration)}
        </span>
        <label className="check audio-goon">
          <input type="checkbox" checked={goOn} onChange={(e) => setGoOn(e.target.checked)} />
          Fortsett på neste lysark
        </label>
        <span className="gap" />
        <button
          type="button"
          className="with-icon"
          disabled={repeat}
          aria-disabled={saving || undefined}
          onClick={() => {
            stop();
            useStore.getState().openRecorder({});
          }}
          title={
            repeat
              ? 'Her vises et lysark igjen. Gå til lysarket selv for å lese inn fra det.'
              : saving
                ? WAIT_FOR_SAVING
                : 'Les inn stemmen, fra dette lysarket og utover (Ctrl+R)'
          }
        >
          <Icon name="mic" />
          Les inn
        </button>
        {sound && !repeat && playhead > 0.05 && playhead < track - 0.05 && (
          <button
            type="button"
            className="with-icon"
            onClick={() => {
              stop();
              useStore.getState().openRecorder({ keepBefore: playhead });
            }}
            aria-disabled={saving || undefined}
            title={
              saving
                ? WAIT_FOR_SAVING
                : 'Behold lyden fram til spillehodet, og les inn resten på nytt'
            }
          >
            <Icon name="mic" />
            Ta om herfra
          </button>
        )}
        <button type="button" className="with-icon" onClick={() => void importSoundFile()}>
          <Icon name="import" />
          Importer lydfil
        </button>
      </div>

      <Track
        project={project}
        scene={scene}
        playhead={Math.min(playhead, duration)}
        range={range}
        selectedPause={selectedPause}
        loaded={loaded}
        onSeek={(t) => {
          if (playing) stop();
          setPlayhead(t);
        }}
        onRange={setRange}
        onSelectPause={setSelectedPause}
        onKey={onKey}
      />

      {!sound && ownsSeconds(scene) ? (
        <p className="audio-hint audio-silent">
          <label>
            Lysarket har ingen lyd. Det står i{' '}
            <SecondsInput
              key={scene.id}
              className="audio-number"
              label="Hvor mange sekunder lysarket står"
              min={SILENT_SECONDS.min}
              max={SILENT_SECONDS.max}
              value={duration}
              onChange={(seconds) => edit((s) => setSilentSeconds(s, seconds))}
            />{' '}
            sekunder.
          </label>{' '}
          <button
            type="button"
            title="Gir alle lysark som ikke har lyd, denne tiden. Kan angres."
            onClick={() => {
              stop();
              useStore.getState().update((draft) => {
                for (const each of draft.scenes) setSilentSeconds(each, duration);
              });
            }}
          >
            Bruk på alle lysark uten lyd
          </button>
        </p>
      ) : (
        track === 0 && (
          <p className="hint audio-hint">
            Lysarket har ingen lyd. I video og «Spill av» står det i {formatTime(duration)}.
          </p>
        )
      )}

      <div className="audio-tools">
        <button type="button" disabled={!range} onClick={cutMarked} title="Delete">
          Klipp bort det merkede
        </button>
        <button
          type="button"
          disabled={track === 0 || playhead < 0.05}
          onClick={cutBefore}
          title="Tar bort alt før spillehodet"
        >
          Klipp bort starten
        </button>
        <button
          type="button"
          disabled={track === 0 || playhead > track - 0.05}
          onClick={cutAfter}
          title="Tar bort alt etter spillehodet"
        >
          Klipp bort slutten
        </button>
        <span className="audio-group">
          <label>
            <span>Pause ved spillehodet</span>
            <input
              type="text"
              inputMode="decimal"
              className="audio-number"
              value={pauseText}
              aria-label="Pausens lengde i sekunder"
              onChange={(e) => setPauseText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addPause();
              }}
            />
            <span>s</span>
          </label>
          <button
            type="button"
            disabled={(parseSeconds(pauseText) ?? 0) < MIN_PAUSE}
            onClick={addPause}
          >
            Sett inn pause
          </button>
        </span>
        {pause && pause.clip.kind === 'pause' && (
          <span className="audio-group">
            <label>
              <span>Valgt pause</span>
              <input
                key={pause.clip.id}
                type="text"
                inputMode="decimal"
                className="audio-number"
                defaultValue={String(Math.round(pause.clip.duration * 10) / 10).replace('.', ',')}
                aria-label="Den valgte pausens lengde i sekunder"
                onBlur={(e) => {
                  const seconds = parseSeconds(e.target.value);
                  if (seconds !== undefined) {
                    edit((s) => setPauseDuration(s, pause.clip.id, Math.min(600, seconds)));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
              />
              <span>s</span>
            </label>
            <button
              type="button"
              onClick={() => {
                edit((s) => cutRange(s, pause.start, pause.end, clipId));
                setSelectedPause(null);
              }}
            >
              Fjern pausen
            </button>
          </span>
        )}
        {sound && (
          <label className="audio-group audio-gain">
            <span>Lydstyrke</span>
            <input
              type="range"
              min={GAIN_DB.min}
              max={GAIN_DB.max}
              step={1}
              value={gain}
              aria-label="Lydstyrke for lysarket, i desibel"
              onChange={(e) => edit((s) => setGain(s, Number(e.target.value)), `gain-${scene.id}`)}
            />
            <output>{gain > 0 ? `+${gain}` : gain} dB</output>
          </label>
        )}
        <span className="gap" />
        {track > 0 && (
          <button
            type="button"
            className="danger"
            onClick={() => {
              edit(removeSound);
              setPlayhead(0);
              setRange(null);
            }}
          >
            Fjern lyden
          </button>
        )}
      </div>
    </div>
  );
}
