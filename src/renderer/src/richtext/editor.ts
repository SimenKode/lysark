// Creates a ProseMirror editor for RichText, with the keys and commands
// the text toolbar uses.
import { baseKeymap, chainCommands, splitBlockAs, toggleMark } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import type { MarkType } from 'prosemirror-model';
import { EditorState, type Command, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { RichText } from '../../../shared/format/schema';
import { docToRichText, richTextToDoc, schema } from './schema';

export type ListKind = 'none' | 'bullet' | 'number';

/** Applies a change to the attributes of every paragraph in the selection. */
function updateParagraphs(
  change: (attrs: { level: number; list: ListKind }) => { level: number; list: ListKind } | null,
): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    let tr: Transaction | null = null;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type !== schema.nodes.paragraph) return true;
      const next = change(node.attrs as { level: number; list: ListKind });
      if (next) {
        tr = (tr ?? state.tr).setNodeMarkup(pos, undefined, next);
      }
      return false;
    });
    if (!tr) return false;
    dispatch?.(tr);
    return true;
  };
}

export const indent = updateParagraphs((a) => (a.level < 4 ? { ...a, level: a.level + 1 } : null));
export const outdent = updateParagraphs((a) => (a.level > 0 ? { ...a, level: a.level - 1 } : null));

export function setList(kind: ListKind): Command {
  return (state, dispatch) => {
    const current = state.selection.$from.parent.attrs.list as ListKind;
    const target = current === kind ? 'none' : kind;
    return updateParagraphs((a) => ({ ...a, list: target }))(state, dispatch);
  };
}

/** Backspace at the start of a list paragraph first removes the list, then the level. */
const backspaceAtStart: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parentOffset !== 0) return false;
  const attrs = $from.parent.attrs as { level: number; list: ListKind };
  if (attrs.list !== 'none')
    return updateParagraphs((a) => ({ ...a, list: 'none' }))(state, dispatch);
  if (attrs.level > 0) return outdent(state, dispatch);
  return false;
};

const insertBreak: Command = (state, dispatch) => {
  dispatch?.(state.tr.replaceSelectionWith(schema.nodes.hard_break!.create()).scrollIntoView());
  return true;
};

export function setLink(href: string | null): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;
    const type = schema.marks.link!;
    const tr = state.tr.removeMark(from, to, type);
    if (href) tr.addMark(from, to, type.create({ href }));
    dispatch?.(tr);
    return true;
  };
}

export function markActive(state: EditorState, type: MarkType): boolean {
  const { from, $from, to, empty } = state.selection;
  if (empty) return !!type.isInSet(state.storedMarks ?? $from.marks());
  return state.doc.rangeHasMark(from, to, type);
}

export function currentLink(state: EditorState): string | null {
  const { $from, from, to } = state.selection;
  let href: string | null = null;
  const pick = (marks: readonly { type: MarkType; attrs: Record<string, unknown> }[]): void => {
    const link = marks.find((m) => m.type === schema.marks.link);
    if (link) href = link.attrs.href as string;
  };
  pick($from.marks());
  state.doc.nodesBetween(from, to, (node) => pick(node.marks));
  return href;
}

export interface TextEditor {
  view: EditorView;
  getContent(): RichText;
  run(command: Command): void;
  destroy(): void;
}

export interface TextEditorOptions {
  mount: HTMLElement;
  content: RichText;
  /** Bold is not offered for the serif title font (brand manual). */
  allowBold: boolean;
  onChange?: (content: RichText) => void;
  onState?: (state: EditorState) => void;
  onEscape?: () => void;
}

export function createTextEditor(options: TextEditorOptions): TextEditor {
  const keys: Record<string, Command> = {
    'Mod-z': undo,
    'Mod-y': redo,
    'Shift-Mod-z': redo,
    'Mod-i': toggleMark(schema.marks.em!),
    'Shift-Mod-h': toggleMark(schema.marks.highlight!),
    Enter: splitBlockAs((node) => ({ type: node.type, attrs: node.attrs })),
    'Shift-Enter': insertBreak,
    Tab: indent,
    'Shift-Tab': outdent,
    Backspace: chainCommands(backspaceAtStart, baseKeymap.Backspace!),
    Escape: () => {
      options.onEscape?.();
      return true;
    },
  };
  if (options.allowBold) keys['Mod-b'] = toggleMark(schema.marks.strong!);

  const state = EditorState.create({
    doc: richTextToDoc(options.content),
    plugins: [history(), keymap(keys), keymap(baseKeymap)],
  });
  const view = new EditorView(options.mount, {
    state,
    dispatchTransaction(tr) {
      const next = view.state.apply(tr);
      view.updateState(next);
      if (tr.docChanged) options.onChange?.(docToRichText(next.doc));
      options.onState?.(next);
    },
  });
  options.onState?.(state);

  return {
    view,
    getContent: () => docToRichText(view.state.doc),
    run: (command) => {
      command(view.state, view.dispatch);
      view.focus();
    },
    destroy: () => view.destroy(),
  };
}

export { schema, toggleMark, undo, redo };
