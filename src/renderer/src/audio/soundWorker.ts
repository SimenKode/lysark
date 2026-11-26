// Makes the sound of one stretch of a recording into the project's form (a
// mono WAV file, 48 kHz, 16 bit) in a thread of its own. A stretch can be
// minutes long, and the work is done the moment the lecturer goes to another
// slide: done in the window, it would hold up the drawing of the new slide.
import { encodeWav, wavSamples } from '../../../shared/audio/wav';

interface Scope {
  onmessage: ((event: MessageEvent<SoundRequest>) => void) | null;
  postMessage(message: SoundReply, transfer?: Transferable[]): void;
}

export interface SoundRequest {
  id: number;
  /** The sound, in order, as numbers from -1 to 1. */
  pieces: Float32Array[];
}

export type SoundReply =
  | {
      id: number;
      /** The WAV file, and the samples as the file holds them. */
      wav: Uint8Array;
      samples: Int16Array;
    }
  | { id: number; error: string };

const scope = self as unknown as Scope;

scope.onmessage = (event) => {
  const { id, pieces } = event.data;
  try {
    let total = 0;
    for (const piece of pieces) total += piece.length;
    const joined = new Float32Array(total);
    let offset = 0;
    for (const piece of pieces) {
      joined.set(piece, offset);
      offset += piece.length;
    }
    const wav = encodeWav(joined);
    const samples = wavSamples(wav);
    scope.postMessage({ id, wav, samples }, [wav.buffer, samples.buffer]);
  } catch (error) {
    scope.postMessage({ id, error: String(error) });
  }
};
