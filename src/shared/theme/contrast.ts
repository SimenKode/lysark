// The brand manual's contrast table: which text colours are allowed on
// which background. Entries with large=true are only allowed in large text.
import type { PaletteColor } from '../format/schema';

interface Allowed {
  color: PaletteColor;
  /** Only allowed for large text (over 18 pt, or 14 pt bold). */
  large?: true;
}

const onLightWarm: Allowed[] = [
  { color: 'sort' },
  { color: 'lilla' },
  { color: 'mediumLilla', large: true },
  { color: 'indigo' },
];

export const CONTRAST_TABLE: Record<PaletteColor, Allowed[]> = {
  hvit: [
    { color: 'sort' },
    { color: 'lilla' },
    { color: 'mediumLilla', large: true },
    { color: 'oransje', large: true },
    { color: 'indigo' },
  ],
  lilla: [
    { color: 'hvit' },
    { color: 'lysLilla', large: true },
    { color: 'lysIndigo' },
    { color: 'beige' },
    { color: 'mediumBeige' },
    { color: 'lysBeige' },
    { color: 'mediumRosa' },
    { color: 'syregronn' },
    { color: 'mediumSyregronn' },
  ],
  mediumLilla: [
    { color: 'sort' },
    { color: 'hvit', large: true },
    { color: 'beige', large: true },
    { color: 'mediumBeige', large: true },
    { color: 'lysBeige', large: true },
    { color: 'indigo', large: true },
    { color: 'lysIndigo', large: true },
    { color: 'mediumRosa', large: true },
    { color: 'syregronn', large: true },
    { color: 'mediumSyregronn', large: true },
  ],
  lysLilla: [{ color: 'sort' }, { color: 'lilla', large: true }, { color: 'indigo' }],
  oransje: [{ color: 'sort' }, { color: 'hvit', large: true }, { color: 'indigo' }],
  beige: onLightWarm,
  mediumBeige: onLightWarm,
  lysBeige: onLightWarm,
  indigo: [
    { color: 'hvit' },
    { color: 'mediumLilla', large: true },
    { color: 'lysLilla' },
    { color: 'oransje' },
    { color: 'beige' },
    { color: 'mediumBeige' },
    { color: 'lysBeige' },
    { color: 'mediumIndigo' },
    { color: 'lysIndigo' },
    { color: 'rosa' },
    { color: 'mediumRosa' },
    { color: 'syregronn' },
    { color: 'mediumSyregronn' },
  ],
  mediumIndigo: [{ color: 'sort' }, { color: 'indigo' }],
  lysIndigo: [{ color: 'sort' }, { color: 'lilla' }, { color: 'indigo' }],
  rosa: [{ color: 'sort' }, { color: 'indigo' }],
  mediumRosa: onLightWarm,
  syregronn: onLightWarm,
  mediumSyregronn: onLightWarm,
  // The manual has no row for black. White is the one safe choice.
  sort: [{ color: 'hvit' }],
};

/**
 * The manual counts text as large above 18 pt, or from 14 pt when bold.
 * The stage is 1920 units wide for a 13.33 inch slide, so 1 pt is 2 units.
 */
export function isLargeText(fontSize: number, bold: boolean): boolean {
  return fontSize > 36 || (bold && fontSize >= 28);
}

export function allowedTextColors(background: PaletteColor, large: boolean): PaletteColor[] {
  return CONTRAST_TABLE[background].filter((a) => large || !a.large).map((a) => a.color);
}

export function isAllowedTextColor(
  color: PaletteColor,
  background: PaletteColor,
  large: boolean,
): boolean {
  return allowedTextColors(background, large).includes(color);
}

/** The first colour in the manual's row is its strongest contrast. */
export function strongestTextColor(background: PaletteColor): PaletteColor {
  return CONTRAST_TABLE[background][0]!.color;
}
