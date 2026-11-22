// Builds small PPTX files for the importer tests: hand-written OOXML,
// laid out the way PowerPoint writes a package, zipped with fflate.
// All content is neutral ("A", "B", "Tittel"); nothing here is real data.
import { strToU8, zipSync, zlibSync } from 'fflate';

const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const NS_P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main';
const NS_RELS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const ROOT_NS = `xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" xmlns:mc="${NS_MC}" xmlns:p14="${NS_P14}"`;
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
/** Relationship types. */
export const REL = {
  officeDocument: `${OFFICE_REL}/officeDocument`,
  coreProperties:
    'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
  slide: `${OFFICE_REL}/slide`,
  slideLayout: `${OFFICE_REL}/slideLayout`,
  slideMaster: `${OFFICE_REL}/slideMaster`,
  notesSlide: `${OFFICE_REL}/notesSlide`,
  theme: `${OFFICE_REL}/theme`,
  image: `${OFFICE_REL}/image`,
  hyperlink: `${OFFICE_REL}/hyperlink`,
  video: `${OFFICE_REL}/video`,
  audio: `${OFFICE_REL}/audio`,
  media: 'http://schemas.microsoft.com/office/2007/relationships/media',
  chart: `${OFFICE_REL}/chart`,
  oleObject: `${OFFICE_REL}/oleObject`,
} as const;

/** graphicData uri values. */
export const URI = {
  table: 'http://schemas.openxmlformats.org/drawingml/2006/table',
  chart: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
  diagram: 'http://schemas.openxmlformats.org/drawingml/2006/diagram',
  ole: 'http://schemas.openxmlformats.org/presentationml/2006/ole',
} as const;

/** A 16:9 slide of 12192000 x 6858000 EMU maps to the stage at 6350 EMU per pixel. */
export const EMU_PER_PX = 6350;
export const WIDE = { width: 1920 * EMU_PER_PX, height: 1080 * EMU_PER_PX };
/** 4:3: 9144000 x 6858000 EMU, the same 6350 EMU per pixel, 1440 pixels wide. */
export const STANDARD = { width: 1440 * EMU_PER_PX, height: 1080 * EMU_PER_PX };

export function emu(pixels: number): number {
  return Math.round(pixels * EMU_PER_PX);
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- XML snippets ----------

/** a:xfrm with position and size in stage pixels. `attrs` e.g. ' rot="5400000" flipH="1"'. */
export function xfrm(x: number, y: number, w: number, h: number, attrs = ''): string {
  return `<a:xfrm${attrs}><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>`;
}

/** a:r. `rPr` is the attribute string of a:rPr, `rPrChildren` its child elements. */
export function run(text: string, rPr = '', rPrChildren = ''): string {
  const properties =
    rPr || rPrChildren ? `<a:rPr lang="nb-NO"${rPr ? ` ${rPr}` : ''}>${rPrChildren}</a:rPr>` : '';
  return `<a:r>${properties}<a:t>${escapeXml(text)}</a:t></a:r>`;
}

/** a:p. `content` is runs (or plain text), `pPr` a complete a:pPr element. */
export function para(content: string, pPr = ''): string {
  const runs = content.startsWith('<') || content === '' ? content : run(content);
  return `<a:p>${pPr}${runs}</a:p>`;
}

/** p:txBody. `paragraphs` are a:p elements. */
export function txBody(
  paragraphs: string,
  options: { bodyPr?: string; lstStyle?: string; tag?: string } = {},
): string {
  const tag = options.tag ?? 'p:txBody';
  return `<${tag}>${options.bodyPr ?? '<a:bodyPr/>'}<a:lstStyle>${options.lstStyle ?? ''}</a:lstStyle>${paragraphs || '<a:p/>'}</${tag}>`;
}

let nextShapeId = 100;

export interface ShapeSpec {
  name?: string;
  /** Extra attribute string of p:cNvPr, e.g. ' hidden="1"'. */
  cNvPrAttrs?: string;
  /** Attribute string of p:ph, e.g. 'type="title"' or 'idx="1"'. Makes the shape a placeholder. */
  ph?: string;
  /** a:xfrm element; leave out for placeholders that inherit their position. */
  xfrm?: string;
  /** Content of p:spPr after the xfrm: geometry, fill, line. */
  spPr?: string;
  /** p:style element. */
  style?: string;
  /** p:txBody element. */
  body?: string;
  txBox?: boolean;
}

export function sp(spec: ShapeSpec): string {
  const id = nextShapeId++;
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(spec.name ?? `Form ${id}`)}"${spec.cNvPrAttrs ?? ''}/>` +
    `<p:cNvSpPr${spec.txBox ? ' txBox="1"' : ''}/><p:nvPr>${spec.ph !== undefined ? `<p:ph ${spec.ph}/>` : ''}</p:nvPr></p:nvSpPr>` +
    `<p:spPr>${spec.xfrm ?? ''}${spec.spPr ?? ''}</p:spPr>${spec.style ?? ''}${spec.body ?? ''}</p:sp>`
  );
}

/** A text box: no fill, no line. */
export function textBox(x: number, y: number, w: number, h: number, body: string): string {
  return sp({
    txBox: true,
    xfrm: xfrm(x, y, w, h),
    spPr: '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>',
    body,
  });
}

export interface PictureSpec {
  /** Relationship id of the picture. */
  embed: string;
  xfrm?: string;
  name?: string;
  descr?: string;
  /** Attribute string of a:srcRect, e.g. 'l="10000" t="20000"'. */
  srcRect?: string;
  /** Child elements of p:cNvPr (extension list). */
  cNvPrChildren?: string;
  /** Content of p:nvPr (video and sound references, placeholder). */
  nvPr?: string;
}

export function pic(spec: PictureSpec): string {
  const id = nextShapeId++;
  const descr = spec.descr !== undefined ? ` descr="${escapeXml(spec.descr)}"` : '';
  return (
    `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${escapeXml(spec.name ?? `Bilde ${id}`)}"${descr}>${spec.cNvPrChildren ?? ''}</p:cNvPr>` +
    `<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr>${spec.nvPr ?? ''}</p:nvPr></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="${spec.embed}"/>${spec.srcRect ? `<a:srcRect ${spec.srcRect}/>` : ''}<a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr>${spec.xfrm ?? ''}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
  );
}

/** p:cxnSp. `ln` is a complete a:ln element. */
export function connector(xfrmXml: string, ln: string, preset = 'straightConnector1'): string {
  const id = nextShapeId++;
  return (
    `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="Kobling ${id}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>` +
    `<p:spPr>${xfrmXml}<a:prstGeom prst="${preset}"><a:avLst/></a:prstGeom>${ln}</p:spPr></p:cxnSp>`
  );
}

export interface GroupSpec {
  /** Frame of the group in its parent's coordinates, stage pixels. */
  frame: { x: number; y: number; w: number; h: number };
  /** Child coordinate space, stage pixels. Defaults to the frame (no scaling). */
  child?: { x: number; y: number; w: number; h: number };
  /** Attribute string of the group's a:xfrm, e.g. ' flipH="1"'. */
  attrs?: string;
  children: string;
}

export function group(spec: GroupSpec): string {
  const id = nextShapeId++;
  const c = spec.child ?? spec.frame;
  const f = spec.frame;
  return (
    `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="Gruppe ${id}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm${spec.attrs ?? ''}><a:off x="${emu(f.x)}" y="${emu(f.y)}"/><a:ext cx="${emu(f.w)}" cy="${emu(f.h)}"/>` +
    `<a:chOff x="${emu(c.x)}" y="${emu(c.y)}"/><a:chExt cx="${emu(c.w)}" cy="${emu(c.h)}"/></a:xfrm></p:grpSpPr>` +
    `${spec.children}</p:grpSp>`
  );
}

/** p:graphicFrame. `data` is the content of a:graphicData. */
export function graphicFrame(
  x: number,
  y: number,
  w: number,
  h: number,
  uri: string,
  data: string,
): string {
  const id = nextShapeId++;
  return (
    `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Ramme ${id}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
    `<p:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></p:xfrm>` +
    `<a:graphic><a:graphicData uri="${uri}">${data}</a:graphicData></a:graphic></p:graphicFrame>`
  );
}

/** a:tc with plain text. `attrs` e.g. ' gridSpan="2"' or ' hMerge="1"'. */
export function cell(text: string, attrs = ''): string {
  return `<a:tc${attrs}>${txBody(text ? para(text) : '', { tag: 'a:txBody' })}<a:tcPr/></a:tc>`;
}

/** a:tbl. Column widths in stage pixels; rows are lists of a:tc elements. */
export function table(
  columns: number[],
  rows: string[][],
  tblPr = 'firstRow="1" bandRow="1"',
): string {
  const grid = columns.map((w) => `<a:gridCol w="${emu(w)}"/>`).join('');
  const body = rows.map((cells) => `<a:tr h="${emu(40)}">${cells.join('')}</a:tr>`).join('');
  return `<a:tbl><a:tblPr ${tblPr}/><a:tblGrid>${grid}</a:tblGrid>${body}</a:tbl>`;
}

// ---------- Masters and layouts ----------

/** The master's title and body placeholders, with positions in stage pixels. */
export const MASTER_TITLE_BOX = { x: 120, y: 60, w: 1680, h: 180 };
export const MASTER_BODY_BOX = { x: 120, y: 280, w: 1680, h: 640 };

const FOOTER_PLACEHOLDERS =
  sp({ ph: 'type="dt" sz="half" idx="10"', body: txBody(para('1.1.2000')) }) +
  sp({ ph: 'type="ftr" sz="quarter" idx="11"', body: txBody(para('Bunntekst')) }) +
  sp({ ph: 'type="sldNum" sz="quarter" idx="12"', body: txBody(para('1')) });

export function defaultMasterShapes(bodyListStyle = ''): string {
  const t = MASTER_TITLE_BOX;
  const b = MASTER_BODY_BOX;
  return (
    sp({
      ph: 'type="title"',
      xfrm: xfrm(t.x, t.y, t.w, t.h),
      body: txBody(para('Tittelstil'), { bodyPr: '<a:bodyPr anchor="ctr"/>' }),
    }) +
    sp({
      ph: 'type="body" idx="1"',
      xfrm: xfrm(b.x, b.y, b.w, b.h),
      body: txBody(para('Tekststil'), { lstStyle: bodyListStyle }),
    }) +
    FOOTER_PLACEHOLDERS
  );
}

/** Master text styles like PowerPoint's: 44 pt title, bulleted body, 18 pt other text. */
export const DEFAULT_TX_STYLES =
  '<p:titleStyle><a:lvl1pPr algn="l"><a:buNone/><a:defRPr sz="4400" b="1"/></a:lvl1pPr></p:titleStyle>' +
  '<p:bodyStyle>' +
  '<a:lvl1pPr marL="228600" indent="-228600" algn="l"><a:buFont typeface="Arial"/><a:buChar char="&#8226;"/><a:defRPr sz="2800"/></a:lvl1pPr>' +
  '<a:lvl2pPr marL="685800" indent="-228600" algn="l"><a:buFont typeface="Arial"/><a:buChar char="&#8226;"/><a:defRPr sz="2400"/></a:lvl2pPr>' +
  '<a:lvl3pPr marL="1143000" indent="-228600" algn="l"><a:buFont typeface="Arial"/><a:buChar char="&#8226;"/><a:defRPr sz="2000"/></a:lvl3pPr>' +
  '<a:lvl4pPr marL="1600200" indent="-228600" algn="l"><a:buFont typeface="Arial"/><a:buChar char="&#8226;"/><a:defRPr sz="1800"/></a:lvl4pPr>' +
  '<a:lvl5pPr marL="2057400" indent="-228600" algn="l"><a:buFont typeface="Arial"/><a:buChar char="&#8226;"/><a:defRPr sz="1800"/></a:lvl5pPr>' +
  '</p:bodyStyle>' +
  '<p:otherStyle><a:lvl1pPr marL="0" algn="l"><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle>';

export interface LayoutSpec {
  /** The type attribute of p:sldLayout; left out when undefined. */
  type?: string;
  shapes: string;
}

/** "Title and Content": both placeholders inherit their position from the master. */
export const LAYOUT_CONTENT: LayoutSpec = {
  type: 'obj',
  shapes:
    sp({ ph: 'type="title"', body: txBody(para('Klikk for tittel')) }) +
    sp({ ph: 'idx="1"', body: txBody(para('Klikk for tekst')) }),
};

export const LAYOUT_TITLE_BOXES = {
  title: { x: 240, y: 200, w: 800, h: 300 },
  subtitle: { x: 240, y: 540, w: 800, h: 200 },
};

/** "Title Slide": centred title and subtitle with their own positions. */
export const LAYOUT_TITLE: LayoutSpec = {
  type: 'title',
  shapes:
    sp({
      ph: 'type="ctrTitle"',
      xfrm: xfrm(240, 200, 800, 300),
      body: txBody(para('Klikk for tittel'), {
        bodyPr: '<a:bodyPr anchor="b"/>',
        lstStyle: '<a:lvl1pPr algn="ctr"><a:defRPr sz="6000"/></a:lvl1pPr>',
      }),
    }) +
    sp({
      ph: 'type="subTitle" idx="1"',
      xfrm: xfrm(240, 540, 800, 200),
      body: txBody(para('Klikk for undertittel'), {
        lstStyle:
          '<a:lvl1pPr marL="0" indent="0" algn="ctr"><a:buNone/><a:defRPr sz="2400"/></a:lvl1pPr>',
      }),
    }),
};

/** "Section Header". */
export const LAYOUT_SECTION: LayoutSpec = {
  type: 'secHead',
  shapes:
    sp({
      ph: 'type="title"',
      xfrm: xfrm(120, 300, 900, 300),
      body: txBody(para('Klikk for tittel'), { bodyPr: '<a:bodyPr anchor="b"/>' }),
    }) +
    sp({
      ph: 'type="body" idx="1"',
      xfrm: xfrm(120, 640, 900, 160),
      body: txBody(para('Klikk for tekst'), {
        lstStyle: '<a:lvl1pPr marL="0" indent="0"><a:buNone/><a:defRPr sz="2400"/></a:lvl1pPr>',
      }),
    }),
};

/** "Blank": no placeholders. */
export const LAYOUT_BLANK: LayoutSpec = { type: 'blank', shapes: '' };

// ---------- The package ----------

export interface RelSpec {
  id: string;
  type: string;
  target: string;
  external?: boolean;
}

export interface SlideSpec {
  /** Content of p:spTree after the group properties. */
  shapes?: string;
  /** Index into the deck's layouts. Default 0. */
  layout?: number;
  /** Paragraphs of the notes. Gives the slide a notes slide. */
  notes?: string[];
  hidden?: boolean;
  /** Complete p:timing element. */
  timing?: string;
  /** Complete p:bg element. */
  background?: string;
  /** Relationships besides the layout and the notes slide. */
  rels?: RelSpec[];
}

export interface DeckSpec {
  slides: SlideSpec[];
  size?: { width: number; height: number };
  /** Order of the slides in p:sldIdLst, as indices into `slides`. Default: as listed. */
  order?: number[];
  layouts?: LayoutSpec[];
  masterShapes?: string;
  /** Content of p:txStyles. */
  txStyles?: string;
  /** Attribute string of p:clrMap. */
  clrMap?: string;
  /** Theme colours by scheme name (dk1, lt1, accent1 ...), as RRGGBB. */
  themeColors?: Record<string, string>;
  /** dc:title in docProps/core.xml; no core properties part when undefined. */
  coreTitle?: string;
  /** Content of p:defaultTextStyle in the presentation. */
  defaultTextStyle?: string;
  /** Files in ppt/media/ by file name. */
  media?: Record<string, Uint8Array>;
  /** Extra parts by full path, e.g. charts. */
  parts?: Record<string, string>;
}

const DEFAULT_CLR_MAP =
  'bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"';

/** Theme colours of the fixture. They equal colours in the program's palette. */
export const THEME_COLORS: Record<string, string> = {
  dk1: '000000',
  lt1: 'FFFFFF',
  dk2: '2F0B63',
  lt2: 'FFF5EE',
  accent1: '7800F0',
  accent2: 'FF6202',
  accent3: 'EF7DBB',
  accent4: 'CFFF1F',
  accent5: '9595F9',
  accent6: 'FFD9B1',
  hlink: '7800F0',
  folHlink: '2F0B63',
};

function relationships(rels: RelSpec[]): string {
  const items = rels
    .map(
      (rel) =>
        `<Relationship Id="${rel.id}" Type="${rel.type}" Target="${escapeXml(rel.target)}"${rel.external ? ' TargetMode="External"' : ''}/>`,
    )
    .join('');
  return `${XML_HEADER}<Relationships xmlns="${NS_RELS}">${items}</Relationships>`;
}

function shapeTree(shapes: string): string {
  return (
    '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    `${shapes}</p:spTree>`
  );
}

function themeXml(colors: Record<string, string>): string {
  const order = [
    'dk1',
    'lt1',
    'dk2',
    'lt2',
    'accent1',
    'accent2',
    'accent3',
    'accent4',
    'accent5',
    'accent6',
    'hlink',
    'folHlink',
  ];
  const scheme = order
    .map((name) => {
      const hex = colors[name] ?? '000000';
      // PowerPoint writes the first two as system colours.
      if (name === 'dk1') return `<a:dk1><a:sysClr val="windowText" lastClr="${hex}"/></a:dk1>`;
      if (name === 'lt1') return `<a:lt1><a:sysClr val="window" lastClr="${hex}"/></a:lt1>`;
      return `<a:${name}><a:srgbClr val="${hex}"/></a:${name}>`;
    })
    .join('');
  return (
    `${XML_HEADER}<a:theme xmlns:a="${NS_A}" name="Testtema"><a:themeElements>` +
    `<a:clrScheme name="Test">${scheme}</a:clrScheme>` +
    '<a:fontScheme name="Test"><a:majorFont><a:latin typeface="Liberation Serif"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
    '<a:minorFont><a:latin typeface="Liberation Sans"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
    '<a:fmtScheme name="Test"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>' +
    '<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>' +
    '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
    '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>' +
    '</a:fmtScheme></a:themeElements></a:theme>'
  );
}

function notesXml(paragraphs: string[]): string {
  const shapes =
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Plassholder for lysbilde 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>' +
    `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Plassholder for notater 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>${txBody(paragraphs.map((text) => para(text)).join(''))}</p:sp>` +
    `<p:sp><p:nvSpPr><p:cNvPr id="4" name="Plassholder for lysbildenummer 3"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldNum" sz="quarter" idx="5"/></p:nvPr></p:nvSpPr><p:spPr/>${txBody('<a:p><a:fld id="{00000000-0000-0000-0000-000000000000}" type="slidenum"><a:rPr lang="nb-NO"/><a:t>9</a:t></a:fld></a:p>')}</p:sp>`;
  return `${XML_HEADER}<p:notes ${ROOT_NS}><p:cSld>${shapeTree(shapes)}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
}

/** Zips a deck description into the bytes of a PPTX. */
export function buildPptx(spec: DeckSpec): Uint8Array {
  const size = spec.size ?? WIDE;
  const layouts = spec.layouts ?? [LAYOUT_CONTENT];
  const order = spec.order ?? spec.slides.map((_, i) => i);
  const files: Record<string, Uint8Array> = {};
  const add = (path: string, content: string): void => {
    files[path] = strToU8(content);
  };

  const overrides: string[] = [
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
  ];

  // Package relationships and document properties.
  const packageRels: RelSpec[] = [
    { id: 'rId1', type: REL.officeDocument, target: 'ppt/presentation.xml' },
  ];
  if (spec.coreTitle !== undefined) {
    packageRels.push({ id: 'rId2', type: REL.coreProperties, target: 'docProps/core.xml' });
    overrides.push(
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    );
    add(
      'docProps/core.xml',
      `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"><dc:title>${escapeXml(spec.coreTitle)}</dc:title></cp:coreProperties>`,
    );
  }
  add('_rels/.rels', relationships(packageRels));

  // Presentation.
  const presentationRels: RelSpec[] = [
    { id: 'rId1', type: REL.slideMaster, target: 'slideMasters/slideMaster1.xml' },
    { id: 'rIdTheme', type: REL.theme, target: 'theme/theme1.xml' },
  ];
  spec.slides.forEach((_, i) => {
    presentationRels.push({
      id: `rIdSlide${i + 1}`,
      type: REL.slide,
      target: `slides/slide${i + 1}.xml`,
    });
  });
  const slideIds = order
    .map((slideIndex, i) => `<p:sldId id="${256 + i}" r:id="rIdSlide${slideIndex + 1}"/>`)
    .join('');
  add(
    'ppt/presentation.xml',
    `${XML_HEADER}<p:presentation ${ROOT_NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
      `<p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="${size.width}" cy="${size.height}"/><p:notesSz cx="6858000" cy="9144000"/>` +
      `${spec.defaultTextStyle !== undefined ? `<p:defaultTextStyle>${spec.defaultTextStyle}</p:defaultTextStyle>` : ''}</p:presentation>`,
  );
  add('ppt/_rels/presentation.xml.rels', relationships(presentationRels));

  // Master and theme.
  const masterRels: RelSpec[] = layouts.map((_, i) => ({
    id: `rId${i + 1}`,
    type: REL.slideLayout,
    target: `../slideLayouts/slideLayout${i + 1}.xml`,
  }));
  masterRels.push({ id: 'rIdTheme', type: REL.theme, target: '../theme/theme1.xml' });
  const layoutIds = layouts
    .map((_, i) => `<p:sldLayoutId id="${2147483649 + i}" r:id="rId${i + 1}"/>`)
    .join('');
  add(
    'ppt/slideMasters/slideMaster1.xml',
    `${XML_HEADER}<p:sldMaster ${ROOT_NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>${shapeTree(spec.masterShapes ?? defaultMasterShapes())}</p:cSld>` +
      `<p:clrMap ${spec.clrMap ?? DEFAULT_CLR_MAP}/><p:sldLayoutIdLst>${layoutIds}</p:sldLayoutIdLst>` +
      `<p:txStyles>${spec.txStyles ?? DEFAULT_TX_STYLES}</p:txStyles></p:sldMaster>`,
  );
  add('ppt/slideMasters/_rels/slideMaster1.xml.rels', relationships(masterRels));
  add('ppt/theme/theme1.xml', themeXml({ ...THEME_COLORS, ...spec.themeColors }));

  // Layouts.
  layouts.forEach((layout, i) => {
    const path = `ppt/slideLayouts/slideLayout${i + 1}.xml`;
    add(
      path,
      `${XML_HEADER}<p:sldLayout ${ROOT_NS}${layout.type !== undefined ? ` type="${layout.type}"` : ''} preserve="1"><p:cSld name="Oppsett ${i + 1}">${shapeTree(layout.shapes)}</p:cSld>` +
        '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>',
    );
    add(
      `ppt/slideLayouts/_rels/slideLayout${i + 1}.xml.rels`,
      relationships([
        { id: 'rId1', type: REL.slideMaster, target: '../slideMasters/slideMaster1.xml' },
      ]),
    );
    overrides.push(
      `<Override PartName="/${path}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>`,
    );
  });

  // Slides and notes.
  spec.slides.forEach((slide, i) => {
    const path = `ppt/slides/slide${i + 1}.xml`;
    const rels: RelSpec[] = [
      {
        id: 'rIdLayout',
        type: REL.slideLayout,
        target: `../slideLayouts/slideLayout${(slide.layout ?? 0) + 1}.xml`,
      },
    ];
    if (slide.notes) {
      const notesPath = `ppt/notesSlides/notesSlide${i + 1}.xml`;
      rels.push({
        id: 'rIdNotes',
        type: REL.notesSlide,
        target: `../notesSlides/notesSlide${i + 1}.xml`,
      });
      add(notesPath, notesXml(slide.notes));
      add(
        `ppt/notesSlides/_rels/notesSlide${i + 1}.xml.rels`,
        relationships([{ id: 'rId1', type: REL.slide, target: `../slides/slide${i + 1}.xml` }]),
      );
      overrides.push(
        `<Override PartName="/${notesPath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`,
      );
    }
    rels.push(...(slide.rels ?? []));
    add(
      path,
      `${XML_HEADER}<p:sld ${ROOT_NS}${slide.hidden ? ' show="0"' : ''}><p:cSld>${slide.background ?? ''}${shapeTree(slide.shapes ?? '')}</p:cSld>` +
        `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${slide.timing ?? ''}</p:sld>`,
    );
    add(`ppt/slides/_rels/slide${i + 1}.xml.rels`, relationships(rels));
    overrides.push(
      `<Override PartName="/${path}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
    );
  });

  for (const [name, data] of Object.entries(spec.media ?? {})) files[`ppt/media/${name}`] = data;
  for (const [path, content] of Object.entries(spec.parts ?? {})) add(path, content);

  add(
    '[Content_Types].xml',
    `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>' +
      '<Default Extension="emf" ContentType="image/x-emf"/><Default Extension="mp4" ContentType="video/mp4"/>' +
      `${overrides.join('')}</Types>`,
  );

  return zipSync(files);
}

// ---------- Media ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(strToU8(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** A valid 1 x 1 pixel PNG in the given colour. Different colours give different bytes. */
export function tinyPng(red: number, green: number, blue: number): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // Width 1, height 1, 8 bits per channel, colour type 2 (RGB).
  const header = new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  const pixels = zlibSync(new Uint8Array([0, red, green, blue]));
  const chunks = [
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', pixels),
    pngChunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
