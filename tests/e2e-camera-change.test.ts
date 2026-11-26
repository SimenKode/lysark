// The film of the lecturer's face goes on evenly where the lecturer goes from
// one slide to another while reading, also onto a slide with a large page
// picture (as a slide imported from a PDF has), and also when the window is
// busy right at that moment. The film is read as it is handed over (the
// pictures and the time each was given), and the gaps between pictures
// around each change are measured.
// Needs `npm run build` and FFmpeg in vendor/ffmpeg (to make the large test
// pictures). The window is never shown, the camera and the microphone are
// Chromium's fake ones (a test picture and beeps; never a real camera), and
// nothing touches the network.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import type { Project } from '../src/shared/format/schema';
import { OFFLINE } from './fixtures/offline';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
const ffmpeg =
  process.env.LYSARK_FFMPEG ??
  join(
    root,
    'vendor/ffmpeg',
    `${process.platform}-${process.arch}`,
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
  );

/** As large as the page picture of a slide imported from a PDF can be. */
const PICTURE = { w: 3840, h: 2160 };
/** How long the window is kept busy on purpose at the second change. */
const BUSY_MS = 800;
/**
 * The largest gap between two pictures of the film that is let through
 * around a change. The fake camera gives a picture every 33 ms; before the
 * film was made independent of the window, the busy change left a gap of
 * the whole busy time. This leaves room for a heavily loaded machine.
 */
const MAX_GAP_MS = 400;
/** How far the film may jump where a slide changes. One picture is 33 ms. */
const MAX_JUMP_MS = 150;
/**
 * How long the first slide is read. Its sound is stored when the lecturer
 * leaves the slide after it, so that change also carries the work of
 * storing a long stretch.
 */
const LONG_MS = 20_000;

/** The times (in milliseconds of the recording) of the pictures in an IVF file, as far as it is whole. */
function ivfTimes(data: Buffer): number[] {
  const times: number[] = [];
  if (data.length < 32 || data.toString('latin1', 0, 4) !== 'DKIF') return times;
  let at = data.readUInt16LE(6);
  while (at + 12 <= data.length) {
    const size = data.readUInt32LE(at);
    if (at + 12 + size > data.length) break;
    times.push(Number(data.readBigUInt64LE(at + 4)));
    at += 12 + size;
  }
  return times;
}

interface Around {
  /** How many pictures there are in that stretch. */
  pictures: number;
  /** The largest gap between two pictures from a second before the change to two after. */
  largest: number;
  /** Pictures that came less than 5 ms after the one before: a burst squeezed together. */
  squeezed: number;
  /** The usual gap in the same stretch. */
  usual: number;
}

function around(times: number[], change: number): Around {
  const near = times.filter((t) => t >= change - 1000 && t <= change + 2000);
  const gaps = near.slice(1).map((t, i) => t - near[i]!);
  const sorted = [...gaps].sort((a, b) => a - b);
  return {
    pictures: near.length,
    largest: gaps.length > 0 ? Math.max(...gaps) : Infinity,
    squeezed: gaps.filter((gap) => gap < 5).length,
    usual: sorted[Math.floor(sorted.length / 2)] ?? Infinity,
  };
}

describe.skipIf(!built || !existsSync(ffmpeg))('the film where the slide changes', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;

  const saved = (): Project =>
    JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-skifte-'));
    projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    // The program's own temporary files (the film as it is handed over) go here.
    mkdirSync(join(work, 'tmp'));
    const project = newProject('Testforelesning');
    for (const [index, name] of ['A', 'B', 'C', 'D', 'E'].entries()) {
      const scene = newScene('content', `Lysark ${name}`);
      scene.id = `s_${name}`;
      scene.showLogo = false;
      if (index > 0) {
        // A picture of grey noise behind the slide, different on every slide.
        const file = `side-${name}.webp`;
        execFileSync(ffmpeg, [
          '-v',
          'error',
          '-y',
          '-f',
          'lavfi',
          '-i',
          `color=c=gray:s=${PICTURE.w}x${PICTURE.h},noise=alls=40:allf=u:all_seed=${index}`,
          '-frames:v',
          '1',
          '-c:v',
          'libwebp',
          '-quality',
          '85',
          join(projectDir, 'media', file),
        ]);
        project.assets[`a_side_${name}`] = {
          kind: 'image',
          file: `media/${file}`,
          mime: 'image/webp',
          bytes: statSync(join(projectDir, 'media', file)).size,
          name: file,
        };
        scene.elements.push({
          id: `e_side_${name}`,
          type: 'image',
          asset: `a_side_${name}`,
          alt: '',
          decorative: true,
          box: { x: 0, y: 0, w: 1920, h: 1080, rotation: 0 },
        });
      }
      scene.elements.push({
        id: `e_tittel_${name}`,
        type: 'text',
        role: 'title',
        content: richText(`Overskrift ${name}`),
        align: 'left',
        valign: 'top',
        box: { x: 120, y: 96, w: 1000, h: 90, rotation: 0 },
      });
      project.scenes.push(scene);
    }
    writeFileSync(join(projectDir, 'prosjekt.json'), JSON.stringify(project, null, 2), 'utf8');

    app = await electron.launch({
      args: [
        root,
        OFFLINE,
        `--user-data-dir=${join(work, 'userdata')}`,
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        projectDir,
      ],
      env: { ...process.env, LYSARK_HIDDEN: '1', TMPDIR: join(work, 'tmp') },
    });
    page = await app.firstWindow();
    await page.waitForSelector('.app');
  }, 60_000);

  afterAll(async () => {
    await app
      ?.evaluate(({ dialog }) => {
        dialog.showMessageBoxSync = () => 1; // "Ikke lagre"
      })
      .catch(() => undefined);
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('keeps the pictures even across a change onto a heavy slide, also when the window is busy', async () => {
    await page.getByRole('tab', { name: /^Lyd/ }).click();
    await page.getByRole('button', { name: 'Les inn', exact: true }).click();
    const recorder = page.locator('.recorder');
    await recorder.waitFor();
    await recorder.getByLabel('Kamera', { exact: true }).check();
    const live = recorder.locator('.camera-circle video');
    await expect
      .poll(() => live.evaluate((v: HTMLVideoElement) => v.videoWidth))
      .toBeGreaterThan(0);
    // The live circle is marked, to see that it is the same one after the changes.
    await live.evaluate((v: HTMLVideoElement) => (v.dataset.probe = 'same'));
    const where = (): Promise<string | null> => recorder.locator('.recorder-where').textContent();
    // What keeps the window busy for longer than 50 ms.
    await page.evaluate(() => {
      const long: number[][] = [];
      (window as unknown as { long: number[][] }).long = long;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) long.push([entry.startTime, entry.duration]);
      }).observe({ type: 'longtask', buffered: true });
    });
    /** The moments of the changes, by the window's clock. */
    const marks: number[] = [];
    const mark = async (): Promise<void> => {
      marks.push(await page.evaluate(() => performance.now()));
    };
    /**
     * The right arrow, as the window gets it from the keyboard. Resolves with
     * how long the window was busy handling it, the new slide drawn into the
     * page included (React draws what an arrow changes before it lets go).
     */
    const arrow = (): Promise<number> =>
      page.evaluate(async () => {
        const target = document.querySelector('.recorder')!;
        const start = performance.now();
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        // React draws in a task of its own right after the event: wait for it.
        await new Promise<void>((done) => queueMicrotask(done));
        return performance.now() - start;
      });
    const handled: number[] = [];
    /** How many pictures the live circle got in 800 ms, while the window is idle. */
    const liveFrames = (): Promise<number> =>
      live.evaluate(async (video: HTMLVideoElement) => {
        const before = video.getVideoPlaybackQuality().totalVideoFrames;
        await new Promise((done) => setTimeout(done, 800));
        return video.getVideoPlaybackQuality().totalVideoFrames - before;
      });
    const liveAfter: number[] = [];

    await recorder.getByRole('button', { name: 'Start opptak' }).click();
    await recorder.locator('.recorder-clock.is-on').waitFor({ timeout: 15_000 });
    const began = Date.now();
    await page.waitForTimeout(LONG_MS);
    // An ordinary change, onto a slide with a large picture.
    liveAfter.push(await liveFrames());
    await mark();
    handled.push(await arrow());
    await expect.poll(where).toContain('Lysark 2');
    liveAfter.push(await liveFrames());
    await page.waitForTimeout(2500);
    // Another, onto the next large picture; the long first stretch is stored now.
    await mark();
    handled.push(await arrow());
    await expect.poll(where).toContain('Lysark 3');
    await page.waitForTimeout(2500);
    // A change, and right after it the window is kept busy on purpose.
    await mark();
    // The live circle's player is asked how many pictures it got meanwhile.
    const delivered = await page.evaluate((busy) => {
      const target = document.querySelector('.recorder')!;
      const video = document.querySelector<HTMLVideoElement>('.recorder .camera-circle video')!;
      const before = video.getVideoPlaybackQuality();
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      const end = performance.now() + busy;
      while (performance.now() < end) {
        // Nothing: the window is busy.
      }
      const after = video.getVideoPlaybackQuality();
      return {
        got: after.totalVideoFrames - before.totalVideoFrames,
        dropped: after.droppedVideoFrames - before.droppedVideoFrames,
      };
    }, BUSY_MS);
    await expect.poll(where).toContain('Lysark 4');
    await page.waitForTimeout(2500);
    // The window is busy, and the lecturer presses the arrow meanwhile.
    await mark();
    const busyNow = page.evaluate((busy) => {
      const end = performance.now() + busy;
      while (performance.now() < end) {
        // Nothing: the window is busy.
      }
    }, BUSY_MS);
    await page.waitForTimeout(150);
    await page.keyboard.press('ArrowRight');
    await busyNow;
    await expect.poll(where).toContain('Lysark 5');
    liveAfter.push(await liveFrames());
    const lastChange = Date.now() - began;
    expect(await live.evaluate((v: HTMLVideoElement) => v.dataset.probe)).toBe('same');

    // The film as it is handed over, until it reaches well past the last change.
    const folder = readdirSync(join(work, 'tmp')).find((name) => name.startsWith('lysark-kamera-'));
    expect(folder).toBeDefined();
    const film = join(work, 'tmp', folder!, 'inn.ivf');
    let times: number[] = [];
    await expect
      .poll(
        () => {
          times = ivfTimes(readFileSync(film));
          return times.at(-1) ?? 0;
        },
        { timeout: 40_000, interval: 250 },
      )
      .toBeGreaterThan(lastChange + 2500);

    await recorder.getByRole('button', { name: 'Ferdig' }).click();
    await recorder.waitFor({ state: 'detached', timeout: 15_000 });
    await expect
      .poll(() => page.locator('.notice').textContent(), { timeout: 60_000 })
      .toContain('Opptaket er lagt på');
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
    const project = saved();
    const stretches = ['s_A', 's_B', 's_C', 's_D', 's_E'].map((id) => {
      const clip = project.scenes.find((s) => s.id === id)!.audio!.clips[0]!;
      const asset = project.assets[clip.kind === 'sound' ? clip.asset : '']!;
      return {
        /** Where in the film the slide's stretch began, in milliseconds. */
        filmAt: -asset.camera!.offset * 1000,
        /** How long its sound is, in milliseconds. */
        length: clip.kind === 'sound' ? (clip.to - clip.from) * 1000 : 0,
      };
    });
    const long = await page.evaluate(() => (window as unknown as { long: number[][] }).long);
    /** The window's work right at each change. */
    const busyness = marks.map((at, n) => ({
      ...(handled[n] === undefined ? {} : { handled: Math.round(handled[n]) }),
      // The longest task that began within 200 ms of the change.
      longest: Math.round(
        Math.max(
          0,
          ...long.filter(([start]) => start! >= at && start! < at + 200).map(([, d]) => d!),
        ),
      ),
    }));
    const measured = [1, 2, 3, 4].map((n) => {
      const sound = stretches.slice(0, n).reduce((sum, s) => sum + s.length, 0);
      return {
        ...around(times, stretches[n]!.filmAt),
        // Where the film of the next slide begins, against where the sound before it ends:
        // more than nothing is a jump forward at the change, less is a jump back.
        jump: Math.round(stretches[n]!.filmAt - sound),
        window: busyness[n - 1],
      };
    });
    const [plain, stored, busyAfter, busyBefore] = measured;
    console.log(
      `Film around the changes: ${JSON.stringify({ pictures: times.length, plain, stored, busyAfter, busyBefore, delivered, liveAfter })}`,
    );
    // The live circle goes on through every change: before the first, after it,
    // and after the last, and also while the window was busy at a change.
    // (It once stood still from the first change on: the camera fakes 20
    // pictures a second, and it got none.)
    for (const got of liveAfter) expect(got).toBeGreaterThan(4);
    expect(delivered.got).toBeGreaterThan(BUSY_MS / 200);
    for (const change of measured) {
      // Two seconds after each change are in the film as it was read.
      expect(change.pictures).toBeGreaterThan(20);
      expect(change.largest).toBeLessThan(MAX_GAP_MS);
      // A late burst is not squeezed together: at most a stray picture or two.
      expect(change.squeezed).toBeLessThan(4);
      // The film of the next slide begins where the sound before it ended: no
      // jump forward or back of more than a few pictures. Before the film was
      // set by the sound, the change made while the window was busy jumped 0.8 s.
      expect(Math.abs(change.jump)).toBeLessThan(MAX_JUMP_MS);
    }
  }, 200_000);
});
