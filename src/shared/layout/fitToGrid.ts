// "Tilpass til rutenett": tidies a scene into the brand's 8 column grid.
// Text is left aligned and takes the theme's size; boxes snap to columns
// and stay inside the margins.
import { STAGE } from '../format/constants';
import type { Element, Scene } from '../format/schema';
import { columnEdges, overlapsDecoration, roleFontSize, type Theme } from '../theme/theme';

function nearest(values: number[], target: number): number {
  let best = values[0]!;
  for (const v of values) if (Math.abs(v - target) < Math.abs(best - target)) best = v;
  return best;
}

/** Mutates the scene (call inside an immer recipe). */
export function fitToGrid(scene: Scene, theme: Theme): void {
  const { starts, ends } = columnEdges(theme);
  const left = starts[0]!;
  const right = ends[ends.length - 1]!;
  const top = theme.grid.marginTop;
  const bottom = STAGE.height - theme.grid.marginBottom;
  const isFront = scene.kind !== 'content';

  const title = scene.elements.find((e) => e.type === 'text' && e.role === 'title');
  const subtitle = scene.elements.find((e) => e.type === 'text' && e.role === 'subtitle');
  let contentTop = top;

  if (title && title.type === 'text') {
    const size = roleFontSize(theme, 'title', scene.kind);
    delete title.fontSize;
    delete title.levelScale;
    delete title.lineHeight;
    delete title.spaceBefore;
    delete title.indent;
    title.align = 'left';
    title.box.rotation = 0;
    if (isFront) {
      // Title and subtitle take the five left columns; the shapes get the rest.
      title.valign = 'bottom';
      title.box = { x: left, y: 220, w: ends[4]! - left, h: 360, rotation: 0 };
    } else {
      title.valign = 'top';
      const lines = Math.max(1, Math.round(title.box.h / (size * theme.roles.title.lineHeight)));
      const height = Math.min(3, lines) * size * theme.roles.title.lineHeight;
      title.box = { x: left, y: top, w: right - left, h: Math.round(height), rotation: 0 };
      contentTop = title.box.y + title.box.h + 36;
    }
  }
  if (isFront && subtitle && subtitle.type === 'text') {
    delete subtitle.fontSize;
    delete subtitle.levelScale;
    delete subtitle.lineHeight;
    delete subtitle.spaceBefore;
    delete subtitle.indent;
    subtitle.align = 'left';
    subtitle.valign = 'top';
    subtitle.box = { x: left, y: 620, w: ends[4]! - left, h: 220, rotation: 0 };
  }

  for (const el of scene.elements) {
    if (el === title || (isFront && el === subtitle)) continue;
    if (el.type === 'shape' && (el.geometry === 'line' || el.geometry === 'arrow')) continue;
    // Marks and legends are placed in relation to their picture, and follow it.
    if (el.type === 'mark' || el.type === 'legend') continue;
    snapElement(el, starts, ends, contentTop, bottom);
    if (el.type === 'text') {
      delete el.fontSize;
      delete el.levelScale;
      delete el.lineHeight;
      delete el.spaceBefore;
      delete el.indent;
      el.align = 'left';
    }
  }

  if (isFront) {
    scene.decoration = !scene.elements.some((e) => overlapsDecoration(e.box));
  }
}

function snapElement(
  el: Element,
  starts: number[],
  ends: number[],
  top: number,
  bottom: number,
): void {
  const box = el.box;
  const ratio = box.w / box.h;
  const keepRatio = el.type === 'image' || el.type === 'video';
  const columnWidth = ends[0]! - starts[0]!;

  let x = nearest(starts, box.x);
  let x2 = nearest(ends, box.x + box.w);
  if (x2 - x < columnWidth) x2 = ends.find((e) => e > x) ?? ends[ends.length - 1]!;
  let w = x2 - x;
  let h = keepRatio ? w / ratio : box.h;

  let y = Math.max(top, box.y);
  if (h > bottom - top) {
    h = bottom - top;
    if (keepRatio) w = h * ratio;
  }
  if (y + h > bottom) y = bottom - h;
  if (x + w > ends[ends.length - 1]!) x = ends[ends.length - 1]! - w;

  el.box = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), rotation: 0 };
}
