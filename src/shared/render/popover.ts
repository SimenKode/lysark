// The "Lær mer" box drawn on the slide itself: for the video export, where
// the box pops out at the moment the lecturer opened it, and for the
// recording window, where the lecturer opens it. The HTML player has its
// own box (the student's window can have any size); this one is drawn as
// the student sees it in a window of 1280 x 720 (720 x 1280 for an upright
// slide), like the builder's preview.
import { stageFor, type Stage } from '../format/constants';
import type { Element as SceneElement } from '../format/schema';
import type { View } from '../layout/steps';
import { fitDrawings, placePopover, popoverWidth, popoverWish, renderMore } from './more';
import { moreCorner, moreOf, moreTitle, type RenderContext } from './scene';

/**
 * The student's window the box is drawn for: the slide at two thirds of
 * its size, 1280 x 720 for a lying slide and 720 x 1280 for an upright one.
 */
export function popView(stage: Stage): { width: number; height: number } {
  return { width: (stage.width * 2) / 3, height: (stage.height * 2) / 3 };
}
/** The student's window is two thirds of the slide, whatever its shape. */
const VIEW_SCALE = 2 / 3;

type Box = { x: number; y: number; w: number; h: number };

/**
 * Where a box on the slide is seen, in stage pixels, when the picture is
 * zoomed in on `view` (everything on the slide lies in the layer the zoom
 * makes larger, but the "Lær mer" box lies outside it). Only the part that
 * is inside the picture counts; an element wholly outside it is seen as a
 * sliver at the nearest edge.
 */
export function seenBox(
  box: Box,
  view: View | undefined,
  /** The stage of the project (lying when not given). */
  stage: Stage = stageFor('landscape'),
): Box {
  if (!view) return box;
  const k = stage.width / view.w;
  const left = (box.x - view.x) * k;
  const top = (box.y - view.y) * k;
  const clamp = (value: number, most: number): number => Math.max(0, Math.min(most, value));
  const x0 = clamp(left, stage.width);
  const y0 = clamp(top, stage.height);
  const x1 = clamp(left + box.w * k, stage.width);
  const y1 = clamp(top + box.h * k, stage.height);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export interface SlidePopover {
  /** The element the box belongs to. */
  element: string;
  /** Goes on top of the slide, in a host as large as the stage. */
  layer: HTMLElement;
  panel: HTMLElement;
  /** The content, block by block (`data-block` on each). */
  body: HTMLElement;
  /**
   * Puts the box where it belongs: beside its element where the element is
   * seen, with the picture zoomed in on `view` (the whole slide when it is
   * undefined; left out, the view of the last call). Call when it is in the
   * document, when its content has changed size, and when the zoom changes.
   */
  place(view?: View | null): void;
  /** How far the box has popped out: 0 is just started, 1 is all the way. */
  setProgress(progress: number): void;
}

/** Overshoots a little and settles, like the player's own pop. */
function easeOutBack(t: number): number {
  const c = 1.4;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

/**
 * Builds the box of an element. `closeLabel` gives it a button to put it
 * away with (the recording window); without it nothing in it can be
 * pressed (the video).
 */
export function createPopover(
  ctx: RenderContext,
  element: SceneElement,
  options: { closeLabel?: string } = {},
): SlidePopover | undefined {
  const more = moreOf(element);
  if (!more) return undefined;
  const { doc } = ctx;
  const stage = ctx.theme.stage;
  const room = popView(stage);
  const layer = doc.createElement('div');
  layer.className = 'ls-pop-layer';
  layer.style.width = `${room.width}px`;
  layer.style.height = `${room.height}px`;
  layer.style.transform = `scale(${1 / VIEW_SCALE})`;
  const panel = doc.createElement('div');
  panel.className = 'ls-pop';
  panel.style.maxHeight = `${room.height - 32}px`;
  panel.dataset.popFor = element.id;
  const head = doc.createElement('div');
  head.className = 'ls-pop-head';
  const title = doc.createElement('h2');
  title.textContent = moreTitle(ctx, element);
  head.appendChild(title);
  if (options.closeLabel) {
    const close = doc.createElement('button');
    close.type = 'button';
    close.className = 'ls-pop-close';
    close.textContent = options.closeLabel;
    head.appendChild(close);
  }
  const body = renderMore(ctx, more);
  panel.append(head, body);
  layer.appendChild(panel);

  const corner = moreCorner(element);
  const wish = popoverWish(more);
  /** Where the element is seen, in the student's window, and the corner its mark is in. */
  const seen = (view: View | undefined) => {
    const box = seenBox(element.box, view, stage);
    const anchor = {
      left: box.x * VIEW_SCALE,
      top: box.y * VIEW_SCALE,
      right: (box.x + box.w) * VIEW_SCALE,
      bottom: (box.y + box.h) * VIEW_SCALE,
    };
    const from = {
      x: corner.endsWith('r') ? anchor.right : anchor.left,
      y: corner.startsWith('t') ? anchor.top : anchor.bottom,
    };
    return { anchor, from };
  };
  let view: View | undefined;
  panel.style.left = '16px';
  panel.style.top = '16px';
  panel.style.width = `${popoverWidth(seen(undefined).anchor, room.width, wish.preferred, wish.least)}px`;

  return {
    element: element.id,
    layer,
    panel,
    body,
    place(next) {
      if (next !== undefined) view = next ?? undefined;
      const { anchor, from } = seen(view);
      const width = popoverWidth(anchor, room.width, wish.preferred, wish.least);
      panel.style.width = `${width}px`;
      // A figure in the box is made to fit it now, not when the window next draws.
      fitDrawings(panel);
      const place = placePopover(anchor, from, room, {
        width,
        height: Math.min(panel.offsetHeight, room.height - 32),
      });
      panel.style.left = `${place.left}px`;
      panel.style.top = `${place.top}px`;
      panel.style.transformOrigin = `${place.originX}px ${place.originY}px`;
    },
    setProgress(progress) {
      const p = Math.max(0, Math.min(1, progress));
      if (p >= 1) {
        panel.style.transform = '';
        panel.style.opacity = '';
      } else {
        panel.style.transform = `scale(${0.5 + 0.5 * easeOutBack(p)})`;
        panel.style.opacity = String(Math.min(1, p * 2.5));
      }
    },
  };
}
