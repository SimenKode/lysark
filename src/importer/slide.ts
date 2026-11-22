// One slide to one scene: walks the shape tree in z-order and builds the
// elements, the import warnings, the scene title and the manuscript.
import { newId } from '../shared/format/factory';
import type {
  Box,
  Crop,
  Element,
  ImageElement,
  ImportWarning,
  Scene,
  SceneKind,
  ShapeElement,
  TableCell,
  TableElement,
  TextElement,
  TextRole,
  VideoElement,
  VideoSource,
} from '../shared/format/schema';
import { nearestPaletteColor } from '../shared/theme/palette';
import { overlapsDecoration } from '../shared/theme/theme';
import { arrowEnds, readFill, shapeFill, shapeLine, type ColorContext, type Paint } from './color';
import {
  basePlaceholderType,
  colorMapOverride,
  findLayoutPlaceholder,
  findMasterPlaceholder,
  nonVisual,
  placeholderOf,
  type Deck,
  type LayoutPart,
  type MasterPart,
  type Placeholder,
} from './deck';
import {
  placeOnStage,
  readGroupFrame,
  readXfrm,
  wholeSlide,
  type GroupFrame,
  type Placed,
  type Xfrm,
} from './geometry';
import { imageFormat, isAudioExtension, videoFormat, type MediaStore } from './media';
import { WARNINGS } from './messages';
import { extensionOf, type Relationship } from './package';
import {
  autofitScale,
  plainParagraphs,
  readTextBody,
  stageFontSize,
  widthCompensation,
  valignOf,
  type TextBody,
  type TextEnvironment,
} from './text';
import {
  attr,
  boolAttr,
  child,
  children,
  descend,
  findDescendant,
  intAttr,
  type XmlNode,
} from './xml';

export interface ElementCounts {
  texts: number;
  images: number;
  tables: number;
  shapes: number;
  videos: number;
}

export interface ImportedSlide {
  scene: Scene;
  counts: ElementCounts;
}

const EMU_PER_POINT = 12700;

const SKIPPED_PLACEHOLDERS = new Set(['dt', 'ftr', 'sldNum']);

const SHAPE_GEOMETRY: Record<string, ShapeElement['geometry']> = {
  rect: 'rect',
  flowChartProcess: 'rect',
  roundRect: 'roundRect',
  round1Rect: 'roundRect',
  round2SameRect: 'roundRect',
  round2DiagRect: 'roundRect',
  snipRoundRect: 'roundRect',
  flowChartAlternateProcess: 'roundRect',
  ellipse: 'ellipse',
  flowChartConnector: 'ellipse',
};

/** Block arrows become plain arrows through the middle of their box. */
const BLOCK_ARROWS: Record<string, { horizontal: boolean; reversed: boolean }> = {
  rightArrow: { horizontal: true, reversed: false },
  leftArrow: { horizontal: true, reversed: true },
  downArrow: { horizontal: false, reversed: false },
  upArrow: { horizontal: false, reversed: true },
};

const ANIMATION_NODES = new Set([
  'p:anim',
  'p:animEffect',
  'p:animMotion',
  'p:animScale',
  'p:animRot',
  'p:animClr',
  'p:set',
  'p:bldLst',
]);
const TIMING = new Set(['p:timing']);
const PICTURE = new Set(['p:pic']);
const FALLBACK = new Set(['mc:Fallback']);
const MODERN_MEDIA = new Set(['p14:media']);
const DECORATIVE = new Set(['adec:decorative']);

type FrameKind = 'table' | 'chart' | 'smartart' | 'object';

function frameKind(frame: XmlNode): FrameKind {
  const uri = attr(descend(frame, 'a:graphic', 'a:graphicData'), 'uri') ?? '';
  if (uri.endsWith('/table')) return 'table';
  if (uri.endsWith('/chart') || uri.includes('/chartex')) return 'chart';
  if (uri.endsWith('/diagram')) return 'smartart';
  return 'object';
}

function frameWarning(kind: Exclude<FrameKind, 'table'>, asPicture: boolean): ImportWarning {
  if (kind === 'chart') return WARNINGS.chart(asPicture);
  if (kind === 'smartart') return WARNINGS.smartart(asPicture);
  return WARNINGS.embeddedObject(asPicture);
}

function isLineGeometry(preset: string | undefined): boolean {
  return preset === 'line' || (preset !== undefined && /Connector\d+$/.test(preset));
}

/** Where a shape keeps its xfrm: frames use p:xfrm, everything else p:spPr/a:xfrm. */
function xfrmNodeOf(node: XmlNode | undefined): XmlNode | undefined {
  if (!node) return undefined;
  return node.name === 'p:graphicFrame' ? child(node, 'p:xfrm') : descend(node, 'p:spPr', 'a:xfrm');
}

function bodyPropertiesOf(node: XmlNode | undefined): XmlNode | undefined {
  return descend(node, 'p:txBody', 'a:bodyPr');
}

function listStyleOf(node: XmlNode | undefined): XmlNode | undefined {
  return descend(node, 'p:txBody', 'a:lstStyle');
}

function cropOf(blipFill: XmlNode | undefined): Crop | undefined {
  const rect = child(blipFill, 'a:srcRect');
  if (!rect) return undefined;
  // Negative values mean padding around the picture, which is not a crop.
  const side = (name: string): number => Math.max(0, (intAttr(rect, name) ?? 0) / 100000);
  const crop: Crop = { l: side('l'), t: side('t'), r: side('r'), b: side('b') };
  if (crop.l === 0 && crop.t === 0 && crop.r === 0 && crop.b === 0) return undefined;
  if (crop.l + crop.r >= 1 || crop.t + crop.b >= 1) return undefined;
  return crop;
}

function roleOf(placeholderType: string): TextRole {
  if (placeholderType === 'title' || placeholderType === 'ctrTitle') return 'title';
  if (placeholderType === 'subTitle') return 'subtitle';
  return 'body';
}

/**
 * The kind of scene, from the layout. Templates often leave out the type
 * attribute (USN's own does), so the layout's name counts as well.
 */
function sceneKindOf(layoutType: string | undefined, layoutName: string | undefined): SceneKind {
  const name = (layoutName ?? '').trim().toLowerCase();
  if (layoutType === 'title' || /^(tittellysbilde|title slide|forside)/.test(name)) return 'title';
  if (layoutType === 'secHead' || /^(deloverskrift|section header|seksjonsoverskrift)/.test(name)) {
    return 'section';
  }
  if (/^(avslutning|closing|avslutt)/.test(name)) return 'closing';
  return 'content';
}

const MATH = new Set(['a14:m']);

/**
 * True when the first row's cells are filled and the second row's are not:
 * a header row made by hand instead of with the table style.
 */
function hasFilledFirstRow(table: XmlNode | undefined): boolean {
  const rows = children(table, 'a:tr');
  if (rows.length < 2) return false;
  const filled = (tr: XmlNode): boolean[] =>
    children(tr, 'a:tc').map((tc) => {
      const properties = child(tc, 'a:tcPr');
      return !!(child(properties, 'a:solidFill') ?? child(properties, 'a:gradFill'));
    });
  const first = filled(rows[0]!);
  const second = filled(rows[1]!);
  return first.length > 0 && first.every(Boolean) && !second.some(Boolean);
}

/** Plain text of a text body where every formula is written as "[formel]". */
function textWithoutFormulas(body: XmlNode | undefined): string {
  const read = (node: XmlNode): string => {
    if (node.name === 'a14:m') return '[formel]';
    if (node.name === 'a:t') return node.text;
    if (node.name === 'a:br') return ' ';
    return node.children.map(read).join('');
  };
  return children(body, 'a:p')
    .map((p) => read(p).replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '')
    .join(' ');
}

/** A picture fill may be stretched a little beyond the shape; follow that. */
function stretchedBox(box: Box, blipFill: XmlNode | undefined): Box {
  const rect = child(child(blipFill, 'a:stretch'), 'a:fillRect');
  if (!rect) return box;
  const part = (name: string): number => (intAttr(rect, name) ?? 0) / 100000;
  const l = part('l');
  const t = part('t');
  const r = part('r');
  const b = part('b');
  if (l === 0 && t === 0 && r === 0 && b === 0) return box;
  const w = Math.max(1, box.w * (1 - l - r));
  const h = Math.max(1, box.h * (1 - t - b));
  return { ...box, x: box.x + box.w * l, y: box.y + box.h * t, w, h };
}

function defined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

class SlideImporter {
  private readonly elements: Element[] = [];
  private readonly warnings: ImportWarning[] = [];
  private readonly counts: ElementCounts = { texts: 0, images: 0, tables: 0, shapes: 0, videos: 0 };
  private geometryWarned = false;

  private readonly rels: Map<string, Relationship>;
  private readonly layout: LayoutPart | undefined;
  private readonly master: MasterPart | undefined;
  private colors: ColorContext = { map: {}, scheme: {} };
  private readonly pixelsPerPoint: number;
  /** Factor on sizes of running text, see widthCompensation. */
  private readonly sansFactor: number;

  constructor(
    private readonly deck: Deck,
    private readonly part: string,
    /** Zero-based position in the presentation. */
    private readonly index: number,
    /** Scene id per slide part (lower case), for links between slides. */
    private readonly sceneIds: ReadonlyMap<string, string>,
    private readonly media: MediaStore,
  ) {
    this.rels = deck.pkg.rels(part);
    this.layout = deck.layout(deck.pkg.relatedPart(part, '/slideLayout'));
    this.master = this.layout?.master;
    this.pixelsPerPoint = EMU_PER_POINT * deck.stage.scale;
    this.sansFactor = widthCompensation(this.master?.bodyTypeface);
  }

  run(sceneId: string): ImportedSlide {
    const number = this.index + 1;
    const root = this.deck.pkg.xml(this.part);
    const kind = sceneKindOf(this.layout?.type, this.layout?.name);
    let title = `Lysark ${number}`;

    if (!root) {
      this.warn(WARNINGS.unreadableSlide());
    } else {
      this.colors = {
        map: colorMapOverride(root) ?? this.layout?.colorMapOverride ?? this.master?.colorMap ?? {},
        scheme: this.master?.colorScheme ?? {},
      };
      if (attr(root, 'show') === '0' || attr(root, 'show') === 'false') {
        this.warn(WARNINGS.hidden());
      }
      if (child(descend(root, 'p:cSld', 'p:bg', 'p:bgPr'), 'a:blipFill')) {
        this.warn(WARNINGS.background());
      }
      if (findDescendant(findDescendant(root, TIMING), ANIMATION_NODES)) {
        this.warn(WARNINGS.animation());
      }
      const tree = descend(root, 'p:cSld', 'p:spTree');
      title = this.titleOf(tree) ?? title;
      this.walk(tree?.children ?? [], [], undefined);
    }

    const decoration =
      (kind === 'title' || kind === 'section') &&
      !this.elements.some((element) => overlapsDecoration(element.box));
    const scene: Scene = {
      id: sceneId,
      title,
      kind,
      decoration,
      shapeVariant: this.index % 3,
      showLogo: true,
      elements: this.elements,
      timeline: [],
      script: this.script(),
      imported: { slide: number, warnings: this.warnings },
    };
    return { scene, counts: this.counts };
  }

  // ---------- Slide level ----------

  private warn(warning: ImportWarning): void {
    this.warnings.push(warning);
  }

  private titleOf(tree: XmlNode | undefined): string | undefined {
    for (const node of children(tree, 'p:sp')) {
      const ph = placeholderOf(node);
      if (!ph || basePlaceholderType(ph.type) !== 'title') continue;
      const text = plainParagraphs(child(node, 'p:txBody')).join(' ').replace(/\s+/g, ' ').trim();
      if (text) return text;
    }
    return undefined;
  }

  /** The manuscript: the body placeholder of the notes slide. */
  private script(): string {
    const notesPart = this.deck.pkg.relatedPart(this.part, '/notesSlide');
    const root = notesPart ? this.deck.pkg.xml(notesPart) : undefined;
    const lines: string[] = [];
    for (const node of children(descend(root, 'p:cSld', 'p:spTree'), 'p:sp')) {
      if (placeholderOf(node)?.type !== 'body') continue;
      lines.push(...plainParagraphs(child(node, 'p:txBody')));
    }
    return lines.join('\n').trim();
  }

  // ---------- Shape tree ----------

  private walk(nodes: XmlNode[], groups: GroupFrame[], groupFill: Paint | undefined): void {
    for (const node of nodes) {
      // Hidden in PowerPoint's selection pane: not shown there, so not imported.
      if (boolAttr(nonVisual(node).cNvPr, 'hidden')) continue;
      switch (node.name) {
        case 'p:sp':
        case 'p:cxnSp':
          this.shape(node, groups, groupFill);
          break;
        case 'p:pic':
          this.picture(node, groups);
          break;
        case 'p:graphicFrame':
          this.graphicFrame(node, groups);
          break;
        case 'p:grpSp': {
          const properties = child(node, 'p:grpSpPr');
          const frame = readGroupFrame(properties);
          this.walk(
            node.children,
            frame ? [frame, ...groups] : groups,
            readFill(properties, this.colors, groupFill),
          );
          break;
        }
        case 'mc:AlternateContent':
          this.alternateContent(node, groups, groupFill);
          break;
        default:
          break;
      }
    }
  }

  /** Uses the fallback when there is one; the objects it replaces still get their warning. */
  private alternateContent(
    node: XmlNode,
    groups: GroupFrame[],
    groupFill: Paint | undefined,
  ): void {
    const choice = child(node, 'mc:Choice');
    const fallback = child(node, 'mc:Fallback');
    if (!fallback || fallback.children.length === 0) {
      this.walk(choice?.children ?? [], groups, groupFill);
      return;
    }
    // A text box with formulas: PowerPoint stores a picture of the whole box
    // as the fallback. Use it, so the formulas are shown exactly as written.
    const formulaShape = children(choice, 'p:sp').find((sp) => findDescendant(sp, MATH));
    if (formulaShape) {
      const before = this.elements.length;
      this.walk(fallback.children, groups, groupFill);
      const pictures = this.elements.slice(before).filter((e) => e.type === 'image');
      if (pictures.length > 0) {
        const alt = textWithoutFormulas(child(formulaShape, 'p:txBody'));
        for (const picture of pictures) {
          if (picture.type === 'image' && picture.alt === '') picture.alt = alt;
        }
        this.warn(WARNINGS.formula());
        return;
      }
      // No picture came through: fall back to the text itself.
      this.elements.length = before;
      this.walk(choice?.children ?? [], groups, groupFill);
      return;
    }
    const imagesBefore = this.counts.images;
    this.walk(fallback.children, groups, groupFill);
    const asPicture = this.counts.images > imagesBefore;
    for (const frame of children(choice, 'p:graphicFrame')) {
      const kind = frameKind(frame);
      if (kind !== 'table') this.warn(frameWarning(kind, asPicture));
    }
  }

  private place(xfrm: Xfrm, groups: GroupFrame[]): Placed {
    return placeOnStage(xfrm, groups, this.deck.stage);
  }

  /** The layout and master placeholders a placeholder inherits from. */
  private lineage(node: XmlNode): { layout?: Placeholder; master?: Placeholder } {
    const ph = placeholderOf(node);
    if (!ph) return {};
    const layout = findLayoutPlaceholder(this.layout, ph);
    const master = findMasterPlaceholder(this.master, layout?.type ?? ph.type);
    return { layout, master };
  }

  /** The element's own xfrm, or the one a placeholder inherits from layout or master. */
  private xfrmOf(node: XmlNode): Xfrm | undefined {
    const own = readXfrm(xfrmNodeOf(node));
    if (own) return own;
    const { layout, master } = this.lineage(node);
    return readXfrm(xfrmNodeOf(layout?.node)) ?? readXfrm(xfrmNodeOf(master?.node));
  }

  // ---------- Text ----------

  private environment(
    listStyles: Array<XmlNode | undefined>,
    ownListOnly = false,
  ): TextEnvironment {
    return {
      listStyles: listStyles.filter(defined),
      resolveLink: (properties) => this.linkOf(properties),
      ownListOnly,
    };
  }

  private linkOf(runProperties: XmlNode | undefined): string | undefined {
    const rel = this.rels.get(attr(child(runProperties, 'a:hlinkClick'), 'r:id') ?? '');
    if (!rel) return undefined;
    if (!rel.external) {
      const sceneId = this.sceneIds.get(rel.target.toLowerCase());
      return sceneId ? `#scene:${sceneId}` : undefined;
    }
    const url = rel.target.trim();
    return /^(https?:|mailto:)/i.test(url) ? url : undefined;
  }

  private addText(
    box: Box,
    role: TextRole,
    text: TextBody,
    bodyProperties: Array<XmlNode | undefined>,
  ): void {
    const element: TextElement = {
      id: newId('e'),
      box,
      type: 'text',
      role,
      content: text.content,
      align: text.align,
      valign: valignOf(bodyProperties),
    };
    const fontSize = this.fontSize(text, bodyProperties[0], role);
    if (fontSize !== undefined) element.fontSize = fontSize;
    this.elements.push(element);
    this.counts.texts += 1;
  }

  /**
   * Titles are set in the serif title font, which is about as narrow as
   * Calibri; only running text needs the width compensation.
   */
  private fontSize(
    text: TextBody,
    bodyProperties: XmlNode | undefined,
    role: TextRole = 'body',
  ): number | undefined {
    const factor = role === 'title' || role === 'number' ? 1 : this.sansFactor;
    return stageFontSize(
      text.sizeWeights,
      autofitScale(bodyProperties) * factor,
      this.pixelsPerPoint,
    );
  }

  private placeholder(node: XmlNode, type: string, groups: GroupFrame[]): void {
    if (SKIPPED_PLACEHOLDERS.has(type)) return;
    const { layout, master } = this.lineage(node);
    const pictureFill = child(child(node, 'p:spPr'), 'a:blipFill');
    if (pictureFill) {
      // A placeholder drawn as a picture (PowerPoint's fallback for text with formulas).
      const box = this.place(this.xfrmOf(node) ?? wholeSlide(this.deck.stage), groups).box;
      this.image(pictureFill, nonVisual(node).cNvPr, stretchedBox(box, pictureFill), false);
    }
    const base = basePlaceholderType(type);
    const masterStyle =
      base === 'title'
        ? this.master?.titleStyle
        : base === 'body'
          ? this.master?.bodyStyle
          : this.master?.otherStyle;
    const text = readTextBody(
      child(node, 'p:txBody'),
      this.environment([
        listStyleOf(node),
        listStyleOf(layout?.node),
        listStyleOf(master?.node),
        masterStyle,
        this.deck.defaultTextStyle,
      ]),
    );
    if (text.isEmpty) return;

    let xfrm = this.xfrmOf(node);
    if (!xfrm) {
      xfrm = wholeSlide(this.deck.stage);
      this.warn(WARNINGS.noPosition());
    }
    this.addText(this.place(xfrm, groups).box, roleOf(type), text, [
      bodyPropertiesOf(node),
      bodyPropertiesOf(layout?.node),
      bodyPropertiesOf(master?.node),
    ]);
  }

  // ---------- Shapes ----------

  private shape(node: XmlNode, groups: GroupFrame[], groupFill: Paint | undefined): void {
    const isConnector = node.name === 'p:cxnSp';
    const ph = placeholderOf(node);
    if (ph && !isConnector) {
      this.placeholder(node, ph.type, groups);
      return;
    }

    const properties = child(node, 'p:spPr');
    const style = child(node, 'p:style');
    const placed = this.place(readXfrm(xfrmNodeOf(node)) ?? wholeSlide(this.deck.stage), groups);
    const text = readTextBody(
      child(node, 'p:txBody'),
      this.environment([listStyleOf(node), this.master?.otherStyle, this.deck.defaultTextStyle]),
    );
    const bodyProperties = bodyPropertiesOf(node);
    const addOwnText = (): void => {
      if (!text.isEmpty) this.addText(placed.box, 'body', text, [bodyProperties]);
    };

    const fill = shapeFill(properties, style, this.colors, groupFill);
    if (fill.kind === 'picture') {
      this.image(
        fill.blipFill,
        nonVisual(node).cNvPr,
        stretchedBox(placed.box, fill.blipFill),
        false,
      );
      addOwnText();
      return;
    }
    const line = shapeLine(properties, style, this.colors);
    const preset = attr(child(properties, 'a:prstGeom'), 'prst');

    if (isConnector || isLineGeometry(preset)) {
      // A line without a visible stroke shows nothing.
      if (line.kind !== 'color') return;
      const ends = arrowEnds(properties);
      // The arrow head is drawn at the end, so a head at the start reverses the line.
      const reversed = ends.start && !ends.end;
      this.addShape({
        box: placed.box,
        geometry: ends.start || ends.end ? 'arrow' : 'line',
        stroke: line.hex,
        flipH: placed.flipH !== reversed,
        flipV: placed.flipV !== reversed,
      });
      return;
    }

    const blockArrow = preset ? BLOCK_ARROWS[preset] : undefined;
    const arrowColor = fill.kind === 'color' ? fill.hex : line.kind === 'color' ? line.hex : null;
    if (blockArrow && arrowColor) {
      const { box } = placed;
      this.addShape({
        box: blockArrow.horizontal
          ? { ...box, y: box.y + box.h / 2 - 0.5, h: 1 }
          : { ...box, x: box.x + box.w / 2 - 0.5, w: 1 },
        geometry: 'arrow',
        stroke: arrowColor,
        flipH: blockArrow.horizontal && placed.flipH !== blockArrow.reversed,
        flipV: !blockArrow.horizontal && placed.flipV !== blockArrow.reversed,
      });
      addOwnText();
      return;
    }

    if (fill.kind === 'none' && line.kind === 'none') {
      // An invisible shape is only its text (an ordinary text box).
      addOwnText();
      return;
    }

    let geometry = preset ? SHAPE_GEOMETRY[preset] : undefined;
    if (!geometry) {
      geometry = 'rect';
      // No geometry at all is a plain rectangle; anything else has been simplified.
      if ((preset || child(properties, 'a:custGeom')) && !this.geometryWarned) {
        this.geometryWarned = true;
        this.warn(WARNINGS.geometry());
      }
    }
    this.addShape({
      box: placed.box,
      geometry,
      fill: fill.kind === 'color' ? fill.hex : undefined,
      stroke: fill.kind === 'none' && line.kind === 'color' ? line.hex : undefined,
      content: text.isEmpty ? undefined : text,
      bodyProperties,
    });
  }

  private addShape(spec: {
    box: Box;
    geometry: ShapeElement['geometry'];
    fill?: string;
    stroke?: string;
    flipH?: boolean;
    flipV?: boolean;
    content?: TextBody;
    bodyProperties?: XmlNode;
  }): void {
    const element: ShapeElement = {
      id: newId('e'),
      box: spec.box,
      type: 'shape',
      geometry: spec.geometry,
    };
    if (spec.fill) element.fill = nearestPaletteColor(spec.fill);
    if (spec.stroke) element.stroke = nearestPaletteColor(spec.stroke);
    if (spec.flipH) element.flipH = true;
    if (spec.flipV) element.flipV = true;
    if (spec.content) {
      element.content = spec.content.content;
      const fontSize = this.fontSize(spec.content, spec.bodyProperties);
      if (fontSize !== undefined) element.fontSize = fontSize;
    }
    this.elements.push(element);
    this.counts.shapes += 1;
  }

  // ---------- Pictures and video ----------

  /**
   * Stores the picture of a blip fill and returns its asset id. With `quiet`
   * nothing is reported when the picture cannot be used.
   */
  private imageAsset(blipFill: XmlNode | undefined, quiet: boolean): string | undefined {
    const blip = child(blipFill, 'a:blip');
    const rel =
      this.rels.get(attr(blip, 'r:embed') ?? '') ?? this.rels.get(attr(blip, 'r:link') ?? '');
    if (!rel) return undefined;
    if (rel.external) {
      if (!quiet) this.warn(WARNINGS.imageLinked());
      return undefined;
    }
    const data = this.deck.pkg.bytes(rel.target);
    if (!data) {
      if (!quiet) this.warn(WARNINGS.imageMissing());
      return undefined;
    }
    const extension = extensionOf(rel.target);
    const format = imageFormat(extension);
    if (!format) {
      if (!quiet) this.warn(WARNINGS.imageFormat(extension));
      return undefined;
    }
    return this.media.add(rel.target, data, 'image', format);
  }

  private image(
    blipFill: XmlNode | undefined,
    cNvPr: XmlNode | undefined,
    box: Box,
    quiet: boolean,
  ): boolean {
    const asset = this.imageAsset(blipFill, quiet);
    if (!asset) return false;
    const element: ImageElement = {
      id: newId('e'),
      box,
      type: 'image',
      asset,
      alt: (attr(cNvPr, 'descr') ?? '').trim(),
    };
    if (boolAttr(findDescendant(cNvPr, DECORATIVE), 'val')) element.decorative = true;
    const crop = cropOf(blipFill);
    if (crop) element.crop = crop;
    this.elements.push(element);
    this.counts.images += 1;
    return true;
  }

  /** Sound or video attached to a picture, with the relationships that point at the file. */
  private attachedMedia(
    nvPr: XmlNode | undefined,
  ): { kind: 'audio' } | { kind: 'video'; rels: Relationship[] } | undefined {
    const audio =
      child(nvPr, 'a:audioFile') ?? child(nvPr, 'a:wavAudioFile') ?? child(nvPr, 'a:audioCd');
    const video = child(nvPr, 'a:videoFile') ?? child(nvPr, 'a:quickTimeFile');
    const modern = findDescendant(child(nvPr, 'p:extLst'), MODERN_MEDIA);
    if (!audio && !video && !modern) return undefined;
    if (audio) return { kind: 'audio' };
    const rels = [attr(modern, 'r:embed'), attr(modern, 'r:link'), attr(video, 'r:link')]
      .map((id) => (id ? this.rels.get(id) : undefined))
      .filter(defined);
    const audioOnly =
      !video && rels.length > 0 && rels.every((rel) => isAudioExtension(extensionOf(rel.target)));
    return audioOnly ? { kind: 'audio' } : { kind: 'video', rels };
  }

  /**
   * A p:pic: an image, or a video with the picture as poster. Returns true
   * when an element was created.
   */
  private picture(
    node: XmlNode,
    groups: GroupFrame[],
    options: { xfrm?: Xfrm; quiet?: boolean } = {},
  ): boolean {
    const { cNvPr, nvPr } = nonVisual(node);
    // The template's own logo picture is left out: the theme places USN's logo.
    if ((attr(cNvPr, 'name') ?? '').trim().toLowerCase() === 'logo') return false;
    const blipFill = child(node, 'p:blipFill');
    const quiet = options.quiet ?? false;
    const xfrm = options.xfrm ?? this.xfrmOf(node) ?? wholeSlide(this.deck.stage);
    const { box } = this.place(xfrm, groups);

    const attached = this.attachedMedia(nvPr);
    if (attached?.kind === 'audio') {
      this.warn(WARNINGS.audio());
      return false;
    }
    if (attached?.kind === 'video') {
      const source = this.videoSource(attached.rels);
      if (source) {
        const element: VideoElement = {
          id: newId('e'),
          box,
          type: 'video',
          source,
          title:
            (attr(cNvPr, 'descr') ?? '').trim() || (attr(cNvPr, 'name') ?? '').trim() || 'Video',
        };
        const poster = this.imageAsset(blipFill, true);
        if (poster) element.poster = poster;
        this.elements.push(element);
        this.counts.videos += 1;
        return true;
      }
      const internal = attached.rels.find((rel) => !rel.external);
      this.warn(
        internal ? WARNINGS.videoFormat(extensionOf(internal.target)) : WARNINGS.videoLinked(),
      );
      // The poster picture is imported below so the place of the video is not lost.
    }
    return this.image(blipFill, cNvPr, box, quiet);
  }

  private videoSource(rels: Relationship[]): VideoSource | undefined {
    for (const rel of rels) {
      if (rel.external) continue;
      const format = videoFormat(extensionOf(rel.target));
      const data = format ? this.deck.pkg.bytes(rel.target) : undefined;
      if (format && data) {
        return { kind: 'asset', asset: this.media.add(rel.target, data, 'video', format) };
      }
    }
    for (const rel of rels) {
      const url = rel.target.trim();
      if (rel.external && /^https?:\/\//i.test(url)) return { kind: 'url', url };
    }
    return undefined;
  }

  // ---------- Graphic frames ----------

  private graphicFrame(node: XmlNode, groups: GroupFrame[]): void {
    const kind = frameKind(node);
    const data = descend(node, 'a:graphic', 'a:graphicData');
    if (kind === 'table') {
      this.table(node, child(data, 'a:tbl'), groups);
      return;
    }
    // Embedded objects usually carry a preview picture of themselves.
    const preview =
      findDescendant(findDescendant(data, FALLBACK), PICTURE) ?? findDescendant(data, PICTURE);
    const asPicture = preview
      ? this.picture(preview, groups, { xfrm: this.xfrmOf(node), quiet: true })
      : false;
    this.warn(frameWarning(kind, asPicture));
  }

  private table(frame: XmlNode, table: XmlNode | undefined, groups: GroupFrame[]): void {
    const environment = this.environment(
      [this.master?.otherStyle, this.deck.defaultTextStyle],
      true,
    );
    const sizeWeights = new Map<number, number>();
    const rows: TableCell[][] = [];
    let widest = 0;
    for (const tr of children(table, 'a:tr')) {
      const row: TableCell[] = [];
      let span = 0;
      for (const tc of children(tr, 'a:tc')) {
        span += 1;
        // Cells covered by a merged neighbour are left out of the row.
        if (boolAttr(tc, 'hMerge') || boolAttr(tc, 'vMerge')) continue;
        const colSpan = Math.max(1, intAttr(tc, 'gridSpan') ?? 1);
        const rowSpan = Math.max(1, intAttr(tc, 'rowSpan') ?? 1);
        const text = readTextBody(child(tc, 'a:txBody'), environment);
        for (const [size, weight] of text.sizeWeights) {
          sizeWeights.set(size, (sizeWeights.get(size) ?? 0) + weight);
        }
        const cell: TableCell = {
          content: text.isEmpty
            ? { paragraphs: [{ level: 0, list: 'none', runs: [] }] }
            : text.content,
        };
        if (colSpan > 1) cell.colSpan = colSpan;
        if (rowSpan > 1) cell.rowSpan = rowSpan;
        row.push(cell);
      }
      widest = Math.max(widest, span);
      rows.push(row);
    }
    if (rows.length === 0 || widest === 0) return;

    const widths = children(child(table, 'a:tblGrid'), 'a:gridCol').map((column) => {
      const width = Math.round((intAttr(column, 'w') ?? 0) * this.deck.stage.scale * 100) / 100;
      return width > 0 ? width : 1;
    });
    const element: TableElement = {
      id: newId('e'),
      box: this.place(this.xfrmOf(frame) ?? wholeSlide(this.deck.stage), groups).box,
      type: 'table',
      columns: widths.length > 0 ? widths : new Array<number>(widest).fill(1),
      headerRow: boolAttr(child(table, 'a:tblPr'), 'firstRow') || hasFilledFirstRow(table),
      rows,
    };
    const fontSize = stageFontSize(sizeWeights, this.sansFactor, this.pixelsPerPoint);
    if (fontSize !== undefined) element.fontSize = fontSize;
    this.elements.push(element);
    this.counts.tables += 1;
  }
}

export function importSlide(
  deck: Deck,
  part: string,
  index: number,
  sceneId: string,
  sceneIds: ReadonlyMap<string, string>,
  media: MediaStore,
): ImportedSlide {
  return new SlideImporter(deck, part, index, sceneIds, media).run(sceneId);
}
