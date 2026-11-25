// Takes the pictures the camera hands out and makes them into the film of a
// recording. It runs in a thread of its own, so the film goes on evenly
// while the window is busy drawing a new slide.
//
// The film has the recording's own time: a picture is given the number of
// seconds that had been recorded when it arrived. Time stands still while
// the reading is paused, and pictures that arrive then are left out. The
// window keeps the same count (`Film.time` in camera.ts), so it knows
// which moment of the film every slide begins at.
//
// What is handed back is an IVF file (a plain row of VP8 pictures, each
// with its time in milliseconds), a piece at a time. Nothing is kept here.

interface Scope {
  onmessage: ((event: MessageEvent<FilmMessage>) => void) | null;
  postMessage(message: FilmReply, transfer?: Transferable[]): void;
}

export type FilmMessage =
  | { type: 'open'; readable: ReadableStream<VideoFrame> }
  /** Pictures are kept from, or no longer kept from, the moment `at` (milliseconds since 1970). */
  | { type: 'keep'; on: boolean; at: number }
  | { type: 'end' };

export type FilmReply =
  | { type: 'data'; bytes: ArrayBuffer }
  | { type: 'done'; frames: number }
  | { type: 'error'; message: string };

const scope = self as unknown as Scope;
const BITS_PER_SECOND = 2_000_000;
/** A full picture this often, counted in pictures. */
const KEY_EVERY = 30;
/** Pieces are handed back when this much has gathered. */
const PIECE_BYTES = 256 * 1024;

const now = (): number => performance.timeOrigin + performance.now();

let keeping = false;
/** Milliseconds kept before the stretch that runs now, and when that stretch began. */
let keptBefore = 0;
let since = 0;
let lastTime = -1;
let frames = 0;
let encoder: VideoEncoder | null = null;
let reader: ReadableStreamDefaultReader<VideoFrame> | null = null;
let held: Uint8Array[] = [];
let heldBytes = 0;
let failed = false;

function hand(force: boolean): void {
  if (heldBytes === 0 || (!force && heldBytes < PIECE_BYTES)) return;
  const out = new Uint8Array(heldBytes);
  let offset = 0;
  for (const part of held) {
    out.set(part, offset);
    offset += part.length;
  }
  held = [];
  heldBytes = 0;
  scope.postMessage({ type: 'data', bytes: out.buffer }, [out.buffer]);
}

function push(part: Uint8Array): void {
  held.push(part);
  heldBytes += part.length;
  hand(false);
}

/** The head of an IVF file: VP8, time counted in milliseconds. */
function fileHead(width: number, height: number): Uint8Array {
  const head = new Uint8Array(32);
  const view = new DataView(head.buffer);
  head.set([0x44, 0x4b, 0x49, 0x46]); // "DKIF"
  view.setUint16(4, 0, true);
  view.setUint16(6, 32, true);
  head.set([0x56, 0x50, 0x38, 0x30], 8); // "VP80"
  view.setUint16(12, width, true);
  view.setUint16(14, height, true);
  view.setUint32(16, 1000, true);
  view.setUint32(20, 1, true);
  return head;
}

function fail(error: unknown): void {
  if (failed) return;
  failed = true;
  scope.postMessage({ type: 'error', message: String(error) });
}

function start(width: number, height: number): VideoEncoder {
  push(fileHead(width, height));
  const made = new VideoEncoder({
    output(chunk) {
      const record = new Uint8Array(12 + chunk.byteLength);
      const view = new DataView(record.buffer);
      view.setUint32(0, chunk.byteLength, true);
      // The time was given in microseconds when the picture was handed in.
      view.setBigUint64(4, BigInt(Math.round(chunk.timestamp / 1000)), true);
      chunk.copyTo(record.subarray(12));
      push(record);
    },
    error: fail,
  });
  made.configure({
    codec: 'vp8',
    width,
    height,
    bitrate: BITS_PER_SECOND,
    framerate: 30,
    latencyMode: 'realtime',
  });
  return made;
}

async function read(stream: ReadableStream<VideoFrame>): Promise<void> {
  reader = stream.getReader();
  for (;;) {
    const { value: frame, done } = await reader.read();
    if (done || !frame) return;
    try {
      const arrived = now();
      if (failed || !keeping || arrived < since) continue;
      // Never the same time twice, and never backwards.
      const time = Math.max(lastTime + 1, Math.round(keptBefore + (arrived - since)));
      encoder ??= start(frame.displayWidth, frame.displayHeight);
      // A camera that is faster than the film can be made is not waited for.
      if (encoder.encodeQueueSize > 4) continue;
      const stamped = new VideoFrame(frame, { timestamp: time * 1000 });
      encoder.encode(stamped, { keyFrame: frames % KEY_EVERY === 0 });
      stamped.close();
      lastTime = time;
      frames += 1;
    } finally {
      frame.close();
    }
  }
}

scope.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'open') {
    read(message.readable).catch(fail);
  } else if (message.type === 'keep') {
    if (message.on && !keeping) {
      since = message.at;
      keeping = true;
    } else if (!message.on && keeping) {
      keptBefore += Math.max(0, message.at - since);
      keeping = false;
    }
  } else {
    keeping = false;
    void (async () => {
      try {
        await reader?.cancel().catch(() => undefined);
        if (encoder && encoder.state === 'configured') await encoder.flush();
        encoder?.close();
      } catch (error) {
        fail(error);
      }
      hand(true);
      scope.postMessage({ type: 'done', frames });
    })();
  }
};
