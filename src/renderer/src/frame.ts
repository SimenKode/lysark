// Draws the lecture as it looks at one moment, for the video export. The
// main process loads this page in a window that is never shown, tells it
// which moment to draw, and takes a picture of the result. The picture is
// a pure function of (project, theme, time): the same render code as the
// editor and the HTML player, driven by the shared clock.
import { hasLogo, logoUrl, mediaUrl, type LogoStatus } from '../../shared/api';
import type { Project, Scene } from '../../shared/format/schema';
import {
  VIDEO_SIZE,
  frameAt,
  sceneDuration,
  sceneStateAt,
  schedule,
  type Schedule,
} from '../../shared/render/clock';
import { STAGE_CSS } from '../../shared/render/css';
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
html, body { margin: 0; overflow: hidden; background: #000; }
#frame { position: relative; width: ${VIDEO_SIZE.width}px; height: ${VIDEO_SIZE.height}px; overflow: hidden; }
#frame > .layer { position: absolute; inset: 0; }
/* A video cannot open a panel: no "+" marks and no "Lær mer" buttons. */
.ls-more-badge, .ls-el-deepdive { display: none !important; }
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
    el = renderScene(context!, job!.scenes[index]!);
    rendered.set(index, el);
  }
  return el;
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
    await settle(el);
    ready.add(index);
    return true;
  }
  applySceneState(el, sceneStateAt(job!.scenes[index]!, t));
  layer.style.opacity = String(opacity);
  return false;
}

window.lysarkFrame = {
  async load(next) {
    job = next;
    plan = schedule(next.scenes);
    rendered.clear();
    ready.clear();
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
