// The timeline: the whole lecture at a glance. The slides stand in a row,
// each as wide as it is long, and under them lie the tracks: the voice of
// each slide, and the lecture's own music and other sound, which can run on
// under several slides. A clip of music or sound is put in at the playhead,
// dragged into place, drawn shorter at its ends, divided, faded and given
// its own loudness. Drawing the edge of a slide makes it stand longer or
// shorter, by the pause at its end. The voice itself is cut under "Lyd".
import { slideNumbers } from '../../shared/layout/slides';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  assetSeconds,
  findTrackClip,
  leastSceneLength,
  moveTrackClip,
  removeTrackClip,
  setSceneLength,
  setTrackClip,
  splitTrackClip,
  trimTrackClip,
} from '../../shared/audio/tracks';
import { peaks, renderTrack } from '../../shared/audio/wav';
import { newId } from '../../shared/format/factory';
import { GAIN_DB, type Project, type TrackName } from '../../shared/format/schema';
import {
  formatTime,
  hasSound,
  placeTracks,
  schedule,
  stepsShownAt,
  videoOptions,
  type PlacedClip,
  type Schedule,
} from '../../shared/render/clock';
import { addTrackSound } from './actions';
import {
  loadSamples,
  loadSceneSamples,
  playLecture,
  samplesOf,
  type LecturePlayback,
} from './audio/engine';
import { Icon } from './Icon';
import { CreditFields } from './MediaDialog';
import { useStore } from './store';
import './timeline.css';

const LABELS: Record<TrackName, string> = { music: 'Musikk', sound: 'Lyd' };
/** How many pixels a second can be at the most and at the least. */
const MAX_ZOOM = 300;
const MIN_ZOOM = 0.2;
/** Peaks kept for drawing, by what they were made from. */
const PEAKS = new Map<string, Float32Array>();
const PEAK_COUNT = 400;

function preciseTime(seconds: number): string {
  const tenths = Math.max(0, Math.round(seconds * 10));
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  return `${m}:${String(s).padStart(2, '0')},${tenths % 10}`;
}

function parseSeconds(text: string): number | undefined {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** The distance between marks on the ruler that gives room for their numbers. */
function rulerStep(pixelsPerSecond: number): number {
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600];
  return steps.find((step) => step * pixelsPerSecond >= 64) ?? 3600;
}

/** A waveform drawn from peaks, as wide as its box. */
function Wave({ data, color }: { data: Float32Array | undefined; color: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const width = (el.width = data?.length ?? 1);
    const height = (el.height = 40);
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (!data) return;
    ctx.fillStyle = color;
    for (let x = 0; x < width; x++) {
      const h = Math.max(1, data[x]! * height);
      ctx.fillRect(x, (height - h) / 2, 1, h);
    }
  }, [data, color]);
  return <canvas ref={canvas} className="tl-wave" aria-hidden="true" />;
}

const voiceKey = (project: Project, index: number): string => {
  const scene = project.scenes[index]!;
  return `v|${scene.id}|${JSON.stringify(scene.audio)}`;
};
const clipKey = (project: Project, placed: PlacedClip): string =>
  `c|${project.assets[placed.clip.asset]?.file}|${placed.clip.from}|${placed.clip.to}`;

/** Makes the peaks the timeline draws, a slide and a clip at a time. Calls `done` as they come. */
async function makePeaks(project: Project, placed: PlacedClip[], done: () => void): Promise<void> {
  for (let index = 0; index < project.scenes.length; index++) {
    const scene = project.scenes[index]!;
    const key = voiceKey(project, index);
    if (!hasSound(scene) || PEAKS.has(key)) continue;
    await loadSceneSamples(project, scene);
    PEAKS.set(key, peaks(renderTrack(scene.audio, samplesOf(project)), PEAK_COUNT));
    done();
  }
  for (const item of placed) {
    const key = clipKey(project, item);
    const file = project.assets[item.clip.asset]?.file;
    if (!file || PEAKS.has(key)) continue;
    const samples = await loadSamples(file);
    if (!samples) continue;
    const from = Math.round(item.clip.from * 48000);
    const to = Math.round(item.clip.to * 48000);
    PEAKS.set(key, peaks(samples.subarray(from, Math.min(samples.length, to)), PEAK_COUNT));
    done();
  }
  if (PEAKS.size > 600) {
    for (const key of [...PEAKS.keys()].slice(0, PEAKS.size - 600)) PEAKS.delete(key);
  }
}

export function Timeline() {
  const project = useStore((s) => s.project)!;
  const sceneId = useStore((s) => s.sceneId);
  const update = useStore((s) => s.update);
  const setScene = useStore((s) => s.setScene);
  const plan: Schedule = schedule(project.scenes);
  const numbers = slideNumbers(project.scenes);
  const placed = placeTracks(project, plan);
  const total = Math.max(plan.total, 0.1);
  // A clip can run on past the end of the lecture. The timeline reaches as far as
  // the longest one does, so its end can be got hold of and drawn in.
  const extent = Math.max(total, ...placed.map((p) => p.end));

  const area = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [, setDrawn] = useState(0);
  const [playhead, setPlayhead] = useState(() => {
    const index = project.scenes.findIndex((s) => s.id === sceneId);
    return plan.entries[Math.max(0, index)]?.start ?? 0;
  });
  const creditDialog = useRef<HTMLDialogElement>(null);
  const playback = useRef<LecturePlayback | null>(null);
  const frame = useRef(0);

  // The room there is for the lecture, so that all of it can be shown at once.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const measure = (): void => setRoom(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const fit = Math.max(MIN_ZOOM, (Math.max(200, room) - 8) / extent);
  // While something is dragged the scale stands still, also when what is dragged
  // changes how much there is to show; it would otherwise slide under the hand.
  const [held, setHeld] = useState<number | null>(null);
  const pps = held ?? zoom ?? fit; // pixels per second
  const x = (seconds: number): number => seconds * pps;

  // The waveforms.
  useEffect(() => {
    let alive = true;
    void makePeaks(project, placed, () => alive && setDrawn((n) => n + 1));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.scenes, project.tracks, project.assets]);

  const stop = useCallback((): void => {
    cancelAnimationFrame(frame.current);
    playback.current?.stop();
    playback.current = null;
    setPlaying(false);
    useStore.getState().setPreviewSteps(null);
    useStore.getState().setSoundAt(null);
  }, []);
  // Stop when the timeline goes away, and when the lecture is changed under what plays.
  useEffect(() => stop, [stop]);
  useEffect(() => {
    if (playback.current) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.scenes, project.tracks, project.video]);

  const play = async (): Promise<void> => {
    const state = useStore.getState();
    if (!state.project) return;
    const from = playhead >= total - 0.05 ? 0 : playhead;
    const running = await playLecture(state.project, from);
    playback.current = running;
    setPlaying(true);
    const scenes = state.project.scenes;
    const tick = (): void => {
      if (playback.current !== running) return;
      const t = running.position();
      setPlayhead(t);
      // The slide that is heard is the slide that is shown, with the steps that have come.
      const entry = plan.entries.find((e) => t < e.start + e.duration) ?? plan.entries.at(-1);
      const scene = entry && scenes[entry.index];
      if (entry && scene) {
        const store = useStore.getState();
        if (store.sceneId !== scene.id) store.setScene(scene.id);
        store.setPreviewSteps(stepsShownAt(scene, t - entry.start));
        store.setSoundAt({ t: t - entry.start, playing: true });
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    void running.ended.then((toEnd) => {
      if (playback.current !== running) return;
      stop();
      if (toEnd) setPlayhead(total);
    });
  };

  const seek = (seconds: number): void => {
    if (playing) stop();
    const to = Math.max(0, Math.min(total, seconds));
    setPlayhead(to);
    // The slide under the playhead is the slide that is shown.
    const entry = plan.entries.find((e) => to < e.start + e.duration) ?? plan.entries.at(-1);
    const scene = entry && project.scenes[entry.index];
    if (scene && scene.id !== sceneId) setScene(scene.id);
  };

  /** The time in the lecture under a point on the screen. */
  const inner = useRef<HTMLDivElement>(null);
  const timeAt = (clientX: number): number => {
    const box = inner.current?.getBoundingClientRect();
    return box ? Math.max(0, Math.min(extent, (clientX - box.left) / pps)) : 0;
  };

  const add = async (track: TrackName): Promise<void> => {
    if (playing) stop();
    const made = await addTrackSound(track, playhead);
    if (made) setSelected(made);
  };

  // Dragging: a clip, one of its ends, or the edge of a slide.
  const drag = useRef<{
    kind: 'move' | 'start' | 'end' | 'slide';
    id: string;
    x: number;
    from: number;
    moved: boolean;
  } | null>(null);
  const onDragMove = (event: React.PointerEvent): void => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.abs(event.clientX - d.x) < 3) return;
    d.moved = true;
    const to = d.from + (event.clientX - d.x) / pps;
    if (d.kind === 'slide') {
      update((draft) => {
        const scene = draft.scenes.find((s) => s.id === d.id);
        if (scene) setSceneLength(scene, to, () => newId('c'));
      }, `slide-length-${d.id}`);
    } else if (d.kind === 'move') {
      update((draft) => moveTrackClip(draft, d.id, to), `clip-move-${d.id}`);
    } else {
      update(
        (draft) => trimTrackClip(draft, d.id, d.kind as 'start' | 'end', to),
        `clip-trim-${d.id}`,
      );
    }
  };
  const startDrag = (
    event: React.PointerEvent,
    kind: 'move' | 'start' | 'end' | 'slide',
    id: string,
    from: number,
  ): void => {
    event.stopPropagation();
    if (playing) stop();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { kind, id, x: event.clientX, from, moved: false };
    setHeld(pps);
  };
  const endDrag = (): void => {
    drag.current = null;
    setHeld(null);
  };

  const chosen = selected ? findTrackClip(project, selected) : undefined;
  const chosenPlace = chosen && placed.find((p) => p.clip.id === chosen.clip.id);
  const chosenAsset = chosen ? project.assets[chosen.clip.asset] : undefined;
  const canSplit =
    !!chosenPlace && playhead > chosenPlace.start + 0.1 && playhead < chosenPlace.end - 0.1;
  const duck = videoOptions(project).duckMusic !== false;
  const step = rulerStep(pps);
  const marks: number[] = [];
  for (let t = 0; t <= extent; t += step) marks.push(t);

  const clipKeys = (event: React.KeyboardEvent, item: PlacedClip): void => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      update((draft) => removeTrackClip(draft, item.clip.id));
      setSelected(null);
      return;
    }
    const delta = event.key === 'ArrowLeft' ? -0.1 : event.key === 'ArrowRight' ? 0.1 : 0;
    if (!delta) return;
    event.preventDefault();
    const to = item.start + delta * (event.shiftKey ? 10 : 1);
    update((draft) => moveTrackClip(draft, item.clip.id, to), `clip-move-${item.clip.id}`);
  };

  return (
    <div className="timeline">
      <div className="tl-bar" role="toolbar" aria-label="Tidslinje">
        {playing ? (
          <button type="button" className="strong with-icon" onClick={stop}>
            <Icon name="stop" />
            Stopp
          </button>
        ) : (
          <button type="button" className="strong with-icon" onClick={() => void play()}>
            <Icon name="play" />
            Spill av
          </button>
        )}
        <span className="tl-time" aria-live="off">
          {preciseTime(playhead)} / {formatTime(plan.total)}
        </span>
        <button type="button" className="with-icon" onClick={() => void add('music')}>
          <Icon name="music" />
          Legg til musikk
        </button>
        <button type="button" className="with-icon" onClick={() => void add('sound')}>
          <Icon name="speaker" />
          Legg til lyd
        </button>
        <span className="gap" />
        <button
          type="button"
          className="icon-only"
          aria-label="Vis mindre av tidslinja (zoom inn)"
          title="Zoom inn"
          disabled={pps >= MAX_ZOOM}
          onClick={() => setZoom(Math.min(MAX_ZOOM, pps * 1.6))}
        >
          <Icon name="zoomIn" />
        </button>
        <button
          type="button"
          className="icon-only"
          aria-label="Vis mer av tidslinja (zoom ut)"
          title="Zoom ut"
          disabled={pps <= fit}
          onClick={() => {
            const next = pps / 1.6;
            setZoom(next <= fit ? null : next);
          }}
        >
          <Icon name="zoomOut" />
        </button>
        <button type="button" disabled={zoom === null} onClick={() => setZoom(null)}>
          Vis alt
        </button>
      </div>

      <div className="tl-body">
        <div className="tl-names" aria-hidden="true">
          <span className="tl-name tl-name-ruler" />
          <span className="tl-name tl-name-slides">Lysark</span>
          <span className="tl-name">Stemme</span>
          <span className="tl-name">Musikk</span>
          <span className="tl-name">Lyd</span>
        </div>
        <div className="tl-area" ref={area}>
          <div
            className="tl-inner"
            ref={inner}
            style={{ width: x(extent) }}
            data-pps={pps}
            onPointerDown={(event) => {
              // A press on an empty part moves the playhead there.
              if ((event.target as HTMLElement).closest('button')) return;
              setSelected(null);
              seek(timeAt(event.clientX));
            }}
          >
            <div className="tl-row tl-ruler" aria-hidden="true">
              {marks.map((t) => (
                <span key={t} className="tl-mark" style={{ left: x(t) }}>
                  {/* A number that has no room before the edge is left out; its line stays. */}
                  {x(extent - t) >= 34 ? formatTime(t) : ''}
                </span>
              ))}
            </div>

            <div className="tl-row tl-slides" role="group" aria-label="Lysarkene i forelesningen">
              {plan.entries.map((entry) => {
                const scene = project.scenes[entry.index]!;
                // A slide that is shown once more has the number of the slide it shows.
                const number = numbers[entry.index]!;
                const label = scene.repeat ? `Lysark ${number} igjen` : `Lysark ${number}`;
                const name = scene.title.trim() || `Lysark ${number}`;
                return (
                  <div
                    key={scene.id}
                    className="tl-slide-box"
                    style={{ left: x(entry.start), width: x(entry.duration) }}
                  >
                    <button
                      type="button"
                      className="tl-slide"
                      aria-current={scene.id === sceneId ? 'true' : undefined}
                      aria-label={`${label}: ${name}, ${formatTime(entry.duration)}`}
                      title={`${label}: ${name} – ${formatTime(entry.duration)}`}
                      onClick={() => {
                        setScene(scene.id);
                        seek(entry.start);
                      }}
                    >
                      <b>{scene.repeat ? '↩' : number}</b> <span>{name}</span>
                    </button>
                    <button
                      type="button"
                      className="tl-edge"
                      aria-label={`Lengden på lysark ${number}: ${preciseTime(entry.duration)}. Piltaster endrer den.`}
                      title="Dra for å la lysarket stå lenger eller kortere (pausen på slutten endres)"
                      onPointerDown={(e) => startDrag(e, 'slide', scene.id, entry.duration)}
                      onPointerMove={onDragMove}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      onKeyDown={(e) => {
                        const delta =
                          e.key === 'ArrowLeft' ? -0.5 : e.key === 'ArrowRight' ? 0.5 : 0;
                        if (!delta) return;
                        e.preventDefault();
                        const to = Math.max(leastSceneLength(scene), entry.duration + delta);
                        update((draft) => {
                          const target = draft.scenes.find((s) => s.id === scene.id);
                          if (target) setSceneLength(target, to, () => newId('c'));
                        }, `slide-length-${scene.id}`);
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="tl-row tl-voice" role="group" aria-label="Stemme">
              {plan.entries.map((entry) => {
                const scene = project.scenes[entry.index]!;
                if (!hasSound(scene)) return null;
                return (
                  <div
                    key={scene.id}
                    className="tl-voice-clip"
                    style={{ left: x(entry.start), width: x(entry.duration) }}
                  >
                    <Wave data={PEAKS.get(voiceKey(project, entry.index))} color="#7800f0" />
                  </div>
                );
              })}
            </div>

            {(['music', 'sound'] as const).map((track) => {
              const clips = placed.filter((p) => p.track === track);
              return (
                <div
                  key={track}
                  className={`tl-row tl-track tl-${track}`}
                  role="group"
                  aria-label={LABELS[track]}
                >
                  {clips.length === 0 && (
                    <span className="tl-empty">
                      {track === 'music'
                        ? '«Legg til musikk» setter en lydfil inn ved spillehodet.'
                        : '«Legg til lyd» setter en lydfil inn ved spillehodet.'}
                    </span>
                  )}
                  {clips.map((item) => {
                    const asset = project.assets[item.clip.asset];
                    const name = asset?.name ?? LABELS[track];
                    const length = item.end - item.start;
                    return (
                      <button
                        key={item.clip.id}
                        type="button"
                        className="tl-clip"
                        style={{ left: x(item.start), width: Math.max(6, x(length)) }}
                        aria-pressed={selected === item.clip.id}
                        aria-label={`${LABELS[track]}: ${name}, starter ${preciseTime(item.start)}, varer ${preciseTime(length)}. Piltaster flytter, Delete fjerner.`}
                        title={`${name} – ${preciseTime(length)}. Dra for å flytte, dra i endene for å korte inn.`}
                        onPointerDown={(e) => {
                          setSelected(item.clip.id);
                          const box = e.currentTarget.getBoundingClientRect();
                          const grip = Math.min(10, box.width / 4);
                          const kind =
                            e.clientX - box.left < grip
                              ? 'start'
                              : box.right - e.clientX < grip
                                ? 'end'
                                : 'move';
                          startDrag(e, kind, item.clip.id, kind === 'end' ? item.end : item.start);
                        }}
                        onPointerMove={onDragMove}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        onKeyDown={(e) => clipKeys(e, item)}
                      >
                        <Wave
                          data={PEAKS.get(clipKey(project, item))}
                          color={track === 'music' ? '#2f0b63' : '#a34000'}
                        />
                        {(item.clip.fadeIn ?? 0) > 0 && (
                          <span
                            className="tl-fade tl-fade-in"
                            style={{ width: x(Math.min(length, item.clip.fadeIn!)) }}
                            aria-hidden="true"
                          />
                        )}
                        {(item.clip.fadeOut ?? 0) > 0 && (
                          <span
                            className="tl-fade tl-fade-out"
                            style={{ width: x(Math.min(length, item.clip.fadeOut!)) }}
                            aria-hidden="true"
                          />
                        )}
                        <span className="tl-clip-name">{name}</span>
                        <span className="tl-grip tl-grip-start" aria-hidden="true" />
                        <span className="tl-grip tl-grip-end" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {extent > total + 0.05 && (
              <span
                className="tl-after"
                style={{ left: x(total), width: x(extent - total) }}
                title="Etter slutten av forelesningen. Det som ligger her, høres ikke."
              >
                <span>Etter slutten: høres ikke</span>
              </span>
            )}
            <span className="tl-playhead" style={{ left: x(Math.min(playhead, total)) }} />
          </div>
        </div>
      </div>

      {chosen && chosenPlace ? (
        <div className="tl-tools" role="group" aria-label="Det valgte klippet">
          <span className="tl-chosen">
            <b>{LABELS[chosen.track]}:</b> {chosenAsset?.name ?? ''} (
            {preciseTime(chosenPlace.end - chosenPlace.start)}
            {assetSeconds(chosenAsset) > 0 ? ` av ${preciseTime(assetSeconds(chosenAsset))}` : ''})
          </span>
          <label className="audio-group audio-gain">
            Lydstyrke
            <input
              type="range"
              min={GAIN_DB.min}
              max={GAIN_DB.max}
              step={1}
              value={chosen.clip.gain ?? 0}
              onChange={(e) =>
                update(
                  (draft) => setTrackClip(draft, chosen.clip.id, { gain: Number(e.target.value) }),
                  `clip-gain-${chosen.clip.id}`,
                )
              }
            />
            <span className="audio-gain-value">
              {(chosen.clip.gain ?? 0) > 0 ? '+' : ''}
              {chosen.clip.gain ?? 0} dB
            </span>
          </label>
          <FadeField
            label="Ton inn"
            value={chosen.clip.fadeIn ?? 0}
            onChange={(fadeIn) =>
              update((draft) => setTrackClip(draft, chosen.clip.id, { fadeIn }))
            }
          />
          <FadeField
            label="Ton ut"
            value={chosen.clip.fadeOut ?? 0}
            onChange={(fadeOut) =>
              update((draft) => setTrackClip(draft, chosen.clip.id, { fadeOut }))
            }
          />
          <button
            type="button"
            className="with-icon"
            disabled={!canSplit}
            title="Deler klippet i to der spillehodet står"
            onClick={() => {
              let second: string | undefined;
              update((draft) => {
                second = splitTrackClip(draft, chosen.clip.id, playhead, () => newId('k'));
              });
              if (second) setSelected(second);
            }}
          >
            <Icon name="split" />
            Del ved spillehodet
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              update((draft) => removeTrackClip(draft, chosen.clip.id));
              setSelected(null);
            }}
          >
            Fjern klippet
          </button>
          <button type="button" onClick={() => creditDialog.current?.showModal()}>
            Kreditering
          </button>
          <dialog ref={creditDialog} className="dialog tl-credit">
            <h2>Kreditering av {chosenAsset?.name ?? 'lydfila'}</h2>
            <CreditFields
              what="sound"
              credit={chosenAsset?.credit}
              onChange={(credit) =>
                update((draft) => {
                  const target = draft.assets[chosen.clip.asset];
                  if (!target) return;
                  if (credit) target.credit = credit;
                  else delete target.credit;
                }, `credit-${chosen.clip.asset}`)
              }
            />
            <div className="dialog-actions">
              <button
                type="button"
                className="strong"
                onClick={() => creditDialog.current?.close()}
              >
                Ferdig
              </button>
            </div>
          </dialog>
        </div>
      ) : (
        <div className="tl-tools">
          {placed.some((p) => p.track === 'music') && (
            <label className="check">
              <input
                type="checkbox"
                checked={duck}
                onChange={(e) =>
                  update((draft) => {
                    draft.video = { ...videoOptions(draft), duckMusic: e.target.checked };
                  })
                }
              />
              Demp musikken mens noen snakker
            </label>
          )}
          <span className="hint">
            Velg et klipp for å endre det. Dra i høyre kant av et lysark for å la det stå lenger.
            Stemmen klippes under «Lyd».
          </span>
        </div>
      )}
    </div>
  );
}

/** A number of seconds for a fade, taken when the field is left or Enter is pressed. */
function FadeField(props: { label: string; value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(props.value).replace('.', ','));
  useEffect(
    () => setText(String(Math.round(props.value * 10) / 10).replace('.', ',')),
    [props.value],
  );
  const commit = (): void => {
    const value = parseSeconds(text);
    if (value === undefined) setText(String(props.value).replace('.', ','));
    else if (value !== props.value) props.onChange(value);
  };
  return (
    <label className="audio-group">
      {props.label}
      <input
        className="audio-number"
        type="text"
        inputMode="decimal"
        value={text}
        aria-label={`${props.label}, sekunder`}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
      />
      s
    </label>
  );
}
