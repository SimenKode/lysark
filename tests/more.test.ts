// @vitest-environment happy-dom
// "Lær mer" content: the format (and the lift from format 1), the panel,
// the mark on elements, web content in two stages, and credits.
import { describe, expect, it } from 'vitest';
import { buildHtml, usedAssets, type ExportSources } from '../src/exporter/html';
import { newScene } from '../src/shared/format/factory';
import {
  FORMAT_VERSION,
  parseProject,
  type Project,
  type Scene,
} from '../src/shared/format/schema';
import { collectCredits, creditText, renderCredit, renderMore } from '../src/shared/render/more';
import {
  SCENE_STRINGS,
  activateWebFrames,
  moreCorner,
  moreOf,
  moreTitle,
  renderScene,
  type RenderContext,
} from '../src/shared/render/scene';
import {
  embedTarget,
  youtubeEmbedUrl,
  youtubeRef,
  youtubeStillUrl,
  youtubeWatchUrl,
} from '../src/shared/render/web';
import { THEME_REN } from '../src/shared/theme/theme';
import { sampleProject } from './fixtures/sampleProject';

function context(project: Project, mode: 'play' | 'edit' = 'play'): RenderContext {
  return {
    doc: document,
    project,
    theme: THEME_REN,
    mode,
    assetUrl: (id) => (project.assets[id] ? `asset:${id}` : undefined),
    logo: {},
    strings: SCENE_STRINGS.nb,
  };
}

/** A project as format 1 wrote it: the "Lær mer" box with its own text and media list. */
function formatOne(): unknown {
  const { project } = sampleProject();
  const data = JSON.parse(JSON.stringify(project)) as {
    version: number;
    scenes: Array<{ elements: Array<Record<string, unknown>> }>;
  };
  data.version = 1;
  const image = Object.keys(project.assets)[0]!;
  for (const scene of data.scenes) {
    for (const el of scene.elements) {
      delete el.more;
      if (el.type !== 'deepdive') continue;
      el.body = { paragraphs: [{ level: 0, list: 'none', runs: [{ text: 'Tekst A' }] }] };
      el.media = [
        { kind: 'image', asset: image, alt: 'Bilde A' },
        {
          kind: 'video',
          source: { kind: 'url', url: 'https://example.org/a.mp4' },
          title: 'Video A',
        },
        { kind: 'link', url: 'https://example.org/', label: 'Lenke A' },
        { kind: 'link', url: '  ', label: 'Tom' },
      ];
    }
  }
  for (const asset of Object.values((data as unknown as Project).assets)) delete asset.credit;
  return data;
}

describe('format 2', () => {
  it('lifts a format 1 project: the box keeps its label and gets its content as blocks', () => {
    const old = formatOne();
    const project = parseProject(old);
    expect(project.version).toBe(FORMAT_VERSION);
    const box = project.scenes[1]!.elements.find((e) => e.type === 'deepdive')!;
    expect(box.type === 'deepdive' && box.label).toBe('Mer om A');
    expect(box.more!.title).toBe('Mer om A');
    expect(box.more!.blocks.map((b) => b.kind)).toEqual(['text', 'image', 'video', 'text']);
    const link = box.more!.blocks[3]!;
    expect(link.kind === 'text' && link.content.paragraphs[0]!.runs[0]).toEqual({
      text: 'Lenke A',
      link: 'https://example.org/',
    });
    expect('body' in box).toBe(false);
    // Lifting twice gives the same ids, and the lifted project is valid as it stands.
    expect(parseProject(old)).toEqual(project);
    expect(parseProject(project)).toEqual(project);
  });

  it('leaves the data it was given untouched, and refuses newer formats', () => {
    const old = formatOne() as { version: number };
    parseProject(old);
    expect(old.version).toBe(1);
    expect(() => parseProject({ ...old, version: FORMAT_VERSION + 1 })).toThrow(/nyere utgave/);
  });

  it('lets any element carry content, and exports the files it uses', () => {
    const { project } = sampleProject();
    const scene = project.scenes[1]!;
    const image = scene.elements.find((e) => e.type === 'image')!;
    expect(moreOf(image)!.title).toBe('Om bildet');
    // Content with no blocks opens nothing; the button always has a panel.
    expect(moreOf({ ...image, more: { title: 'Tom', blocks: [] } })).toBeUndefined();
    const button = scene.elements.find((e) => e.type === 'deepdive')!;
    expect(moreOf({ ...button, more: undefined })).toEqual({ title: 'Mer om A', blocks: [] });

    const extra = newScene('content', 'Bare utdyping');
    extra.elements.push({
      id: 'e_only',
      type: 'shape',
      geometry: 'rect',
      box: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
      more: {
        title: 'A',
        blocks: [
          { id: 'x1', kind: 'image', asset: 'a_block', alt: '' },
          {
            id: 'x2',
            kind: 'video',
            source: { kind: 'asset', asset: 'a_video' },
            title: '',
            poster: 'a_poster',
          },
        ],
      },
    });
    project.scenes.push(extra);
    const used = usedAssets(project);
    expect(used.has('a_block') && used.has('a_video') && used.has('a_poster')).toBe(true);
  });
});

describe('the mark on an element with content', () => {
  const { project } = sampleProject();
  const scene = project.scenes[1]!;
  const image = scene.elements.find((e) => e.type === 'image')!;

  it('is a button right after the element, named for screen readers', () => {
    const root = renderScene(context(project), scene);
    const wrap = root.querySelector<HTMLElement>(`[data-el="${image.id}"]`)!;
    expect(wrap.classList.contains('ls-has-more')).toBe(true);
    const badge = wrap.querySelector('.ls-more-badge')!;
    expect(badge.tagName).toBe('BUTTON');
    expect(wrap.lastElementChild).toBe(badge);
    expect(badge.getAttribute('aria-label')).toBe('Lær mer om: Om bildet');
    expect(badge.getAttribute('aria-haspopup')).toBe('dialog');
    expect(badge.getAttribute('aria-expanded')).toBe('false');
    expect((badge as HTMLElement).dataset.more).toBe(image.id);
    // Exactly one mark: the "Lær mer" button is its own opener and gets none.
    expect(root.querySelectorAll('.ls-more-badge')).toHaveLength(1);
    expect(root.querySelector<HTMLElement>('button.ls-deepdive')!.dataset.more).toBeTruthy();
  });

  it('sits at the chosen corner and never outside the scene', () => {
    const at = (el: typeof image): { left: number; top: number } => {
      const copy: Scene = { ...scene, elements: [el] };
      const badge = renderScene(context(project), copy).querySelector<HTMLElement>(
        '.ls-more-badge',
      )!;
      return { left: parseFloat(badge.style.left), top: parseFloat(badge.style.top) };
    };
    const topRight = at(image);
    expect(topRight.left).toBeGreaterThan(image.box.w / 2);
    expect(topRight.top).toBeLessThan(0);
    const bottomLeft = at({ ...image, more: { ...image.more!, corner: 'bl' } });
    expect(bottomLeft.left).toBeLessThan(0);
    expect(bottomLeft.top).toBeGreaterThan(image.box.h / 2);
    // A picture that fills the scene: the mark is pulled inside the edge.
    const full = at({ ...image, box: { x: 0, y: 0, w: 1920, h: 1080, rotation: 0 } });
    expect(full.left + 56).toBeLessThanOrEqual(1920);
    expect(full.top).toBeGreaterThanOrEqual(0);
  });

  it('follows the text when it sits on a text element', () => {
    const title = scene.elements.find((e) => e.type === 'text' && e.role === 'title')!;
    const more = { title: 'A', blocks: [{ id: 'x', kind: 'heading' as const, text: 'A' }] };
    if (title.type !== 'text') throw new Error('expected a text element');
    expect(moreCorner({ ...title, more })).toBe('tl'); // left aligned, at the top
    expect(moreCorner({ ...title, align: 'right', more })).toBe('tr');
    expect(moreCorner({ ...title, align: 'center', valign: 'bottom', more })).toBe('br');
    expect(moreCorner({ ...title, more: { ...more, corner: 'br' } })).toBe('br'); // the owner's choice wins
    expect(moreCorner(image)).toBe('tr');
  });

  it('is shown, but cannot be activated, while editing', () => {
    const badge = renderScene(context(project, 'edit'), scene).querySelector('.ls-more-badge')!;
    expect(badge.tagName).toBe('SPAN');
    expect(badge.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('the panel', () => {
  const { project } = sampleProject();
  const scene = project.scenes[1]!;
  const image = scene.elements.find((e) => e.type === 'image')!;
  const button = scene.elements.find((e) => e.type === 'deepdive')!;

  it('draws the blocks in order', () => {
    const body = renderMore(context(project), image.more!);
    expect([...body.children].map((c) => (c as HTMLElement).dataset.block)).toEqual([
      'm1',
      'm2',
      'm3',
      'm4',
      'm5',
    ]);
    expect(body.querySelector('h3.lm-heading')!.textContent).toBe('Overskrift B');
    expect(body.querySelector('.lm-text')!.textContent).toBe('Utdyping A.');
    expect(body.querySelectorAll('.lm-table th[scope="col"]')).toHaveLength(2);
    expect(body.querySelectorAll('.lm-table td')).toHaveLength(2);
  });

  it('shows a picture with its caption and the credit its licence demands', () => {
    const figure = renderMore(context(project), button.more!).querySelector('figure.lm-figure')!;
    expect(figure.querySelector('img')!.getAttribute('alt')).toBe('Testbilde');
    expect(figure.querySelector('.lm-caption')!.textContent).toBe('Bildetekst A');
    const credit = figure.querySelector('.lm-credit')!;
    expect(credit.textContent).toBe('«Testbilde» av Person A, CC BY 4.0. Kilde');
    const links = [...credit.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual([
      'https://creativecommons.org/licenses/by/4.0/',
      'https://commons.wikimedia.org/wiki/File:Testbilde.png',
    ]);
  });

  it('names the panel after its title, the button text, or "Lær mer"', () => {
    const ctx = context(project);
    expect(moreTitle(ctx, image)).toBe('Om bildet');
    expect(moreTitle(ctx, { ...button, more: { title: ' ', blocks: [] } })).toBe('Mer om A');
    expect(moreTitle(ctx, { ...button, label: '', more: undefined })).toBe('Lær mer');
  });
});

describe('content from the web', () => {
  const { project } = sampleProject();
  const image = project.scenes[1]!.elements.find((e) => e.type === 'image')!;

  it('recognises the forms a YouTube address takes', () => {
    for (const address of [
      'https://www.youtube.com/watch?v=AAAAAAAAAAA',
      'https://youtu.be/AAAAAAAAAAA',
      'https://www.youtube.com/embed/AAAAAAAAAAA?feature=oembed',
      'https://www.youtube-nocookie.com/embed/AAAAAAAAAAA',
      'https://m.youtube.com/shorts/AAAAAAAAAAA',
    ]) {
      expect(youtubeRef(address)).toEqual({ id: 'AAAAAAAAAAA' });
    }
    expect(youtubeRef('https://youtu.be/AAAAAAAAAAA?t=1m30s')).toEqual({
      id: 'AAAAAAAAAAA',
      start: 90,
    });
    expect(youtubeRef('https://www.youtube.com/watch?v=AAAAAAAAAAA&t=42')).toEqual({
      id: 'AAAAAAAAAAA',
      start: 42,
    });
    for (const address of [
      'https://example.org/watch?v=AAAAAAAAAAA',
      'https://notyoutube.com/embed/AAAAAAAAAAA',
      'https://www.youtube.com/watch?v=<script>',
      'javascript:alert(1)',
      'ikke en adresse',
    ]) {
      expect(youtubeRef(address)).toBeUndefined();
    }
    const ref = { id: 'AAAAAAAAAAA', start: 90 };
    expect(youtubeEmbedUrl(ref)).toBe(
      'https://www.youtube-nocookie.com/embed/AAAAAAAAAAA?rel=0&start=90',
    );
    expect(youtubeWatchUrl(ref)).toBe('https://www.youtube.com/watch?v=AAAAAAAAAAA&t=90s');
    expect(youtubeStillUrl(ref)).toBe('https://i.ytimg.com/vi/AAAAAAAAAAA/hqdefault.jpg');
  });

  it('only frames pages served over https', () => {
    expect(embedTarget('https://www.example.org/side')).toEqual({
      href: 'https://www.example.org/side',
      host: 'example.org',
    });
    expect(embedTarget('http://example.org/')).toBeUndefined();
    expect(embedTarget('javascript:alert(1)')).toBeUndefined();
  });

  it('puts YouTube’s player in when the slide or panel is shown, not before, and always offers a link', () => {
    const body = renderMore(context(project), image.more!);
    const video = body.querySelector('[data-block="m4"] .ls-webvideo')!;
    // Drawing fetches nothing: the still picture waits for its frame.
    expect(body.querySelector('iframe')).toBeNull();
    const holder = video.querySelector<HTMLElement>('.ls-webvideo-play')!;
    expect(holder.tagName).toBe('DIV');
    expect(holder.dataset.frame).toBe('https://www.youtube-nocookie.com/embed/AAAAAAAAAAA?rel=0');
    const link = video.querySelector('a.ls-webvideo-open')!;
    expect(link.getAttribute('href')).toBe('https://www.youtube.com/watch?v=AAAAAAAAAAA');
    expect(link.textContent).toBe('Åpne på YouTube');
    expect(video.textContent).toContain(SCENE_STRINGS.nb.youtubeInPlace);

    // The player shows the panel: now the frame comes, without starting to play.
    expect(activateWebFrames(body)).toBe(1);
    const frame = video.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/AAAAAAAAAAA?rel=0',
    );
    expect(frame.getAttribute('src')).not.toContain('autoplay');
    expect(frame.title).toBe('Video A');
    expect(frame.referrerPolicy).toBe('strict-origin-when-cross-origin');
    expect(video.querySelector('.ls-webvideo-play')).toBeNull();
    expect(video.querySelector('a.ls-webvideo-open')).not.toBeNull(); // the link stays
    expect(activateWebFrames(body)).toBe(0); // once only

    // Any other embedded page still waits for a click.
    const embed = body.querySelector('[data-block="m5"] .ls-webvideo')!;
    expect(embed.querySelector('iframe')).toBeNull();
    const load = embed.querySelector<HTMLButtonElement>('button.ls-webvideo-play')!;
    expect(load.textContent).toBe('Innhold fra example.org – klikk for å laste');
    load.click();
    const page = embed.querySelector('iframe')!;
    expect(page.getAttribute('src')).toBe('https://example.org/side');
    expect(page.getAttribute('sandbox')).toContain('allow-scripts');
  });

  it('keeps the still picture and opens YouTube in the browser when the file was opened straight from disk', () => {
    const view = window as unknown as {
      happyDOM: { setURL(url: string): void };
      open: typeof window.open;
    };
    const opened: string[] = [];
    const realOpen = view.open;
    view.open = ((url?: string | URL) => {
      opened.push(String(url));
      return null;
    }) as typeof window.open;
    view.happyDOM.setURL('file:///C:/forelesning.html');
    try {
      const body = renderMore(context(project), image.more!);
      // YouTube answers "Error 153" in a file opened from disk, so no frame is put in.
      expect(activateWebFrames(body)).toBe(0);
      const play = body.querySelector<HTMLButtonElement>(
        '[data-block="m4"] button.ls-webvideo-play',
      )!;
      expect(play.getAttribute('aria-label')).toBe('Spill av på YouTube: Video A');
      expect(body.querySelector('[data-block="m4"]')!.textContent).toContain(
        SCENE_STRINGS.nb.youtubeOpens,
      );
      play.click();
      expect(opened).toEqual(['https://www.youtube.com/watch?v=AAAAAAAAAAA']);
      expect(body.querySelector('iframe')).toBeNull();
      // Other embedded pages have no such demand and are framed as usual.
      body.querySelector<HTMLButtonElement>('[data-block="m5"] button.ls-webvideo-play')!.click();
      expect(body.querySelector('iframe')!.getAttribute('src')).toBe('https://example.org/side');
    } finally {
      view.open = realOpen;
      view.happyDOM.setURL('about:blank');
    }
  });

  it('cannot be activated while editing, and never fetches a video file from the web there', () => {
    const body = renderMore(context(project, 'edit'), image.more!);
    expect(body.querySelector('button')).toBeNull();
    expect(body.querySelector('a')).toBeNull();
    expect(body.querySelector('.ls-webvideo-play')!.tagName).toBe('DIV');

    const scene = newScene('content', 'Video');
    scene.elements.push({
      id: 'e_v',
      type: 'video',
      source: { kind: 'url', url: 'https://example.org/a.mp4' },
      title: 'Video A',
      box: { x: 0, y: 0, w: 960, h: 540, rotation: 0 },
    });
    expect(renderScene(context(project, 'edit'), scene).querySelector('video')).toBeNull();
    expect(renderScene(context(project, 'play'), scene).querySelector('video')).not.toBeNull();
  });

  it('draws a YouTube video on a slide with its still picture, and the player when the slide is shown', () => {
    const still = Object.keys(project.assets)[0]!;
    const scene = newScene('content', 'Video');
    scene.elements.push({
      id: 'e_y',
      type: 'video',
      source: { kind: 'url', url: 'https://youtu.be/AAAAAAAAAAA?t=90' },
      title: 'Video A',
      poster: still,
      box: { x: 0, y: 0, w: 960, h: 540, rotation: 0 },
    });
    const drawn = renderScene(context(project), scene);
    const card = drawn.querySelector('.ls-webvideo-youtube')!;
    expect(card.querySelector('.ls-webvideo-play img')!.getAttribute('src')).toBe(`asset:${still}`);
    expect(card.querySelector('iframe')).toBeNull();
    expect(card.textContent).toContain(SCENE_STRINGS.nb.youtubeInPlace);
    expect(activateWebFrames(drawn)).toBe(1);
    expect(card.querySelector('iframe')!.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/AAAAAAAAAAA?rel=0&start=90',
    );

    // While editing only the still picture is drawn, and nothing can put a frame there.
    const edited = renderScene(context(project, 'edit'), scene);
    expect(edited.querySelector('.ls-webvideo-play img')).not.toBeNull();
    expect(activateWebFrames(edited)).toBe(0);
    expect(edited.querySelector('iframe')).toBeNull();
  });
});

describe('credits', () => {
  it('writes a credit as one line', () => {
    const s = SCENE_STRINGS.nb;
    expect(creditText({ title: 'A', author: 'B', license: 'CC BY 4.0' }, s)).toBe(
      '«A» av B, CC BY 4.0',
    );
    expect(creditText({ author: 'B' }, s)).toBe('av B');
    expect(creditText({ license: 'CC0' }, s, true)).toBe('CC0 (beskåret)');
  });

  it('links only to web addresses, and not at all while editing', () => {
    const credit = {
      author: 'B',
      license: 'L',
      licenseUrl: 'javascript:alert(1)',
      sourceUrl: 'https://example.org/',
    };
    const live = renderCredit(document, credit, SCENE_STRINGS.nb, { interactive: true });
    expect([...live.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      'https://example.org/',
    ]);
    const still = renderCredit(document, credit, SCENE_STRINGS.nb, { interactive: false });
    expect(still.querySelector('a')).toBeNull();
    expect(still.textContent).toBe('av B, L. Kilde');
  });

  it('lists every credited picture once, with the scenes that use it', () => {
    const { project } = sampleProject();
    const image = Object.keys(project.assets)[0]!;
    const again = newScene('content', 'Igjen');
    again.elements.push({
      id: 'e_again',
      type: 'image',
      asset: image,
      alt: '',
      crop: { l: 0.1, t: 0, r: 0, b: 0 },
      box: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
    });
    project.scenes.push(again);
    const credits = collectCredits(project);
    expect(credits).toHaveLength(1);
    expect(credits[0]!.scenes).toEqual([2, 4]);
    expect(credits[0]!.cropped).toBe(true);
    // A picture without a credit is not listed.
    delete project.assets[image]!.credit;
    expect(collectCredits(project)).toEqual([]);
  });
});

describe('the exported file', () => {
  it('carries the panel styles and allows frames only over https', () => {
    const { project, media } = sampleProject();
    const sources: ExportSources = {
      playerJs: '/* player */',
      readFont: () => new Uint8Array([1, 2, 3]),
      readAsset: (file) => media.find((m) => m.file === file)!.data,
      logo: {},
      sidecarHref: () => undefined,
    };
    const { html } = buildHtml(project, sources);
    expect(html).toContain('.lm-body');
    expect(html).toContain('.ls-more-badge');
    expect(html).toMatch(/Content-Security-Policy" content="[^"]*frame-src https:/);
    expect(html).toMatch(/Content-Security-Policy" content="[^"]*connect-src 'none'/);
    // Nothing from the web is referred to by anything that loads on its own.
    expect(html).not.toMatch(/<iframe/);
    expect(html).not.toMatch(/<(script|img|link)[^>]+(src|href)="https?:/);
  });
});
