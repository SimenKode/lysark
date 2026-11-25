// Openverse: building the search request and reading the answer. Pure
// functions, no network; src/main/web.ts does the fetching.
//
// Openverse (openverse.org, run by the WordPress Foundation) is a search
// across openly licensed pictures in many collections: Flickr, museums and
// others. It was added on 25.11.2026 as the second source of pictures,
// after the owner had said that more sources were welcome (see AGENTS.md).
//
// Everything goes through one host, api.openverse.org: the search, the
// small pictures of the gallery and the picture that is fetched. The
// collections themselves are never contacted.
//
// Openverse's terms of use ask that a program built on it says that it
// uses Openverse and is not endorsed by it, and they say that Openverse
// does not check the licences itself. The tab in the media dialog says both.
import type { Credit } from '../shared/format/schema';
import { plainFromHtml } from './commons';

export const OPENVERSE_HOST = 'api.openverse.org';
const IMAGES = `https://${OPENVERSE_HOST}/v1/images/`;
/** The most a request without an account may ask for. */
export const OPENVERSE_PAGE_SIZE = 20;

/**
 * The licences the search asks for, the same as for Wikimedia Commons:
 * free use (CC0, public domain) and attribution (CC BY, CC BY-SA).
 */
const LICENCES = ['cc0', 'pdm', 'by', 'by-sa'];

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isOpenverseId(id: unknown): id is string {
  return typeof id === 'string' && ID.test(id);
}

/** The search request. Only the search words are sent. */
export function openverseSearchUrl(query: string, page: number): string {
  const params = new URLSearchParams({
    q: query.trim().slice(0, 200),
    license: LICENCES.join(','),
    page_size: String(OPENVERSE_PAGE_SIZE),
    page: String(Math.max(1, Math.floor(page) || 1)),
    // Wikimedia Commons has its own tab, where the credits are fuller.
    excluded_source: 'wikimedia',
  });
  return `${IMAGES}?${params.toString()}`;
}

/** One picture, with its licence as Openverse has it now. */
export function openverseDetailUrl(id: string): string {
  if (!isOpenverseId(id)) throw new Error('Ugyldig bilde.');
  return `${IMAGES}${id}/`;
}

/**
 * The picture itself, handed out by Openverse: a small one for the gallery,
 * or (`full`) the picture in the size its collection has it.
 */
export function openversePictureUrl(id: string, full: boolean): string {
  if (!isOpenverseId(id)) throw new Error('Ugyldig bilde.');
  return `${IMAGES}${id}/thumb/${full ? '?full_size=true' : ''}`;
}

/** True for an address made by `openversePictureUrl`, and for nothing else. */
export function isOpenversePicture(address: string): boolean {
  const start = IMAGES;
  if (!address.startsWith(start)) return false;
  const rest = address.slice(start.length);
  const id = rest.slice(0, 36);
  const end = rest.slice(36);
  return isOpenverseId(id) && (end === '/thumb/' || end === '/thumb/?full_size=true');
}

export interface OpenverseHit {
  id: string;
  /** Address of the small picture, on Openverse's own host. */
  thumbUrl: string;
  /** A name for the file in the project, for the owner's reference. */
  name: string;
  credit: Credit;
}

/** The licence as it is written in a credit, and whether the credit must be shown. */
export function openverseLicence(
  code: string,
  version: string,
): { name: string; required: boolean } | undefined {
  const v = /^\d+(\.\d+)?$/.test(version.trim()) ? ` ${version.trim()}` : '';
  switch (code.trim().toLowerCase()) {
    case 'cc0':
      return { name: `CC0${v}`, required: false };
    case 'pdm':
      return { name: 'Public domain', required: false };
    case 'by':
      return { name: `CC BY${v}`, required: true };
    case 'by-sa':
      return { name: `CC BY-SA${v}`, required: true };
    default:
      // Everything else (no commercial use, no changes, and the like) is left out.
      return undefined;
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? plainFromHtml(value) : '';
}

/** A web address that is safe to write into a credit: https, and nothing hidden in it. */
function webAddress(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value.replace(/^http:/i, 'https:'));
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Reads one picture of an answer. Undefined when it cannot be used. */
export function parseOpenverseHit(item: unknown): OpenverseHit | undefined {
  if (typeof item !== 'object' || item === null) return undefined;
  const it = item as Record<string, unknown>;
  if (!isOpenverseId(it.id) || it.mature === true) return undefined;
  const licence = openverseLicence(
    typeof it.license === 'string' ? it.license : '',
    typeof it.license_version === 'string' ? it.license_version : '',
  );
  if (!licence) return undefined;
  const credit: Credit = { license: licence.name, required: licence.required };
  const title = text(it.title);
  if (title) credit.title = title;
  const author = text(it.creator);
  if (author) credit.author = author;
  const licenseUrl = webAddress(it.license_url);
  if (licenseUrl && new URL(licenseUrl).hostname === 'creativecommons.org') {
    credit.licenseUrl = licenseUrl;
  }
  const sourceUrl = webAddress(it.foreign_landing_url);
  if (sourceUrl) credit.sourceUrl = sourceUrl;
  return {
    id: it.id,
    thumbUrl: openversePictureUrl(it.id, false),
    name: title || `openverse-${it.id.slice(0, 8)}`,
    credit,
  };
}

/**
 * Reads the answer to a search. Pictures without a licence the program
 * accepts are left out. `next` is the number of the next page.
 */
export function parseOpenverseAnswer(data: unknown): { hits: OpenverseHit[]; next?: number } {
  const root = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  const results = Array.isArray(root.results) ? root.results : [];
  const hits: OpenverseHit[] = [];
  const seen = new Set<string>();
  for (const item of results) {
    const hit = parseOpenverseHit(item);
    if (!hit || seen.has(hit.id)) continue;
    seen.add(hit.id);
    hits.push(hit);
  }
  const page = typeof root.page === 'number' ? root.page : 1;
  const pages = typeof root.page_count === 'number' ? root.page_count : 1;
  return { hits, ...(page < pages ? { next: page + 1 } : {}) };
}
