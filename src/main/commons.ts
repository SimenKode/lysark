// Wikimedia Commons: building the search request and reading the answer.
// Pure functions, no network; src/main/web.ts does the fetching.
import type { Credit } from '../shared/format/schema';

/**
 * The only hosts the program may contact, and only when the owner asks for
 * it in the media dialog (see AGENTS.md). Exact names, https only.
 */
export const ALLOWED_HOSTS = [
  'commons.wikimedia.org',
  'upload.wikimedia.org',
  // Where Wikimedia serves scaled pictures from (approved by the owner 22.11.2026).
  'thumb.wikimedia.org',
  'i.ytimg.com',
] as const;

/** The hosts pictures from Wikimedia Commons are served from. */
export const PICTURE_HOSTS: readonly string[] = ['upload.wikimedia.org', 'thumb.wikimedia.org'];

export function isAllowedUrl(address: string): boolean {
  try {
    const url = new URL(address);
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      (url.port === '' || url.port === '443') &&
      (ALLOWED_HOSTS as readonly string[]).includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

const API = 'https://commons.wikimedia.org/w/api.php';
export const COMMONS_PAGE_SIZE = 24;
/** Width of the pictures in the gallery, of the larger look, and of what is downloaded. */
export const COMMONS_THUMB_WIDTH = 330;
export const COMMONS_PREVIEW_WIDTH = 960;
/**
 * The stage is 1920 px wide. Wikimedia serves pictures in fixed widths, and
 * this is the largest of them that stays under the 2560 px the owner set as
 * the limit.
 */
export const COMMONS_DOWNLOAD_WIDTH = 1920;

const META = 'LicenseShortName|License|LicenseUrl|Artist|AttributionRequired|ObjectName';

function apiUrl(params: Record<string, string>): string {
  const query = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiextmetadatafilter: META,
    iiextmetadatalanguage: 'nb',
    ...params,
  });
  return `${API}?${query.toString()}`;
}

/** The search request: files only, pictures and drawings only. */
export function commonsSearchUrl(query: string, offset: number): string {
  return apiUrl({
    generator: 'search',
    gsrsearch: `${query.trim()} filetype:bitmap|drawing`,
    gsrnamespace: '6',
    gsrlimit: String(COMMONS_PAGE_SIZE),
    gsroffset: String(Math.max(0, Math.floor(offset))),
    iiurlwidth: String(COMMONS_THUMB_WIDTH),
  });
}

/** One file, with a picture of the given width. */
export function commonsFileUrl(title: string, width: number): string {
  return apiUrl({ titles: title, iiurlwidth: String(width) });
}

export interface CommonsHit {
  /** The file's name on Commons, with the "File:" prefix. */
  title: string;
  /** Address of a picture of the requested width. */
  thumbUrl: string;
  /** Address of the original file. */
  originalUrl: string;
  /** Size of the original, in pixels. */
  width: number;
  height: number;
  mime: string;
  credit: Credit;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Commons gives names and authors as HTML. This keeps the text and nothing else. */
export function plainFromHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/**
 * Which licences the search shows: public domain, CC0, CC BY and CC BY-SA.
 * Everything else is left out, among it files that are only under the GFDL
 * (which demands that the whole licence text follows the picture).
 */
export function licenceKind(code: string, shortName: string): 'free' | 'attribution' | undefined {
  const c = code.trim().toLowerCase();
  const n = shortName.trim().toLowerCase();
  if (/(^|-)n[cd](-|$)/.test(c) || /\bn[cd]\b/.test(n)) return undefined;
  if (
    c === 'cc0' ||
    c === 'cc-zero' ||
    c === 'pd' ||
    c.startsWith('pd-') ||
    c === 'public domain'
  ) {
    return 'free';
  }
  if (/^cc-by(-sa)?(-\d|$)/.test(c)) return 'attribution';
  if (!c) {
    if (n === 'cc0' || n.startsWith('public domain')) return 'free';
    if (/^cc by(-sa)?( \d|$)/.test(n)) return 'attribution';
  }
  return undefined;
}

/**
 * The address of a picture, when it lies on a host the program may contact.
 * The tracking parameters Wikimedia adds to the addresses are dropped:
 * nothing but the address of the picture itself is sent.
 */
export function pictureAddress(address: string): string | undefined {
  try {
    const url = new URL(address);
    url.search = '';
    url.hash = '';
    const clean = url.toString();
    return isAllowedUrl(clean) ? clean : undefined;
  } catch {
    return undefined;
  }
}

function metaValue(meta: unknown, key: string): string {
  if (typeof meta !== 'object' || meta === null) return '';
  const entry = (meta as Record<string, unknown>)[key];
  if (typeof entry !== 'object' || entry === null) return '';
  const value = (entry as Record<string, unknown>).value;
  return typeof value === 'string' ? value : '';
}

function fileTitle(title: string): string {
  return title
    .replace(/^[^:]+:/, '')
    .replace(/\.[A-Za-z0-9]{2,5}$/, '')
    .replace(/_/g, ' ');
}

/**
 * Reads the answer to a search or a file request. Files without a licence
 * the program accepts are left out. `next` is the offset of the next page.
 */
export function parseCommonsAnswer(data: unknown): { hits: CommonsHit[]; next?: number } {
  const root = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  const query = (root.query ?? {}) as Record<string, unknown>;
  const pages = Array.isArray(query.pages) ? (query.pages as Array<Record<string, unknown>>) : [];
  const hits: Array<CommonsHit & { index: number }> = [];
  for (const page of pages) {
    const info = Array.isArray(page.imageinfo)
      ? (page.imageinfo[0] as Record<string, unknown> | undefined)
      : undefined;
    const title = typeof page.title === 'string' ? page.title : '';
    if (!info || !title) continue;
    const original = typeof info.url === 'string' ? pictureAddress(info.url) : undefined;
    const thumb = typeof info.thumburl === 'string' ? pictureAddress(info.thumburl) : original;
    if (!original || !thumb) continue;
    const meta = info.extmetadata;
    const shortName = plainFromHtml(metaValue(meta, 'LicenseShortName'));
    const kind = licenceKind(metaValue(meta, 'License'), shortName);
    if (!kind) continue;
    const licenseUrl = metaValue(meta, 'LicenseUrl').trim();
    const pageUrl = typeof info.descriptionurl === 'string' ? info.descriptionurl : '';
    const credit: Credit = {
      title: plainFromHtml(metaValue(meta, 'ObjectName')) || fileTitle(title),
      license: shortName || (kind === 'free' ? 'Public domain' : ''),
      required: kind === 'attribution' || metaValue(meta, 'AttributionRequired') === 'true',
    };
    const author = plainFromHtml(metaValue(meta, 'Artist'));
    if (author) credit.author = author;
    if (/^https?:\/\//i.test(licenseUrl))
      credit.licenseUrl = licenseUrl.replace(/^http:/i, 'https:');
    if (isAllowedUrl(pageUrl)) credit.sourceUrl = pageUrl;
    hits.push({
      title,
      thumbUrl: thumb,
      originalUrl: original,
      width: typeof info.width === 'number' ? info.width : 0,
      height: typeof info.height === 'number' ? info.height : 0,
      mime: typeof info.mime === 'string' ? info.mime : '',
      credit,
      index: typeof page.index === 'number' ? page.index : hits.length,
    });
  }
  hits.sort((a, b) => a.index - b.index);
  const cont = (root.continue ?? {}) as Record<string, unknown>;
  const next = typeof cont.gsroffset === 'number' ? cont.gsroffset : undefined;
  return { hits: hits.map(({ index: _index, ...hit }) => hit), ...(next ? { next } : {}) };
}

/** Formats a browser can show as they are; others are fetched as the picture Commons makes of them. */
const DIRECT_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

/** The file extension for a downloaded picture, from the type the server said it is. */
export function extensionForMime(mime: string): string | undefined {
  return DIRECT_MIME[mime.split(';')[0]!.trim().toLowerCase()];
}

/**
 * Which address to download: the original when it is small enough and a
 * format browsers show, otherwise the scaled picture.
 */
export function downloadAddress(hit: CommonsHit): string {
  const direct = extensionForMime(hit.mime) !== undefined;
  return direct && hit.width > 0 && hit.width <= COMMONS_DOWNLOAD_WIDTH
    ? hit.originalUrl
    : hit.thumbUrl;
}
