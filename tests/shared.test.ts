// @vitest-environment happy-dom
// Tests for the shared parts: the brand rules in the theme, the timeline,
// the grid layout, scene rendering and the HTML export.
import { describe, expect, it } from 'vitest';
import { buildHtml, usedAssets, usedFonts, type ExportSources } from '../src/exporter/html';
import { newId, newScene, richText } from '../src/shared/format/factory';
import {
  FORMAT_VERSION,
  PALETTE_COLORS,
  Project,
  SCENE_KINDS,
  STROKE_WIDTH,
  SURFACES,
  TEXT_ROLES,
  parseProject,
  type Scene,
} from '../src/shared/format/schema';
import { fitToGrid } from '../src/shared/layout/fitToGrid';
import { INLINE_VIDEO_LIMIT_BYTES } from '../src/shared/limits';
import { classifyLink, numberMarker, renderRichText } from '../src/shared/render/richtext';
import {
  SCENE_STRINGS,
  arrowHeadLength,
  renderScene,
  signPoint,
  type RenderContext,
} from '../src/shared/render/scene';
import {
  STEP_RISE,
  applySceneState,
  pruneTimeline,
  sceneState,
  stepDuration,
} from '../src/shared/render/timeline';
import {
  CONTRAST_TABLE,
  allowedTextColors,
  isAllowedTextColor,
  isLargeText,
} from '../src/shared/theme/contrast';
import { PALETTE, SERIES_ORDER, nearestPaletteColor } from '../src/shared/theme/palette';
import { SHAPE_PAIRS, decorationColors, shapePath } from '../src/shared/theme/shapes';
import {
  DECORATION_BOX,
  THEME_REN,
  columnEdges,
  defaultTextColor,
  overlapsDecoration,
  roleFontSize,
} from '../src/shared/theme/theme';
import { docToRichText, richTextToDoc } from '../src/renderer/src/richtext/schema';
import { WARNINGS } from '../src/importer/messages';
import { layOutFrontScenes } from '../src/importer/pptx';
import { coversLogo } from '../src/importer/slide';
import { sampleProject } from './fixtures/sampleProject';

describe('palette and contrast table (brand manual)', () => {
  it('has exactly the manual’s colours', () => {
    expect(PALETTE.lilla).toBe('#7800f0');
    expect(PALETTE.oransje).toBe('#ff6202');
    expect(PALETTE.indigo).toBe('#2f0b63');
    expect(PALETTE.lysBeige).toBe('#fff5ee');
    expect(PALETTE.syregronn).toBe('#cfff1f');
    expect(Object.keys(PALETTE).sort()).toEqual([...PALETTE_COLORS].sort());
  });

  it('never offers orange, pink or acid green as a surface', () => {
    for (const strong of ['oransje', 'rosa', 'syregronn', 'mediumRosa', 'mediumSyregronn']) {
      expect(SURFACES as readonly string[]).not.toContain(strong);
    }
  });

  it('uses the manual’s order for infographics', () => {
    expect(SERIES_ORDER).toEqual([
      'lilla',
      'oransje',
      'indigo',
      'rosa',
      'mediumLilla',
      'syregronn',
      'mediumIndigo',
      'beige',
      'sort',
      'lysLilla',
    ]);
  });

  it('follows the table, including the large-text-only entries', () => {
    expect(isAllowedTextColor('lilla', 'hvit', false)).toBe(true);
    expect(isAllowedTextColor('oransje', 'hvit', false)).toBe(false);
    expect(isAllowedTextColor('oransje', 'hvit', true)).toBe(true);
    expect(isAllowedTextColor('hvit', 'lilla', false)).toBe(true);
    expect(isAllowedTextColor('lilla', 'lysLilla', false)).toBe(false);
    expect(isAllowedTextColor('lilla', 'lysLilla', true)).toBe(true);
    expect(isAllowedTextColor('hvit', 'oransje', false)).toBe(false);
    expect(allowedTextColors('rosa', true)).toEqual(['sort', 'indigo']);
    expect(Object.keys(CONTRAST_TABLE).sort()).toEqual([...PALETTE_COLORS].sort());
  });

  it('counts text as large above 18 pt, or from 14 pt when bold', () => {
    expect(isLargeText(36, false)).toBe(false);
    expect(isLargeText(37, false)).toBe(true);
    expect(isLargeText(28, true)).toBe(true);
    expect(isLargeText(27, true)).toBe(false);
  });

  it('maps arbitrary colours to the nearest palette colour', () => {
    expect(nearestPaletteColor('#ff0000')).toBe('oransje');
    expect(nearestPaletteColor('#7a05ee')).toBe('lilla');
    expect(nearestPaletteColor('#fefefe')).toBe('hvit');
    expect(nearestPaletteColor('#101010')).toBe('sort');
  });
});

describe('theme', () => {
  it('picks default text colours the table allows, on every surface and role', () => {
    for (const surface of SURFACES) {
      for (const role of TEXT_ROLES) {
        for (const kind of SCENE_KINDS) {
          const size = roleFontSize(THEME_REN, role, kind);
          const color = defaultTextColor(THEME_REN, surface, role, size);
          const large = isLargeText(size, THEME_REN.roles[role].weight === 700);
          expect(isAllowedTextColor(color, surface, large), `${role} on ${surface}`).toBe(true);
        }
      }
    }
  });

  it('never sets the title font in bold', () => {
    for (const role of TEXT_ROLES) {
      if (THEME_REN.roles[role].font === 'title') expect(THEME_REN.roles[role].weight).toBe(400);
    }
  });

  it('has eight columns inside the margins', () => {
    const { starts, ends } = columnEdges(THEME_REN);
    expect(starts).toHaveLength(8);
    expect(starts[0]).toBe(THEME_REN.grid.marginX);
    expect(ends[7]).toBeCloseTo(1920 - THEME_REN.grid.marginX);
    expect(DECORATION_BOX.x).toBeGreaterThanOrEqual(ends[4]!);
  });
});

describe('brand shapes', () => {
  it('follow the manual: two per pair, four to six points on the 8 x 8 grid, convex', () => {
    for (const pair of SHAPE_PAIRS) {
      for (const shape of [pair.a, pair.b]) {
        expect(shape.points.length).toBeGreaterThanOrEqual(4);
        expect(shape.points.length).toBeLessThanOrEqual(6);
        for (const [x, y] of shape.points) {
          expect(Number.isInteger(x) && x >= 0 && x <= 8).toBe(true);
          expect(Number.isInteger(y) && y >= 0 && y <= 8).toBe(true);
        }
        // Convex: every turn goes the same way, so no angle points inwards.
        const n = shape.points.length;
        const turns = shape.points.map((p, i) => {
          const q = shape.points[(i + 1) % n]!;
          const r = shape.points[(i + 2) % n]!;
          return Math.sign((q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]));
        });
        expect(new Set(turns).size).toBe(1);
        // Straight-edged shapes must be rectangles.
        if (!shape.soft) {
          expect(n).toBe(4);
          const xs = new Set(shape.points.map((p) => p[0]));
          const ys = new Set(shape.points.map((p) => p[1]));
          expect(xs.size).toBe(2);
          expect(ys.size).toBe(2);
        } else {
          expect(shapePath(shape, 10)).toContain('Q');
        }
      }
    }
  });

  it('gives the overlap its own colour on every surface', () => {
    for (const surface of SURFACES) {
      const c = decorationColors(surface);
      expect(new Set([c.a, c.b, c.overlap, surface]).size).toBe(4);
    }
  });
});

describe('timeline', () => {
  const scene: Scene = {
    ...newScene('content'),
    elements: ['a', 'b', 'c'].map((id) => ({
      id,
      type: 'shape' as const,
      geometry: 'rect' as const,
      box: { x: 0, y: 0, w: 10, h: 10, rotation: 0 },
    })),
    timeline: [
      { id: 't1', actions: [{ target: 'b', effect: 'fade', duration: 0.4 }] },
      { id: 't2', actions: [{ target: 'c', effect: 'appear', duration: 0, delay: 0.2 }] },
    ],
  };

  it('is a pure function of steps shown and time', () => {
    expect(sceneState(scene, 0, Infinity).get('b')).toBe(0);
    expect(sceneState(scene, 1, 0).get('b')).toBe(0);
    expect(sceneState(scene, 1, 0.2).get('b')).toBeCloseTo(0.875);
    expect(sceneState(scene, 1, 0.2).get('b')).toBe(sceneState(scene, 1, 0.2).get('b'));
    expect(sceneState(scene, 1, Infinity).get('b')).toBe(1);
    expect(sceneState(scene, 1, Infinity).get('c')).toBe(0);
    expect(sceneState(scene, 2, 0.1).get('c')).toBe(0);
    expect(sceneState(scene, 2, 0.2).get('c')).toBe(1);
    expect(sceneState(scene, 2, 0).has('a')).toBe(false);
    expect(stepDuration(scene.timeline[0]!)).toBe(0.4);
    expect(stepDuration(scene.timeline[1]!)).toBe(0.2);
  });

  it('lets an element glide up into place while it comes in', () => {
    const { project } = sampleProject();
    const scene = project.scenes[1]!;
    const el = renderScene(context(project), scene);
    const target = scene.timeline[0]!.actions[0]!.target;
    const node = el.querySelector<HTMLElement>(`[data-el="${target}"]`)!;
    applySceneState(el, new Map([[target, 0.5]]));
    expect(node.style.translate).toBe(`0 ${(STEP_RISE / 2).toFixed(2)}px`);
    expect(node.style.opacity).toBe('0.5');
    applySceneState(el, new Map([[target, 1]]));
    expect(node.style.translate).toBe('');
    applySceneState(el, new Map([[target, 0]]));
    expect(node.style.translate).toBe('');
  });

  it('hides elements from assistive technology until their step', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-el="a"></div><div data-el="b"></div>';
    applySceneState(root, sceneState(scene, 0, Infinity));
    const b = root.querySelector<HTMLElement>('[data-el="b"]')!;
    expect(b.style.visibility).toBe('hidden');
    expect(b.getAttribute('aria-hidden')).toBe('true');
    applySceneState(root, sceneState(scene, 1, Infinity));
    expect(b.style.visibility).toBe('');
    expect(b.hasAttribute('aria-hidden')).toBe(false);
  });

  it('drops steps whose elements are gone', () => {
    const copy = structuredClone(scene);
    copy.elements = copy.elements.filter((e) => e.id !== 'b');
    pruneTimeline(copy);
    expect(copy.timeline.map((s) => s.id)).toEqual(['t2']);
  });
});

function context(project: Project): RenderContext {
  return {
    doc: document,
    project,
    theme: THEME_REN,
    mode: 'play',
    assetUrl: (id) => (project.assets[id] ? `asset:${id}` : undefined),
    logo: {},
    strings: SCENE_STRINGS.nb,
  };
}

describe('rendering', () => {
  const { project } = sampleProject();

  it('renders every element of a scene, titles first for reading order', () => {
    const scene = project.scenes[1]!;
    const el = renderScene(context(project), scene);
    expect(el.querySelectorAll('[data-el]')).toHaveLength(scene.elements.length);
    expect(el.querySelector('[data-el]')!.querySelector('.ls-role-title')).not.toBeNull();
    expect(el.querySelector('.ls-image img')!.getAttribute('alt')).toBe(
      'Testbilde med to fargefelt',
    );
    expect(el.querySelector('table th')!.getAttribute('scope')).toBe('col');
    expect(el.querySelector('button.ls-deepdive')!.getAttribute('aria-haspopup')).toBe('dialog');
    expect(el.querySelector('.ls-logo')).toBeNull(); // no logo files: nothing is substituted
  });

  it('is the same every time for the same input', () => {
    const scene = project.scenes[1]!;
    const strip = (html: string): string => html.replace(/ls-clip-\d+/g, 'ls-clip');
    expect(strip(renderScene(context(project), scene).outerHTML)).toBe(
      strip(renderScene(context(project), scene).outerHTML),
    );
  });

  it('draws the logo only from the files it is given, in the right variant', () => {
    const ctx = { ...context(project), logo: { light: 'logo:light', dark: 'logo:dark' } };
    expect(
      renderScene(ctx, project.scenes[0]!).querySelector('.ls-logo')!.getAttribute('src'),
    ).toBe('logo:dark');
    expect(
      renderScene(ctx, project.scenes[1]!).querySelector('.ls-logo')!.getAttribute('src'),
    ).toBe('logo:light');
    const hidden = { ...project.scenes[1]!, showLogo: false };
    expect(renderScene(ctx, hidden).querySelector('.ls-logo')).toBeNull();
  });

  it('falls back to an allowed text colour when an override breaks the contrast table', () => {
    const scene = structuredClone(project.scenes[0]!);
    const title = scene.elements[0]!;
    if (title.type === 'text') title.color = 'sort'; // black on purple is not in the table
    const el = renderScene(context(project), scene);
    expect(el.querySelector<HTMLElement>('.ls-role-title')!.style.color).toBe(PALETTE.hvit);
  });

  it('never lets content inject markup, and only follows safe links', () => {
    const fragment = renderRichText(
      {
        paragraphs: [
          {
            level: 0,
            list: 'none',
            runs: [
              { text: '<img src=x onerror=alert(1)>' },
              { text: 'a', link: 'javascript:alert(1)' },
              { text: 'b', link: 'https://example.org/' },
            ],
          },
        ],
      },
      { doc: document, levelScale: [1], interactive: true },
    );
    const host = document.createElement('div');
    host.appendChild(fragment);
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelectorAll('a')).toHaveLength(1);
    expect(host.querySelector('a')!.getAttribute('rel')).toBe('noopener noreferrer');
    expect(classifyLink('javascript:alert(1)')).toBeUndefined();
    expect(classifyLink('#scene:s_1')).toEqual({ kind: 'scene', sceneId: 's_1' });
  });

  it('draws subscripts and superscripts', () => {
    const host = document.createElement('div');
    host.appendChild(
      renderRichText(
        {
          paragraphs: [
            {
              level: 0,
              list: 'none',
              runs: [
                { text: 'CO' },
                { text: '2', script: 'sub' },
                { text: 'm' },
                { text: '3', script: 'super' },
              ],
            },
          ],
        },
        { doc: document, levelScale: [1], interactive: false },
      ),
    );
    expect(host.querySelector('sub')!.textContent).toBe('2');
    expect(host.querySelector('sup')!.textContent).toBe('3');
  });

  it('numbers lists per level', () => {
    const host = document.createElement('div');
    host.appendChild(
      renderRichText(
        {
          paragraphs: [
            { level: 0, list: 'number', runs: [{ text: 'A' }] },
            { level: 1, list: 'number', runs: [{ text: 'B' }] },
            { level: 0, list: 'number', runs: [{ text: 'C' }] },
            { level: 1, list: 'number', runs: [{ text: 'D' }] },
          ],
        },
        { doc: document, levelScale: [1, 0.9], interactive: false },
      ),
    );
    expect([...host.querySelectorAll('.ls-marker')].map((m) => m.textContent)).toEqual([
      '1.',
      '1.',
      '2.',
      '1.',
    ]);
  });

  it('spaces paragraphs as imported, leaving out the space above the first one', () => {
    const host = document.createElement('div');
    host.appendChild(
      renderRichText(
        {
          paragraphs: [
            { level: 0, list: 'none', runs: [{ text: 'A' }] },
            { level: 0, list: 'bullet', runs: [{ text: 'B' }] },
            { level: 1, list: 'bullet', runs: [{ text: 'C' }] },
          ],
        },
        {
          doc: document,
          levelScale: [1, 0.5],
          spaceBefore: [1, 0.25, 0, 0, 0],
          interactive: false,
        },
      ),
    );
    const [a, b, c] = [...host.querySelectorAll<HTMLElement>('.ls-p, .ls-li')];
    expect([a!.style.marginTop, b!.style.marginTop, c!.style.marginTop]).toEqual([
      '0em',
      '1em',
      // 0.25 of the text's size, in the em of a paragraph set at half size.
      '0.5em',
    ]);
    expect(host.querySelector<HTMLElement>('.ls-list')!.style.marginTop).toBe('0px');
  });

  it('indents list levels as imported', () => {
    const host = document.createElement('div');
    host.appendChild(
      renderRichText(
        {
          paragraphs: [
            { level: 0, list: 'bullet', runs: [{ text: 'A' }] },
            { level: 1, list: 'bullet', runs: [{ text: 'B' }] },
            { level: 1, list: 'none', runs: [{ text: 'C' }] },
          ],
        },
        {
          doc: document,
          levelScale: [1, 0.5],
          indent: [
            { start: 0, text: 0.9 },
            { start: 0.9, text: 1.8 },
            { start: 1.8, text: 2.7 },
            { start: 2.7, text: 3.6 },
            { start: 3.6, text: 4.5 },
          ],
          interactive: false,
        },
      ),
    );
    const [a, b] = [...host.querySelectorAll<HTMLElement>('.ls-li')];
    const markers = [...host.querySelectorAll<HTMLElement>('.ls-marker')];
    expect([a!.style.marginLeft, markers[0]!.style.width]).toEqual(['0em', '0.9em']);
    // In the em of a paragraph set at half size.
    expect([b!.style.marginLeft, markers[1]!.style.width]).toEqual(['1.8em', '1.8em']);
    const c = host.querySelector<HTMLElement>('.ls-p')!;
    expect([c.style.paddingLeft, c.style.textIndent]).toEqual(['3.6em', '-1.8em']);
  });

  it('goes on numbering past bullets at a deeper level, and starts again after plain text', () => {
    const host = document.createElement('div');
    host.appendChild(
      renderRichText(
        {
          paragraphs: [
            { level: 0, list: 'number', runs: [{ text: 'A' }] },
            { level: 1, list: 'bullet', runs: [{ text: 'B' }] },
            { level: 0, list: 'number', runs: [{ text: 'C' }] },
            { level: 0, list: 'none', runs: [{ text: 'D' }] },
            { level: 0, list: 'number', runs: [{ text: 'E' }] },
          ],
        },
        { doc: document, levelScale: [1, 0.9], interactive: false },
      ),
    );
    const numbers = [...host.querySelectorAll('ol .ls-marker')].map((m) => m.textContent);
    expect(numbers).toEqual(['1.', '2.', '1.']);
    expect([...host.querySelectorAll('ol > li')].map((li) => (li as HTMLLIElement).value)).toEqual([
      1, 2, 1,
    ]);
  });
});

describe('video', () => {
  const videoScene = (
    url: string,
    withPoster = false,
  ): { project: Project; scene: Scene; poster: string } => {
    const { project } = sampleProject();
    const poster = Object.keys(project.assets)[0]!;
    const scene = newScene('content', 'Video');
    scene.elements.push({
      id: newId('e'),
      type: 'video',
      source: { kind: 'url', url },
      title: 'Video A',
      ...(withPoster ? { poster } : {}),
      box: { x: 120, y: 200, w: 960, h: 540, rotation: 0 },
    });
    project.scenes.push(scene);
    return { project, scene, poster };
  };

  it('shows the still picture of a linked video on the card that opens the browser', () => {
    const { project, scene, poster } = videoScene('https://example.org/video-a', true);
    const card = renderScene(context(project), scene).querySelector('a.ls-videocard')!;
    expect(card.getAttribute('href')).toBe('https://example.org/video-a');
    expect(card.classList.contains('ls-videocard-poster')).toBe(true);
    const picture = card.querySelector('img.ls-videocard-img')!;
    expect(picture.getAttribute('src')).toBe(`asset:${poster}`);
    expect(picture.getAttribute('alt')).toBe(''); // the title beside it names the video
    expect(card.textContent).toContain('Video A');
    expect(card.textContent).toContain(SCENE_STRINGS.nb.opensInBrowser);
  });

  it('draws a plain card when a linked video has no still picture', () => {
    const { project, scene } = videoScene('https://example.org/video-a');
    const card = renderScene(context(project), scene).querySelector('.ls-videocard')!;
    expect(card.querySelector('img')).toBeNull();
    expect(card.classList.contains('ls-videocard-poster')).toBe(false);
  });

  it('says so in the picture when a video has no picture or cannot be played', () => {
    const { project, scene } = videoScene('https://example.org/a.mp4');
    const silent = renderScene(context(project), scene).querySelector('.ls-video')!;
    expect(silent.querySelector('.ls-video-note')).toBeNull();
    // Sound only: the player stays, with a note.
    silent.querySelector('video')!.dispatchEvent(new Event('loadedmetadata'));
    expect(silent.querySelector('.ls-video-note')!.textContent).toBe(
      SCENE_STRINGS.nb.videoNoPicture,
    );
    expect(silent.querySelector('video')!.hidden).toBe(false);

    const broken = renderScene(context(project), scene).querySelector('.ls-video')!;
    broken.querySelector('video')!.dispatchEvent(new Event('error'));
    broken.querySelector('video')!.dispatchEvent(new Event('error'));
    expect(broken.querySelectorAll('.ls-video-note')).toHaveLength(1);
    expect(broken.querySelector('.ls-video-note')!.textContent).toBe(
      SCENE_STRINGS.nb.videoUnplayable,
    );
    expect(broken.querySelector('video')!.hidden).toBe(true);
  });
});

describe('list markers and blending', () => {
  it('writes the markers of lettered and roman lists', () => {
    expect([1, 2, 27].map((n) => numberMarker(n, 'a.'))).toEqual(['a.', 'b.', 'aa.']);
    expect(numberMarker(4, 'I.')).toBe('IV.');
    expect(numberMarker(3, 'A)')).toBe('C)');
    expect(numberMarker(9, undefined)).toBe('9.');
  });

  it('blends ink over what lies under it, and aligns shape text as imported', () => {
    const { project } = sampleProject();
    const scene = project.scenes[1]!;
    const image = scene.elements.find((e) => e.type === 'image');
    expect(image).toBeDefined();
    if (image?.type === 'image') image.blend = 'multiply';
    scene.elements.push({
      id: 'e_left',
      type: 'shape',
      geometry: 'rect',
      fill: 'lilla',
      box: { x: 0, y: 0, w: 300, h: 100, rotation: 0 },
      content: { paragraphs: [{ level: 0, list: 'none', runs: [{ text: 'A' }] }] },
      align: 'left',
      valign: 'top',
    });
    const el = renderScene(context(project), scene);
    const wrap = el.querySelector<HTMLElement>(`[data-el="${image!.id}"]`)!;
    expect(wrap.style.mixBlendMode).toBe('multiply');
    const content = el.querySelector<HTMLElement>('[data-el="e_left"] .ls-shape-content')!;
    expect([content.style.textAlign, content.style.justifyContent]).toEqual(['left', 'flex-start']);
  });
});

describe('shapes with text', () => {
  it('turns the text area of a shape with vertical text and keeps its own margins', () => {
    const { project } = sampleProject();
    const scene = project.scenes[1]!;
    scene.elements = [
      {
        id: 'e_label',
        type: 'shape',
        geometry: 'rect',
        fill: 'lilla',
        box: { x: 0, y: 0, w: 80, h: 300, rotation: 0 },
        content: { paragraphs: [{ level: 0, list: 'none', runs: [{ text: 'A' }] }] },
        textRotation: 270,
        textInset: { l: 0, t: 1, r: 2, b: 3 },
      },
    ];
    const el = renderScene(context(project), scene);
    const content = el.querySelector<HTMLElement>('.ls-shape-content')!;
    expect(content.style.transform).toBe('rotate(270deg)');
    expect([content.style.width, content.style.height]).toEqual(['300px', '80px']);
    expect([content.style.left, content.style.top]).toEqual(['-110px', '110px']);
    expect(content.style.padding).toBe('1px 2px 3px 0px');
  });
});

describe('stroke width of shapes', () => {
  const arrow = (strokeWidth?: number): Scene['elements'][number] => ({
    id: 'e_arrow',
    type: 'shape',
    geometry: 'arrow',
    box: { x: 0, y: 0, w: 400, h: 1, rotation: 0 },
    ...(strokeWidth === undefined ? {} : { strokeWidth }),
  });
  const draw = (element: Scene['elements'][number]): HTMLElement => {
    const { project } = sampleProject();
    const scene = project.scenes[1]!;
    scene.elements = [element];
    scene.timeline = [];
    return renderScene(context(project), scene);
  };
  const headLength = (el: HTMLElement): number => {
    const points = el
      .querySelector('polygon')!
      .getAttribute('points')!
      .split(' ')
      .map((p) => Number(p.split(',')[0]));
    return points[0]! - points[1]!;
  };

  it('uses the theme’s thickness until the shape gets its own', () => {
    const plain = draw(arrow());
    expect(plain.querySelector('line')!.getAttribute('stroke-width')).toBe(
      String(THEME_REN.shape.strokeWidth),
    );
    const thick = draw(arrow(20));
    expect(thick.querySelector('line')!.getAttribute('stroke-width')).toBe('20');
  });

  it('lets the head of an arrow grow with the stroke, and keeps a thin arrow’s head visible', () => {
    const thin = headLength(draw(arrow(1)));
    const normal = headLength(draw(arrow()));
    const thick = headLength(draw(arrow(20)));
    expect(normal).toBeCloseTo(arrowHeadLength(THEME_REN.shape.strokeWidth), 0);
    expect(thin).toBeGreaterThanOrEqual(8);
    expect(thin).toBeLessThan(normal);
    expect(thick).toBeGreaterThan(2 * normal);
  });

  it('draws an outline of the chosen thickness inside the box', () => {
    const el = draw({
      id: 'e_ring',
      type: 'shape',
      geometry: 'ellipse',
      box: { x: 0, y: 0, w: 200, h: 100, rotation: 0 },
      strokeWidth: 12,
    });
    const ellipse = el.querySelector('ellipse')!;
    expect(ellipse.getAttribute('stroke-width')).toBe('12');
    expect([ellipse.getAttribute('rx'), ellipse.getAttribute('ry')]).toEqual(['94', '44']);
  });

  it('accepts only thicknesses within the limits, and lifts format 2 files', () => {
    const { project } = sampleProject();
    const data = JSON.parse(JSON.stringify(project)) as Project;
    data.scenes[1]!.elements.push(arrow(STROKE_WIDTH.max));
    expect(() => parseProject(data)).not.toThrow();
    data.scenes[1]!.elements.push({ ...arrow(STROKE_WIDTH.max + 1), id: 'e_too_thick' });
    expect(() => parseProject(data)).toThrow(/strokeWidth/);
    const old = { ...(JSON.parse(JSON.stringify(project)) as Project), version: 2 };
    expect(parseProject(old).version).toBe(FORMAT_VERSION);
  });
});

describe('the closing animation', () => {
  const exportSources = (_project: Project): ExportSources => ({
    playerJs: 'window.__player = true;',
    readFont: (face) => new TextEncoder().encode(`font:${face}`),
    readAsset: (file) => new TextEncoder().encode(`asset:${file}`),
    logo: {},
    sidecarHref: () => undefined,
  });
  const closing = (): { project: Project; scene: Scene } => {
    const { project } = sampleProject();
    const scene = project.scenes[2]!;
    scene.closingAnimation = { seconds: 10 };
    return { project, scene };
  };

  it('is a film that fills the slide, with no controls and no sound', () => {
    const { project, scene } = closing();
    const el = renderScene({ ...context(project), closing: 'film:closing' }, scene);
    const film = el.querySelector<HTMLVideoElement>('video.ls-closing')!;
    expect(film.getAttribute('src')).toBe('film:closing');
    expect(film.muted).toBe(true);
    expect(film.controls).toBe(false);
    expect(film.getAttribute('aria-label')).toContain('avslutningsanimasjon');
    // Elements on the slide lie on top of the film.
    expect(el.querySelector('video.ls-closing ~ .ls-el')).not.toBeNull();
  });

  it('shows nothing in its place when the owner has not supplied the film', () => {
    const { project, scene } = closing();
    expect(renderScene(context(project), scene).querySelector('video')).toBeNull();
    delete scene.closingAnimation;
    expect(
      renderScene({ ...context(project), closing: 'film:closing' }, scene).querySelector('video'),
    ).toBeNull();
  });

  it('is written into the HTML file once, and only when a slide plays it', () => {
    const { project } = closing();
    const film = { mime: 'video/mp4', data: new Uint8Array([1, 2, 3, 4]) };
    const html = buildHtml(project, { ...exportSources(project), closing: film }).html;
    expect(html.match(/id="ls-brand-closing"/g)).toHaveLength(1);
    expect(html).toContain('"closing":{"mime":"video/mp4"}');
    for (const scene of project.scenes) delete scene.closingAnimation;
    const without = buildHtml(project, { ...exportSources(project), closing: film }).html;
    expect(without).not.toContain('ls-brand-closing');
  });

  it('is part of the format', () => {
    const { project } = closing();
    expect(() => parseProject(JSON.parse(JSON.stringify(project)))).not.toThrow();
    project.scenes[2]!.closingAnimation = { seconds: 0 };
    expect(() => parseProject(JSON.parse(JSON.stringify(project)))).toThrow(/closingAnimation/);
  });
});

describe('the sign shape', () => {
  const draw = (flipH: boolean, text = true): HTMLElement => {
    const { project } = sampleProject();
    const scene = project.scenes[1]!;
    scene.timeline = [];
    scene.elements = [
      {
        id: 'e_sign',
        type: 'shape',
        geometry: 'sign',
        fill: 'lilla',
        box: { x: 0, y: 0, w: 400, h: 100, rotation: 0 },
        ...(flipH ? { flipH: true } : {}),
        ...(text ? { content: richText('A') } : {}),
      },
    ];
    return renderScene(context(project), scene);
  };

  it('is a rectangle with a point on the right, half the short side deep', () => {
    expect(signPoint(400, 100)).toBe(50);
    const points = draw(false).querySelector('polygon')!.getAttribute('points');
    expect(points).toBe('0,0 350,0 400,50 350,100 0,100');
  });

  it('points left when it is mirrored, and keeps its text clear of the point', () => {
    const el = draw(true);
    expect(el.querySelector('polygon')!.getAttribute('points')).toBe(
      '400,0 50,0 0,50 50,100 400,100',
    );
    expect(el.querySelector<HTMLElement>('.ls-shape-content')!.style.paddingLeft).toBe('49px');
    expect(draw(false).querySelector<HTMLElement>('.ls-shape-content')!.style.paddingRight).toBe(
      '49px',
    );
  });

  it('is part of the format from version 5, and older files are lifted', () => {
    const { project } = sampleProject();
    const data = JSON.parse(JSON.stringify(project)) as Project;
    data.scenes[1]!.elements.push({
      id: 'e_sign',
      type: 'shape',
      geometry: 'sign',
      box: { x: 0, y: 0, w: 400, h: 100, rotation: 0 },
    });
    expect(() => parseProject(data)).not.toThrow();
    expect(FORMAT_VERSION).toBeGreaterThanOrEqual(5);
    expect(parseProject({ ...JSON.parse(JSON.stringify(project)), version: 4 }).version).toBe(
      FORMAT_VERSION,
    );
  });
});

describe('fit to grid', () => {
  it('snaps boxes to columns, left aligns text and uses the theme’s sizes', () => {
    const scene: Scene = {
      ...newScene('content'),
      elements: [
        {
          id: 'title',
          type: 'text',
          role: 'title',
          content: richText('A'),
          fontSize: 51,
          align: 'center',
          valign: 'middle',
          box: { x: 301, y: 13, w: 900, h: 100, rotation: 3 },
        },
        {
          id: 'body',
          type: 'text',
          role: 'body',
          content: richText('B'),
          fontSize: 19,
          align: 'right',
          valign: 'top',
          box: { x: 133, y: 40, w: 770, h: 300, rotation: 0 },
        },
      ],
    };
    fitToGrid(scene, THEME_REN);
    const { starts, ends } = columnEdges(THEME_REN);
    const [title, body] = scene.elements;
    expect(title!.box.x).toBe(starts[0]);
    expect(title!.box.rotation).toBe(0);
    expect(body!.box.x).toBe(starts[0]);
    expect(ends.map(Math.round)).toContain(body!.box.x + body!.box.w);
    expect(body!.box.y).toBeGreaterThanOrEqual(title!.box.y + title!.box.h);
    for (const el of scene.elements) {
      if (el.type !== 'text') continue;
      expect(el.fontSize).toBeUndefined();
      expect(el.levelScale).toBeUndefined();
      expect(el.align).toBe('left');
    }
  });

  it('lays out plain imported title scenes with room for the brand shapes', () => {
    const { project } = sampleProject();
    const front = project.scenes[0]!;
    front.decoration = false;
    const title = front.elements[0]!;
    title.box = { x: 240, y: 200, w: 1440, h: 300, rotation: 0 }; // centred across the slide
    layOutFrontScenes(project);
    expect(front.decoration).toBe(true);
    expect(front.elements.some((e) => overlapsDecoration(e.box))).toBe(false);
    // Content scenes are left where PowerPoint had them.
    expect(project.scenes[1]!.elements[1]!.box.x).toBe(120);
  });

  it('gives a laid out title scene its logo back when nothing covers it any more', () => {
    const { project } = sampleProject();
    const front = project.scenes[0]!;
    // Imported with the title over the logo's place.
    front.elements[0]!.box = { x: 100, y: 940, w: 900, h: 120, rotation: 0 };
    expect(front.elements.some(coversLogo)).toBe(true);
    front.showLogo = false;
    front.imported = { slide: 1, warnings: [WARNINGS.logo(false), WARNINGS.animation()] };
    layOutFrontScenes(project);
    expect(front.showLogo).toBe(true);
    expect(front.imported.warnings.map((w) => w.code)).toEqual(['animation']);
  });
});

describe('rich text in the editor', () => {
  it('survives a round trip through the editor’s document', () => {
    const text = {
      paragraphs: [
        { level: 0, list: 'bullet' as const, runs: [{ text: 'A', bold: true }, { text: ' B\nC' }] },
        {
          level: 2,
          list: 'number' as const,
          runs: [
            { text: 'D', italic: true, mark: true },
            { text: 'E', link: 'https://example.org/' },
            { text: 'CO' },
            { text: '2', script: 'sub' as const },
            { text: ' m' },
            { text: '2', script: 'super' as const },
          ],
        },
        { level: 0, list: 'none' as const, runs: [] },
      ],
    };
    expect(docToRichText(richTextToDoc(text))).toEqual(text);
  });
});

describe('HTML export', () => {
  const { project } = sampleProject();
  const sources = (overrides: Partial<ExportSources> = {}): ExportSources => ({
    playerJs: 'window.__player = true; var s = "</script>";',
    readFont: (face) => new TextEncoder().encode(`font:${face}`),
    readAsset: (file) => new TextEncoder().encode(`asset:${file}`),
    logo: {},
    sidecarHref: (_id, file) => `eksport_filer/${file.split('/').pop()}`,
    ...overrides,
  });

  it('writes fonts, data, assets and the player into one document', () => {
    const result = buildHtml(project, sources());
    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    expect(doc.documentElement.getAttribute('lang')).toBe('nb');
    expect(doc.title).toBe('Testforelesning');
    const data = JSON.parse(doc.getElementById('lysark-data')!.textContent!);
    expect(Project.parse(data.project).scenes).toHaveLength(3);
    const assetIds = Object.keys(data.assets);
    expect(assetIds).toHaveLength(1);
    expect(data.assets[assetIds[0]!]).toEqual({ mime: 'image/png', inline: true });
    expect(atob(doc.getElementById(`ls-asset-${assetIds[0]}`)!.textContent!)).toBe(
      'asset:media/testbilde.png',
    );
    expect(result.html).toContain("font-family:'Liberation Serif'");
    expect(result.html).not.toMatch(/<script[^>]+src=/);
    expect(result.html).not.toMatch(/<link\b/);
    expect(result.sidecar).toEqual([]);
    expect(result.logoMissing).toBe(true);
  });

  it('cannot be broken out of by content or by the player script', () => {
    const tricky = structuredClone(project);
    tricky.meta.title = '</title><script>alert(1)</script>';
    tricky.scenes[0]!.script = '</script><script>alert(2)</script>';
    const html = buildHtml(tricky, sources()).html;
    expect(html).not.toContain('<script>alert(');
    expect(html.match(/<\/script>/g)).toHaveLength(3); // data, one asset and the player
  });

  it('embeds the logo files unchanged when they exist', () => {
    const logo = { mime: 'image/svg+xml', data: new TextEncoder().encode('<svg/>') };
    const result = buildHtml(project, sources({ logo: { light: logo } }));
    const data = JSON.parse(
      new DOMParser().parseFromString(result.html, 'text/html').getElementById('lysark-data')!
        .textContent!,
    );
    expect(data.logo.light).toBe(`data:image/svg+xml;base64,${btoa('<svg/>')}`);
    expect(result.logoMissing).toBe(false);
  });

  it('places videos above the limit next to the file, and smaller ones inside it', () => {
    const withVideo = structuredClone(project);
    const big = newId('a');
    const small = newId('a');
    withVideo.assets[big] = {
      kind: 'video',
      file: 'media/stor.mp4',
      mime: 'video/mp4',
      bytes: INLINE_VIDEO_LIMIT_BYTES + 1,
    };
    withVideo.assets[small] = {
      kind: 'video',
      file: 'media/liten.mp4',
      mime: 'video/mp4',
      bytes: 1000,
    };
    for (const id of [big, small]) {
      withVideo.scenes[1]!.elements.push({
        id: newId('e'),
        type: 'video',
        source: { kind: 'asset', asset: id },
        title: 'Video',
        box: { x: 0, y: 0, w: 320, h: 180, rotation: 0 },
      });
    }
    const result = buildHtml(withVideo, sources());
    expect(result.sidecar).toEqual([
      {
        file: 'media/stor.mp4',
        href: 'eksport_filer/stor.mp4',
        bytes: INLINE_VIDEO_LIMIT_BYTES + 1,
      },
    ]);
    const data = JSON.parse(
      new DOMParser().parseFromString(result.html, 'text/html').getElementById('lysark-data')!
        .textContent!,
    );
    expect(data.assets[big]).toEqual({ mime: 'video/mp4', href: 'eksport_filer/stor.mp4' });
    expect(data.assets[small]).toEqual({ mime: 'video/mp4', inline: true });
  });

  it('includes only assets and font files that are used', () => {
    expect(usedAssets(project).size).toBe(1);
    expect(usedFonts(project)).toEqual(['sans-regular', 'sans-bold', 'serif-regular']);
    const italic = structuredClone(project);
    const body = italic.scenes[1]!.elements[1]!;
    if (body.type === 'text') body.content.paragraphs[0]!.runs[0]!.italic = true;
    expect(usedFonts(italic)).toContain('sans-italic');
  });
});

describe('project files', () => {
  it('accepts a valid project and explains what is wrong with others', () => {
    const { project } = sampleProject();
    expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
    expect(() => parseProject({ format: 'annet', version: 1 })).toThrow(/ikke et Lysark-prosjekt/);
    expect(() => parseProject({ ...project, version: 99 })).toThrow(/nyere utgave/);
    expect(() => parseProject({ ...project, scenes: 'x' })).toThrow(/skadet/);
  });

  it('refuses media paths outside the media folder', () => {
    const { project } = sampleProject();
    const id = Object.keys(project.assets)[0]!;
    const broken = structuredClone(project);
    broken.assets[id]!.file = '../hemmelig.png';
    expect(() => parseProject(broken)).toThrow();
  });
});
