// Positions: from EMU on the slide, through any enclosing groups, to boxes
// on the 1920 x 1080 stage.
import { STAGE, type Box } from '../shared/format/schema';
import { boolAttr, child, intAttr, type XmlNode } from './xml';

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
