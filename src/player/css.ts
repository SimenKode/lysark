// Styles for the player's own interface (not the scenes). Colours are from
// USN's palette and follow the manual's contrast table; interactive
// elements are rounded, as the manual asks.
import { PALETTE as C } from '../shared/theme/palette';

export const PLAYER_CSS = `
html, body { margin: 0; height: 100%; }
body { background: ${C.indigo}; }
.lp-app {
  position: fixed; inset: 0; display: flex; flex-direction: column;
  font-family: 'Liberation Sans', Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.4;
  color: ${C.sort}; background: ${C.indigo};
}
.lp-app *, .lp-app *::before, .lp-app *::after { box-sizing: border-box; }
.lp-app [hidden] { display: none !important; }
.lp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.lp-body { position: relative; flex: 1; min-height: 0; display: flex; }
.lp-center { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.lp-stagerow { position: relative; flex: 1; min-height: 0; display: flex; align-items: center; }
.lp-viewport {
  flex: 1; min-width: 0; height: 100%; display: flex; align-items: center; justify-content: center;
  overflow: hidden; outline: none;
}
/* The large round arrows on each side of the slide. They stand beside the
   slide, never on top of it, so they cover nothing. */
.lp-nav {
  flex: none; width: 72px; height: 72px; margin: 0 14px; padding: 0; border: 0; border-radius: 50%;
  display: grid; place-items: center; cursor: pointer;
  background: rgba(255, 255, 255, 0.2); color: ${C.hvit};
}
.lp-nav svg { width: 36px; height: 36px; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.lp-nav:hover { background: ${C.hvit}; color: ${C.indigo}; }
.lp-nav:active { background: ${C.lysIndigo}; color: ${C.indigo}; }
.lp-nav:disabled { opacity: 0.3; cursor: default; background: rgba(255, 255, 255, 0.2); color: ${C.hvit}; }
.lp-stagebox { position: relative; flex: none; overflow: hidden; }
.lp-stage { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; transform-origin: 0 0; }
.lp-stage .ls-deepdive:focus-visible, .lp-stage a:focus-visible, .lp-stage video:focus-visible,
.lp-stage .ls-more-badge:focus-visible, .lp-stage button.ls-webvideo-play:focus-visible {
  outline: 6px solid ${C.oransje}; outline-offset: 6px;
}
/* An element with a "+" mark opens its panel wherever it is clicked. */
.lp-stage .ls-has-more { cursor: pointer; }
.lp-stage .ls-has-more:hover > .ls-more-badge, .lp-stage .ls-more-badge[aria-expanded='true'] {
  background: var(--ls-badge-text); color: var(--ls-badge-bg); border-color: var(--ls-badge-bg);
}

.lp-toc, .lp-panel { background: ${C.hvit}; color: ${C.sort}; overflow: auto; flex: none; }
.lp-toc { width: min(340px, 85vw); padding: 16px 12px; border-right: 4px solid ${C.lilla}; }
.lp-panel { width: min(540px, 42vw); padding: 20px 24px 32px; border-left: 4px solid ${C.lilla}; }
.lp-toc h2, .lp-panel h2, .lp-script h2, .lp-help h2 {
  margin: 0 0 12px; font-family: 'Liberation Serif', 'Times New Roman', serif;
  font-weight: 400; font-size: 1.7rem; line-height: 1.15; color: ${C.lilla};
}
.lp-toc ol { list-style: none; margin: 0; padding: 0; }
.lp-toc-item {
  display: flex; gap: 10px; width: 100%; padding: 8px 12px; margin: 2px 0;
  border: 0; border-radius: 18px; background: transparent; color: ${C.sort};
  font: inherit; text-align: left; cursor: pointer;
}
.lp-toc-item:hover { background: ${C.lysIndigo}; }
.lp-toc-item[aria-current='true'] { background: ${C.lilla}; color: ${C.hvit}; }
.lp-toc-num { flex: none; min-width: 1.8em; font-variant-numeric: tabular-nums; }

.lp-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.lp-panel-head h2, .lp-panel, .lp-script { outline: none; }
.lp-panel-tools { display: flex; gap: 8px; flex: none; }
/* Rich content (tables, video, embedded pages) can take the whole width. */
.lp-panel.lp-panel-wide { position: absolute; inset: 0; z-index: 30; width: auto; border-left: 0; }
.lp-panel.lp-panel-wide .lp-panel-body { max-width: 1100px; margin: 0 auto; }
.lp-panel-body { margin-top: 8px; }

.lp-script {
  flex: none; max-height: 34vh; overflow: auto; padding: 14px 24px 18px;
  background: ${C.hvit}; color: ${C.sort}; border-top: 4px solid ${C.lilla};
}
.lp-script h2 { font-size: 1.3rem; margin-bottom: 6px; }
.lp-script p { margin: 0 0 0.6em; font-size: 1.05rem; line-height: 1.5; max-width: 75ch; }

.lp-bar {
  flex: none; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 8px 12px; background: ${C.indigo}; color: ${C.hvit};
}
.lp-btn {
  min-height: 40px; min-width: 44px; padding: 0 16px; border: 2px solid ${C.hvit}; border-radius: 999px;
  background: transparent; color: ${C.hvit}; font: inherit; cursor: pointer; white-space: nowrap;
}
.lp-btn:hover { background: ${C.lilla}; }
.lp-btn[aria-pressed='true'], .lp-btn[aria-expanded='true'], .lp-btn-strong {
  background: ${C.hvit}; color: ${C.indigo};
}
.lp-btn-strong:hover, .lp-btn[aria-pressed='true']:hover, .lp-btn[aria-expanded='true']:hover { background: ${C.lysIndigo}; }
.lp-btn:disabled { opacity: 0.45; cursor: default; background: transparent; color: ${C.hvit}; }
.lp-btn-light { border-color: ${C.lilla}; color: ${C.lilla}; background: ${C.hvit}; }
.lp-btn-light:hover { background: ${C.lysIndigo}; }
.lp-app :focus-visible { outline: 3px solid ${C.syregronn}; outline-offset: 2px; }
/* The slide area and the panels take the focus so that keys reach them; they need no ring. */
.lp-app .lp-viewport:focus-visible, .lp-app .lp-panel:focus-visible, .lp-app .lp-script:focus-visible { outline: none; }
.lp-toc :focus-visible, .lp-panel :focus-visible, .lp-script :focus-visible, .lp-help :focus-visible {
  outline-color: ${C.lilla};
}
.lp-counter { min-width: 5em; text-align: center; font-variant-numeric: tabular-nums; }
.lp-progress { flex: 1; min-width: 80px; height: 8px; border-radius: 999px; overflow: hidden; background: ${C.mediumIndigo}; }
.lp-progress > div { height: 100%; width: 0; background: ${C.syregronn}; }

.lp-help-back {
  position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center;
  background: rgba(47, 11, 99, 0.82); padding: 16px;
}
.lp-help {
  width: min(560px, 100%); max-height: 100%; overflow: auto; padding: 24px 28px;
  background: ${C.hvit}; color: ${C.sort}; border-radius: 28px;
}
.lp-help dl { display: grid; grid-template-columns: auto 1fr; gap: 8px 20px; margin: 0 0 16px; }
.lp-help dt { font-weight: 700; white-space: nowrap; }
.lp-help dd { margin: 0; }
.lp-help p { margin: 0 0 16px; }
.lp-credits { width: min(720px, 100%); }
.lp-credits-list { list-style: none; margin: 0 0 16px; padding: 0; }
.lp-credits-list li { padding: 8px 0; border-bottom: 1px solid ${C.mediumIndigo}; display: flex; flex-direction: column; gap: 2px; }
.lp-credits-list a { color: ${C.lilla}; }
.lp-credits-where { font-size: 0.9em; }

.lp-print { display: none; }

@media (max-width: 900px) {
  .lp-toc, .lp-panel { position: absolute; top: 0; bottom: 0; z-index: 20; width: min(540px, 100%); }
  .lp-toc { left: 0; }
  .lp-panel { right: 0; }
}
/* On a narrow screen there is no room beside the slide: smaller arrows sit in
   the lower corners, where an upright phone has empty space under the slide. */
@media (max-width: 700px) {
  .lp-nav {
    position: absolute; z-index: 5; bottom: 12px; width: 52px; height: 52px; margin: 0;
    background: rgba(47, 11, 99, 0.78); border: 2px solid ${C.hvit};
  }
  .lp-nav svg { width: 26px; height: 26px; }
  .lp-nav:disabled { background: rgba(47, 11, 99, 0.78); }
  .lp-nav-prev { left: 12px; }
  .lp-nav-next { right: 12px; }
}

@media (prefers-reduced-motion: no-preference) {
  .lp-progress > div { transition: width 0.2s ease-out; }
  .lp-nav { transition: background-color 0.15s ease-out, color 0.15s ease-out; }
}

@media print {
  @page { size: A4 landscape; margin: 12mm; }
  html, body { height: auto; background: ${C.hvit}; }
  .lp-app { position: static; display: block; background: ${C.hvit}; }
  .lp-app > :not(.lp-print) { display: none !important; }
  .lp-print { display: block; }
  .lp-print-page { break-after: page; break-inside: avoid; }
  .lp-print-scene {
    position: relative; width: 960px; height: 540px; overflow: hidden;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .lp-print-scene > .ls-scene { transform: scale(0.5); transform-origin: 0 0; }
  /* Paper cannot open a panel. */
  .lp-print .ls-more-badge { display: none; }
  .lp-print-script { margin-top: 10px; font-size: 11pt; line-height: 1.4; max-width: 960px; }
  .lp-print-script p { margin: 0 0 0.5em; }
}
`;
