// Exports the lecture as an MP4 video: 1920 x 1080, 30 pictures a second,
// H.264 and AAC, with captions as a WebVTT file next to it.
//
// The video is drawn picture by picture, not recorded from the screen. A
// window that is never shown draws the lecture as it is at time t, the
// picture is taken out as raw pixels and handed to FFmpeg, then t + 1/30 s,
// and so on. The result is the same every time and does not depend on how
// fast the machine is. Where nothing moves (most of a lecture), the same
// picture is handed over again without being drawn anew.
import { BrowserWindow } from 'electron';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LogoStatus, VideoProgress, VideoRequest, VideoSummary } from '../shared/api';
import type { Project, Scene } from '../shared/format/schema';
import { creditScenes, lectureCues, toWebVtt } from '../shared/render/captions';
import {
  GIF_FPS,
  GIF_MAX_SECONDS,
  GIF_WIDTHS,
  SAMPLE_RATE,
  VIDEO_FPS,
  VIDEO_SIZE,
  schedule,
  stillUntil,
  videoOptions,
} from '../shared/render/clock';
import { SCENE_STRINGS } from '../shared/render/scene';
import { sampleReader, writeLectureSound } from './audio';
import { abortFfmpeg, requireFfmpeg, runFfmpeg, writeTo } from './ffmpeg';

const CREDIT_TEXTS = {
  nb: { heading: 'Bildekilder', slide: (n: number[]) => `lysark ${n.join(', ')}` },
  en: { heading: 'Picture credits', slide: (n: number[]) => `slide ${n.join(', ')}` },
};

/**
 * The slides of the video: the ones asked for, and the credits at the end
 * when the owner wants them and the video is the whole lecture.
 */
export function videoScenes(project: Project, request: VideoRequest): Scene[] {
  const last = project.scenes.length - 1;
  const from = Math.max(0, Math.min(last, Math.floor(request.from)));
  const to = Math.max(from, Math.min(last, Math.floor(request.to)));
  const chosen = project.scenes.slice(from, to + 1);
  const whole = from === 0 && to === last;
  if (request.format !== 'mp4' || !whole || !videoOptions(project).credits) return chosen;
  const language = project.meta.language;
  return [...chosen, ...creditScenes(project, SCENE_STRINGS[language], CREDIT_TEXTS[language])];
}

export interface VideoJob {
  cancel(): void;
  done: Promise<VideoSummary | null>;
}

interface Options {
  dir: string;
  project: Project;
  request: VideoRequest;
  outFile: string;
  logo: LogoStatus;
  /** The page that draws the frames (out/renderer/frame.html, or the dev server's). */
  loadFramePage: (window: BrowserWindow) => Promise<void>;
  onProgress: (progress: VideoProgress) => void;
}

/**
 * Resolves when the hidden window has stopped drawing: no new picture for
 * `quiet` milliseconds, or `longest` at the most. A large photo is put on
 * screen a moment after the page says it is ready; a picture taken before
 * that would lack it (seen on Windows and on Linux, 22.11.2026).
 */
function drawingSettled(window: BrowserWindow, quiet: number, longest: number): Promise<void> {
  return new Promise((resolve) => {
    const contents = window.webContents;
    const done = (): void => {
      clearTimeout(timer);
      clearTimeout(limit);
      contents.off('paint', onPaint);
      resolve();
    };
    const onPaint = (): void => {
      clearTimeout(timer);
      timer = setTimeout(done, quiet);
    };
    let timer = setTimeout(done, quiet);
    const limit = setTimeout(done, longest);
    contents.on('paint', onPaint);
  });
}

/** A picture of the hidden window as raw pixels (blue, green, red, alpha), in the video's size. */
async function capture(window: BrowserWindow): Promise<Buffer> {
  let image = await window.webContents.capturePage();
  const size = image.getSize();
  if (size.width !== VIDEO_SIZE.width || size.height !== VIDEO_SIZE.height) {
    // A screen with another scale factor gives a larger or smaller picture.
    image = image.resize({ ...VIDEO_SIZE, quality: 'best' });
  }
  const pixels = image.toBitmap();
  if (pixels.byteLength !== VIDEO_SIZE.width * VIDEO_SIZE.height * 4) {
    throw new Error('Bildet av lysarket fikk feil størrelse.');
  }
  return pixels;
}

export function exportVideo(options: Options): VideoJob {
  const { project, outFile, request } = options;
  requireFfmpeg();
  const gif = request.format === 'gif';
  const scenes = videoScenes(project, request);
  if (scenes.length === 0) throw new Error('Prosjektet har ingen lysark å lage video av.');
  const plan = schedule(scenes);
  if (gif && plan.total > GIF_MAX_SECONDS + 0.5) {
    throw new Error(
      `En GIF kan være høyst ${GIF_MAX_SECONDS / 60} minutter. Velg færre lysark, eller eksporter video.`,
    );
  }
  const gifWidth = GIF_WIDTHS.includes(request.gifWidth as (typeof GIF_WIDTHS)[number])
    ? request.gifWidth
    : 640;
  const { transition, evenLoudness } = videoOptions(project);
  const totalFrames = Math.max(1, Math.ceil(plan.total * VIDEO_FPS));

  let cancelled = false;
  let window: BrowserWindow | null = null;
  let stop: (() => void) | null = null;

  const work = mkdtempSync(join(tmpdir(), 'lysark-video-'));
  const soundFile = join(work, 'lyd.pcm');
  // A GIF is made in two goes: first a video without loss worth mentioning,
  // then the GIF from it, with colours chosen for exactly these pictures.
  const videoFile = gif ? join(work, 'mellom.mp4') : outFile;

  const run = async (): Promise<VideoSummary | null> => {
    options.onProgress({ phase: 'sound', frame: 0, frames: totalFrames });
    if (!gif) writeLectureSound(soundFile, scenes, plan, sampleReader(options.dir, project));

    window = new BrowserWindow({
      show: false,
      width: VIDEO_SIZE.width,
      height: VIDEO_SIZE.height,
      useContentSize: true,
      frame: false,
      enableLargerThanScreen: true,
      skipTaskbar: true,
      focusable: false,
      webPreferences: {
        // Drawn in memory, never on the owner's screen.
        offscreen: true,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    window.webContents.setAudioMuted(true);
    window.webContents.setFrameRate(60);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    await options.loadFramePage(window);
    window.setContentSize(VIDEO_SIZE.width, VIDEO_SIZE.height);
    const job = { project, scenes, logo: options.logo, transition };
    await window.webContents.executeJavaScript(
      `window.lysarkFrame.load(${JSON.stringify(job)})`,
      true,
    );

    const pictures = [
      '-y',
      // Pictures: raw pixels on standard input.
      '-f',
      'rawvideo',
      '-pix_fmt',
      'bgra',
      '-s',
      `${VIDEO_SIZE.width}x${VIDEO_SIZE.height}`,
      '-r',
      String(VIDEO_FPS),
      '-i',
      'pipe:0',
    ];
    const ffmpeg = runFfmpeg(
      gif
        ? [
            ...pictures,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '10',
            '-pix_fmt',
            'yuv444p',
            '-frames:v',
            String(totalFrames),
            videoFile,
          ]
        : [
            ...pictures,
            // Sound: the samples written above.
            '-f',
            's16le',
            '-ar',
            String(SAMPLE_RATE),
            '-ac',
            '1',
            '-i',
            soundFile,
            '-c:v',
            'libx264',
            '-preset',
            'medium',
            '-crf',
            '20',
            '-pix_fmt',
            'yuv420p',
            '-g',
            String(VIDEO_FPS * 2),
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            ...(evenLoudness
              ? ['-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', String(SAMPLE_RATE)]
              : []),
            '-movflags',
            '+faststart',
            '-map_metadata',
            '-1',
            '-metadata',
            `title=${project.meta.title}`,
            '-frames:v',
            String(totalFrames),
            videoFile,
          ],
    );
    stop = () => abortFfmpeg(ffmpeg);
    let failed: Error | null = null;
    ffmpeg.done.catch((error: Error) => {
      failed = error;
    });

    let pixels: Buffer | null = null;
    let still = -1; // the last frame (number) the current picture is good for
    for (let frame = 0; frame < totalFrames; frame++) {
      if (cancelled) break;
      if (failed) throw failed;
      const time = frame / VIDEO_FPS;
      if (!pixels || frame > still) {
        const draw = (): Promise<boolean> =>
          window!.webContents.executeJavaScript(`window.lysarkFrame.draw(${time})`, true);
        // A slide that is drawn for the first time is first shown whole, to
        // bring its pictures in; when that has settled, the moment itself.
        for (let round = 0; (await draw()) && round < 3; round++) {
          await drawingSettled(window, 200, 4000);
        }
        const until = stillUntil(scenes, plan, time, transition);
        // A picture that will stand for a while is worth a moment's wait.
        if (until > time) await drawingSettled(window, 100, 1500);
        pixels = await capture(window);
        // The picture holds for every frame that starts before the next change.
        still = until > time ? Math.ceil(until * VIDEO_FPS - 1e-6) - 1 : frame;
      }
      // Drawing a new slide can take a moment; the owner may have cancelled meanwhile.
      if (cancelled) break;
      await writeTo(ffmpeg, pixels);
      if (frame % 15 === 0 || frame === totalFrames - 1) {
        options.onProgress({ phase: 'frames', frame: frame + 1, frames: totalFrames });
      }
    }
    if (cancelled) {
      abortFfmpeg(ffmpeg);
      await ffmpeg.done.catch(() => undefined);
      return null;
    }
    options.onProgress({ phase: 'finishing', frame: totalFrames, frames: totalFrames });
    ffmpeg.process.stdin.end();
    await ffmpeg.done;

    if (gif) {
      options.onProgress({ phase: 'gif', frame: totalFrames, frames: totalFrames });
      const shape = `fps=${GIF_FPS},scale=${gifWidth}:-2:flags=lanczos`;
      const palette = join(work, 'farger.png');
      // The colours a GIF may use (256 at the most), chosen from these very pictures.
      const first = runFfmpeg([
        '-y',
        '-i',
        videoFile,
        '-vf',
        `${shape},palettegen=stats_mode=diff`,
        palette,
      ]);
      stop = () => abortFfmpeg(first);
      await first.done;
      if (cancelled) return null;
      const second = runFfmpeg([
        '-y',
        '-i',
        videoFile,
        '-i',
        palette,
        '-lavfi',
        `${shape}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
        '-loop',
        '0',
        outFile,
      ]);
      stop = () => abortFfmpeg(second);
      await second.done;
      if (cancelled) return null;
      return {
        format: 'gif',
        path: outFile,
        bytes: statSync(outFile).size,
        seconds: totalFrames / VIDEO_FPS,
      };
    }

    const cues = lectureCues(scenes, plan);
    let captions: string | undefined;
    if (cues.length > 0) {
      captions = outFile.replace(/\.[^./\\]+$/, '') + '.vtt';
      writeFileSync(captions, toWebVtt(cues, project.meta.language), 'utf8');
    }
    return {
      format: 'mp4',
      path: outFile,
      bytes: statSync(outFile).size,
      seconds: totalFrames / VIDEO_FPS,
      captions,
    };
  };

  const done = run()
    .catch((error) => {
      stop?.();
      // Stopping FFmpeg in the middle of a frame makes the hand-over fail;
      // when the owner asked for the stop, that is not an error to show.
      if (cancelled) return null;
      throw error;
    })
    .finally(() => {
      if (window && !window.isDestroyed()) window.destroy();
      rmSync(work, { recursive: true, force: true });
    })
    .then((summary) => {
      // A cancelled or failed export leaves no half-made file behind.
      if (!summary) rmSync(outFile, { force: true });
      return summary;
    })
    .catch((error) => {
      rmSync(outFile, { force: true });
      throw error;
    });

  return {
    cancel() {
      cancelled = true;
      // FFmpeg is stopped at once, so nothing is left running if the program closes.
      stop?.();
    },
    done,
  };
}
