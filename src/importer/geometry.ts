// Positions: from EMU on the slide, through any enclosing groups, to boxes
// on the 1920 x 1080 stage.
import { STAGE, type Box } from '../shared/format/schema';
import { boolAttr, child, children, intAttr, type XmlNode } from './xml';

/** An a:xfrm (or p:xfrm) in EMU, with the rotation in degrees. */
export interface Xfrm {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

/** A group: its own frame in the parent's coordinates and its child coordinate space. */
export interface GroupFrame {
  xfrm: Xfrm;
  childX: number;
  childY: number;
  childW: number;
  childH: number;
}

/** How slide EMU map to the stage: uniform scale, centred. */
export interface StageMap {
  scale: number;
  offsetX: number;
  offsetY: number;
  slideWidth: number;
  slideHeight: number;
}

export interface Placed {
  box: Box;
  flipH: boolean;
  flipV: boolean;
}

export function stageMapFor(slideWidth: number, slideHeight: number): StageMap {
  const scale = Math.min(STAGE.width / slideWidth, STAGE.height / slideHeight);
  return {
    scale,
    offsetX: (STAGE.width - slideWidth * scale) / 2,
    offsetY: (STAGE.height - slideHeight * scale) / 2,
    slideWidth,
    slideHeight,
  };
}

/** Reads an xfrm element. Returns undefined when it carries neither offset nor extent. */
export function readXfrm(node: XmlNode | undefined): Xfrm | undefined {
  const off = child(node, 'a:off');
  const ext = child(node, 'a:ext');
  if (!node || (!off && !ext)) return undefined;
  return {
    x: intAttr(off, 'x') ?? 0,
    y: intAttr(off, 'y') ?? 0,
    w: Math.max(0, intAttr(ext, 'cx') ?? 0),
    h: Math.max(0, intAttr(ext, 'cy') ?? 0),
    rotation: (intAttr(node, 'rot') ?? 0) / 60000,
    flipH: boolAttr(node, 'flipH'),
    flipV: boolAttr(node, 'flipV'),
  };
}

/** Reads the frame of a group from its p:grpSpPr. Undefined means "no transform". */
export function readGroupFrame(grpSpPr: XmlNode | undefined): GroupFrame | undefined {
  const node = child(grpSpPr, 'a:xfrm');
  const xfrm = readXfrm(node);
  if (!xfrm) return undefined;
  const chOff = child(node, 'a:chOff');
  const chExt = child(node, 'a:chExt');
  return {
    xfrm,
    childX: intAttr(chOff, 'x') ?? xfrm.x,
    childY: intAttr(chOff, 'y') ?? xfrm.y,
    childW: intAttr(chExt, 'cx') ?? xfrm.w,
    childH: intAttr(chExt, 'cy') ?? xfrm.h,
  };
}

function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

function normaliseDegrees(value: number): number {
  const wrapped = ((value % 360) + 360) % 360;
  return round2(wrapped) === 360 ? 0 : round2(wrapped);
}

/** True when a rotation leaves the shape lying on its side (nearer 90° than 0°/180°). */
function isSideways(rotation: number): boolean {
  const wrapped = ((rotation % 180) + 180) % 180;
  return wrapped >= 45 && wrapped < 135;
}

/**
 * Maps an element's xfrm through its enclosing groups (innermost first) to
 * the stage. Width and height are at least 1 so every box is valid.
 */
export function placeOnStage(xfrm: Xfrm, groups: readonly GroupFrame[], map: StageMap): Placed {
  let centreX = xfrm.x + xfrm.w / 2;
  let centreY = xfrm.y + xfrm.h / 2;
  let width = xfrm.w;
  let height = xfrm.h;
  let rotation = xfrm.rotation;
  let flipH = xfrm.flipH;
  let flipV = xfrm.flipV;

  for (const group of groups) {
    const scaleX = group.childW > 0 ? group.xfrm.w / group.childW : 1;
    const scaleY = group.childH > 0 ? group.xfrm.h / group.childH : 1;
    centreX = group.xfrm.x + (centreX - group.childX) * scaleX;
    centreY = group.xfrm.y + (centreY - group.childY) * scaleY;
    const sideways = isSideways(rotation);
    width *= sideways ? scaleY : scaleX;
    height *= sideways ? scaleX : scaleY;

    const groupCentreX = group.xfrm.x + group.xfrm.w / 2;
    const groupCentreY = group.xfrm.y + group.xfrm.h / 2;
    if (group.xfrm.flipH) {
      centreX = 2 * groupCentreX - centreX;
      flipH = !flipH;
      rotation = -rotation;
    }
    if (group.xfrm.flipV) {
      centreY = 2 * groupCentreY - centreY;
      flipV = !flipV;
      rotation = -rotation;
    }
    if (group.xfrm.rotation !== 0) {
      const angle = (group.xfrm.rotation * Math.PI) / 180;
      const dx = centreX - groupCentreX;
      const dy = centreY - groupCentreY;
      centreX = groupCentreX + dx * Math.cos(angle) - dy * Math.sin(angle);
      centreY = groupCentreY + dx * Math.sin(angle) + dy * Math.cos(angle);
      rotation += group.xfrm.rotation;
    }
  }

  const w = Math.max(1, width * map.scale);
  const h = Math.max(1, height * map.scale);
  const box: Box = {
    x: round2(map.offsetX + centreX * map.scale - w / 2),
    y: round2(map.offsetY + centreY * map.scale - h / 2),
    w: round2(w),
    h: round2(h),
    rotation: normaliseDegrees(rotation),
  };
  return { box, flipH, flipV };
}

/** The xfrm that covers the whole slide; used when a shape has no position anywhere. */
export function wholeSlide(map: StageMap): Xfrm {
  return {
    x: 0,
    y: 0,
    w: map.slideWidth,
    h: map.slideHeight,
    rotation: 0,
    flipH: false,
    flipV: false,
  };
}

/**
 * The box of the text area inside a shape: the box less its margins (in
 * stage pixels), measured in the shape's own rotated frame.
 */
export function insetBox(box: Box, l: number, t: number, r: number, b: number): Box {
  // Margins never take more than half the width or height, so a box that
  // is smaller than its margins still has room for its text.
  const kx = l + r > box.w / 2 ? box.w / 2 / (l + r) : 1;
  const ky = t + b > box.h / 2 ? box.h / 2 / (t + b) : 1;
  l *= kx;
  r *= kx;
  t *= ky;
  b *= ky;
  const w = Math.max(1, box.w - l - r);
  const h = Math.max(1, box.h - t - b);
  // Uneven margins move the centre, along the shape's own axes.
  const dx = (l - r) / 2;
  const dy = (t - b) / 2;
  const angle = (box.rotation * Math.PI) / 180;
  const cx = box.x + box.w / 2 + dx * Math.cos(angle) - dy * Math.sin(angle);
  const cy = box.y + box.h / 2 + dx * Math.sin(angle) + dy * Math.cos(angle);
  return {
    x: round2(cx - w / 2),
    y: round2(cy - h / 2),
    w: round2(w),
    h: round2(h),
    rotation: box.rotation,
  };
}

/** The same area turned a quarter (or three quarters) round its centre: width and height swap. */
export function turnBox(box: Box, degrees: 90 | 270): Box {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return {
    x: round2(cx - box.h / 2),
    y: round2(cy - box.w / 2),
    w: box.h,
    h: box.w,
    rotation: normaliseDegrees(box.rotation + degrees),
  };
}

/** A straight stroke from (x1, y1) to (x2, y2), in fractions (0..1) of a shape's box. */
export interface Stroke {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * The stroke of a freeform (a:custGeom) drawn as a line: a single open
 * path. A path with one straight segment is that line exactly. An open
 * path of several segments or curves, with no fill, becomes the straight
 * line from its first to its last point (`approximate` is then true).
 * Undefined for everything else, and for paths that end where they start.
 */
export function freeformStroke(
  custGeom: XmlNode | undefined,
  xfrm: Xfrm,
  filled: boolean,
): (Stroke & { approximate: boolean }) | undefined {
  const paths = children(child(custGeom, 'a:pathLst'), 'a:path');
  if (paths.length !== 1) return undefined;
  const path = paths[0]!;
  const [move, ...segments] = path.children;
  if (move?.name !== 'a:moveTo' || segments.length === 0) return undefined;
  if (!segments.every((s) => SEGMENTS.has(s.name))) return undefined;
  const exact = segments.length === 1 && segments[0]!.name === 'a:lnTo';
  if (!exact && filled) return undefined;
  const start = child(move, 'a:pt');
  const points = children(segments[segments.length - 1], 'a:pt');
  const end = points[points.length - 1];
  // Path coordinates are in the path's own size, or in EMU of the shape when it has none.
  const width = intAttr(path, 'w') || xfrm.w;
  const height = intAttr(path, 'h') || xfrm.h;
  if (!start || !end || width <= 0 || height <= 0) return undefined;
  const fraction = (node: XmlNode, name: string, size: number): number =>
    Math.min(1, Math.max(0, (intAttr(node, name) ?? 0) / size));
  const stroke = {
    x1: fraction(start, 'x', width),
    y1: fraction(start, 'y', height),
    x2: fraction(end, 'x', width),
    y2: fraction(end, 'y', height),
    approximate: !exact,
  };
  // A curve that comes back near its start has no line to stand for it.
  if (Math.hypot(stroke.x2 - stroke.x1, stroke.y2 - stroke.y1) < 0.1) return undefined;
  return stroke;
}

/** Path segments a line can stand for: straight segments and curves, not arcs or a close. */
const SEGMENTS = new Set(['a:lnTo', 'a:cubicBezTo', 'a:quadBezTo']);

/** The xfrm of the part of a shape's box that a stroke spans, turned and flipped like the shape. */
export function strokeXfrm(xfrm: Xfrm, stroke: Stroke): Xfrm {
  const left = Math.min(stroke.x1, stroke.x2);
  const top = Math.min(stroke.y1, stroke.y2);
  const w = Math.abs(stroke.x2 - stroke.x1) * xfrm.w;
  const h = Math.abs(stroke.y2 - stroke.y1) * xfrm.h;
  // Offset of the stroke's centre from the box centre, in the shape's own frame.
  let ox = (left + Math.abs(stroke.x2 - stroke.x1) / 2 - 0.5) * xfrm.w;
  let oy = (top + Math.abs(stroke.y2 - stroke.y1) / 2 - 0.5) * xfrm.h;
  if (xfrm.flipH) ox = -ox;
  if (xfrm.flipV) oy = -oy;
  const angle = (xfrm.rotation * Math.PI) / 180;
  const cx = xfrm.x + xfrm.w / 2 + ox * Math.cos(angle) - oy * Math.sin(angle);
  const cy = xfrm.y + xfrm.h / 2 + ox * Math.sin(angle) + oy * Math.cos(angle);
  return { ...xfrm, x: cx - w / 2, y: cy - h / 2, w, h };
}
