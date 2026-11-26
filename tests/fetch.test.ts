// @vitest-environment happy-dom
// A figure in a "Lær mer" box is fetched from a slide: which things on a
// slide are figures, what a copy of one holds, how the box draws it, and
// what the export takes along for it. Nothing here is real subject matter.
import { describe, expect, it } from 'vitest';
import { usedAssets, usedFonts } from '../src/exporter/html';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import {
  FORMAT_VERSION,
  MoreBlock,
  parseProject,
  type Element,
  type ImageElement,
  type Project,
  type Scene,
  type ShapeElement,
} from '../src/shared/format/schema';
import { fetchFigure, figuresOn } from '../src/shared/layout/fetch';
import { connect, followFigures, groupElements } from '../src/shared/layout/groups';
import { addMark, followMarks } from '../src/shared/layout/marks';
import { NEW_FIGURE_SIZE, followTemplates, newFigure } from '../src/shared/layout/templates';
import { fitDrawings, moreAssets, renderMore } from '../src/shared/render/more';
import { createPopover } from '../src/shared/render/popover';
import { SCENE_STRINGS, type RenderContext } from '../src/shared/render/scene';
import { THEME_REN } from '../src/shared/theme/theme';

let counter = 0;
const newId = (): string => `n${++counter}`;

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

const box = (id: string, x: number, y: number, text = id): ShapeElement => ({
  id,
  type: 'shape',
  geometry: 'rect',
  fill: 'lilla',
  content: richText(text),
  box: { x, y, w: 200, h: 100, rotation: 0 },
});

/**
 * A slide with a process, a free figure of two boxes and an arrow, a picture
 * with two marks, a group that holds a video, and a box that stands alone.
 */
function slide(): { project: Project; scene: Scene } {
  const project = newProject('Test');
  project.assets.a_bilde = { kind: 'image', file: 'media/bilde.png', mime: 'image/png', bytes: 1 };
  project.assets.a_film = { kind: 'video', file: 'media/film.mp4', mime: 'video/mp4', bytes: 1 };
  const scene = newScene('content', 'A');
  const process = newFigure(
    'process',
    { x: 100, y: 100, ...NEW_FIGURE_SIZE.process, rotation: 0 },
    newId,
  );
  process.id = 'prosess';
  process.items = ['A', 'B'].map((text) => ({ id: newId(), text }));
  scene.elements.push(process);
  scene.elements.push(box('alene', 1500, 60));
  scene.elements.push(box('en', 300, 600, 'En'), box('to', 800, 700, 'To'));
  groupElements(scene, ['en', 'to'], () => 'g_fri');
  connect(scene, 'en', 'to', () => 'pil');
  const picture: ImageElement = {
    id: 'bilde',
    type: 'image',
    asset: 'a_bilde',
    alt: 'Bilde A',
    box: { x: 1200, y: 400, w: 400, h: 300, rotation: 0 },
  };
  scene.elements.push(picture);
  addMark(scene, 'bilde', newId)!.text = 'Merke A';
  addMark(scene, 'bilde', newId)!.text = 'Merke B';
  scene.elements.push(
    {
      id: 'film',
      type: 'video',
      source: { kind: 'asset', asset: 'a_film' },
      title: 'Film',
      box: { x: 100, y: 850, w: 300, h: 170, rotation: 0 },
    },
    {
      ...box('ved-film', 450, 850),
      more: { title: 'Mer', blocks: [{ id: 'b1', kind: 'heading', text: 'A' }] },
    },
  );
  groupElements(scene, ['film', 'ved-film'], () => 'g_film');
  followTemplates(scene);
  followFigures(scene);
  followMarks(scene);
  project.scenes.push(scene);
  return { project, scene };
}

describe('the figures of a slide', () => {
  it('are what the lecturer made as one thing: a figure with a form, a group, a marked picture', () => {
    const { scene } = slide();
    const figures = figuresOn(scene);
    expect(figures.map((figure) => figure.kind)).toEqual(['process', 'group', 'marked', 'group']);
    const byId = new Map(scene.elements.map((el) => [el.id, el]));
    // The process: the form and what it draws (two boxes and the arrow between them).
    expect(figures[0]!.ids.map((id) => byId.get(id)!.type)).toEqual([
      'figure',
      'shape',
      'shape',
      'shape',
    ]);
    // The free figure: the two boxes and the arrow that was put between them.
    expect(figures[1]!.ids).toEqual(['en', 'to', 'pil']);
    // The picture brings its marks and the list that explains them.
    expect(figures[2]!.ids.map((id) => byId.get(id)!.type)).toEqual([
      'image',
      'mark',
      'legend',
      'mark',
    ]);
    // A box that stands alone is no figure.
    expect(figures.some((figure) => figure.ids.includes('alene'))).toBe(false);
  });

  it('a group of nothing that can be drawn in a box is not offered', () => {
    const scene = newScene('content', 'A');
    const video = (id: string): Element => ({
      id,
      type: 'video',
      source: { kind: 'url', url: 'https://example.org/a.mp4' },
      title: '',
      box: { x: 0, y: 0, w: 300, h: 170, rotation: 0 },
    });
    scene.elements.push(video('v1'), video('v2'));
    groupElements(scene, ['v1', 'v2'], () => 'g');
    expect(figuresOn(scene)).toEqual([]);
  });
});

describe('a copy of a figure', () => {
  it('has ids of its own, stands where the figure stood, and is only drawn', () => {
    const { scene } = slide();
    const free = figuresOn(scene)[1]!;
    const copy = fetchFigure(scene, free, newId)!;
    expect(copy.left).toBe(0);
    expect(copy.elements).toHaveLength(3);
    const old = new Set(scene.elements.map((el) => el.id));
    expect(copy.elements.every((el) => !old.has(el.id))).toBe(true);
    // Nothing is held together or fastened in the copy.
    for (const el of copy.elements) {
      expect(el.group).toBeUndefined();
      if (el.type === 'shape') {
        expect(el.startAt).toBeUndefined();
        expect(el.endAt).toBeUndefined();
      }
    }
    expect(copy.elements.map((el) => el.box)).toEqual(
      free.ids.map((id) => scene.elements.find((el) => el.id === id)!.box),
    );
    // The frame holds the boxes, with a little room round them.
    expect(copy.frame).toEqual({ x: 288, y: 588, w: 724, h: 224 });
    // The slide is as it was.
    expect(scene.elements.find((el) => el.id === 'pil')).toMatchObject({
      startAt: 'en',
      endAt: 'to',
      group: 'g_fri',
    });
  });

  it('keeps a form with its parts, and a picture with its marks', () => {
    const { scene } = slide();
    const [process, , marked] = figuresOn(scene);
    const form = fetchFigure(scene, process!, newId)!;
    const holder = form.elements.find((el) => el.type === 'figure')!;
    const parts = form.elements.filter((el) => el.type !== 'figure');
    expect(parts).toHaveLength(3);
    expect(parts.every((el) => el.of?.figure === holder.id)).toBe(true);
    // The frame follows what is seen, not the frame of the form.
    expect(form.frame.x).toBe(100 - 12);

    const picture = fetchFigure(scene, marked!, newId)!;
    const image = picture.elements.find((el) => el.type === 'image')!;
    const belong = picture.elements.filter((el) => el.type === 'mark' || el.type === 'legend');
    expect(belong).toHaveLength(3);
    expect(belong.every((el) => 'on' in el && el.on === image.id)).toBe(true);
  });

  it('leaves out what cannot be drawn in a box, and "Lær mer" content inside it', () => {
    const { scene } = slide();
    const withFilm = figuresOn(scene)[3]!;
    const copy = fetchFigure(scene, withFilm, newId)!;
    expect(copy.left).toBe(1);
    expect(copy.elements).toHaveLength(1);
    expect('more' in copy.elements[0]!).toBe(false);
    expect(scene.elements.find((el) => el.id === 'ved-film')!.more).toBeDefined();
  });
});

describe('a figure in a "Lær mer" box', () => {
  /** The slide, with a text that has the process and the marked picture in its box. */
  function withBox(): { project: Project; scene: Scene; blocks: MoreBlock[] } {
    const { project, scene } = slide();
    const [process, , marked] = figuresOn(scene);
    const blocks: MoreBlock[] = [process!, marked!].map((figure, i) => ({
      id: `b_${i}`,
      kind: 'figure' as const,
      ...(({ elements, frame }) => ({ elements, frame }))(fetchFigure(scene, figure, newId)!),
      alt: i === 0 ? 'En prosess med to bokser' : '',
      ...(i === 0 ? { caption: 'Figurtekst A' } : {}),
    }));
    scene.elements.push({
      id: 'tekst',
      type: 'text',
      role: 'body',
      content: richText('Tekst'),
      align: 'left',
      valign: 'top',
      box: { x: 100, y: 40, w: 400, h: 50, rotation: 0 },
      more: { title: 'Mer', blocks },
    });
    return { project, scene, blocks };
  }

  it('is part of the format, and older projects are lifted to it', () => {
    const { project, blocks } = withBox();
    const parsed = parseProject(JSON.parse(JSON.stringify(project)));
    expect(parsed.version).toBe(FORMAT_VERSION);
    expect(parsed.scenes[0]!.elements.at(-1)!.more!.blocks).toEqual(blocks);
    // A figure in a box holds at least one element, and none with a box of its own.
    expect(MoreBlock.safeParse({ ...blocks[0]!, elements: [] }).success).toBe(false);
    const nested = structuredClone(blocks[0]!) as Extract<MoreBlock, { kind: 'figure' }>;
    (nested.elements[1] as Element).more = { title: 'Inni', blocks: [] };
    const read = MoreBlock.parse(nested) as Extract<MoreBlock, { kind: 'figure' }>;
    expect('more' in read.elements[1]!).toBe(false);
    const old = JSON.parse(JSON.stringify(project)) as { version: number; scenes: Scene[] };
    old.version = 13;
    old.scenes[0]!.elements.pop();
    expect(parseProject(old).version).toBe(FORMAT_VERSION);
    expect(FORMAT_VERSION).toBe(14);
  });

  it('is drawn by the code that draws the slide, in a holder that makes it fit', () => {
    const { project, scene, blocks } = withBox();
    const body = renderMore(context(project), scene.elements.at(-1)!.more!);
    const drawn = Array.from(body.querySelectorAll<HTMLElement>('.lm-drawn'));
    expect(drawn).toHaveLength(2);
    const [process, picture] = drawn;
    const first = blocks[0] as Extract<MoreBlock, { kind: 'figure' }>;
    const holder = process!.querySelector<HTMLElement>('.lm-drawing')!;
    expect(holder.style.aspectRatio.replace(/\s/g, '')).toBe(`${first.frame.w}/${first.frame.h}`);
    expect(holder.getAttribute('role')).toBe('group');
    expect(holder.getAttribute('aria-label')).toBe('En prosess med to bokser');
    expect(process!.querySelector('figcaption')!.textContent).toBe('Figurtekst A');
    // The stage is as large as the part of the slide the figure filled, and
    // every element stands in it where it stood in that part.
    const stage = holder.querySelector<HTMLElement>('.lm-stage')!;
    expect(stage.style.width).toBe(`${first.frame.w}px`);
    expect(stage.style.height).toBe(`${first.frame.h}px`);
    const parts = Array.from(stage.querySelectorAll<HTMLElement>(':scope > .ls-el'));
    expect(parts).toHaveLength(4);
    expect(stage.textContent).toBe('AB');
    const boxA = first.elements.find((el) => el.type === 'shape' && el.content)!;
    const node = stage.querySelector<HTMLElement>(`[data-part="${boxA.id}"]`)!;
    expect(node.style.left).toBe(`${boxA.box.x - first.frame.x}px`);
    expect(node.style.top).toBe(`${boxA.box.y - first.frame.y}px`);
    // Nothing in it is taken for an element of the slide, and nothing can be pressed.
    expect(body.querySelectorAll('[data-el]')).toHaveLength(0);
    expect(body.querySelectorAll('.lm-stage button, .ls-more-badge')).toHaveLength(0);

    // The picture with its numbered marks and the list that explains them.
    expect(picture!.querySelector('.lm-drawing')!.hasAttribute('role')).toBe(false);
    expect(picture!.querySelector('.ls-image img')!.getAttribute('src')).toBe('asset:a_bilde');
    expect(
      Array.from(picture!.querySelectorAll('.ls-mark-number')).map((el) => el.textContent),
    ).toEqual(['1', '2']);
    expect(
      Array.from(picture!.querySelectorAll('.ls-legend-text')).map((el) => el.textContent),
    ).toEqual(['Merke A', 'Merke B']);
  });

  it('fits the width its holder has', () => {
    const { project, scene, blocks } = withBox();
    const body = renderMore(context(project), scene.elements.at(-1)!.more!);
    document.body.appendChild(body);
    const holder = body.querySelector<HTMLElement>('.lm-drawing')!;
    const stage = holder.querySelector<HTMLElement>('.lm-stage')!;
    const { frame } = blocks[0] as Extract<MoreBlock, { kind: 'figure' }>;
    // Before it is measured: as in a box of ordinary width, never larger than three quarters.
    expect(stage.style.transform).toBe(`scale(${Math.min(0.75, 500 / frame.w)})`);
    Object.defineProperty(holder, 'clientWidth', { value: frame.w / 4, configurable: true });
    fitDrawings(body);
    expect(stage.style.transform).toBe('scale(0.25)');
    // The box that is drawn on the slide (video, recording) fits it when it is placed.
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      get: () => 300,
      configurable: true,
    });
    try {
      const pop = createPopover(context(project), scene.elements.at(-1)!)!;
      document.body.appendChild(pop.layer);
      pop.place();
      expect(pop.body.querySelector<HTMLElement>('.lm-stage')!.style.transform).toBe(
        `scale(${300 / frame.w})`,
      );
      pop.layer.remove();
    } finally {
      delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      body.remove();
    }
  });

  it('brings its pictures and its typefaces along in the export', () => {
    const { project, scene, blocks } = withBox();
    // The picture stands only in the box now.
    scene.elements = scene.elements.filter(
      (el) =>
        el.id === 'tekst' || (el.type !== 'image' && el.type !== 'mark' && el.type !== 'legend'),
    );
    expect(moreAssets(scene.elements.at(-1)!.more)).toEqual(['a_bilde']);
    expect(usedAssets(project).has('a_bilde')).toBe(true);
    // Italics inside a figure in a box need the italic face.
    expect(usedFonts(project)).not.toContain('sans-italic');
    const first = blocks[0] as Extract<MoreBlock, { kind: 'figure' }>;
    const shape = first.elements.find(
      (el): el is ShapeElement => el.type === 'shape' && !!el.content,
    )!;
    shape.content!.paragraphs[0]!.runs[0]!.italic = true;
    expect(usedFonts(project)).toContain('sans-italic');
  });
});
