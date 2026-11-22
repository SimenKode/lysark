// The HTML player: shows one scene at a time, steps through its timeline,
// and offers contents, script, "Lær mer" panels, help, full screen and
// print. It has no dependencies beyond the shared render code.
import type { Element as SceneElement, Project, Scene } from '../shared/format/schema';
import { PALETTE } from '../shared/theme/palette';
import { getTheme, sceneSurface } from '../shared/theme/theme';
import { collectCredits, renderCredit, renderMore } from '../shared/render/more';
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
  sceneDuration,
  sceneStateAt,
  stepTimes,
  stepsShownAt,
} from '../shared/render/clock';
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

export interface PlayerData {
  project: Project;
  assets: Record<string, PlayerAssetRef>;
  logo: { light?: string; dark?: string };
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
  };

  const sceneTitle = (scene: Scene, index: number): string =>
    scene.title.trim() || t.untitled(index + 1);

  // ---------- State ----------
  let index = 0;
  let stepsShown = 0;
  let frame = 0;
  let moreOpener: HTMLElement | null = null;
  const rendered = new Map<string, HTMLElement>();
  /** "Spill av": the voice plays, and steps and slides follow it. */
  let playing = false;
  let playFrame = 0;
  /** For a slide without sound: when its time started, by the page's clock. */
  let silentStart = 0;
  const voice = new Audio();
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
  const tocButtons = scenes.map((scene, i) => {
    const button = h(
      'button',
      { class: 'lp-toc-item', type: 'button' },
      h('span', { class: 'lp-toc-num' }, `${i + 1}`),
      h('span', {}, sceneTitle(scene, i)),
    );
    button.addEventListener('click', () => {
      show(i, 0, false);
      if (window.matchMedia('(max-width: 900px)').matches) toggleToc(false);
    });
    tocList.appendChild(h('li', {}, button));
    return button;
  });

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
      if (previous) {
        for (const video of Array.from(stage.querySelectorAll('video'))) video.pause();
        // A scene where web content was fetched is drawn afresh next time,
        // so nothing plays on, or starts by itself, when the viewer returns.
        if (stage.querySelector('iframe')) rendered.delete(previous.id);
      }
      closeMore(false);
      stage.replaceChildren(el);
      // A YouTube video the owner has put on the slide is fetched now, when
      // the slide is shown, and never before.
      activateWebFrames(el);
      viewport.style.background = PALETTE[sceneSurface(theme, scene)];
      viewport.setAttribute(
        'aria-label',
        t.announce(index + 1, scenes.length, sceneTitle(scene, index)),
      );
      live.textContent = t.announce(index + 1, scenes.length, sceneTitle(scene, index));
      scriptText.replaceChildren();
      const lines = scene.script.split(/\n+/).filter((line) => line.trim() !== '');
      if (lines.length === 0) scriptText.append(h('p', {}, t.noScript));
      for (const line of lines) scriptText.append(h('p', {}, line));
      scriptPanel.scrollTop = 0;
      tocButtons.forEach((button, i) => {
        if (i === index) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
      try {
        history.replaceState(null, '', `#${index + 1}`);
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
    counter.textContent = t.sceneOf(index + 1, scenes.length);
    const within = scene.timeline.length ? stepsShown / (scene.timeline.length + 1) : 0;
    const percent = Math.round(((index + within) / Math.max(1, scenes.length - 1)) * 100);
    const clamped = Math.max(0, Math.min(100, scenes.length === 1 ? 100 : percent));
    progressFill.style.width = `${clamped}%`;
    progress.setAttribute('aria-valuenow', String(clamped));
    prevButton.disabled = index === 0 && stepsShown === 0;
    nextButton.disabled = index === scenes.length - 1 && stepsShown === scene.timeline.length;
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

  function followVoice(): void {
    if (!playing) return;
    const scene = scenes[index]!;
    const el = sceneElement(scene);
    const now = voiceTime(scene);
    const duration = sceneDuration(scene);
    const done = hasSound(scene) ? voice.ended || now >= duration : now >= duration;
    if (done) {
      if (index < scenes.length - 1) {
        show(index + 1, 0, false); // goes on with the voice of the next slide
      } else {
        stepsShown = scene.timeline.length;
        applySceneState(el, sceneState(scene, stepsShown, Infinity));
        updateChrome();
        setPlaying(false);
      }
      return;
    }
    applySceneState(el, sceneStateAt(scene, now));
    const shown = stepsShownAt(scene, now);
    if (shown !== stepsShown) {
      stepsShown = shown;
      updateChrome();
    }
    playFrame = requestAnimationFrame(followVoice);
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
      // What has come in stays; the rest waits for the keys again.
      applySceneState(sceneElement(scene), sceneState(scene, stepsShown, Infinity));
    }
  }

  function next(): void {
    const scene = scenes[index];
    if (!scene) return;
    if (stepsShown < scene.timeline.length) show(index, stepsShown + 1, true);
    else if (index < scenes.length - 1) show(index + 1, 0, false);
  }

  function previous(): void {
    if (stepsShown > 0) show(index, stepsShown - 1, false);
    else if (index > 0) show(index - 1, scenes[index - 1]!.timeline.length, false);
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

  /** Opens the "Lær mer" panel of an element. `opener` gets the focus back when it closes. */
  function openMore(element: SceneElement, opener: HTMLElement): void {
    const more = moreOf(element);
    if (!more) return;
    setPlaying(false); // the voice waits while the student reads more
    if (moreOpener && moreOpener !== opener) moreOpener.setAttribute('aria-expanded', 'false');
    moreOpener = opener;
    panelTitle.textContent = moreTitle(ctx, element);
    panelBody.replaceChildren(renderMore(ctx, more));
    activateWebFrames(panelBody);
    panel.hidden = false;
    panel.scrollTop = 0;
    opener.setAttribute('aria-expanded', 'true');
    fit();
    panelTitle.focus();
  }

  function closeMore(restoreFocus: boolean): void {
    if (panel.hidden) return;
    for (const video of Array.from(panel.querySelectorAll('video'))) video.pause();
    panel.hidden = true;
    // Removing the content also stops anything fetched from the web.
    panelBody.replaceChildren();
    setPanelWide(false);
    moreOpener?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) moreOpener?.focus();
    moreOpener = null;
    fit();
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
        show(scenes.length - 1, 0, false);
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
  fit();

  const fromHash = parseInt(location.hash.replace('#', ''), 10);
  show(Number.isFinite(fromHash) ? fromHash - 1 : 0, 0, false);
}
