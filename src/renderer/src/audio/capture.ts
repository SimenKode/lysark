// The microphone. Sound only, never the camera. Samples arrive in one
// unbroken stream at the project's rate, so a recording can be divided
// between slides without losing or repeating anything at the boundary.
import { encodeWav, wavSamples } from '../../../shared/audio/wav';
import { SAMPLE_RATE } from '../../../shared/render/clock';
import type { SoundReply, SoundRequest } from './soundWorker';
import SoundWorker from './soundWorker?worker';
// "no-inline": the file must be a real file of the program; the content security
// policy does not let a script be loaded from a data: address.
import workletUrl from './capture-worklet.js?url&no-inline';

export interface MicrophoneChoice {
  deviceId: string;
  label: string;
}

export interface CaptureOptions {
  deviceId?: string;
  /** Takes away steady background noise. On unless the owner turns it off. */
  noiseSuppression: boolean;
  /** Lets the system change the loudness as it goes. Off: it pumps the level up in pauses. */
  autoGain: boolean;
}

export class MicrophoneError extends Error {
  constructor(
    public readonly reason: 'denied' | 'missing' | 'busy' | 'other',
    message: string,
  ) {
    super(message);
  }
}

function explain(error: unknown): MicrophoneError {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new MicrophoneError(
      'denied',
      'Lysark får ikke bruke mikrofonen. I Windows: åpne Innstillinger, Personvern og sikkerhet, ' +
        'Mikrofon, og slå på «La skrivebordsapper få tilgang til mikrofonen». I Linux: se at ' +
        'en mikrofon er valgt som inndata i lydinnstillingene.',
    );
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return new MicrophoneError(
      'missing',
      'Fant ingen mikrofon. Koble til en mikrofon, eller velg en annen i lista.',
    );
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return new MicrophoneError(
      'busy',
      'Mikrofonen kan ikke brukes akkurat nå. Et annet program bruker den kanskje.',
    );
  }
  return new MicrophoneError(
    'other',
    `Mikrofonen kunne ikke startes (${error instanceof Error ? error.message : String(error)}).`,
  );
}

/** The microphones the system has. Names are only known once leave to record has been given. */
export async function listMicrophones(): Promise<MicrophoneChoice[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === 'audioinput' && d.deviceId !== 'communications')
    .map((d, i) => ({
      deviceId: d.deviceId,
      label:
        d.deviceId === 'default'
          ? `Systemets valg${d.label ? ` (${d.label.replace(/^Default - |^Standard - /, '')})` : ''}`
          : d.label || `Mikrofon ${i + 1}`,
    }));
}

export interface Capture {
  /** Called on the main thread for every block of samples (about 3 ms each). */
  onSamples: ((block: Float32Array) => void) | null;
  /** The label of the microphone in use. */
  label: string;
  stop(): void;
}

/** Opens the microphone. Nothing is kept until the caller starts keeping the blocks. */
export async function openMicrophone(options: CaptureOptions): Promise<Capture> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(options.deviceId ? { deviceId: { exact: options.deviceId } } : {}),
        channelCount: 1,
        sampleRate: SAMPLE_RATE,
        echoCancellation: false,
        noiseSuppression: options.noiseSuppression,
        autoGainControl: options.autoGain,
      },
      video: false,
    });
  } catch (error) {
    throw explain(error);
  }
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  try {
    await context.audioWorklet.addModule(workletUrl);
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    void context.close();
    throw explain(error);
  }
  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, 'lysark-capture', {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 1,
    channelCountMode: 'explicit',
  });
  const capture: Capture = {
    onSamples: null,
    label: stream.getAudioTracks()[0]?.label ?? '',
    stop() {
      node.port.onmessage = null;
      source.disconnect();
      node.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
    },
  };
  node.port.onmessage = (event: MessageEvent<Float32Array>) => capture.onSamples?.(event.data);
  source.connect(node);
  if (context.state === 'suspended') await context.resume();
  return capture;
}

/**
 * Sound kept as it arrives, gathered into pieces of a second. A stretch of
 * several minutes is then a few hundred pieces rather than tens of thousands
 * of small blocks, and handing it on to be stored costs the window nothing.
 */
export class SoundPieces {
  private full: Float32Array[] = [];
  private tail = new Float32Array(SAMPLE_RATE);
  private used = 0;
  /** How many samples are kept. */
  samples = 0;

  push(block: Float32Array): void {
    let at = 0;
    while (at < block.length) {
      const count = Math.min(block.length - at, this.tail.length - this.used);
      this.tail.set(block.subarray(at, at + count), this.used);
      this.used += count;
      at += count;
      if (this.used === this.tail.length) {
        this.full.push(this.tail);
        this.tail = new Float32Array(SAMPLE_RATE);
        this.used = 0;
      }
    }
    this.samples += block.length;
  }

  /** Hands out everything that is kept, in order, and is empty afterwards. */
  take(): Float32Array[] {
    const out = this.full;
    if (this.used > 0) out.push(this.tail.slice(0, this.used));
    this.full = [];
    this.tail = new Float32Array(SAMPLE_RATE);
    this.used = 0;
    this.samples = 0;
    return out;
  }
}

export interface EncodedSound {
  /** A mono WAV file, 48 kHz, 16 bit. */
  wav: Uint8Array;
  /** The samples as the file holds them. */
  samples: Int16Array;
}

let soundWorker: Worker | null | undefined;
let soundAsked = 0;
const soundWaiting = new Map<
  number,
  { resolve: (sound: EncodedSound) => void; reject: (error: Error) => void }
>();

function encodeHere(pieces: readonly Float32Array[]): EncodedSound {
  let total = 0;
  for (const piece of pieces) total += piece.length;
  const joined = new Float32Array(total);
  let offset = 0;
  for (const piece of pieces) {
    joined.set(piece, offset);
    offset += piece.length;
  }
  const wav = encodeWav(joined);
  return { wav, samples: wavSamples(wav) };
}

/**
 * Makes sound into the project's form, in a thread of its own, so the window
 * goes on drawing meanwhile. The pieces are handed over and cannot be used
 * here afterwards. Where no such thread can be made, it is done here, after
 * the window has drawn what it was about to.
 */
export function encodeSound(pieces: Float32Array[]): Promise<EncodedSound> {
  if (soundWorker === undefined) {
    try {
      soundWorker = new SoundWorker();
      soundWorker.onmessage = (event: MessageEvent<SoundReply>) => {
        const reply = event.data;
        const waiting = soundWaiting.get(reply.id);
        if (!waiting) return;
        soundWaiting.delete(reply.id);
        if ('error' in reply) waiting.reject(new Error(reply.error));
        else waiting.resolve({ wav: reply.wav, samples: reply.samples });
      };
    } catch {
      soundWorker = null;
    }
  }
  const worker = soundWorker;
  if (!worker) {
    return new Promise((resolve, reject) =>
      setTimeout(() => {
        try {
          resolve(encodeHere(pieces));
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      }, 0),
    );
  }
  const id = ++soundAsked;
  return new Promise((resolve, reject) => {
    soundWaiting.set(id, { resolve, reject });
    const request: SoundRequest = { id, pieces };
    worker.postMessage(
      request,
      pieces.map((piece) => piece.buffer as ArrayBuffer),
    );
  });
}

/** The loudest sample of a block, 0..1. */
export function blockPeak(block: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < block.length; i++) {
    const v = Math.abs(block[i]!);
    if (v > peak) peak = v;
  }
  return Math.min(1, peak);
}
