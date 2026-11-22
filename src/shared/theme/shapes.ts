// The brand's graphic shapes ("profilformene"). Rules from the manual:
// drawn on an 8 x 8 grid, at most six points, no sharp inward angles, not
// built from straight lines only (except squares and rectangles), always
// two shapes that overlap, never more than two on one surface.
import type { PaletteColor, Surface } from '../format/schema';

type Point = [number, number];

export interface ShapeDef {
  /** Corner points in grid units, 0..8 on both axes, clockwise. */
  points: Point[];
  /** Soft shapes get rounded corners; hard ones must be rectangles. */
  soft: boolean;
}

export interface ShapePair {
  a: ShapeDef;
  b: ShapeDef;
}

export const GRID_UNITS = 8;

// Every shape is convex (no inward angles) and has four to six points.
export const SHAPE_PAIRS: ShapePair[] = [
  {
    a: {
      points: [
        [0, 1],
        [4, 1],
        [4, 5],
        [0, 5],
      ],
      soft: false,
    },
    b: {
      points: [
        [2, 3],
        [6, 2],
        [8, 4],
        [7, 7],
        [4, 8],
        [2, 6],
      ],
      soft: true,
    },
  },
  {
    a: {
      points: [
        [1, 2],
        [5, 0],
        [8, 3],
        [6, 6],
        [2, 6],
      ],
      soft: true,
    },
    b: {
      points: [
        [3, 4],
        [7, 4],
        [7, 8],
        [3, 8],
      ],
      soft: false,
    },
  },
  {
    a: {
      points: [
        [0, 3],
        [3, 0],
        [6, 1],
        [7, 4],
        [5, 7],
        [1, 6],
      ],
      soft: true,
    },
    b: {
      points: [
        [4, 3],
        [8, 4],
        [7, 8],
        [3, 7],
      ],
      soft: true,
    },
  },
];

/** SVG path for a shape, scaled so one grid unit is `cell` pixels. */
export function shapePath(def: ShapeDef, cell: number): string {
  const pts = def.points.map(([x, y]) => [x * cell, y * cell] as Point);
  if (!def.soft) {
    return `M${pts.map((p) => `${round(p[0])} ${round(p[1])}`).join('L')}Z`;
  }
  const radius = cell * 0.7;
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n]!;
    const cur = pts[i]!;
    const next = pts[(i + 1) % n]!;
    const inPoint = towards(cur, prev, radius);
    const outPoint = towards(cur, next, radius);
    d += `${i === 0 ? 'M' : 'L'}${round(inPoint[0])} ${round(inPoint[1])}`;
    d += `Q${round(cur[0])} ${round(cur[1])} ${round(outPoint[0])} ${round(outPoint[1])}`;
  }
  return `${d}Z`;
}

function towards(from: Point, to: Point, distance: number): Point {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy);
  // Never round past the middle of an edge.
  const t = Math.min(distance, length / 2) / length;
  return [from[0] + dx * t, from[1] + dy * t];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Colours for the two shapes and for the area where they overlap
 * ("1 + 1 = 3"). Strong colours are fine here: the shapes are elements on
 * the surface, not the surface itself.
 */
export function decorationColors(surface: Surface): {
  a: PaletteColor;
  b: PaletteColor;
  overlap: PaletteColor;
} {
  switch (surface) {
    case 'lilla':
      return { a: 'indigo', b: 'oransje', overlap: 'rosa' };
    case 'indigo':
      return { a: 'lilla', b: 'oransje', overlap: 'mediumRosa' };
    case 'mediumLilla':
    case 'mediumIndigo':
      return { a: 'indigo', b: 'lysBeige', overlap: 'oransje' };
    default:
      return { a: 'oransje', b: 'lilla', overlap: 'indigo' };
  }
}
