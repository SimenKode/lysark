// Renders "Lær mer" content: the panel a student opens from an element.
// The player and the builder's preview both use this, so the owner sees
// exactly what the student will see.
import { slideNumbers } from '../layout/slides';
import type { Credit, More, MoreBlock, Project, TableCell } from '../format/schema';
import { renderRichText } from './richtext';
import { renderEmbed, renderVideo, type RenderContext, type SceneStrings } from './scene';

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export interface PopoverPlace {
  left: number;
  top: number;
  /** The point the box seems to pop out of, measured from the box's own corner. */
  originX: number;
  originY: number;
}

/**
 * Where the "Lær mer" box goes. It pops out beside the element it belongs
 * to, on the side with room for it, and lies on top of the slide instead of
 * pushing it aside. When neither side has room it lies over the slide, on
 * the side where the mark it pops out of is. All numbers are in the same units,
 * measured from the top left corner of `bounds`.
 */
export function placePopover(
  anchor: { left: number; top: number; right: number; bottom: number },
  from: { x: number; y: number },
  bounds: { width: number; height: number },
  box: { width: number; height: number },
  margin = 16,
): PopoverPlace {
  const gap = margin;
  const roomRight = bounds.width - anchor.right - gap - margin;
  const roomLeft = anchor.left - gap - margin;
  let left: number;
  if (roomRight >= box.width) left = anchor.right + gap;
  else if (roomLeft >= box.width) left = anchor.left - gap - box.width;
  // No room beside it: the box lies over the slide, on the side its mark is on.
  else left = from.x >= bounds.width / 2 ? bounds.width - margin - box.width : margin;
  left = Math.max(margin, Math.min(bounds.width - margin - box.width, left));
  const top = Math.max(margin, Math.min(bounds.height - margin - box.height, anchor.top));
  return { left, top, originX: from.x - left, originY: from.y - top };
}

/**
 * How wide the "Lær mer" box is. It is `preferred` wide when that fits
 * beside the element or when it has to lie over the slide anyway; when a
 * side has a little less room, the box is made narrower to fit there, down
 * to `least`, rather than cover the element it belongs to.
 */
export function popoverWidth(
  anchor: { left: number; right: number },
  boundsWidth: number,
  preferred = 560,
  least = 400,
  margin = 16,
): number {
  const widest = Math.min(preferred, boundsWidth - 2 * margin);
  const room = Math.max(boundsWidth - anchor.right, anchor.left) - 2 * margin;
  return room >= widest ? widest : room >= least ? room : widest;
}

/** True when a credit says anything at all. */
export function hasCredit(credit: Credit | undefined): credit is Credit {
  return !!credit && !!(credit.author?.trim() || credit.license?.trim() || credit.title?.trim());
}

/** The credit as one line of plain text: «Title» av Author, CC BY-SA 4.0 (beskåret). */
export function creditText(credit: Credit, strings: SceneStrings, cropped = false): string {
  const parts: string[] = [];
  if (credit.title?.trim()) parts.push(`«${credit.title.trim()}»`);
  if (credit.author?.trim()) parts.push(`${strings.creditBy} ${credit.author.trim()}`);
  let text = parts.join(' ');
  if (credit.license?.trim()) text += `${text ? ', ' : ''}${credit.license.trim()}`;
  if (cropped) text += ` (${strings.creditCropped})`;
  return text;
}

export function safeWebUrl(url: string | undefined): string | undefined {
  const clean = url?.trim();
  return clean && /^https?:\/\//i.test(clean) ? clean : undefined;
}

/**
 * The credit as a line with links to the licence and the source. Links are
 * live only when `interactive`; while editing they are plain text.
 */
export function renderCredit(
  doc: Document,
  credit: Credit,
  strings: SceneStrings,
  o: { cropped?: boolean; interactive: boolean },
): HTMLElement {
  const line = el(doc, 'span', 'lm-credit');
  const link = (text: string, url: string | undefined): Node => {
    const href = o.interactive ? safeWebUrl(url) : undefined;
    if (!href) return doc.createTextNode(text);
    const a = el(doc, 'a', undefined, text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  };
  const parts: string[] = [];
  if (credit.title?.trim()) parts.push(`«${credit.title.trim()}»`);
  if (credit.author?.trim()) parts.push(`${strings.creditBy} ${credit.author.trim()}`);
  line.append(parts.join(' '));
  if (credit.license?.trim()) {
    if (parts.length) line.append(', ');
    line.append(link(credit.license.trim(), credit.licenseUrl));
  }
  if (o.cropped) line.append(` (${strings.creditCropped})`);
  if (safeWebUrl(credit.sourceUrl)) {
    line.append('. ');
    line.append(link(strings.creditSource, credit.sourceUrl));
  }
  return line;
}

function renderCell(ctx: RenderContext, cell: TableCell, header: boolean): HTMLElement {
  const td = el(ctx.doc, header ? 'th' : 'td');
  if (header) td.setAttribute('scope', 'col');
  if (cell.colSpan && cell.colSpan > 1) td.colSpan = cell.colSpan;
  if (cell.rowSpan && cell.rowSpan > 1) td.rowSpan = cell.rowSpan;
  td.appendChild(
    renderRichText(cell.content, {
      doc: ctx.doc,
      levelScale: [1, 1, 1, 1, 1],
      interactive: ctx.mode === 'play',
    }),
  );
  return td;
}

function renderBlock(ctx: RenderContext, block: MoreBlock): HTMLElement | undefined {
  const { doc } = ctx;
  const interactive = ctx.mode === 'play';
  switch (block.kind) {
    case 'heading':
      return block.text.trim() ? el(doc, 'h3', 'lm-heading', block.text.trim()) : undefined;
    case 'text': {
      const text = el(doc, 'div', 'lm-text');
      text.appendChild(
        renderRichText(block.content, { doc, levelScale: [1, 1, 1, 1, 1], interactive }),
      );
      return text;
    }
    case 'image': {
      const url = ctx.assetUrl(block.asset);
      const figure = el(doc, 'figure', 'lm-figure');
      if (!url) {
        figure.appendChild(el(doc, 'p', 'lm-missing', ctx.strings.missingImage));
        return figure;
      }
      const img = el(doc, 'img');
      img.src = url;
      img.alt = block.alt;
      figure.appendChild(img);
      const credit = ctx.project.assets[block.asset]?.credit;
      const caption = block.caption?.trim();
      if (caption || hasCredit(credit)) {
        const figcaption = el(doc, 'figcaption');
        if (caption) figcaption.appendChild(el(doc, 'span', 'lm-caption', caption));
        if (hasCredit(credit)) {
          figcaption.appendChild(renderCredit(doc, credit, ctx.strings, { interactive }));
        }
        figure.appendChild(figcaption);
      }
      return figure;
    }
    case 'video': {
      const figure = el(doc, 'figure', 'lm-figure lm-video');
      figure.appendChild(renderVideo(ctx, 'hvit', block.source, block.title, block.poster));
      // Web videos carry their title on the card itself.
      if (block.title.trim() && block.source.kind === 'asset') {
        figure.appendChild(el(doc, 'figcaption', undefined, block.title.trim()));
      }
      return figure;
    }
    case 'table': {
      const table = el(doc, 'table', 'lm-table');
      const total = block.columns.reduce((sum, w) => sum + w, 0) || 1;
      const colgroup = el(doc, 'colgroup');
      for (const width of block.columns) {
        const col = el(doc, 'col');
        col.style.width = `${(width / total) * 100}%`;
        colgroup.appendChild(col);
      }
      table.appendChild(colgroup);
      const body = el(doc, 'tbody');
      block.rows.forEach((row, rowIndex) => {
        const tr = el(doc, 'tr');
        for (const cell of row) {
          tr.appendChild(renderCell(ctx, cell, block.headerRow && rowIndex === 0));
        }
        body.appendChild(tr);
      });
      table.appendChild(body);
      const scroll = el(doc, 'div', 'lm-table-wrap');
      scroll.appendChild(table);
      return scroll;
    }
    case 'embed': {
      const frame = renderEmbed(ctx, 'hvit', block.url, block.title);
      if (!frame) return undefined;
      const figure = el(doc, 'figure', 'lm-figure lm-video');
      figure.appendChild(frame);
      return figure;
    }
  }
}

/** The content of a panel, block by block. */
export function renderMore(ctx: RenderContext, more: More): HTMLElement {
  const root = el(ctx.doc, 'div', 'lm-body');
  for (const block of more.blocks) {
    const node = renderBlock(ctx, block);
    if (!node) continue;
    node.dataset.block = block.id;
    root.appendChild(node);
  }
  return root;
}

/** One credited picture or video, and where in the presentation it is used. */
export interface CreditEntry {
  assetId: string;
  credit: Credit;
  /** Scene numbers (1-based) where the asset is used. */
  scenes: number[];
  /** True when at least one use shows only part of the picture. */
  cropped: boolean;
}

/** Every asset a block list refers to. */
export function moreAssets(more: More | undefined): string[] {
  const ids: string[] = [];
  for (const block of more?.blocks ?? []) {
    if (block.kind === 'image') ids.push(block.asset);
    else if (block.kind === 'video') {
      if (block.source.kind === 'asset') ids.push(block.source.asset);
      if (block.poster) ids.push(block.poster);
    }
  }
  return ids;
}

/** The credits of everything the presentation uses, in order of first use. */
export function collectCredits(project: Project): CreditEntry[] {
  const entries = new Map<string, CreditEntry>();
  const note = (assetId: string, scene: number, cropped: boolean): void => {
    const credit = project.assets[assetId]?.credit;
    if (!hasCredit(credit)) return;
    let entry = entries.get(assetId);
    if (!entry) {
      entry = { assetId, credit, scenes: [], cropped: false };
      entries.set(assetId, entry);
    }
    if (!entry.scenes.includes(scene)) entry.scenes.push(scene);
    if (cropped) entry.cropped = true;
  };
  // A slide that is shown once more has the number of the slide it shows.
  const numbers = slideNumbers(project.scenes);
  project.scenes.forEach((scene, index) => {
    const number = numbers[index]!;
    if (scene.repeat || number === 0) return;
    for (const element of scene.elements) {
      if (element.type === 'image') note(element.asset, number, !!element.crop);
      else if (element.type === 'video') {
        if (element.source.kind === 'asset') note(element.source.asset, number, false);
        if (element.poster) note(element.poster, number, false);
      }
      for (const id of moreAssets(element.more)) note(id, number, false);
    }
  });
  // Music and other sound on the lecture's own tracks, by the slide each clip starts on.
  for (const track of ['music', 'sound'] as const) {
    for (const clip of project.tracks?.[track] ?? []) {
      const index = project.scenes.findIndex((scene) => scene.id === clip.scene);
      if (index >= 0 && numbers[index]! > 0) note(clip.asset, numbers[index]!, false);
    }
  }
  return [...entries.values()];
}
