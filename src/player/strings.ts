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
  helpTitle: string;
  keys: Array<[string, string]>;
  printNote: string;
}

export const PLAYER_STRINGS: Record<Project['meta']['language'], PlayerStrings> = {
  nb: {
    contents: 'Innhold',
    previous: 'Forrige',
    next: 'Neste',
    script: 'Manus',
    noScript: 'Denne scenen har ikke manus.',
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
    helpTitle: 'Tastatur',
    keys: [
      ['→  Mellomrom  Page Down', 'Neste steg eller lysark'],
      ['←  Page Up', 'Forrige steg eller lysark'],
      ['Home / End', 'Første / siste lysark'],
      ['I', 'Innhold'],
      ['M', 'Manus'],
      ['F', 'Fullskjerm'],
      ['Esc', 'Lukk panel'],
      ['?', 'Denne hjelpen'],
    ],
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
    helpTitle: 'Keyboard',
    keys: [
      ['→  Space  Page Down', 'Next step or slide'],
      ['←  Page Up', 'Previous step or slide'],
      ['Home / End', 'First / last slide'],
      ['I', 'Contents'],
      ['M', 'Script'],
      ['F', 'Full screen'],
      ['Esc', 'Close panel'],
      ['?', 'This help'],
    ],
    printNote: 'Print from the browser to get all slides on paper or as PDF.',
  },
};
