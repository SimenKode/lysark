// What a web address is, as far as showing it inside a presentation goes.
// Pure functions: nothing here fetches anything.

export interface YouTubeRef {
  id: string;
  /** Seconds into the video where playing starts. */
  start?: number;
}

function parseUrl(text: string): URL | undefined {
  try {
    const url = new URL(text.trim());
    return /^https?:$/.test(url.protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}

/** "90", "90s" and "1m30s" all mean ninety seconds. */
function parseSeconds(text: string | null): number | undefined {
  if (!text) return undefined;
  if (/^\d+s?$/.test(text)) return parseInt(text, 10) || undefined;
  const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text);
  if (!parts) return undefined;
  const total = Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0);
  return total || undefined;
}

/** The video a YouTube address points at, whichever of YouTube's address forms it uses. */
export function youtubeRef(address: string): YouTubeRef | undefined {
  const url = parseUrl(address);
  if (!url) return undefined;
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  let id: string | undefined;
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v') ?? undefined;
    else id = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(url.pathname)?.[1];
  }
  if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return undefined;
  const start = parseSeconds(url.searchParams.get('start') ?? url.searchParams.get('t'));
  return start ? { id, start } : { id };
}

/**
 * The player address, on YouTube's domain that sets no cookies before the
 * video is played. The video does not start by itself: the viewer presses
 * play in YouTube's own player.
 */
export function youtubeEmbedUrl(ref: YouTubeRef): string {
  const start = ref.start ? `&start=${ref.start}` : '';
  return `https://www.youtube-nocookie.com/embed/${ref.id}?rel=0${start}`;
}

export function youtubeWatchUrl(ref: YouTubeRef): string {
  return `https://www.youtube.com/watch?v=${ref.id}${ref.start ? `&t=${ref.start}s` : ''}`;
}

/** YouTube's own still picture of a video. Only the program fetches it, and only on request. */
export function youtubeStillUrl(ref: YouTubeRef): string {
  return `https://i.ytimg.com/vi/${ref.id}/hqdefault.jpg`;
}

/** A page that can be shown in a frame: https only, so it also works where the file is served securely. */
export function embedTarget(address: string): { href: string; host: string } | undefined {
  const url = parseUrl(address);
  if (!url || url.protocol !== 'https:') return undefined;
  return { href: url.toString(), host: url.hostname.replace(/^www\./, '') };
}
