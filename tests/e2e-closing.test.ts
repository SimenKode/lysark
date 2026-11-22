// Runs the built program end to end for the closing animation: the owner
// supplies the film, a closing slide plays it by itself, and the video
// export draws it picture by picture. The film here is a test pattern made
// by FFmpeg, never USN's own. Needs `npm run build` and FFmpeg in
// vendor/ffmpeg. The window is never shown, and nothing touches the network.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OFFLINE } from './fixtures/offline';
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

describe.skipIf(!built || !existsSync(ffmpeg))('the closing animation, end to end', () => {
  let work: string;
  let projectDir: string;
  let film: string;
  let app: ElectronApplication;
  let page: Page;

  const saved = (): Project =>
    JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-slutt-'));
    projectDir = join(work, 'prosjekt');
    writeSampleProject(projectDir);
    // Two seconds of FFmpeg's own test pattern, which changes from picture to picture.
    film = join(work, 'film.mp4');
    execFileSync(ffmpeg, [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=2:size=320x180:rate=30',
      '-pix_fmt',
      'yuv420p',
      film,
    ]);
    const args = [OFFLINE, `--user-data-dir=${join(work, 'userdata')}`, projectDir];
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

  it('cannot be turned on before the owner has supplied the film, and says why', async () => {
    await page.locator('.scene-item').nth(2).click(); // the closing slide of the sample
    await page.getByRole('tab', { name: 'Lysark' }).click();
    const choice = page.getByLabel('Spill USNs avslutningsanimasjon når lysarket vises');
    expect(await choice.isDisabled()).toBe(true);
    expect(await page.locator('.panel-body').textContent()).toContain(
      'USNs avslutningsanimasjon er ikke valgt ennå',
    );
  });

  it('takes the film the owner points at into the settings', async () => {
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, film);
    await page.getByRole('button', { name: 'Innstillinger' }).click();
    const settings = page.locator('dialog.dialog');
    expect(await settings.textContent()).toContain('Avslutningsanimasjon: ikke valgt');
    await settings.getByRole('button', { name: 'Velg videofila' }).click();
    await expect
      .poll(() => settings.textContent())
      .toContain('Avslutningsanimasjon: funnet (2 sekunder)');
    await settings.getByRole('button', { name: 'Lukk' }).click();
  });

  it('plays on a closing slide: no controls, no sound, the last picture while editing', async () => {
    const choice = page.getByLabel('Spill USNs avslutningsanimasjon når lysarket vises');
    await choice.check();
    const shown = page.locator('.stage-inner video.ls-closing');
    await shown.waitFor();
    expect(await shown.evaluate((v: HTMLVideoElement) => [v.controls, v.muted])).toEqual([
      false,
      true,
    ]);
    // While editing the film stands on its last picture.
    await expect
      .poll(() => shown.evaluate((v: HTMLVideoElement) => v.currentTime))
      .toBeGreaterThan(1.5);
    expect(await page.locator('.panel-body').textContent()).toContain('varer 2 sekunder');
    if (shots) await page.screenshot({ path: join(shots, 'a01-avslutning.png') });

    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
    const scene = saved().scenes[2]!;
    expect(scene.closingAnimation!.seconds).toBeCloseTo(2, 1);
    // The film has a white ground and its own logo.
    expect([scene.background, scene.showLogo, scene.decoration]).toEqual(['hvit', false, false]);
    // The film itself is not in the project: no new asset, no new media file.
    expect(Object.values(saved().assets).some((a) => a.kind === 'video')).toBe(false);

    // A new closing slide suggests the animation from the start.
    await page.getByRole('button', { name: 'Nytt lysark' }).click();
    await page.getByRole('menuitem', { name: 'Avslutning' }).click();
    await expect.poll(() => page.locator('.scene-item').count()).toBe(4);
    await shown.waitFor();
    expect(await choice.isChecked()).toBe(true);
    await page.getByRole('button', { name: 'Angre' }).click();
    await expect.poll(() => page.locator('.scene-item').count()).toBe(3);
  });

  it('starts by itself in the player, and lies in the exported file', async () => {
    await page.locator('.scene-item').nth(2).click();
    const opened = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Forhåndsvis' }).click();
    const player = await opened;
    await player.waitForSelector('.lp-stage .ls-scene');
    await expect.poll(() => player.locator('.lp-counter').textContent()).toBe('3 / 3');
    const playing = player.locator('.lp-stage video.ls-closing');
    await playing.waitFor();
    expect(await playing.evaluate((v: HTMLVideoElement) => v.controls)).toBe(false);
    // It was started without anyone pressing anything: it runs, or has run to its end.
    await expect
      .poll(() => playing.evaluate((v: HTMLVideoElement) => !v.paused || v.ended), {
        timeout: 15_000,
      })
      .toBe(true);
    expect(await playing.evaluate((v: HTMLVideoElement) => v.src)).toMatch(/^blob:/);
    // Nothing on the slide starts or steers the film.
    expect(await player.locator('.lp-stage video[controls]').count()).toBe(0);
    await player.close();
  });

  it('is drawn picture by picture in the video, and then stands on its last picture', async () => {
    const out = join(work, 'slutt.mp4');
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, out);
    await page.locator('.topbar-actions').getByRole('button', { name: 'Eksporter video' }).click();
    const dialog = page.locator('dialog.video-dialog');
    await dialog.getByLabel('Bare dette lysarket (nr. 3)').check();
    expect(await dialog.textContent()).toContain('Lengde: 0:04'); // two seconds of film, two of rest
    await dialog.getByRole('button', { name: 'Velg fil og eksporter' }).click();
    await expect
      .poll(() => page.locator('.notice').textContent(), { timeout: 120_000, interval: 500 })
      .toContain('Videoen er lagret');
    const probe = spawnSync(ffmpeg, ['-hide_banner', '-i', out], { encoding: 'utf8' }).stderr;
    expect(probe).toMatch(/Duration: 00:00:04\.0/);
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
    // How far two pictures are from each other, as the mean difference per colour value (0-255).
    const apart = (a: Buffer, b: Buffer): number => {
      let sum = 0;
      for (let i = 0; i < a.length; i++) sum += Math.abs(a[i]! - b[i]!);
      return sum / a.length;
    };
    // The film moves while it runs ...
    expect(apart(pixels(0.2), pixels(1.4))).toBeGreaterThan(3);
    // ... and after its two seconds the last picture stands (compression leaves a breath of difference).
    expect(apart(pixels(2.6), pixels(3.6))).toBeLessThan(1);
    // The last picture of the film, not its first.
    expect(apart(pixels(3.6), pixels(1.9))).toBeLessThan(apart(pixels(3.6), pixels(0.1)));
  }, 180_000);
});
