// Media files taken out of the PPTX: format tables and a store that gives
// identical bytes one file and one asset.
import { createHash } from 'node:crypto';
import { newId } from '../shared/format/factory';
import type { Asset } from '../shared/format/schema';
import { baseNameOf } from './package';

export interface ImportedMedia {
  /** 'media/<first 16 hex of sha256>.<ext>' */
  file: string;
  data: Uint8Array;
}

export interface MediaFormat {
  /** Extension used for the stored file. */
  extension: string;
  mime: string;
}

const IMAGE_FORMATS: Record<string, MediaFormat> = {
  png: { extension: 'png', mime: 'image/png' },
  jpg: { extension: 'jpg', mime: 'image/jpeg' },
  jpeg: { extension: 'jpg', mime: 'image/jpeg' },
  jpe: { extension: 'jpg', mime: 'image/jpeg' },
  jfif: { extension: 'jpg', mime: 'image/jpeg' },
  gif: { extension: 'gif', mime: 'image/gif' },
  svg: { extension: 'svg', mime: 'image/svg+xml' },
  webp: { extension: 'webp', mime: 'image/webp' },
  bmp: { extension: 'bmp', mime: 'image/bmp' },
};

const VIDEO_FORMATS: Record<string, MediaFormat> = {
  mp4: { extension: 'mp4', mime: 'video/mp4' },
  m4v: { extension: 'm4v', mime: 'video/mp4' },
  webm: { extension: 'webm', mime: 'video/webm' },
};

const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'm4a',
  'wma',
  'aac',
  'ogg',
  'oga',
  'flac',
  'mid',
  'midi',
  'aif',
  'aiff',
  'au',
]);

export function imageFormat(extension: string): MediaFormat | undefined {
  return IMAGE_FORMATS[extension];
}

export function videoFormat(extension: string): MediaFormat | undefined {
  return VIDEO_FORMATS[extension];
}

export function isAudioExtension(extension: string): boolean {
  return AUDIO_EXTENSIONS.has(extension);
}

export class MediaStore {
  readonly media: ImportedMedia[] = [];
  readonly assets: Record<string, Asset> = {};
  private readonly byFile = new Map<string, string>();

  /** Stores the bytes of a package part and returns the id of its asset. */
  add(part: string, data: Uint8Array, kind: Asset['kind'], format: MediaFormat): string {
    const hash = createHash('sha256').update(data).digest('hex').slice(0, 16);
    const file = `media/${hash}.${format.extension}`;
    const existing = this.byFile.get(file);
    if (existing) return existing;
    const id = newId('a');
    this.media.push({ file, data });
    this.assets[id] = { kind, file, mime: format.mime, bytes: data.length, name: baseNameOf(part) };
    this.byFile.set(file, id);
    return id;
  }
}
