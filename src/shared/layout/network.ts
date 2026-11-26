// The figure "network": nodes and the connections between them. The form
// says what there is; the lecturer says where it is (the owner's choice,
// 26.11.2026). Each node is an ordinary shape and each connection an
// ordinary line or arrow fastened at both ends, made and taken away by
// `followTemplates` (./templates.ts). Where a node stands and how a
// connection runs belong to the lecturer, and are only laid out anew when
// he asks for it («Ordne nodene»). The functions change what they are given.
import type { Stage } from '../format/constants';
import type { Box, Element, FigureElement, FigureLink, Scene, ShapeElement } from '../format/schema';
import { fastenEnd, isLine, straighten } from './groups';

/** The part that shows a node, and the one that shows a connection. */
export const nodePart = (item: string): string => `node:${item}`;
export const linkPart = (link: string): string => `link:${link}`;

/** The connections of a network that join two nodes it has, two different ones. */
export function validLinks(figure: FigureElement): FigureLink[] {
  const nodes = new Set(figure.items.map((item) => item.id));
  return (figure.links ?? []).filter(
    (link) => link.from !== link.to && nodes.has(link.from) && nodes.has(link.to),
  );
}

/** How large a node is when it is made: it suits the size of the letters, inside the frame. */
export function nodeSize(figure: FigureElement, fontSize: number): { w: number; h: number } {
  return {
    w: Math.max(40, Math.min(figure.box.w, Math.round(fontSize * 7))),
    h: Math.max(30, Math.min(figure.box.h, Math.round(fontSize * 3.2))),
  };
}

function overlap(a: Box, b: Box, room: number): number {
  const w = Math.min(a.x + a.w, b.x + b.w) + room - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) + room - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * A free place for a new node inside the frame: the first place, row by
 * row, of an even grid with room between the nodes, where it lies on no
 * other node. When there is none, the place where it lies least on others.
 */
export function freePlace(
  frame: Box,
  size: { w: number; h: number },
  taken: readonly Box[],
): Box {
  const gapX = Math.round(size.w * 0.6);
  const gapY = Math.round(size.h * 0.8);
  const cols = Math.max(1, Math.floor((frame.w + gapX) / (size.w + gapX)));
  const rows = Math.max(1, Math.floor((frame.h + gapY) / (size.h + gapY)));
  const at = (i: number, n: number, from: number, length: number, piece: number): number =>
    Math.round(n > 1 ? from + (i * (length - piece)) / (n - 1) : from + (length - piece) / 2);
  let best: { box: Box; covered: number } | undefined;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const box: Box = {
        x: at(c, cols, frame.x, frame.w, size.w),
        y: at(r, rows, frame.y, frame.h, size.h),
        w: size.w,
        h: size.h,
        rotation: 0,
      };
      const covered = taken.reduce((sum, other) => sum + overlap(box, other, 12), 0);
      if (covered === 0) return box;
      if (!best || covered < best.covered) best = { box, covered };
    }
  }
  return best!.box;
}

/** The shape on the slide that shows a part of the figure. */
function partOn(
  scene: Pick<Scene, 'elements'>,
  figureId: string,
  part: string,
): ShapeElement | undefined {
  return scene.elements.find(
    (el): el is ShapeElement =>
      el.type === 'shape' && el.of?.figure === figureId && el.of.part === part,
  );
}

/** The row of the form a node on the slide shows, when the element is a node of this network. */
function nodeOf(el: Element | undefined, figureId: string): string | undefined {
  return el?.of?.figure === figureId && el.of.part.startsWith('node:')
    ? el.of.part.slice('node:'.length)
    : undefined;
}

/** Takes a node out of the form, and the connections it has with it. */
export function removeNode(figure: FigureElement, item: string): void {
  figure.items = figure.items.filter((one) => one.id !== item);
  if (figure.links) {
    figure.links = figure.links.filter((link) => link.from !== item && link.to !== item);
  }
}

/**
 * Says in the form which node an end of a connection goes to, and fastens
 * that end of it on the slide to that node, by itself (an end that lay on
 * another connection is fastened to the node instead: the form says what
 * there is).
 */
export function setLinkEnd(
  scene: Pick<Scene, 'elements'>,
  figure: FigureElement,
  linkId: string,
  end: 'start' | 'end',
  item: string,
): void {
  const link = figure.links?.find((one) => one.id === linkId);
  if (!link) return;
  link[end === 'start' ? 'from' : 'to'] = item;
  const line = partOn(scene, figure.id, linkPart(linkId));
  const node = partOn(scene, figure.id, nodePart(item));
  if (line && node) fastenEnd(line, end, { at: node.id });
}

/**
 * After an end of a connection was dragged on the slide: an end let go on
 * another node of the network goes to that node in the form too. (An end
 * on another line is a T-junction and the form keeps its node; an end let
 * go in the open is fastened again to the node the form names, by
 * `followTemplates`.) A connection is never made to run from a node to
 * the same node: such an end goes back to the node it had.
 */
export function takeLinkEnds(scene: Pick<Scene, 'elements'>, lineId: string): void {
  const line = scene.elements.find((el) => el.id === lineId);
  if (!line || line.type !== 'shape' || !line.of?.part.startsWith('link:')) return;
  const figure = scene.elements.find(
    (el): el is FigureElement => el.type === 'figure' && el.id === line.of!.figure,
  );
  const link = figure?.links?.find((one) => `link:${one.id}` === line.of!.part);
  if (!figure || !link) return;
  for (const end of ['start', 'end'] as const) {
    const id = end === 'start' ? line.startAt : line.endAt;
    const item = nodeOf(
      scene.elements.find((el) => el.id === id),
      figure.id,
    );
    if (item === undefined) continue;
    const key = end === 'start' ? 'from' : 'to';
    const other = end === 'start' ? link.to : link.from;
    if (item === other) {
      const own = partOn(scene, figure.id, nodePart(link[key]));
      fastenEnd(line, end, own ? { at: own.id } : null);
    } else link[key] = item;
  }
}

/**
 * Where an end of a connection lies when the lecturer has dragged it onto
 * another line: that line, when it is a connection of the same network.
 */
export function linkEndOnLink(
  scene: Pick<Scene, 'elements'>,
  figure: FigureElement,
  linkId: string,
  end: 'start' | 'end',
): { link?: FigureLink; elsewhere: boolean } | undefined {
  const line = partOn(scene, figure.id, linkPart(linkId));
  const id = end === 'start' ? line?.startAt : line?.endAt;
  const target = id === undefined ? undefined : scene.elements.find((el) => el.id === id);
  if (!target || !isLine(target)) return undefined;
  const part = target.of?.figure === figure.id ? target.of.part : undefined;
  const link = part?.startsWith('link:')
    ? figure.links?.find((one) => one.id === part.slice('link:'.length))
    : undefined;
  return link ? { link, elsewhere: false } : { elsewhere: true };
}

/**
 * The layer of each node when the arrows give an order: how many arrows
 * the longest way to it has. Undefined when there is no arrow, or when the
 * arrows run in a ring (then they give no order).
 */
function layers(figure: FigureElement, links: readonly FigureLink[]): Map<string, number> | undefined {
  const arrows = links.filter((link) => link.arrow);
  if (arrows.length === 0) return undefined;
  const into = new Map(figure.items.map((item) => [item.id, 0]));
  for (const arrow of arrows) into.set(arrow.to, (into.get(arrow.to) ?? 0) + 1);
  const layer = new Map(figure.items.map((item) => [item.id, 0]));
  const queue = figure.items.filter((item) => into.get(item.id) === 0).map((item) => item.id);
  let seen = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    seen++;
    for (const arrow of arrows) {
      if (arrow.from !== id) continue;
      layer.set(arrow.to, Math.max(layer.get(arrow.to)!, layer.get(id)! + 1));
      into.set(arrow.to, into.get(arrow.to)! - 1);
      if (into.get(arrow.to) === 0) queue.push(arrow.to);
    }
  }
  return seen === figure.items.length ? layer : undefined;
}

/**
 * «Ordne nodene»: lays the nodes out neatly inside the frame, and
 * straightens the connections (an end on another connection stays on it).
 * In layers from left to right (top to bottom on an upright slide) when the
 * connections are arrows that give an order; otherwise in a ring, in the
 * order of the form, beginning at the top. The size of each node is kept.
 */
export function arrangeNodes(
  scene: Pick<Scene, 'elements'>,
  figureId: string,
  stage: Stage,
): void {
  const figure = scene.elements.find(
    (el): el is FigureElement => el.type === 'figure' && el.id === figureId,
  );
  if (!figure || figure.items.length === 0) return;
  const f = figure.box;
  const nodes = figure.items
    .map((item) => ({ item: item.id, el: partOn(scene, figureId, nodePart(item.id)) }))
    .filter((one): one is { item: string; el: ShapeElement } => one.el !== undefined);
  const links = validLinks(figure);
  const centres = new Map<string, { x: number; y: number }>();
  const ordered = layers(figure, links);
  if (ordered) {
    const across = stage.width >= stage.height;
    const count = Math.max(...ordered.values()) + 1;
    const columns: string[][] = Array.from({ length: count }, () => []);
    for (const item of figure.items) columns[ordered.get(item.id)!]!.push(item.id);
    // Within a layer, each node near the middle of the nodes that lead to it.
    const place = new Map<string, number>();
    columns.forEach((column, k) => {
      const weight = (id: string): number => {
        const before = links
          .filter((link) => link.arrow && link.to === id && place.has(link.from))
          .map((link) => place.get(link.from)!);
        return before.length > 0 ? before.reduce((a, b) => a + b, 0) / before.length : Infinity;
      };
      if (k > 0) {
        const form = new Map(column.map((id, i) => [id, i]));
        column.sort((a, b) => {
          const wa = weight(a);
          const wb = weight(b);
          return wa === wb || (!isFinite(wa) && !isFinite(wb)) ? form.get(a)! - form.get(b)! : wa - wb;
        });
      }
      column.forEach((id, i) => place.set(id, (i + 0.5) / column.length));
      column.forEach((id, i) => {
        const along = (k + 0.5) / count;
        const side = (i + 0.5) / column.length;
        centres.set(
          id,
          across
            ? { x: f.x + along * f.w, y: f.y + side * f.h }
            : { x: f.x + side * f.w, y: f.y + along * f.h },
        );
      });
    });
  } else {
    const widest = Math.max(...nodes.map((one) => one.el.box.w));
    const tallest = Math.max(...nodes.map((one) => one.el.box.h));
    const rx = Math.max(0, (f.w - widest) / 2);
    const ry = Math.max(0, (f.h - tallest) / 2);
    const n = nodes.length;
    nodes.forEach((one, i) => {
      // One node in the middle; two side by side (one over the other when the frame is upright).
      const angle =
        n === 2 && f.w < f.h ? -Math.PI / 2 + i * Math.PI : n === 2 ? Math.PI + i * Math.PI : -Math.PI / 2 + (2 * Math.PI * i) / n;
      centres.set(
        one.item,
        n === 1
          ? { x: f.x + f.w / 2, y: f.y + f.h / 2 }
          : { x: f.x + f.w / 2 + rx * Math.cos(angle), y: f.y + f.h / 2 + ry * Math.sin(angle) },
      );
    });
  }
  for (const { item, el } of nodes) {
    const centre = centres.get(item)!;
    const x = Math.min(Math.max(f.x, centre.x - el.box.w / 2), f.x + f.w - el.box.w);
    const y = Math.min(Math.max(f.y, centre.y - el.box.h / 2), f.y + f.h - el.box.h);
    el.box = { ...el.box, x: Math.round(x), y: Math.round(y), rotation: 0 };
  }
  for (const link of links) {
    const line = partOn(scene, figureId, linkPart(link.id));
    if (!line) continue;
    straighten(line);
    for (const end of ['start', 'end'] as const) {
      const id = end === 'start' ? line.startAt : line.endAt;
      const target = scene.elements.find((el) => el.id === id);
      if (target && isLine(target)) continue;
      const node = partOn(scene, figureId, nodePart(end === 'start' ? link.from : link.to));
      fastenEnd(line, end, node ? { at: node.id } : null);
    }
  }
}
