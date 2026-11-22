// Renders one scene to DOM. The editor, the HTML player and (later) the
// video export all use this function, so they always show the same thing.
// The result depends only on the arguments: no clock, no randomness.
import { STAGE } from '../format/constants';
import {
  type DeepDiveElement,
  type Element as SceneElement,
  type ImageElement,
  type PaletteColor,
  type Project,
  type RichText,
  type Scene,
  type ShapeElement,
  type Surface,
  type TableElement,
  type TextElement,
  type VideoElement,
  type VideoSource,
} from '../format/schema';
import { isAllowedTextColor, isLargeText } from '../theme/contrast';
import { PALETTE, isDarkSurface } from '../theme/palette';
import { GRID_UNITS, SHAPE_PAIRS, decorationColors, shapePath } from '../theme/shapes';
import {
  DECORATION_BOX,
  defaultTextColor,
  logoVariant,
  markColors,
  roleFontSize,
  sceneSurface,
  type Theme,
} from '../theme/theme';
import { classifyLink, renderRichText } from './richtext';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Texts that appear inside scenes, in the language of the presentation. */
export interface SceneStrings {
  deepDive: string;
  opensInBrowser: string;
  missingImage: string;
  missingVideo: string;
  /** The file plays, but its picture is coded in a way the browser cannot show. */
  videoNoPicture: string;
  /** The file or address cannot be played at all. */
  videoUnplayable: string;
  logoAlt: string;
}

export interface RenderContext {
  doc: Document;
  project: Project;
  theme: Theme;
  /** 'edit' draws the same picture, but nothing in it can be activated. */
  mode: 'edit' | 'play';
  assetUrl: (assetId: string) => string | undefined;
  /** URLs of USN's original logo files, when the owner has supplied them. */
  logo: { light?: string; dark?: string };
  strings: SceneStrings;
}

let clipCounter = 0;

function svg<K extends keyof SVGElementTagNameMap>(
  doc: Document,
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const el = doc.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function setMarkVars(el: HTMLElement, background: PaletteColor): void {
  const mark = markColors(background);
  el.style.setProperty('--ls-mark-field', PALETTE[mark.field]);
  el.style.setProperty('--ls-mark-text', PALETTE[mark.text]);
}

function richTextInto(
  ctx: RenderContext,
  target: HTMLElement,
  content: RichText,
  levelScale: readonly number[] = ctx.theme.levelScale,
  spaceBefore?: readonly number[],
  indent?: ReadonlyArray<{ start: number; text: number }>,
): void {
  target.appendChild(
    renderRichText(content, {
      doc: ctx.doc,
      levelScale,
      spaceBefore,
      indent,
      interactive: ctx.mode === 'play',
    }),
  );
}

// ---------- Elements ----------

function renderText(ctx: RenderContext, scene: Scene, surface: Surface, el: TextElement): Node {
  const { doc, theme } = ctx;
  const role = theme.roles[el.role];
  const size = el.fontSize ?? roleFontSize(theme, el.role, scene.kind);
  const large = isLargeText(size, role.weight === 700);
  const color =
    el.color && isAllowedTextColor(el.color, surface, large)
      ? el.color
      : defaultTextColor(theme, surface, el.role, size);
  const box = doc.createElement('div');
  box.className = `ls-text ls-v-${el.valign} ls-role-${el.role}`;
  box.style.fontFamily = theme.fonts[role.font];
  box.style.fontSize = `${size}px`;
  box.style.fontWeight = String(role.weight);
  box.style.lineHeight = String(el.lineHeight ?? role.lineHeight);
  box.style.color = PALETTE[color];
  box.style.textAlign = el.align;
  richTextInto(ctx, box, el.content, el.levelScale, el.spaceBefore, el.indent);
  return box;
}

function renderImage(ctx: RenderContext, surface: Surface, el: ImageElement): Node {
  const { doc } = ctx;
  const frame = doc.createElement('div');
  frame.className = 'ls-image';
  const url = ctx.assetUrl(el.asset);
  if (!url) {
    const missing = doc.createElement('div');
    missing.className = 'ls-missing';
    missing.style.color = PALETTE[defaultTextColor(ctx.theme, surface, 'body', 28)];
    missing.textContent = ctx.strings.missingImage;
    frame.appendChild(missing);
    return frame;
  }
  const img = doc.createElement('img');
  img.src = url;
  img.alt = el.decorative ? '' : el.alt;
  img.draggable = false;
  if (el.crop) {
    const { l, t, r, b } = el.crop;
    const kx = Math.max(0.01, 1 - l - r);
    const ky = Math.max(0.01, 1 - t - b);
    img.style.width = `${100 / kx}%`;
    img.style.height = `${100 / ky}%`;
    img.style.left = `${(-l / kx) * 100}%`;
    img.style.top = `${(-t / ky) * 100}%`;
  }
  frame.appendChild(img);
  return frame;
}

function renderShape(ctx: RenderContext, surface: Surface, el: ShapeElement): Node {
  const { doc, theme } = ctx;
  const { w, h } = el.box;
  const wrap = doc.createElement('div');
  wrap.className = 'ls-shape';
  const sw = theme.shape.strokeWidth;
  const root = svg(doc, 'svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none' });
  root.setAttribute('aria-hidden', 'true');
  const lineColor = PALETTE[el.stroke ?? defaultTextColor(theme, surface, 'body', 36)];

  if (el.geometry === 'line' || el.geometry === 'arrow') {
    const x1 = el.flipH ? w : 0;
    const y1 = el.flipV ? h : 0;
    const x2 = el.flipH ? 0 : w;
    const y2 = el.flipV ? 0 : h;
    const length = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / length;
    const uy = (y2 - y1) / length;
    const head = el.geometry === 'arrow' ? sw * 4 : 0;
    // The line stops where the arrow head begins so the tip stays sharp.
    root.appendChild(
      svg(doc, 'line', {
        x1,
        y1,
        x2: x2 - ux * head * 0.9,
        y2: y2 - uy * head * 0.9,
        stroke: lineColor,
        'stroke-width': sw,
        'stroke-linecap': 'butt',
      }),
    );
    if (head) {
      const bx = x2 - ux * head;
      const by = y2 - uy * head;
      const half = head * 0.55;
      const points = [
        [x2, y2],
        [bx - uy * half, by + ux * half],
        [bx + uy * half, by - ux * half],
      ]
        .map((p) => `${p[0]},${p[1]}`)
        .join(' ');
      root.appendChild(svg(doc, 'polygon', { points, fill: lineColor }));
    }
    wrap.appendChild(root);
    return wrap;
  }

  const fill = el.fill ? PALETTE[el.fill] : 'none';
  const outlined = !el.fill;
  const inset = outlined ? sw / 2 : 0;
  const common = {
    fill,
    ...(outlined ? { stroke: lineColor, 'stroke-width': sw } : {}),
  };
  if (el.geometry === 'ellipse') {
    root.appendChild(
      svg(doc, 'ellipse', {
        cx: w / 2,
        cy: h / 2,
        rx: w / 2 - inset,
        ry: h / 2 - inset,
        ...common,
      }),
    );
  } else {
    const radius =
      el.geometry === 'roundRect' ? Math.min(theme.shape.cornerRadius, w / 2, h / 2) : 0;
    root.appendChild(
      svg(doc, 'rect', {
        x: inset,
        y: inset,
        width: Math.max(0, w - 2 * inset),
        height: Math.max(0, h - 2 * inset),
        rx: radius,
        ry: radius,
        ...common,
      }),
    );
  }
  wrap.appendChild(root);

  if (el.content) {
    const background: PaletteColor = el.fill ?? surface;
    const size = el.fontSize ?? theme.roles.body.size;
    const content = doc.createElement('div');
    content.className = 'ls-shape-content';
    if (el.align) content.style.textAlign = el.align;
    if (el.valign) {
      content.style.justifyContent =
        el.valign === 'top' ? 'flex-start' : el.valign === 'bottom' ? 'flex-end' : 'center';
    }
    if (el.textInset) {
      const { l, t, r, b } = el.textInset;
      content.style.padding = `${t}px ${r}px ${b}px ${l}px`;
    }
    if (el.textRotation) {
      // A text area with width and height swapped, turned about the shape's centre.
      content.style.inset = 'auto';
      content.style.left = `${(w - h) / 2}px`;
      content.style.top = `${(h - w) / 2}px`;
      content.style.width = `${h}px`;
      content.style.height = `${w}px`;
      content.style.transform = `rotate(${el.textRotation}deg)`;
    }
    content.style.fontFamily = theme.fonts.body;
    content.style.fontSize = `${size}px`;
    content.style.lineHeight = String(el.lineHeight ?? theme.roles.body.lineHeight);
    content.style.color = PALETTE[defaultTextColor(theme, background, 'body', size)];
    setMarkVars(content, background);
    richTextInto(ctx, content, el.content, el.levelScale, el.spaceBefore, el.indent);
    wrap.appendChild(content);
  }
  return wrap;
}

function renderTable(ctx: RenderContext, surface: Surface, el: TableElement): Node {
  const { doc, theme } = ctx;
  const size = el.fontSize ?? 30;
  const table = doc.createElement('table');
  table.className = 'ls-table';
  table.style.fontFamily = theme.fonts.body;
  table.style.fontSize = `${size}px`;
  table.style.lineHeight = '1.3';
  const text = defaultTextColor(theme, surface, 'body', size);
  table.style.color = PALETTE[text];
  const headBg: PaletteColor = surface === 'lilla' ? 'indigo' : 'lilla';
  table.style.setProperty('--ls-th-bg', PALETTE[headBg]);
  table.style.setProperty('--ls-th-text', PALETTE.hvit);
  table.style.setProperty('--ls-rule', PALETTE[text]);
  if (el.cellInset) {
    const { l, t, r, b } = el.cellInset;
    table.style.setProperty('--ls-cell-pad', `${t}px ${r}px ${b}px ${l}px`);
  }

  const total = el.columns.reduce((a, b) => a + b, 0);
  const colgroup = doc.createElement('colgroup');
  for (const width of el.columns) {
    const col = doc.createElement('col');
    col.style.width = `${(width / total) * 100}%`;
    colgroup.appendChild(col);
  }
  table.appendChild(colgroup);

  const body = doc.createElement('tbody');
  el.rows.forEach((row, rowIndex) => {
    const tr = doc.createElement('tr');
    row.forEach((cell, cellIndex) => {
      const header = el.headerRow && rowIndex === 0;
      const td = doc.createElement(header ? 'th' : 'td');
      if (header) td.setAttribute('scope', 'col');
      if (cell.colSpan && cell.colSpan > 1) td.colSpan = cell.colSpan;
      if (cell.rowSpan && cell.rowSpan > 1) td.rowSpan = cell.rowSpan;
      td.dataset.cell = `${rowIndex}:${cellIndex}`;
      richTextInto(ctx, td, cell.content);
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
  table.appendChild(body);
  return table;
}

const DIRECT_VIDEO = /\.(mp4|m4v|webm|ogv)([?#]|$)/i;

function playIcon(doc: Document): SVGElement {
  const icon = svg(doc, 'svg', { viewBox: '0 0 96 96' });
  icon.setAttribute('aria-hidden', 'true');
  icon.appendChild(svg(doc, 'circle', { cx: 48, cy: 48, r: 44, fill: 'currentColor' }));
  icon.appendChild(svg(doc, 'polygon', { points: '38,28 72,48 38,68', fill: 'var(--ls-card-bg)' }));
  return icon;
}

/** Resolves a video source to something a <video> can play, or a link. */
export function resolveVideo(
  source: VideoSource,
  assetUrl: (id: string) => string | undefined,
): { kind: 'file'; url: string } | { kind: 'link'; href: string } | { kind: 'missing' } {
  if (source.kind === 'asset') {
    const url = assetUrl(source.asset);
    return url ? { kind: 'file', url } : { kind: 'missing' };
  }
  const link = classifyLink(source.url);
  if (!link || link.kind !== 'external' || !/^https?:/i.test(link.href)) return { kind: 'missing' };
  return DIRECT_VIDEO.test(link.href)
    ? { kind: 'file', url: link.href }
    : { kind: 'link', href: link.href };
}

/**
 * Says so in the picture when a video cannot be shown, instead of leaving a
 * black player. A file whose picture is coded in a way the browser does not
 * support still plays its sound, so the player stays and gets a note.
 */
function watchVideo(ctx: RenderContext, figure: HTMLElement, video: HTMLVideoElement): void {
  const note = (text: string, hidePlayer: boolean): void => {
    if (figure.querySelector('.ls-video-note')) return;
    const p = ctx.doc.createElement('p');
    p.className = 'ls-video-note';
    p.setAttribute('role', 'note');
    p.textContent = text;
    figure.classList.add('ls-video-failed');
    if (hidePlayer) video.hidden = true;
    figure.appendChild(p);
  };
  video.addEventListener('loadedmetadata', () => {
    if (!(video.videoWidth > 0)) note(ctx.strings.videoNoPicture, false);
  });
  video.addEventListener('error', () => note(ctx.strings.videoUnplayable, true));
}

/** A video player, or a card that links out when the video cannot be embedded. */
export function renderVideo(
  ctx: RenderContext,
  surface: PaletteColor,
  source: VideoSource,
  title: string,
  poster: string | undefined,
): HTMLElement {
  const { doc } = ctx;
  const resolved = resolveVideo(source, ctx.assetUrl);
  const posterUrl = poster ? ctx.assetUrl(poster) : undefined;
  if (resolved.kind === 'file') {
    const figure = doc.createElement('figure');
    figure.className = 'ls-video';
    const video = doc.createElement('video');
    watchVideo(ctx, figure, video);
    video.src = resolved.url;
    video.preload = 'metadata';
    video.playsInline = true;
    if (ctx.mode === 'play') video.controls = true;
    if (title) video.setAttribute('aria-label', title);
    if (posterUrl) video.poster = posterUrl;
    figure.appendChild(video);
    return figure;
  }
  const dark = surface === 'lilla' || surface === 'indigo' || surface === 'sort';
  const card = doc.createElement(resolved.kind === 'link' && ctx.mode === 'play' ? 'a' : 'div');
  card.className = 'ls-videocard';
  card.style.setProperty('--ls-card-bg', PALETTE[dark ? 'hvit' : 'indigo']);
  card.style.setProperty('--ls-card-text', PALETTE[dark ? 'indigo' : 'hvit']);
  if (resolved.kind === 'missing') {
    card.textContent = ctx.strings.missingVideo;
    return card;
  }
  if (card.tagName === 'A') {
    const anchor = card as HTMLAnchorElement;
    anchor.href = resolved.href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  // The still picture that came with the video (PowerPoint stores one for
  // web videos) shows what the link leads to; it is a file in the project.
  if (posterUrl) {
    card.classList.add('ls-videocard-poster');
    const picture = doc.createElement('img');
    picture.className = 'ls-videocard-img';
    picture.src = posterUrl;
    picture.alt = '';
    picture.draggable = false;
    card.appendChild(picture);
  }
  const info = doc.createElement('span');
  info.className = 'ls-videocard-info';
  info.appendChild(playIcon(doc));
  const text = doc.createElement('span');
  text.className = 'ls-videocard-text';
  const label = doc.createElement('span');
  label.textContent = title || resolved.href;
  const note = doc.createElement('small');
  note.textContent = ctx.strings.opensInBrowser;
  text.append(label, note);
  info.appendChild(text);
  card.appendChild(info);
  return card;
}

function renderDeepDive(ctx: RenderContext, surface: Surface, el: DeepDiveElement): Node {
  const { doc } = ctx;
  const button = doc.createElement(ctx.mode === 'play' ? 'button' : 'div');
  button.className = 'ls-deepdive';
  if (ctx.mode === 'play') {
    button.setAttribute('type', 'button');
    button.dataset.deepdive = el.id;
    button.setAttribute('aria-haspopup', 'dialog');
  }
  const dark = isDarkSurface(surface);
  button.style.setProperty('--ls-button-bg', PALETTE[dark ? 'hvit' : 'lilla']);
  button.style.setProperty('--ls-button-text', PALETTE[dark ? 'lilla' : 'hvit']);
  button.style.fontFamily = ctx.theme.fonts.body;
  const label = doc.createElement('span');
  label.textContent = el.label.trim() || ctx.strings.deepDive;
  button.appendChild(label);
  return button;
}

function renderElement(ctx: RenderContext, scene: Scene, surface: Surface, el: SceneElement): Node {
  switch (el.type) {
    case 'text':
      return renderText(ctx, scene, surface, el);
    case 'image':
      return renderImage(ctx, surface, el);
    case 'shape':
      return renderShape(ctx, surface, el);
    case 'table':
      return renderTable(ctx, surface, el);
    case 'video':
      return renderVideo(ctx, surface, (el as VideoElement).source, el.title, el.poster);
    case 'deepdive':
      return renderDeepDive(ctx, surface, el);
  }
}

// ---------- Scene ----------

function renderDecoration(ctx: RenderContext, scene: Scene, surface: Surface): SVGElement {
  const { doc } = ctx;
  const pair = SHAPE_PAIRS[scene.shapeVariant % SHAPE_PAIRS.length]!;
  const colors = decorationColors(surface);
  const box = DECORATION_BOX;
  const cell = box.w / GRID_UNITS;
  const root = svg(doc, 'svg', { viewBox: `0 0 ${box.w} ${box.h}`, width: box.w, height: box.h });
  root.setAttribute('class', 'ls-decoration');
  root.setAttribute('aria-hidden', 'true');
  root.style.left = `${box.x}px`;
  root.style.top = `${box.y}px`;
  const a = shapePath(pair.a, cell);
  const b = shapePath(pair.b, cell);
  const clipId = `ls-clip-${++clipCounter}`;
  const clip = svg(doc, 'clipPath', { id: clipId });
  clip.appendChild(svg(doc, 'path', { d: a }));
  root.appendChild(clip);
  root.appendChild(svg(doc, 'path', { d: a, fill: PALETTE[colors.a] }));
  root.appendChild(svg(doc, 'path', { d: b, fill: PALETTE[colors.b] }));
  // The overlap is its own colour: two shapes become three.
  root.appendChild(
    svg(doc, 'path', { d: b, fill: PALETTE[colors.overlap], 'clip-path': `url(#${clipId})` }),
  );
  return root;
}

/** Reading order for assistive technology: titles first, then top to bottom. */
function readingOrder(elements: SceneElement[]): SceneElement[] {
  const rank = (el: SceneElement): number => (el.type === 'text' && el.role === 'title' ? 0 : 1);
  return [...elements].sort((p, q) => {
    if (rank(p) !== rank(q)) return rank(p) - rank(q);
    const rowTolerance = 40;
    if (Math.abs(p.box.y - q.box.y) > rowTolerance) return p.box.y - q.box.y;
    return p.box.x - q.box.x;
  });
}

export function renderScene(ctx: RenderContext, scene: Scene): HTMLElement {
  const { doc, theme } = ctx;
  const surface = sceneSurface(theme, scene);
  const root = doc.createElement('section');
  root.className = `ls-scene ls-kind-${scene.kind}`;
  root.dataset.scene = scene.id;
  root.style.background = PALETTE[surface];
  root.style.fontFamily = theme.fonts.body;
  root.style.color = PALETTE[defaultTextColor(theme, surface, 'body', theme.roles.body.size)];
  setMarkVars(root, surface);

  if (scene.decoration) root.appendChild(renderDecoration(ctx, scene, surface));

  const zIndex = new Map(scene.elements.map((el, i) => [el.id, i + 1]));
  for (const el of readingOrder(scene.elements)) {
    const wrap = doc.createElement('div');
    wrap.className = `ls-el ls-el-${el.type}`;
    wrap.dataset.el = el.id;
    wrap.style.left = `${el.box.x}px`;
    wrap.style.top = `${el.box.y}px`;
    wrap.style.width = `${el.box.w}px`;
    wrap.style.height = `${el.box.h}px`;
    wrap.style.zIndex = String(zIndex.get(el.id));
    if (el.type === 'image' && el.blend) wrap.style.mixBlendMode = el.blend;
    if (el.box.rotation) wrap.style.transform = `rotate(${el.box.rotation}deg)`;
    wrap.appendChild(renderElement(ctx, scene, surface, el));
    root.appendChild(wrap);
  }

  const logoUrl = scene.showLogo ? ctx.logo[logoVariant(surface)] : undefined;
  if (logoUrl) {
    const logo = doc.createElement('img');
    logo.className = 'ls-logo';
    logo.src = logoUrl;
    logo.alt = ctx.strings.logoAlt;
    logo.draggable = false;
    logo.style.left = `${theme.logo.marginX}px`;
    logo.style.top = `${STAGE.height - theme.logo.marginBottom - theme.logo.height}px`;
    logo.style.height = `${theme.logo.height}px`;
    root.appendChild(logo);
  }
  return root;
}

/** The scene strings in each supported language. */
export const SCENE_STRINGS: Record<Project['meta']['language'], SceneStrings> = {
  nb: {
    deepDive: 'Lær mer',
    opensInBrowser: 'Åpnes i nettleseren (krever nett)',
    missingImage: 'Bildefila mangler',
    missingVideo: 'Videoen mangler',
    videoNoPicture:
      'Bildet i videoen kan ikke vises her, bare lyden. Lagre videoen som MP4 med H.264 eller som WebM.',
    videoUnplayable:
      'Videoen kan ikke spilles av her. Fila mangler, kan ikke hentes, eller er kodet på en måte som ikke støttes.',
    logoAlt: 'Universitetet i Sørøst-Norge',
  },
  en: {
    deepDive: 'Learn more',
    opensInBrowser: 'Opens in the browser (needs internet)',
    missingImage: 'The image file is missing',
    missingVideo: 'The video is missing',
    videoNoPicture:
      'The picture in this video cannot be shown here, only the sound. Save the video as MP4 with H.264 or as WebM.',
    videoUnplayable:
      'The video cannot be played here. The file is missing, cannot be fetched, or is coded in an unsupported way.',
    logoAlt: 'University of South-Eastern Norway',
  },
};
