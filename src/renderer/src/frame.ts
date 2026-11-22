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
  /** Draws the lecture as it is `time` seconds in, and resolves when it is on screen. */
  draw(time: number): Promise<void>;
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

/** Waits until the pictures (and the first picture of each video) of a slide can be drawn. */
async function settle(el: HTMLElement): Promise<void> {
  const waits: Array<Promise<unknown>> = [];
  for (const img of Array.from(el.querySelectorAll('img'))) {
    waits.push(img.decode().catch(() => undefined));
  }
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
  await Promise.race([Promise.all(waits), timeout(8000)]);
}

async function sceneElement(index: number): Promise<HTMLElement> {
  let el = rendered.get(index);
  if (!el) {
    el = renderScene(context!, job!.scenes[index]!);
    rendered.set(index, el);
  }
  return el;
}

async function place(layer: HTMLElement, index: number, t: number, opacity: number): Promise<void> {
  const el = await sceneElement(index);
  if (layer.firstElementChild !== el) layer.replaceChildren(el);
  if (!ready.has(index)) {
    await settle(el);
    ready.add(index);
  }
  applySceneState(el, sceneStateAt(job!.scenes[index]!, t));
  layer.style.opacity = String(opacity);
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
    if (!job || job.scenes.length === 0) return;
    const state = frameAt(plan, time, job.transition);
    const scene = job.scenes[state.index]!;
    host.style.background = PALETTE[sceneSurface(context!.theme, scene)];
    if (state.fade) {
      const before = job.scenes[state.fade.from]!;
      await place(below, state.fade.from, sceneDuration(before), 1);
      await place(above, state.index, state.t, state.fade.progress);
    } else {
      below.replaceChildren();
      await place(above, state.index, state.t, 1);
    }
    await nextPaint();
  },
};
