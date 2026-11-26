// The recording window. The owner reads the manuscript aloud and moves as
// in any presentation: the right arrow goes on to the next step or the next
// slide, the left arrow goes back, and the slide menu jumps to any slide.
// The recording never stops for that. It is a film of what the lecturer
// did: every stretch on a slide is kept with its sound, and a slide the
// lecturer comes back to is shown once more in video and "Spill av"
// (src/shared/audio/session.ts). A whole lecture can be read in one go and
// still be edited slide by slide.
// While reading, the owner can open a "Lær mer" box and play a video on the
// slide; the program remembers when, like it does for the steps, and the
// video and "Spill av" do the same at the same times.
// When the owner switches the camera on, their face is filmed too and shown
// in a circle on the slide, which can be dragged about while reading; where
// it stood, and when it was moved, is remembered like the rest. The film is
// one, from the start of the recording to its end.
// Everything is stored in the project folder and sent nowhere.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { mediaUrl } from '../../shared/api';
import { newId } from '../../shared/format/factory';
import { stageOf } from '../../shared/format/constants';
import {
  CAMERA_SIZES,
  type CameraSize,
  type Scene,
  type SceneEvent,
} from '../../shared/format/schema';
import {
  CAMERA_DIAMETER,
  SAMPLE_RATE,
  cameraOnStage,
  cameraPlaceAt,
  defaultCameraPlace,
  formatTime,
  hasSound,
  moreAt,
  stepsShownAt,
  videoKey,
  videosAt,
} from '../../shared/render/clock';
import { chapters, ownIndex, slideCount, slideNumbers } from '../../shared/layout/slides';
import { createPopover, type SlidePopover } from '../../shared/render/popover';
import { sceneMoves } from '../../shared/render/timeline';
import { moreOf } from '../../shared/render/scene';
import {
  openFilmStore,
  saveRecordingLater,
  storeTakeSound,
  type FilmStore,
  type RecordedTake,
} from './actions';
import {
  CameraError,
  FilmSync,
  listCameras,
  openCamera,
  startFilm,
  type CameraChoice,
  type Film,
} from './audio/camera';
import {
  MicrophoneError,
  SoundPieces,
  blockPeak,
  listMicrophones,
  openMicrophone,
  type Capture,
  type MicrophoneChoice,
} from './audio/capture';
import { CameraCircle } from './CameraCircle';
import { Icon } from './Icon';
import { SceneView, renderContext } from './SceneView';
import { useStore } from './store';

type Phase = 'setup' | 'countdown' | 'recording' | 'paused';

const SETTINGS_KEY = 'lysark.mikrofon';
/**
 * A slide that was shown for less than this was only passed on the way to
 * another one. It is not a showing of its own: what was said meanwhile is
 * heard on the slide before it.
 */
const MIN_STRETCH_SECONDS = 0.5;

/** One stretch of the recording: a slide, from the lecturer came to it until they left it. */
interface Stretch {
  index: number;
  sceneId: string;
  /** The slide's steps, in order. */
  steps: string[];
  /** How many of them were on the slide when the stretch began, and how many are now. */
  shownAtStart: number;
  stepsShown: number;
  /** When each further step was shown, in seconds from the start of the stretch. */
  stepAts: Record<string, number>;
  /** What was opened, played and moved meanwhile. */
  events: SceneEvent[];
  /** The sound of the stretch, as it arrives. */
  sound: SoundPieces;
  samples: number;
  /** Where the camera circle stood when the stretch began. */
  circleStart: { x: number; y: number };
  /** Which moment of the recording's film the stretch began at, when it is filmed. */
  filmAt?: number;
  /** The stretch goes on from this point in the sound the slide already has. */
  keepBefore?: number;
}

interface MicSettings {
  deviceId: string;
  noiseSuppression: boolean;
  autoGain: boolean;
  /** Let a video that is played while reading be heard. */
  videoSound: boolean;
  /** Film the lecturer's face while reading. Off until the owner switches it on. */
  camera: boolean;
  cameraId: string;
  cameraSize: CameraSize;
}

const CAMERA_SIZE_NAMES: Record<CameraSize, string> = {
  small: 'Liten',
  medium: 'Middels',
  large: 'Stor',
};

function readSettings(): MicSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<MicSettings>;
    return {
      deviceId: typeof saved.deviceId === 'string' ? saved.deviceId : '',
      noiseSuppression: saved.noiseSuppression !== false,
      autoGain: saved.autoGain === true,
      videoSound: saved.videoSound !== false,
      camera: saved.camera === true,
      cameraId: typeof saved.cameraId === 'string' ? saved.cameraId : '',
      cameraSize: CAMERA_SIZES.includes(saved.cameraSize as CameraSize)
        ? (saved.cameraSize as CameraSize)
        : 'medium',
    };
  } catch {
    return {
      deviceId: '',
      noiseSuppression: true,
      autoGain: false,
      videoSound: true,
      camera: false,
      cameraId: '',
      cameraSize: 'medium',
    };
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

/** How many slides ahead, and back, have their pictures made ready. */
const PREPARE_AHEAD = 2;
const PREPARE_BACK = 1;

/**
 * Fetches and decodes the pictures of the slides near the one that is shown,
 * before the lecturer gets to them, so that going to the next slide is not
 * held up by a large picture being read (a slide from a PDF has a picture of
 * the whole page behind it, thousands of pixels each way). Only the slides
 * near are kept ready: a lecture of a hundred such slides would not fit in
 * memory decoded.
 */
function usePreparedPictures(index: number): void {
  const held = useRef(new Map<string, HTMLImageElement>());
  useEffect(() => {
    const project = useStore.getState().project;
    if (!project) return;
    const near = new Set<string>();
    const from = Math.max(0, index - PREPARE_BACK);
    // Slides shown once more stand between the slides; they show the same pictures.
    for (let at = from, ahead = 0; at < project.scenes.length; at++) {
      const scene = project.scenes[at]!;
      if (at > index && !scene.repeat) ahead += 1;
      if (ahead > PREPARE_AHEAD) break;
      for (const element of scene.elements) {
        if (element.type !== 'image') continue;
        const asset = project.assets[element.asset];
        if (asset) near.add(mediaUrl(asset.file));
      }
    }
    const kept = held.current;
    for (const url of [...kept.keys()]) if (!near.has(url)) kept.delete(url);
    for (const url of near) {
      if (kept.has(url)) continue;
      const picture = new Image();
      picture.decoding = 'async';
      picture.src = url;
      void picture.decode().catch(() => undefined);
      kept.set(url, picture);
    }
  }, [index]);
  useEffect(() => {
    const kept = held.current;
    return () => kept.clear();
  }, []);
}

/** A slide drawn as large as the space allows. */
function FittedScene({
  scene,
  steps,
  live,
  inner,
  onPress,
  children,
}: {
  scene: Scene;
  steps: number;
  /** True while what is pressed on the slide is remembered. */
  live: boolean;
  inner: React.RefObject<HTMLDivElement | null>;
  onPress: (target: HTMLElement) => void;
  /** What lies on top of the slide: the camera circle. */
  children?: React.ReactNode;
}) {
  const project = useStore((s) => s.project)!;
  const logo = useStore((s) => s.logo);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const stage = stageOf(project);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = (): void =>
      setScale(
        Math.max(0.05, Math.min(el.clientWidth / stage.width, el.clientHeight / stage.height)),
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [stage]);
  return (
    <div className="recorder-stage" ref={box}>
      {scale > 0 && (
        <div
          className="recorder-stage-box"
          style={{ width: stage.width * scale, height: stage.height * scale }}
        >
          <div
            className={`recorder-stage-inner${live ? ' is-live' : ''}`}
            style={{ width: stage.width, height: stage.height, transform: `scale(${scale})` }}
            ref={inner}
            onClick={(event) => onPress(event.target as HTMLElement)}
          >
            <SceneView scene={scene} project={project} logo={logo} previewSteps={steps} zoomed />
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

/** The slide menu: every slide of the lecture, by chapter, to jump to. */
function SlideMenu({
  current,
  read,
  onPick,
  onClose,
}: {
  current: number;
  /** The slides that have been read in so far in this recording. */
  read: ReadonlySet<string>;
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  const scenes = useStore((s) => s.project)!.scenes;
  const numbers = slideNumbers(scenes);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const here = list.current?.querySelector<HTMLElement>('[aria-current="true"]');
    here?.scrollIntoView({ block: 'center' });
    here?.focus();
  }, []);
  const parts = chapters(scenes);
  const groups = parts.length > 0 ? parts : [{ name: '', first: 0, last: scenes.length - 1 }];
  const onKeyDown = (event: React.KeyboardEvent): void => {
    // The keys belong to the menu while it is open, not to the recording.
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (!step && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const items = Array.from(list.current?.querySelectorAll<HTMLElement>('button') ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    const to =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : Math.max(0, Math.min(items.length - 1, at + step!));
    items[to]?.focus();
  };
  return (
    <aside className="recorder-menu" aria-label="Velg lysark" onKeyDown={onKeyDown}>
      <div className="recorder-menu-head">
        <h3>Velg lysark</h3>
        <button type="button" onClick={onClose}>
          Lukk
        </button>
      </div>
      <div className="recorder-menu-list" ref={list}>
        {groups.map((group) => (
          <section key={group.first}>
            {group.name.trim() !== '' && <h4>{group.name}</h4>}
            <ol>
              {scenes.slice(group.first, group.last + 1).map((scene, offset) => {
                const index = group.first + offset;
                // A slide that is shown once more is not a slide to go to: go to the slide itself.
                if (scene.repeat) return null;
                return (
                  <li key={scene.id}>
                    <button
                      type="button"
                      className="recorder-menu-item"
                      aria-current={index === current ? 'true' : undefined}
                      onClick={() => onPick(index)}
                    >
                      <span className="recorder-menu-number">{numbers[index]}</span>
                      <span className="recorder-menu-title">
                        {scene.title.trim() || 'Uten navn'}
                      </span>
                      {(read.has(scene.id) || hasSound(scene)) && (
                        <span className="recorder-menu-read">
                          {read.has(scene.id) ? 'lest inn nå' : 'har lyd'}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </aside>
  );
}

export function Recorder({ keepBefore }: { keepBefore?: number }) {
  const project = useStore((s) => s.project)!;
  const size = stageOf(project);
  const startId = useRef(useStore.getState().sceneId).current;
  // The recording begins on a slide itself, also when one of its repeats was open.
  const startIndex = useRef(
    (() => {
      const at = Math.max(
        0,
        project.scenes.findIndex((s) => s.id === startId),
      );
      const own = ownIndex(project.scenes, at);
      return own < 0 ? at : own;
    })(),
  ).current;
  const [index, setIndex] = useState(startIndex);
  usePreparedPictures(index);
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
  /** The slides that have been read in so far in this recording. */
  const [read, setRead] = useState<ReadonlySet<string>>(() => new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  /** Said when something was pressed that cannot be played while reading in. */
  const [pressNote, setPressNote] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraChoice[]>([]);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  /** Where the camera circle stands: where the slide had it, or the lower right corner. */
  const [circle, setCircle] = useState(() => {
    const first = project.scenes[startIndex]!;
    const place =
      keepBefore !== undefined && first.camera
        ? cameraPlaceAt(first, keepBefore, undefined, size)
        : (first.camera ?? defaultCameraPlace(size));
    return cameraOnStage(place.x, place.y, settings.cameraSize, size);
  });
  const root = useRef<HTMLDivElement>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const box = useRef<SlidePopover | null>(null);
  // A step that zooms while a box is open: the box goes where its element is seen now.
  useEffect(() => {
    const open = box.current;
    if (open) open.place(sceneMoves(scene, stepsShown, Infinity, size).view ?? null);
  }, [scene, stepsShown, size]);

  // What the sound thread fills, kept outside React's state.
  const live = useRef({
    capture: null as Capture | null,
    keeping: false,
    peak: 0,
    /** Where the recording stands, or (before it has begun) where it will begin. */
    index: startIndex,
    stepsShown: firstSteps,
    /** The stretch that is being read; null until the recording has begun. */
    now: null as Stretch | null,
    /**
     * The stretch before it. It is not stored yet: a slide that is only
     * passed is heard on it, and the lecturer may come straight back to it.
     */
    waiting: null as Stretch | null,
    /** The stretches before that, with their sound on its way to the project folder. */
    takes: [] as RecordedTake[],
    /** How many samples the stored stretches hold. */
    stored: 0,
    /** How many steps each slide showed when it was last left in this recording. */
    left: new Map<number, number>(),
    /** The camera, when it is on, and the film of the recording. */
    stream: null as MediaStream | null,
    film: null as Film | null,
    filmStore: null as FilmStore | null,
    /** Which moment of the film belongs to which moment of the sound. */
    sync: new FilmSync(),
    circle,
    /** When the circle was taken hold of, in seconds of the stretch's sound. */
    dragAt: 0,
    cameraSize: settings.cameraSize,
  });
  live.current.cameraSize = settings.cameraSize;

  // The camera is open only while the owner has it switched on in this window.
  useEffect(() => {
    if (!settings.camera) {
      setCameraError(null);
      return;
    }
    let alive = true;
    let opened: MediaStream | null = null;
    setCameraError(null);
    void openCamera(settings.cameraId)
      .then(async (stream) => {
        if (!alive) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        opened = stream;
        live.current.stream = stream;
        setCameraStream(stream);
        setCameras(await listCameras());
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setCameraError(error instanceof CameraError ? error.message : 'Kameraet kunne ikke åpnes.');
      });
    return () => {
      alive = false;
      for (const track of opened?.getTracks() ?? []) track.stop();
      live.current.stream = null;
      setCameraStream(null);
    };
  }, [settings.camera, settings.cameraId]);

  // A film that is still being taken when the window goes away is not kept.
  useEffect(() => {
    const state = live.current;
    return () => {
      void state.film?.end().catch(() => undefined);
      state.filmStore?.drop();
      state.film = null;
      state.filmStore = null;
    };
  }, []);

  // The circle is kept wholly on the slide, also when its size is changed.
  useEffect(() => {
    setCircle((at) => {
      const next = cameraOnStage(at.x, at.y, settings.cameraSize, size);
      live.current.circle = next;
      return next.x === at.x && next.y === at.y ? at : next;
    });
  }, [settings.cameraSize]);

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
          if (state.keeping && state.now) {
            state.now.sound.push(block);
            state.now.samples += block.length;
            if (state.film) state.sync.note(state.film.time(), keptSamples() / SAMPLE_RATE);
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

  // The level meter and the clock, which shows how long the whole recording is.
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
      const samples = state.stored + (state.waiting?.samples ?? 0) + (state.now?.samples ?? 0);
      // Whole seconds, as the clock shows them: the window (and the slide in
      // it) is then drawn anew once a second, not at every frame.
      setSeconds(Math.round(samples / SAMPLE_RATE));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    root.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);

  // 3, 2, 1, and then the samples and the pictures are kept.
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count <= 0) {
      const state = live.current;
      if (state.now) {
        state.now.circleStart = state.circle;
        if (state.film) state.now.filmAt = state.film.time();
      }
      state.film?.keep(true);
      state.keeping = true;
      setPhase('recording');
      return;
    }
    const timer = window.setTimeout(() => setCount((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, count]);

  // ---------- "Lær mer" and video on the slide ----------
  /** How far the stretch that is being read has come, in seconds. */
  const now = (): number => (live.current.now?.samples ?? 0) / SAMPLE_RATE;

  /** Remembers something that was done on the slide, when the reading is running. */
  const remember = (event: SceneEvent): void => {
    const state = live.current;
    if (state.keeping && state.now) state.now.events.push(event);
  };

  /**
   * Every video on the slide and in the open box that is a file in the
   * project. Never the camera circle's, which lies on the slide too: what
   * stops the slide's videos when the slide is left once paused the circle
   * as well, and the lecturer's face stood still from the first change of
   * slide to the end of the recording (seen by the owner 25 and 26.11.2026).
   */
  const videos = (): HTMLVideoElement[] =>
    Array.from(
      stage.current?.querySelectorAll<HTMLVideoElement>('video:not(.ls-closing)') ?? [],
    ).filter((video) => !video.closest('.camera-circle'));

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

  const stopVideo = (video: HTMLVideoElement, keep: boolean): void => {
    if (video.paused || video.ended) {
      showPlaying(video, false);
      return;
    }
    video.pause();
    showPlaying(video, false);
    const which = whichVideo(video);
    if (keep && which) remember({ id: newId('h'), at: now(), kind: 'video-pause', ...which });
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
    remember({
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

  /** Puts the open box away. With `keep`, the video and "Spill av" do the same at this time. */
  const closeBox = (keep: boolean): void => {
    const open = box.current;
    if (!open) return;
    for (const video of Array.from(open.layer.querySelectorAll('video'))) video.pause();
    open.layer.remove();
    box.current = null;
    if (keep) remember({ id: newId('h'), at: now(), kind: 'more-close' });
  };

  const openBox = (elementId: string, keep: boolean): void => {
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
    // Beside its element where it is seen, also when the slide is zoomed in.
    made.place(
      sceneMoves(current!, live.current.stepsShown, Infinity, stageOf(state.project)).view ?? null,
    );
    // A picture in the box can change its height when it has been fetched.
    for (const img of Array.from(made.layer.querySelectorAll('img'))) {
      img.addEventListener('load', () => made.place(), { once: true });
    }
    for (const video of Array.from(made.layer.querySelectorAll('video'))) {
      video.addEventListener('loadedmetadata', () => made.place(), { once: true });
    }
    made.panel.classList.add('ls-pop-in');
    box.current = made;
    if (keep) remember({ id: newId('h'), at: now(), kind: 'more-open', element: elementId });
  };

  /** Stops what plays and puts the box away, when the slide is left or read again. */
  const clearSlide = useCallback((): void => {
    setPressNote(null);
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
    if (target.closest('.ls-videocard')) {
      // A video that lies on the web. The interface has no way to the web, and
      // such a video cannot be put into a video file either.
      setPressNote(
        'En video fra nettet (YouTube og lignende) kan ikke spilles mens du leser inn. ' +
          'Studentene spiller den selv i HTML-fila; i videofila står den som stillbilde.',
      );
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

  // ---------- The stretches of the recording ----------
  const sceneAt = (at: number): Scene | undefined => useStore.getState().project?.scenes[at];

  /** How many samples the recording has kept so far, the stretch that is being read included. */
  const keptSamples = (): number => {
    const state = live.current;
    return state.stored + (state.waiting?.samples ?? 0) + (state.now?.samples ?? 0);
  };

  /** The moment of the film that belongs to the sound kept so far. */
  const filmNow = (film: Film): number =>
    live.current.sync.filmAt(keptSamples() / SAMPLE_RATE, film.time());

  /** A new stretch on a slide, with `shown` of its steps already there. */
  const newStretch = (at: number, shown: number): Stretch | null => {
    const state = live.current;
    const target = sceneAt(at);
    if (!target) return null;
    return {
      index: at,
      sceneId: target.id,
      steps: target.timeline.map((step) => step.id),
      shownAtStart: shown,
      stepsShown: shown,
      stepAts: {},
      events: [],
      sound: new SoundPieces(),
      samples: 0,
      circleStart: state.circle,
      ...(state.film ? { filmAt: filmNow(state.film) } : {}),
    };
  };

  /** Hands a finished stretch on: its sound is stored in the background. */
  const store = (stretch: Stretch): void => {
    const state = live.current;
    const numbers = slideNumbers(useStore.getState().project?.scenes ?? []);
    state.takes.push({
      scene: stretch.sceneId,
      // The sound is made into a file in a thread of its own; the window goes on at once.
      sound: storeTakeSound(
        stretch.sound.take(),
        `Opptak lysark ${numbers[stretch.index] ?? stretch.index + 1}`,
      ),
      shown: stretch.steps.slice(0, stretch.shownAtStart),
      stepAts: stretch.stepAts,
      events: stretch.events,
      ...(stretch.filmAt === undefined
        ? {}
        : {
            camera: {
              place: { ...stretch.circleStart, size: state.cameraSize },
              filmAt: stretch.filmAt,
            },
          }),
      ...(stretch.keepBefore === undefined ? {} : { keepBefore: stretch.keepBefore }),
    });
    state.stored += stretch.samples;
  };

  /** The stretch that is being read ends here: the lecturer goes elsewhere, or is done. */
  const leave = (): void => {
    const state = live.current;
    const stretch = state.now;
    if (!stretch) return;
    state.now = null;
    state.left.set(stretch.index, stretch.stepsShown);
    if (stretch.samples < SAMPLE_RATE * MIN_STRETCH_SECONDS) {
      // The slide was only passed. What was said meanwhile is heard on the
      // slide before it, and a move of the camera circle is kept; when there
      // is no slide before it, the little that was said is not kept.
      const before = state.waiting;
      if (before && stretch.samples > 0) {
        const offset = before.samples / SAMPLE_RATE;
        for (const piece of stretch.sound.take()) before.sound.push(piece);
        before.samples += stretch.samples;
        for (const event of stretch.events) {
          if (event.kind === 'camera-move') before.events.push({ ...event, at: event.at + offset });
        }
      }
      return;
    }
    if (state.waiting) store(state.waiting);
    state.waiting = stretch;
    setRead((was) => (was.has(stretch.sceneId) ? was : new Set(was).add(stretch.sceneId)));
  };

  /**
   * Goes to a slide, with `shown` of its steps there. The recording goes on
   * without a stop: the stretch on the slide that is left ends at this
   * moment, and the stretch on the new slide begins. Before the recording
   * has begun, this is where it will begin.
   */
  const goTo = (to: number, shown: number): void => {
    const state = live.current;
    const target = sceneAt(to);
    if (!target) return;
    const steps = Math.max(0, Math.min(target.timeline.length, shown));
    if (state.now) {
      leave();
      clearSlide();
      const before = state.waiting;
      if (before && before.index === to && before.stepsShown === steps) {
        // Straight back to the slide that was just left, as it was left: the same stretch goes on.
        state.waiting = null;
        state.now = before;
      } else {
        state.now = newStretch(to, steps);
      }
    }
    state.index = to;
    state.stepsShown = steps;
    setIndex(to);
    setStepsShown(steps);
  };

  /** The slide after or before a slide, the ones that are shown once more not counted. */
  const neighbour = (from: number, direction: 1 | -1): number => {
    const scenes = useStore.getState().project?.scenes ?? [];
    for (let at = from + direction; at >= 0 && at < scenes.length; at += direction) {
      if (!scenes[at]!.repeat) return at;
    }
    return -1;
  };

  /** True while the recording is running or paused: the slide can be changed. */
  const moving = (): boolean => live.current.now !== null && phaseRef.current !== 'countdown';

  /** The right arrow: the next step, or the next slide. */
  const advance = (): void => {
    const state = live.current;
    const stretch = state.now;
    if (!stretch || !moving()) return;
    if (stretch.stepsShown < stretch.steps.length) {
      stretch.stepAts[stretch.steps[stretch.stepsShown]!] = stretch.samples / SAMPLE_RATE;
      stretch.stepsShown += 1;
      state.stepsShown = stretch.stepsShown;
      setStepsShown(stretch.stepsShown);
      return;
    }
    const to = neighbour(stretch.index, 1);
    // A slide that has been shown in this recording comes back as it was left.
    if (to >= 0) goTo(to, state.left.get(to) ?? 0);
  };

  /**
   * The left arrow: back one step, or back to the slide before, which is
   * shown as it was left (with all its steps, when it has not been shown in
   * this recording).
   */
  const back = (): void => {
    const state = live.current;
    const stretch = state.now;
    if (!stretch || !moving()) return;
    if (stretch.stepsShown > 0) {
      goTo(stretch.index, stretch.stepsShown - 1);
      return;
    }
    const to = neighbour(stretch.index, -1);
    if (to >= 0) goTo(to, state.left.get(to) ?? sceneAt(to)?.timeline.length ?? 0);
  };

  /** A slide picked in the slide menu. */
  const pick = (to: number): void => {
    const state = live.current;
    setMenuOpen(false);
    root.current?.focus();
    if (to === state.index) return;
    if (!state.now) {
      goTo(to, to === startIndex ? firstSteps : 0);
      return;
    }
    if (phaseRef.current === 'countdown') return;
    goTo(to, state.left.get(to) ?? 0);
  };

  const begin = (): void => {
    const state = live.current;
    if (!state.now) {
      if (state.stream && !state.film) {
        const filmStore = openFilmStore();
        const film = filmStore && startFilm(state.stream, (piece) => filmStore.write(piece));
        if (film) {
          state.film = film;
          state.filmStore = filmStore;
        } else {
          filmStore?.drop();
          setCameraError('Kameraet kan ikke filmes på denne maskinen.');
        }
      }
      state.now = newStretch(state.index, state.stepsShown);
      if (state.now && state.index === startIndex && keepBefore !== undefined) {
        state.now.keepBefore = keepBefore;
        restoreKept();
      }
    }
    setMenuOpen(false);
    setCount(3);
    setPhase('countdown');
    root.current?.focus();
  };

  /** Reads the slide anew from where the lecturer came to it. The recording before it stands. */
  const retake = (): void => {
    const state = live.current;
    const stretch = state.now;
    if (!stretch) return;
    state.keeping = false;
    state.film?.keep(false);
    stretch.sound.take();
    stretch.samples = 0;
    // The film goes on from here while the sound is read anew.
    state.sync.reset();
    stretch.stepAts = {};
    stretch.events = [];
    stretch.stepsShown = stretch.shownAtStart;
    state.stepsShown = stretch.shownAtStart;
    clearSlide();
    for (const video of videos()) video.currentTime = 0;
    setStepsShown(stretch.shownAtStart);
    if (stretch.keepBefore !== undefined) restoreKept();
    begin();
  };

  const togglePause = (): void => {
    const state = live.current;
    if (phase === 'recording') {
      // A film that plays stops with the reading; it is started again by hand.
      for (const video of videos()) stopVideo(video, true);
      state.keeping = false;
      state.film?.keep(false);
      setPhase('paused');
    } else if (phase === 'paused') {
      state.film?.keep(true);
      state.keeping = true;
      setPhase('recording');
    }
  };

  /**
   * Closes the window at once. The microphone and the camera are let go as
   * it closes; the film is finished and the sound stored in the background,
   * and the recording is put on the slides when that is done
   * (`saveRecordingLater`), while the lecturer works on.
   */
  const close = (keepCurrent: boolean): void => {
    const state = live.current;
    state.keeping = false;
    state.film?.keep(false);
    setMenuOpen(false);
    if (keepCurrent) leave();
    state.now = null;
    clearSlide();
    if (state.waiting) {
      store(state.waiting);
      state.waiting = null;
    }
    const takes = state.takes;
    state.takes = [];
    const camera =
      state.film && state.filmStore ? { film: state.film, store: state.filmStore } : null;
    // The film is the job's now: the window must not throw it away as it closes.
    state.film = null;
    state.filmStore = null;
    saveRecordingLater(takes, camera);
    useStore.getState().openRecorder(null);
  };

  const cancel = (): void => {
    const unsaved = (live.current.now?.samples ?? 0) > SAMPLE_RATE * MIN_STRETCH_SECONDS;
    if (
      unsaved &&
      !window.confirm('Avbryte? Det som er lest inn på dette lysarket, blir ikke tatt vare på.')
    ) {
      return;
    }
    close(false);
  };

  /**
   * The camera circle is dragged. Before the reading begins, that is where
   * it stands from the start; while a slide is read, the move is remembered
   * with its time, and the video does the same.
   */
  const moveCircle = (x: number, y: number, part: 'start' | 'move' | 'end'): void => {
    const state = live.current;
    if (part === 'start') {
      state.dragAt = now();
      return;
    }
    const at = cameraOnStage(x, y, state.cameraSize, size);
    state.circle = at;
    setCircle(at);
    if (part !== 'end') return;
    const stretch = state.now;
    if (stretch && state.film) {
      if (!state.keeping && stretch.samples === 0) {
        // Nothing of the stretch is read yet: this is where the circle stands from its start.
        stretch.circleStart = at;
      } else {
        stretch.events.push({
          id: newId('h'),
          at: state.keeping ? state.dragAt : now(),
          kind: 'camera-move',
          x: at.x,
          y: at.y,
        });
      }
    }
    // The arrow keys must go on meaning "next step".
    root.current?.focus();
  };

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const tag = (event.target as HTMLElement).tagName;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (menuOpen) setMenuOpen(false);
      else cancel();
      return;
    }
    if (tag === 'SELECT' || tag === 'INPUT') return;
    const forward = ['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key);
    const backward = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key);
    if ((forward || backward) && (phase === 'recording' || phase === 'paused')) {
      // A button that has the focus must not also be pressed by the space bar.
      event.preventDefault();
      if (forward) advance();
      else back();
    } else if (event.key.toLowerCase() === 'l' && phase !== 'countdown') {
      event.preventDefault();
      setMenuOpen((open) => !open);
    }
  };

  const numbers = slideNumbers(project.scenes);
  const total = slideCount(project.scenes);
  const stepsLeft = scene.timeline.length - stepsShown;
  const lines = scene.script.split(/\n+/).filter((line) => line.trim() !== '');
  const nextIndex = neighbour(index, 1);
  const next = nextIndex >= 0 ? project.scenes[nextIndex] : undefined;
  const lastSlide = nextIndex < 0;
  const firstSlide = neighbour(index, -1) < 0;
  const active = phase === 'recording' || phase === 'paused' || phase === 'countdown';
  const canMove = phase === 'recording' || phase === 'paused';

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
        <button
          type="button"
          className="recorder-pick with-icon"
          aria-expanded={menuOpen}
          disabled={phase === 'countdown'}
          title="Velg lysark (L)"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name="list" />
          Velg lysark
        </button>
        <span className="recorder-where">
          Lysark {numbers[index]} av {total}
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
          >
            {settings.camera && cameraStream && (
              <CameraCircle
                x={circle.x}
                y={circle.y}
                diameter={CAMERA_DIAMETER[settings.cameraSize]}
                stream={cameraStream}
                onMove={moveCircle}
              />
            )}
          </FittedScene>
          {phase === 'countdown' && (
            <div className="recorder-count" role="status" aria-live="assertive">
              {count > 0 && (
                <span key={count} className="recorder-count-number">
                  {count}
                </span>
              )}
            </div>
          )}
          {menuOpen && (
            <SlideMenu
              current={index}
              read={read}
              onPick={pick}
              onClose={() => {
                setMenuOpen(false);
                root.current?.focus();
              }}
            />
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
          <p className="recorder-move">
            Pil venstre går tilbake, og «Velg lysark» (L) hopper til et hvilket som helst lysark.
            Opptaket går hele tiden: videoen viser lysarkene i den rekkefølgen du viser dem.
          </p>
          {canInteract(scene, project) && (
            <p className="recorder-press">
              Mens du leser inn, kan du trykke på lysarket: «+» åpner «Lær mer», og en video spilles
              når du trykker på den. Det kommer med i videoen på samme tidspunkt.
            </p>
          )}
          {settings.camera && cameraStream && (
            <p className="recorder-press">
              Dra kamerasirkelen dit den ikke dekker noe, også mens du leser inn. Den blir med i
              videoen, ikke i HTML-fila.
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
          <label
            className="check"
            title="Filmer ansiktet ditt mens du leser inn, og viser det i en sirkel i videoen."
          >
            <input
              type="checkbox"
              checked={settings.camera}
              disabled={active}
              onChange={(e) => setSettings({ ...settings, camera: e.target.checked })}
            />
            Kamera
          </label>
          {settings.camera && cameras.length > 1 && (
            <label>
              <span className="field-label">Hvilket kamera</span>
              <select
                value={settings.cameraId}
                disabled={active}
                onChange={(e) => setSettings({ ...settings, cameraId: e.target.value })}
              >
                <option value="">Systemets valg</option>
                {cameras
                  .filter((c) => c.deviceId && c.deviceId !== 'default')
                  .map((c) => (
                    <option key={c.deviceId} value={c.deviceId}>
                      {c.label}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {settings.camera && (
            <label>
              <span className="field-label">Kamerasirkel</span>
              <select
                value={settings.cameraSize}
                disabled={active}
                onChange={(e) =>
                  setSettings({ ...settings, cameraSize: e.target.value as CameraSize })
                }
              >
                {CAMERA_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {CAMERA_SIZE_NAMES[size]}
                  </option>
                ))}
              </select>
            </label>
          )}
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
                {keepBefore !== undefined && index === startIndex
                  ? 'Start opptak herfra'
                  : 'Start opptak'}
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
                disabled={!canMove || (stepsShown <= 0 && firstSlide)}
                onClick={back}
              >
                {stepsShown > 0 ? '← Forrige steg' : '← Forrige lysark'}
              </button>
              <button
                type="button"
                disabled={!canMove || (stepsLeft <= 0 && lastSlide)}
                onClick={advance}
              >
                {stepsLeft > 0 ? 'Neste steg →' : 'Neste lysark →'}
              </button>
              <button
                type="button"
                className="strong big"
                disabled={phase === 'countdown'}
                onClick={() => close(true)}
              >
                Ferdig
              </button>
            </>
          )}
        </div>
      </footer>

      {micError ? (
        <p className="recorder-note recorder-error" role="alert">
          {micError}
        </p>
      ) : cameraError && settings.camera ? (
        <p className="recorder-note recorder-error" role="alert">
          {cameraError} Du kan lese inn uten kamera.
        </p>
      ) : (
        <p className="recorder-note" role={pressNote ? 'status' : undefined}>
          {pressNote
            ? pressNote
            : phase === 'setup'
              ? keepBefore !== undefined && index === startIndex
                ? `Lyden fram til ${formatTime(keepBefore)} beholdes. Det du leser inn nå, kommer etter. Si noe og se at nivået rører seg før du starter.`
                : 'Si noe og se at nivået rører seg før du starter. Lysark som har lyd fra før, får den nye i stedet; det kan angres.'
              : read.size > 0
                ? read.size === 1
                  ? '1 lysark er lest inn så langt.'
                  : `${read.size} lysark er lest inn så langt.`
                : 'Gå fram og tilbake som du vil. Opptaket stanser ikke når du bytter lysark.'}
        </p>
      )}
    </div>
  );
}
