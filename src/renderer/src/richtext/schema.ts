// ProseMirror schema for the project format's RichText, and conversion in
// both directions. A paragraph carries its list kind and level as
// attributes, exactly like the format does.
import { Schema, type Mark, type Node as PMNode } from 'prosemirror-model';
import type { Paragraph, RichText, Run } from '../../../shared/format/schema';

export const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: {
      content: 'inline*',
      attrs: { level: { default: 0 }, list: { default: 'none' } },
      parseDOM: [
        { tag: 'p' },
        { tag: 'div' },
        { tag: 'li', getAttrs: () => ({ list: 'bullet' }) },
        { tag: 'h1' },
        { tag: 'h2' },
        { tag: 'h3' },
      ],
      toDOM(node) {
        const level = node.attrs.level as number;
        const list = node.attrs.list as string;
        return [
          'p',
          {
            class: list === 'none' ? 'ls-p' : 'ls-p ls-edit-li',
            'data-list': list,
            'data-level': String(level),
            style: level > 0 ? `margin-left:${level * 1.3}em` : '',
          },
          0,
        ];
      },
    },
    text: { group: 'inline' },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br'],
    },
  },
  marks: {
    strong: {
      parseDOM: [
        { tag: 'strong' },
        { tag: 'b' },
        {
          style: 'font-weight',
          getAttrs: (v) => (/^(bold|[6-9]00)$/.test(v as string) ? null : false),
        },
      ],
      toDOM: () => ['strong', 0],
    },
    em: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }],
      toDOM: () => ['em', 0],
    },
    highlight: {
      parseDOM: [{ tag: 'mark' }],
      toDOM: () => ['mark', { class: 'ls-mark' }, 0],
    },
    link: {
      attrs: { href: {} },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: (dom) => {
            const href = (dom as HTMLElement).getAttribute('href') ?? '';
            return /^(https?:|mailto:)/i.test(href) ? { href } : false;
          },
        },
      ],
      toDOM: (mark) => ['span', { class: 'ls-link', title: mark.attrs.href as string }, 0],
    },
  },
});

export function richTextToDoc(rt: RichText): PMNode {
  const paragraphs = rt.paragraphs.length ? rt.paragraphs : [{ level: 0, list: 'none', runs: [] }];
  return schema.node(
    'doc',
    null,
    paragraphs.map((p) => {
      const content: PMNode[] = [];
      for (const run of p.runs) {
        const marks: Mark[] = [];
        if (run.bold) marks.push(schema.marks.strong!.create());
        if (run.italic) marks.push(schema.marks.em!.create());
        if (run.mark) marks.push(schema.marks.highlight!.create());
        if (run.link) marks.push(schema.marks.link!.create({ href: run.link }));
        run.text.split('\n').forEach((part, i) => {
          if (i > 0) content.push(schema.nodes.hard_break!.create(null, null, marks));
          if (part) content.push(schema.text(part, marks));
        });
      }
      return schema.node('paragraph', { level: p.level, list: p.list }, content);
    }),
  );
}

function sameFormat(a: Run, b: Run): boolean {
  return (
    !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.mark === !!b.mark && a.link === b.link
  );
}

export function docToRichText(doc: PMNode): RichText {
  const paragraphs: Paragraph[] = [];
  doc.forEach((node) => {
    const runs: Run[] = [];
    node.forEach((child) => {
      const run: Run = { text: child.isText ? (child.text ?? '') : '\n' };
      for (const mark of child.marks) {
        if (mark.type === schema.marks.strong) run.bold = true;
        else if (mark.type === schema.marks.em) run.italic = true;
        else if (mark.type === schema.marks.highlight) run.mark = true;
        else if (mark.type === schema.marks.link) run.link = mark.attrs.href as string;
      }
      const last = runs[runs.length - 1];
      if (last && sameFormat(last, run)) last.text += run.text;
      else runs.push(run);
    });
    const level = Math.max(0, Math.min(4, Number(node.attrs.level) || 0));
    const list =
      node.attrs.list === 'bullet' || node.attrs.list === 'number' ? node.attrs.list : 'none';
    paragraphs.push({ level, list, runs });
  });
  return { paragraphs };
}
