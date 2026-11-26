// Which row of its form a part of a figure shows, and the order the parts
// are read in. Kept apart from ./templates.ts because the HTML player needs
// this and nothing else of it: this file must not bring the project format's
// checking code (zod) into the exported file. Types only from the format.
import type { Box, Element, FigureElement } from '../format/schema';

const PART_KINDS = ['box', 'head', 'body', 'arrow', 'dot'] as const;
type PartKind = (typeof PART_KINDS)[number];

/**
 * Which row of the form a part shows, and what of it. An arrow leads to the
 * row it names. The line of a time axis shows no row, and has no source.
 */
export function partSource(part: string): { kind: PartKind; item: string } | undefined {
  const at = part.indexOf(':');
  const kind = PART_KINDS.find((known) => known === part.slice(0, at));
  return kind ? { kind, item: part.slice(at + 1) } : undefined;
}

/**
 * Where each part of the figures with a form is read: at its figure's frame,
 * row by row of the form, and within a row the heading before what stands
 * under it. For assistive technology, which would otherwise read a time axis
 * as all the times and then all the texts.
 */
export interface RowPlace {
  figure: string;
  /** The frame of the figure: where all of it is read. */
  at: Box;
  /** Its turn among the parts of the figure. */
  turn: number;
}

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
    const row = source ? figure.items.findIndex((item) => item.id === source.item) : -1;
    order.set(el.id, {
      figure: figure.id,
      at: figure.box,
      turn: (row + 1) * 2 + (source?.kind === 'body' ? 1 : 0),
    });
  }
  return order;
}
