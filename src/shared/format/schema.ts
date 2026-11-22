// The project format. One format is read by the editor, the HTML player and
// the video export. Content refers to palette tokens and text roles,
// never to raw colours or fonts, so a theme change never touches content.
import { z } from 'zod';
import { migrateProject } from './migrate';

export const FORMAT_NAME = 'lysark';
/**
 * 2: every element can carry "Lær mer" content (`more`); assets can carry a credit.
 * 3: shapes can carry their own stroke width.
 * 4: slides can carry sound (a recording as a list of clips); assets can be
 *    sound files; the project carries its choices for video export.
 */
export const FORMAT_VERSION = 4;

export { STAGE } from './constants';

export const PALETTE_COLORS = [
  'lilla',
  'mediumLilla',
  'lysLilla',
  'indigo',
  'mediumIndigo',
  'lysIndigo',
  'oransje',
  'beige',
  'mediumBeige',
  'lysBeige',
  'rosa',
  'mediumRosa',
  'syregronn',
  'mediumSyregronn',
  'sort',
  'hvit',
] as const;
export const PaletteColor = z.enum(PALETTE_COLORS);
export type PaletteColor = z.infer<typeof PaletteColor>;

/**
 * Colours the brand manual allows as large background surfaces: the light
 * colours and the purples. Orange, pink and acid green are never surfaces.
 */
export const SURFACES = [
  'hvit',
  'lysBeige',
  'mediumBeige',
  'beige',
  'lysLilla',
  'lysIndigo',
  'lilla',
  'mediumLilla',
  'indigo',
  'mediumIndigo',
] as const;
export const Surface = z.enum(SURFACES);
export type Surface = z.infer<typeof Surface>;

// ---------- Rich text ----------

export const Run = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  /** The brand's text marking: a rectangular colour field behind running text. */
  mark: z.boolean().optional(),
  /** http(s):, mailto: or "#scene:<sceneId>". */
  link: z.string().optional(),
  /** Subscript or superscript, as in CO₂ and m². */
  script: z.enum(['sub', 'super']).optional(),
});
export type Run = z.infer<typeof Run>;

/** How a numbered paragraph is numbered, as its first marker would read. "1." when absent. */
export const NUMBER_STYLES = ['1)', 'a.', 'a)', 'A.', 'A)', 'i.', 'I.'] as const;

export const Paragraph = z.object({
  level: z.number().int().min(0).max(4),
  list: z.enum(['none', 'bullet', 'number']),
  numberStyle: z.enum(NUMBER_STYLES).optional(),
  runs: z.array(Run),
});
export type Paragraph = z.infer<typeof Paragraph>;

export const RichText = z.object({ paragraphs: z.array(Paragraph) });
export type RichText = z.infer<typeof RichText>;

// ---------- Elements ----------

export const Box = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  rotation: z.number(),
});
export type Box = z.infer<typeof Box>;

export const VideoSource = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('asset'), asset: z.string() }),
  z.object({ kind: z.literal('url'), url: z.string() }),
]);
export type VideoSource = z.infer<typeof VideoSource>;

export const TableCell = z.object({
  content: RichText,
  colSpan: z.number().int().min(1).optional(),
  rowSpan: z.number().int().min(1).optional(),
});
export type TableCell = z.infer<typeof TableCell>;

// ---------- "Lær mer": content that elaborates on an element ----------

const blockId = z.string().min(1);

/** One building block of the panel that opens when a student asks for more. */
export const MoreBlock = z.discriminatedUnion('kind', [
  z.object({ id: blockId, kind: z.literal('heading'), text: z.string() }),
  z.object({ id: blockId, kind: z.literal('text'), content: RichText }),
  z.object({
    id: blockId,
    kind: z.literal('image'),
    asset: z.string(),
    alt: z.string(),
    caption: z.string().optional(),
  }),
  z.object({
    id: blockId,
    kind: z.literal('video'),
    source: VideoSource,
    title: z.string(),
    /** Still picture shown before a web video is fetched. */
    poster: z.string().optional(),
  }),
  z.object({
    id: blockId,
    kind: z.literal('table'),
    columns: z.array(z.number().positive()).min(1),
    headerRow: z.boolean(),
    rows: z.array(z.array(TableCell)).min(1),
  }),
  /** A web page shown inside the panel, fetched only when the student asks for it. */
  z.object({ id: blockId, kind: z.literal('embed'), url: z.string(), title: z.string() }),
]);
export type MoreBlock = z.infer<typeof MoreBlock>;
export type MoreBlockKind = MoreBlock['kind'];

export const MORE_CORNERS = ['tr', 'tl', 'br', 'bl'] as const;

export const More = z.object({
  /** Heading of the panel, and the name of the mark for screen readers. */
  title: z.string(),
  blocks: z.array(MoreBlock),
  /** Which corner of the element carries the "+" mark. Top right when absent. */
  corner: z.enum(MORE_CORNERS).optional(),
});
export type More = z.infer<typeof More>;

const elementBase = {
  id: z.string().min(1),
  box: Box,
  /** Optional label shown in the element and step lists. */
  name: z.string().optional(),
  /** "Lær mer" content attached to this element. Any element can have it. */
  more: More.optional(),
};

/**
 * Font size per list level, as a factor on the element's size. Imported
 * text keeps the sizes PowerPoint gave each level this way.
 */
export const LevelScale = z.array(z.number().positive()).length(5);
export type LevelScale = z.infer<typeof LevelScale>;

/**
 * Spacing that imported text keeps from PowerPoint. When absent the
 * theme's spacing is used.
 */
const spacingFields = {
  /** Line height as a factor of the font size. */
  lineHeight: z.number().positive().optional(),
  /**
   * Space above a paragraph of each list level (0-4), as a factor of the
   * element's font size. The first paragraph never has space above it.
   */
  spaceBefore: z.array(z.number().min(0)).length(5).optional(),
  /**
   * Indents of each list level (0-4), as factors of the element's font
   * size: where the first line or its bullet starts, and where the text
   * starts. When absent the theme's indents are used.
   */
  indent: z
    .array(z.object({ start: z.number().min(0), text: z.number().min(0) }))
    .length(5)
    .optional(),
};

/** Margins between an edge and the text inside it, in stage pixels. */
export const Inset = z.object({
  l: z.number().min(0),
  t: z.number().min(0),
  r: z.number().min(0),
  b: z.number().min(0),
});
export type Inset = z.infer<typeof Inset>;

export const TEXT_ROLES = ['title', 'subtitle', 'heading', 'body', 'caption', 'number'] as const;
export const TextRole = z.enum(TEXT_ROLES);
export type TextRole = z.infer<typeof TextRole>;

export const TextElement = z.object({
  ...elementBase,
  type: z.literal('text'),
  role: TextRole,
  content: RichText,
  /** Stage pixels. When absent the role's size from the theme is used. */
  fontSize: z.number().positive().optional(),
  /** Font size factor per list level (0-4). When absent the theme's is used. */
  levelScale: LevelScale.optional(),
  ...spacingFields,
  align: z.enum(['left', 'center', 'right']),
  valign: z.enum(['top', 'middle', 'bottom']),
  /** Optional override; must be allowed on the surface by the contrast table. */
  color: PaletteColor.optional(),
});
export type TextElement = z.infer<typeof TextElement>;

export const Crop = z.object({ l: z.number(), t: z.number(), r: z.number(), b: z.number() });
export type Crop = z.infer<typeof Crop>;

export const ImageElement = z.object({
  ...elementBase,
  type: z.literal('image'),
  asset: z.string(),
  /** Text alternative. Empty together with decorative=true for pure decoration. */
  alt: z.string(),
  decorative: z.boolean().optional(),
  /** Fractions (0..1) cut from each side of the source image. */
  crop: Crop.optional(),
  /**
   * "multiply" lets what lies under the picture show through, as PowerPoint
   * draws ink from its pen and highlighter.
   */
  blend: z.literal('multiply').optional(),
});
export type ImageElement = z.infer<typeof ImageElement>;

/** The thinnest and thickest stroke a shape can be given. */
export const STROKE_WIDTH = { min: 1, max: 60 } as const;
export const SHAPE_GEOMETRIES = ['rect', 'roundRect', 'ellipse', 'line', 'arrow'] as const;
export const ShapeElement = z.object({
  ...elementBase,
  type: z.literal('shape'),
  geometry: z.enum(SHAPE_GEOMETRIES),
  fill: PaletteColor.optional(),
  stroke: PaletteColor.optional(),
  /**
   * Thickness of a line, an arrow or an outline, in stage pixels. The head
   * of an arrow grows with it. When absent the theme's thickness is used.
   */
  strokeWidth: z.number().min(STROKE_WIDTH.min).max(STROKE_WIDTH.max).optional(),
  /** For line and arrow: which diagonal of the box, and the arrow direction. */
  flipH: z.boolean().optional(),
  flipV: z.boolean().optional(),
  content: RichText.optional(),
  fontSize: z.number().positive().optional(),
  levelScale: LevelScale.optional(),
  ...spacingFields,
  /** Alignment of the shape's text. When absent it is centred. */
  align: z.enum(['left', 'center', 'right']).optional(),
  valign: z.enum(['top', 'middle', 'bottom']).optional(),
  /** Text running down (90) or up (270) inside the shape, which itself stays as it is. */
  textRotation: z.union([z.literal(90), z.literal(270)]).optional(),
  /** Margins between the shape's edge and its text, in stage pixels. When absent the theme's are used. */
  textInset: Inset.optional(),
});
export type ShapeElement = z.infer<typeof ShapeElement>;

export const TableElement = z.object({
  ...elementBase,
  type: z.literal('table'),
  /** Relative column widths. */
  columns: z.array(z.number().positive()).min(1),
  headerRow: z.boolean(),
  /** Cells covered by a span of another cell are left out of their row. */
  rows: z.array(z.array(TableCell)).min(1),
  fontSize: z.number().positive().optional(),
  /** Margins inside each cell, in stage pixels. When absent the theme's are used. */
  cellInset: Inset.optional(),
});
export type TableElement = z.infer<typeof TableElement>;

export const VideoElement = z.object({
  ...elementBase,
  type: z.literal('video'),
  source: VideoSource,
  /** Accessible name and visible caption. */
  title: z.string(),
  poster: z.string().optional(),
});
export type VideoElement = z.infer<typeof VideoElement>;

/**
 * The "+ Lær mer" button: an element whose only job is to open its `more`
 * content. The simple way in; any other element can carry `more` too.
 */
export const DeepDiveElement = z.object({
  ...elementBase,
  type: z.literal('deepdive'),
  /** Text on the button. The theme's "Lær mer" when empty. */
  label: z.string(),
});
export type DeepDiveElement = z.infer<typeof DeepDiveElement>;

export const Element = z.discriminatedUnion('type', [
  TextElement,
  ImageElement,
  ShapeElement,
  TableElement,
  VideoElement,
  DeepDiveElement,
]);
export type Element = z.infer<typeof Element>;
export type ElementType = Element['type'];

// ---------- Timeline ----------

export const STEP_EFFECTS = ['appear', 'fade'] as const;
export const StepAction = z.object({
  target: z.string(),
  effect: z.enum(STEP_EFFECTS),
  /** Seconds. */
  duration: z.number().min(0),
  delay: z.number().min(0).optional(),
});
export type StepAction = z.infer<typeof StepAction>;

/**
 * A step is "now this comes in". In HTML a key press goes to the next step;
 * in video and in "Spill av" each step has a time, `at`, in seconds from the
 * start of the scene. Elements not targeted by any step are visible from
 * the start.
 */
export const Step = z.object({
  id: z.string().min(1),
  at: z.number().min(0).optional(),
  actions: z.array(StepAction),
});
export type Step = z.infer<typeof Step>;

// ---------- Sound ----------

/**
 * One piece of a slide's sound track. A track is a list of clips played one
 * after the other. Editing never changes a recording: a cut only changes
 * which parts of it the clips point at, so everything can be undone.
 */
export const AudioClip = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    kind: z.literal('sound'),
    /** A sound asset: mono WAV, 48 kHz, 16 bit. */
    asset: z.string(),
    /** The part of the recording that is played, in seconds from its start. */
    from: z.number().min(0),
    to: z.number().positive(),
  }),
  /** Silence: the picture stands while nothing is said. */
  z.object({ id: z.string().min(1), kind: z.literal('pause'), duration: z.number().positive() }),
]);
export type AudioClip = z.infer<typeof AudioClip>;

/** Limits of the loudness change of a slide, in decibels. */
export const GAIN_DB = { min: -18, max: 18 } as const;

export const SceneAudio = z.object({
  clips: z.array(AudioClip),
  /** Loudness change for the whole slide, in decibels. 0 when absent. */
  gain: z.number().min(GAIN_DB.min).max(GAIN_DB.max).optional(),
});
export type SceneAudio = z.infer<typeof SceneAudio>;

// ---------- Scenes ----------

export const IMPORT_WARNING_CODES = [
  'smartart',
  'chart',
  'animation',
  'image-format',
  'embedded-object',
  'media',
  'hidden',
  'background',
  'geometry',
  'text',
  'other',
] as const;
export const ImportWarning = z.object({
  code: z.enum(IMPORT_WARNING_CODES),
  /** Norwegian bokmål, shown to the owner in the import report. */
  message: z.string(),
});
export type ImportWarning = z.infer<typeof ImportWarning>;

export const SCENE_KINDS = ['title', 'section', 'content', 'closing'] as const;
export const SceneKind = z.enum(SCENE_KINDS);
export type SceneKind = z.infer<typeof SceneKind>;

export const Scene = z.object({
  id: z.string().min(1),
  /** Shown in the overview and table of contents. */
  title: z.string(),
  kind: SceneKind,
  /** Override of the theme's surface for this kind of scene. */
  background: Surface.optional(),
  /** Show the pair of overlapping brand shapes (title and section scenes). */
  decoration: z.boolean(),
  /** Which of the theme's shape pairs to use. */
  shapeVariant: z.number().int().min(0),
  showLogo: z.boolean(),
  /** Back to front. */
  elements: z.array(Element),
  timeline: z.array(Step),
  /** Voice-over manuscript; comes from the PPTX notes on import. */
  script: z.string(),
  /**
   * The slide's sound track. Its length is the length of the slide in
   * video and in "Spill av". A slide without one stands for a default time.
   */
  audio: SceneAudio.optional(),
  imported: z
    .object({ slide: z.number().int().min(1), warnings: z.array(ImportWarning) })
    .optional(),
});
export type Scene = z.infer<typeof Scene>;

// ---------- Project ----------

/** Who made a picture or video, and on what terms it may be used. */
export const Credit = z.object({
  /** Title of the work. */
  title: z.string().optional(),
  author: z.string().optional(),
  /** Short name of the licence, such as "CC BY-SA 4.0". */
  license: z.string().optional(),
  licenseUrl: z.string().optional(),
  /** The page that describes the work (for Wikimedia Commons, its file page). */
  sourceUrl: z.string().optional(),
  /** The licence demands that author and licence are shown; the credit cannot be removed. */
  required: z.boolean().optional(),
});
export type Credit = z.infer<typeof Credit>;

export const Asset = z.object({
  kind: z.enum(['image', 'video', 'audio']),
  /** Path relative to the project folder, always inside media/. */
  file: z.string().regex(/^media\/[A-Za-z0-9._-]+$/),
  mime: z.string(),
  bytes: z.number().int().min(0),
  /** Original file name, for the owner's reference. */
  name: z.string().optional(),
  credit: Credit.optional(),
});
export type Asset = z.infer<typeof Asset>;

export const Project = z.object({
  format: z.literal(FORMAT_NAME),
  version: z.literal(FORMAT_VERSION),
  meta: z.object({
    title: z.string(),
    course: z.string().optional(),
    author: z.string().optional(),
    /** Language of the player's own buttons and help texts. */
    language: z.enum(['nb', 'en']),
  }),
  theme: z.object({ style: z.enum(['ren']) }),
  export: z.object({
    /** Let students open the manuscript panel in the exported HTML. */
    showScript: z.boolean(),
  }),
  /** Choices for the video export. Defaults apply when absent. */
  video: z
    .object({
      /** Between slides: a clean cut, or a short fade. */
      transition: z.enum(['cut', 'fade']),
      /** Even out the loudness of the whole video when it is exported. */
      evenLoudness: z.boolean(),
      /** End the video with slides that list the picture credits. */
      credits: z.boolean(),
    })
    .optional(),
  assets: z.record(z.string(), Asset),
  scenes: z.array(Scene),
});
export type Project = z.infer<typeof Project>;

/** Parses and validates a project read from disk. Throws with a readable message. */
export function parseProject(data: unknown): Project {
  const head = z.object({ format: z.string(), version: z.number() }).safeParse(data);
  if (!head.success || head.data.format !== FORMAT_NAME) {
    throw new Error('Fila er ikke et Lysark-prosjekt.');
  }
  if (head.data.version > FORMAT_VERSION) {
    throw new Error(
      `Prosjektet er laget med en nyere utgave av Lysark (format ${head.data.version}).`,
    );
  }
  const result = Project.safeParse(migrateProject(data, FORMAT_VERSION));
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first ? first.path.join('.') : '';
    throw new Error(`Prosjektfila er skadet (${where}: ${first?.message ?? 'ukjent feil'}).`);
  }
  return result.data;
}
