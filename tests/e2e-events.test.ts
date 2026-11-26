// Runs the built program end to end for what the lecturer does on a slide
// while reading it in: opening a "Lær mer" box and playing videos. The
// recording remembers when; the video and "Spill av" in the HTML file do
// the same at the same times, and the sound of the film is in the video.
// Needs `npm run build` and FFmpeg in vendor/ffmpeg. The window is never
// shown, the microphone is Chromium's fake one, and nothing touches the network.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import type { Project, SceneEvent } from '../src/shared/format/schema';
import { OFFLINE } from './fixtures/offline';
import { testPng } from './fixtures/sampleProject';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
const packaged = process.env.LYSARK_APP;
const shots = process.env.LYSARK_SHOTS;
const ffmpeg =
  process.env.LYSARK_FFMPEG ??
  join(
    root,
    'vendor/ffmpeg',
    `${process.platform}-${process.arch}`,
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
  );

const IMAGE = 'e_bilde';
const VIDEO = 'e_video';

describe.skipIf(!built || !existsSync(ffmpeg))('"Lær mer" and video while reading in', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;
  let events: SceneEvent[] = [];
  let length = 0;

  const shot = async (target: Page, name: string): Promise<void> => {
    if (shots) await target.screenshot({ path: join(shots, `${name}.png`) });
  };
  const saved = (): Project =>
    JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;
  const answerSaveDialog = (file: string): Promise<void> =>
    app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: path });
    }, file);
  const at = (kind: SceneEvent['kind'], nth = 0): number =>
    events.filter((e) => e.kind === kind)[nth]!.at;

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-hendelser-'));
    projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    // A film with a picture that changes all the time and a high tone. It is long
    // enough not to run out while the test presses, also on a busy machine.
    const film = join(projectDir, 'media', 'film.mp4');
    execFileSync(ffmpeg, [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=12:size=320x180:rate=30',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=3000:duration=12',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      film,
    ]);
    const png = testPng(400, 240);
    writeFileSync(join(projectDir, 'media', 'testbilde.png'), png);

    const project = newProject('Testforelesning');
    project.assets.a_film = {
      kind: 'video',
      file: 'media/film.mp4',
      mime: 'video/mp4',
      bytes: statSync(film).size,
      name: 'film.mp4',
    };
    project.assets.a_bilde = {
      kind: 'image',
      file: 'media/testbilde.png',
      mime: 'image/png',
      bytes: png.length,
      name: 'testbilde.png',
    };
    const scene = newScene('content', 'Innhold');
    scene.elements.push(
      {
        id: 'e_tittel',
        type: 'text',
        role: 'title',
        content: richText('Overskrift A'),
        align: 'left',
        valign: 'top',
        box: { x: 120, y: 96, w: 1680, h: 90, rotation: 0 },
      },
      {
        id: IMAGE,
        type: 'image',
        asset: 'a_bilde',
        alt: 'Testbilde',
        more: {
          title: 'Om bildet',
          blocks: [
            { id: 'm1', kind: 'text', content: richText('Utdyping A.') },
            {
              id: 'm2',
              kind: 'video',
              source: { kind: 'asset', asset: 'a_film' },
              title: 'Film B',
            },
          ],
        },
        box: { x: 1300, y: 222, w: 400, h: 240, rotation: 0 },
      },
      {
        id: VIDEO,
        type: 'video',
        source: { kind: 'asset', asset: 'a_film' },
        title: 'Film A',
        box: { x: 1300, y: 600, w: 480, h: 270, rotation: 0 },
      },
      // A video that lies on the web. Nothing of it is fetched while editing or
      // reading in, and the test's program cannot look any host up.
      {
        id: 'e_nett',
        type: 'video',
        source: { kind: 'url', url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' },
        title: 'Video C',
        box: { x: 120, y: 700, w: 400, h: 225, rotation: 0 },
      },
    );
    scene.script = 'Manus A.';
    project.scenes.push(scene);
    writeFileSync(join(projectDir, 'prosjekt.json'), JSON.stringify(project, null, 2), 'utf8');

    const args = [
      OFFLINE,
      `--user-data-dir=${join(work, 'userdata')}`,
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      projectDir,
    ];
    app = await electron.launch({
      ...(packaged ? { executablePath: packaged, args } : { args: [root, ...args] }),
      env: { ...process.env, LYSARK_HIDDEN: '1' },
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

  it('remembers when a box is opened and put away and when videos are played', async () => {
    await page.getByRole('tab', { name: /^Lyd/ }).click();
    await page.getByRole('button', { name: 'Les inn', exact: true }).click();
    const recorder = page.locator('.recorder');
    await recorder.waitFor();
    // The lecturer is told that the slide can be pressed on.
    expect(await recorder.locator('.recorder-press').textContent()).toContain(
      '«+» åpner «Lær mer»',
    );
    const stage = recorder.locator('.recorder-stage-inner');
    // Before the recording runs, nothing on the slide answers.
    expect(await stage.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    await recorder.getByRole('button', { name: 'Start opptak' }).click();
    await recorder.locator('.recorder-clock.is-on').waitFor({ timeout: 10_000 });
    await recorder.locator('.recorder-stage-inner.is-live').waitFor();
    await page.waitForTimeout(700);

    // "+" on the picture: the box pops out on the slide, beside the picture.
    await stage.locator(`[data-el="${IMAGE}"] .ls-more-badge`).click();
    const box = stage.locator('.ls-pop');
    await box.waitFor();
    expect(await box.locator('h2').textContent()).toBe('Om bildet');
    expect(await box.textContent()).toContain('Utdyping A.');
    // The film in the box is played by pressing on it.
    const inner = box.locator('video');
    await expect
      .poll(() => inner.evaluate((v: HTMLVideoElement) => v.readyState))
      .toBeGreaterThan(0);
    await page.waitForTimeout(600);
    await inner.click();
    await expect.poll(() => inner.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
    await page.waitForTimeout(1600);
    await shot(page, 'h01-opptak-boks');
    await box.getByRole('button', { name: 'Lukk' }).click();
    await box.waitFor({ state: 'detached' });
    await page.waitForTimeout(400);
    // A video from the web cannot be played here, and the lecturer is told why.
    await stage.locator('[data-el="e_nett"] .ls-videocard').click();
    await expect
      .poll(() => recorder.locator('.recorder-note').textContent())
      .toContain('kan ikke spilles mens du leser inn');
    await page.waitForTimeout(400);

    // The film on the slide: a press starts it, another stops it.
    const film = stage.locator(`[data-el="${VIDEO}"] video`);
    await film.click();
    await expect.poll(() => film.evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
    expect(await stage.locator(`[data-el="${VIDEO}"] .ls-video.is-playing`).count()).toBe(1);
    await shot(page, 'h02-opptak-video');
    await page.waitForTimeout(1600);
    await film.click();
    await expect.poll(() => film.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    await page.waitForTimeout(900);
    await recorder.getByRole('button', { name: 'Ferdig' }).click();
    await recorder.waitFor({ state: 'detached' });
    await expect
      .poll(() => page.locator('.notice').textContent(), { timeout: 60_000 })
      .toContain('Opptaket er lagt på');
    await page.locator('.notice button', { hasText: 'Lukk' }).click();

    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
    const scene = saved().scenes[0]!;
    events = scene.events ?? [];
    const clip = scene.audio!.clips[0]!;
    length = clip.kind === 'sound' ? clip.to - clip.from : 0;
    expect(events.map((e) => e.kind)).toEqual([
      'more-open',
      'video-play',
      'more-close',
      'video-play',
      'video-pause',
    ]);
    const times = events.map((e) => e.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(times[0]).toBeGreaterThan(0.5);
    expect(times[4]).toBeLessThan(length);
    expect(events[0]).toMatchObject({ element: IMAGE });
    expect(events[1]).toMatchObject({ element: IMAGE, block: 'm2', from: 0 });
    expect(events[3]).toMatchObject({ element: VIDEO, from: 0 });
    const started = events[3]!;
    expect(started.kind === 'video-play' && started.duration).toBeCloseTo(12, 0);
    expect(at('video-pause') - at('video-play', 1)).toBeGreaterThan(1.2);

    // The sound panel shows them as marks that can be moved and removed.
    await page.waitForSelector('.audio-panel .track');
    expect(await page.locator('.track-event').count()).toBe(5);
    expect(await page.locator('.track-event.is-more-open').getAttribute('title')).toContain(
      '«Lær mer» åpnes ved',
    );
    await shot(page, 'h03-lydpanel-merker');
  }, 120_000);

  it('makes a video where the box pops out and the films play, with their sound', async () => {
    const out = join(work, 'forelesning.mp4');
    await answerSaveDialog(out);
    await page.locator('.topbar-actions').getByRole('button', { name: 'Eksporter video' }).click();
    const dialog = page.locator('dialog.video-dialog');
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Velg fil og eksporter' }).click();
    await expect
      .poll(() => page.locator('.notice').textContent(), { timeout: 150_000, interval: 500 })
      .toContain('Videoen er lagret');
    await page.locator('.notice button', { hasText: 'Lukk' }).click();

    /** A part of one picture of the video, as red, green, blue. */
    const crop = (time: number, x: number, y: number, w: number, h: number): Buffer =>
      execFileSync(
        ffmpeg,
        ['-v', 'error', '-ss', String(time), '-i', out, '-frames:v', '1'].concat([
          '-vf',
          `crop=${w}:${h}:${x}:${y}`,
          '-f',
          'rawvideo',
          '-pix_fmt',
          'rgb24',
          'pipe:1',
        ]),
        { maxBuffer: 1 << 24 },
      );
    const purple = (pixels: Buffer): number => {
      let count = 0;
      for (let i = 0; i < pixels.length; i += 3) {
        const [r, g, b] = [pixels[i]!, pixels[i + 1]!, pixels[i + 2]!];
        if (Math.abs(r - 120) < 40 && g < 60 && b > 190) count += 1;
      }
      return count;
    };
    const difference = (a: Buffer, b: Buffer): number => {
      let sum = 0;
      for (let i = 0; i < a.length; i++) sum += Math.abs(a[i]! - b[i]!);
      return sum / a.length;
    };
    const opened = at('more-open');
    const closed = at('more-close');
    // The box lies to the left of the picture: its purple edge is there while it is
    // open, and neither before nor after.
    const edge = (time: number): number => purple(crop(time, 420, 300, 40, 40));
    expect(edge(Math.max(0, opened - 0.3))).toBe(0);
    expect(edge(opened + 0.8)).toBeGreaterThan(100);
    expect(edge(closed + 0.4)).toBe(0);
    // The "+" mark of what was opened is in the video (the box pops out of it).
    expect(purple(crop(0.2, 1650, 190, 80, 80))).toBeGreaterThan(300);
    if (shots) {
      execFileSync(
        ffmpeg,
        ['-v', 'error', '-y', '-ss', String(opened + 1.6), '-i', out].concat([
          '-frames:v',
          '1',
          join(shots, 'h04-video-boks.png'),
        ]),
      );
    }

    // The film in the box moves while it plays.
    const inBox = at('video-play', 0);
    const boxArea = (time: number): Buffer => crop(time, 440, 230, 830, 560);
    expect(difference(boxArea(inBox + 0.3), boxArea(inBox + 1.1))).toBeGreaterThan(0.5);
    // The film on the slide stands still, moves while it plays, and stops where it was stopped.
    const filmArea = (time: number): Buffer => crop(time, 1300, 600, 480, 270);
    const started = at('video-play', 1);
    const stopped = at('video-pause');
    expect(difference(filmArea(closed + 0.2), filmArea(started - 0.15))).toBeLessThan(1);
    expect(difference(filmArea(started + 0.3), filmArea(started + 1.1))).toBeGreaterThan(1);
    expect(difference(filmArea(stopped + 0.2), filmArea(stopped + 0.6))).toBeLessThan(1);
    expect(difference(filmArea(started - 0.15), filmArea(stopped + 0.4))).toBeGreaterThan(1);

    // The high tone of the film is heard while a film plays, and not otherwise.
    const pcm = execFileSync(
      ffmpeg,
      ['-v', 'error', '-i', out, '-af', 'highpass=f=2700,lowpass=f=3300', '-ac', '1'].concat([
        '-ar',
        '48000',
        '-f',
        's16le',
        'pipe:1',
      ]),
      { maxBuffer: 1 << 26 },
    );
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
    const loudness = (from: number, to: number): number => {
      let sum = 0;
      const a = Math.round(from * 48000);
      const b = Math.min(samples.length, Math.round(to * 48000));
      for (let i = a; i < b; i++) sum += samples[i]! * samples[i]!;
      return Math.sqrt(sum / Math.max(1, b - a));
    };
    // (The fake microphone beeps, and a little of that lies near the tone too.)
    const quiet = loudness(0.1, opened - 0.1) + 1;
    expect(loudness(inBox + 0.2, closed - 0.2)).toBeGreaterThan(quiet * 4);
    expect(loudness(started + 0.2, stopped - 0.2)).toBeGreaterThan(quiet * 4);
    expect(loudness(closed + 0.2, started - 0.2)).toBeLessThan(quiet * 2);
    expect(loudness(stopped + 0.2, length - 0.1)).toBeLessThan(quiet * 2);
  }, 240_000);

  it('does the same in "Spill av" in the HTML file', async () => {
    const out = join(work, 'forelesning.html');
    await answerSaveDialog(out);
    await page.getByRole('button', { name: 'Eksporter HTML' }).click();
    await expect
      .poll(() => page.locator('.notice').textContent(), { timeout: 60_000 })
      .toContain('Stemmen din er med');
    await page.locator('.notice button', { hasText: 'Lukk' }).click();
    expect(readFileSync(out, 'utf8')).toContain('"kind":"more-open"');

    const opening = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Forhåndsvis' }).click();
    const player = await opening;
    await player.waitForSelector('.lp-stage .ls-scene');
    const panel = player.locator('.lp-panel');
    expect(await panel.isHidden()).toBe(true);
    const film = player.locator(`.lp-stage [data-el="${VIDEO}"] video`);
    await expect
      .poll(() => film.evaluate((v: HTMLVideoElement) => v.readyState))
      .toBeGreaterThan(0);
    await player.getByRole('button', { name: 'Spill av' }).click();
    // The box opens by itself, and the voice goes on.
    await expect.poll(() => panel.isVisible(), { timeout: 15_000 }).toBe(true);
    expect(await panel.locator('h2').textContent()).toBe('Om bildet');
    expect(await player.locator('.lp-play').textContent()).toBe('Pause');
    if (shots) await player.screenshot({ path: join(shots, 'h05-spiller-boks.png') });
    // It is put away again, and then the film on the slide plays and stops.
    await expect.poll(() => panel.isHidden(), { timeout: 15_000 }).toBe(true);
    await expect
      .poll(() => film.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15_000 })
      .toBeGreaterThan(0.3);
    await expect
      .poll(() => player.locator('.lp-play').textContent(), { timeout: 20_000 })
      .toBe('Spill av');
    expect(await film.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    const reached = await film.evaluate((v: HTMLVideoElement) => v.currentTime);
    // It stands where the lecturer stopped it.
    expect(Math.abs(reached - (at('video-pause') - at('video-play', 1)))).toBeLessThan(0.7);
    await player.close();
  }, 120_000);
});
