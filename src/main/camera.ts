// The camera circle in the main process: storing the film of the lecturer's
// face that was taken while a slide was read in, and handing its pictures to
// the video export one by one.
//
// A film is stored in the project folder, like the recordings, and sent
// nowhere. FFmpeg makes it even (square, 30 pictures a second, a full
// picture every half second) so that any moment of it can be found exactly.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddedMedia } from '../shared/api';
import { newId } from '../shared/format/factory';
import type { Project } from '../shared/format/schema';
import { cameraFaceSize } from '../shared/render/cameraDraw';
import { CAMERA_FILM_SIZE, CAMERA_FPS } from '../shared/render/clock';
import { abortFfmpeg, runFfmpeg, type FfmpegRun } from './ffmpeg';
import { mediaPath } from './projectIo';

const MAX_FILM_BYTES = 1024 * 1024 * 1024;

/**
 * Stores a film taken by the camera while a slide was read in. `data` is
 * what the interface recorded (WebM); it is made into the project's own
 * form: square, without sound, with even time from the first picture.
 */
export async function addCameraFilm(
  dir: string,
  data: Uint8Array,
  name: string,
): Promise<AddedMedia> {
  if (!(data instanceof Uint8Array) || data.byteLength === 0 || data.byteLength > MAX_FILM_BYTES) {
    throw new Error('Kameraopptaket kan ikke lagres.');
  }
  const work = mkdtempSync(join(tmpdir(), 'lysark-kamera-'));
  const source = join(work, 'inn.webm');
  const made = join(work, 'ut.mp4');
  try {
    writeFileSync(source, data);
    const side = CAMERA_FILM_SIZE;
    await runFfmpeg([
      '-y',
      '-i',
      source,
      '-an',
      '-vf',
      // The middle of the picture, as a square; time counted from the moment
      // the recording began, so the film and the sound start together.
      `crop='min(iw,ih)':'min(iw,ih)',scale=${side}:${side}:flags=bicubic,fps=${CAMERA_FPS}:start_time=0`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '21',
      '-g',
      String(CAMERA_FPS / 2),
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-map_metadata',
      '-1',
      made,
    ]).done;
    const film = new Uint8Array(readFileSync(made));
    const hash = createHash('sha256').update(film).digest('hex').slice(0, 16);
    const file = `media/kamera-${hash}.mp4`;
    mkdirSync(join(dir, 'media'), { recursive: true });
    const target = mediaPath(dir, file);
    if (!existsSync(target)) writeFileSync(target, film);
    return {
      id: newId('a'),
      asset: {
        kind: 'camera',
        file,
        mime: 'video/mp4',
        bytes: film.byteLength,
        name: name.replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 80) || 'Kamera',
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Kameraopptaket kunne ikke lagres. ${reason}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Pictures of a fixed size, read one at a time from what FFmpeg writes. */
async function* pictures(run: FfmpegRun, bytes: number): AsyncGenerator<Buffer, void, void> {
  let held: Buffer = Buffer.alloc(0);
  for await (const chunk of run.process.stdout as AsyncIterable<Buffer>) {
    held = held.length === 0 ? chunk : Buffer.concat([held, chunk]);
    while (held.length >= bytes) {
      // A copy: the caller keeps the picture while more is read.
      yield Buffer.from(held.subarray(0, bytes));
      held = held.subarray(bytes);
    }
  }
}

/**
 * Hands out the pictures of the camera films to the video export. The
 * export asks for one picture after the other, so a film is read in a
 * stream from where it is first needed; a jump starts a new stream.
 */
export class CameraFilms {
  private key = '';
  private run: FfmpegRun | null = null;
  private stream: AsyncGenerator<Buffer, void, void> | null = null;
  /** The picture that was handed out last, and its number in the film. */
  private picture: Buffer | null = null;
  private number = -1;
  private ended = false;

  constructor(
    private readonly dir: string,
    private readonly project: Project,
  ) {}

  /**
   * The picture of film `assetId` at `time` seconds, as raw pixels (blue,
   * green, red, alpha) for a circle `diameter` wide. Undefined when the film
   * cannot be read; after its end, its last picture.
   */
  async pictureAt(assetId: string, time: number, diameter: number): Promise<Buffer | undefined> {
    const asset = this.project.assets[assetId];
    if (!asset || asset.kind !== 'camera') return undefined;
    const side = cameraFaceSize(diameter);
    const wanted = Math.max(0, Math.round(time * CAMERA_FPS));
    const key = `${assetId}|${side}`;
    const ahead = wanted - this.number;
    if (key !== this.key || ahead < 0 || ahead > CAMERA_FPS) {
      this.open(key, mediaPath(this.dir, asset.file), wanted, side);
    }
    while (this.number < wanted && !this.ended && this.stream) {
      let next: IteratorResult<Buffer, void>;
      try {
        next = await this.stream.next();
      } catch {
        next = { done: true, value: undefined };
      }
      if (next.done || !next.value) {
        this.ended = true;
        break;
      }
      this.picture = next.value;
      this.number += 1;
    }
    return this.picture ?? undefined;
  }

  private open(key: string, file: string, from: number, side: number): void {
    this.close();
    this.key = key;
    this.picture = null;
    this.number = from - 1;
    this.ended = false;
    const run = runFfmpeg([
      // Half a picture early, so the picture that belongs to `from` is the first one out.
      '-ss',
      (Math.max(0, from - 0.5) / CAMERA_FPS).toFixed(4),
      '-i',
      file,
      '-an',
      '-vf',
      `scale=${side}:${side}:flags=area`,
      '-f',
      'rawvideo',
      '-pix_fmt',
      'bgra',
      'pipe:1',
    ]);
    // A stream that is dropped half-way ends with an error; that is expected.
    run.done.catch(() => undefined);
    this.run = run;
    this.stream = pictures(run, side * side * 4);
  }

  close(): void {
    if (this.run) abortFfmpeg(this.run);
    void this.stream?.return().catch(() => undefined);
    this.run = null;
    this.stream = null;
    this.key = '';
  }
}
