// A rich text field for the side panel (the body of a "Lær mer" box).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EditorState } from 'prosemirror-state';
import type { RichText } from '../../shared/format/schema';
import { TextToolbar } from './TextToolbar';
import { createTextEditor, type TextEditor } from './richtext/editor';
import { richTextToDoc } from './richtext/schema';

interface Props {
  value: RichText;
  onChange: (value: RichText) => void;
  label: string;
}

export function RichTextField({ value, onChange, label }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const editor = useRef<TextEditor | null>(null);
  const emitted = useRef<RichText>(value);
  const change = useRef(onChange);
  change.current = onChange;
  const [state, setState] = useState<EditorState | null>(null);

  useLayoutEffect(() => {
    if (!mount.current) return;
    const instance = createTextEditor({
      mount: mount.current,
      content: emitted.current,
      allowBold: true,
      onState: setState,
      onChange: (next) => {
        emitted.current = next;
        change.current(next);
      },
    });
    instance.view.dom.setAttribute('aria-label', label);
    editor.current = instance;
    return () => {
      instance.destroy();
      editor.current = null;
    };
  }, [label]);

  // Follow changes that did not come from typing here (undo, another element).
  useEffect(() => {
    const instance = editor.current;
    if (!instance || value === emitted.current) return;
    emitted.current = value;
    const next = EditorState.create({
      doc: richTextToDoc(value),
      plugins: instance.view.state.plugins,
    });
    instance.view.updateState(next);
    setState(next);
  }, [value]);

  return (
    <div className="rich-field">
      <TextToolbar editor={editor} state={state} />
      <div ref={mount} className="rich-field-text" />
    </div>
  );
}
