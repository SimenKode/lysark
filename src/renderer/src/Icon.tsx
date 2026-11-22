// The program's own icons: plain line drawings made for Lysark, so that no
// icon library has to be taken in. An icon never stands alone without a
// name: a button that shows only an icon carries its name for screen
// readers and as a tooltip.
//
// Where an icon is used and where it is not (the owner asked for this to be
// thought through, 22.11.2026):
// - Icon only, for the few things everyone knows by their sign and uses all
//   the time: undo, redo, move up and down, copy, delete.
// - Icon and text, for the actions one looks for: open and import, save,
//   preview, export, insert, record, play.
// - Text only, for choices inside a dialog and for tools whose meaning no
//   sign carries (cutting sound, pauses, "Ferdig", "Lukk", "Avbryt").
const PATHS = {
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  save: 'M5 3h11l3 3v15H5zM8 3v6h7V3M8 21v-7h8v7',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  export: 'M12 15V3M8 7l4-4 4 4M5 12v8h14v-8',
  film: 'M3 5h18v14H3zM10 9l5 3-5 3z',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  plus: 'M12 5v14M5 12h14',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  text: 'M5 6h14M12 6v13M9 19h6',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9.5h.01',
  shape: 'M3 12h9v9H3zM21 8.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6',
  play: 'M7 4l13 8-13 8z',
  stop: 'M6 6h12v12H6z',
  import: 'M12 3v12M8 11l4 4 4-4M5 15v5h14v-5',
  folder: 'M3 6h7l2 3h9v10H3z',
  newFile: 'M6 3h8l4 4v14H6zM14 3v4h4M12 11v6M9 14h6',
  pdf: 'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6',
  slides: 'M3 5h18v11H3zM12 16v4M8 20h8',
  grid: 'M4 4h16v16H4zM4 12h16M12 4v16',
  pencil: 'M4 20l1-5L16 4l4 4L9 19zM14 6l4 4',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
