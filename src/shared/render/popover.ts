// The "Lær mer" box drawn on the slide itself: for the video export, where
// the box pops out at the moment the lecturer opened it, and for the
// recording window, where the lecturer opens it. The HTML player has its
// own box (the student's window can have any size); this one is drawn as
// the student sees it in a window of 1280 x 720, like the builder's preview.
import { STAGE } from '../format/constants';
import type { Element as SceneElement } from '../format/schema';
import { fitDrawings, placePopover, popoverWidth, popoverWish, renderMore } from './more';
import { moreCorner, moreOf, moreTitle, type RenderContext } from './scene';

/** The student's window the box is drawn for: the slide at two thirds of its size. */
export const POP_VIEW = { width: 1280, height: 720 } as const;
const VIEW_SCALE = POP_VIEW.width / STAGE.width;

export interface SlidePopover {
  /** The element the box belongs to. */
  element: string;
  /** Goes on top of the slide, in a host as large as the stage. */
  layer: HTMLElement;
  panel: HTMLElement;
  /** The content, block by block (`data-block` on each). */
  body: HTMLElement;
  /** Puts the box where it belongs. Call when it is in the document, and when its content has changed size. */
  place(): void;
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
  const layer = doc.createElement('div');
  layer.className = 'ls-pop-layer';
  layer.style.transform = `scale(${1 / VIEW_SCALE})`;
  const panel = doc.createElement('div');
  panel.className = 'ls-pop';
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

  const { box } = element;
  const anchor = {
    left: box.x * VIEW_SCALE,
    top: box.y * VIEW_SCALE,
    right: (box.x + box.w) * VIEW_SCALE,
    bottom: (box.y + box.h) * VIEW_SCALE,
  };
  const corner = moreCorner(element);
  const from = {
    x: corner.endsWith('r') ? anchor.right : anchor.left,
    y: corner.startsWith('t') ? anchor.top : anchor.bottom,
  };
  const wish = popoverWish(more);
  const width = popoverWidth(anchor, POP_VIEW.width, wish.preferred, wish.least);
  panel.style.width = `${width}px`;
  panel.style.left = '16px';
  panel.style.top = '16px';

  return {
    element: element.id,
    layer,
    panel,
    body,
    place() {
      // A figure in the box is made to fit it now, not when the window next draws.
      fitDrawings(panel);
      const place = placePopover(anchor, from, POP_VIEW, {
        width,
        height: Math.min(panel.offsetHeight, POP_VIEW.height - 32),
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
