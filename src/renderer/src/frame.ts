// Draws the lecture as it looks at one moment, for the video export. The
// main process loads this page in a window that is never shown, tells it
// which moment to draw, and takes a picture of the result. The picture is
// a pure function of (project, theme, time): the same render code as the
// editor and the HTML player, driven by the shared clock.
import { closingUrl, hasLogo, logoUrl, mediaUrl, type LogoStatus } from '../../shared/api';
import type { Project, Scene } from '../../shared/format/schema';
import {
  VIDEO_SIZE,
  frameAt,
  moreAt,
  popProgress,
  sceneDuration,
  sceneEvents,
  sceneStateAt,
  schedule,
  videoKey,
  videosAt,
  type Schedule,
} from '../../shared/render/clock';
import { MORE_CSS, POPOVER_CSS, STAGE_CSS } from '../../shared/render/css';
import { createPopover, type SlidePopover } from '../../shared/render/popover';
import { SCENE_STRINGS, renderScene, type RenderContext } from '../../shared/render/scene';
import { applySceneState } from '../../shared/render/timeline';
import { PALETTE } from '../../shared/theme/palette';
import { getTheme, sceneSurface } from '../../shared/theme/theme';
import './fonts.css';

export interface FrameJob {
  project: Project;
  /** The slides of the video, in order: the project's, and credits slides when asked for. */
  scenes: Scene[];
  logo: LogoStatus;
  transition: 'cut' | 'fade';
}

interface FrameApi {
  load(job: FrameJob): Promise<void>;
  /**
   * Draws the lecture as it is `time` seconds in, and resolves when it is
   * on screen. Resolves with true when a slide was drawn for the first
   * time: it is then shown with everything on it visible, so that all its
   * pictures are brought in, and the caller must wait for the drawing to
   * settle and call again to get the moment it asked for.
   */
  draw(time: number): Promise<boolean>;
}

declare global {
  interface Window {
    lysarkFrame: FrameApi;
  }
}

const style = document.createElement('style');
style.textContent = `${STAGE_CSS}
${MORE_CSS}
${POPOVER_CSS}
html, body { margin: 0; overflow: hidden; background: #000; }
#frame { position: relative; width: ${VIDEO_SIZE.width}px; height: ${VIDEO_SIZE.height}px; overflow: hidden; }
#frame > .layer { position: absolute; inset: 0; }
/* Nobody can open a panel in a video: no "+" marks, no rings and no "Lær mer"
   buttons, except on what the lecturer opened while reading the slide in. */
[data-el]:not(.ls-more-live) > .ls-more-badge, .ls-el-deepdive:not(.ls-more-live) { display: none !important; }
/* A mark on a picture is part of the slide and stays; only its "+" goes. */
[data-el]:not(.ls-more-live) > .ls-mark-more::after { display: none !important; }
.ls-more-ring:not(.ls-more-live) > .ls-image { outline: none !important; }
/* The box shows what fits; nothing in a video can be scrolled. */
.ls-pop { overflow: hidden; }
`;
document.head.appendChild(style);

const host = document.getElementById('frame')!;
const below = document.createElement('div');
const above = document.createElement('div');
below.className = 'layer';
above.className = 'layer';
host.append(below, above);

let job: FrameJob | null = null;
let plan: Schedule = { entries: [], total: 0 };
let context: RenderContext | null = null;
const rendered = new Map<number, HTMLElement>();
const ready = new Set<number>();
/** The "Lær mer" boxes that are opened on each slide, by the element they belong to. */
const boxes = new Map<number, Map<string, SlidePopover>>();

function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolves when an image has been fetched (or cannot be) and is ready to be drawn. */
async function imageReady(img: HTMLImageElement): Promise<void> {
  if (!img.complete) {
    await new Promise<void>((resolve) => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    });
  }
  await img.decode().catch(() => undefined);
}

/** Waits until the pictures (and the first picture of each video) of a slide can be drawn. */
async function settle(el: HTMLElement): Promise<void> {
  const waits: Array<Promise<unknown>> = [];
  for (const img of Array.from(el.querySelectorAll('img'))) waits.push(imageReady(img));
  for (const video of Array.from(el.querySelectorAll('video'))) {
    video.muted = true;
    video.preload = 'auto';
    if (video.readyState < 2) {
      waits.push(
        new Promise<void>((resolve) => {
          video.addEventListener('loadeddata', () => resolve(), { once: true });
          video.addEventListener('error', () => resolve(), { once: true });
        }),
      );
    }
  }
  await Promise.race([Promise.all(waits), timeout(20_000)]);
}

async function sceneElement(index: number): Promise<HTMLElement> {
  let el = rendered.get(index);
  if (!el) {
    const scene = job!.scenes[index]!;
    el = renderScene(context!, scene);
    rendered.set(index, el);
    // Every box the lecturer opened on this slide is built now, so its
    // pictures are in place when it pops out.
    const made = new Map<string, SlidePopover>();
    for (const event of sceneEvents(scene)) {
      if (event.kind !== 'more-open' || made.has(event.element)) continue;
      const element = scene.elements.find((e) => e.id === event.element);
      const box = element && createPopover(context!, element);
      if (!box) continue;
      el.appendChild(box.layer);
      made.set(event.element, box);
      el.querySelector(`[data-el="${event.element}"]`)?.classList.add('ls-more-live');
    }
    boxes.set(index, made);
  }
  return el;
}

/** Shows the box that is open at `t`, as far out as it has popped, and hides the others. */
function showBoxes(index: number, t: number | null): void {
  const open = t === null ? undefined : moreAt(job!.scenes[index]!, t);
  for (const [element, box] of boxes.get(index) ?? []) {
    const shown = t === null || open?.element === element;
    box.layer.style.display = shown ? '' : 'none';
    if (!shown) continue;
    box.place();
    box.setProgress(open ? popProgress(open.since) : 1);
  }
}

/** The video of an element on the slide, or of a block in its box. */
function videoOf(el: HTMLElement, key: string): HTMLVideoElement | null {
  const [element, block] = key.split('/');
  if (block === undefined) {
    return el.querySelector<HTMLVideoElement>(`[data-el="${element}"] video:not(.ls-closing)`);
  }
  return el.querySelector<HTMLVideoElement>(
    `.ls-pop[data-pop-for="${element}"] [data-block="${block}"] video`,
  );
}

async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  if (!Number.isFinite(video.duration)) return;
  const target = Math.max(0, Math.min(video.duration - 0.001, time));
  if (Math.abs(video.currentTime - target) < 0.001) return;
  await Promise.race([
    new Promise<void>((resolve) => {
      video.addEventListener('seeked', () => resolve(), { once: true });
      video.currentTime = target;
    }),
    timeout(4000),
  ]);
}

/** Shows every film that was played on the slide at the picture it had reached at `t`. */
async function seekVideos(el: HTMLElement, index: number, t: number): Promise<void> {
  const scene = job!.scenes[index]!;
  if (!scene.events?.length) return;
  for (const [key, state] of videosAt(scene, t)) {
    const video = videoOf(el, key);
    if (video) await seekVideo(video, state.time);
  }
}

/** Puts a slide in a layer. Returns true when the slide was drawn for the first time. */
async function place(
  layer: HTMLElement,
  index: number,
  t: number,
  opacity: number,
): Promise<boolean> {
  const el = await sceneElement(index);
  if (layer.firstElementChild !== el) layer.replaceChildren(el);
  if (!ready.has(index)) {
    // The first time, everything on the slide is shown, also what a later
    // step brings in: a picture that is first drawn in the middle of a fade
    // would otherwise be missing from the first frames it should be in.
    applySceneState(el, new Map());
    layer.style.opacity = '1';
    showBoxes(index, null);
    await settle(el);
    ready.add(index);
    return true;
  }
  applySceneState(el, sceneStateAt(job!.scenes[index]!, t));
  layer.style.opacity = String(opacity);
  showBoxes(index, t);
  await seekFilm(el, t);
  await seekVideos(el, index, t);
  return false;
}

/** Shows the picture of the closing animation that belongs to time `t` on its slide. */
async function seekFilm(el: HTMLElement, t: number): Promise<void> {
  const film = el.querySelector<HTMLVideoElement>('video.ls-closing');
  if (film) await seekVideo(film, t);
}

window.lysarkFrame = {
  async load(next) {
    job = next;
    plan = schedule(next.scenes);
    rendered.clear();
    ready.clear();
    boxes.clear();
    below.replaceChildren();
    above.replaceChildren();
    const { project, logo } = next;
    const language = project.meta.language;
    context = {
      doc: document,
      project,
      theme: getTheme(project),
      // Nothing in a video can be activated, and nothing is fetched from the web.
      mode: 'edit',
      assetUrl: (id) => {
        const asset = project.assets[id];
        return asset ? mediaUrl(asset.file) : undefined;
      },
      logo: {
        light: hasLogo(logo, language, 'light')
          ? logoUrl(language, 'light', logo.version)
          : undefined,
        dark: hasLogo(logo, language, 'dark') ? logoUrl(language, 'dark', logo.version) : undefined,
      },
      strings: SCENE_STRINGS[language],
      closing: logo.closing ? closingUrl(logo.version) : undefined,
    };
    await document.fonts.ready;
  },

  async draw(time) {
    if (!job || job.scenes.length === 0) return false;
    const state = frameAt(plan, time, job.transition);
    const scene = job.scenes[state.index]!;
    host.style.background = PALETTE[sceneSurface(context!.theme, scene)];
    let fresh = false;
    if (state.fade) {
      const before = job.scenes[state.fade.from]!;
      fresh = await place(below, state.fade.from, sceneDuration(before), 1);
      fresh = (await place(above, state.index, state.t, state.fade.progress)) || fresh;
    } else {
      below.replaceChildren();
      fresh = await place(above, state.index, state.t, 1);
    }
    await nextPaint();
    return fresh;
  },
};
