// Finds and starts FFmpeg. FFmpeg is a separate program that lies next to
// Lysark (GPL, see vendor/ffmpeg/*/BUILD.txt and tools/fetch-ffmpeg.mjs);
// nothing of it is linked into Lysark. It is started only for what the
// owner asks for: exporting video, and turning sound into the formats the
// project and the exported HTML use. It never touches the network.
import { app } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const PROGRAM = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

/** Path of the FFmpeg program, or undefined when it is not there. */
export function ffmpegPath(): string | undefined {
  const candidates = [
    // Tests and developers can point at another build.
    process.env.LYSARK_FFMPEG,
    // Packaged: electron-builder places it in the resources folder.
    join(process.resourcesPath ?? '', 'ffmpeg', PROGRAM),
    // From source: where tools/fetch-ffmpeg.mjs puts it.
    join(app.getAppPath(), 'vendor', 'ffmpeg', `${process.platform}-${process.arch}`, PROGRAM),
  ];
  return candidates.find((file): file is string => !!file && existsSync(file));
}

export function requireFfmpeg(): string {
  const file = ffmpegPath();
  if (!file) {
    throw new Error(
      'FFmpeg mangler. Lysark bruker FFmpeg til video og lyd, og det skal ligge ved siden av ' +
        'programmet. Kjører du fra kildekoden, hentes det med «node tools/fetch-ffmpeg.mjs».',
    );
  }
  return file;
}

export interface FfmpegRun {
  process: ChildProcessWithoutNullStreams;
  /** Resolves when FFmpeg has finished well; rejects with its last lines otherwise. */
  done: Promise<void>;
}

/** Starts FFmpeg with the given arguments. It never asks questions and never reads the terminal. */
export function runFfmpeg(args: string[]): FfmpegRun {
  const child = spawn(
    requireFfmpeg(),
    ['-hide_banner', '-nostdin', '-loglevel', 'error', ...args],
    {
      windowsHide: true,
    },
  );
  let errors = '';
  child.stderr.on('data', (chunk: Buffer) => {
    errors = (errors + chunk.toString('utf8')).slice(-2000);
  });
  const done = new Promise<void>((resolve, reject) => {
    child.on('error', (error) =>
      reject(new Error(`FFmpeg kunne ikke startes (${error.message}).`)),
    );
    child.on('close', (code, signal) => {
      if (code === 0) resolve();
      else if (signal) reject(new Error('FFmpeg ble avbrutt.'));
      else
        reject(new Error(`FFmpeg ga opp (kode ${code}). ${errors.trim().split('\n').pop() ?? ''}`));
    });
  });
  // A write to a program that has stopped must not bring Lysark down.
  child.stdin.on('error', () => undefined);
  return { process: child, done };
}

/**
 * Stops FFmpeg at once, when its result is not wanted (a cancelled export).
 * Closing its input alone is not enough, and a polite signal can be left
 * unanswered while it waits for more input.
 */
export function abortFfmpeg(run: FfmpegRun): void {
  run.process.stdin.destroy();
  run.process.kill('SIGKILL');
}

/** Writes to FFmpeg's input, waiting when it cannot take more yet. */
export function writeTo(run: FfmpegRun, data: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const stdin = run.process.stdin;
    if (stdin.destroyed || !stdin.writable) {
      reject(new Error('FFmpeg tar ikke imot mer.'));
      return;
    }
    if (stdin.write(data)) {
      resolve();
      return;
    }
    // Wait until FFmpeg has taken it; if FFmpeg stops meanwhile, do not wait for ever.
    const done = (): void => {
      stdin.off('drain', done);
      stdin.off('close', done);
      resolve();
    };
    stdin.once('drain', done);
    stdin.once('close', done);
  });
}
