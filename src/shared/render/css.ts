// Styles for a rendered scene. The same string is used by the editor and
// is written into every exported HTML file.
import { STAGE } from '../format/constants';

/** PowerPoint's default tab stop, one inch, in stage pixels (1920 px = 13.33 in). */
const TAB_STOP = 144;

export const STAGE_CSS = `
.ls-scene {
  position: relative;
  width: ${STAGE.width}px;
  height: ${STAGE.height}px;
  overflow: hidden;
  box-sizing: border-box;
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
  font-kerning: normal;
  font-synthesis: none;
}
.ls-scene *, .ls-scene *::before, .ls-scene *::after { box-sizing: border-box; }
.ls-decoration { position: absolute; z-index: 0; pointer-events: none; }
.ls-logo { position: absolute; z-index: 9000; width: auto; pointer-events: none; }
.ls-el { position: absolute; }
.ls-text {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow-wrap: break-word;
}
/* Spaces and tabs are kept as typed: lecturers line text up around pictures
   with them. Tab stops are PowerPoint's default, one inch apart. */
.ls-text, .ls-shape-content, .ls-table th, .ls-table td {
  white-space: pre-wrap;
  tab-size: ${TAB_STOP}px;
}
.ls-text.ls-v-top { justify-content: flex-start; }
.ls-text.ls-v-middle { justify-content: center; }
.ls-text.ls-v-bottom { justify-content: flex-end; }
.ls-p { margin: 0; }
.ls-p + .ls-p, .ls-p + .ls-list, .ls-list + .ls-p, .ls-list + .ls-list { margin-top: 0.4em; }
.ls-list { list-style: none; margin: 0; padding: 0; }
.ls-li { display: flex; align-items: baseline; gap: 0.55em; text-align: left; }
.ls-li + .ls-li { margin-top: 0.3em; }
.ls-marker { flex: none; min-width: 0.55em; font-variant-numeric: tabular-nums; }
.ls-bullet::before {
  content: '';
  display: inline-block;
  width: 0.34em;
  height: 0.34em;
  background: currentColor;
  transform: translateY(-0.18em);
}
.ls-li-body { flex: 1; min-width: 0; }
.ls-mark {
  background: var(--ls-mark-field);
  color: var(--ls-mark-text);
  padding: 0.04em 0.16em;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
/* Sub- and superscripts do not push lines apart. */
.ls-scene sub, .ls-scene sup { line-height: 0; font-size: 0.65em; }
.ls-link { color: inherit; text-decoration: underline; text-underline-offset: 0.14em; text-decoration-thickness: 0.07em; }
.ls-image { position: relative; width: 100%; height: 100%; overflow: hidden; }
.ls-image img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: fill; display: block; -webkit-user-drag: none; }
.ls-missing {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%; padding: 16px; text-align: center;
  border: 4px dashed currentColor; font-size: 28px;
}
.ls-shape { position: relative; width: 100%; height: 100%; }
.ls-shape svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; display: block; }
.ls-shape-content {
  /* PowerPoint's own text margins (0.05 and 0.1 inch), as in table cells. */
  position: absolute; inset: 0; padding: 7px 14px;
  display: flex; flex-direction: column; justify-content: center;
  text-align: center; overflow-wrap: break-word;
}
.ls-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.ls-table th, .ls-table td {
  /* PowerPoint's own cell margins (0.1 and 0.05 inch), so imported tables keep their proportions. */
  padding: var(--ls-cell-pad, 7px 14px); text-align: left; vertical-align: top;
  border-bottom: 2px solid var(--ls-rule); font-weight: 400;
  /* Never break inside a word or a number: "B10" must not become "B1" and "0". */
  overflow-wrap: normal; word-break: normal; hyphens: manual;
}
.ls-table th { background: var(--ls-th-bg); color: var(--ls-th-text); font-weight: 700; border-bottom: 0; }
.ls-video { position: relative; width: 100%; height: 100%; margin: 0; background: #000; }
.ls-video video { width: 100%; height: 100%; display: block; object-fit: contain; background: #000; }
.ls-videocard {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 18px; padding: 24px;
  background: var(--ls-card-bg); color: var(--ls-card-text);
  text-align: center; text-decoration: none; border-radius: 28px; font-size: 30px; line-height: 1.3;
}
/* At the top, so the note never covers the player's own controls. */
.ls-video-note {
  position: absolute; left: 0; right: 0; top: 0; margin: 0; padding: 14px 20px;
  background: #fff; color: #000; font-size: 24px; line-height: 1.3; pointer-events: none;
}
.ls-video-failed video[hidden] + .ls-video-note { position: static; }
.ls-videocard-info { display: flex; flex-direction: column; align-items: center; gap: 18px; min-width: 0; }
.ls-videocard-text { display: flex; flex-direction: column; gap: 6px; min-width: 0; overflow-wrap: anywhere; }
.ls-videocard svg { width: 96px; height: 96px; flex: none; }
.ls-videocard small { font-size: 22px; }
/* With a still picture: the picture fills the card, the text sits in a bar under it. */
.ls-videocard-poster { position: relative; padding: 0; gap: 0; justify-content: flex-end; overflow: hidden; }
.ls-videocard-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.ls-videocard-poster .ls-videocard-info {
  position: relative; flex-direction: row; gap: 20px; width: 100%; padding: 14px 24px;
  background: var(--ls-card-bg); text-align: left;
}
.ls-videocard-poster svg { width: 64px; height: 64px; }
.ls-deepdive {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5em;
  margin: 0; padding: 0 1.1em; border: 0; border-radius: 999px; cursor: pointer;
  background: var(--ls-button-bg); color: var(--ls-button-text);
  font: inherit; font-size: 30px; font-weight: 700; line-height: 1.15; text-align: center;
}
.ls-deepdive::before { content: '+'; font-weight: 400; font-size: 1.3em; line-height: 1; }
`;
