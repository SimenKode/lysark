// The HTML player: shows one scene at a time, steps through its timeline,
// and offers contents, script, "Lær mer" panels, help, full screen and
// print. It has no dependencies beyond the shared render code.
import type { Element as SceneElement, Project, Scene } from '../shared/format/schema';
import { PALETTE } from '../shared/theme/palette';
import { getTheme, sceneSurface } from '../shared/theme/theme';
import {
  collectCredits,
  fitDrawings,
  placePopover,
  popoverWidth,
  renderCredit,
  renderMore,
} from '../shared/render/more';
import {
  SCENE_STRINGS,
  activateWebFrames,
  moreOf,
  moreTitle,
  renderScene,
  type RenderContext,
} from '../shared/render/scene';
import {
  hasSound,
  moreAt,
  sceneDuration,
  sceneStateAt,
  stepTimes,
  stepsShownAt,
  stepsShownBefore,
  videosAt,
} from '../shared/render/clock';
import { chapters, ownIndex, slideCount, slideNumbers, slideSpan } from '../shared/layout/slides';
import { applySceneState, sceneState, stepDuration } from '../shared/render/timeline';
import { PLAYER_STRINGS } from './strings';

/** How the player finds the bytes of an asset. */
export interface PlayerAssetRef {
  mime: string;
  /** Base64 in <script id="ls-asset-ID" type="application/base64">. */
  inline?: true;
  /** A file next to the HTML file (large videos). */
  href?: string;
}

/** Where the exported file keeps the brand's closing animation (base64). */
export const CLOSING_SCRIPT_ID = 'ls-brand-closing';

export interface PlayerData {
  project: Project;
  assets: Record<string, PlayerAssetRef>;
  logo: { light?: string; dark?: string };
  /** The brand's closing animation lies in the file, with this type. */
  closing?: { mime: string };
}

type Attrs = Record<string, string | boolean | undefined>;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'hidden') el.hidden = true;
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children);
  return el;
}

function decodeBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function createAssetStore(data: PlayerData): (id: string) => string | undefined {
  const cache = new Map<string, string | undefined>();
  return (id) => {
    if (cache.has(id)) return cache.get(id);
    const ref = data.assets[id];
    let url: string | undefined;
    if (ref?.href) {
      url = ref.href;
    } else if (ref?.inline) {
      const holder = document.getElementById(`ls-asset-${id}`);
      if (holder?.textContent) {
        url = URL.createObjectURL(new Blob([decodeBase64(holder.textContent)], { type: ref.mime }));
      }
    }
    cache.set(id, url);
    return url;
  };
}

export function mountPlayer(root: HTMLElement, data: PlayerData): void {
  const { project } = data;
  const scenes = project.scenes;
  const lang = project.meta.language;
  const t = PLAYER_STRINGS[lang];
  const theme = getTheme(project);
  const assetUrl = createAssetStore(data);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const hasScript = project.export.showScript && scenes.some((s) => s.script.trim() !== '');
  /** The lecture carries the lecturer's voice and can play itself. */
  const hasVoice = scenes.some(hasSound);

  document.documentElement.lang = lang;
  document.title = project.meta.title;

  const ctx: RenderContext = {
    doc: document,
    project,
    theme,
    mode: 'play',
    assetUrl,
    logo: data.logo,
    strings: SCENE_STRINGS[lang],
    closing: closingFilm(),
  };

  /** The address of the closing animation that lies in the file, if it does. */
  function closingFilm(): string | undefined {
    const holder = data.closing ? document.getElementById(CLOSING_SCRIPT_ID) : null;
    if (!data.closing || !holder?.textContent) return undefined;
    return URL.createObjectURL(
      new Blob([decodeBase64(holder.textContent)], { type: data.closing.mime }),
    );
  }

  // A slide that is shown once more in the recording is played by "Spill
  // av", where the lecturer went back to it. It is not a slide of its own:
  // it has the number of the slide it shows, and nobody goes to it by hand.
  const numbers = slideNumbers(scenes);
  const slides = slideCount(scenes);
  const sceneTitle = (scene: Scene, index: number): string =>
    scene.title.trim() || t.untitled(numbers[index] ?? index + 1);
  /** The slide after or before a scene, repeats not counted; -1 when there is none. */
  const neighbour = (from: number, direction: 1 | -1): number => {
    for (let at = from + direction; at >= 0 && at < scenes.length; at += direction) {
      if (!scenes[at]!.repeat) return at;
    }
    return -1;
  };

  // ---------- State ----------
  let index = 0;
  let stepsShown = 0;
  let frame = 0;
  let moreOpener: HTMLElement | null = null;
  /** Videos the voice has started, so they can be stopped with it. */
  const voiceVideos = new Set<HTMLVideoElement>();
  /** When (on the slide) the box the student put away during "Spill av" was opened. */
  let dismissedBox: number | null = null;
  /** The slide that is on screen, to know which way a change goes. */
  let shownIndex = 0;
  const rendered = new Map<string, HTMLElement>();
  /** "Spill av": the voice plays, and steps and slides follow it. */
  let playing = false;
  let playFrame = 0;
  /** For a slide without sound: when its time started, by the page's clock. */
  let silentStart = 0;
  const voice = new Audio();
  // The voice itself also says when it has moved on. A window that is not in
  // front draws seldom, and steps, boxes and videos must still follow.
  voice.addEventListener('timeupdate', () => void catchUp());
  voice.addEventListener('ended', () => void catchUp());
  voice.preload = 'auto';

  // ---------- Structure ----------
  const stage = h('div', { class: 'lp-stage' });
  const stageBox = h('div', { class: 'lp-stagebox' }, stage);
  const viewport = h(
    'main',
    { class: 'lp-viewport', tabindex: '-1', 'aria-label': t.stage },
    stageBox,
  );

  // The large round arrows, one on each side of the slide.
  const navButton = (direction: 'prev' | 'next', label: string): HTMLButtonElement => {
    const button = h('button', {
      class: `lp-nav lp-nav-${direction}`,
      type: 'button',
      'aria-label': label,
      title: label,
    });
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', direction === 'prev' ? 'M15 4 7 12l8 8' : 'm9 4 8 8-8 8');
    icon.appendChild(path);
    button.appendChild(icon);
    return button;
  };
  const prevButton = navButton('prev', t.previous);
  const nextButton = navButton('next', t.next);

  const scriptText = h('div', { class: 'lp-script-text' });
  const scriptPanel = h(
    'section',
    { class: 'lp-script', hidden: true, tabindex: '-1', 'aria-label': t.script },
    h('h2', {}, t.script),
    scriptText,
  );

  const tocList = h('ol');
  const toc = h(
    'nav',
    { class: 'lp-toc', hidden: true, 'aria-label': t.contents },
    h('h2', {}, t.contents),
    tocList,
  );
  /** One button for every slide; none for a slide that is shown once more. */
  const tocButtons: Array<HTMLButtonElement | null> = scenes.map(() => null);
  const tocParts = chapters(scenes);
  for (const part of tocParts.length > 0
    ? tocParts
    : [{ name: '', first: 0, last: scenes.length - 1 }]) {
    // Each chapter is a heading with its slides under it.
    let list = tocList;
    if (tocParts.length > 0) {
      list = h('ol');
      tocList.appendChild(
        h(
          'li',
          { class: 'lp-toc-chapter' },
          part.name.trim() ? h('h3', {}, part.name) : h('span', {}),
          list,
        ),
      );
    }
    for (let i = part.first; i <= part.last; i++) {
      const scene = scenes[i]!;
      if (scene.repeat) continue;
      const button = h(
        'button',
        { class: 'lp-toc-item', type: 'button' },
        h('span', { class: 'lp-toc-num' }, `${numbers[i]}`),
        h('span', {}, sceneTitle(scene, i)),
      );
      button.addEventListener('click', () => {
        show(i, 0, false);
        if (window.matchMedia('(max-width: 900px)').matches) toggleToc(false);
      });
      list.appendChild(h('li', {}, button));
      tocButtons[i] = button;
    }
  }

  const panelTitle = h('h2', { id: 'lp-panel-title', tabindex: '-1' });
  const panelClose = h('button', { class: 'lp-btn lp-btn-light', type: 'button' }, t.close);
  const panelWiden = h(
    'button',
    { class: 'lp-btn lp-btn-light', type: 'button', 'aria-pressed': 'false' },
    t.widen,
  );
  const panelBody = h('div', { class: 'lp-panel-body' });
  const panel = h(
    'aside',
    {
      class: 'lp-panel',
      hidden: true,
      // Focusable by a click, so that the scroll keys scroll it after one.
      tabindex: '-1',
      role: 'dialog',
      'aria-modal': 'false',
      'aria-labelledby': 'lp-panel-title',
    },
    h(
      'div',
      { class: 'lp-panel-head' },
      panelTitle,
      h('div', { class: 'lp-panel-tools' }, panelWiden, panelClose),
    ),
    panelBody,
  );

  const tocButton = h(
    'button',
    { class: 'lp-btn', type: 'button', 'aria-expanded': 'false' },
    t.contents,
  );
  const playButton = h(
    'button',
    { class: 'lp-btn lp-btn-strong lp-play', type: 'button', hidden: !hasVoice },
    t.play,
  );
  const counter = h('span', { class: 'lp-counter' });
  const progressFill = h('div');
  const progress = h(
    'div',
    {
      class: 'lp-progress',
      role: 'progressbar',
      'aria-label': t.progress,
      'aria-valuemin': '0',
      'aria-valuemax': '100',
    },
    progressFill,
  );
  const scriptButton = h(
    'button',
    { class: 'lp-btn', type: 'button', 'aria-pressed': 'false', hidden: !hasScript },
    t.script,
  );
  const credits = collectCredits(project);
  const creditsButton = h(
    'button',
    { class: 'lp-btn', type: 'button', hidden: credits.length === 0 },
    t.credits,
  );
  const helpButton = h('button', { class: 'lp-btn', type: 'button' }, t.help);
  const fullscreenButton = h(
    'button',
    { class: 'lp-btn', type: 'button', hidden: !document.fullscreenEnabled },
    t.fullscreen,
  );
  const bar = h(
    'footer',
    { class: 'lp-bar' },
    tocButton,
    playButton,
    counter,
    progress,
    scriptButton,
    creditsButton,
    helpButton,
    fullscreenButton,
  );

  const helpClose = h('button', { class: 'lp-btn lp-btn-light', type: 'button' }, t.close);
  const helpList = h('dl');
  for (const [keys, what] of [...t.keys, ...(hasVoice ? [t.playKey] : [])]) {
    helpList.append(h('dt', {}, keys), h('dd', {}, what));
  }
  const helpBox = h(
    'div',
    { class: 'lp-help', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lp-help-title' },
    h('h2', { id: 'lp-help-title', tabindex: '-1' }, t.helpTitle),
    helpList,
    h('p', {}, t.printNote),
    helpClose,
  );
  const help = h('div', { class: 'lp-help-back', hidden: true }, helpBox);

  // "Bildekilder": who made each picture, and on what terms it is used.
  const creditsClose = h('button', { class: 'lp-btn lp-btn-light', type: 'button' }, t.close);
  const creditsList = h('ul', { class: 'lp-credits-list' });
  for (const entry of credits) {
    creditsList.append(
      h(
        'li',
        {},
        renderCredit(document, entry.credit, ctx.strings, {
          cropped: entry.cropped,
          interactive: true,
        }),
        h('span', { class: 'lp-credits-where' }, t.usedOn(entry.scenes)),
      ),
    );
  }
  const creditsBox = h(
    'div',
    {
      class: 'lp-help lp-credits',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'lp-credits-title',
    },
    h('h2', { id: 'lp-credits-title', tabindex: '-1' }, t.credits),
    creditsList,
    creditsClose,
  );
  const creditsBack = h('div', { class: 'lp-help-back', hidden: true }, creditsBox);

  const live = h('div', { class: 'lp-sr', 'aria-live': 'polite' });
  const printArea = h('div', { class: 'lp-print' });

  root.className = 'lp-app';
  root.replaceChildren(
    h(
      'div',
      { class: 'lp-body' },
      toc,
      h(
        'div',
        { class: 'lp-center' },
        h('div', { class: 'lp-stagerow' }, prevButton, viewport, nextButton),
        scriptPanel,
      ),
      panel,
      help,
      creditsBack,
    ),
    bar,
    live,
    printArea,
  );

  // ---------- Rendering ----------
  function sceneElement(scene: Scene): HTMLElement {
    let el = rendered.get(scene.id);
    if (!el) {
      el = renderScene(ctx, scene);
      rendered.set(scene.id, el);
    }
    return el;
  }

  function fit(): void {
    const scale = Math.max(
      0.05,
      Math.min(viewport.clientWidth / 1920, viewport.clientHeight / 1080),
    );
    stageBox.style.width = `${1920 * scale}px`;
    stageBox.style.height = `${1080 * scale}px`;
    stage.style.transform = `scale(${scale})`;
    // The "+" mark is 56 px on the stage; on screen it never gets smaller than 28 px.
    stage.style.setProperty('--ls-badge-scale', String(Math.max(1, 28 / (56 * scale))));
    placePanel();
  }

  /**
   * Puts the "Lær mer" box beside the element it belongs to. The box lies on
   * top of the slide; the slide keeps its size and its place.
   */
  function placePanel(): void {
    if (panel.hidden || !moreOpener || panel.classList.contains('lp-panel-wide')) return;
    const body = panel.parentElement!.getBoundingClientRect();
    // The box keeps to the slide's own area, so the round arrows stay free.
    const area = viewport.getBoundingClientRect();
    const owner = moreOpener.closest<HTMLElement>('[data-el]') ?? moreOpener;
    const anchor = owner.getBoundingClientRect();
    const mark = moreOpener.getBoundingClientRect();
    const width = popoverWidth(
      { left: anchor.left - area.left, right: anchor.right - area.left },
      area.width,
    );
    panel.style.setProperty('--lp-pop-w', `${width}px`);
    panel.style.setProperty('--lp-pop-h', `${area.height - 32}px`);
    const place = placePopover(
      {
        left: anchor.left - area.left,
        top: anchor.top - area.top,
        right: anchor.right - area.left,
        bottom: anchor.bottom - area.top,
      },
      { x: mark.left + mark.width / 2 - area.left, y: mark.top + mark.height / 2 - area.top },
      { width: area.width, height: area.height },
      { width, height: Math.min(panel.offsetHeight, area.height - 32) },
    );
    panel.style.setProperty('--lp-pop-x', `${place.left + area.left - body.left}px`);
    panel.style.setProperty('--lp-pop-y', `${place.top + area.top - body.top}px`);
    panel.style.transformOrigin = `${place.originX}px ${place.originY}px`;
  }

  function animateStep(scene: Scene, el: HTMLElement): void {
    cancelAnimationFrame(frame);
    const step = scene.timeline[stepsShown - 1];
    const total = step ? stepDuration(step) : 0;
    if (!step || reducedMotion || total <= 0) {
      applySceneState(el, sceneState(scene, stepsShown, Infinity));
      return;
    }
    const start = performance.now();
    const tick = (now: number): void => {
      const elapsed = (now - start) / 1000;
      applySceneState(el, sceneState(scene, stepsShown, elapsed));
      if (elapsed < total) frame = requestAnimationFrame(tick);
    };
    applySceneState(el, sceneState(scene, stepsShown, 0));
    frame = requestAnimationFrame(tick);
  }

  function show(newIndex: number, newSteps: number, animate: boolean): void {
    if (scenes.length === 0) return;
    const previous = scenes[index];
    index = Math.max(0, Math.min(scenes.length - 1, newIndex));
    const scene = scenes[index]!;
    stepsShown = Math.max(0, Math.min(scene.timeline.length, newSteps));
    const el = sceneElement(scene);
    const changed = stage.firstElementChild !== el;

    if (changed) {
      // The new slide glides in from the side one is going towards.
      el.classList.remove('lp-enter-next', 'lp-enter-prev');
      if (stage.firstElementChild) {
        el.classList.add(index >= shownIndex ? 'lp-enter-next' : 'lp-enter-prev');
      }
      shownIndex = index;
      if (previous) {
        for (const video of Array.from(stage.querySelectorAll('video'))) video.pause();
        // A scene where web content was fetched is drawn afresh next time,
        // so nothing plays on, or starts by itself, when the viewer returns.
        if (stage.querySelector('iframe')) rendered.delete(previous.id);
      }
      closeMore(false);
      dismissedBox = null;
      voiceVideos.clear();
      stage.replaceChildren(el);
      // A YouTube video the owner has put on the slide is fetched now, when
      // the slide is shown, and never before.
      activateWebFrames(el);
      // The closing animation starts by itself, from its beginning, once.
      // It has no sound, so the browser lets it. For those who have asked
      // for less motion, its last picture stands instead.
      const film = el.querySelector<HTMLVideoElement>('video.ls-closing');
      if (film) {
        if (reducedMotion) {
          const toEnd = (): void => {
            if (Number.isFinite(film.duration))
              film.currentTime = Math.max(0, film.duration - 0.05);
          };
          if (film.readyState >= 1) toEnd();
          else film.addEventListener('loadedmetadata', toEnd, { once: true });
        } else {
          film.currentTime = 0;
          void film.play().catch(() => undefined);
        }
      }
      viewport.style.background = PALETTE[sceneSurface(theme, scene)];
      viewport.setAttribute(
        'aria-label',
        t.announce(numbers[index]!, slides, sceneTitle(scene, index)),
      );
      live.textContent = t.announce(numbers[index]!, slides, sceneTitle(scene, index));
      scriptText.replaceChildren();
      const lines = scene.script.split(/\n+/).filter((line) => line.trim() !== '');
      if (lines.length === 0) scriptText.append(h('p', {}, t.noScript));
      for (const line of lines) scriptText.append(h('p', {}, line));
      scriptPanel.scrollTop = 0;
      const own = ownIndex(scenes, index);
      tocButtons.forEach((button, i) => {
        if (i === own) button?.setAttribute('aria-current', 'true');
        else button?.removeAttribute('aria-current');
      });
      try {
        history.replaceState(null, '', `#${numbers[index]}`);
      } catch {
        // Some embedding frames do not allow changing the address.
      }
    }

    if (playing) {
      // While the voice plays, going to a step or a slide by hand moves the voice there.
      cancelAnimationFrame(frame);
      startVoice(stepsShown > 0 ? (stepTimes(scene)[stepsShown - 1] ?? 0) : 0);
    } else if (animate) animateStep(scene, el);
    else {
      cancelAnimationFrame(frame);
      applySceneState(el, sceneState(scene, stepsShown, Infinity));
    }
    updateChrome();
  }

  function updateChrome(): void {
    const scene = scenes[index]!;
    counter.textContent = t.sceneOf(numbers[index]!, slides);
    const within = scene.timeline.length ? stepsShown / (scene.timeline.length + 1) : 0;
    const percent = Math.round(((index + within) / Math.max(1, scenes.length - 1)) * 100);
    const clamped = Math.max(0, Math.min(100, scenes.length === 1 ? 100 : percent));
    progressFill.style.width = `${clamped}%`;
    progress.setAttribute('aria-valuenow', String(clamped));
    prevButton.disabled = neighbour(index, -1) < 0 && stepsShown === 0;
    nextButton.disabled = neighbour(index, 1) < 0 && stepsShown === scene.timeline.length;
  }

  // ---------- "Spill av": the voice, with steps and slides at the recorded times ----------
  function voiceTime(scene: Scene): number {
    return hasSound(scene) ? voice.currentTime : (performance.now() - silentStart) / 1000;
  }

  /** Starts (or moves) the voice on the slide that is shown, `from` seconds in. */
  function startVoice(from: number): void {
    const scene = scenes[index]!;
    cancelAnimationFrame(playFrame);
    voice.pause();
    silentStart = performance.now() - from * 1000;
    const clip = scene.audio?.clips.find((c) => c.kind === 'sound');
    const url = clip && clip.kind === 'sound' ? assetUrl(clip.asset) : undefined;
    if (hasSound(scene) && url) {
      if (voice.dataset.scene !== scene.id) {
        voice.src = url;
        voice.dataset.scene = scene.id;
      }
      voice.currentTime = from;
      void voice.play().catch(() => setPlaying(false));
    }
    playFrame = requestAnimationFrame(followVoice);
  }

  /** The video of an element on the slide, or of a block in the open box. */
  function videoOf(key: string): HTMLVideoElement | null {
    const [element, block] = key.split('/');
    if (block === undefined) {
      return stage.querySelector<HTMLVideoElement>(`[data-el="${element}"] video:not(.ls-closing)`);
    }
    if (panel.hidden || moreOpener?.dataset.more !== element) return null;
    return panelBody.querySelector<HTMLVideoElement>(`[data-block="${block}"] video`);
  }

  /**
   * While the voice plays, the slide does what the lecturer did when it was
   * read in: the "Lær mer" box is opened and put away, and videos start and
   * stop, at the same times.
   */
  function followEvents(scene: Scene, now: number): void {
    if (!scene.events?.length) return;
    const open = moreAt(scene, now);
    // A box the student has put away stays away until the lecturer opens the next one.
    if (open && dismissedBox !== null && Math.abs(now - open.since - dismissedBox) < 0.01) {
      // Nothing to do: it was opened at this time, and the student closed it.
    } else if (open) {
      dismissedBox = null;
      if (panel.hidden || moreOpener?.dataset.more !== open.element) {
        const element = scene.elements.find((e) => e.id === open.element);
        const opener = stage.querySelector<HTMLElement>(`[data-more="${open.element}"]`);
        if (element && opener) openMore(element, opener, true);
      }
    } else if (!panel.hidden) {
      closeMore(false, true);
    }
    for (const [key, state] of videosAt(scene, now)) {
      const video = videoOf(key);
      if (!video || video.readyState < 1) continue;
      if (state.playing) {
        // A video that has come out of step with the voice is moved to where it should be.
        if (video.paused || Math.abs(video.currentTime - state.time) > 0.4) {
          video.currentTime = state.time;
        }
        if (video.paused) {
          voiceVideos.add(video);
          void video.play().catch(() => undefined);
        }
      } else if (voiceVideos.has(video)) {
        if (!video.paused) video.pause();
        if (Math.abs(video.currentTime - state.time) > 0.4) video.currentTime = state.time;
        voiceVideos.delete(video);
      }
    }
  }

  /** Stops the videos the voice started. */
  function stopVoiceVideos(): void {
    for (const video of voiceVideos) video.pause();
    voiceVideos.clear();
  }

  /**
   * Brings the slide to where the voice is: steps, boxes and videos, and the
   * next slide when the voice has finished. Returns false when the lecture
   * went on to another slide or stopped.
   */
  function catchUp(): boolean {
    if (!playing) return false;
    const scene = scenes[index]!;
    const el = sceneElement(scene);
    const now = voiceTime(scene);
    const duration = sceneDuration(scene);
    const done = hasSound(scene) ? voice.ended || now >= duration : now >= duration;
    if (done) {
      if (index < scenes.length - 1) {
        // Goes on with the voice of the next slide. Where the lecturer came
        // back to a slide, the steps that were there are there from the start.
        show(index + 1, stepsShownBefore(scenes[index + 1]!), false);
      } else {
        stepsShown = scene.timeline.length;
        applySceneState(el, sceneState(scene, stepsShown, Infinity));
        updateChrome();
        setPlaying(false);
      }
      return false;
    }
    applySceneState(el, sceneStateAt(scene, now));
    followEvents(scene, now);
    const shown = stepsShownAt(scene, now);
    if (shown !== stepsShown) {
      stepsShown = shown;
      updateChrome();
    }
    return true;
  }

  function followVoice(): void {
    if (catchUp()) playFrame = requestAnimationFrame(followVoice);
  }

  function setPlaying(on: boolean): void {
    if (!hasVoice || on === playing) return;
    playing = on;
    playButton.textContent = on ? t.pause : t.play;
    playButton.setAttribute('aria-pressed', String(on));
    const scene = scenes[index]!;
    if (on) {
      cancelAnimationFrame(frame);
      const times = stepTimes(scene);
      // Go on from the step that is shown; a finished slide starts again.
      const atEnd = stepsShown >= scene.timeline.length && scene.timeline.length > 0;
      startVoice(stepsShown > 0 && !atEnd ? (times[stepsShown - 1] ?? 0) : 0);
    } else {
      cancelAnimationFrame(playFrame);
      voice.pause();
      stopVoiceVideos();
      // What has come in stays; the rest waits for the keys again.
      applySceneState(sceneElement(scene), sceneState(scene, stepsShown, Infinity));
    }
  }

  function next(): void {
    const scene = scenes[index];
    if (!scene) return;
    // By hand one goes from slide to slide; only "Spill av" shows a slide once more.
    const to = neighbour(index, 1);
    if (stepsShown < scene.timeline.length) show(index, stepsShown + 1, true);
    else if (to >= 0) show(to, 0, false);
  }

  function previous(): void {
    const to = neighbour(index, -1);
    if (stepsShown > 0) show(index, stepsShown - 1, false);
    else if (to >= 0) show(to, scenes[to]!.timeline.length, false);
  }

  // ---------- Panels ----------
  function toggleToc(open?: boolean): void {
    const willOpen = open ?? toc.hidden;
    toc.hidden = !willOpen;
    tocButton.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) tocButtons[index]?.focus();
    fit();
  }

  function toggleScript(open?: boolean): void {
    if (!hasScript) return;
    const willOpen = open ?? scriptPanel.hidden;
    scriptPanel.hidden = !willOpen;
    scriptButton.setAttribute('aria-pressed', String(willOpen));
    fit();
  }

  function toggleHelp(open?: boolean): void {
    const willOpen = open ?? help.hidden;
    help.hidden = !willOpen;
    if (willOpen) helpBox.querySelector<HTMLElement>('h2')?.focus();
    else helpButton.focus();
  }

  function toggleCredits(open?: boolean): void {
    const willOpen = open ?? creditsBack.hidden;
    creditsBack.hidden = !willOpen;
    if (willOpen) creditsBox.querySelector<HTMLElement>('h2')?.focus();
    else creditsButton.focus();
  }

  function setPanelWide(wide: boolean): void {
    panel.classList.toggle('lp-panel-wide', wide);
    panelWiden.setAttribute('aria-pressed', String(wide));
    panelWiden.textContent = wide ? t.narrow : t.widen;
    fit();
  }

  /**
   * Opens the "Lær mer" panel of an element. `opener` gets the focus back
   * when it closes. `byVoice`: the lecturer opened it while reading the
   * slide in, and the voice goes on.
   */
  function openMore(element: SceneElement, opener: HTMLElement, byVoice = false): void {
    const more = moreOf(element);
    if (!more) return;
    if (!byVoice) setPlaying(false); // the voice waits while the student reads more
    if (moreOpener && moreOpener !== opener) moreOpener.setAttribute('aria-expanded', 'false');
    moreOpener = opener;
    panelTitle.textContent = moreTitle(ctx, element);
    panelBody.replaceChildren(renderMore(ctx, more));
    activateWebFrames(panelBody);
    panel.hidden = false;
    panel.scrollTop = 0;
    opener.setAttribute('aria-expanded', 'true');
    placePanel();
    fitDrawings(panelBody);
    // The box pops out of the mark each time it is opened.
    panel.classList.remove('lp-pop-in');
    void panel.offsetWidth;
    panel.classList.add('lp-pop-in');
    if (!byVoice) panelTitle.focus({ preventScroll: true });
  }

  function closeMore(restoreFocus: boolean, byVoice = false): void {
    if (panel.hidden) return;
    if (playing && !byVoice) {
      // The student put away a box the voice had opened: it is not opened again by itself.
      const scene = scenes[index];
      const open = scene ? moreAt(scene, voiceTime(scene)) : undefined;
      if (scene && open) dismissedBox = voiceTime(scene) - open.since;
    }
    for (const video of Array.from(panel.querySelectorAll('video'))) video.pause();
    panel.hidden = true;
    // Removing the content also stops anything fetched from the web.
    panelBody.replaceChildren();
    setPanelWide(false);
    moreOpener?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) moreOpener?.focus();
    moreOpener = null;
  }

  function toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  }

  // ---------- Events ----------
  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const sceneLink = target.closest<HTMLElement>('a[data-scene]');
    if (sceneLink) {
      event.preventDefault();
      const to = scenes.findIndex((s) => s.id === sceneLink.dataset.scene);
      if (to >= 0) show(to, 0, false);
      return;
    }
    // The "+" mark and the "Lær mer" button open the panel; so does a click
    // anywhere else on an element that has a mark, unless the click was on
    // something that does a job of its own (a link, a player).
    let opener = target.closest<HTMLElement>('[data-more]');
    if (!opener && stage.contains(target) && !target.closest('a, button, video, audio, iframe')) {
      if (!window.getSelection()?.toString()) {
        opener =
          target.closest<HTMLElement>('.ls-has-more')?.querySelector<HTMLElement>('[data-more]') ??
          null;
      }
    }
    if (opener) {
      const element = scenes[index]?.elements.find((e) => e.id === opener.dataset.more);
      if (element) {
        if (!panel.hidden && moreOpener === opener) closeMore(true);
        else openMore(element, opener);
      }
    } else if (!panel.hidden && !panel.contains(target) && viewport.contains(target)) {
      // A click on the slide beside the box puts the box away.
      closeMore(false);
    }
    // A click on the slide itself does nothing: slides hold things to click
    // on. The arrows, the keyboard and a swipe go on.
  });

  tocButton.addEventListener('click', () => toggleToc());
  playButton.addEventListener('click', () => setPlaying(!playing));
  prevButton.addEventListener('click', previous);
  nextButton.addEventListener('click', next);
  scriptButton.addEventListener('click', () => toggleScript());
  helpButton.addEventListener('click', () => toggleHelp());
  helpClose.addEventListener('click', () => toggleHelp(false));
  help.addEventListener('click', (event) => {
    if (event.target === help) toggleHelp(false);
  });
  panelClose.addEventListener('click', () => closeMore(true));
  panelWiden.addEventListener('click', () =>
    setPanelWide(!panel.classList.contains('lp-panel-wide')),
  );
  creditsButton.addEventListener('click', () => toggleCredits());
  creditsClose.addEventListener('click', () => toggleCredits(false));
  creditsBack.addEventListener('click', (event) => {
    if (event.target === creditsBack) toggleCredits(false);
  });
  fullscreenButton.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    fullscreenButton.textContent = document.fullscreenElement ? t.exitFullscreen : t.fullscreen;
  });

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement;
    const tag = target.tagName;
    if (event.key === 'Escape') {
      if (!help.hidden) toggleHelp(false);
      else if (!creditsBack.hidden) toggleCredits(false);
      else if (!panel.hidden) closeMore(true);
      else if (!toc.hidden) {
        toggleToc(false);
        tocButton.focus();
      } else if (!scriptPanel.hidden) toggleScript(false);
      return;
    }
    if (!help.hidden || !creditsBack.hidden) return;
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      tag === 'VIDEO' ||
      tag === 'AUDIO'
    ) {
      return;
    }
    const onControl = tag === 'BUTTON' || tag === 'A';
    // The keys that scroll (up, down, Page Up, Page Down, Home, End) scroll a
    // panel when the focus is in one; elsewhere they navigate.
    const inScroller = target.closest('.lp-panel, .lp-toc, .lp-script') !== null;
    // In the contents list Home and End still mean the first and the last slide.
    const inReader = target.closest('.lp-panel, .lp-script') !== null;
    switch (event.key) {
      case 'ArrowDown':
        if (inScroller) return;
        next();
        break;
      case 'ArrowUp':
        if (inScroller) return;
        previous();
        break;
      case 'PageDown':
        if (inReader) return;
        next();
        break;
      case 'PageUp':
        if (inReader) return;
        previous();
        break;
      case 'ArrowRight':
        next();
        break;
      case 'ArrowLeft':
        previous();
        break;
      case ' ':
      case 'Enter':
        if (onControl) return; // let the button or link do its own thing
        next();
        break;
      case 'Home':
        if (inReader) return;
        show(0, 0, false);
        break;
      case 'End':
        if (inReader) return;
        show(Math.max(0, neighbour(scenes.length, -1)), 0, false);
        break;
      case 'i':
      case 'I':
        toggleToc();
        break;
      case 'm':
      case 'M':
        toggleScript();
        break;
      case 'p':
      case 'P':
        if (!hasVoice) return;
        setPlaying(!playing);
        break;
      case 'f':
      case 'F':
        if (document.fullscreenEnabled) toggleFullscreen();
        break;
      case '?':
        toggleHelp();
        break;
      default:
        return;
    }
    event.preventDefault();
  });

  // Swipe on touch screens.
  let touchStart: { x: number; y: number } | null = null;
  viewport.addEventListener(
    'touchstart',
    (event) => {
      const touch = event.touches[0];
      touchStart =
        touch && event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
    },
    { passive: true },
  );
  viewport.addEventListener(
    'touchend',
    (event) => {
      const touch = event.changedTouches[0];
      if (!touchStart || !touch) return;
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) {
        if (dx < 0) next();
        else previous();
      }
    },
    { passive: true },
  );

  // Print: every scene on its own page, with all steps shown.
  window.addEventListener('beforeprint', () => {
    if (printArea.childElementCount > 0) return;
    scenes.forEach((scene) => {
      // On paper each slide is there once.
      if (scene.repeat) return;
      const el = renderScene(ctx, scene);
      const page = h('div', { class: 'lp-print-page' }, h('div', { class: 'lp-print-scene' }, el));
      if (project.export.showScript && scene.script.trim()) {
        const script = h('div', { class: 'lp-print-script' });
        for (const line of scene.script.split(/\n+/)) {
          if (line.trim()) script.append(h('p', {}, line));
        }
        page.append(script);
      }
      printArea.append(page);
    });
  });

  new ResizeObserver(fit).observe(viewport);
  // The box grows when its pictures arrive; it is then put in place again.
  new ResizeObserver(placePanel).observe(panel);
  for (const node of [stage, root]) {
    node.addEventListener('animationend', (event) => {
      (event.target as HTMLElement).classList?.remove('lp-enter-next', 'lp-enter-prev');
    });
  }
  fit();

  // The address carries the number of a slide, as the viewer counts them.
  const fromHash = parseInt(location.hash.replace('#', ''), 10);
  const span = Number.isFinite(fromHash) ? slideSpan(scenes, fromHash, fromHash) : undefined;
  show(span ? span[0] : 0, 0, false);
}
