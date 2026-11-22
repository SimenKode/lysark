// Fill and line colours of shapes, resolved to plain hex values. The
// modifiers that change how light a colour is (lumMod, lumOff, tint, shade)
// are applied, because they can turn a dark theme colour into a pale one.
// The rest (alpha, saturation, hue ...) are left out: the result is only
// used to pick the nearest colour in the theme's palette.
import { attr, child, descend, intAttr, type XmlNode } from './xml';

export interface ColorContext {
  /** The master's p:clrMap (or an override): bg1 -> lt1, tx1 -> dk1, ... */
  map: Record<string, string>;
  /** The theme's a:clrScheme: dk1, lt1, accent1 ... -> "RRGGBB". */
  scheme: Record<string, string>;
}

export type Paint =
  { kind: 'none' } | { kind: 'color'; hex: string } | { kind: 'picture'; blipFill: XmlNode };

const NO_PAINT: Paint = { kind: 'none' };

// A few of the preset colour names; the rest are rare in real files.
const PRESET_COLORS: Record<string, string> = {
  black: '000000',
  white: 'FFFFFF',
  red: 'FF0000',
  green: '008000',
  blue: '0000FF',
  yellow: 'FFFF00',
  cyan: '00FFFF',
  aqua: '00FFFF',
  magenta: 'FF00FF',
  fuchsia: 'FF00FF',
  gray: '808080',
  grey: '808080',
  silver: 'C0C0C0',
  maroon: '800000',
  navy: '000080',
  olive: '808000',
  purple: '800080',
  teal: '008080',
  lime: '00FF00',
  orange: 'FFA500',
  pink: 'FFC0CB',
  brown: 'A52A2A',
  gold: 'FFD700',
  ltGray: 'D3D3D3',
  lightGray: 'D3D3D3',
  dkGray: 'A9A9A9',
  darkGray: 'A9A9A9',
  dkBlue: '00008B',
  darkBlue: '00008B',
  dkRed: '8B0000',
  darkRed: '8B0000',
  dkGreen: '006400',
  darkGreen: '006400',
};

const SYSTEM_COLORS: Record<string, string> = { windowText: '000000', window: 'FFFFFF' };

function validHex(value: string | undefined): string | undefined {
  return value && /^[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : undefined;
}

/** Reads the colour scheme of a theme part (root a:theme). */
export function readColorScheme(theme: XmlNode | undefined): Record<string, string> {
  const scheme: Record<string, string> = {};
  for (const entry of descend(theme, 'a:themeElements', 'a:clrScheme')?.children ?? []) {
    const name = entry.name.startsWith('a:') ? entry.name.slice(2) : entry.name;
    const hex =
      validHex(attr(child(entry, 'a:srgbClr'), 'val')) ??
      validHex(attr(child(entry, 'a:sysClr'), 'lastClr')) ??
      SYSTEM_COLORS[attr(child(entry, 'a:sysClr'), 'val') ?? ''];
    if (hex) scheme[name] = hex;
  }
  return scheme;
}

function baseColorOf(node: XmlNode, context: ColorContext): string | undefined {
  switch (node.name) {
    case 'a:srgbClr':
      return validHex(attr(node, 'val'));
    case 'a:schemeClr': {
      const name = attr(node, 'val') ?? '';
      return context.scheme[context.map[name] ?? name];
    }
    case 'a:sysClr':
      return validHex(attr(node, 'lastClr')) ?? SYSTEM_COLORS[attr(node, 'val') ?? ''];
    case 'a:prstClr':
      return PRESET_COLORS[attr(node, 'val') ?? ''];
    default:
      return undefined;
  }
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / d + 2) / 6
        : ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function fromHsl(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number): number => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

function toHex(rgb: [number, number, number]): string {
  return rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase();
}

/** Applies lumMod, lumOff, tint and shade, in the order they are written. */
function applyLightness(hex: string, node: XmlNode): string {
  let result = hex;
  for (const modifier of node.children) {
    const value = (intAttr(modifier, 'val') ?? 100000) / 100000;
    const rgb = [0, 2, 4].map((i) => Number.parseInt(result.slice(i, i + 2), 16) / 255) as [
      number,
      number,
      number,
    ];
    switch (modifier.name) {
      case 'a:lumMod': {
        const [h, s, l] = toHsl(result);
        result = toHex(fromHsl(h, s, l * value));
        break;
      }
      case 'a:lumOff': {
        const [h, s, l] = toHsl(result);
        result = toHex(fromHsl(h, s, l + value));
        break;
      }
      case 'a:tint':
        // Towards white: val is how much of the colour is left.
        result = toHex(rgb.map((v) => v * value + (1 - value)) as [number, number, number]);
        break;
      case 'a:shade':
        // Towards black.
        result = toHex(rgb.map((v) => v * value) as [number, number, number]);
        break;
      default:
        break;
    }
  }
  return result;
}

/** The colour given by the colour child of an element (a:solidFill, a:gs, a:fillRef ...). */
export function colorOf(parent: XmlNode | undefined, context: ColorContext): string | undefined {
  for (const node of parent?.children ?? []) {
    const hex = baseColorOf(node, context);
    if (hex) return applyLightness(hex, node);
    if (
      node.name === 'a:srgbClr' ||
      node.name === 'a:schemeClr' ||
      node.name === 'a:sysClr' ||
      node.name === 'a:prstClr'
    ) {
      return undefined;
    }
  }
  return undefined;
}

function paintOf(hex: string | undefined): Paint {
  // A colour that cannot be resolved counts as no paint, so nothing is made up.
  return hex ? { kind: 'color', hex } : NO_PAINT;
}

/**
 * The fill written directly in a properties element (p:spPr, p:grpSpPr or
 * a:ln). Undefined when the element says nothing about fill.
 */
export function readFill(
  props: XmlNode | undefined,
  context: ColorContext,
  groupFill?: Paint,
): Paint | undefined {
  for (const node of props?.children ?? []) {
    switch (node.name) {
      case 'a:noFill':
        return NO_PAINT;
      case 'a:solidFill':
        return paintOf(colorOf(node, context));
      case 'a:gradFill':
        return paintOf(colorOf(descend(node, 'a:gsLst', 'a:gs'), context));
      case 'a:pattFill':
        return paintOf(colorOf(child(node, 'a:fgClr'), context));
      case 'a:blipFill':
        return { kind: 'picture', blipFill: node };
      case 'a:grpFill':
        return groupFill ?? NO_PAINT;
      default:
        break;
    }
  }
  return undefined;
}

/** A p:style reference (a:fillRef or a:lnRef) counts when idx > 0 and it names a colour. */
function styleReference(reference: XmlNode | undefined, context: ColorContext): Paint {
  if (!reference || (intAttr(reference, 'idx') ?? 0) <= 0) return NO_PAINT;
  return paintOf(colorOf(reference, context));
}

export function shapeFill(
  spPr: XmlNode | undefined,
  style: XmlNode | undefined,
  context: ColorContext,
  groupFill?: Paint,
): Paint {
  return readFill(spPr, context, groupFill) ?? styleReference(child(style, 'a:fillRef'), context);
}

export function shapeLine(
  spPr: XmlNode | undefined,
  style: XmlNode | undefined,
  context: ColorContext,
): Paint {
  const explicit = readFill(child(spPr, 'a:ln'), context);
  if (explicit) return explicit.kind === 'picture' ? NO_PAINT : explicit;
  return styleReference(child(style, 'a:lnRef'), context);
}

function hasArrowHead(end: XmlNode | undefined): boolean {
  const type = attr(end, 'type');
  return type !== undefined && type !== 'none';
}

/** Arrow heads of a line: at its start (a:headEnd) and at its end (a:tailEnd). */
export function arrowEnds(spPr: XmlNode | undefined): { start: boolean; end: boolean } {
  const ln = child(spPr, 'a:ln');
  return {
    start: hasArrowHead(child(ln, 'a:headEnd')),
    end: hasArrowHead(child(ln, 'a:tailEnd')),
  };
}
