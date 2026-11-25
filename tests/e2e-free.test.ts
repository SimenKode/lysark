// Runs the built program end to end for a recording where the lecturer
// moves freely: on, back to an earlier slide, a jump with the slide menu,
// and a slide that is only passed. The recording never stops for it, the
// slide that was gone back to is shown once more (in the list, in the
// video and in "Spill av"), and the chapters are where they should be.
// Needs `npm run build` and FFmpeg in vendor/ffmpeg. The window is never
// shown, the microphone is Chromium's fake one, and nothing touches the
// network.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import type { Project, Scene } from '../src/shared/format/schema';
import { schedule } from '../src/shared/render/clock';
import { OFFLINE } from './fixtures/offline';

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

describe.skipIf(!built || !existsSync(ffmpeg))(
  'a recording where the lecturer moves freely',
  () => {
    let work: string;
    let projectDir: string;
    let app: ElectronApplication;
    let page: Page;
    let recorded: Project;

    const shot = async (target: Page, name: string): Promise<void> => {
      if (!shots) return;
      mkdirSync(shots, { recursive: true });
      await target.screenshot({ path: join(shots, `${name}.png`) });
    };
    const saved = (): Project =>
      JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;
    const save = async (): Promise<Project> => {
      await page
        .locator('.topbar-actions')
        .getByRole('button', { name: /^Lagre/ })
        .click();
      await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
      return saved();
    };
    const answerSaveDialog = (file: string): Promise<void> =>
      app.evaluate(({ dialog }, path) => {
        dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: path });
      }, file);
    const where = (): Promise<string | null> => page.locator('.recorder-where').textContent();
    const clipLength = (scene: Scene): number => {
      const clip = scene.audio!.clips[0]!;
      return clip.kind === 'sound' ? clip.to - clip.from : 0;
    };

    beforeAll(async () => {
      work = mkdtempSync(join(tmpdir(), 'lysark-fritt-'));
      projectDir = join(work, 'prosjekt');
      mkdirSync(join(projectDir, 'media'), { recursive: true });
      const project = newProject('Testforelesning');
      for (const name of ['A', 'B', 'C']) {
        const scene = newScene('content', `Lysark ${name}`);
        scene.id = `s_${name}`;
        scene.elements.push({
          id: `e_tittel_${name}`,
          type: 'text',
          role: 'title',
          content: richText(`Overskrift ${name}`),
          align: 'left',
          valign: 'top',
          box: { x: 120, y: 96, w: 1000, h: 90, rotation: 0 },
        });
        scene.script = `Manus ${name}.`;
        scene.showLogo = false;
        project.scenes.push(scene);
      }
      // Two steps on the first slide, each bringing in a line of text.
      const first = project.scenes[0]!;
      for (const n of [1, 2]) {
        first.elements.push({
          id: `e_punkt_${n}`,
          type: 'text',
          role: 'body',
          content: richText(`Punkt ${n}`),
          align: 'left',
          valign: 'top',
          box: { x: 120, y: 200 + n * 160, w: 1000, h: 90, rotation: 0 },
        });
        first.timeline.push({
          id: `t_${n}`,
          actions: [{ target: `e_punkt_${n}`, effect: 'appear', duration: 0 }],
        });
      }
      first.chapter = 'Første del';
      project.scenes[2]!.chapter = 'Andre del';
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

    it('shows the chapters as headings in the list of slides', async () => {
      const names = page.locator('.scene-chapter input');
      expect(await names.count()).toBe(2);
      expect(await names.nth(0).inputValue()).toBe('Første del');
      expect(await names.nth(1).inputValue()).toBe('Andre del');
    });

    it('goes on, back and to any slide without the recording stopping', async () => {
      await page.getByRole('tab', { name: /^Lyd/ }).click();
      await page.getByRole('button', { name: 'Les inn', exact: true }).click();
      const recorder = page.locator('.recorder');
      await recorder.waitFor();
      expect(await where()).toContain('Lysark 1 av 3');
      // Nothing can be gone back to before the recording has begun.
      expect(await recorder.getByRole('button', { name: /Forrige/ }).count()).toBe(0);

      await recorder.getByRole('button', { name: 'Start opptak' }).click();
      await recorder.locator('.recorder-clock.is-on').waitFor({ timeout: 10_000 });
      expect(await recorder.getByRole('button', { name: '← Forrige lysark' }).isDisabled()).toBe(
        true,
      );
      await page.waitForTimeout(1100);
      await page.keyboard.press('ArrowRight'); // step 1
      await page.waitForTimeout(800);
      await page.keyboard.press('ArrowRight'); // step 2
      await expect
        .poll(() => recorder.locator('.recorder-next').textContent())
        .toContain('neste lysark');
      await page.waitForTimeout(800);
      await page.keyboard.press('ArrowRight'); // slide B
      await expect.poll(where).toContain('Lysark 2 av 3');
      await page.waitForTimeout(1300);

      // Back to A: it stands as it was left, with both steps, and the clock runs on.
      await page.keyboard.press('ArrowLeft');
      await expect.poll(where).toContain('Lysark 1 av 3');
      expect(await recorder.locator('.recorder-clock').textContent()).toContain('Tar opp');
      expect(await recorder.locator('.recorder-next').textContent()).toContain('neste lysark');
      expect(
        await recorder.locator('.recorder-stage-inner [data-el="e_punkt_2"]').evaluate((el) => {
          return getComputedStyle(el).opacity;
        }),
      ).toBe('1');
      await page.waitForTimeout(1500);
      await shot(page, 'f01-tilbake');

      // The slide menu pops out, with the slides under their chapters.
      await page.keyboard.press('l');
      const menu = recorder.locator('.recorder-menu');
      await menu.waitFor();
      expect(await menu.locator('h4').allTextContents()).toEqual(['Første del', 'Andre del']);
      expect(await menu.locator('.recorder-menu-item').count()).toBe(3);
      expect(
        await menu.locator('.recorder-menu-item[aria-current="true"]').textContent(),
      ).toContain('Lysark A');
      expect(await menu.locator('.recorder-menu-item').nth(1).textContent()).toContain(
        'lest inn nå',
      );
      await shot(page, 'f02-sidemeny');
      // Escape puts the menu away and nothing else: the recording goes on.
      await page.keyboard.press('Escape');
      await menu.waitFor({ state: 'detached' });
      expect(await recorder.locator('.recorder-clock').textContent()).toContain('Tar opp');
      await recorder.getByRole('button', { name: 'Velg lysark' }).click();
      await menu.locator('.recorder-menu-item', { hasText: 'Lysark C' }).click();
      await menu.waitFor({ state: 'detached' });
      await expect.poll(where).toContain('Lysark 3 av 3');
      await page.waitForTimeout(1200);

      // A slip of the finger: back to B and at once on to C again. B was only
      // passed, so it is not shown once more, and C goes on as one stretch.
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowRight');
      await expect.poll(where).toContain('Lysark 3 av 3');
      await page.waitForTimeout(1100);
      await recorder.getByRole('button', { name: 'Ferdig' }).click();
      await recorder.waitFor({ state: 'detached', timeout: 60_000 });
      const notice = await page.locator('.notice').textContent();
      expect(notice).toContain('Opptaket er lagt på 3 lysark.');
      expect(notice).toContain('Ett sted gikk du tilbake til et lysark');
      await page.locator('.notice button', { hasText: 'Lukk' }).click();

      recorded = await save();
      const [a, b, again, c] = recorded.scenes;
      expect(recorded.scenes).toHaveLength(4);
      expect(recorded.scenes.map((s) => s.repeat?.of)).toEqual([
        undefined,
        undefined,
        's_A',
        undefined,
      ]);
      // The first time on A both steps came in, at the times of the presses.
      expect(a!.timeline[0]!.at).toBeGreaterThan(0.8);
      expect(a!.timeline[1]!.at).toBeGreaterThan(a!.timeline[0]!.at! + 0.5);
      expect(clipLength(a!)).toBeGreaterThan(a!.timeline[1]!.at! + 0.5);
      expect(clipLength(b!)).toBeGreaterThan(1);
      // Back on A they were there from the start.
      expect(again!.repeat!.shown).toEqual(['t_1', 't_2']);
      expect(again!.title).toBe('Lysark A');
      expect(again!.script).toBe('');
      expect(clipLength(again!)).toBeGreaterThan(1.2);
      // C is one stretch, with what was said while B was passed in it.
      expect(c!.audio!.clips).toHaveLength(1);
      expect(clipLength(c!)).toBeGreaterThan(2);
      // Every stretch has its own sound file, and nothing of the recording is lost between them.
      const files = recorded.scenes.map((s) => {
        const clip = s.audio!.clips[0]!;
        return clip.kind === 'sound' ? recorded.assets[clip.asset]!.file : '';
      });
      expect(new Set(files).size).toBe(4);
      for (const file of files) expect(existsSync(join(projectDir, file))).toBe(true);
    }, 150_000);

    it('shows the slide once more in the list, where it cannot be changed', async () => {
      const items = page.locator('.scene-item');
      expect(await items.count()).toBe(4);
      expect(await page.locator('.scene-number').allTextContents()).toEqual(['1', '2', '↩', '3']);
      expect(await items.nth(2).locator('.scene-title').textContent()).toBe('Lysark 1 igjen');
      // The recording ended on C, which is slide 3.
      expect(await items.nth(3).getAttribute('aria-current')).toBe('true');

      await items.nth(2).click();
      const note = page.locator('.repeat-note');
      await note.waitFor();
      expect(await note.textContent()).toContain('Lysark 1 vises her en gang til');
      expect(await page.locator('.insertbar').count()).toBe(0);
      expect(await page.locator('.repeat-panel h3').textContent()).toBe('Lysark 1, en gang til');
      // Both steps are on the slide, as it stood when the lecturer came back.
      expect(
        await page
          .locator('.stage-area [data-el="e_punkt_2"]')
          .evaluate((el) => getComputedStyle(el).opacity),
      ).toBe('1');
      await page.getByRole('tab', { name: /^Lyd/ }).click();
      expect(await page.getByRole('button', { name: 'Les inn', exact: true }).isDisabled()).toBe(
        true,
      );
      expect(await page.locator('.lecture-block').allTextContents()).toEqual(['1', '2', '↩', '3']);
      await shot(page, 'f03-igjen');
      await note.getByRole('button', { name: 'Gå til lysark 1' }).click();
      await expect.poll(() => items.nth(0).getAttribute('aria-current')).toBe('true');
      await page.locator('.insertbar').waitFor();

      // A change to the slide is a change where it is shown once more.
      await page.getByLabel('Navn i innholdsoversikten').fill('Nytt navn');
      const changed = await save();
      expect(changed.scenes[0]!.title).toBe('Nytt navn');
      expect(changed.scenes[2]!.title).toBe('Nytt navn');
      await page.getByLabel('Navn i innholdsoversikten').fill('Lysark A');
      recorded = await save();
    }, 60_000);

    it('makes a video that shows the slides in the order the lecturer showed them', async () => {
      const out = join(work, 'forelesning.mp4');
      await answerSaveDialog(out);
      await page
        .locator('.topbar-actions')
        .getByRole('button', { name: 'Eksporter video' })
        .click();
      const dialog = page.locator('dialog.video-dialog');
      await dialog.waitFor();
      // Slides are counted as the lecturer counts them: slide 2 has the repeat after it.
      await dialog.getByLabel('Første lysark').fill('2');
      await dialog.getByLabel('Siste lysark').fill('2');
      expect(await dialog.textContent()).toContain('1 lysark og ett som vises igjen');
      await dialog.getByLabel('Første lysark').fill('4');
      expect(await dialog.locator('.video-missing').textContent()).toContain('mellom 1 og 3');
      await dialog.getByLabel('Hele forelesningen').check();
      expect(await dialog.textContent()).toContain('3 lysark og ett som vises igjen');
      await dialog.getByRole('button', { name: 'Velg fil og eksporter' }).click();
      await expect
        .poll(() => page.locator('.notice').textContent(), { timeout: 150_000, interval: 500 })
        .toContain('Videoen er lagret');
      await page.locator('.notice button', { hasText: 'Lukk' }).click();

      const plan = schedule(recorded.scenes);
      /** One picture of the video, small and grey. */
      const picture = (time: number): Buffer =>
        execFileSync(
          ffmpeg,
          ['-v', 'error', '-ss', String(time), '-i', out, '-frames:v', '1'].concat([
            '-vf',
            'scale=192:108,format=gray',
            '-f',
            'rawvideo',
            'pipe:1',
          ]),
          { maxBuffer: 1 << 24 },
        );
      const difference = (x: Buffer, y: Buffer): number => {
        let sum = 0;
        for (let i = 0; i < x.length; i++) sum += Math.abs(x[i]! - y[i]!);
        return sum / x.length;
      };
      const [a, b, again, c] = plan.entries;
      const middle = (entry: { start: number; duration: number }): number =>
        entry.start + entry.duration / 2;
      const endOfA = picture(a!.start + a!.duration - 0.2);
      const onB = picture(middle(b!));
      const onAgain = picture(middle(again!));
      const startOfAgain = picture(again!.start + 0.15);
      const onC = picture(middle(c!));
      // Where the lecturer went back, the video shows A again, with both steps from the start.
      expect(difference(onAgain, endOfA)).toBeLessThan(0.05);
      expect(difference(startOfAgain, endOfA)).toBeLessThan(0.05);
      expect(difference(onAgain, onB)).toBeGreaterThan(0.15);
      expect(difference(onAgain, onC)).toBeGreaterThan(0.15);
      // At its first showing A began without the steps.
      expect(difference(picture(0.3), endOfA)).toBeGreaterThan(0.1);
      // The video is as long as what was recorded.
      const told = spawnSync(ffmpeg, ['-hide_banner', '-i', out], { encoding: 'utf8' }).stderr;
      const length = Number(/Duration: 00:00:(\d+\.\d+)/.exec(told)?.[1]);
      expect(Math.abs(length - plan.total)).toBeLessThan(0.2);
      // The chapters of the lecture are chapters of the video file: the second
      // begins where C begins.
      const chapterLines = told.split('\n').filter((line) => /^\s*Chapter #/.test(line));
      expect(chapterLines).toHaveLength(2);
      expect(told).toMatch(/title\s*: Første del/);
      expect(told).toMatch(/title\s*: Andre del/);
      const second = Number(/start (\d+\.\d+)/.exec(chapterLines[1]!)?.[1]);
      expect(Math.abs(second - c!.start)).toBeLessThan(0.05);
    }, 240_000);

    it('lets the student turn the pages slide by slide, while "Spill av" follows the recording', async () => {
      const out = join(work, 'forelesning.html');
      await answerSaveDialog(out);
      await page.getByRole('button', { name: 'Eksporter HTML' }).click();
      await expect
        .poll(() => page.locator('.notice').textContent(), { timeout: 60_000 })
        .toContain('Stemmen din er med');
      await page.locator('.notice button', { hasText: 'Lukk' }).click();

      const opening = app.waitForEvent('window');
      await page.getByRole('button', { name: 'Forhåndsvis' }).click();
      const player = await opening;
      await player.waitForSelector('.lp-stage .ls-scene');
      const counter = (): Promise<string | null> => player.locator('.lp-counter').textContent();
      const title = (): Promise<string | null> =>
        player.locator('.lp-stage [data-el^="e_tittel_"]').textContent();
      expect(await counter()).toBe('1 / 3');
      // The contents list has the chapters, and each slide once.
      await player.getByRole('button', { name: 'Innhold' }).click();
      expect(await player.locator('.lp-toc-chapter h3').allTextContents()).toEqual([
        'Første del',
        'Andre del',
      ]);
      expect(await player.locator('.lp-toc-item').count()).toBe(3);
      expect(await player.locator('.lp-toc-num').allTextContents()).toEqual(['1', '2', '3']);
      await player.getByRole('button', { name: 'Innhold' }).click();
      // By hand: A (two steps), B, and then C. The repeat of A is not a page to turn to.
      await player.keyboard.press('ArrowRight');
      await player.keyboard.press('ArrowRight');
      await player.keyboard.press('ArrowRight');
      await expect.poll(counter).toBe('2 / 3');
      await player.keyboard.press('ArrowRight');
      await expect.poll(counter).toBe('3 / 3');
      expect(await title()).toBe('Overskrift C');
      await player.keyboard.press('ArrowLeft');
      await expect.poll(counter).toBe('2 / 3');
      if (shots) await player.screenshot({ path: join(shots, 'f04-spiller.png') });

      // "Spill av" from B: when B's sound has ended, A is shown once more, with
      // both steps there, and then C.
      await player.getByRole('button', { name: 'Spill av' }).click();
      await expect.poll(title, { timeout: 20_000 }).toBe('Overskrift A');
      expect(await counter()).toBe('1 / 3');
      expect(
        await player
          .locator('.lp-stage [data-el="e_punkt_2"]')
          .evaluate((el) => getComputedStyle(el).opacity),
      ).toBe('1');
      await expect.poll(title, { timeout: 20_000 }).toBe('Overskrift C');
      await expect
        .poll(() => player.locator('.lp-play').textContent(), { timeout: 20_000 })
        .toBe('Spill av');
      await player.close();
    }, 120_000);
  },
);
