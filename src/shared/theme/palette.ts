// USN's colour palette, from the brand manual (https://brandpad.io/usn/).
// These values are fixed; never add colours that are not in the manual.
import type { PaletteColor, Surface } from '../format/schema';

export const PALETTE: Record<PaletteColor, string> = {
  lilla: '#7800f0',
  mediumLilla: '#9359ef',
  lysLilla: '#cdb9fc',
  indigo: '#2f0b63',
  mediumIndigo: '#9595f9',
  lysIndigo: '#dad9ff',
  oransje: '#ff6202',
  beige: '#ffd9b1',
  mediumBeige: '#ffebd3',
  lysBeige: '#fff5ee',
  rosa: '#ef7dbb',
  mediumRosa: '#ffcced',
  syregronn: '#cfff1f',
  mediumSyregronn: '#e4ff7d',
  sort: '#000000',
  hvit: '#ffffff',
};

/** Names shown in the user interface (Norwegian bokmål). */
export const COLOR_NAMES: Record<PaletteColor, string> = {
  lilla: 'Lilla',
  mediumLilla: 'Medium lilla',
  lysLilla: 'Lys lilla',
  indigo: 'Indigo',
  mediumIndigo: 'Medium indigo',
  lysIndigo: 'Lys indigo',
  oransje: 'Oransje',
  beige: 'Beige',
  mediumBeige: 'Medium beige',
  lysBeige: 'Lys beige',
  rosa: 'Rosa',
  mediumRosa: 'Medium rosa',
  syregronn: 'Syregrønn',
  mediumSyregronn: 'Medium syregrønn',
  sort: 'Sort',
  hvit: 'Hvit',
};

/** The manual's colour order for infographics and chart series. */
export const SERIES_ORDER: PaletteColor[] = [
  'lilla',
  'oransje',
  'indigo',
  'rosa',
  'mediumLilla',
  'syregronn',
  'mediumIndigo',
  'beige',
  'sort',
  'lysLilla',
];

/** Surfaces on which the white version of the logo is used. */
export const DARK_SURFACES: Surface[] = ['lilla', 'indigo'];

export function isDarkSurface(surface: Surface): boolean {
  return DARK_SURFACES.includes(surface);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * The palette colour closest to an arbitrary colour. Used on import so that
 * shapes that had different colours in the PPTX still differ in the theme.
 * Distance is a weighted RGB distance ("redmean"), which is good enough for
 * picking among sixteen well separated colours.
 */
export function nearestPaletteColor(hex: string): PaletteColor {
  const [r1, g1, b1] = hexToRgb(hex);
  let best: PaletteColor = 'lilla';
  let bestDistance = Infinity;
  for (const name of Object.keys(PALETTE) as PaletteColor[]) {
    const [r2, g2, b2] = hexToRgb(PALETTE[name]);
    const mean = (r1 + r2) / 2;
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    const d = (2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db;
    if (d < bestDistance) {
      bestDistance = d;
      best = name;
    }
  }
  return best;
}
