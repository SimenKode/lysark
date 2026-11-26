// The camera in the recording window. It is opened only when the owner has
// switched it on there, and closed with the window. What it sees is shown
// in the camera circle and, while the lecturer reads, kept as one film of
// the whole recording. Pictures only: the sound comes from the microphone.
import { CAMERA_FILM_SIZE, CAMERA_FPS } from '../../../shared/render/clock';
import type { FilmMessage, FilmReply } from './filmWorker';
import FilmWorker from './filmWorker?worker';

export interface CameraChoice {
  deviceId: string;
  label: string;
}

export class CameraError extends Error {}

/** The cameras the system has. Their names are known only after one has been opened. */
export async function listCameras(): Promise<CameraChoice[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Kamera ${index + 1}`,
    }));
}

export async function openCamera(deviceId: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('Kameraet kan ikke brukes på denne maskinen.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        // A little more than the film needs; the film is the square in the middle.
        width: { ideal: 640 },
        height: { ideal: CAMERA_FILM_SIZE },
        frameRate: { ideal: CAMERA_FPS },
      },
    });
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      throw new CameraError('Fant ikke noe kamera. Koble til et kamera, eller les inn uten.');
    }
    if (name === 'NotReadableError') {
      throw new CameraError(
        'Kameraet er i bruk av et annet program. Lukk det andre programmet og prøv igjen.',
      );
    }
    if (name === 'NotAllowedError') {
      throw new CameraError(
        'Lysark får ikke bruke kameraet. Se etter i systemets innstillinger for personvern.',
      );
    }
    throw new CameraError('Kameraet kunne ikke åpnes.');
  }
}

/** The film of a recording while it is being taken. */
export interface Film {
  /** Pictures are kept from now on, or (while the reading is paused) left out. */
  keep(on: boolean): void;
  /**
   * How many seconds of film have been kept so far: the moment of the film
   * that is being taken right now.
   */
  time(): number;
  /**
   * Ends the film. Resolves, when every piece has been handed over, with the
   * number of pictures it got.
   */
  end(): Promise<number>;
}

/**
 * Which moment of the film belongs to a moment of the sound.
 *
 * The film keeps the time by the clock, the sound by its samples, and the
 * sound reaches the window in small blocks. While the window is busy (a new
 * slide is drawn, or the lecturer presses the arrow while it is) the blocks
 * wait and come afterwards, all at once. A slide's stretch begins where the
 * sound stands when the arrow is handled, so its film must begin at the
 * moment of the film that belongs to that sound, not at the moment on the
 * clock: otherwise the face jumps forward where the slide changes and runs
 * ahead of the voice through the whole slide (measured: 0.8 s after the
 * window had been busy for 0.8 s).
 *
 * Every block that arrives says how far the film's clock is ahead of the
 * sound. The least of that lately is the lead the sound has when nothing
 * holds it up; it also follows a clock that runs a little apart from the
 * sound card's.
 */
export class FilmSync {
  /** The least lead seen in each of the last seconds, by second of film. */
  private least = new Map<number, number>();

  /** A block of sound has arrived: the film stands at `film` seconds, the sound at `sound`. */
  note(film: number, sound: number): void {
    const second = Math.floor(film);
    const lead = film - sound;
    const was = this.least.get(second);
    if (was === undefined || lead < was) this.least.set(second, lead);
    if (this.least.size > SYNC_SECONDS) {
      for (const key of this.least.keys()) {
        if (key <= second - SYNC_SECONDS) this.least.delete(key);
      }
    }
  }

  /** Forgets what was seen (the sound was read anew, while the film went on). */
  reset(): void {
    this.least.clear();
  }

  /**
   * The moment of the film that belongs to `sound` seconds of sound, never
   * later than the film has come (`now`). Without anything seen yet, `now`.
   */
  filmAt(sound: number, now: number): number {
    if (this.least.size === 0) return now;
    let lead = Infinity;
    for (const value of this.least.values()) lead = Math.min(lead, value);
    return Math.max(0, Math.min(now, sound + lead));
  }
}

/** How many seconds back the lead of the sound is looked for. */
const SYNC_SECONDS = 8;

/** Chromium's way of reading a camera picture by picture; not yet in TypeScript's own list. */
declare const MediaStreamTrackProcessor:
  (new (init: { track: MediaStreamTrack }) => { readable: ReadableStream<VideoFrame> }) | undefined;

/**
 * Starts the film of a recording. Nothing is kept until `keep(true)`. The
 * film is made in a thread of its own (filmWorker.ts) and handed to `sink`
 * a piece at a time, in order. One film runs through the whole recording,
 * however the lecturer moves between the slides: the pictures never stop
 * where a slide ends.
 */
export function startFilm(
  stream: MediaStream,
  sink: (piece: Uint8Array) => Promise<void>,
): Film | null {
  const track = stream.getVideoTracks()[0];
  if (!track || typeof MediaStreamTrackProcessor === 'undefined') return null;
  if (typeof VideoEncoder === 'undefined') return null;
  let worker: Worker;
  try {
    const processor = new MediaStreamTrackProcessor({ track });
    worker = new FilmWorker();
    const open: FilmMessage = { type: 'open', readable: processor.readable };
    worker.postMessage(open, [processor.readable]);
  } catch {
    return null;
  }
  const say = (message: FilmMessage): void => worker.postMessage(message);
  const now = (): number => performance.timeOrigin + performance.now();
  // The same count as the worker keeps, from the same moments.
  let keeping = false;
  let keptBefore = 0;
  let since = 0;
  let handed = Promise.resolve();
  let frames = 0;
  let finish: (() => void) | null = null;
  const done = new Promise<void>((resolve) => (finish = resolve));
  worker.onmessage = (event: MessageEvent<FilmReply>) => {
    const reply = event.data;
    if (reply.type === 'data') {
      const piece = new Uint8Array(reply.bytes);
      // A piece that cannot be stored ends the film; the sound is kept all the same.
      handed = handed.then(() => sink(piece)).catch(() => undefined);
    } else {
      if (reply.type === 'done') frames = reply.frames;
      finish?.();
    }
  };
  worker.onerror = () => finish?.();
  return {
    keep(on) {
      if (on === keeping) return;
      const at = now();
      if (on) since = at;
      else keptBefore += Math.max(0, at - since);
      keeping = on;
      say({ type: 'keep', on, at });
    },
    time() {
      return (keptBefore + (keeping ? Math.max(0, now() - since) : 0)) / 1000;
    },
    async end() {
      this.keep(false);
      say({ type: 'end' });
      await done;
      await handed;
      worker.terminate();
      return frames;
    },
  };
}
