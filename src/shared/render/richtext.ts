// Turns RichText into DOM. Built with createElement and textContent only,
// never innerHTML, so content can never inject markup or script.
import type { Paragraph, RichText, Run } from '../format/schema';

export interface RichTextOptions {
  doc: Document;
  /** Font size factor per list level. */
  levelScale: readonly number[];
  /**
   * Space above a paragraph of each list level, as a factor of the text's
   * font size. When given it replaces the theme's spacing between
   * paragraphs; the first paragraph has none.
   */
  spaceBefore?: readonly number[];
  /**
   * Indents of each list level as factors of the text's font size: where
   * the first line or its bullet starts, and where the text starts. When
   * given they replace the theme's indents.
   */
  indent?: ReadonlyArray<{ start: number; text: number }>;
  /** When false, links are drawn but cannot be followed (the editor). */
  interactive: boolean;
}

const SAFE_EXTERNAL = /^(https?:|mailto:)/i;
const SCENE_LINK = /^#scene:(.+)$/;

/** Returns a link the player may follow, or undefined when it is not allowed. */
export function classifyLink(
  link: string,
): { kind: 'external'; href: string } | { kind: 'scene'; sceneId: string } | undefined {
  const scene = SCENE_LINK.exec(link);
  if (scene) return { kind: 'scene', sceneId: scene[1]! };
  if (SAFE_EXTERNAL.test(link.trim())) return { kind: 'external', href: link.trim() };
  return undefined;
}

function renderRun(run: Run, o: RichTextOptions): Node {
  const { doc } = o;
  let node: Node = doc.createDocumentFragment();
  const lines = run.text.split('\n');
  lines.forEach((line, i) => {
    if (i > 0) node.appendChild(doc.createElement('br'));
    if (line) node.appendChild(doc.createTextNode(line));
  });
  const wrap = (tag: string, className?: string): void => {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    el.appendChild(node);
    node = el;
  };
  if (run.script) wrap(run.script === 'sub' ? 'sub' : 'sup');
  if (run.italic) wrap('em');
  if (run.bold) wrap('strong');
  if (run.mark) wrap('mark', 'ls-mark');
  if (run.link) {
    const target = classifyLink(run.link);
    if (target && o.interactive) {
      const a = doc.createElement('a');
      a.className = 'ls-link';
      if (target.kind === 'external') {
        a.href = target.href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      } else {
        a.href = '#';
        a.dataset.scene = target.sceneId;
      }
      a.appendChild(node);
      node = a;
    } else if (target) {
      wrap('span', 'ls-link');
    }
  }
  return node;
}

function roman(n: number): string {
  const parts: Array<[number, string]> = [
    [1000, 'm'],
    [900, 'cm'],
    [500, 'd'],
    [400, 'cd'],
    [100, 'c'],
    [90, 'xc'],
    [50, 'l'],
    [40, 'xl'],
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ];
  let out = '';
  let rest = n;
  for (const [value, letters] of parts) {
    while (rest >= value) {
      out += letters;
      rest -= value;
    }
  }
  return out;
}

function letters(n: number): string {
  let out = '';
  let rest = n;
  while (rest > 0) {
    rest -= 1;
    out = String.fromCharCode(97 + (rest % 26)) + out;
    rest = Math.floor(rest / 26);
  }
  return out;
}

/** The marker of the n-th item (from 1) in a numbered list of a style ("1." when undefined). */
export function numberMarker(n: number, style: Paragraph['numberStyle']): string {
  const suffix = style?.endsWith(')') ? ')' : '.';
  const kind = style?.[0] ?? '1';
  const body =
    kind === 'a'
      ? letters(n)
      : kind === 'A'
        ? letters(n).toUpperCase()
        : kind === 'i'
          ? roman(n)
          : kind === 'I'
            ? roman(n).toUpperCase()
            : String(n);
  return body + suffix;
}

function fillParagraph(el: HTMLElement, p: Paragraph, o: RichTextOptions): void {
  if (p.runs.every((r) => r.text === '')) {
    el.appendChild(o.doc.createElement('br'));
    return;
  }
  for (const run of p.runs) el.appendChild(renderRun(run, o));
}

const em = (value: number): string => `${Math.round(value * 1000) / 1000}em`;

function levelStyle(el: HTMLElement, p: Paragraph, o: RichTextOptions, first: boolean): void {
  const scale = o.levelScale[p.level] ?? 1;
  if (scale !== 1) el.style.fontSize = `${scale}em`;
  const indent = o.indent?.[p.level];
  if (indent && p.list !== 'none') {
    // The bullet starts at `start`; the text, also on wrapped lines, at `text`.
    el.style.marginLeft = em(indent.start / scale);
  } else if (indent) {
    el.style.paddingLeft = em(indent.text / scale);
    el.style.textIndent = em((indent.start - indent.text) / scale);
  } else if (p.level > 0) {
    el.style.marginLeft = `${(p.level * 1.3) / scale}em`;
  }
  if (o.spaceBefore) {
    // In the paragraph's own em, which the level scale has changed.
    const space = first ? 0 : (o.spaceBefore[p.level] ?? 0) / scale;
    el.style.marginTop = `${Math.round(space * 1000) / 1000}em`;
  }
}

/**
 * Renders paragraphs. Consecutive list paragraphs of the same kind become
 * one list so that screen readers announce it as a list; nesting is shown
 * by indentation. Numbers are computed here, per level.
 */
export function renderRichText(rt: RichText, o: RichTextOptions): DocumentFragment {
  const { doc } = o;
  const out = doc.createDocumentFragment();
  let list: HTMLElement | undefined;
  let listKind: Paragraph['list'] = 'none';
  const counters: number[] = [0, 0, 0, 0, 0];

  for (const p of rt.paragraphs) {
    // Deeper levels start counting again under each item; a numbered list
    // goes on counting past items at deeper levels, as in PowerPoint.
    for (let i = p.level + 1; i < counters.length; i++) counters[i] = 0;
    if (p.list !== 'number') counters[p.level] = 0;
    if (p.list === 'none') {
      list = undefined;
      listKind = 'none';
      if (p.level === 0) counters.fill(0);
      const el = doc.createElement('p');
      el.className = 'ls-p';
      levelStyle(el, p, o, out.childNodes.length === 0);
      fillParagraph(el, p, o);
      out.appendChild(el);
      continue;
    }
    if (!list || listKind !== p.list) {
      list = doc.createElement(p.list === 'number' ? 'ol' : 'ul');
      list.className = 'ls-list';
      list.setAttribute('role', 'list');
      // With imported spacing the items carry all of it.
      if (o.spaceBefore) list.style.marginTop = '0';
      listKind = p.list;
      out.appendChild(list);
    }
    const li = doc.createElement('li');
    li.className = 'ls-li';
    levelStyle(li, p, o, out.childNodes.length === 1 && list.childNodes.length === 0);
    const marker = doc.createElement('span');
    marker.className = 'ls-marker';
    marker.setAttribute('aria-hidden', 'true');
    const indent = o.indent?.[p.level];
    if (indent) {
      // The marker fills the room between bullet and text, at least half a letter.
      const scale = o.levelScale[p.level] ?? 1;
      li.style.gap = '0';
      marker.style.minWidth = '0';
      marker.style.width = em(Math.max(0.5, indent.text - indent.start) / scale);
    }
    if (p.list === 'number') {
      counters[p.level] = (counters[p.level] ?? 0) + 1;
      marker.textContent = numberMarker(counters[p.level]!, p.numberStyle);
      li.value = counters[p.level]!;
    } else {
      marker.classList.add('ls-bullet');
    }
    const body = doc.createElement('span');
    body.className = 'ls-li-body';
    fillParagraph(body, p, o);
    li.append(marker, body);
    list.appendChild(li);
  }
  return out;
}
