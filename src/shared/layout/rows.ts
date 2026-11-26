// Which row and which series of its form a part of a figure shows, and the
// order the parts are read in. Kept apart from ./templates.ts because the
// HTML player needs this and nothing else of it: this file must not bring
// the project format's checking code (zod) into the exported file. Types
// only from the format.
import type { Box, Element, FigureElement } from '../format/schema';

/** Parts that show one row of the form. An arrow leads to the row it names. A node is a row of a network. */
const ROW_KINDS = ['box', 'head', 'body', 'arrow', 'dot', 'label', 'node'] as const;
/** Parts that show one series of a diagram: its curve, and its colour and name in the legend. */
const SERIES_KINDS = ['curve', 'key', 'name'] as const;
type PartKind = (typeof ROW_KINDS)[number] | (typeof SERIES_KINDS)[number] | 'bar' | 'link';

export interface PartSource {
  kind: PartKind;
  /** The row of the form, when the part shows one. */
  item?: string;
  /** The series, when the part shows one. A bar shows both. */
  series?: string;
  /** For a connection of a network: which one. */
  link?: string;
}

/**
 * Which row or series of the form a part shows, and what of it. What shows
 * neither (the line of a time axis, the axes and numbers of a diagram) has
 * no source.
 */
export function partSource(part: string): PartSource | undefined {
  const at = part.indexOf(':');
  const name = part.slice(0, at);
  const rest = part.slice(at + 1);
  const row = ROW_KINDS.find((known) => known === name);
  if (row) return { kind: row, item: rest };
  const series = SERIES_KINDS.find((known) => known === name);
  if (series) return { kind: series, series: rest };
  if (name === 'link') return { kind: 'link', link: rest };
  if (name === 'bar') {
    const split = rest.indexOf(':');
    return { kind: 'bar', item: rest.slice(0, split), series: rest.slice(split + 1) };
  }
  return undefined;
}

export interface RowPlace {
  figure: string;
  /** The frame of the figure: where all of it is read. */
  at: Box;
  /** Its turn among the parts of the figure. */
  turn: number;
}

/**
 * Where each part of the figures with a form is read: at its figure's frame,
 * row by row of the form, and within a row the heading before what stands
 * under it. For assistive technology, which would otherwise read a time axis
 * as all the times and then all the texts.
 */
export function rowOrder(elements: readonly Element[]): Map<string, RowPlace> {
  const order = new Map<string, RowPlace>();
  const figures = new Map(
    elements
      .filter((el): el is FigureElement => el.type === 'figure')
      .map((figure) => [figure.id, figure]),
  );
  if (figures.size === 0) return order;
  for (const el of elements) {
    const figure = el.of && figures.get(el.of.figure);
    if (!figure) continue;
    const source = partSource(el.of!.part);
    const row =
      source?.kind === 'link'
        ? // The connections of a network after its nodes.
          figure.items.length + (figure.links ?? []).findIndex((l) => l.id === source.link)
        : source?.item === undefined
          ? -1
          : figure.items.findIndex((i) => i.id === source.item);
    order.set(el.id, {
      figure: figure.id,
      at: figure.box,
      turn: (row + 1) * 2 + (source?.kind === 'body' ? 1 : 0),
    });
  }
  return order;
}

/**
 * Which end a bar of a diagram grows from when it comes in at a step: the
 * bottom when it stands on the horizontal axis, the top when it hangs
 * under it. Undefined for anything that is not such a bar.
 */
export function barGrowsFrom(
  elements: readonly Element[],
  el: Element,
): 'bottom' | 'top' | undefined {
  if (!el.of?.part.startsWith('bar:')) return undefined;
  const figure = el.of.figure;
  const axis = elements.find((one) => one.of?.figure === figure && one.of.part === 'axis:x');
  return !axis || el.box.y + el.box.h / 2 <= axis.box.y ? 'bottom' : 'top';
}

/**
 * The connections of a network as they are read by those who cannot see
 * it, in the order of the form: «A til B» for an arrow, «A og B» for a line
 * without direction. A connection with a node that has no text is left out.
 */
export function connectionList(
  figure: FigureElement,
  say: (from: string, to: string, arrow: boolean) => string,
): string[] {
  const text = new Map(figure.items.map((item) => [item.id, item.text.replace(/\s+/g, ' ').trim()]));
  return (figure.links ?? []).flatMap((link) => {
    const from = text.get(link.from);
    const to = text.get(link.to);
    return link.from !== link.to && from && to ? [say(from, to, !!link.arrow)] : [];
  });
}
