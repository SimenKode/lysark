// The theme: everything about how content looks. Content never stores
// fonts, sizes or surface colours; it asks the theme.
import { orientationOf, stageFor, type Orientation, type Stage } from '../format/constants';
import {
  type PaletteColor,
  type Project,
  type Scene,
  type SceneKind,
  type Surface,
  type TextRole,
} from '../format/schema';
import { allowedTextColors, isLargeText } from './contrast';
import { isDarkSurface } from './palette';

export interface RoleStyle {
  font: 'title' | 'body';
  /** Stage pixels. */
  size: number;
  weight: 400 | 700;
  lineHeight: number;
}

export interface Theme {
  id: 'ren';
  /** The shape this theme is laid out for. */
  orientation: Orientation;
  /** The stage of that shape, in stage pixels. */
  stage: Stage;
  fonts: { title: string; body: string };
  /** The brand's 8 column grid. */
  grid: {
    columns: number;
    marginX: number;
    marginTop: number;
    /** Leaves room for the logo below the content. */
    marginBottom: number;
    gutter: number;
  };
  roles: Record<TextRole, RoleStyle>;
  /** The title role is larger on title, section and closing scenes. */
  titleSceneScale: number;
  /** Font size factor per list level. */
  levelScale: number[];
  surfaces: Record<SceneKind, Surface>;
  logo: { height: number; marginX: number; marginBottom: number };
  shape: { strokeWidth: number; cornerRadius: number };
  /** Where the pair of brand shapes sits on title and section scenes. */
  decoration: { x: number; y: number; w: number; h: number };
  /**
   * How many columns things take from the left margin: the title and
   * subtitle of a title or section scene, a new text box, a new table.
   */
  span: { front: number; text: number; table: number };
  /** Where the title and subtitle of a title or section scene stand (y and height). */
  front: { title: { y: number; h: number }; subtitle: { y: number; h: number } };
}

// The title font is never bold (brand manual): weight comes from size.
export const THEME_REN: Theme = {
  id: 'ren',
  orientation: 'landscape',
  stage: stageFor('landscape'),
  fonts: {
    title: "'Liberation Serif', 'Times New Roman', Times, serif",
    body: "'Liberation Sans', Arial, Helvetica, sans-serif",
  },
  grid: { columns: 8, marginX: 120, marginTop: 96, marginBottom: 150, gutter: 24 },
  roles: {
    title: { font: 'title', size: 80, weight: 400, lineHeight: 1.1 },
    subtitle: { font: 'body', size: 44, weight: 400, lineHeight: 1.25 },
    heading: { font: 'body', size: 40, weight: 700, lineHeight: 1.25 },
    body: { font: 'body', size: 36, weight: 400, lineHeight: 1.35 },
    caption: { font: 'body', size: 24, weight: 400, lineHeight: 1.35 },
    number: { font: 'title', size: 160, weight: 400, lineHeight: 1 },
  },
  titleSceneScale: 1.5,
  levelScale: [1, 0.9, 0.82, 0.76, 0.72],
  surfaces: { title: 'lilla', section: 'lilla', content: 'lysBeige', closing: 'lilla' },
  logo: { height: 56, marginX: 120, marginBottom: 44 },
  shape: { strokeWidth: 6, cornerRadius: 28 },
  // The left edge is the start of the sixth column, so text in the five left
  // columns never touches the shapes.
  decoration: { x: 1185, y: 185, w: 680, h: 680 },
  span: { front: 5, text: 5, table: 6 },
  front: { title: { y: 220, h: 360 }, subtitle: { y: 620, h: 220 } },
};

/**
 * The same theme laid out for an upright slide (1080 x 1920): the same
 * colours, typefaces, sizes, shapes and margins. The width holds four
 * columns instead of eight. On title and section slides the brand shapes
 * stand in the lower half, at the right margin, above the logo, so the
 * title has the upper half to itself.
 */
export const THEME_REN_UPRIGHT: Theme = {
  ...THEME_REN,
  orientation: 'portrait',
  stage: stageFor('portrait'),
  grid: { ...THEME_REN.grid, columns: 4 },
  decoration: { x: 280, y: 1010, w: 680, h: 680 },
  span: { front: 4, text: 4, table: 4 },
  front: { title: { y: 300, h: 460 }, subtitle: { y: 800, h: 180 } },
};

/** The theme of a project, laid out for the shape of its slides. */
export function getTheme(project: Pick<Project, 'theme' | 'orientation'>): Theme {
  return orientationOf(project) === 'portrait' ? THEME_REN_UPRIGHT : THEME_REN;
}

export function sceneSurface(theme: Theme, scene: Pick<Scene, 'kind' | 'background'>): Surface {
  return scene.background ?? theme.surfaces[scene.kind];
}

/** Font size a text role gets in a given kind of scene, before overrides. */
export function roleFontSize(theme: Theme, role: TextRole, kind: SceneKind): number {
  const base = theme.roles[role].size;
  return role === 'title' && kind !== 'content' ? Math.round(base * theme.titleSceneScale) : base;
}

const TITLE_PREFERENCE: PaletteColor[] = ['lilla', 'hvit', 'indigo', 'sort'];
const BODY_PREFERENCE: PaletteColor[] = ['sort', 'hvit', 'indigo'];

/**
 * Default text colour for a role on a background, always one the brand's
 * contrast table allows for that size.
 */
export function defaultTextColor(
  theme: Theme,
  background: PaletteColor,
  role: TextRole,
  fontSize: number,
): PaletteColor {
  const large = isLargeText(fontSize, theme.roles[role].weight === 700);
  const allowed = allowedTextColors(background, large);
  const preference = role === 'title' || role === 'number' ? TITLE_PREFERENCE : BODY_PREFERENCE;
  return preference.find((c) => allowed.includes(c)) ?? allowed[0]!;
}

/** Colours of the brand's text marking on a surface: field and text. */
export function markColors(surface: PaletteColor): { field: PaletteColor; text: PaletteColor } {
  return surface === 'lilla' || surface === 'indigo' || surface === 'sort'
    ? { field: 'syregronn', text: 'indigo' }
    : { field: 'mediumSyregronn', text: 'sort' };
}

/** Left and right edge of each of the grid's columns, in stage pixels. */
export function columnEdges(theme: Theme): { starts: number[]; ends: number[] } {
  const { columns, marginX, gutter } = theme.grid;
  const width = (theme.stage.width - 2 * marginX - (columns - 1) * gutter) / columns;
  const starts: number[] = [];
  const ends: number[] = [];
  for (let i = 0; i < columns; i++) {
    const start = marginX + i * (width + gutter);
    starts.push(start);
    ends.push(start + width);
  }
  return { starts, ends };
}

/** The width between the left and right margins, in stage pixels. */
export function roomWidth(theme: Theme): number {
  return theme.stage.width - 2 * theme.grid.marginX;
}

/** The right edge of the first `count` columns. */
export function spanEnd(theme: Theme, count: number): number {
  const { ends } = columnEdges(theme);
  return ends[Math.min(count, ends.length) - 1]!;
}

/** Where the brand shapes sit on a lying slide. Code that works on a project uses its theme's `decoration`. */
export const DECORATION_BOX = THEME_REN.decoration;

/** True when a box and the decoration area overlap. */
export function overlapsDecoration(
  box: { x: number; y: number; w: number; h: number },
  /** The theme of the project (lying when not given). */
  theme: Theme = THEME_REN,
): boolean {
  const d = theme.decoration;
  return box.x < d.x + d.w && box.x + box.w > d.x && box.y < d.y + d.h && box.y + box.h > d.y;
}

/**
 * Width of USN's primary logo per unit of height, in Norwegian and in
 * English (from the viewBox of the files in the logo package).
 */
export const LOGO_ASPECT: Record<Project['meta']['language'], number> = {
  nb: 828.91 / 191,
  en: 1093.89 / 191,
};

/**
 * The area the logo takes on a scene, with the clear space the brand
 * manual asks for around it (half the height of the N in the symbol).
 */
export function logoArea(
  theme: Theme,
  language: Project['meta']['language'],
): { x: number; y: number; w: number; h: number } {
  const { height, marginX, marginBottom } = theme.logo;
  const clear = height / 2;
  return {
    x: marginX - clear,
    y: theme.stage.height - marginBottom - height - clear,
    w: height * LOGO_ASPECT[language] + 2 * clear,
    h: height + 2 * clear,
  };
}

export function logoVariant(surface: Surface): 'light' | 'dark' {
  return isDarkSurface(surface) ? 'dark' : 'light';
}
