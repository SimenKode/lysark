// The camera in the recording window. It is opened only when the owner has
// switched it on there, and closed with the window. What it sees is shown
// in the camera circle and, while a slide is read in, kept as a film of
// that slide. Pictures only: the sound comes from the microphone.
import { CAMERA_FILM_SIZE, CAMERA_FPS } from '../../../shared/render/clock';

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

/** The film of one slide while it is being taken. */
export interface FilmTake {
  /** Holds the film still while the reading is paused. */
  pause(): void;
  resume(): void;
  /**
   * Ends the take. Resolves with the film as it was recorded, or with null
   * when nothing was taken.
   */
  stop(): Promise<Uint8Array | null>;
}

/**
 * Starts filming what the camera sees. `onStart` is called when the first
 * picture is on its way, so the caller can note how far the sound had come.
 */
export function startFilm(stream: MediaStream, onStart: () => void): FilmTake | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const type = ['video/webm;codecs=vp8', 'video/webm'].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
  if (!type) return null;
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_000_000 });
  } catch {
    return null;
  }
  const parts: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) parts.push(event.data);
  };
  recorder.onstart = onStart;
  const ended = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => resolve();
  });
  try {
    recorder.start(1000);
  } catch {
    return null;
  }
  return {
    pause() {
      if (recorder.state === 'recording') recorder.pause();
    },
    resume() {
      if (recorder.state === 'paused') recorder.resume();
    },
    async stop() {
      if (recorder.state !== 'inactive') recorder.stop();
      await ended;
      if (parts.length === 0) return null;
      return new Uint8Array(await new Blob(parts, { type }).arrayBuffer());
    },
  };
}
