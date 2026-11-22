// The theme: everything about how content looks. Content never stores
// fonts, sizes or surface colours; it asks the theme.
import { STAGE } from '../format/constants';
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
}

// The title font is never bold (brand manual): weight comes from size.
export const THEME_REN: Theme = {
  id: 'ren',
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
};

export function getTheme(_project: Pick<Project, 'theme'>): Theme {
  return THEME_REN;
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
  const width = (STAGE.width - 2 * marginX - (columns - 1) * gutter) / columns;
  const starts: number[] = [];
  const ends: number[] = [];
  for (let i = 0; i < columns; i++) {
    const start = marginX + i * (width + gutter);
    starts.push(start);
    ends.push(start + width);
  }
  return { starts, ends };
}

/** Where the pair of brand shapes sits on title and section scenes. */
// The left edge is the start of the sixth column, so text in the five left
// columns never touches the shapes.
export const DECORATION_BOX = { x: 1185, y: 185, w: 680, h: 680 } as const;

/** True when a box and the decoration area overlap. */
export function overlapsDecoration(box: { x: number; y: number; w: number; h: number }): boolean {
  const d = DECORATION_BOX;
  return box.x < d.x + d.w && box.x + box.w > d.x && box.y < d.y + d.h && box.y + box.h > d.y;
}

export function logoVariant(surface: Surface): 'light' | 'dark' {
  return isDarkSurface(surface) ? 'dark' : 'light';
}
