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
 * 5: the "sign" shape (a rectangle with a point); a closing slide can play
 *    the brand's closing animation.
 * 6: slides remember what was opened and played while they were read in
 *    (events); the project has tracks for music and other sound.
 * 7: a recording can carry a film of the lecturer's face (the camera
 *    circle); a slide says where the circle stands, and events can move it.
 * 8: a picture can carry marks (numbered points with a legend, or labels
 *    with a line to what they point at).
 * 9: a slide can begin a chapter, and can be another slide shown once more.
 * 10: elements can be grouped, and the ends of a line or an arrow can be
 *    fastened to other elements.
 * 11: figures that draw themselves from a form (process, layers, comparison).
 */
export const FORMAT_VERSION = 11;

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
  /**
   * Elements of a slide that carry the same value here are a group: they
   * are chosen, moved, resized and copied as one, and each is still an
   * element of its own that can come in at a step. A group has at least two
   * members, and groups do not lie inside groups (src/shared/layout/groups.ts).
   */
  group: z.string().min(1).optional(),
  /**
   * The element is a part of a figure that draws itself from its form: the
   * figure it belongs to, and which part of it this is. What such a part
   * looks like and where it stands is worked out from the form after every
   * change (`followTemplates` in src/shared/layout/templates.ts); its step
   * and its "Lær mer" content are its own.
   */
  of: z.object({ figure: z.string().min(1), part: z.string().min(1) }).optional(),
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

export const MARK_STYLES = ['numbers', 'labels'] as const;
export type MarkStyle = (typeof MARK_STYLES)[number];

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
  /**
   * How the marks on this picture are drawn: numbered points that a legend
   * explains, or labels with a line to what they point at. Numbers when absent.
   */
  marks: z.enum(MARK_STYLES).optional(),
});
export type ImageElement = z.infer<typeof ImageElement>;

/**
 * A mark on a picture: something the lecturer points out in it. Marks are
 * elements of their own, so each can come in at a step and have "Lær mer"
 * content, but they belong to their picture: they follow it when it is
 * moved or resized, and go when it goes (src/shared/layout/marks.ts).
 *
 * With numbers, the mark is a numbered point: its box is the round mark,
 * `point` is its middle, and `text` is what the legend says about it. With
 * labels, the box is the label that shows `text`, and a line runs from it
 * to `point`.
 */
export const MarkElement = z.object({
  ...elementBase,
  type: z.literal('mark'),
  /** The picture the mark belongs to. */
  on: z.string(),
  text: z.string(),
  /** What the mark points at, in stage pixels. */
  point: z.object({ x: z.number(), y: z.number() }),
  /**
   * The box of the picture when the mark was last put in place. When the
   * picture's box is another, `point` is moved the same way, and the mark's
   * own box is worked out from it anew.
   */
  anchor: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  /** For a label: how far the middle of the label lies from `point`. */
  offset: z.object({ x: z.number(), y: z.number() }).optional(),
});
export type MarkElement = z.infer<typeof MarkElement>;

/** The list that explains the numbered marks of a picture. It writes itself from the marks. */
export const LegendElement = z.object({
  ...elementBase,
  type: z.literal('legend'),
  /** The picture whose marks it explains. */
  on: z.string(),
  /**
   * Where the picture's corner was when the legend was last put in place,
   * and how far from that corner the legend lay. When the picture has been
   * moved, the legend is put the same distance from it again.
   */
  anchor: z.object({ x: z.number(), y: z.number() }).optional(),
  offset: z.object({ x: z.number(), y: z.number() }).optional(),
});
export type LegendElement = z.infer<typeof LegendElement>;

/** The thinnest and thickest stroke a shape can be given. */
export const STROKE_WIDTH = { min: 1, max: 60 } as const;
/**
 * "sign" is a rectangle with a point on one side, like a road sign that
 * points the way (PowerPoint's "homePlate"). It points right, or left when
 * `flipH` is set.
 */
export const SHAPE_GEOMETRIES = ['rect', 'roundRect', 'ellipse', 'sign', 'line', 'arrow'] as const;
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
  /** For line and arrow: which diagonal of the box, and the arrow direction. For sign: the point is on the left. */
  flipH: z.boolean().optional(),
  flipV: z.boolean().optional(),
  /**
   * For line and arrow: the element each end is fastened to. A fastened end
   * lies on the edge of that element, on the side that faces the line's
   * other end, and follows it wherever it goes (`followFigures` in
   * src/shared/layout/groups.ts). The head of an arrow is at its end.
   */
  startAt: z.string().min(1).optional(),
  endAt: z.string().min(1).optional(),
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

export const FIGURE_TEMPLATES = ['process', 'layers', 'comparison'] as const;
export type FigureTemplate = (typeof FIGURE_TEMPLATES)[number];

/** One row of a figure's form: a step of a process, a layer, a column of a comparison. */
export const FigureItem = z.object({
  id: z.string().min(1),
  text: z.string(),
  /** For a comparison: the points under the heading, one on each line. */
  detail: z.string().optional(),
});
export type FigureItem = z.infer<typeof FigureItem>;

/**
 * A figure that draws itself from a form the lecturer fills in. The element
 * holds the form and the frame the figure fills; it shows nothing itself.
 * What is seen are ordinary shapes, each an element of its own that carries
 * `of`, grouped with this one. They are made, laid out and taken away as
 * the form says, so they cannot be moved by hand until the figure is made
 * into a free one: then this element goes, and the shapes stay as a group.
 */
export const FigureElement = z.object({
  ...elementBase,
  type: z.literal('figure'),
  template: z.enum(FIGURE_TEMPLATES),
  items: z.array(FigureItem),
  /** For a process: the steps run across the frame, or down it. Across when absent. */
  direction: z.enum(['across', 'down']).optional(),
  /** The colour of the parts. The template's own when absent. */
  color: PaletteColor.optional(),
  /** Stage pixels. The template's own size when absent. */
  fontSize: z.number().positive().optional(),
});
export type FigureElement = z.infer<typeof FigureElement>;

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
  MarkElement,
  LegendElement,
  FigureElement,
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

/**
 * Something the lecturer did on a slide while reading it in, other than
 * going on to the next step: a "Lær mer" box that was opened or closed, a
 * video that was started or stopped. `at` is seconds from the start of the
 * slide, like the time of a step. The video export and "Spill av" do the
 * same things at the same times.
 */
export const SceneEvent = z.discriminatedUnion('kind', [
  /** The "Lær mer" box of an element pops out. */
  z.object({
    id: z.string().min(1),
    at: z.number().min(0),
    kind: z.literal('more-open'),
    element: z.string(),
  }),
  /** The box that is open is put away. */
  z.object({ id: z.string().min(1), at: z.number().min(0), kind: z.literal('more-close') }),
  /**
   * A video file starts playing: a video element on the slide, or (with
   * `block`) a video inside the element's "Lær mer" box.
   */
  z.object({
    id: z.string().min(1),
    at: z.number().min(0),
    kind: z.literal('video-play'),
    element: z.string(),
    block: z.string().optional(),
    /** Where in the film it starts, in seconds. */
    from: z.number().min(0),
    /** The length of the film, so the clock knows when it has run out. */
    duration: z.number().positive(),
  }),
  z.object({
    id: z.string().min(1),
    at: z.number().min(0),
    kind: z.literal('video-pause'),
    element: z.string(),
    block: z.string().optional(),
  }),
  /**
   * The camera circle is moved: from this time it glides to a new place.
   * `x` and `y` are the centre of the circle, in stage pixels.
   */
  z.object({
    id: z.string().min(1),
    at: z.number().min(0),
    kind: z.literal('camera-move'),
    x: z.number(),
    y: z.number(),
  }),
]);
export type SceneEvent = z.infer<typeof SceneEvent>;

export const CAMERA_SIZES = ['small', 'medium', 'large'] as const;
export type CameraSize = (typeof CAMERA_SIZES)[number];

/**
 * Where the camera circle (the film of the lecturer's face) stands when the
 * slide begins. The film itself belongs to the recording, not to the slide.
 */
export const CameraPlace = z.object({
  /** The centre of the circle, in stage pixels. */
  x: z.number(),
  y: z.number(),
  size: z.enum(CAMERA_SIZES),
  /** The circle is not shown on this slide, though it was filmed. */
  hidden: z.boolean().optional(),
});
export type CameraPlace = z.infer<typeof CameraPlace>;

/**
 * A piece of sound on one of the lecture's own tracks (music, other sound).
 * Unlike a slide's voice it belongs to the whole lecture and may run on
 * over several slides. It is fastened to a slide and a time on it, so it
 * follows along when slides are moved or change length.
 */
export const TrackClip = z.object({
  id: z.string().min(1),
  /** A sound asset: mono WAV, 48 kHz, 16 bit. */
  asset: z.string(),
  /** The slide it starts on, and how many seconds into that slide. */
  scene: z.string(),
  offset: z.number().min(0),
  /** The part of the file that is played, in seconds from its start. */
  from: z.number().min(0),
  to: z.number().positive(),
  /** Loudness change in decibels. 0 when absent. */
  gain: z.number().min(GAIN_DB.min).max(GAIN_DB.max).optional(),
  /** Seconds over which it comes in from, and goes out to, silence. */
  fadeIn: z.number().min(0).max(30).optional(),
  fadeOut: z.number().min(0).max(30).optional(),
});
export type TrackClip = z.infer<typeof TrackClip>;

export const TRACK_NAMES = ['music', 'sound'] as const;
export type TrackName = (typeof TRACK_NAMES)[number];

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
  /**
   * The slide plays the brand's closing animation by itself when it is
   * shown: once, without controls and without sound. The film is the
   * owner's own file, kept in the program's settings like the logo and
   * never in a project; only its length, in seconds, is stored here.
   */
  closingAnimation: z.object({ seconds: z.number().positive().max(120) }).optional(),
  /** What was opened and played while the slide was read in, in order of time. */
  events: z.array(SceneEvent).optional(),
  /** Where the camera circle stands on this slide, when a recording of it has a film. */
  camera: CameraPlace.optional(),
  /**
   * A chapter begins on this slide, and this is its name. Chapters come from
   * the sections of a PowerPoint file and the bookmarks of a PDF, and the
   * owner can make, rename and remove them.
   */
  chapter: z.string().optional(),
  /**
   * The slide is another slide shown once more: while recording, the
   * lecturer went back to it. It stands in the list where that happened, so
   * video and "Spill av" show what the lecturer did, in that order. What it
   * shows (elements, steps, surface) is always that of the slide it repeats
   * (`followRepeats` in src/shared/layout/repeats.ts); its sound, the times
   * of its steps, its events, its manuscript and the place of the camera
   * circle are its own. `shown` holds the steps that were already on the
   * slide when the lecturer came back to it.
   */
  repeat: z.object({ of: z.string().min(1), shown: z.array(z.string()) }).optional(),
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
  /**
   * 'camera' is a film of the lecturer's face, taken while a slide was read
   * in: square, without sound, 30 pictures a second. It is shown only as the
   * camera circle, never as a video the owner can put on a slide.
   */
  kind: z.enum(['image', 'video', 'audio', 'camera']),
  /** Path relative to the project folder, always inside media/. */
  file: z.string().regex(/^media\/[A-Za-z0-9._-]+$/),
  mime: z.string(),
  bytes: z.number().int().min(0),
  /** Original file name, for the owner's reference. */
  name: z.string().optional(),
  credit: Credit.optional(),
  /**
   * On a recording: the film that was taken with it (a 'camera' asset), and
   * how many seconds into the recording the film's first picture belongs.
   * Every clip that points into the recording shows the same part of the film.
   */
  camera: z.object({ asset: z.string(), offset: z.number() }).optional(),
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
      /** Lower the music while someone speaks. On when absent. */
      duckMusic: z.boolean().optional(),
    })
    .optional(),
  /**
   * Sound that belongs to the whole lecture: music, which is lowered while
   * someone speaks, and other sound. The voice is not here; it belongs to
   * each slide.
   */
  tracks: z.object({ music: z.array(TrackClip), sound: z.array(TrackClip) }).optional(),
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
