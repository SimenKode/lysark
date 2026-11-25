// The one place the program talks to the network, and only when the owner
// asks for it in the media dialog: a search in Wikimedia Commons or in
// Openverse, the download of the picture he chooses, and the still picture
// of a YouTube link. Everything goes through one session whose requests are checked
// against an allow-list, redirects included.
import { app, session, type Session } from 'electron';
import {
  PICTURE_HOSTS,
  COMMONS_DOWNLOAD_WIDTH,
  COMMONS_PREVIEW_WIDTH,
  commonsFileUrl,
  commonsSearchUrl,
  downloadAddress,
  extensionForMime,
  isAllowedUrl,
  parseCommonsAnswer,
  type CommonsHit,
} from './commons';
import {
  isOpenversePicture,
  openverseDetailUrl,
  openversePictureUrl,
  openverseSearchUrl,
  parseOpenverseAnswer,
  parseOpenverseHit,
  type OpenverseHit,
} from './openverse';
import { FETCHED_PICTURE_LIMIT_BYTES } from '../shared/limits';
import { youtubeRef, youtubeStillUrl } from '../shared/render/web';

const PARTITION = 'lysark-web'; // in memory: nothing is kept between runs
const MAX_PICTURE_BYTES = FETCHED_PICTURE_LIMIT_BYTES;

let webSession: Session | null = null;

function web(): Session {
  if (webSession) return webSession;
  const created = session.fromPartition(PARTITION);
  // Only the program's name and version, and a fixed language. Nothing about the machine.
  created.setUserAgent(`Lysark/${app.getVersion()}`, 'nb,en');
  created.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedUrl(details.url) });
  });
  webSession = created;
  return created;
}

function offline(error: unknown): Error {
  const text = error instanceof Error ? error.message : String(error);
  if (
    /ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_NETWORK|ERR_CONNECTION|ERR_TIMED_OUT/.test(
      text,
    )
  ) {
    return new Error('Får ikke kontakt med nettet. Sjekk tilkoblingen og prøv igjen.');
  }
  return new Error(`Forespørselen ble ikke besvart (${text}).`);
}

/** Fetches an address on the allow-list. Anything else is refused before it leaves the machine. */
export async function fetchAllowed(address: string): Promise<Response> {
  if (!isAllowedUrl(address))
    throw new Error('Adressen er ikke blant dem programmet får kontakte.');
  let response: Response;
  try {
    response = await web().fetch(address, { credentials: 'omit', cache: 'no-store' });
  } catch (error) {
    throw offline(error);
  }
  return response;
}

async function fetchJson(address: string): Promise<unknown> {
  const response = await fetchAllowed(address);
  if (!response.ok) throw new Error(`Wikimedia Commons svarte med feil (${response.status}).`);
  return response.json();
}

async function fetchBytes(address: string): Promise<{ data: Uint8Array; mime: string }> {
  const response = await fetchAllowed(address);
  if (!response.ok) throw new Error(`Bildet kunne ikke hentes (${response.status}).`);
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.byteLength > MAX_PICTURE_BYTES) throw new Error('Bildet er for stort.');
  return { data, mime: response.headers.get('content-type') ?? '' };
}

export async function searchCommons(
  query: string,
  offset: number,
): Promise<{ hits: CommonsHit[]; next?: number }> {
  if (!query.trim()) return { hits: [] };
  return parseCommonsAnswer(await fetchJson(commonsSearchUrl(query, offset)));
}

/** A larger picture of one file, for a closer look before it is chosen. */
export async function commonsPreview(title: string): Promise<CommonsHit> {
  const { hits } = parseCommonsAnswer(
    await fetchJson(commonsFileUrl(title, COMMONS_PREVIEW_WIDTH)),
  );
  if (!hits[0]) throw new Error('Bildet finnes ikke lenger, eller lisensen kan ikke brukes.');
  return hits[0];
}

/** Downloads the chosen picture, at most 1920 px wide, with what its credit must say. */
export async function downloadCommons(
  title: string,
): Promise<{ data: Uint8Array; mime: string; extension: string; hit: CommonsHit }> {
  const { hits } = parseCommonsAnswer(
    await fetchJson(commonsFileUrl(title, COMMONS_DOWNLOAD_WIDTH)),
  );
  const hit = hits[0];
  if (!hit) throw new Error('Bildet finnes ikke lenger, eller lisensen kan ikke brukes.');
  const fetched = await fetchBytes(downloadAddress(hit));
  const extension = extensionForMime(fetched.mime);
  if (!extension) throw new Error('Bildet er i et format som ikke kan vises.');
  return { ...fetched, mime: fetched.mime.split(';')[0]!.trim().toLowerCase(), extension, hit };
}

async function openverseJson(address: string): Promise<unknown> {
  const response = await fetchAllowed(address);
  if (response.status === 429) {
    throw new Error(
      'Openverse tar ikke imot flere søk akkurat nå. Det er en grense for hvor mange som kan ' +
        'gjøres på en dag. Prøv igjen om litt, eller søk i Wikimedia Commons.',
    );
  }
  if (response.status === 404) throw new Error('Bildet finnes ikke lenger hos Openverse.');
  if (!response.ok) throw new Error(`Openverse svarte med feil (${response.status}).`);
  return response.json();
}

/** Sends the owner's search words to Openverse. `page` counts from 1. */
export async function searchOpenverse(
  query: string,
  page: number,
): Promise<{ hits: OpenverseHit[]; next?: number }> {
  if (!query.trim()) return { hits: [] };
  return parseOpenverseAnswer(await openverseJson(openverseSearchUrl(query, page)));
}

/**
 * Fetches the chosen picture from Openverse, in the size its collection has
 * it, with what its credit must say. The licence is read anew, not taken
 * from the gallery.
 */
export async function downloadOpenverse(
  id: string,
): Promise<{ data: Uint8Array; mime: string; extension: string; hit: OpenverseHit }> {
  const hit = parseOpenverseHit(await openverseJson(openverseDetailUrl(id)));
  if (!hit) throw new Error('Bildet finnes ikke lenger, eller lisensen kan ikke brukes.');
  const fetched = await fetchBytes(openversePictureUrl(id, true));
  const extension = extensionForMime(fetched.mime);
  if (!extension) throw new Error('Bildet er i et format som ikke kan vises.');
  return { ...fetched, mime: fetched.mime.split(';')[0]!.trim().toLowerCase(), extension, hit };
}

/** YouTube's own still picture of a video; the large one when it exists. */
export async function youtubeStill(address: string): Promise<{ data: Uint8Array; id: string }> {
  const ref = youtubeRef(address);
  if (!ref) throw new Error('Adressen er ikke en YouTube-video.');
  const standard = youtubeStillUrl(ref);
  for (const url of [standard.replace('hqdefault', 'maxresdefault'), standard]) {
    const response = await fetchAllowed(url);
    if (response.ok && (response.headers.get('content-type') ?? '').startsWith('image/jpeg')) {
      return { data: new Uint8Array(await response.arrayBuffer()), id: ref.id };
    }
  }
  throw new Error('YouTube har ikke noe forhåndsbilde for denne videoen.');
}

/** Passes a gallery picture on to the interface, which cannot reach the network itself. */
export async function proxyPicture(address: string): Promise<Response> {
  const picture =
    isAllowedUrl(address) &&
    (PICTURE_HOSTS.includes(new URL(address).hostname) || isOpenversePicture(address));
  if (!picture) return new Response(null, { status: 403 });
  try {
    const response = await fetchAllowed(address);
    const type = response.headers.get('content-type') ?? '';
    if (!response.ok || !type.startsWith('image/')) return new Response(null, { status: 502 });
    return new Response(response.body, {
      status: 200,
      headers: { 'Content-Type': type, 'Cache-Control': 'max-age=3600' },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
