// Fill and line colours of shapes, resolved to plain hex values. Colour
// modifiers (lumMod, tint, alpha ...) are ignored on purpose: the result is
// only used to pick the nearest colour in the theme's palette.
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

/** The colour given by the colour child of an element (a:solidFill, a:gs, a:fillRef ...). */
export function colorOf(parent: XmlNode | undefined, context: ColorContext): string | undefined {
  for (const node of parent?.children ?? []) {
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
        break;
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
