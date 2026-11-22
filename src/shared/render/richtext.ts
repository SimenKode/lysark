// Turns RichText into DOM. Built with createElement and textContent only,
// never innerHTML, so content can never inject markup or script.
import type { Paragraph, RichText, Run } from '../format/schema';

export interface RichTextOptions {
  doc: Document;
  /** Font size factor per list level. */
  levelScale: number[];
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

function fillParagraph(el: HTMLElement, p: Paragraph, o: RichTextOptions): void {
  if (p.runs.every((r) => r.text === '')) {
    el.appendChild(o.doc.createElement('br'));
    return;
  }
  for (const run of p.runs) el.appendChild(renderRun(run, o));
}

function levelStyle(el: HTMLElement, p: Paragraph, o: RichTextOptions): void {
  const scale = o.levelScale[p.level] ?? 1;
  if (scale !== 1) el.style.fontSize = `${scale}em`;
  if (p.level > 0) el.style.marginLeft = `${(p.level * 1.3) / scale}em`;
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
    if (p.list === 'none') {
      list = undefined;
      listKind = 'none';
      counters.fill(0);
      const el = doc.createElement('p');
      el.className = 'ls-p';
      levelStyle(el, p, o);
      fillParagraph(el, p, o);
      out.appendChild(el);
      continue;
    }
    if (!list || listKind !== p.list) {
      list = doc.createElement(p.list === 'number' ? 'ol' : 'ul');
      list.className = 'ls-list';
      list.setAttribute('role', 'list');
      listKind = p.list;
      counters.fill(0);
      out.appendChild(list);
    }
    const li = doc.createElement('li');
    li.className = 'ls-li';
    levelStyle(li, p, o);
    const marker = doc.createElement('span');
    marker.className = 'ls-marker';
    marker.setAttribute('aria-hidden', 'true');
    if (p.list === 'number') {
      counters[p.level] = (counters[p.level] ?? 0) + 1;
      for (let i = p.level + 1; i < counters.length; i++) counters[i] = 0;
      marker.textContent = `${counters[p.level]}.`;
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
