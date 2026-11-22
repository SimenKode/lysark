// Serves the preview from an address on this machine (127.0.0.1). A page
// opened from disk has no address a web video can be told about, so YouTube
// refuses to play in it; served this way the preview behaves as it will for
// students who open the file from the learning platform. The server answers
// only this machine, only with the current preview, and only to requests
// that carry a secret path.
import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

interface Served {
  html: string;
  /** Resolves "media/<name>" to a file of the open project, or undefined. */
  mediaFile: (name: string) => { file: string; mime: string } | undefined;
}

let server: Server | null = null;
let port = 0;
const token = randomBytes(18).toString('hex');
let served: Served | null = null;

function sendFile(file: string, mime: string, req: IncomingMessage, res: ServerResponse): void {
  if (!existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  const size = statSync(file).size;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  const headers = { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  if (range && (range[1] || range[2])) {
    const start = Math.max(0, range[1] ? parseInt(range[1], 10) : size - parseInt(range[2]!, 10));
    const end = Math.min(size - 1, range[1] && range[2] ? parseInt(range[2], 10) : size - 1);
    if (start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
      return;
    }
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': end - start + 1,
    });
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': size });
  createReadStream(file).pipe(res);
}

function handle(req: IncomingMessage, res: ServerResponse): void {
  // Only this machine, by its numeric address: a web page elsewhere cannot
  // reach the preview through a host name that points here.
  if (req.headers.host !== `127.0.0.1:${port}` || (req.method !== 'GET' && req.method !== 'HEAD')) {
    res.writeHead(403).end();
    return;
  }
  const path = decodeURIComponent((req.url ?? '').split(/[?#]/)[0] ?? '');
  const prefix = `/${token}/`;
  if (!served || !path.startsWith(prefix)) {
    res.writeHead(404).end();
    return;
  }
  const rest = path.slice(prefix.length);
  if (rest === 'index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : served.html);
    return;
  }
  const media = /^media\/([A-Za-z0-9._-]+)$/.exec(rest);
  const found = media ? served.mediaFile(media[1]!) : undefined;
  if (!found) {
    res.writeHead(404).end();
    return;
  }
  sendFile(found.file, found.mime, req, res);
}

/** Makes the page available and returns its address. Replaces what was served before. */
export async function servePreview(next: Served): Promise<string> {
  served = next;
  if (!server) {
    const created = createServer(handle);
    await new Promise<void>((resolve, reject) => {
      created.once('error', reject);
      created.listen(0, '127.0.0.1', resolve);
    });
    port = (created.address() as AddressInfo).port;
    server = created;
  }
  return `http://127.0.0.1:${port}/${token}/index.html`;
}

/** True for addresses of the preview itself. */
export function isPreviewUrl(address: string): boolean {
  return port > 0 && address.startsWith(`http://127.0.0.1:${port}/${token}/`);
}

export function stopPreviewServer(): void {
  server?.close();
  server = null;
  served = null;
  port = 0;
}
