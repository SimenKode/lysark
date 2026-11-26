// Runs the built program end to end for how long a slide stands: the field
// «Tid uten lyd» in the tab «Lysark», the same number in the tab «Lyd» with
// «Bruk på alle lysark uten lyd», and the edge of a slide on the timeline;
// and for slides left out of the video: by their checkbox, by a recording
// that jumps over them, in "Spill av" and in the video.
// Needs `npm run build`, and FFmpeg in vendor/ffmpeg for the HTML file and
// the video. The window is never shown, the microphone is Chromium's fake
// one, and nothing touches the network.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encodeWav } from '../src/shared/audio/wav';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import type { Project } from '../src/shared/format/schema';
import { sceneDuration } from '../src/shared/render/clock';
import { OFFLINE } from './fixtures/offline';

const root = resolve(__dirname, '..');
const built = existsSync(join(root, 'out/main/index.js'));
const packaged = process.env.LYSARK_APP;
const ffmpeg = join(
  root,
  'vendor/ffmpeg',
  `${process.platform}-${process.arch}`,
  process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
);
const SKIPPED = 'Ikke med i videoen';

describe.skipIf(!built)('how long a slide stands, end to end', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;

  const saved = (): Project =>
    JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;
  const save = async (): Promise<void> => {
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
  };
  const slide = (n: number) => page.locator('.scene-item').nth(n);
  const field = () => page.locator('#scene-seconds');
  const notice = (): Promise<string | null> => page.locator('.notice').textContent();
  const answerSaveDialog = (file: string): Promise<void> =>
    app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: path });
    }, file);
  const included = () => page.getByLabel('Ta med i videoen og i «Spill av»');

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-tid-'));
    projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    const voice = new Float32Array(3 * 48000);
    for (let i = 0; i < voice.length; i++)
      voice[i] = 0.3 * Math.sin((2 * Math.PI * 300 * i) / 48000);
    const wav = encodeWav(voice);
    writeFileSync(join(projectDir, 'media', 'stemme.wav'), wav);
    const project = newProject('Testforelesning');
    project.assets.a_stemme = {
      kind: 'audio',
      file: 'media/stemme.wav',
      mime: 'audio/wav',
      bytes: wav.byteLength,
    };
    for (const [index, name] of ['A', 'B', 'C', 'D'].entries()) {
      const scene = newScene('content', `Lysark ${name}`);
      scene.id = `s_${name.toLowerCase()}`;
      scene.elements.push({
        id: `e_${index}`,
        type: 'text',
        role: 'title',
        content: richText(`Overskrift ${name}`),
        align: 'left',
        valign: 'top',
        box: { x: 120, y: 96, w: 1680, h: 90, rotation: 0 },
      });
      project.scenes.push(scene);
    }
    // A: no sound and one step. B: a voice of three seconds. C: only a pause
    // of four seconds (the old way of giving a slide a length). D: no sound.
    project.scenes[0]!.timeline = [
      { id: 't_a', actions: [{ target: 'e_0', effect: 'fade', duration: 0.4 }] },
    ];
    project.scenes[1]!.audio = {
      clips: [{ id: 'c_b', kind: 'sound', asset: 'a_stemme', from: 0, to: 3 }],
    };
    project.scenes[2]!.audio = { clips: [{ id: 'c_c', kind: 'pause', duration: 4 }] };
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
    await page.waitForSelector('.scene-item');
  }, 60_000);

  afterAll(async () => {
    await app
      ?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.destroy()))
      .catch(() => undefined);
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('shows the time that applies in the tab «Lysark», and sets the slide’s own', async () => {
    await slide(0).click();
    // Five seconds and two for the one step: what applies when nothing is set.
    await expect.poll(() => field().inputValue()).toBe('7');
    expect(await page.locator('#scene-seconds-hint').textContent()).toBe(
      'Så lenge står lysarket i videoen og i «Spill av» når det ikke har lyd.',
    );
    await field().fill('12,5');
    await field().press('Enter');
    await expect.poll(() => page.getByRole('tab', { name: /^Lyd/ }).textContent()).toBe(
      'Lyd (0:13)',
    );
    await save();
    expect(saved().scenes[0]!.seconds).toBe(12.5);

    // A slide with sound: the sound decides, and the field is not offered.
    await slide(1).click();
    await expect.poll(() => field().count()).toBe(0);
    expect(await page.locator('.scene-time-sound').textContent()).toMatch(
      /lyd.*0:03.*fanen «Lyd»/,
    );

    // A slide whose only sound is a pause shows the pause, and the number replaces it.
    await slide(2).click();
    await expect.poll(() => field().inputValue()).toBe('4');
    await field().fill('6');
    await field().press('Enter');
    await save();
    expect(saved().scenes[2]!.audio).toBeUndefined();
    expect(saved().scenes[2]!.seconds).toBe(6);
  });

  it('shows the same number in the tab «Lyd», and gives it to every slide without sound at once', async () => {
    await page.getByRole('tab', { name: /^Lyd/ }).click();
    await slide(3).click();
    const sentence = page.locator('.audio-silent');
    await sentence.waitFor();
    expect(await sentence.textContent()).toMatch(/^Lysarket har ingen lyd\. Det står i/);
    const number = page.getByLabel('Hvor mange sekunder lysarket står');
    await expect.poll(() => number.inputValue()).toBe('5');
    await number.fill('9');
    await number.press('Enter');
    await expect.poll(() => page.getByRole('tab', { name: /^Lyd/ }).textContent()).toBe(
      'Lyd (0:09)',
    );
    await page.getByRole('button', { name: 'Bruk på alle lysark uten lyd' }).click();
    await save();
    expect(saved().scenes.map((s) => s.seconds)).toEqual([9, undefined, 9, 9]);
    // One change, one undo: the slides have their own times again.
    await page.getByRole('button', { name: 'Angre' }).click();
    await save();
    expect(saved().scenes.map((s) => s.seconds)).toEqual([12.5, undefined, 6, 9]);
    // A slide with sound has no such sentence.
    await slide(1).click();
    await expect.poll(() => sentence.count()).toBe(0);
  });

  it('sets the time of a slide without sound by its edge on the timeline', async () => {
    await page.getByRole('tab', { name: 'Tidslinje' }).click();
    await page.waitForSelector('.timeline');
    const edge = page.locator('.tl-edge').nth(3);
    await edge.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await save();
    expect(saved().scenes[3]!.seconds).toBe(10);
    expect(saved().scenes[3]!.audio).toBeUndefined();
    // Dragged with the pointer.
    const pps = Number(await page.locator('.tl-inner').getAttribute('data-pps'));
    const box = (await edge.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - pps * 2, y, { steps: 6 });
    await page.mouse.up();
    await save();
    expect(saved().scenes[3]!.seconds).toBeCloseTo(8, 0);
    // The tab «Lysark» shows what the edge set.
    await slide(3).click();
    await expect
      .poll(async () => Number((await field().inputValue()).replace(',', '.')))
      .toBeCloseTo(saved().scenes[3]!.seconds!, 1);
  });

  it('leaves a slide out of the video by its checkbox, and shows it toned down with a sign', async () => {
    await page.getByRole('tab', { name: 'Lysark' }).click();
    await slide(3).click();
    await field().fill('2');
    await field().press('Enter');
    await slide(2).click();
    expect(await included().isChecked()).toBe(true);
    await included().uncheck();
    await save();
    expect(saved().scenes[2]!.skip).toBe(true);
    // In the list of slides.
    expect(await slide(2).locator('.scene-skip').textContent()).toBe(SKIPPED);
    expect(await slide(2).getAttribute('title')).toBe(SKIPPED);
    expect(await page.locator('.scene-skip').count()).toBe(1);
    // On the timeline it takes no time: 12,5 + 3 + 2 seconds.
    await page.getByRole('tab', { name: 'Tidslinje' }).click();
    await expect.poll(() => page.locator('.tl-time').textContent()).toMatch(/ \/ 0:18$/);
    const sign = page.locator('.tl-slide-box.is-skipped .tl-slide');
    expect(await sign.count()).toBe(1);
    expect(await sign.getAttribute('aria-label')).toContain(SKIPPED);
    // In the row of slides in the tab «Lyd».
    await page.getByRole('tab', { name: /^Lyd/ }).click();
    expect(await page.locator('.lecture-block.is-skipped').getAttribute('title')).toContain(
      SKIPPED.toLowerCase(),
    );
    // And taken in again.
    await included().check();
    await save();
    expect(saved().scenes[2]!.skip).toBeUndefined();
    await expect.poll(() => page.locator('.scene-skip').count()).toBe(0);
  });

  it('leaves out the slides without sound a recording jumps over, and says how to take them in', async () => {
    await slide(0).click();
    await page.getByRole('tab', { name: /^Lyd/ }).click();
    await page.getByRole('button', { name: 'Les inn', exact: true }).click();
    const recorder = page.locator('.recorder');
    await recorder.waitFor();
    await recorder.getByLabel('Kamera', { exact: true }).uncheck();
    await recorder.getByRole('button', { name: 'Start opptak' }).click();
    await recorder.locator('.recorder-clock.is-on').waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1500);
    // From slide 1 straight to slide 4, over 2 (which has sound) and 3 (which has none).
    await page.keyboard.press('l');
    await recorder.locator('.recorder-menu-item').nth(3).click();
    await expect.poll(() => recorder.locator('.recorder-where').textContent()).toContain(
      'Lysark 4 av',
    );
    await page.waitForTimeout(1500);
    await recorder.getByRole('button', { name: 'Ferdig' }).click();
    await expect
      .poll(notice, { timeout: 60_000 })
      .toContain(
        'Lysark 3 er ikke med i videoen, fordi du hoppet over det i opptaket. Du kan ta det med igjen i fanen «Lysark».',
      );
    expect(await notice()).toContain('Opptaket er lagt på 2 lysark.');
    await page.locator('.notice button', { hasText: 'Lukk' }).click();
    const project = await (async () => {
      await save();
      return saved();
    })();
    expect(project.scenes.map((s) => s.skip ?? false)).toEqual([false, false, true, false]);
    expect(project.scenes.map((s) => (s.audio?.clips ?? []).length > 0)).toEqual([
      true,
      true,
      false,
      true,
    ]);
    expect(await slide(2).locator('.scene-skip').textContent()).toBe(SKIPPED);
  }, 120_000);

  it.skipIf(!existsSync(ffmpeg))(
    'passes the slide in "Spill av" in the HTML file, where it is still seen by hand',
    async () => {
      await slide(1).click();
      const opened = app.waitForEvent('window');
      await page.getByRole('button', { name: 'Forhåndsvis' }).click();
      const player = await opened;
      await player.waitForSelector('.lp-stage .ls-scene');
      const counter = player.locator('.lp-counter');
      await expect.poll(() => counter.textContent()).toBe('2 / 4');
      // Every slide "Spill av" shows is written down.
      await player.evaluate(() => {
        const seen: string[] = [];
        (window as unknown as { seen: string[] }).seen = seen;
        const el = document.querySelector('.lp-counter')!;
        new MutationObserver(() => seen.push(el.textContent ?? '')).observe(el, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      });
      await player.getByRole('button', { name: 'Spill av' }).click();
      await expect.poll(() => counter.textContent(), { timeout: 20_000 }).toBe('4 / 4');
      await expect
        .poll(() => player.locator('.lp-play').textContent(), { timeout: 15_000 })
        .toBe('Spill av');
      const seen = await player.evaluate(() => (window as unknown as { seen: string[] }).seen);
      expect(seen).not.toContain('3 / 4');
      // By hand, the slide is there.
      await player.keyboard.press('ArrowLeft');
      await expect.poll(() => counter.textContent()).toBe('3 / 4');
      await player.close();
    },
    120_000,
  );

  it.skipIf(!existsSync(ffmpeg))(
    'leaves the slide out of the video, also when slides are chosen by number',
    async () => {
      const out = join(work, 'utvalg.mp4');
      await answerSaveDialog(out);
      await page
        .locator('.topbar-actions')
        .getByRole('button', { name: 'Eksporter video' })
        .click();
      const dialog = page.locator('dialog.video-dialog');
      await dialog.waitFor();
      await dialog.getByLabel('Første lysark').fill('2');
      await dialog.getByLabel('Siste lysark').fill('4');
      expect(await dialog.textContent()).toContain('(2 lysark; ett er ikke med, 2 med lyd)');
      await dialog.getByRole('button', { name: 'Velg fil og eksporter' }).click();
      await expect
        .poll(notice, { timeout: 400_000, interval: 1000 })
        .toContain('Videoen er lagret');
      await page.locator('.notice button', { hasText: 'Lukk' }).click();
      const probe = spawnSync(ffmpeg, ['-hide_banner', '-i', out], { encoding: 'utf8' }).stderr;
      const duration = /Duration: (\d+):(\d+):([\d.]+)/.exec(probe)!;
      const seconds = Number(duration[2]) * 60 + Number(duration[3]);
      const [, b, , d] = saved().scenes;
      expect(Math.abs(seconds - (sceneDuration(b!) + sceneDuration(d!)))).toBeLessThan(0.3);
    },
    480_000,
  );
});
