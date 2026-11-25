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
