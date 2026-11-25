// The editing surface: the scene, drawn by the shared render code, with
// selection, moving, resizing, snapping to the grid and in-place text
// editing on top.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { EditorState } from 'prosemirror-state';
import { STAGE } from '../../shared/format/constants';
import { isEmptyRichText, richText } from '../../shared/format/factory';
import type { Box, Element, RichText } from '../../shared/format/schema';
import {
  canGroup,
  fastenTargetAt,
  groupElements,
  letGoMoved,
  membersOf,
  scaleInto,
  ungroupElements,
  unionBox,
} from '../../shared/layout/groups';
import { markStyle, pictureOf } from '../../shared/layout/marks';
import { columnEdges, getTheme } from '../../shared/theme/theme';
import { SceneView } from './SceneView';
import { StageCamera } from './StageCamera';
import { newId } from '../../shared/format/factory';
import { cloneElements, deleteElements, stepOf } from './ops';
import { createTextEditor, type TextEditor } from './richtext/editor';
import { TextToolbar } from './TextToolbar';
import { currentScene, useStore } from './store';

type Point = { x: number; y: number };
type Handle = { hx: -1 | 0 | 1; hy: -1 | 0 | 1 } | { end: 'start' | 'end' } | { point: true };

interface Drag {
  /**
   * 'point' is what a label on a picture points at; 'resize-many' changes
   * the size of everything that is chosen, as one.
   */
  kind: 'move' | 'resize' | 'resize-many' | 'endpoint' | 'point';
  start: Point;
  boxes: Map<string, Box>;
  handle?: Handle;
  /** For 'resize-many': the frame round what is chosen, as the drag began. */
  frame?: Box;
  /**
   * A line that is not itself dragged is fastened to something that is: the
   * change is made as the pointer goes, so the line is seen to follow.
   */
  live: boolean;
  /** The whole group was chosen already: a click that does not drag chooses this part of it. */
  enter?: string;
  moved: boolean;
  seq: number;
}

const HANDLES: Array<{ hx: -1 | 0 | 1; hy: -1 | 0 | 1; cursor: string }> = [
  { hx: -1, hy: -1, cursor: 'nwse-resize' },
  { hx: 0, hy: -1, cursor: 'ns-resize' },
  { hx: 1, hy: -1, cursor: 'nesw-resize' },
  { hx: 1, hy: 0, cursor: 'ew-resize' },
  { hx: 1, hy: 1, cursor: 'nwse-resize' },
  { hx: 0, hy: 1, cursor: 'ns-resize' },
  { hx: -1, hy: 1, cursor: 'nesw-resize' },
  { hx: -1, hy: 0, cursor: 'ew-resize' },
];

const isLine = (el: Element): boolean =>
  el.type === 'shape' && (el.geometry === 'line' || el.geometry === 'arrow');

function rotate(p: Point, degrees: number): Point {
  const a = (degrees * Math.PI) / 180;
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
}

function lineEnds(el: Element): { start: Point; end: Point } {
  const { x, y, w, h } = el.box;
  const flipH = el.type === 'shape' && !!el.flipH;
  const flipV = el.type === 'shape' && !!el.flipV;
  return {
    start: { x: flipH ? x + w : x, y: flipV ? y + h : y },
    end: { x: flipH ? x : x + w, y: flipV ? y : y + h },
  };
}

function hits(el: Element, p: Point, tolerance: number): boolean {
  const { x, y, w, h, rotation } = el.box;
  if (isLine(el)) {
    const { start, end } = lineEnds(el);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - start.x) * dx + (p.y - start.y) * dy) / length2));
    return Math.hypot(p.x - (start.x + t * dx), p.y - (start.y + t * dy)) <= tolerance * 1.5;
  }
  const centre = { x: x + w / 2, y: y + h / 2 };
  const local = rotate({ x: p.x - centre.x, y: p.y - centre.y }, -rotation);
  return Math.abs(local.x) <= w / 2 + tolerance / 2 && Math.abs(local.y) <= h / 2 + tolerance / 2;
}

function snapValue(value: number, targets: number[], threshold: number): number | null {
  let best: number | null = null;
  for (const target of targets) {
    if (
      Math.abs(target - value) <= threshold &&
      (best === null || Math.abs(target - value) < Math.abs(best - value))
    ) {
      best = target;
    }
  }
  return best;
}

export function Stage() {
  const project = useStore((s) => s.project)!;
  const scene = useStore(currentScene);
  const selection = useStore((s) => s.selection);
  const editing = useStore((s) => s.editing);
  const showGrid = useStore((s) => s.showGrid);
  const previewSteps = useStore((s) => s.previewSteps);
  const logo = useStore((s) => s.logo);
  const theme = getTheme(project);

  const area = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [transient, setTransient] = useState<Map<string, Box> | null>(null);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const drag = useRef<Drag | null>(null);
  const dragSeq = useRef(0);
  const editor = useRef<TextEditor | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  /** The right-click menu: where it is, and for which element. */
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);

  // The menu closes on any click elsewhere, on Escape, and when the scene changes.
  useEffect(() => {
    if (!menu) return;
    const close = (): void => setMenu(null);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', close);
    };
  }, [menu]);

  // Fit the stage to the space available.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const fit = (): void => {
      const s = Math.min(
        (el.clientWidth - 32) / STAGE.width,
        (el.clientHeight - 32) / STAGE.height,
      );
      setScale(Math.max(0.1, s));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toStage = useCallback((event: { clientX: number; clientY: number }): Point => {
    const rect = inner.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * STAGE.width,
      y: ((event.clientY - rect.top) / rect.height) * STAGE.height,
    };
  }, []);

  // ---------- In-place text editing ----------
  const editingKey = editing ? `${editing.elementId}|${editing.cell ?? ''}` : '';
  const sceneId = scene?.id;
  useLayoutEffect(() => {
    const state = useStore.getState();
    const current = currentScene(state);
    const target = state.editing;
    if (!target || !current || !inner.current) return;
    const element = current.elements.find((e) => e.id === target.elementId);
    const host = inner.current.querySelector<HTMLElement>(`[data-el="${target.elementId}"]`);
    if (!element || !host) return;

    let mount: HTMLElement | null = null;
    let content: RichText | undefined;
    let allowBold = true;
    if (element.type === 'text') {
      mount = host.querySelector('.ls-text');
      content = element.content;
      allowBold = theme.roles[element.role].font === 'body';
    } else if (element.type === 'shape') {
      mount = host.querySelector('.ls-shape-content');
      content = element.content;
    } else if (element.type === 'table' && target.cell) {
      mount = host.querySelector(`[data-cell="${target.cell}"]`);
      const [r, c] = target.cell.split(':').map(Number);
      content = element.rows[r!]?.[c!]?.content;
    }
    if (!mount || !content) {
      state.setEditing(null);
      return;
    }

    const original = content;
    mount.replaceChildren();
    mount.classList.add('is-editing');
    // List levels get the same sizes while editing as when the scene is drawn.
    const levels =
      (element.type === 'text' || element.type === 'shape') && element.levelScale
        ? element.levelScale
        : theme.levelScale;
    levels.forEach((factor, level) => mount.style.setProperty(`--ls-lvl${level}`, String(factor)));
    const instance = createTextEditor({
      mount,
      content: original,
      allowBold,
      onState: setEditorState,
      onEscape: () => useStore.getState().setEditing(null),
    });
    editor.current = instance;
    instance.view.focus();

    return () => {
      const next = instance.getContent();
      instance.destroy();
      editor.current = null;
      setEditorState(null);
      const changed = JSON.stringify(next) !== JSON.stringify(original);
      const empty = isEmptyRichText(next);
      useStore.getState().update((draft) => {
        const s = draft.scenes.find((x) => x.id === current.id);
        const el = s?.elements.find((x) => x.id === target.elementId);
        if (!s || !el) return;
        if (el.type === 'text') {
          // A text box left empty is removed rather than kept as an invisible box.
          if (empty) deleteElements(s, [el.id]);
          else if (changed) el.content = next;
        } else if (el.type === 'shape') {
          if (empty) delete el.content;
          else if (changed) el.content = next;
        } else if (el.type === 'table' && target.cell && changed) {
          const [r, c] = target.cell.split(':').map(Number);
          const cell = el.rows[r!]?.[c!];
          if (cell) cell.content = next;
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingKey, sceneId]);

  // ---------- Pointer ----------
  const boxOf = (el: Element): Box => transient?.get(el.id) ?? el.box;

  function applyTransient(boxes: Map<string, Box>): void {
    for (const [id, box] of boxes) {
      const node = inner.current?.querySelector<HTMLElement>(`[data-el="${id}"]`);
      if (!node) continue;
      node.style.left = `${box.x}px`;
      node.style.top = `${box.y}px`;
      node.style.width = `${box.w}px`;
      node.style.height = `${box.h}px`;
    }
    setTransient(new Map(boxes));
  }

  /** True when a line that is not among the ids is fastened to one of them. */
  function pullsLines(ids: ReadonlySet<string> | ReadonlyMap<string, unknown>): boolean {
    return (scene?.elements ?? []).some(
      (e) =>
        e.type === 'shape' &&
        !ids.has(e.id) &&
        ((e.startAt !== undefined && ids.has(e.startAt)) ||
          (e.endAt !== undefined && ids.has(e.endAt))),
    );
  }

  /** Shows the boxes a drag has come to: in the project when lines follow them, otherwise only on screen. */
  function place(d: Drag, boxes: Map<string, Box>): void {
    if (!d.live) {
      applyTransient(boxes);
      return;
    }
    useStore.getState().updateScene(
      (s) => {
        for (const [id, box] of boxes) {
          const el = s.elements.find((e) => e.id === id);
          if (el) el.box = box;
        }
        if (d.kind === 'move') letGoMoved(s, [...boxes.keys()]);
      },
      `drag-${d.seq}`,
      true,
    );
  }

  /** What changes size when everything that is chosen does: marks and legends follow their picture. */
  function resizable(ids: string[]): Element[] {
    return (scene?.elements ?? []).filter(
      (e) =>
        ids.includes(e.id) && !((e.type === 'mark' || e.type === 'legend') && ids.includes(e.on)),
    );
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (!scene || event.button !== 0) return;
    const state = useStore.getState();
    const target = event.target as HTMLElement;

    if (state.editing) {
      const host = inner.current?.querySelector(`[data-el="${state.editing.elementId}"]`);
      if (host?.contains(target) && target.closest('.is-editing')) return; // typing in the text
      state.setEditing(null);
    }

    const p = toStage(event);
    const handleEl = target.closest<HTMLElement>('[data-handle]');
    const tolerance = 10 / scale;

    if (handleEl?.dataset.handle?.startsWith('m:') && state.selection.length > 1) {
      const [hx, hy] = handleEl.dataset.handle.slice(2).split(',').map(Number);
      const members = resizable(state.selection);
      const boxes = new Map(members.map((e) => [e.id, e.box]));
      drag.current = {
        kind: 'resize-many',
        start: p,
        boxes,
        handle: { hx: hx as -1 | 0 | 1, hy: hy as -1 | 0 | 1 },
        frame: unionBox(members.map((e) => e.box)),
        live: pullsLines(boxes),
        moved: false,
        seq: ++dragSeq.current,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    if (handleEl && state.selection.length === 1) {
      const el = scene.elements.find((e) => e.id === state.selection[0]);
      if (!el) return;
      const raw = handleEl.dataset.handle!;
      const handle: Handle =
        raw === 'point'
          ? { point: true }
          : raw === 'start' || raw === 'end'
            ? { end: raw }
            : {
                hx: Number(raw.split(',')[0]) as -1 | 0 | 1,
                hy: Number(raw.split(',')[1]) as -1 | 0 | 1,
              };
      drag.current = {
        kind: 'point' in handle ? 'point' : 'end' in handle ? 'endpoint' : 'resize',
        start: p,
        boxes: new Map([[el.id, el.box]]),
        handle,
        live: !('point' in handle) && !('end' in handle) && pullsLines(new Set([el.id])),
        moved: false,
        seq: ++dragSeq.current,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    let hit: Element | undefined;
    for (let i = scene.elements.length - 1; i >= 0; i--) {
      if (hits(scene.elements[i]!, p, tolerance)) {
        hit = scene.elements[i];
        break;
      }
    }
    area.current?.focus();
    if (!hit) {
      if (!event.shiftKey) state.select([]);
      return;
    }
    let ids = state.selection;
    let enter: string | undefined;
    // A group is chosen as one. When some of it is chosen already (the owner
    // has gone into it), its parts are chosen one by one like anything else.
    const mates = hit.group ? membersOf(scene, hit.group).map((e) => e.id) : [];
    const whole = mates.length > 0 && mates.every((id) => ids.includes(id));
    const into = mates.length > 0 && !whole && mates.some((id) => ids.includes(id));
    if (mates.length > 0 && !into) {
      if (event.shiftKey) {
        ids = whole
          ? ids.filter((id) => !mates.includes(id))
          : [...ids, ...mates.filter((id) => !ids.includes(id))];
      } else if (!whole) {
        ids = mates;
      } else {
        enter = hit.id;
      }
    } else if (event.shiftKey) {
      ids = ids.includes(hit.id) ? ids.filter((id) => id !== hit!.id) : [...ids, hit.id];
    } else if (!ids.includes(hit.id)) {
      ids = [hit.id];
    }
    state.select(ids);
    if (!ids.includes(hit.id)) return;
    const boxes = new Map(
      scene.elements
        // What belongs to a picture that is moved (its marks, its legend) is seen to move with it.
        .filter(
          (e) =>
            ids.includes(e.id) ||
            ((e.type === 'mark' || e.type === 'legend') && ids.includes(e.on)),
        )
        .map((e) => [e.id, e.box]),
    );
    drag.current = {
      kind: 'move',
      start: p,
      boxes,
      live: pullsLines(boxes),
      enter,
      moved: false,
      seq: ++dragSeq.current,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    const d = drag.current;
    if (!d || !scene) return;
    const p = toStage(event);
    let dx = p.x - d.start.x;
    let dy = p.y - d.start.y;
    if (!d.moved && Math.hypot(dx, dy) * scale < 3) return;
    d.moved = true;
    if (d.kind === 'point') {
      // What a label points at follows the pointer; the line is drawn anew as it goes.
      const [id] = [...d.boxes.keys()];
      useStore.getState().updateScene(
        (s) => {
          const mark = s.elements.find((e) => e.id === id);
          if (mark?.type === 'mark') mark.point = { x: Math.round(p.x), y: Math.round(p.y) };
        },
        `point-${d.seq}`,
        true,
      );
      return;
    }
    const snapping = !event.altKey;
    const threshold = 8 / scale;
    const { starts, ends } = columnEdges(theme);
    const xTargets = [...starts, ...ends];
    const yTargets = [theme.grid.marginTop, STAGE.height - theme.grid.marginBottom];
    const nextGuides: { x?: number; y?: number } = {};

    if (d.kind === 'move') {
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      if (snapping) {
        const boxes = [...d.boxes.values()];
        const left = Math.min(...boxes.map((b) => b.x)) + dx;
        const right = Math.max(...boxes.map((b) => b.x + b.w)) + dx;
        const top = Math.min(...boxes.map((b) => b.y)) + dy;
        const bottom = Math.max(...boxes.map((b) => b.y + b.h)) + dy;
        const sl = snapValue(left, starts, threshold);
        const sr = snapValue(right, ends, threshold);
        const sc = snapValue((left + right) / 2, [STAGE.width / 2], threshold);
        if (sl !== null) {
          dx += sl - left;
          nextGuides.x = sl;
        } else if (sr !== null) {
          dx += sr - right;
          nextGuides.x = sr;
        } else if (sc !== null) {
          dx += sc - (left + right) / 2;
          nextGuides.x = sc;
        }
        const st = snapValue(top, yTargets, threshold);
        const sb = snapValue(bottom, yTargets, threshold);
        if (st !== null) {
          dy += st - top;
          nextGuides.y = st;
        } else if (sb !== null) {
          dy += sb - bottom;
          nextGuides.y = sb;
        }
      }
      const boxes = new Map<string, Box>();
      for (const [id, box] of d.boxes) {
        boxes.set(id, { ...box, x: Math.round(box.x + dx), y: Math.round(box.y + dy) });
      }
      place(d, boxes);
    } else if (d.kind === 'resize-many' && d.handle && 'hx' in d.handle && d.frame) {
      const { hx, hy } = d.handle;
      const from = d.frame;
      let w = Math.max(16, from.w + hx * dx);
      let h = Math.max(16, from.h + hy * dy);
      // With pictures or video among them, the corners keep the proportions; Shift turns it around.
      const proportional = [...d.boxes.keys()].some((id) => {
        const type = scene.elements.find((e) => e.id === id)?.type;
        return type === 'image' || type === 'video';
      });
      if (hx !== 0 && hy !== 0 && proportional !== event.shiftKey) {
        const k = Math.max(w / from.w, h / from.h);
        w = from.w * k;
        h = from.h * k;
      }
      // The opposite side stays where it is.
      const to: Box = {
        x: hx < 0 ? from.x + from.w - w : from.x,
        y: hy < 0 ? from.y + from.h - h : from.y,
        w,
        h,
        rotation: 0,
      };
      const boxes = new Map<string, Box>();
      for (const [id, box] of d.boxes) boxes.set(id, scaleInto(box, from, to));
      place(d, boxes);
    } else if (d.kind === 'resize' && d.handle && 'hx' in d.handle) {
      const [id, box] = [...d.boxes.entries()][0]!;
      const el = scene.elements.find((e) => e.id === id);
      const { hx, hy } = d.handle;
      const local = rotate({ x: dx, y: dy }, -box.rotation);
      let w = Math.max(8, box.w + hx * local.x);
      let h = Math.max(8, box.h + hy * local.y);
      // Images and video keep their proportions on the corners; Shift turns it around.
      const proportional = el?.type === 'image' || el?.type === 'video';
      if (hx !== 0 && hy !== 0 && proportional !== event.shiftKey) {
        const k = Math.max(w / box.w, h / box.h);
        w = box.w * k;
        h = box.h * k;
      } else if (snapping && box.rotation === 0) {
        if (hx !== 0) {
          const edge = hx > 0 ? box.x + w : box.x + box.w - w;
          const snapped = snapValue(edge, xTargets, threshold);
          if (snapped !== null) {
            w = hx > 0 ? snapped - box.x : box.x + box.w - snapped;
            nextGuides.x = snapped;
          }
        }
        if (hy !== 0) {
          const edge = hy > 0 ? box.y + h : box.y + box.h - h;
          const snapped = snapValue(edge, yTargets, threshold);
          if (snapped !== null) {
            h = hy > 0 ? snapped - box.y : box.y + box.h - snapped;
            nextGuides.y = snapped;
          }
        }
        w = Math.max(8, w);
        h = Math.max(8, h);
      }
      // The opposite handle stays where it is.
      const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
      const anchorOffset = rotate({ x: (-hx * box.w) / 2, y: (-hy * box.h) / 2 }, box.rotation);
      const anchor = { x: centre.x + anchorOffset.x, y: centre.y + anchorOffset.y };
      const centreOffset = rotate({ x: (hx * w) / 2, y: (hy * h) / 2 }, box.rotation);
      const next = {
        x: Math.round(anchor.x + centreOffset.x - w / 2),
        y: Math.round(anchor.y + centreOffset.y - h / 2),
        w: Math.round(w),
        h: Math.round(h),
        rotation: box.rotation,
      };
      place(d, new Map([[id, next]]));
    } else if (d.kind === 'endpoint' && d.handle && 'end' in d.handle) {
      const id = [...d.boxes.keys()][0]!;
      const el = scene.elements.find((e) => e.id === id);
      if (!el) return;
      const ends2 = lineEnds(el);
      const fixed = d.handle.end === 'start' ? ends2.end : ends2.start;
      let moving = { x: p.x, y: p.y };
      if (event.shiftKey) {
        // Hold Shift for horizontal, vertical or 45 degrees.
        const ddx = moving.x - fixed.x;
        const ddy = moving.y - fixed.y;
        if (Math.abs(ddx) > 2 * Math.abs(ddy)) moving.y = fixed.y;
        else if (Math.abs(ddy) > 2 * Math.abs(ddx)) moving.x = fixed.x;
        else {
          const m = Math.max(Math.abs(ddx), Math.abs(ddy));
          moving = { x: fixed.x + Math.sign(ddx) * m, y: fixed.y + Math.sign(ddy) * m };
        }
      }
      const which = d.handle.end;
      const start = which === 'start' ? moving : fixed;
      const end = which === 'start' ? fixed : moving;
      const fasten = !event.altKey;
      useStore.getState().updateScene(
        (s) => {
          const target = s.elements.find((e) => e.id === id);
          if (!target || target.type !== 'shape') return;
          // An end that is let go on an element is fastened to it, and follows it from then on.
          const under = fasten ? fastenTargetAt(s, moving, id) : undefined;
          const other = which === 'start' ? target.endAt : target.startAt;
          const key = which === 'start' ? 'startAt' : 'endAt';
          if (under && under.id !== other) target[key] = under.id;
          else delete target[key];
          target.box = {
            x: Math.round(Math.min(start.x, end.x)),
            y: Math.round(Math.min(start.y, end.y)),
            w: Math.max(1, Math.round(Math.abs(end.x - start.x))),
            h: Math.max(1, Math.round(Math.abs(end.y - start.y))),
            rotation: 0,
          };
          target.flipH = start.x > end.x;
          target.flipV = start.y > end.y;
        },
        `endpoint-${d.seq}`,
        true,
      );
    }
    setGuides(nextGuides);
  }

  function onPointerUp(): void {
    const d = drag.current;
    drag.current = null;
    setGuides({});
    if (d && !d.moved && d.enter) useStore.getState().select([d.enter]);
    if (!d || !d.moved || d.kind === 'endpoint' || d.kind === 'point') {
      setTransient(null);
      return;
    }
    const boxes = transient;
    setTransient(null);
    if (!boxes) return;
    useStore.getState().updateScene((s) => {
      for (const [id, box] of boxes) {
        const el = s.elements.find((e) => e.id === id);
        if (el) el.box = box;
      }
      // A line that was dragged away by itself is no longer fastened.
      if (d.kind === 'move') letGoMoved(s, [...boxes.keys()]);
    });
  }

  /** Right-click: a short menu for the element under the pointer. */
  function onContextMenu(event: React.MouseEvent<HTMLDivElement>): void {
    if (!scene) return;
    const state = useStore.getState();
    if (state.editing) return; // the text being edited keeps the system's own menu
    event.preventDefault();
    const p = toStage(event);
    let hit: Element | undefined;
    for (let i = scene.elements.length - 1; i >= 0; i--) {
      if (hits(scene.elements[i]!, p, 10 / scale)) {
        hit = scene.elements[i];
        break;
      }
    }
    if (!hit) {
      setMenu(null);
      return;
    }
    if (!state.selection.includes(hit.id)) state.select([hit.id]);
    setMenu({ x: event.clientX, y: event.clientY, id: hit.id });
  }

  function onDoubleClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (!scene) return;
    const state = useStore.getState();
    if (state.editing) return;
    const p = toStage(event);
    let hit: Element | undefined;
    for (let i = scene.elements.length - 1; i >= 0; i--) {
      if (hits(scene.elements[i]!, p, 10 / scale)) {
        hit = scene.elements[i];
        break;
      }
    }
    if (!hit) return;
    startEditing(hit, event);
  }

  function startEditing(el: Element, at?: { clientX: number; clientY: number }): void {
    const state = useStore.getState();
    if (el.type === 'text') {
      state.setEditing({ elementId: el.id });
    } else if (el.type === 'shape' && !isLine(el)) {
      if (!el.content) {
        state.updateScene((s) => {
          const target = s.elements.find((e) => e.id === el.id);
          if (target?.type === 'shape') target.content = richText();
        });
      }
      state.setEditing({ elementId: el.id });
    } else if (el.type === 'table') {
      let cell = '0:0';
      if (at) {
        const under = document
          .elementFromPoint(at.clientX, at.clientY)
          ?.closest<HTMLElement>('[data-cell]');
        if (under?.dataset.cell) cell = under.dataset.cell;
      }
      state.setEditing({ elementId: el.id, cell });
    }
  }

  // ---------- Keyboard, copy and paste ----------
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const state = useStore.getState();
    if (state.editing || !scene) return;
    const selected = scene.elements.filter((e) => state.selection.includes(e.id));
    const step = event.shiftKey ? 20 : 2;
    const nudge = (dx: number, dy: number): void => {
      if (selected.length === 0) return;
      state.updateScene((s) => {
        for (const el of s.elements) {
          if (state.selection.includes(el.id)) {
            el.box.x += dx;
            el.box.y += dy;
          }
        }
        letGoMoved(s, state.selection);
      }, 'nudge');
    };
    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        if (selected.length) state.updateScene((s) => deleteElements(s, state.selection));
        break;
      case 'ArrowLeft':
        nudge(-step, 0);
        break;
      case 'ArrowRight':
        nudge(step, 0);
        break;
      case 'ArrowUp':
        nudge(0, -step);
        break;
      case 'ArrowDown':
        nudge(0, step);
        break;
      case 'Escape':
        state.select([]);
        break;
      case 'Enter':
      case 'F2':
        if (selected.length === 1) startEditing(selected[0]!);
        break;
      case 'a':
        if (!(event.ctrlKey || event.metaKey)) return;
        state.select(scene.elements.map((e) => e.id));
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function onCopy(event: React.ClipboardEvent, cut: boolean): void {
    const state = useStore.getState();
    if (state.editing || !scene || state.selection.length === 0) return;
    state.setClipboard(scene.elements.filter((e) => state.selection.includes(e.id)));
    if (cut) state.updateScene((s) => deleteElements(s, state.selection));
    event.preventDefault();
  }

  function onPaste(event: React.ClipboardEvent): void {
    const state = useStore.getState();
    if (state.editing || !scene || state.clipboard.length === 0) return;
    const copies = cloneElements(state.clipboard, 24);
    state.updateScene((s) => {
      s.elements.push(...copies);
    });
    state.select(copies.map((c) => c.id));
    event.preventDefault();
  }

  // Leave text editing when the scene loses the element (undo, scene change).
  useEffect(() => {
    if (editing && scene && !scene.elements.some((e) => e.id === editing.elementId)) {
      useStore.getState().setEditing(null);
    }
  }, [editing, scene]);

  if (!scene) {
    return (
      <div className="stage-area stage-empty" ref={area}>
        <p>
          Prosjektet har ingen lysark ennå. Legg til et lysark i lista til venstre, eller importer
          en PowerPoint-fil.
        </p>
      </div>
    );
  }

  const editingElement = editing
    ? scene.elements.find((e) => e.id === editing.elementId)
    : undefined;
  const editingAllowsBold =
    editingElement?.type !== 'text' || theme.roles[editingElement.role].font === 'body';
  const handleSize = 14 / scale;
  const border = 2 / scale;
  const { starts, ends } = columnEdges(theme);
  const single =
    selection.length === 1 ? scene.elements.find((e) => e.id === selection[0]) : undefined;

  const menuElement = menu ? scene.elements.find((e) => e.id === menu.id) : undefined;
  const selected = scene.elements.filter((e) => selection.includes(e.id));
  // Several chosen elements get one frame round them all, and change size as one.
  const many = selected.length > 1 && !editing ? resizable(selection) : [];
  const frame = many.length > 1 ? unionBox(many.map(boxOf)) : undefined;
  const framePictures = many.some((el) => el.type === 'image' || el.type === 'video');
  // What the one chosen line is fastened to is shown, so it is seen why the line follows it.
  const fastenedTo =
    single?.type === 'shape' && isLine(single) && !editing
      ? scene.elements.filter((e) => e.id === single.startAt || e.id === single.endAt)
      : [];

  return (
    <div className="stage-column">
      {menu && menuElement && (
        <div
          className="menu context-menu"
          role="menu"
          aria-label="Valg for elementet"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            autoFocus
            onClick={() => {
              setMenu(null);
              useStore.getState().openBuilder(menuElement.id);
            }}
          >
            {menuElement.type === 'deepdive'
              ? 'Bygg innholdet'
              : menuElement.more && menuElement.more.blocks.length > 0
                ? 'Rediger «Lær mer»'
                : 'Legg til «Lær mer»'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(null);
              const state = useStore.getState();
              const copies = cloneElements(
                scene.elements.filter((e) => state.selection.includes(e.id)),
                24,
              );
              state.updateScene((sc) => {
                sc.elements.push(...copies);
              });
              state.select(copies.map((c) => c.id));
            }}
          >
            Lag kopi
          </button>
          {canGroup(scene, selection) && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(null);
                const state = useStore.getState();
                let members: string[] = [];
                state.updateScene((sc) => {
                  members = groupElements(sc, state.selection, () => newId('g'));
                });
                if (members.length) state.select(members);
              }}
            >
              Grupper
            </button>
          )}
          {selected.some((el) => el.group) && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(null);
                const state = useStore.getState();
                state.updateScene((sc) => ungroupElements(sc, state.selection));
              }}
            >
              Del opp gruppen
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(null);
              const state = useStore.getState();
              state.updateScene((sc) => deleteElements(sc, state.selection));
            }}
          >
            Slett
          </button>
        </div>
      )}
      <TextToolbar
        editor={editor}
        state={editorState}
        allowBold={editingAllowsBold}
        onDone={() => useStore.getState().setEditing(null)}
      />
      <div
        className="stage-area"
        ref={area}
        tabIndex={0}
        aria-label="Lysark"
        onKeyDown={onKeyDown}
        onCopy={(e) => onCopy(e, false)}
        onCut={(e) => onCopy(e, true)}
        onPaste={onPaste}
      >
        <div
          className="stage-frame"
          style={{ width: STAGE.width * scale, height: STAGE.height * scale }}
        >
          <div
            className="stage-inner"
            ref={inner}
            style={{ width: STAGE.width, height: STAGE.height, transform: `scale(${scale})` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
          >
            <SceneView
              scene={scene}
              project={project}
              logo={logo}
              editingId={editing?.elementId ?? null}
              previewSteps={previewSteps}
            />
            <StageCamera scene={scene} />
            <div className={`stage-overlay${editing ? ' is-editing' : ''}`}>
              {showGrid && (
                <>
                  {starts.map((start, i) => (
                    <div
                      key={i}
                      className="grid-column"
                      style={{
                        left: start,
                        width: ends[i]! - start,
                        top: theme.grid.marginTop,
                        height: STAGE.height - theme.grid.marginTop - theme.grid.marginBottom,
                      }}
                    />
                  ))}
                </>
              )}
              {guides.x !== undefined && (
                <div
                  className="guide"
                  style={{ left: guides.x, top: 0, width: border, height: STAGE.height }}
                />
              )}
              {guides.y !== undefined && (
                <div
                  className="guide"
                  style={{ top: guides.y, left: 0, height: border, width: STAGE.width }}
                />
              )}
              {scene.elements.map((el) => {
                const index = stepOf(scene, el.id);
                if (index < 0) return null;
                const box = boxOf(el);
                const size = 30 / scale;
                return (
                  <div
                    key={`step-${el.id}`}
                    className="step-badge"
                    title={`Kommer inn i steg ${index + 1}`}
                    style={{
                      left: box.x - size * 0.8,
                      top: box.y - size * 0.8,
                      width: size,
                      height: size,
                      fontSize: size * 0.55,
                    }}
                  >
                    {index + 1}
                  </div>
                );
              })}
              {fastenedTo.map((el) => {
                const box = boxOf(el);
                return (
                  <div
                    key={`fastened-${el.id}`}
                    className="fasten-target"
                    style={{
                      left: box.x,
                      top: box.y,
                      width: box.w,
                      height: box.h,
                      outlineWidth: border,
                      outlineOffset: border * 2,
                      transform: box.rotation ? `rotate(${box.rotation}deg)` : undefined,
                    }}
                  />
                );
              })}
              {frame && (
                <div
                  className="selection selection-many"
                  style={{
                    left: frame.x,
                    top: frame.y,
                    width: frame.w,
                    height: frame.h,
                    outlineWidth: border,
                  }}
                >
                  {HANDLES.filter(
                    (handle) => !framePictures || (handle.hx !== 0 && handle.hy !== 0),
                  ).map((handle) => (
                    <div
                      key={`${handle.hx},${handle.hy}`}
                      className="handle"
                      data-handle={`m:${handle.hx},${handle.hy}`}
                      style={{
                        left: `calc(${((handle.hx + 1) / 2) * 100}% - ${handleSize / 2}px)`,
                        top: `calc(${((handle.hy + 1) / 2) * 100}% - ${handleSize / 2}px)`,
                        width: handleSize,
                        height: handleSize,
                        borderWidth: border,
                        cursor: handle.cursor,
                      }}
                    />
                  ))}
                </div>
              )}
              {scene.elements
                .filter((el) => selection.includes(el.id))
                .map((el) => {
                  const box = boxOf(el);
                  if (isLine(el)) {
                    const pts = lineEnds({ ...el, box } as Element);
                    const fastened = {
                      start: el.type === 'shape' && el.startAt !== undefined,
                      end: el.type === 'shape' && el.endAt !== undefined,
                    };
                    return (
                      <div key={el.id}>
                        {single &&
                          !editing &&
                          (['start', 'end'] as const).map((which) => (
                            <div
                              key={which}
                              className={`handle${fastened[which] ? ' handle-fastened' : ''}`}
                              title={
                                fastened[which]
                                  ? 'Enden er festet. Dra den bort for å løsne den.'
                                  : 'Dra enden inn på en boks for å feste den.'
                              }
                              data-handle={which}
                              style={{
                                left: pts[which].x - handleSize / 2,
                                top: pts[which].y - handleSize / 2,
                                width: handleSize,
                                height: handleSize,
                                borderWidth: border,
                                cursor: 'move',
                              }}
                            />
                          ))}
                      </div>
                    );
                  }
                  // A numbered mark has one size; a label has a handle on what it points at.
                  const numbered =
                    el.type === 'mark' && markStyle(pictureOf(scene, el)) === 'numbers';
                  const pointed = el.type === 'mark' && !numbered;
                  return (
                    <div
                      key={el.id}
                      className="selection"
                      style={{
                        left: box.x,
                        top: box.y,
                        width: box.w,
                        height: box.h,
                        outlineWidth: border,
                        transform: box.rotation ? `rotate(${box.rotation}deg)` : undefined,
                      }}
                    >
                      {single && !editing && pointed && el.type === 'mark' && (
                        <div
                          className="handle point-handle"
                          data-handle="point"
                          title="Dra for å flytte det merket peker på"
                          style={{
                            left: el.point.x - box.x - handleSize,
                            top: el.point.y - box.y - handleSize,
                            width: handleSize * 2,
                            height: handleSize * 2,
                            borderWidth: border,
                            cursor: 'move',
                          }}
                        />
                      )}
                      {single &&
                        !editing &&
                        !numbered &&
                        HANDLES.map((handle) => (
                          <div
                            key={`${handle.hx},${handle.hy}`}
                            className="handle"
                            data-handle={`${handle.hx},${handle.hy}`}
                            style={{
                              left: `calc(${((handle.hx + 1) / 2) * 100}% - ${handleSize / 2}px)`,
                              top: `calc(${((handle.hy + 1) / 2) * 100}% - ${handleSize / 2}px)`,
                              width: handleSize,
                              height: handleSize,
                              borderWidth: border,
                              cursor: handle.cursor,
                            }}
                          />
                        ))}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
