// Helpers that create valid, empty pieces of a project.
import {
  FORMAT_NAME,
  FORMAT_VERSION,
  type Paragraph,
  type Project,
  type RichText,
  type Scene,
  type SceneKind,
} from './schema';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Short random id. Ids only need to be unique inside one project. */
export function newId(prefix: string): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${out}`;
}

export function paragraph(text: string, extra: Partial<Paragraph> = {}): Paragraph {
  return { level: 0, list: 'none', runs: text ? [{ text }] : [], ...extra };
}

export function richText(...lines: string[]): RichText {
  return { paragraphs: lines.length ? lines.map((l) => paragraph(l)) : [paragraph('')] };
}

export function plainText(rt: RichText): string {
  return rt.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n');
}

export function isEmptyRichText(rt: RichText): boolean {
  return plainText(rt).trim() === '';
}

export function newScene(kind: SceneKind, title = ''): Scene {
  return {
    id: newId('s'),
    title,
    kind,
    decoration: kind === 'title' || kind === 'section',
    shapeVariant: 0,
    showLogo: true,
    elements: [],
    timeline: [],
    script: '',
  };
}

export function newProject(title: string): Project {
  return {
    format: FORMAT_NAME,
    version: FORMAT_VERSION,
    meta: { title, language: 'nb' },
    theme: { style: 'ren' },
    export: { showScript: true },
    assets: {},
    scenes: [],
  };
}
