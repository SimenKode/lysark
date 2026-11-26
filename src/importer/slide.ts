// One slide to one scene: walks the shape tree in z-order and builds the
// elements, the import warnings, the scene title and the manuscript.
import { newId, richText } from '../shared/format/factory';
import type { Stage } from '../shared/format/constants';
import type {
  Box,
  Crop,
  Element,
  FigureElement,
  ImageElement,
  ImportWarning,
  Inset,
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
import { followFigures } from '../shared/layout/groups';
import { followTemplates } from '../shared/layout/templates';
import { nearestPaletteColor } from '../shared/theme/palette';
import { THEME_REN, logoArea, overlapsDecoration, type Theme } from '../shared/theme/theme';
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
  insetBox,
  placeOnStage,
  readGroupFrame,
  readXfrm,
  freeformStroke,
  strokeXfrm,
  turnBox,
  wholeSlide,
  type GroupFrame,
  type Placed,
  type Xfrm,
} from './geometry';
import { imageFormat, isAudioExtension, videoFormat, type MediaStore } from './media';
import { readChart } from './chart';
import { WARNINGS } from './messages';
import { extensionOf, type Relationship } from './package';
import { fitTable, type FitCell } from './tableFit';
import {
  autofitScale,
  heaviest,
  indentsFor,
  insetsOf,
  isDefaultInsets,
  levelScaleFor,
  lineReductionFactor,
  plainParagraphs,
  readTextBody,
  spacingFor,
  stageFontSize,
  titleCompensation,
  verticalTurnOf,
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
  // A rectangle with a point, used as a label that points at something.
  homePlate: 'sign',
};

/** Block arrows become plain arrows through the middle of their box. */
const BLOCK_ARROWS: Record<string, { horizontal: boolean; reversed: boolean }> = {
  rightArrow: { horizontal: true, reversed: false },
  notchedRightArrow: { horizontal: true, reversed: false },
  stripedRightArrow: { horizontal: true, reversed: false },
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

/** Arrow shapes other than the straight block arrows (callouts are boxes, not arrows). */
function isOtherArrow(preset: string): boolean {
  return /Arrow$/.test(preset) && !BLOCK_ARROWS[preset];
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

/**
 * True when an element lies where the logo goes. Text counts only when it
 * sits at the bottom of the slide, since a tall text box is mostly empty
 * below its text.
 */
export function coversLogoIn(theme: Theme, element: Element): boolean {
  const { x, y, w, h } = element.box;
  const a = logoArea(theme, 'nb');
  const overlaps = x < a.x + a.w && x + w > a.x && y < a.y + a.h && y + h > a.y;
  if (!overlaps) return false;
  if (element.type !== 'text') return true;
  return element.valign === 'bottom' || y >= theme.stage.height * 0.75;
}

/** `coversLogoIn` on a lying slide. */
export function coversLogo(element: Element): boolean {
  return coversLogoIn(THEME_REN, element);
}

/** True for a picture or video that fills the whole slide (such as USN's logo animation). */
function coversStage(element: Element, stage: Stage): boolean {
  const { x, y, w, h } = element.box;
  return (
    (element.type === 'image' || element.type === 'video') &&
    x <= 20 &&
    y <= 20 &&
    x + w >= stage.width - 20 &&
    y + h >= stage.height - 20
  );
}

function defined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

class SlideImporter {
  private readonly elements: Element[] = [];
  private readonly warnings: ImportWarning[] = [];
  private readonly counts: ElementCounts = { texts: 0, images: 0, tables: 0, shapes: 0, videos: 0 };
  private geometryWarned = false;
  private arrowWarned = false;

  private readonly rels: Map<string, Relationship>;
  private readonly layout: LayoutPart | undefined;
  private readonly master: MasterPart | undefined;
  private colors: ColorContext = { map: {}, scheme: {} };
  private readonly pixelsPerPoint: number;
  /** Factor on sizes of running text, see widthCompensation. */
  private readonly sansFactor: number;
  /** Factor on sizes of titles, see titleCompensation. */
  private readonly titleFactor: number;

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
    this.titleFactor = titleCompensation(this.master?.titleTypeface);
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
      !this.elements.some((element) => overlapsDecoration(element.box, this.deck.theme));
    // A logo that content covers or crowds breaks the brand manual, so the
    // scene starts without it; the owner can switch it on after tidying up.
    const theme = this.deck.theme;
    const showLogo = !this.elements.some((element) => coversLogoIn(theme, element));
    if (!showLogo) {
      this.warn(WARNINGS.logo(this.elements.some((element) => coversStage(element, theme.stage))));
    }
    const scene: Scene = {
      id: sceneId,
      title,
      kind,
      decoration,
      shapeVariant: this.index % 3,
      showLogo,
      elements: this.elements,
      timeline: [],
      script: this.script(),
      imported: { slide: number, warnings: this.warnings },
    };
    // A diagram is drawn from its table: its bars and curves are made here,
    // as they are after every change in the editor.
    followTemplates(scene);
    followFigures(scene);
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
    const elementsBefore = this.elements.length;
    this.walk(fallback.children, groups, groupFill);
    const asPicture = this.counts.images > imagesBefore;
    // Ink from PowerPoint's pen or highlighter: its picture is drawn so
    // that what lies under it shows through, as in PowerPoint.
    if (children(choice, 'p:contentPart').length > 0) {
      for (const element of this.elements.slice(elementsBefore)) {
        if (element.type !== 'image') continue;
        element.blend = 'multiply';
        element.decorative = true;
        element.alt = '';
      }
    }
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
    // The text keeps to the area inside PowerPoint's text margins, and
    // vertical text becomes a turned text box.
    const insets = insetsOf(bodyProperties);
    const scale = this.deck.stage.scale;
    let textBox = insetBox(
      box,
      insets.l * scale,
      insets.t * scale,
      insets.r * scale,
      insets.b * scale,
    );
    const turn = verticalTurnOf(bodyProperties);
    if (turn !== 0) textBox = turnBox(textBox, turn);
    const element: TextElement = {
      id: newId('e'),
      box: textBox,
      type: 'text',
      role,
      content: text.content,
      align: text.align,
      valign: valignOf(bodyProperties),
    };
    const fontSize = this.fontSize(text, bodyProperties[0], role);
    if (fontSize !== undefined) element.fontSize = fontSize;
    const levelScale = levelScaleFor(text, THEME_REN.levelScale);
    if (levelScale) element.levelScale = levelScale;
    const indent = indentsFor(text, this.deck.stage.scale, element.fontSize);
    if (indent) element.indent = indent;
    Object.assign(
      element,
      spacingFor(
        text,
        this.compensation(role),
        THEME_REN.roles[role].lineHeight,
        lineReductionFactor(bodyProperties[0]),
      ),
    );
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
    const factor = this.compensation(role);
    return stageFontSize(
      text.sizeWeights,
      autofitScale(bodyProperties) * factor,
      this.pixelsPerPoint,
    );
  }

  /** The factor on imported font sizes for a role (see widthCompensation). */
  private compensation(role: TextRole): number {
    if (role === 'title') return this.titleFactor;
    return role === 'number' ? 1 : this.sansFactor;
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
    const xfrm = readXfrm(xfrmNodeOf(node));
    // A freeform that is an open stroke is a line.
    const stroke = xfrm
      ? freeformStroke(child(properties, 'a:custGeom'), xfrm, fill.kind !== 'none')
      : undefined;

    if (isConnector || isLineGeometry(preset) || stroke) {
      // A line without a visible stroke shows nothing.
      if (line.kind !== 'color') return;
      if (stroke?.approximate && !this.geometryWarned) {
        this.geometryWarned = true;
        this.warn(WARNINGS.geometry());
      }
      const ends = arrowEnds(properties);
      // The arrow head is drawn at the end, so a head at the start reverses the line.
      const reversed = ends.start && !ends.end;
      const strokePlaced = stroke && xfrm ? this.place(strokeXfrm(xfrm, stroke), groups) : placed;
      // A freeform stroke may run from right to left or from bottom to top.
      const leftward = stroke ? stroke.x2 < stroke.x1 : false;
      const upward = stroke ? stroke.y2 < stroke.y1 : false;
      this.addShape({
        box: strokePlaced.box,
        geometry: ends.start || ends.end ? 'arrow' : 'line',
        stroke: line.hex,
        flipH: (strokePlaced.flipH !== leftward) !== reversed,
        flipV: (strokePlaced.flipV !== upward) !== reversed,
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

    // Curved, bent and two-headed arrows have no counterpart. A rectangle in
    // their place would cover what they point at, so they are left out.
    if (preset && isOtherArrow(preset)) {
      if (!this.arrowWarned) {
        this.arrowWarned = true;
        this.warn(WARNINGS.arrow());
      }
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
      // A sign that is mirrored points the other way.
      ...(geometry === 'sign' && placed.flipH ? { flipH: true } : {}),
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
      const levelScale = levelScaleFor(spec.content, THEME_REN.levelScale);
      if (levelScale) element.levelScale = levelScale;
      const indent = indentsFor(spec.content, this.deck.stage.scale, element.fontSize);
      if (indent) element.indent = indent;
      Object.assign(
        element,
        spacingFor(
          spec.content,
          this.compensation('body'),
          THEME_REN.roles.body.lineHeight,
          lineReductionFactor(spec.bodyProperties),
        ),
      );
      if (spec.content.align !== 'center') element.align = spec.content.align;
      const anchor = valignOf([spec.bodyProperties]);
      if (attr(spec.bodyProperties, 'anchor') !== undefined && anchor !== 'middle') {
        element.valign = anchor;
      }
      const turn = verticalTurnOf([spec.bodyProperties]);
      if (turn !== 0) element.textRotation = turn;
      // PowerPoint's default margins are the theme's; other margins are kept.
      const insets = insetsOf([spec.bodyProperties]);
      if (!isDefaultInsets(insets)) {
        const px = (emu: number): number => Math.round(emu * this.deck.stage.scale * 10) / 10;
        element.textInset = { l: px(insets.l), t: px(insets.t), r: px(insets.r), b: px(insets.b) };
      }
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
    if (kind === 'chart' && this.chart(node, data, groups)) return;
    // Embedded objects usually carry a preview picture of themselves.
    const preview =
      findDescendant(findDescendant(data, FALLBACK), PICTURE) ?? findDescendant(data, PICTURE);
    const asPicture = preview
      ? this.picture(preview, groups, { xfrm: this.xfrmOf(node), quiet: true })
      : false;
    this.warn(frameWarning(kind, asPicture));
  }

  /**
   * A chart that Lysark can draw itself (standing bars, or lines) becomes a
   * diagram with the chart's own numbers and names, which the
   * lecturer can change (the owner's choice, 26.11.2026). Returns false for
   * any other chart; it is then kept as the picture it was.
   */
  private chart(node: XmlNode, data: XmlNode | undefined, groups: GroupFrame[]): boolean {
    const rel = this.rels.get(attr(child(data, 'c:chart'), 'r:id') ?? '');
    const xfrm = this.xfrmOf(node);
    if (!rel || rel.external || !xfrm) return false;
    const table = readChart(this.deck.pkg.xml(rel.target));
    if (!table) return false;
    const box = { ...this.place(xfrm, groups).box, rotation: 0 };
    // Too small to hold axes and numbers: the picture says more.
    if (box.w < 240 || box.h < 180) return false;
    if (table.title) {
      // The chart's own heading stands over the diagram, in the room the chart had.
      const height = Math.round(Math.min(64, box.h * 0.14));
      this.elements.push({
        id: newId('e'),
        type: 'text',
        role: 'body',
        content: richText(table.title),
        fontSize: Math.round(height * 0.55),
        align: 'center',
        valign: 'middle',
        box: { ...box, h: height },
      });
      this.counts.texts += 1;
      box.y += height;
      box.h -= height;
    }
    const figure: FigureElement = {
      id: newId('e'),
      type: 'figure',
      template: table.template,
      box,
      series: table.series.map((name) => ({ id: newId('e'), name })),
      items: table.rows.map((row) => ({
        id: newId('e'),
        text: row.text,
        values: row.values,
        ...(table.template === 'line' && !table.along ? { x: row.x } : {}),
      })),
    };
    for (const key of [
      'xTitle',
      'yTitle',
      'xMin',
      'xMax',
      'yMin',
      'yMax',
      'dots',
      'along',
    ] as const) {
      if (table[key] !== undefined) Object.assign(figure, { [key]: table[key] });
    }
    this.elements.push(figure);
    this.counts.shapes += 1;
    this.warn(WARNINGS.chartConverted());
    return true;
  }

  /**
   * The cell margins most cells of a table have, in stage pixels, when they
   * are not PowerPoint's defaults (0.1 inch left and right, 0.05 inch top
   * and bottom, which are the theme's too).
   */
  private cellInset(table: XmlNode | undefined): Inset | undefined {
    const DEFAULT = '91440,45720,91440,45720';
    const counts = new Map<string, number>();
    for (const tr of children(table, 'a:tr')) {
      for (const tc of children(tr, 'a:tc')) {
        const properties = child(tc, 'a:tcPr');
        const side = (name: string, fallback: number): number => {
          const value = intAttr(properties, name);
          return value !== undefined && value >= 0 ? value : fallback;
        };
        const key = [
          side('marL', 91440),
          side('marT', 45720),
          side('marR', 91440),
          side('marB', 45720),
        ].join(',');
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    let common = DEFAULT;
    let most = 0;
    for (const [key, count] of counts) {
      if (count > most) {
        common = key;
        most = count;
      }
    }
    if (common === DEFAULT) return undefined;
    const [l, t, r, b] = common
      .split(',')
      .map((emu) => Math.round(Number(emu) * this.deck.stage.scale * 10) / 10);
    return { l: l!, t: t!, r: r!, b: b! };
  }

  private table(frame: XmlNode, table: XmlNode | undefined, groups: GroupFrame[]): void {
    const environment = {
      ...this.environment([this.master?.otherStyle, this.deck.defaultTextStyle], true),
      keepGaps: true,
    };
    const sizeWeights = new Map<number, number>();
    const rows: TableCell[][] = [];
    /** What is known of each cell that is kept: where it stands, its text and its own size (1/100 pt). */
    const read: Array<{ cell: TableCell; fit: FitCell; text: TextBody; size?: number }> = [];
    const leastHeights: number[] = [];
    const headerRow = boolAttr(child(table, 'a:tblPr'), 'firstRow') || hasFilledFirstRow(table);
    let widest = 0;
    for (const tr of children(table, 'a:tr')) {
      const row: TableCell[] = [];
      const rowIndex = rows.length;
      leastHeights.push(Math.max(0, (intAttr(tr, 'h') ?? 0) * this.deck.stage.scale));
      let span = 0;
      for (const tc of children(tr, 'a:tc')) {
        const column = span;
        span += 1;
        // Cells covered by a merged neighbour are left out of the row.
        if (boolAttr(tc, 'hMerge') || boolAttr(tc, 'vMerge')) continue;
        const colSpan = Math.max(1, intAttr(tc, 'gridSpan') ?? 1);
        const rowSpan = Math.max(1, intAttr(tc, 'rowSpan') ?? 1);
        const body = child(tc, 'a:txBody');
        const text = readTextBody(body, environment);
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
        if (!text.isEmpty && text.align !== 'left') cell.align = text.align;
        const valign = valignOf([child(tc, 'a:tcPr')]);
        if (valign !== 'top') cell.valign = valign;
        // An empty cell is as tall as the mark at the end of its paragraph.
        const size =
          heaviest(text.sizeWeights) ??
          intAttr(child(child(body, 'a:p'), 'a:endParaRPr'), 'sz') ??
          text.levelSizes[0];
        const fit: FitCell = {
          row: rowIndex,
          column,
          colSpan,
          rowSpan,
          content: cell.content,
          scale: 1,
          header: headerRow && rowIndex === 0,
        };
        read.push({ cell, fit, text, size });
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
      headerRow,
      rows,
    };
    const fontSize = stageFontSize(sizeWeights, this.sansFactor, this.pixelsPerPoint);
    if (fontSize !== undefined) element.fontSize = fontSize;
    const cellInset = this.cellInset(table);
    if (cellInset) element.cellInset = cellInset;
    // The rows keep the heights PowerPoint gave them, as the least they can be.
    // (A table in a group is scaled with the group.)
    const frameHeight = (this.xfrmOf(frame)?.h ?? 0) * this.deck.stage.scale;
    const boxScale = frameHeight > 0 ? element.box.h / frameHeight : 1;
    if (leastHeights.some((height) => height > 0)) {
      element.rowHeights = leastHeights.map((height) => Math.round(height * boxScale * 10) / 10);
    }

    // Each cell keeps its own size, as a factor on the table's.
    const tableSize = heaviest(sizeWeights);
    for (const { cell, fit, size } of read) {
      if (tableSize === undefined || size === undefined) continue;
      const scale = Math.round((size / tableSize) * 100) / 100;
      if (scale !== 1) {
        cell.scale = scale;
        fit.scale = scale;
      }
    }
    Object.assign(element, this.tableSpacing(read, tableSize));

    // Text that needs more room than PowerPoint gave the table is made
    // smaller, evenly, so that the table stays inside its box.
    const size = element.fontSize ?? 30;
    const total = element.columns.reduce((a, b) => a + b, 0);
    const fitted = fitTable(
      {
        columns: element.columns.map((width) => (width / total) * element.box.w),
        rowHeights: rows.map((_, i) => element.rowHeights?.[i] ?? 0),
        cells: read.map(({ fit }) => fit),
        inset: element.cellInset,
        lineHeight: element.lineHeight,
        spaceBefore: element.spaceBefore,
        levelScale: THEME_REN.levelScale,
      },
      size,
      // The box, or the rows' own heights where they add up to more; a
      // pixel is given for the rounding of the heights.
      Math.max(element.box.h, element.rowHeights?.reduce((a, b) => a + b, 0) ?? 0) + 1,
    );
    if (fitted.fontSize !== size) element.fontSize = fitted.fontSize;
    if (!fitted.fits) this.warn(WARNINGS.tableTooTall());
    this.elements.push(element);
    this.counts.tables += 1;
  }

  /**
   * PowerPoint's spacing in the cells of a table, in the units of the
   * project format: the line height that covers most text, and the space
   * above a paragraph of each level, as factors of the cell's font size.
   * Left out where the theme's would do as well.
   */
  private tableSpacing(
    cells: ReadonlyArray<{ text: TextBody; size?: number }>,
    tableSize: number | undefined,
  ): { lineHeight?: number; spaceBefore?: number[] } {
    const lines = new Map<number, number>();
    const before = Array.from({ length: 5 }, () => new Map<number, number>());
    let paragraphs = 0;
    for (const { text, size } of cells) {
      const sizePt = (size ?? tableSize ?? 1800) / 100;
      text.content.paragraphs.forEach((paragraph, index) => {
        const spacing = text.spacing[index];
        if (!spacing) return;
        const weight = Math.max(1, spacing.chars);
        const line = Math.round((spacing.line / this.sansFactor) * 100) / 100;
        lines.set(line, (lines.get(line) ?? 0) + weight);
        if (index === 0) return;
        paragraphs += 1;
        const em = Math.round((spacing.before / (sizePt * this.sansFactor)) * 100) / 100;
        const weights = before[paragraph.level]!;
        weights.set(em, (weights.get(em) ?? 0) + weight);
      });
    }
    const result: { lineHeight?: number; spaceBefore?: number[] } = {};
    const lineHeight = heaviest(lines);
    // The theme's line height of a table (renderTable).
    if (lineHeight !== undefined && Math.abs(lineHeight - 1.3) > 0.02)
      result.lineHeight = lineHeight;
    if (paragraphs > 0) result.spaceBefore = before.map((weights) => heaviest(weights) ?? 0);
    return result;
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
