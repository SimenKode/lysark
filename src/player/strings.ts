// The player's own texts. Bokmål is the default; English is a choice per
// presentation.
import type { Project } from '../shared/format/schema';

export interface PlayerStrings {
  contents: string;
  previous: string;
  next: string;
  script: string;
  noScript: string;
  help: string;
  fullscreen: string;
  exitFullscreen: string;
  close: string;
  sceneOf: (n: number, total: number) => string;
  announce: (n: number, total: number, title: string) => string;
  progress: string;
  stage: string;
  untitled: (n: number) => string;
  needsInternet: string;
  /** Makes the "Lær mer" panel as wide as the window, and back. */
  widen: string;
  narrow: string;
  credits: string;
  usedOn: (scenes: number[]) => string;
  helpTitle: string;
  keys: Array<[string, string]>;
  /** Shown in the help only when the lecture has the lecturer's voice. */
  playKey: [string, string];
  /** Starts and stops the lecturer's voice. */
  play: string;
  pause: string;
  printNote: string;
}

export const PLAYER_STRINGS: Record<Project['meta']['language'], PlayerStrings> = {
  nb: {
    contents: 'Innhold',
    previous: 'Forrige',
    next: 'Neste',
    script: 'Manus',
    noScript: 'Dette lysarket har ikke manus.',
    help: 'Hjelp',
    fullscreen: 'Fullskjerm',
    exitFullscreen: 'Avslutt fullskjerm',
    close: 'Lukk',
    sceneOf: (n, total) => `${n} / ${total}`,
    announce: (n, total, title) => `Lysark ${n} av ${total}: ${title}`,
    progress: 'Framdrift',
    stage: 'Lysark',
    untitled: (n) => `Lysark ${n}`,
    needsInternet: 'krever nett',
    widen: 'Utvid',
    narrow: 'Gjør smalere',
    credits: 'Bildekilder',
    usedOn: (scenes) => `Lysark ${scenes.join(', ')}`,
    helpTitle: 'Tastatur',
    keys: [
      ['→  ↓  Mellomrom  Page Down', 'Neste steg eller lysark'],
      ['←  ↑  Page Up', 'Forrige steg eller lysark'],
      ['Home / End', 'Første / siste lysark'],
      ['I', 'Innhold'],
      ['M', 'Manus'],
      ['F', 'Fullskjerm'],
      ['Tab, så Enter', 'Gå til et «+»-merke og åpne «Lær mer»'],
      ['Esc', 'Lukk boksen eller panelet som er åpent'],
      ['?', 'Denne hjelpen'],
    ],
    playKey: ['P', 'Spill av eller stopp stemmen'],
    play: 'Spill av',
    pause: 'Pause',
    printNote: 'Skriv ut fra nettleseren for å få alle lysarkene på papir eller som PDF.',
  },
  en: {
    contents: 'Contents',
    previous: 'Previous',
    next: 'Next',
    script: 'Script',
    noScript: 'This slide has no script.',
    help: 'Help',
    fullscreen: 'Full screen',
    exitFullscreen: 'Exit full screen',
    close: 'Close',
    sceneOf: (n, total) => `${n} / ${total}`,
    announce: (n, total, title) => `Slide ${n} of ${total}: ${title}`,
    progress: 'Progress',
    stage: 'Slide',
    untitled: (n) => `Slide ${n}`,
    needsInternet: 'needs internet',
    widen: 'Widen',
    narrow: 'Make narrower',
    credits: 'Picture credits',
    usedOn: (scenes) => `Slide ${scenes.join(', ')}`,
    helpTitle: 'Keyboard',
    keys: [
      ['→  ↓  Space  Page Down', 'Next step or slide'],
      ['←  ↑  Page Up', 'Previous step or slide'],
      ['Home / End', 'First / last slide'],
      ['I', 'Contents'],
      ['M', 'Script'],
      ['F', 'Full screen'],
      ['Tab, then Enter', 'Go to a "+" mark and open "Learn more"'],
      ['Esc', 'Close the box or panel that is open'],
      ['?', 'This help'],
    ],
    playKey: ['P', 'Play or stop the voice'],
    play: 'Play',
    pause: 'Pause',
    printNote: 'Print from the browser to get all slides on paper or as PDF.',
  },
};
