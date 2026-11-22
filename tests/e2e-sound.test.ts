// Runs the built program end to end for sound and video: the sound panel,
// a recording (from Chromium's built-in fake microphone, never a real one),
// editing, the video export and the HTML file that plays itself. Needs
// `npm run build` and FFmpeg in vendor/ffmpeg (tools/fetch-ffmpeg.mjs).
// The window is never shown on screen, and nothing touches the network.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readWavInfo } from '../src/shared/audio/wav';
import type { Project } from '../src/shared/format/schema';
import { writeSampleProject } from './fixtures/sampleProject';

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

describe.skipIf(!built || !existsSync(ffmpeg))('sound and video, end to end', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;

  const shot = async (target: Page, name: string): Promise<void> => {
    if (shots) await target.screenshot({ path: join(shots, `${name}.png`) });
  };
  const saved = (): Project =>
    JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;
  const save = async (): Promise<void> => {
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
  };
  /** The next "save as" dialog answers with this file. */
  const answerSaveDialog = (file: string): Promise<void> =>
    app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: path });
    }, file);
  const total = (): Promise<string | null> => page.locator('.lecture-total').textContent();

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-lyd-'));
    projectDir = join(work, 'prosjekt');
    writeSampleProject(projectDir);
    const args = [
      `--user-data-dir=${join(work, 'userdata')}`,
      // Chromium's own fake microphone (it beeps), and no question about using it.
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

  it('shows the lecture as a strip of slides with their lengths', async () => {
    await page.getByRole('tab', { name: /^Lyd/ }).click();
    await page.waitForSelector('.audio-panel');
    expect(await page.locator('.lecture-block').count()).toBe(3);
    // Without sound: 5 s a slide, and 2 s more for each of the two steps on slide 2.
    expect(await total()).toBe('Hele forelesningen: 0:19');
    expect(await page.locator('.audio-hint').textContent()).toContain('Lysarket har ingen lyd');
  });

  it('gives a slide without sound a length with a pause, which can be undone', async () => {
    await page.getByLabel('Pausens lengde i sekunder').fill('2');
    await page.getByRole('button', { name: 'Sett inn pause' }).click();
    await expect.poll(total).toBe('Hele forelesningen: 0:16');
    expect(await page.locator('.track-pause').count()).toBe(1);
    await page.getByRole('button', { name: 'Angre' }).click();
    await expect.poll(total).toBe('Hele forelesningen: 0:19');
    await page.getByRole('button', { name: 'Gjør om' }).click();
    await expect.poll(total).toBe('Hele forelesningen: 0:16');
    // The last slide gets two seconds too, so the video in this test stays short.
    await page.locator('.lecture-block').nth(2).click();
    await page.getByLabel('Pausens lengde i sekunder').fill('2');
    await page.getByRole('button', { name: 'Sett inn pause' }).click();
    await expect.poll(total).toBe('Hele forelesningen: 0:13');
  });

  it('records a slide: the arrow key sets the time of each step', async () => {
    await page.locator('.lecture-block').nth(1).click();
    await page.getByRole('button', { name: 'Les inn …' }).click();
    const recorder = page.locator('.recorder');
    await recorder.waitFor();
    expect(await recorder.locator('.recorder-where').textContent()).toContain('Lysark 2 av 3');
    expect(await recorder.locator('.recorder-script p').count()).toBe(2);
    // The fake microphone beeps: the level moves before anything is recorded.
    await expect
      .poll(
        () => recorder.locator('.recorder-meter span').evaluate((el) => parseFloat(el.style.width)),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(5);
    await shot(page, 'l01-opptak-klar');

    await recorder.getByRole('button', { name: 'Start opptak' }).click();
    await recorder.locator('.recorder-count').waitFor(); // 3, 2, 1
    await recorder.locator('.recorder-clock.is-on').waitFor({ timeout: 10_000 });
    await page.waitForTimeout(1200);
    await shot(page, 'l02-opptak');
    await page.keyboard.press('ArrowRight'); // step 1
    await expect
      .poll(() => recorder.locator('.recorder-next').textContent(), { timeout: 5000 })
      .toContain('1 igjen');
    await page.waitForTimeout(800);
    await page.keyboard.press('ArrowRight'); // step 2
    await expect
      .poll(() => recorder.locator('.recorder-next').textContent(), { timeout: 5000 })
      .toContain('neste lysark');
    await page.waitForTimeout(800);
    await recorder.getByRole('button', { name: 'Ferdig' }).click();
    await recorder.waitFor({ state: 'detached' });
    expect(await page.locator('.notice').textContent()).toContain('Opptaket er lagt på lysarket');
    await page.locator('.notice button', { hasText: 'Lukk' }).click();

    await save();
    const scene = saved().scenes[1]!;
    const clip = scene.audio!.clips[0]!;
    expect(scene.audio!.clips).toHaveLength(1);
    expect(clip.kind).toBe('sound');
    const seconds = clip.kind === 'sound' ? clip.to - clip.from : 0;
    expect(seconds).toBeGreaterThan(2.3);
    expect(seconds).toBeLessThan(15);
    const [first, second] = scene.timeline.map((s) => s.at!);
    expect(first).toBeGreaterThan(0.9);
    expect(second! - first!).toBeGreaterThan(0.6);
    expect(second).toBeLessThan(seconds);
    // The recording is a file in the project: mono, 48 kHz, 16 bit, and not silent.
    const asset = saved().assets[clip.kind === 'sound' ? clip.asset : '']!;
    expect(asset).toMatchObject({ kind: 'audio', mime: 'audio/wav' });
    const wav = new Uint8Array(readFileSync(join(projectDir, asset.file)));
    expect(readWavInfo(wav)).toMatchObject({ sampleRate: 48000, channels: 1, bitsPerSample: 16 });
    expect(readWavInfo(wav).seconds).toBeCloseTo(seconds, 2);
    expect(wav.subarray(44).some((byte) => byte !== 0)).toBe(true);
  });

  it('draws the recording with its steps, plays it and cuts it', async () => {
    await page.waitForSelector('.audio-panel .track');
    expect(await page.locator('.track-step').count()).toBe(2);
    expect(await page.locator('.track-step.is-auto').count()).toBe(0);
    const before = (await page.locator('.audio-time').textContent())!;
    await shot(page, 'l03-lydpanel');

    await page.getByRole('button', { name: 'Spill av', exact: true }).click();
    await page.getByRole('button', { name: 'Stopp' }).waitFor();
    await expect
      .poll(() => page.locator('.audio-time').textContent(), { timeout: 10_000 })
      .not.toBe(before); // the playhead moves
    await page.getByRole('button', { name: 'Stopp' }).click();

    // Mark a stretch by dragging in the track, and cut it out.
    const box = (await page.locator('.track').boundingBox())!;
    const y = box.y + box.height * 0.75;
    await page.mouse.move(box.x + box.width * 0.05, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, y, { steps: 5 });
    await page.mouse.up();
    await page.locator('.track-range').waitFor();
    await page.getByRole('button', { name: 'Klipp bort det merkede' }).click();
    await expect.poll(() => page.locator('.track-range').count()).toBe(0);
    const after = (await page.locator('.audio-time').textContent())!;
    expect(after.split(' / ')[1]).not.toBe(before.split(' / ')[1]); // the slide got shorter
    await save();
    const clips = saved().scenes[1]!.audio!.clips;
    expect(clips.map((c) => c.kind)).toEqual(['sound', 'sound']); // the recording itself is untouched
    await shot(page, 'l04-klippet');
  });

  it('exports the lecture as MP4 with captions, drawn frame by frame', async () => {
    const out = join(work, 'forelesning.mp4');
    await answerSaveDialog(out);
    await page.locator('.topbar-actions').getByRole('button', { name: 'Eksporter video' }).click();
    const dialog = page.locator('dialog.video-dialog');
    await dialog.waitFor();
    expect(await dialog.textContent()).toContain('1920 × 1080');
    await dialog.getByLabel('Mellom lysarkene').selectOption('fade');
    await shot(page, 'l05-videodialog');
    await dialog.getByRole('button', { name: 'Eksporter video …' }).click();
    await expect
      .poll(() => page.locator('.notice').textContent(), { timeout: 120_000, interval: 500 })
      .toContain('Videoen er lagret');
    expect(statSync(out).size).toBeGreaterThan(20_000);

    // What FFmpeg itself says about the file.
    const probe = spawnSync(ffmpeg, ['-hide_banner', '-i', out], { encoding: 'utf8' }).stderr;
    expect(probe).toMatch(/Video: h264.*yuv420p.*1920x1080.*30 fps/s);
    expect(probe).toMatch(/Audio: aac.*48000 Hz, mono/);
    const duration = /Duration: (\d+):(\d+):([\d.]+)/.exec(probe)!;
    const seconds = Number(duration[2]) * 60 + Number(duration[3]);
    const lecture = saved().scenes[1]!.audio!.clips.reduce(
      (sum, c) => sum + (c.kind === 'sound' ? c.to - c.from : c.duration),
      4, // the two pauses of two seconds
    );
    expect(Math.abs(seconds - lecture)).toBeLessThan(0.2);

    // The first picture is the title slide (purple), not black; a later one differs.
    const pixels = (at: number): Buffer =>
      execFileSync(
        ffmpeg,
        ['-v', 'error', '-ss', String(at), '-i', out, '-frames:v', '1', '-s', '192x108'].concat([
          '-f',
          'rawvideo',
          '-pix_fmt',
          'rgb24',
          'pipe:1',
        ]),
        { maxBuffer: 1 << 22 },
      );
    const title = pixels(0.5);
    expect(title).toHaveLength(192 * 108 * 3);
    const corner = [...title.subarray((5 * 192 + 5) * 3, (5 * 192 + 5) * 3 + 3)];
    expect(
      Math.abs(corner[0]! - 120) + Math.abs(corner[1]!) + Math.abs(corner[2]! - 240),
    ).toBeLessThan(40);
    expect(pixels(3).equals(title)).toBe(false);

    // Captions from the manuscript of slide 2, timed inside that slide.
    const vtt = readFileSync(join(work, 'forelesning.vtt'), 'utf8');
    expect(vtt).toMatch(/^WEBVTT\nLanguage: nb\n/);
    expect(vtt).toContain('Manus A.');
    expect(vtt).toContain('Manus B.');
    expect(vtt).toMatch(/\n00:00:02\.\d{3} --> /); // slide 2 starts after the two seconds of slide 1
    await page.locator('.notice button', { hasText: 'Lukk' }).click();
    // The choice is kept with the project.
    await save();
    expect(saved().video).toEqual({ transition: 'fade', evenLoudness: true, credits: false });
  }, 180_000);

  it('exports HTML that carries the voice and plays itself', async () => {
    const out = join(work, 'forelesning.html');
    await answerSaveDialog(out);
    await page.getByRole('button', { name: 'Eksporter HTML' }).click();
    await expect
      .poll(() => page.locator('.notice').textContent(), { timeout: 60_000 })
      .toContain('Stemmen din er med');
    const html = readFileSync(out, 'utf8');
    expect(html).toContain('"mime":"audio/mp4"');
    expect(html).not.toContain('audio/wav'); // the recordings themselves stay in the project
    await page.locator('.notice button', { hasText: 'Lukk' }).click();

    const opened = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Forhåndsvis' }).click();
    const player = await opened;
    await player.waitForSelector('.lp-stage .ls-scene');
    await expect.poll(() => player.locator('.lp-counter').textContent()).toBe('2 / 3');
    const shape = player.locator('.lp-stage .ls-el-shape').first();
    expect(await shape.evaluate((el) => getComputedStyle(el).visibility)).toBe('hidden');
    const play = player.getByRole('button', { name: 'Spill av' });
    await play.click();
    await player.getByRole('button', { name: 'Pause' }).waitFor();
    // The step comes in by itself, at the time the arrow key was pressed in the recording.
    await expect
      .poll(() => shape.evaluate((el) => getComputedStyle(el).visibility), { timeout: 10_000 })
      .toBe('visible');
    if (shots) await player.screenshot({ path: join(shots, 'l06-spiller-spill-av.png') });
    // And the lecture goes on to the next slide when the voice has finished.
    await expect
      .poll(() => player.locator('.lp-counter').textContent(), { timeout: 15_000 })
      .toBe('3 / 3');
    // At the end it stops by itself.
    await expect
      .poll(() => player.locator('.lp-play').textContent(), { timeout: 10_000 })
      .toBe('Spill av');
  }, 120_000);
});
