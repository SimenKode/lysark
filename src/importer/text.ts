// Text bodies (a:txBody / p:txBody) to rich text, with the properties that
// PowerPoint inherits through list styles: bullets, alignment and font size.
import type { Paragraph, RichText, Run } from '../shared/format/schema';
import { fromSymbolFont } from './symbol';
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
  /**
   * When true long gaps between words stay as they are. Table cells use
   * tabs to line up columns, not to push words onto a new line.
   */
  keepGaps?: boolean;
}

export interface TextBody {
  content: RichText;
  /** Font sizes in 1/100 pt and the number of characters each covers. */
  sizeWeights: Map<number, number>;
  /**
   * The size (1/100 pt) of each list level 0-4: the size covering most of
   * that level's characters, or the size the list styles give the level
   * when it has no text. Undefined when neither is known.
   */
  levelSizes: Array<number | undefined>;
  /** Spacing of each paragraph, in the same order as the paragraphs. */
  spacing: ParagraphSpacing[];
  /** Space before a paragraph of each level 0-4 when it has no text (points). */
  levelBefore: number[];
  /**
   * PowerPoint's indents of each level 0-4 in EMU: marL is where the text
   * starts, marL + indent where the first line (or its bullet) starts.
   */
  levelIndents: Array<{ marL: number; indent: number } | undefined>;
  align: Align;
  /** True when there is no text apart from white space. */
  isEmpty: boolean;
}

/** List levels the project format has (0-4). */
const LEVELS = 5;

/** How PowerPoint spaces a paragraph. */
export interface ParagraphSpacing {
  /** Space above the paragraph in points: its own space before plus the previous one's space after. */
  before: number;
  /** Distance between its lines, as a factor of its font size. */
  line: number;
  /** Characters in the paragraph, to find the spacing that covers most text. */
  chars: number;
}

/** PowerPoint's single line spacing, as a factor of the font size. */
const SINGLE_LINE = 1.2;

/** Font size assumed for spacing when no size can be found (PowerPoint's default, 18 pt). */
const DEFAULT_SIZE_PT = 18;

/**
 * A spacing element (a:lnSpc, a:spcBef, a:spcAft) in points for a font
 * size: a:spcPts is in hundredths of a point, a:spcPct in thousandths of a
 * percent of a single line.
 */
function spacingPoints(node: XmlNode | undefined, sizePt: number): number | undefined {
  const points = intAttr(child(node, 'a:spcPts'), 'val');
  if (points !== undefined) return Math.max(0, points / 100);
  const percent = intAttr(child(node, 'a:spcPct'), 'val');
  if (percent !== undefined) return Math.max(0, (percent / 100000) * SINGLE_LINE * sizePt);
  return undefined;
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

const NUMBER_STYLE_BY_TYPE: Record<string, Paragraph['numberStyle']> = {
  arabicParenR: '1)',
  alphaLcPeriod: 'a.',
  alphaLcParenR: 'a)',
  alphaUcPeriod: 'A.',
  alphaUcParenR: 'A)',
  romanLcPeriod: 'i.',
  romanUcPeriod: 'I.',
};

/** The numbering of a:buAutoNum, when the properties have one. "1." gives null. */
function numberStyleOf(
  properties: XmlNode | undefined,
): Paragraph['numberStyle'] | null | undefined {
  const auto = child(properties, 'a:buAutoNum');
  if (!auto) return undefined;
  return NUMBER_STYLE_BY_TYPE[attr(auto, 'type') ?? ''] ?? null;
}

/** A highlight that shows: PowerPoint's white highlight is invisible on a white slide. */
function visibleHighlight(properties: XmlNode | undefined): boolean {
  const highlight = child(properties, 'a:highlight');
  if (!highlight) return false;
  const hex = attr(child(highlight, 'a:srgbClr'), 'val')?.toUpperCase();
  return hex !== 'FFFFFF';
}

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
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.mark === b.mark &&
    a.link === b.link &&
    a.script === b.script
  );
}

/**
 * A gap of three or more spaces and tabs, or of two where one is a tab,
 * between words. Lecturers type such gaps to push the next word onto a new
 * line, around a picture. Measured against the PDF exports of the owner's
 * lectures, PowerPoint ended the line at every one of them, while single
 * tabs and double spaces stayed within the line.
 */
const LONG_GAP = /(?<=\S)(?:[ \t]{3,}|[ \t]?\t[ \t]?)(?=\S)/g;

function isLongGap(gap: string): boolean {
  return gap.length >= 3 || (gap.length === 2 && gap.includes('\t'));
}

/** Turns long gaps between words into line breaks, also across runs. */
function breakAtLongGaps(runs: Run[]): void {
  const text = runs.map((run) => run.text).join('');
  const gaps: Array<{ start: number; end: number }> = [];
  for (const match of text.matchAll(LONG_GAP)) {
    if (isLongGap(match[0])) gaps.push({ start: match.index, end: match.index + match[0].length });
  }
  if (gaps.length === 0) return;
  let offset = 0;
  for (const run of runs) {
    const from = offset;
    offset += run.text.length;
    let rebuilt = '';
    for (let i = 0; i < run.text.length; i++) {
      const at = from + i;
      const gap = gaps.find((g) => at >= g.start && at < g.end);
      if (!gap) rebuilt += run.text[i];
      else if (at === gap.start) rebuilt += '\n';
    }
    run.text = rebuilt;
  }
  // A run that lay wholly inside a gap is gone.
  for (let i = runs.length - 1; i >= 0; i--) if (runs[i]!.text === '') runs.splice(i, 1);
}

function paragraphText(paragraph: Paragraph): string {
  return paragraph.runs.map((run) => run.text).join('');
}

/** The value with the largest weight; the first one wins a tie. */
export function heaviest<T>(weights: Map<T, number>): T | undefined {
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
  const levelWeights = Array.from({ length: LEVELS }, () => new Map<number, number>());
  const spacing: ParagraphSpacing[] = [];
  let afterPrevious = 0;
  const indentWeights = Array.from({ length: LEVELS }, () => new Map<string, number>());

  for (const p of children(txBody, 'a:p')) {
    const own = child(p, 'a:pPr');
    const level = Math.min(LEVELS - 1, Math.max(0, intAttr(own, 'lvl') ?? 0));
    const inherited = environment.listStyles.map((style) => child(style, `a:lvl${level + 1}pPr`));
    const paragraphSizes = new Map<number, number>();

    const runs: Run[] = [];
    for (const node of p.children) {
      if (node.name === 'a:br') {
        const last = runs[runs.length - 1];
        if (last) last.text += '\n';
        else runs.push({ text: '\n' });
        continue;
      }
      if (node.name !== 'a:r' && node.name !== 'a:fld') continue;
      const properties = child(node, 'a:rPr');
      const symbolRun = attr(child(properties, 'a:latin'), 'typeface') === 'Symbol';
      const symbolChars = symbolRun || attr(child(properties, 'a:sym'), 'typeface') === 'Symbol';
      const raw = cleanText(child(node, 'a:t')?.text ?? '');
      const text = symbolChars ? fromSymbolFont(raw, symbolRun) : raw;
      if (text === '') continue;

      const size =
        intAttr(properties, 'sz') ??
        firstDefined(inherited, (levelProperties) =>
          intAttr(child(levelProperties, 'a:defRPr'), 'sz'),
        );
      if (size !== undefined && size > 0) {
        sizeWeights.set(size, (sizeWeights.get(size) ?? 0) + text.length);
        const atLevel = levelWeights[level]!;
        atLevel.set(size, (atLevel.get(size) ?? 0) + text.length);
        paragraphSizes.set(size, (paragraphSizes.get(size) ?? 0) + text.length);
      }

      const run: Run = { text };
      if (boolAttr(properties, 'b')) run.bold = true;
      if (boolAttr(properties, 'i')) run.italic = true;
      // PowerPoint's highlighter becomes the brand's text marking.
      if (visibleHighlight(properties)) run.mark = true;
      const baseline = intAttr(properties, 'baseline') ?? 0;
      if (baseline < 0) run.script = 'sub';
      else if (baseline > 0) run.script = 'super';
      const link = environment.resolveLink(properties);
      if (link) run.link = link;

      const last = runs[runs.length - 1];
      if (last && sameFormat(last, run)) last.text += run.text;
      else runs.push(run);
    }

    if (!environment.keepGaps) breakAtLongGaps(runs);
    const hasText = runs.some((run) => run.text.trim() !== '');
    const list =
      listOf(own) ??
      (environment.ownListOnly ? undefined : firstDefined(inherited, listOf)) ??
      'none';
    // PowerPoint draws no bullet on an empty paragraph.
    const paragraph: Paragraph = { level, list: hasText ? list : 'none', runs };
    if (paragraph.list === 'number') {
      const style =
        numberStyleOf(own) ??
        (environment.ownListOnly ? undefined : firstDefined(inherited, numberStyleOf));
      if (style) paragraph.numberStyle = style;
    }
    paragraphs.push(paragraph);
    aligns.push(alignOf(own) ?? firstDefined(inherited, alignOf) ?? 'left');

    // An empty paragraph is spaced by the size of its end mark.
    const sizePt =
      (heaviest(paragraphSizes) ??
        intAttr(child(p, 'a:endParaRPr'), 'sz') ??
        firstDefined(inherited, (properties) => intAttr(child(properties, 'a:defRPr'), 'sz')) ??
        DEFAULT_SIZE_PT * 100) / 100;
    const chain = [own, ...inherited];
    const marL = firstDefined(chain, (n) => intAttr(n, 'marL'));
    const indent = firstDefined(chain, (n) => intAttr(n, 'indent'));
    if (marL !== undefined || indent !== undefined) {
      const key = `${marL ?? 0},${indent ?? 0}`;
      const weights = indentWeights[level]!;
      weights.set(key, (weights.get(key) ?? 0) + Math.max(1, paragraphText(paragraph).length));
    }
    const before = firstDefined(chain, (n) => spacingPoints(child(n, 'a:spcBef'), sizePt)) ?? 0;
    const lineSpacing = firstDefined(chain, (n) => child(n, 'a:lnSpc'));
    const line = lineSpacing
      ? (spacingPoints(lineSpacing, sizePt) ?? SINGLE_LINE * sizePt) / sizePt
      : SINGLE_LINE;
    spacing.push({
      before: before + afterPrevious,
      line,
      chars: paragraphText(paragraphs[paragraphs.length - 1]!).length,
    });
    afterPrevious = firstDefined(chain, (n) => spacingPoints(child(n, 'a:spcAft'), sizePt)) ?? 0;
  }

  while (paragraphs.length > 0 && paragraphText(paragraphs[paragraphs.length - 1]!).trim() === '') {
    paragraphs.pop();
    aligns.pop();
    spacing.pop();
  }

  // The brand marks parts of running text, never text standing on its own:
  // when all of the text is highlighted, the marking is left out.
  const textRuns = paragraphs.flatMap((p) => p.runs).filter((run) => run.text.trim() !== '');
  if (textRuns.length > 0 && textRuns.every((run) => run.mark)) {
    for (const paragraph of paragraphs) {
      for (const run of paragraph.runs) delete run.mark;
      paragraph.runs = paragraph.runs.reduce<Run[]>((merged, run) => {
        const last = merged[merged.length - 1];
        if (last && sameFormat(last, run)) last.text += run.text;
        else merged.push(run);
        return merged;
      }, []);
    }
  }

  const alignWeights = new Map<Align, number>();
  for (const align of aligns) alignWeights.set(align, (alignWeights.get(align) ?? 0) + 1);

  const levelSizes = levelWeights.map(
    (weights, level) =>
      heaviest(weights) ??
      firstDefined(
        environment.listStyles.map((style) => child(style, `a:lvl${level + 1}pPr`)),
        (levelProperties) => {
          const size = intAttr(child(levelProperties, 'a:defRPr'), 'sz');
          return size !== undefined && size > 0 ? size : undefined;
        },
      ),
  );

  const levelBefore = levelSizes.map((size, level) => {
    const styles = environment.listStyles.map((style) => child(style, `a:lvl${level + 1}pPr`));
    const sizePt = (size ?? DEFAULT_SIZE_PT * 100) / 100;
    return firstDefined(styles, (n) => spacingPoints(child(n, 'a:spcBef'), sizePt)) ?? 0;
  });

  const levelIndents = indentWeights.map((weights, level) => {
    let key = heaviest(weights);
    if (key === undefined) {
      const styles = environment.listStyles.map((style) => child(style, `a:lvl${level + 1}pPr`));
      const marL = firstDefined(styles, (n) => intAttr(n, 'marL'));
      const indent = firstDefined(styles, (n) => intAttr(n, 'indent'));
      if (marL === undefined && indent === undefined) return undefined;
      key = `${marL ?? 0},${indent ?? 0}`;
    }
    const [marL, indent] = key.split(',').map(Number) as [number, number];
    return { marL, indent };
  });

  return {
    content: { paragraphs },
    sizeWeights,
    levelSizes,
    spacing,
    levelBefore,
    levelIndents,
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
 * Factor on imported sizes of running text so that it takes no more room
 * than it had in PowerPoint. Measured on 1313 lines of body text in the PDF
 * exports of the owner's lectures, a line in Liberation Sans is 9.5 % wider
 * than in PowerPoint's Calibri at the same size (half the lines), and up to
 * 11 % (85 % of the lines). At 0.9, 85 % of the lines are no wider than in
 * PowerPoint, so lines rarely break earlier.
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
  // Tenths of a pixel: rounding 39.6 up to 40 would make a tenth of the
  // lines wider than in PowerPoint.
  const pixels = Math.round((size / 100) * fontScale * pixelsPerPoint * 10) / 10;
  return pixels > 0 ? pixels : undefined;
}

/**
 * Font size factor per list level, relative to the size the element gets
 * (the heaviest size), when it differs from the theme's own factors.
 * Undefined when the theme's factors already match PowerPoint's sizes, or
 * when the sizes are not known.
 */
export function levelScaleFor(
  text: Pick<TextBody, 'content' | 'sizeWeights' | 'levelSizes'>,
  themeScale: readonly number[],
): number[] | undefined {
  const base = heaviest(text.sizeWeights);
  if (base === undefined) return undefined;
  const factors = text.levelSizes.map((size, level) =>
    size === undefined ? (themeScale[level] ?? 1) : Math.round((size / base) * 100) / 100,
  );
  // Only the levels that hold text decide whether the theme's factors differ.
  const used = new Set(
    text.content.paragraphs
      .filter((p) => p.runs.some((run) => run.text.trim() !== ''))
      .map((p) => p.level),
  );
  const differs = [...used].some(
    (level) => Math.abs(factors[level]! - (themeScale[level] ?? 1)) > 0.02,
  );
  return differs ? factors : undefined;
}

/** Text margins of a body in EMU: left, top, right, bottom. */
export interface Insets {
  l: number;
  t: number;
  r: number;
  b: number;
}

// PowerPoint's defaults: 0.1 inch left and right, 0.05 inch top and bottom.
const DEFAULT_INSETS: Insets = { l: 91440, t: 45720, r: 91440, b: 45720 };

/** True for PowerPoint's default text margins. */
export function isDefaultInsets(insets: Insets): boolean {
  return (
    insets.l === DEFAULT_INSETS.l &&
    insets.t === DEFAULT_INSETS.t &&
    insets.r === DEFAULT_INSETS.r &&
    insets.b === DEFAULT_INSETS.b
  );
}

/** Text margins from the first body properties that state each of them. */
export function insetsOf(bodyProperties: Array<XmlNode | undefined>): Insets {
  const side = (name: string, fallback: number): number => {
    const value = firstDefined(bodyProperties, (node) => intAttr(node, name));
    return value !== undefined && value >= 0 ? value : fallback;
  };
  return {
    l: side('lIns', DEFAULT_INSETS.l),
    t: side('tIns', DEFAULT_INSETS.t),
    r: side('rIns', DEFAULT_INSETS.r),
    b: side('bIns', DEFAULT_INSETS.b),
  };
}

/**
 * How far vertical text is turned, clockwise: 90 for text that runs
 * downwards ("vert", "eaVert"), 270 for text that runs upwards ("vert270").
 */
export function verticalTurnOf(bodyProperties: Array<XmlNode | undefined>): 0 | 90 | 270 {
  const vert = firstDefined(bodyProperties, (node) => attr(node, 'vert'));
  if (vert === 'vert' || vert === 'eaVert' || vert === 'mongolianVert') return 90;
  if (vert === 'vert270') return 270;
  return 0;
}

/** The a:normAutofit line spacing reduction of a body, as a factor (1 when there is none). */
export function lineReductionFactor(bodyPr: XmlNode | undefined): number {
  const value = attr(child(bodyPr, 'a:normAutofit'), 'lnSpcReduction');
  if (value === undefined) return 1;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  const reduction = value.trim().endsWith('%') ? parsed / 100 : parsed / 100000;
  return Math.max(0.5, 1 - reduction);
}

/**
 * PowerPoint's spacing for an imported text, in the units the project
 * format uses: the line height as a factor of the font size, and the space
 * before a paragraph of each level as a factor of the element's font size.
 *
 * `compensation` is the factor the font size was scaled by to match
 * PowerPoint's line widths (see widthCompensation). The spacing keeps
 * PowerPoint's distances, so the text takes the height it had there.
 * The line height is left out when it is within 0.02 of `themeLineHeight`;
 * the space before is left out for text with a single paragraph.
 */
export function spacingFor(
  text: Pick<TextBody, 'content' | 'sizeWeights' | 'spacing' | 'levelBefore'>,
  compensation: number,
  themeLineHeight: number,
  lineReduction = 1,
): { lineHeight?: number; spaceBefore?: number[] } {
  const base = heaviest(text.sizeWeights);
  if (base === undefined || text.spacing.length === 0) return {};
  const result: { lineHeight?: number; spaceBefore?: number[] } = {};

  const lines = new Map<number, number>();
  for (const paragraph of text.spacing) {
    const factor = Math.round(((paragraph.line * lineReduction) / compensation) * 100) / 100;
    lines.set(factor, (lines.get(factor) ?? 0) + Math.max(1, paragraph.chars));
  }
  const lineHeight = heaviest(lines);
  if (lineHeight !== undefined && Math.abs(lineHeight - themeLineHeight) > 0.02) {
    result.lineHeight = lineHeight;
  }

  if (text.content.paragraphs.length > 1) {
    const basePt = (base / 100) * compensation;
    const toEm = (points: number): number => Math.round((points / basePt) * 100) / 100;
    const perLevel = Array.from({ length: LEVELS }, () => new Map<number, number>());
    text.content.paragraphs.forEach((paragraph, index) => {
      // PowerPoint leaves out the space before the first paragraph.
      if (index === 0) return;
      const em = toEm(text.spacing[index]!.before);
      const weights = perLevel[paragraph.level]!;
      weights.set(em, (weights.get(em) ?? 0) + Math.max(1, text.spacing[index]!.chars));
    });
    result.spaceBefore = perLevel.map(
      (weights, level) => heaviest(weights) ?? toEm(text.levelBefore[level] ?? 0),
    );
  }
  return result;
}

/**
 * PowerPoint's indents of a text in the project format's units: for each
 * level, where the first line (or its bullet) starts and where the text
 * starts, as factors of the element's font size. Undefined when no level
 * has an indent, or the font size is not known.
 */
export function indentsFor(
  text: Pick<TextBody, 'content' | 'levelIndents'>,
  emuToPixels: number,
  fontSize: number | undefined,
): Array<{ start: number; text: number }> | undefined {
  if (!fontSize || text.levelIndents.every((indent) => indent === undefined)) return undefined;
  const toEm = (emu: number): number => Math.round(((emu * emuToPixels) / fontSize) * 100) / 100;
  // Levels PowerPoint gives no indent of their own follow its default steps.
  const result = text.levelIndents.map((indent, level) => {
    if (!indent) return { start: level * 0.9, text: (level + 1) * 0.9 };
    return {
      start: Math.max(0, toEm(indent.marL + indent.indent)),
      text: Math.max(0, toEm(indent.marL)),
    };
  });
  // Plain text without indents (a title, say) is drawn the same either way.
  const paragraphs = text.content.paragraphs;
  const plain =
    paragraphs.every((p) => p.list === 'none') &&
    paragraphs.every((p) => result[p.level]!.start === 0 && result[p.level]!.text === 0);
  return plain ? undefined : result;
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
