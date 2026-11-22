// Text bodies (a:txBody / p:txBody) to rich text, with the properties that
// PowerPoint inherits through list styles: bullets, alignment and font size.
import type { Paragraph, RichText, Run } from '../shared/format/schema';
import { attr, boolAttr, child, children, intAttr, type XmlNode } from './xml';

export type Align = 'left' | 'center' | 'right';
export type Valign = 'top' | 'middle' | 'bottom';

export interface TextEnvironment {
  /**
   * List styles (elements holding a:lvl1pPr ... a:lvl9pPr) in order of
   * precedence: the shape's own, the layout placeholder's, the master
   * placeholder's, the master's text style, the presentation default.
   */
  listStyles: XmlNode[];
  /** Turns the hyperlink of a run into a link the project format accepts. */
  resolveLink: (runProperties: XmlNode | undefined) => string | undefined;
  /** When true only the paragraph's own properties decide the list type (table cells). */
  ownListOnly?: boolean;
}

export interface TextBody {
  content: RichText;
  /** Font sizes in 1/100 pt and the number of characters each covers. */
  sizeWeights: Map<number, number>;
  align: Align;
  /** True when there is no text apart from white space. */
  isEmpty: boolean;
}

const LIST_BY_TAG: Record<string, Paragraph['list']> = {
  'a:buNone': 'none',
  'a:buChar': 'bullet',
  'a:buBlip': 'bullet',
  'a:buAutoNum': 'number',
};

const ALIGN_BY_VALUE: Record<string, Align> = {
  l: 'left',
  ctr: 'center',
  r: 'right',
  just: 'left',
  justLow: 'left',
  dist: 'left',
  thaiDist: 'left',
};

const VALIGN_BY_ANCHOR: Record<string, Valign> = {
  t: 'top',
  ctr: 'middle',
  b: 'bottom',
  just: 'top',
  dist: 'top',
};

function listOf(properties: XmlNode | undefined): Paragraph['list'] | undefined {
  for (const node of properties?.children ?? []) {
    const list = LIST_BY_TAG[node.name];
    if (list) return list;
  }
  return undefined;
}

function alignOf(properties: XmlNode | undefined): Align | undefined {
  return ALIGN_BY_VALUE[attr(properties, 'algn') ?? ''];
}

function firstDefined<T>(
  nodes: Array<XmlNode | undefined>,
  read: (n: XmlNode | undefined) => T | undefined,
): T | undefined {
  for (const node of nodes) {
    const value = read(node);
    if (value !== undefined) return value;
  }
  return undefined;
}

/** PowerPoint sometimes writes a soft line break as a vertical tab. */
function cleanText(text: string): string {
  return text.replace(/_x000B_|\u000B/g, '\n');
}

function sameFormat(a: Run, b: Run): boolean {
  return a.bold === b.bold && a.italic === b.italic && a.link === b.link;
}

function paragraphText(paragraph: Paragraph): string {
  return paragraph.runs.map((run) => run.text).join('');
}

/** The value with the largest weight; the first one wins a tie. */
function heaviest<T>(weights: Map<T, number>): T | undefined {
  let best: T | undefined;
  let bestWeight = 0;
  for (const [value, weight] of weights) {
    if (weight > bestWeight) {
      best = value;
      bestWeight = weight;
    }
  }
  return best;
}

export function readTextBody(txBody: XmlNode | undefined, environment: TextEnvironment): TextBody {
  const paragraphs: Paragraph[] = [];
  const aligns: Align[] = [];
  const sizeWeights = new Map<number, number>();

  for (const p of children(txBody, 'a:p')) {
    const own = child(p, 'a:pPr');
    const level = Math.min(4, Math.max(0, intAttr(own, 'lvl') ?? 0));
    const inherited = environment.listStyles.map((style) => child(style, `a:lvl${level + 1}pPr`));

    const runs: Run[] = [];
    for (const node of p.children) {
      if (node.name === 'a:br') {
        const last = runs[runs.length - 1];
        if (last) last.text += '\n';
        else runs.push({ text: '\n' });
        continue;
      }
      if (node.name !== 'a:r' && node.name !== 'a:fld') continue;
      const text = cleanText(child(node, 'a:t')?.text ?? '');
      if (text === '') continue;
      const properties = child(node, 'a:rPr');

      const size =
        intAttr(properties, 'sz') ??
        firstDefined(inherited, (levelProperties) =>
          intAttr(child(levelProperties, 'a:defRPr'), 'sz'),
        );
      if (size !== undefined && size > 0) {
        sizeWeights.set(size, (sizeWeights.get(size) ?? 0) + text.length);
      }

      const run: Run = { text };
      if (boolAttr(properties, 'b')) run.bold = true;
      if (boolAttr(properties, 'i')) run.italic = true;
      const link = environment.resolveLink(properties);
      if (link) run.link = link;

      const last = runs[runs.length - 1];
      if (last && sameFormat(last, run)) last.text += run.text;
      else runs.push(run);
    }

    const hasText = runs.some((run) => run.text.trim() !== '');
    const list =
      listOf(own) ??
      (environment.ownListOnly ? undefined : firstDefined(inherited, listOf)) ??
      'none';
    // PowerPoint draws no bullet on an empty paragraph.
    paragraphs.push({ level, list: hasText ? list : 'none', runs });
    aligns.push(alignOf(own) ?? firstDefined(inherited, alignOf) ?? 'left');
  }

  while (paragraphs.length > 0 && paragraphText(paragraphs[paragraphs.length - 1]!).trim() === '') {
    paragraphs.pop();
    aligns.pop();
  }

  const alignWeights = new Map<Align, number>();
  for (const align of aligns) alignWeights.set(align, (alignWeights.get(align) ?? 0) + 1);

  return {
    content: { paragraphs },
    sizeWeights,
    align: heaviest(alignWeights) ?? 'left',
    isEmpty: paragraphs.length === 0,
  };
}

/** The a:normAutofit font scale of a body (1 when there is none). */
export function autofitScale(bodyPr: XmlNode | undefined): number {
  const value = attr(child(bodyPr, 'a:normAutofit'), 'fontScale');
  if (value === undefined) return 1;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  // Strict OOXML writes "90%", transitional writes 90000.
  return value.trim().endsWith('%') ? parsed / 100 : parsed / 100000;
}

/**
 * Stage font size for a set of weighted sizes: the size covering the most
 * characters, scaled by autofit. Undefined when no size could be resolved.
 */
/**
 * Typefaces that are clearly narrower than Arial. Lysark sets running text
 * in Liberation Sans, which has Arial's widths, so text written in one of
 * these would need more room and break its lines differently.
 *
 * Maison Neue is USN's profile font. On a machine without it PowerPoint
 * shows Calibri instead, and that is what the slides were laid out with.
 */
const NARROW_TYPEFACE = /^(calibri|carlito|aptos|maison neue)/i;

/**
 * Factor on imported sizes of running text so that it takes about the room
 * it had in PowerPoint. Calibri is roughly a tenth narrower than Arial.
 */
export function widthCompensation(bodyTypeface: string | undefined): number {
  return bodyTypeface && NARROW_TYPEFACE.test(bodyTypeface.trim()) ? 0.9 : 1;
}

export function stageFontSize(
  sizeWeights: Map<number, number>,
  fontScale: number,
  pixelsPerPoint: number,
): number | undefined {
  const size = heaviest(sizeWeights);
  if (size === undefined) return undefined;
  const pixels = Math.round((size / 100) * fontScale * pixelsPerPoint);
  return pixels > 0 ? pixels : undefined;
}

/** Vertical anchor from the first body properties that state one. */
export function valignOf(bodyProperties: Array<XmlNode | undefined>): Valign {
  return (
    firstDefined(bodyProperties, (node) => VALIGN_BY_ANCHOR[attr(node, 'anchor') ?? '']) ?? 'top'
  );
}

/** The paragraphs of a text body as plain strings (line breaks kept as "\n"). */
export function plainParagraphs(txBody: XmlNode | undefined): string[] {
  return children(txBody, 'a:p').map((p) => {
    let text = '';
    for (const node of p.children) {
      if (node.name === 'a:br') text += '\n';
      else if (node.name === 'a:r' || node.name === 'a:fld') {
        text += cleanText(child(node, 'a:t')?.text ?? '');
      }
    }
    return text;
  });
}
