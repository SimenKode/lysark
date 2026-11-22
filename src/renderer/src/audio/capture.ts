// The microphone. Sound only, never the camera. Samples arrive in one
// unbroken stream at the project's rate, so a recording can be divided
// between slides without losing or repeating anything at the boundary.
import { SAMPLE_RATE } from '../../../shared/render/clock';
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

/** Joins blocks of samples into one row. */
export function joinBlocks(blocks: readonly Float32Array[]): Float32Array {
  let total = 0;
  for (const block of blocks) total += block.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const block of blocks) {
    out.set(block, offset);
    offset += block.length;
  }
  return out;
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
