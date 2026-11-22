// Formatting buttons for the text that is being edited.
import { useState, type RefObject } from 'react';
import type { EditorState } from 'prosemirror-state';
import {
  currentLink,
  indent,
  markActive,
  outdent,
  schema,
  setLink,
  setList,
  toggleMark,
  type TextEditor,
} from './richtext/editor';

interface Props {
  editor: RefObject<TextEditor | null>;
  state: EditorState | null;
  /** Shown on the stage; the panel editors always show their toolbar. */
  onDone?: () => void;
  allowBold?: boolean;
}

export function TextToolbar({ editor, state, onDone, allowBold = true }: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState('');

  if (!state) {
    return (
      <div className="text-toolbar is-idle" aria-hidden="true">
        <span>Dobbeltklikk på en tekst for å redigere den</span>
      </div>
    );
  }

  const run = (command: Parameters<TextEditor['run']>[0]) => (event: React.MouseEvent) => {
    event.preventDefault(); // keep the selection in the text
    editor.current?.run(command);
  };
  const list = state.selection.$from.parent.attrs.list as string;
  const link = currentLink(state);
  const hasSelection = !state.selection.empty;

  const openLink = (event: React.MouseEvent): void => {
    event.preventDefault();
    setHref(link ?? 'https://');
    setLinkOpen(true);
  };
  const applyLink = (value: string | null): void => {
    const clean = value?.trim();
    const ok = clean && /^(https?:\/\/|mailto:)/i.test(clean) ? clean : null;
    editor.current?.run(setLink(ok));
    setLinkOpen(false);
  };

  return (
    <div className="text-toolbar" role="toolbar" aria-label="Tekstformat">
      {allowBold && (
        <button
          type="button"
          className="tool"
          aria-pressed={markActive(state, schema.marks.strong!)}
          title="Fet (Ctrl+B)"
          onMouseDown={run(toggleMark(schema.marks.strong!))}
        >
          <strong>F</strong>
        </button>
      )}
      <button
        type="button"
        className="tool"
        aria-pressed={markActive(state, schema.marks.em!)}
        title="Kursiv (Ctrl+I)"
        onMouseDown={run(toggleMark(schema.marks.em!))}
      >
        <em>K</em>
      </button>
      <button
        type="button"
        className="tool"
        aria-pressed={markActive(state, schema.marks.highlight!)}
        title="Tekstmarkering (Ctrl+Shift+H). Brukes på deler av løpende tekst."
        onMouseDown={run(toggleMark(schema.marks.highlight!))}
      >
        <mark className="tool-mark">Markering</mark>
      </button>
      <button
        type="button"
        className="tool"
        aria-pressed={!!link}
        disabled={!hasSelection && !link}
        title="Lenke (merk teksten først)"
        onMouseDown={openLink}
      >
        Lenke
      </button>
      <span className="tool-gap" />
      <button
        type="button"
        className="tool"
        aria-pressed={list === 'bullet'}
        title="Punktliste"
        onMouseDown={run(setList('bullet'))}
      >
        • Liste
      </button>
      <button
        type="button"
        className="tool"
        aria-pressed={list === 'number'}
        title="Nummerert liste"
        onMouseDown={run(setList('number'))}
      >
        1. Liste
      </button>
      <button type="button" className="tool" title="Nivå ut (Shift+Tab)" onMouseDown={run(outdent)}>
        ← Nivå
      </button>
      <button type="button" className="tool" title="Nivå inn (Tab)" onMouseDown={run(indent)}>
        Nivå →
      </button>
      {onDone && (
        <>
          <span className="tool-gap" />
          <button type="button" className="tool tool-strong" onClick={onDone}>
            Ferdig
          </button>
        </>
      )}
      {linkOpen && (
        <form
          className="link-form"
          onSubmit={(event) => {
            event.preventDefault();
            applyLink(href);
          }}
        >
          <label>
            Adresse
            <input
              autoFocus
              type="text"
              value={href}
              onChange={(event) => setHref(event.target.value)}
              placeholder="https://"
            />
          </label>
          <button type="submit" className="tool tool-strong">
            Bruk
          </button>
          {link && (
            <button type="button" className="tool" onClick={() => applyLink(null)}>
              Fjern lenke
            </button>
          )}
          <button type="button" className="tool" onClick={() => setLinkOpen(false)}>
            Avbryt
          </button>
        </form>
      )}
    </div>
  );
}
