// Runs the built program end to end for marks on a picture: numbered points
// with a legend, labels with a line, dragging them, steps, and how they
// look to a student and in the video. Needs `npm run build`, and FFmpeg in
// vendor/ffmpeg for the video. The window is never shown, and nothing
// touches the network. The content is test content, not subject matter.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  _electron as electron,
  type ElectronApplication,
  type Locator,
  type Page,
} from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import type { ImageElement, MarkElement, Project } from '../src/shared/format/schema';
import { MARK_SIZE, addMark, followMarks, legendOf } from '../src/shared/layout/marks';
import { EXPORT_TEST, EXPORT_WAIT } from './fixtures/limits';
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

const PICTURE = { x: 500, y: 300, w: 800, h: 480, rotation: 0 };

describe.skipIf(!built)('marks on a picture, end to end', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;
  /** The marks of the second slide, made before the program was started. */
  let ready: { first: MarkElement; second: MarkElement };

  const shot = async (target: Page, name: string): Promise<void> => {
    if (!shots) return;
    mkdirSync(shots, { recursive: true });
    await target.screenshot({ path: join(shots, `${name}.png`) });
  };
  const save = async (): Promise<Project> => {
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
    return JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;
  };
  const marks = (project: Project, slide = 0): MarkElement[] =>
    project.scenes[slide]!.elements.filter((el): el is MarkElement => el.type === 'mark');
  const picture = (project: Project, slide = 0): ImageElement =>
    project.scenes[slide]!.elements.find((el): el is ImageElement => el.type === 'image')!;
  /** A point on the slide (in stage pixels) as a point on the screen. */
  const onScreen = async (x: number, y: number): Promise<{ x: number; y: number }> => {
    const slide = (await page.locator('.stage-inner').boundingBox())!;
    const scale = slide.width / 1920;
    return { x: slide.x + x * scale, y: slide.y + y * scale };
  };
  /** Drags what `from` is, by its middle, to a point on the slide. Alt keeps it off the grid. */
  const drag = async (from: Locator, to: { x: number; y: number }): Promise<void> => {
    const box = (await from.boundingBox())!;
    const target = await onScreen(to.x, to.y);
    await page.keyboard.down('Alt');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Alt');
  };

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-merker-'));
    projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    const png = testPng(400, 240);
    writeFileSync(join(projectDir, 'media', 'testbilde.png'), png);
    const project = newProject('Testforelesning');
    project.assets.a_bilde = {
      kind: 'image',
      file: 'media/testbilde.png',
      mime: 'image/png',
      bytes: png.length,
      name: 'testbilde.png',
    };
    for (const name of ['A', 'B']) {
      const scene = newScene('content', `Lysark ${name}`);
      scene.showLogo = false;
      scene.elements.push(
        {
          id: `e_tittel_${name}`,
          type: 'text',
          role: 'title',
          content: richText(`Overskrift ${name}`),
          align: 'left',
          valign: 'top',
          box: { x: 120, y: 96, w: 1000, h: 90, rotation: 0 },
        },
        {
          id: `e_bilde_${name}`,
          type: 'image',
          asset: 'a_bilde',
          alt: `Bilde ${name}`,
          box: PICTURE,
        },
      );
      project.scenes.push(scene);
    }
    // The second slide has its marks already: the first one has "Lær mer", the second a step.
    const second = project.scenes[1]!;
    let n = 0;
    const id = (): string => `e_merke_${++n}`;
    const a = addMark(second, 'e_bilde_B', id)!;
    const b = addMark(second, 'e_bilde_B', id)!;
    a.text = 'Del A';
    a.more = { title: '', blocks: [{ id: 'm1', kind: 'heading', text: 'Overskrift C' }] };
    // Both lie in the left half of the test picture, which is purple: the right half is
    // orange like the marks, and the video is measured by its orange.
    a.box = { ...a.box, x: 620 - MARK_SIZE / 2, y: 450 - MARK_SIZE / 2 };
    b.text = 'Del B';
    b.box = { ...b.box, x: 800 - MARK_SIZE / 2, y: 600 - MARK_SIZE / 2 };
    followMarks(second);
    second.timeline = [{ id: 'st1', actions: [{ target: b.id, effect: 'fade', duration: 0.4 }] }];
    ready = { first: a, second: b };
    expect(legendOf(second, 'e_bilde_B')).toBeDefined();
    writeFileSync(join(projectDir, 'prosjekt.json'), JSON.stringify(project, null, 2), 'utf8');

    const args = [OFFLINE, `--user-data-dir=${join(work, 'userdata')}`, projectDir];
    app = await electron.launch({
      ...(packaged ? { executablePath: packaged, args } : { args: [root, ...args] }),
      env: { ...process.env, LYSARK_HIDDEN: '1' },
    });
    page = await app.firstWindow();
    await page.waitForSelector('.app');
    await page.locator('.scene-item').first().click();
    await page.waitForSelector('.stage-inner .ls-el-image');
  }, 60_000);

  afterAll(async () => {
    await app
      ?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.destroy()))
      .catch(() => undefined);
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('puts numbered marks on a picture, with a legend that writes itself', async () => {
    const stage = page.locator('.stage-inner');
    await stage.locator('.ls-el-image').click();
    const group = page.locator('.group', { hasText: 'Merker på bildet' });
    expect(await group.locator('.hint').first().textContent()).toContain('Pek ut det viktige');
    await group.getByRole('button', { name: 'Legg til merke' }).click();
    await group.getByLabel('Tekst til merke 1').fill('Del A');
    await group.getByRole('button', { name: 'Legg til merke' }).click();
    await group.getByLabel('Tekst til merke 2').fill('Del B');
    expect(await stage.locator('.ls-mark-number').allTextContents()).toEqual(['1', '2']);
    expect(await stage.locator('.ls-legend .ls-legend-text').allTextContents()).toEqual([
      'Del A',
      'Del B',
    ]);
    // The picture is still what is chosen, so the next mark is one press away.
    expect(await group.getByRole('button', { name: 'Ett steg per merke' }).count()).toBe(1);
    await shot(page, 'f01-merker-tall');

    // A mark is dragged to where it should point.
    await drag(stage.locator('.ls-el-mark').first(), { x: 700, y: 420 });
    let project = await save();
    const [first, second] = marks(project);
    expect(Math.abs(first!.point.x - 700)).toBeLessThan(4);
    expect(Math.abs(first!.point.y - 420)).toBeLessThan(4);
    expect(first!.box.w).toBe(MARK_SIZE);
    expect(first!.box.x + MARK_SIZE / 2).toBe(first!.point.x);
    expect(first!.text).toBe('Del A');
    expect(project.scenes[0]!.elements.filter((el) => el.type === 'legend')).toHaveLength(1);

    // The picture is dragged: the marks and the legend go with it.
    const before = { box: picture(project).box, first: first!.point, second: second!.point };
    const legendBefore = legendOf(project.scenes[0]!, 'e_bilde_A')!.box;
    const hold = await onScreen(before.box.x + 60, before.box.y + before.box.h - 40);
    await page.keyboard.down('Alt');
    await page.mouse.move(hold.x, hold.y);
    await page.mouse.down();
    const drop = await onScreen(before.box.x + 60 - 120, before.box.y + before.box.h - 40 + 60);
    await page.mouse.move(drop.x, drop.y, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Alt');
    project = await save();
    const after = picture(project).box;
    const by = { x: after.x - before.box.x, y: after.y - before.box.y };
    expect(Math.abs(by.x + 120)).toBeLessThan(4);
    expect(Math.abs(by.y - 60)).toBeLessThan(4);
    expect(marks(project)[0]!.point).toEqual({
      x: before.first.x + by.x,
      y: before.first.y + by.y,
    });
    expect(marks(project)[1]!.point).toEqual({
      x: before.second.x + by.x,
      y: before.second.y + by.y,
    });
    const legendAfter = legendOf(project.scenes[0]!, 'e_bilde_A')!.box;
    expect(legendAfter.x).toBe(legendBefore.x + by.x);
    expect(legendAfter.y).toBe(legendBefore.y + by.y);

    // One step per mark, in the order they are numbered.
    await stage.locator('.ls-el-image').click({ position: { x: 20, y: 20 } });
    await page
      .locator('.group', { hasText: 'Merker på bildet' })
      .getByRole('button', { name: 'Ett steg per merke' })
      .click();
    project = await save();
    expect(project.scenes[0]!.timeline.map((step) => step.actions[0]!.target)).toEqual(
      marks(project).map((mark) => mark.id),
    );
  }, 90_000);

  it('turns them into labels with a line, whose point is dragged by its own handle', async () => {
    const stage = page.locator('.stage-inner');
    await stage.locator('.ls-el-image').click({ position: { x: 20, y: 20 } });
    const group = page.locator('.group', { hasText: 'Merker på bildet' });
    await group.getByLabel('Slik vises merkene').selectOption({ label: 'Etiketter med strek' });
    await expect.poll(() => stage.locator('.ls-mark-label').count()).toBe(2);
    expect(await stage.locator('.ls-legend').count()).toBe(0);
    expect(await stage.locator('.ls-mark-label .ls-mark-text').allTextContents()).toEqual([
      'Del A',
      'Del B',
    ]);
    let project = await save();
    expect(picture(project).marks).toBe('labels');
    // The steps of the marks stay; the legend had none.
    expect(project.scenes[0]!.timeline).toHaveLength(2);
    const label = marks(project)[0]!;
    // The label lies beside the picture, not on it.
    const box = picture(project).box;
    expect(label.box.x + label.box.w <= box.x || label.box.x >= box.x + box.w).toBe(true);

    // A label that is chosen shows its text, and a handle on what it points at.
    await stage.locator('.ls-el-mark').first().click();
    expect(await page.getByLabel('Tekst på etiketten').inputValue()).toBe('Del A');
    const handle = page.locator('.point-handle');
    await handle.waitFor();
    const to = { x: box.x + 600, y: box.y + 300 };
    await drag(handle, to);
    await shot(page, 'f02-merker-etiketter');
    project = await save();
    const moved = marks(project)[0]!;
    expect(Math.abs(moved.point.x - to.x)).toBeLessThan(4);
    expect(Math.abs(moved.point.y - to.y)).toBeLessThan(4);
    // Only what it points at was moved; the label lies where it lay.
    expect(moved.box).toEqual(label.box);
    // And the way back to the picture.
    await page.getByRole('button', { name: 'Velg bildet merket står på' }).click();
    await page.locator('.group', { hasText: 'Merker på bildet' }).waitFor();
  }, 60_000);

  it('shows the marks to a student: a step brings one in, and one opens "Lær mer"', async () => {
    await page.locator('.scene-item').nth(1).click();
    await page.waitForSelector(`.stage-inner [data-el="${ready.first.id}"]`);
    const opened = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Forhåndsvis' }).click();
    const player = await opened;
    await player.waitForSelector('.lp-stage .ls-scene');
    const mark = (id: string): Locator => player.locator(`.lp-stage [data-el="${id}"]`);
    const hidden = (target: Locator): Promise<boolean> =>
      target.evaluate((el) => getComputedStyle(el).visibility === 'hidden');
    const row = (id: string): Locator =>
      player.locator(`.lp-stage .ls-legend [data-follows="${id}"]`);
    // The first mark is there; the second waits for its step, and so does its row in the legend.
    expect(await hidden(mark(ready.first.id))).toBe(false);
    expect(await hidden(mark(ready.second.id))).toBe(true);
    expect(await hidden(row(ready.second.id))).toBe(true);
    expect(await row(ready.first.id).textContent()).toBe('1Del A');
    await player.keyboard.press('ArrowRight');
    await expect.poll(() => hidden(mark(ready.second.id))).toBe(false);
    await expect.poll(() => hidden(row(ready.second.id))).toBe(false);
    // The mark with "Lær mer" is a button with a name, and opens its box.
    const button = mark(ready.first.id).locator('button.ls-mark');
    expect(await button.getAttribute('aria-label')).toBe('Lær mer om: Del A');
    await button.click();
    await player.waitForSelector('.lp-panel:not([hidden])');
    expect(await player.locator('.lp-panel').textContent()).toContain('Overskrift C');
    expect(await button.getAttribute('aria-expanded')).toBe('true');
    await shot(player, 'f03-merker-spiller');
    await player.close();
  }, 60_000);

  it.skipIf(!existsSync(ffmpeg))(
    'has the marks in the video, each from the moment it comes in',
    async () => {
      const out = join(work, 'forelesning.mp4');
      await app.evaluate(({ dialog }, path) => {
        dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: path });
      }, out);
      await page
        .locator('.topbar-actions')
        .getByRole('button', { name: 'Eksporter video' })
        .click();
      const dialog = page.locator('dialog.video-dialog');
      await dialog.waitFor();
      await dialog.getByRole('button', { name: 'Velg fil og eksporter' }).click();
      await expect
        .poll(() => page.locator('.notice').textContent(), { timeout: EXPORT_WAIT, interval: 500 })
        .toContain('Videoen er lagret');
      await page.locator('.notice button', { hasText: 'Lukk' }).click();

      /** How many pixels round a point are the orange of a numbered mark. */
      const orange = (time: number, at: { x: number; y: number }): number => {
        const pixels = execFileSync(
          ffmpeg,
          ['-v', 'error', '-ss', String(time), '-i', out, '-frames:v', '1'].concat([
            '-vf',
            `crop=60:60:${Math.round(at.x - 30)}:${Math.round(at.y - 30)}`,
            '-f',
            'rawvideo',
            '-pix_fmt',
            'rgb24',
            'pipe:1',
          ]),
          { maxBuffer: 1 << 22 },
        );
        let count = 0;
        for (let i = 0; i < pixels.length; i += 3) {
          if (
            pixels[i]! > 215 &&
            pixels[i + 1]! > 50 &&
            pixels[i + 1]! < 150 &&
            pixels[i + 2]! < 70
          ) {
            count += 1;
          }
        }
        return count;
      };
      // The first slide has no sound: it stands 5 seconds and 2 for each of its two
      // steps. The second slide begins after that, and its one step comes half-way.
      const second = 9;
      expect(orange(second + 0.5, ready.first.point)).toBeGreaterThan(600);
      expect(orange(second + 0.5, ready.second.point)).toBe(0);
      expect(orange(second + 6.5, ready.second.point)).toBeGreaterThan(600);
      // Away from the marks there is no orange.
      expect(orange(second + 6.5, { x: 300, y: 900 })).toBe(0);
    },
    EXPORT_TEST,
  );
});
