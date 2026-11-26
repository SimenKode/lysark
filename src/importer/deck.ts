// The parts of a presentation that slides share: slide size and order,
// masters, layouts and themes, and how placeholders find what they inherit.
import { readColorScheme } from './color';
import { stageMapFor, type StageMap } from './geometry';
import type { Orientation } from '../shared/format/constants';
import { THEME_REN, THEME_REN_UPRIGHT, type Theme } from '../shared/theme/theme';
import { PptxPackage } from './package';
import { attr, child, children, descend, findDescendant, intAttr, type XmlNode } from './xml';

/** A placeholder shape on a layout or master. */
export interface Placeholder {
  type: string;
  idx: number;
  /** The p:sp, p:pic or p:graphicFrame. */
  node: XmlNode;
}

export interface MasterPart {
  /** Typeface of running text in the theme (a:minorFont), e.g. "Calibri". */
  bodyTypeface?: string;
  /** Typeface of titles in the theme (a:majorFont). */
  titleTypeface?: string;
  placeholders: Placeholder[];
  titleStyle?: XmlNode;
  bodyStyle?: XmlNode;
  otherStyle?: XmlNode;
  colorMap: Record<string, string>;
  colorScheme: Record<string, string>;
}

export interface LayoutPart {
  /** The layout's type attribute, e.g. "title", "secHead", "obj". */
  type?: string;
  /** The layout's name as shown in PowerPoint, e.g. "Tittellysbilde". */
  name?: string;
  placeholders: Placeholder[];
  colorMapOverride?: Record<string, string>;
  master?: MasterPart;
}

// PowerPoint's default slide size (4:3), used when p:sldSz is missing.
const DEFAULT_SLIDE = { width: 9144000, height: 6858000 };

/** The non-visual properties of a shape, picture, frame, connector or group. */
export function nonVisual(node: XmlNode): { cNvPr?: XmlNode; nvPr?: XmlNode } {
  const container = node.children.find((c) => c.name.startsWith('p:nv'));
  return { cNvPr: child(container, 'p:cNvPr'), nvPr: child(container, 'p:nvPr') };
}

export function placeholderOf(node: XmlNode): { type: string; idx: number } | undefined {
  const ph = child(nonVisual(node).nvPr, 'p:ph');
  if (!ph) return undefined;
  return { type: attr(ph, 'type') ?? 'obj', idx: intAttr(ph, 'idx') ?? 0 };
}

/**
 * The master placeholder type a placeholder type inherits from: centred
 * titles from the title, date/footer/slide number from themselves, and
 * everything else (subtitle, object, picture, table ...) from the body.
 */
export function basePlaceholderType(type: string): string {
  if (type === 'title' || type === 'ctrTitle') return 'title';
  if (type === 'dt' || type === 'ftr' || type === 'sldNum') return type;
  return 'body';
}

function collectPlaceholders(root: XmlNode | undefined): Placeholder[] {
  const result: Placeholder[] = [];
  for (const node of descend(root, 'p:cSld', 'p:spTree')?.children ?? []) {
    const ph = placeholderOf(node);
    if (ph) result.push({ ...ph, node });
  }
  return result;
}

/** A colour map override on a slide or layout, if it has one. */
export function colorMapOverride(root: XmlNode | undefined): Record<string, string> | undefined {
  return descend(root, 'p:clrMapOvr', 'a:overrideClrMapping')?.attrs;
}

export function findLayoutPlaceholder(
  layout: LayoutPart | undefined,
  ph: { type: string; idx: number },
): Placeholder | undefined {
  const all = layout?.placeholders ?? [];
  return (
    all.find((candidate) => candidate.idx === ph.idx) ??
    all.find((candidate) => candidate.type === ph.type) ??
    all.find((candidate) => basePlaceholderType(candidate.type) === basePlaceholderType(ph.type))
  );
}

export function findMasterPlaceholder(
  master: MasterPart | undefined,
  type: string,
): Placeholder | undefined {
  const base = basePlaceholderType(type);
  return master?.placeholders.find((candidate) => basePlaceholderType(candidate.type) === base);
}

export class Deck {
  readonly pkg: PptxPackage;
  readonly stage: StageMap;
  /** The theme of the project the slides are imported into, laid out for its shape. */
  readonly theme: Theme;
  /** The size of the slides in the file, in EMU. */
  readonly slideSize: { width: number; height: number };
  /** Slide parts in presentation order. */
  readonly slideParts: string[] = [];
  /**
   * The sections the presentation is divided into, in order: the name of
   * each, and which slide (counted from 0 in `slideParts`) it begins on.
   * Sections without slides are left out.
   */
  readonly sections: Array<{ name: string; first: number }> = [];
  /** p:defaultTextStyle of the presentation. */
  readonly defaultTextStyle?: XmlNode;
  private readonly layouts = new Map<string, LayoutPart>();
  private readonly masters = new Map<string, MasterPart>();

  constructor(bytes: Uint8Array, orientation: Orientation = 'landscape') {
    this.pkg = new PptxPackage(bytes);
    this.theme = orientation === 'portrait' ? THEME_REN_UPRIGHT : THEME_REN;
    let presentationPart = this.pkg.relatedPart('', '/officeDocument') ?? 'ppt/presentation.xml';
    let root = this.pkg.xml(presentationPart);
    if (!root) {
      presentationPart = 'ppt/presentation.xml';
      root = this.pkg.xml(presentationPart);
    }
    if (!root || root.name !== 'p:presentation') {
      throw new Error('Fila er ikke en PowerPoint-presentasjon (ppt/presentation.xml mangler).');
    }

    const size = child(root, 'p:sldSz');
    const width = intAttr(size, 'cx') ?? 0;
    const height = intAttr(size, 'cy') ?? 0;
    this.slideSize = width > 0 && height > 0 ? { width, height } : { ...DEFAULT_SLIDE };
    this.stage = stageMapFor(this.slideSize.width, this.slideSize.height, this.theme.stage);
    this.defaultTextStyle = child(root, 'p:defaultTextStyle');

    const rels = this.pkg.rels(presentationPart);
    /** Where each slide is in the order, by the id sections know it by. */
    const places = new Map<string, number>();
    for (const entry of child(root, 'p:sldIdLst')?.children ?? []) {
      if (entry.name !== 'p:sldId') continue;
      const rel = rels.get(attr(entry, 'r:id') ?? '');
      if (!rel || rel.external) continue;
      const id = attr(entry, 'id');
      if (id !== undefined) places.set(id, this.slideParts.length);
      this.slideParts.push(rel.target);
    }

    const sectionList = findDescendant(child(root, 'p:extLst'), new Set(['p14:sectionLst']));
    for (const section of children(sectionList, 'p14:section')) {
      const slides = children(child(section, 'p14:sldIdLst'), 'p14:sldId')
        .map((slide) => places.get(attr(slide, 'id') ?? ''))
        .filter((place): place is number => place !== undefined);
      if (slides.length === 0) continue;
      this.sections.push({ name: attr(section, 'name') ?? '', first: Math.min(...slides) });
    }
    this.sections.sort((a, b) => a.first - b.first);
  }

  layout(part: string | undefined): LayoutPart | undefined {
    if (!part) return undefined;
    const cached = this.layouts.get(part);
    if (cached) return cached;
    const root = this.pkg.xml(part);
    if (!root) return undefined;
    const layout: LayoutPart = {
      type: attr(root, 'type'),
      name: attr(child(root, 'p:cSld'), 'name'),
      placeholders: collectPlaceholders(root),
      colorMapOverride: colorMapOverride(root),
      master: this.master(this.pkg.relatedPart(part, '/slideMaster')),
    };
    this.layouts.set(part, layout);
    return layout;
  }

  private master(part: string | undefined): MasterPart | undefined {
    if (!part) return undefined;
    const cached = this.masters.get(part);
    if (cached) return cached;
    const root = this.pkg.xml(part);
    if (!root) return undefined;
    const styles = child(root, 'p:txStyles');
    const themePart = this.pkg.relatedPart(part, '/theme');
    const theme = themePart ? this.pkg.xml(themePart) : undefined;
    const master: MasterPart = {
      bodyTypeface: attr(
        descend(theme, 'a:themeElements', 'a:fontScheme', 'a:minorFont', 'a:latin'),
        'typeface',
      ),
      titleTypeface: attr(
        descend(theme, 'a:themeElements', 'a:fontScheme', 'a:majorFont', 'a:latin'),
        'typeface',
      ),
      placeholders: collectPlaceholders(root),
      titleStyle: child(styles, 'p:titleStyle'),
      bodyStyle: child(styles, 'p:bodyStyle'),
      otherStyle: child(styles, 'p:otherStyle'),
      colorMap: child(root, 'p:clrMap')?.attrs ?? {},
      colorScheme: readColorScheme(theme),
    };
    this.masters.set(part, master);
    return master;
  }
}
