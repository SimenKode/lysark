// Renders one scene to DOM. The editor, the HTML player and the
// video export all use this function, so they always show the same thing.
// The result depends only on the arguments: no clock, no randomness.
import {
  type DeepDiveElement,
  type DrawnElement,
  type Element as SceneElement,
  type FigureElement,
  type ImageElement,
  type LegendElement,
  type MarkElement,
  type More,
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
  defaultTextColor,
  logoVariant,
  markColors,
  roleFontSize,
  sceneSurface,
  type Theme,
} from '../theme/theme';
import { labelLineStart, markNumber, markStyle, marksOf, pictureOf } from '../layout/marks';
import { chartTable, isChart } from '../layout/charts';
import { barGrowsFrom, connectionList, rowOrder } from '../layout/rows';
import { classifyLink, renderRichText } from './richtext';
import { embedTarget, youtubeEmbedUrl, youtubeRef, youtubeWatchUrl, type YouTubeRef } from './web';

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
  /** A video file on the web: not fetched while editing. */
  playsFromWeb: string;
  /** On the still picture of a YouTube video in a file opened from disk, where it cannot play in place. */
  playOnYouTube: string;
  openOnYouTube: string;
  /** Under a YouTube video that plays in the slide. */
  youtubeInPlace: string;
  /** Under a YouTube video that can only be opened on YouTube (file opened from disk). */
  youtubeOpens: string;
  /** On the button that fetches an embedded page. */
  embedLoad: (host: string) => string;
  openInBrowser: string;
  needsInternet: string;
  /** Name of the "+" mark for screen readers. */
  moreAbout: (title: string) => string;
  /** Shown in the editor in a mark that has no text yet. */
  markEmpty: string;
  /** Shown in the editor in a figure whose form has no rows. */
  figureEmpty: string;
  /** A connection of a network, as it is read: with direction (an arrow) or without. */
  connection: (from: string, to: string, arrow: boolean) => string;
  creditBy: string;
  creditSource: string;
  creditCropped: string;
  logoAlt: string;
  /** What the closing animation is, for those who cannot see it. */
  closingAlt: string;
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
  /** URL of USN's closing animation, when the owner has supplied it. */
  closing?: string;
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

/**
 * Length of an arrow head for a stroke of the given width. It grows with
 * the stroke, but a thin arrow still gets a head that can be seen.
 */
export function arrowHeadLength(strokeWidth: number): number {
  return strokeWidth * 3 + 6;
}

/** The side margin of text in a shape when the shape has none of its own (see .ls-shape-content). */
const SHAPE_TEXT_MARGIN = 14;

/** How far the point of a sign reaches in from its end: half the short side, as in PowerPoint. */
export function signPoint(w: number, h: number): number {
  return Math.min(Math.min(w, h) / 2, w * 0.6);
}

function renderShape(ctx: RenderContext, surface: Surface, el: ShapeElement): Node {
  const { doc, theme } = ctx;
  const { w, h } = el.box;
  const wrap = doc.createElement('div');
  wrap.className = 'ls-shape';
  const sw = el.strokeWidth ?? theme.shape.strokeWidth;
  const root = svg(doc, 'svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none' });
  root.setAttribute('aria-hidden', 'true');
  const lineColor = PALETTE[el.stroke ?? defaultTextColor(theme, surface, 'body', 36)];

  const path = (el.points ?? []).filter((p): p is [number, number] => p !== null);
  if ((el.geometry === 'line' || el.geometry === 'arrow') && path.length >= 2) {
    // A line through points of its own. The head of an arrow sits at the
    // last point and points the way the last stretch runs.
    const at = (value: number): string => String(Number(value.toFixed(2)));
    const points = path.map(([fx, fy]) => ({ x: fx * w, y: fy * h }));
    const tip = points[points.length - 1]!;
    let from = points[points.length - 2]!;
    for (let i = points.length - 2; i >= 0 && Math.hypot(tip.x - from.x, tip.y - from.y) < 1e-6; i--) {
      from = points[i]!;
    }
    const last = Math.hypot(tip.x - from.x, tip.y - from.y);
    const ux = last > 0 ? (tip.x - from.x) / last : 1;
    const uy = last > 0 ? (tip.y - from.y) / last : 0;
    const head = el.geometry === 'arrow' ? arrowHeadLength(sw) : 0;
    // The line stops where the arrow head begins so the tip stays sharp.
    const cut = Math.min(head * 0.9, last);
    const drawn = [...points.slice(0, -1), { x: tip.x - ux * cut, y: tip.y - uy * cut }];
    root.appendChild(
      svg(doc, 'polyline', {
        points: drawn.map((p) => `${at(p.x)},${at(p.y)}`).join(' '),
        fill: 'none',
        stroke: lineColor,
        'stroke-width': sw,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'butt',
      }),
    );
    if (head) {
      const bx = tip.x - ux * head;
      const by = tip.y - uy * head;
      const half = head * 0.55;
      const corners = [
        [tip.x, tip.y],
        [bx - uy * half, by + ux * half],
        [bx + uy * half, by - ux * half],
      ]
        .map((p) => `${at(p[0]!)},${at(p[1]!)}`)
        .join(' ');
      root.appendChild(svg(doc, 'polygon', { points: corners, fill: lineColor }));
    }
    wrap.appendChild(root);
    return wrap;
  }

  if (el.geometry === 'line' || el.geometry === 'arrow') {
    // A line that lies flat or stands upright has a box one pixel thin. It is
    // drawn through the middle of that pixel, not from corner to corner: the
    // slope of one pixel made the axes of a diagram look uneven.
    const flat = h <= 1;
    const upright = w <= 1;
    const x1 = upright ? w / 2 : el.flipH ? w : 0;
    const y1 = flat ? h / 2 : el.flipV ? h : 0;
    const x2 = upright ? w / 2 : el.flipH ? 0 : w;
    const y2 = flat ? h / 2 : el.flipV ? 0 : h;
    const length = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / length;
    const uy = (y2 - y1) / length;
    const head = el.geometry === 'arrow' ? arrowHeadLength(sw) : 0;
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

  if (el.geometry === 'curve') {
    // One line through the points, broken where a point is missing. A point
    // that stands alone is a dot, or it would not be seen.
    const runs: Array<Array<[number, number]>> = [];
    let run: Array<[number, number]> = [];
    for (const point of el.points ?? []) {
      if (point) run.push([point[0] * w, point[1] * h]);
      else if (run.length > 0) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length > 0) runs.push(run);
    const at = (value: number): string => String(Number(value.toFixed(2)));
    for (const one of runs) {
      if (one.length > 1) {
        root.appendChild(
          svg(doc, 'polyline', {
            points: one.map((p) => `${at(p[0])},${at(p[1])}`).join(' '),
            fill: 'none',
            stroke: lineColor,
            'stroke-width': sw,
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round',
          }),
        );
      }
      if (el.dots || one.length === 1) {
        for (const p of one) {
          root.appendChild(
            svg(doc, 'circle', { cx: at(p[0]), cy: at(p[1]), r: sw * 1.4 + 2, fill: lineColor }),
          );
        }
      }
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
  const point = el.geometry === 'sign' ? signPoint(w, h) : 0;
  if (el.geometry === 'sign') {
    // A rectangle with a point: flat end, two long sides, and the point.
    const corners = [
      [inset, inset],
      [w - point, inset],
      [w - inset, h / 2],
      [w - point, h - inset],
      [inset, h - inset],
    ].map(([x, y]) => `${el.flipH ? w - x! : x},${y}`);
    root.appendChild(
      svg(doc, 'polygon', { points: corners.join(' '), 'stroke-linejoin': 'round', ...common }),
    );
  } else if (el.geometry === 'ellipse') {
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
    // The text of a sign keeps clear of its point.
    if (point && !el.textRotation) {
      const side = el.flipH ? 'paddingLeft' : 'paddingRight';
      const own = (el.flipH ? el.textInset?.l : el.textInset?.r) ?? SHAPE_TEXT_MARGIN;
      content.style[side] = `${own + point * 0.7}px`;
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
  table.style.lineHeight = String(el.lineHeight ?? 1.3);
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
    // The least height of the row; its text can make it taller.
    const least = el.rowHeights?.[rowIndex];
    if (least) tr.style.height = `${least}px`;
    row.forEach((cell, cellIndex) => {
      const header = el.headerRow && rowIndex === 0;
      const td = doc.createElement(header ? 'th' : 'td');
      if (header) td.setAttribute('scope', 'col');
      if (cell.colSpan && cell.colSpan > 1) td.colSpan = cell.colSpan;
      if (cell.rowSpan && cell.rowSpan > 1) td.rowSpan = cell.rowSpan;
      td.dataset.cell = `${rowIndex}:${cellIndex}`;
      if (cell.scale && cell.scale !== 1) td.style.fontSize = `${cell.scale}em`;
      if (cell.align && cell.align !== 'left') td.style.textAlign = cell.align;
      if (cell.valign && cell.valign !== 'top') td.style.verticalAlign = cell.valign;
      richTextInto(ctx, td, cell.content, undefined, el.spaceBefore);
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

/** Resolves a video source to something a <video> can play, a YouTube video, or a link. */
export function resolveVideo(
  source: VideoSource,
  assetUrl: (id: string) => string | undefined,
):
  | { kind: 'file'; url: string; remote: boolean }
  | { kind: 'youtube'; ref: YouTubeRef }
  | { kind: 'link'; href: string }
  | { kind: 'missing' } {
  if (source.kind === 'asset') {
    const url = assetUrl(source.asset);
    return url ? { kind: 'file', url, remote: false } : { kind: 'missing' };
  }
  const link = classifyLink(source.url);
  if (!link || link.kind !== 'external' || !/^https?:/i.test(link.href)) return { kind: 'missing' };
  if (DIRECT_VIDEO.test(link.href)) return { kind: 'file', url: link.href, remote: true };
  const ref = youtubeRef(link.href);
  return ref ? { kind: 'youtube', ref } : { kind: 'link', href: link.href };
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

function cardColors(card: HTMLElement, surface: PaletteColor): void {
  const dark = surface === 'lilla' || surface === 'indigo' || surface === 'sort';
  card.style.setProperty('--ls-card-bg', PALETTE[dark ? 'hvit' : 'indigo']);
  card.style.setProperty('--ls-card-text', PALETTE[dark ? 'indigo' : 'hvit']);
}

function cardText(doc: Document, title: string, note: string): HTMLElement {
  const text = doc.createElement('span');
  text.className = 'ls-videocard-text';
  const label = doc.createElement('span');
  label.textContent = title;
  const small = doc.createElement('small');
  small.textContent = note;
  text.append(label, small);
  return text;
}

function posterImage(doc: Document, url: string): HTMLImageElement {
  const picture = doc.createElement('img');
  picture.className = 'ls-videocard-img';
  picture.src = url;
  picture.alt = '';
  picture.draggable = false;
  return picture;
}

function webFrame(
  doc: Document,
  kind: 'youtube' | 'embed',
  url: string,
  title: string,
): HTMLIFrameElement {
  const frame = doc.createElement('iframe');
  frame.className = 'ls-webvideo-frame';
  frame.title = title;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
  frame.allowFullscreen = true;
  if (kind === 'embed') {
    frame.setAttribute(
      'sandbox',
      'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation',
    );
  }
  frame.src = url;
  return frame;
}

/**
 * Content from the web. The card itself holds only what lies in the file: a
 * still picture, a title and a link that always works.
 *
 * A YouTube video is shown as YouTube's player, in place (the owner's
 * choice, 22.11.2026). The card is drawn with the still picture and a mark
 * that says which frame belongs there; `activateWebFrames` puts the frame
 * in when the slide is shown, so nothing is fetched for slides that are
 * not on screen, for print or for video. In a file opened straight from
 * disk YouTube refuses to play ("Error 153", tried 22.11.2026), so there
 * the still picture stays and its button opens YouTube instead.
 *
 * Any other embedded page is fetched only when the viewer presses its
 * button; then the frame takes the button's place.
 */
function renderWebFrame(
  ctx: RenderContext,
  surface: PaletteColor,
  o: {
    kind: 'youtube' | 'embed';
    frameUrl: string;
    linkUrl: string;
    title: string;
    cta: string;
    note: string;
    linkText: string;
    posterUrl?: string;
  },
): HTMLElement {
  const { doc } = ctx;
  const play = ctx.mode === 'play';
  const fromDisk = doc.defaultView?.location.protocol === 'file:';
  // A YouTube player that is put in place without a click.
  const direct = play && o.kind === 'youtube' && !fromDisk;
  const card = doc.createElement('div');
  card.className = `ls-videocard ls-webvideo ls-webvideo-${o.kind}`;
  cardColors(card, surface);

  const button = doc.createElement(play && !direct ? 'button' : 'div');
  button.className = 'ls-webvideo-play';
  if (o.posterUrl) button.appendChild(posterImage(doc, o.posterUrl));
  const cta = doc.createElement('span');
  cta.className = 'ls-webvideo-cta';
  if (o.kind === 'youtube') cta.appendChild(playIcon(doc));
  if (o.cta) {
    const ctaText = doc.createElement('span');
    ctaText.textContent = o.cta;
    cta.appendChild(ctaText);
  } else {
    cta.classList.add('ls-webvideo-cta-icon');
  }
  button.appendChild(cta);

  if (direct) {
    button.dataset.frame = o.frameUrl;
    button.dataset.frameTitle = o.title || o.linkText;
  } else if (play) {
    button.setAttribute('type', 'button');
    if (o.title) button.setAttribute('aria-label', `${o.cta}: ${o.title}`);
    button.addEventListener('click', () => {
      if (o.kind === 'youtube') {
        doc.defaultView?.open(o.linkUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      const frame = webFrame(doc, o.kind, o.frameUrl, o.title || o.cta);
      button.replaceWith(frame);
      frame.focus();
    });
  }

  const info = doc.createElement('span');
  info.className = 'ls-videocard-info';
  info.appendChild(cardText(doc, o.title || o.linkUrl, o.note));
  const link = doc.createElement(play ? 'a' : 'span');
  link.className = 'ls-webvideo-open';
  link.textContent = o.linkText;
  if (play) {
    const anchor = link as HTMLAnchorElement;
    anchor.href = o.linkUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  info.appendChild(link);
  card.append(button, info);
  return card;
}

/**
 * Puts YouTube's player into every video card under `root` that waits for
 * one. The player calls this when a slide, or a "Lær mer" panel, is shown.
 * Returns how many frames were put in.
 */
export function activateWebFrames(root: Element): number {
  const waiting = Array.from(root.querySelectorAll<HTMLElement>('.ls-webvideo-play[data-frame]'));
  for (const holder of waiting) {
    const frame = webFrame(
      holder.ownerDocument,
      'youtube',
      holder.dataset.frame!,
      holder.dataset.frameTitle ?? '',
    );
    holder.replaceWith(frame);
  }
  return waiting.length;
}

/** A page from the web shown in a frame, fetched only when the viewer asks for it. */
export function renderEmbed(
  ctx: RenderContext,
  surface: PaletteColor,
  address: string,
  title: string,
): HTMLElement | undefined {
  const ref = youtubeRef(address);
  if (ref) return renderVideo(ctx, surface, { kind: 'url', url: address }, title, undefined);
  const target = embedTarget(address);
  if (!target) return undefined;
  return renderWebFrame(ctx, surface, {
    kind: 'embed',
    frameUrl: target.href,
    linkUrl: target.href,
    title,
    cta: ctx.strings.embedLoad(target.host),
    note: ctx.strings.needsInternet,
    linkText: ctx.strings.openInBrowser,
  });
}

/**
 * A video player; a YouTube video shown as YouTube's own player; or a card
 * that links out when the video cannot be shown in place.
 */
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
  // While editing nothing is fetched from the web: a video file that lies
  // on a server is drawn as a card, and plays only in the presentation.
  if (resolved.kind === 'file' && !(resolved.remote && ctx.mode === 'edit')) {
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
  if (resolved.kind === 'youtube') {
    // Opened from disk the still picture stays, and its button opens YouTube.
    const fromDisk = ctx.mode === 'play' && doc.defaultView?.location.protocol === 'file:';
    return renderWebFrame(ctx, surface, {
      kind: 'youtube',
      frameUrl: youtubeEmbedUrl(resolved.ref),
      linkUrl: youtubeWatchUrl(resolved.ref),
      title,
      cta: fromDisk ? ctx.strings.playOnYouTube : '',
      note: fromDisk ? ctx.strings.youtubeOpens : ctx.strings.youtubeInPlace,
      linkText: ctx.strings.openOnYouTube,
      posterUrl,
    });
  }
  const linked = resolved.kind === 'link';
  const card = doc.createElement(linked && ctx.mode === 'play' ? 'a' : 'div');
  card.className = 'ls-videocard';
  cardColors(card, surface);
  if (resolved.kind === 'missing') {
    card.textContent = ctx.strings.missingVideo;
    return card;
  }
  const href = resolved.kind === 'link' ? resolved.href : resolved.url;
  if (card.tagName === 'A') {
    const anchor = card as HTMLAnchorElement;
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  // The still picture that came with the video (PowerPoint stores one for
  // web videos) shows what the link leads to; it is a file in the project.
  if (posterUrl) {
    card.classList.add('ls-videocard-poster');
    card.appendChild(posterImage(doc, posterUrl));
  }
  const info = doc.createElement('span');
  info.className = 'ls-videocard-info';
  info.appendChild(playIcon(doc));
  info.appendChild(
    cardText(doc, title || href, linked ? ctx.strings.opensInBrowser : ctx.strings.playsFromWeb),
  );
  card.appendChild(info);
  return card;
}

/**
 * The "Lær mer" content of an element, when there is something to open. The
 * "+ Lær mer" button always has a panel; other elements only when the owner
 * has put something in it.
 */
export function moreOf(el: SceneElement): More | undefined {
  if (el.type === 'deepdive') return el.more ?? { title: el.label, blocks: [] };
  return el.more && el.more.blocks.length > 0 ? el.more : undefined;
}

/** Heading of an element's panel. */
export function moreTitle(ctx: RenderContext, el: SceneElement): string {
  const own = el.more?.title.trim();
  if (own) return own;
  return el.type === 'deepdive' ? el.label.trim() || ctx.strings.deepDive : ctx.strings.deepDive;
}

/**
 * Where the mark sits when the owner has not chosen a corner. For text it
 * follows the text: a text box is often much wider than the words in it, so
 * the mark goes to the side and edge the text is aligned to. Everything
 * else gets it top right.
 */
export function moreCorner(el: SceneElement): NonNullable<More['corner']> {
  if (el.more?.corner) return el.more.corner;
  if (el.type !== 'text') return 'tr';
  const vertical = el.valign === 'bottom' ? 'b' : 't';
  const horizontal = el.align === 'left' ? 'l' : 'r';
  return `${vertical}${horizontal}` as NonNullable<More['corner']>;
}

const BADGE_SIZE = 56;
/** How far the mark reaches outside the corner of its element. */
const BADGE_OUT = 16;
const BADGE_EDGE = 6;

/** The round "+" mark on an element that has "Lær mer" content. Always visible, never hover-only. */
function renderMoreBadge(
  ctx: RenderContext,
  surface: Surface,
  el: SceneElement,
  more: More,
): HTMLElement {
  const { doc } = ctx;
  const play = ctx.mode === 'play';
  const badge = doc.createElement(play ? 'button' : 'span');
  badge.className = 'ls-more-badge';
  badge.textContent = '+';
  const corner = moreCorner(el);
  // Just outside the chosen corner, but never outside the scene.
  const clamp = (value: number, max: number): number =>
    Math.max(BADGE_EDGE, Math.min(max - BADGE_SIZE - BADGE_EDGE, value));
  const x = corner.endsWith('r') ? el.box.w - BADGE_SIZE + BADGE_OUT : -BADGE_OUT;
  const y = corner.startsWith('t') ? -BADGE_OUT : el.box.h - BADGE_SIZE + BADGE_OUT;
  const rotated = el.box.rotation !== 0;
  const stage = ctx.theme.stage;
  badge.style.left = `${rotated ? x : clamp(el.box.x + x, stage.width) - el.box.x}px`;
  badge.style.top = `${rotated ? y : clamp(el.box.y + y, stage.height) - el.box.y}px`;
  const dark = isDarkSurface(surface);
  badge.style.setProperty('--ls-badge-bg', PALETTE[dark ? 'hvit' : 'lilla']);
  badge.style.setProperty('--ls-badge-text', PALETTE[dark ? 'lilla' : 'hvit']);
  badge.style.setProperty('--ls-badge-ring', PALETTE[dark ? 'lilla' : 'hvit']);
  if (play) {
    badge.setAttribute('type', 'button');
    badge.dataset.more = el.id;
    badge.setAttribute('aria-haspopup', 'dialog');
    badge.setAttribute('aria-expanded', 'false');
    badge.setAttribute('aria-label', ctx.strings.moreAbout(more.title.trim()));
  } else {
    badge.setAttribute('aria-hidden', 'true');
  }
  return badge;
}

function renderDeepDive(ctx: RenderContext, surface: Surface, el: DeepDiveElement): Node {
  const { doc } = ctx;
  const button = doc.createElement(ctx.mode === 'play' ? 'button' : 'div');
  button.className = 'ls-deepdive';
  if (ctx.mode === 'play') {
    button.setAttribute('type', 'button');
    button.dataset.more = el.id;
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
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

/**
 * A mark on a picture: a numbered point, or a label with a line to what it
 * points at. A mark with "Lær mer" content is itself what is pressed.
 */
function renderMark(ctx: RenderContext, scene: Scene, el: MarkElement): Node {
  const { doc } = ctx;
  const numbers = markStyle(pictureOf(scene, el)) === 'numbers';
  const more = moreOf(el);
  const pressed = ctx.mode === 'play' && !!more;
  const node = doc.createElement(pressed ? 'button' : 'div');
  node.className = `ls-mark ${numbers ? 'ls-mark-number' : 'ls-mark-label'}${more ? ' ls-mark-more' : ''}`;
  node.style.fontFamily = ctx.theme.fonts.body;
  const number = markNumber(scene, el);
  const text = el.text.trim();
  if (pressed) {
    node.setAttribute('type', 'button');
    node.dataset.more = el.id;
    node.setAttribute('aria-haspopup', 'dialog');
    node.setAttribute('aria-expanded', 'false');
    node.setAttribute('aria-label', ctx.strings.moreAbout(text || more.title.trim()));
  }
  if (numbers) {
    node.textContent = String(number);
    return node;
  }
  // The line starts at the edge of the label and ends in a dot on what it
  // points at. It is drawn twice, white under dark, so it shows on any picture.
  const from = labelLineStart(el.box, el.point);
  const line = svg(doc, 'svg', { width: 1, height: 1 });
  line.setAttribute('class', 'ls-mark-line');
  line.setAttribute('aria-hidden', 'true');
  const ends = {
    x1: from.x - el.box.x,
    y1: from.y - el.box.y,
    x2: el.point.x - el.box.x,
    y2: el.point.y - el.box.y,
  };
  line.appendChild(svg(doc, 'line', { ...ends, class: 'ls-mark-line-under' }));
  line.appendChild(svg(doc, 'line', { ...ends, class: 'ls-mark-line-over' }));
  line.appendChild(svg(doc, 'circle', { cx: ends.x2, cy: ends.y2, r: 9, class: 'ls-mark-dot' }));
  node.appendChild(line);
  const label = doc.createElement('span');
  label.className = 'ls-mark-text';
  if (text) label.textContent = text;
  else if (ctx.mode === 'edit') {
    label.textContent = ctx.strings.markEmpty;
    label.classList.add('ls-mark-empty');
  }
  node.appendChild(label);
  return node;
}

/** The list that explains the numbered marks of a picture. */
function renderLegend(ctx: RenderContext, scene: Scene, el: LegendElement): Node {
  const { doc } = ctx;
  const list = doc.createElement('ol');
  list.className = 'ls-legend';
  list.style.fontFamily = ctx.theme.fonts.body;
  for (const mark of marksOf(scene, el.on)) {
    const row = doc.createElement('li');
    // A row comes in with its mark, when the mark comes in at a step.
    row.dataset.follows = mark.id;
    const number = doc.createElement('span');
    number.className = 'ls-legend-number';
    number.setAttribute('aria-hidden', 'true');
    number.textContent = String(markNumber(scene, mark));
    const text = doc.createElement('span');
    text.className = 'ls-legend-text';
    const said = mark.text.trim();
    if (said) text.textContent = said;
    else if (ctx.mode === 'edit') {
      text.textContent = ctx.strings.markEmpty;
      text.classList.add('ls-mark-empty');
    }
    row.append(number, text);
    list.appendChild(row);
  }
  return list;
}

/**
 * A figure that draws itself from a form shows nothing itself: what is seen
 * are its parts, which are shapes of their own. Only in the editor, and only
 * when the form is empty, does it say where it is.
 */
function renderFigure(ctx: RenderContext, el: FigureElement): Node {
  const { doc } = ctx;
  const frame = doc.createElement('div');
  frame.className = 'ls-figure';
  if (ctx.mode === 'edit' && el.items.length === 0) {
    frame.setAttribute('aria-hidden', 'true');
    frame.classList.add('ls-figure-empty');
    frame.style.fontFamily = ctx.theme.fonts.body;
    frame.textContent = ctx.strings.figureEmpty;
    return frame;
  }
  if (el.template === 'network' && ctx.mode !== 'edit') {
    // The nodes are read as the shapes they are, in the order of the form; the
    // connections are here as a list that is read and not shown.
    const said = connectionList(el, ctx.strings.connection);
    if (said.length === 0) {
      frame.setAttribute('aria-hidden', 'true');
      return frame;
    }
    const read = doc.createElement('div');
    read.className = 'ls-figure-table';
    const list = doc.createElement('ul');
    for (const text of said) {
      const item = doc.createElement('li');
      item.textContent = text;
      list.appendChild(item);
    }
    read.appendChild(list);
    frame.appendChild(read);
    return frame;
  }
  if (!isChart(el) || ctx.mode === 'edit') {
    frame.setAttribute('aria-hidden', 'true');
    return frame;
  }
  // A diagram says nothing to those who cannot see it: its numbers are here
  // as a table that is read and not shown.
  const { head, rows } = chartTable(el);
  if (!rows.some((row) => row.slice(1).some((cell) => cell !== ''))) {
    frame.setAttribute('aria-hidden', 'true');
    return frame;
  }
  // A table does not shrink to nothing by itself, so it is kept in a box that does.
  const read = doc.createElement('div');
  read.className = 'ls-figure-table';
  const table = doc.createElement('table');
  const line = (cells: string[], tag: 'th' | 'td'): void => {
    const tr = doc.createElement('tr');
    cells.forEach((text, i) => {
      const cell = doc.createElement(tag === 'td' && i === 0 ? 'th' : tag);
      if (tag === 'th') cell.setAttribute('scope', 'col');
      else if (i === 0) cell.setAttribute('scope', 'row');
      cell.textContent = text;
      tr.appendChild(cell);
    });
    table.appendChild(tr);
  };
  if (head.some((text) => text !== '')) line(head, 'th');
  for (const row of rows) line(row, 'td');
  read.appendChild(table);
  frame.appendChild(read);
  return frame;
}

function renderElement(ctx: RenderContext, scene: Scene, surface: Surface, el: SceneElement): Node {
  switch (el.type) {
    case 'figure':
      return renderFigure(ctx, el);
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
    case 'mark':
      return renderMark(ctx, scene, el);
    case 'legend':
      return renderLegend(ctx, scene, el);
  }
}

// ---------- Scene ----------

function renderDecoration(ctx: RenderContext, scene: Scene, surface: Surface): SVGElement {
  const { doc } = ctx;
  const pair = SHAPE_PAIRS[scene.shapeVariant % SHAPE_PAIRS.length]!;
  const colors = decorationColors(surface);
  const box = ctx.theme.decoration;
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

/**
 * Reading order for assistive technology: titles first, then top to bottom.
 * The parts of a figure with a form are read where the figure stands, one
 * row of the form at a time (this is the one thing here that knows of forms;
 * what is drawn does not).
 */
function readingOrder(elements: SceneElement[]): SceneElement[] {
  const rank = (el: SceneElement): number => (el.type === 'text' && el.role === 'title' ? 0 : 1);
  const rows = rowOrder(elements);
  return [...elements].sort((p, q) => {
    if (rank(p) !== rank(q)) return rank(p) - rank(q);
    const a = rows.get(p.id);
    const b = rows.get(q.id);
    const from = a?.at ?? p.box;
    const to = b?.at ?? q.box;
    if (a && b && a.figure === b.figure) return a.turn - b.turn;
    const rowTolerance = 40;
    if (Math.abs(from.y - to.y) > rowTolerance) return from.y - to.y;
    return from.x - to.x;
  });
}

export function renderScene(ctx: RenderContext, scene: Scene): HTMLElement {
  const { doc, theme } = ctx;
  const surface = sceneSurface(theme, scene);
  const root = doc.createElement('section');
  root.className = `ls-scene ls-kind-${scene.kind}`;
  if (theme.orientation === 'portrait') root.classList.add('ls-upright');
  root.dataset.scene = scene.id;
  root.style.background = PALETTE[surface];
  root.style.fontFamily = theme.fonts.body;
  root.style.color = PALETTE[defaultTextColor(theme, surface, 'body', theme.roles.body.size)];
  setMarkVars(root, surface);

  // Everything on the slide lies in one layer, which a step that zooms makes
  // larger round the part it shows (`applySceneMoves` in ./timeline.ts). The
  // slide itself keeps its size and its colour, and cuts what goes outside.
  const layer = doc.createElement('div');
  layer.className = 'ls-zoom';
  root.appendChild(layer);

  if (scene.decoration) layer.appendChild(renderDecoration(ctx, scene, surface));

  // The brand's closing animation: a film that fills the slide, with no
  // controls and no sound. The player starts it when the slide is shown;
  // while editing, its last picture stands. Without the owner's file there
  // is nothing to show, and nothing is put in its place.
  if (scene.closingAnimation && ctx.closing) {
    const film = doc.createElement('video');
    film.className = 'ls-closing';
    film.src = ctx.closing;
    film.muted = true;
    film.playsInline = true;
    film.preload = 'auto';
    film.disablePictureInPicture = true;
    film.setAttribute('aria-label', ctx.strings.closingAlt);
    film.tabIndex = -1;
    if (ctx.mode === 'edit') {
      film.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(film.duration)) film.currentTime = Math.max(0, film.duration - 0.05);
      });
    }
    layer.appendChild(film);
  }

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
    // A bar of a diagram that grows in at a step grows from the axis.
    const grows = barGrowsFrom(scene.elements, el);
    if (grows) wrap.dataset.grows = grows;
    if (el.type === 'mark' || el.type === 'legend') {
      // What belongs to a picture is not shown before the picture is.
      wrap.dataset.on = el.on;
      if (el.type === 'mark' && moreOf(el)) wrap.classList.add('ls-has-more');
    }
    // A "+ Lær mer" button and a mark are themselves what is pressed; they get no "+" of their own.
    const more = el.type === 'deepdive' || el.type === 'mark' ? undefined : moreOf(el);
    if (more) {
      // The mark comes right after the element, also in reading and tab order.
      wrap.classList.add('ls-has-more');
      if (el.type === 'image') {
        // A picture that has more to tell gets a ring, so it is seen to be something to press.
        wrap.classList.add('ls-more-ring');
        wrap.style.setProperty(
          '--ls-more-ring',
          PALETTE[isDarkSurface(surface) ? 'hvit' : 'lilla'],
        );
      }
      wrap.appendChild(renderMoreBadge(ctx, surface, el, more));
    }
    layer.appendChild(wrap);
  }

  const logoUrl = scene.showLogo ? ctx.logo[logoVariant(surface)] : undefined;
  if (logoUrl) {
    const logo = doc.createElement('img');
    logo.className = 'ls-logo';
    logo.src = logoUrl;
    logo.alt = ctx.strings.logoAlt;
    logo.draggable = false;
    logo.style.left = `${theme.logo.marginX}px`;
    logo.style.top = `${theme.stage.height - theme.logo.marginBottom - theme.logo.height}px`;
    logo.style.height = `${theme.logo.height}px`;
    layer.appendChild(logo);
  }
  return root;
}

/**
 * A figure fetched from a slide, as it is drawn in a "Lær mer" box: its
 * elements on the white of the box, in a stage as large as the part of the
 * slide they filled. The elements are drawn by the same code as on a slide,
 * so the stage is in stage pixels; what holds it makes it fit
 * (`fitDrawings` in ./more.ts).
 */
export function renderDrawing(
  ctx: RenderContext,
  elements: DrawnElement[],
  frame: { x: number; y: number; w: number; h: number },
): HTMLElement {
  const { doc, theme } = ctx;
  const surface: Surface = 'hvit';
  // The elements are drawn as on a slide that holds them and nothing else.
  const scene: Scene = {
    id: 'drawing',
    title: '',
    kind: 'content',
    decoration: false,
    shapeVariant: 0,
    showLogo: false,
    elements,
    timeline: [],
    script: '',
  };
  const stage = doc.createElement('div');
  stage.className = 'lm-stage';
  stage.style.width = `${frame.w}px`;
  stage.style.height = `${frame.h}px`;
  stage.style.fontFamily = theme.fonts.body;
  stage.style.color = PALETTE[defaultTextColor(theme, surface, 'body', theme.roles.body.size)];
  setMarkVars(stage, surface);
  const zIndex = new Map(elements.map((el, i) => [el.id, i + 1]));
  for (const el of readingOrder(elements)) {
    const wrap = doc.createElement('div');
    wrap.className = `ls-el ls-el-${el.type}`;
    wrap.dataset.part = el.id;
    wrap.style.left = `${el.box.x - frame.x}px`;
    wrap.style.top = `${el.box.y - frame.y}px`;
    wrap.style.width = `${el.box.w}px`;
    wrap.style.height = `${el.box.h}px`;
    wrap.style.zIndex = String(zIndex.get(el.id));
    if (el.type === 'image' && el.blend) wrap.style.mixBlendMode = el.blend;
    if (el.box.rotation) wrap.style.transform = `rotate(${el.box.rotation}deg)`;
    wrap.appendChild(renderElement(ctx, scene, surface, el));
    stage.appendChild(wrap);
  }
  return stage;
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
    playsFromWeb: 'Spilles fra nettet (krever nett)',
    playOnYouTube: 'Spill av på YouTube',
    openOnYouTube: 'Åpne på YouTube',
    youtubeInPlace: 'Spilles fra YouTube (krever nett)',
    youtubeOpens: 'Åpnes på YouTube (krever nett)',
    embedLoad: (host) => `Innhold fra ${host} – klikk for å laste`,
    openInBrowser: 'Åpne i nettleseren',
    needsInternet: 'Krever nett',
    moreAbout: (title) => (title ? `Lær mer om: ${title}` : 'Lær mer'),
    markEmpty: 'Skriv hva merket peker på',
    figureEmpty: 'Figuren er tom. Legg til i skjemaet.',
    connection: (from, to, arrow) => (arrow ? `${from} til ${to}` : `${from} og ${to}`),
    creditBy: 'av',
    creditSource: 'Kilde',
    creditCropped: 'beskåret',
    logoAlt: 'Universitetet i Sørøst-Norge',
    closingAlt: 'Universitetet i Sørøst-Norge: avslutningsanimasjon med logoen',
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
    playsFromWeb: 'Plays from the web (needs internet)',
    playOnYouTube: 'Play on YouTube',
    openOnYouTube: 'Open on YouTube',
    youtubeInPlace: 'Plays from YouTube (needs internet)',
    youtubeOpens: 'Opens on YouTube (needs internet)',
    embedLoad: (host) => `Content from ${host} – click to load`,
    openInBrowser: 'Open in the browser',
    needsInternet: 'Needs internet',
    moreAbout: (title) => (title ? `Learn more about: ${title}` : 'Learn more'),
    markEmpty: 'Write what the mark points at',
    figureEmpty: 'The figure is empty. Add to it in the form.',
    connection: (from, to, arrow) => (arrow ? `${from} to ${to}` : `${from} and ${to}`),
    creditBy: 'by',
    creditSource: 'Source',
    creditCropped: 'cropped',
    logoAlt: 'University of South-Eastern Norway',
    closingAlt: 'University of South-Eastern Norway: closing animation with the logo',
  },
};
