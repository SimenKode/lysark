// Runs the built program end to end for the movements: a step proposes how
// each element comes in (an arrow is drawn, a large number counts up), the
// lecturer changes it and its speed, and steps are made that mark, take
// away and zoom, with the frame of the zoom dragged on the slide. A student
// then steps through it. Needs `npm run build`. The window is never shown,
// and nothing touches the network. The content is test content.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import type { Project, Scene } from '../src/shared/format/schema';
import { EXPORT_TEST, EXPORT_WAIT } from './fixtures/limits';
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

describe.skipIf(!built)('movements, end to end', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;

  const shot = async (target: Page, name: string): Promise<void> => {
    if (!shots) return;
    mkdirSync(shots, { recursive: true });
    await target.screenshot({ path: join(shots, `${name}.png`) });
  };
  const save = async (): Promise<Scene> => {
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
    const project = JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;
    return project.scenes[0]!;
  };
  /** Chooses an element on the slide and opens the tab with the steps. */
  const choose = async (id: string): Promise<void> => {
    await page.locator(`.stage-inner [data-el="${id}"]`).click();
    await page.getByRole('tab', { name: /^Steg/ }).click();
  };
  const steps = () => page.locator('.step-list .step-item:not(.step-start)');

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-bevegelser-'));
    projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    const project = newProject('Testforelesning');
    const scene = newScene('content', 'Lysark A');
    scene.showLogo = false;
    scene.elements.push(
      {
        id: 'e_tittel',
        type: 'text',
        role: 'title',
        content: richText('Overskrift A'),
        align: 'left',
        valign: 'top',
        box: { x: 120, y: 96, w: 1000, h: 90, rotation: 0 },
      },
      {
        id: 'e_boks',
        type: 'shape',
        geometry: 'rect',
        fill: 'lilla',
        content: richText('Boks A'),
        box: { x: 200, y: 400, w: 360, h: 200, rotation: 0 },
      },
      {
        id: 'e_pil',
        type: 'shape',
        geometry: 'arrow',
        strokeWidth: 8,
        box: { x: 620, y: 500, w: 400, h: 4, rotation: 0 },
      },
      {
        id: 'e_tall',
        type: 'text',
        role: 'number',
        content: richText('1 250'),
        align: 'left',
        valign: 'top',
        box: { x: 1100, y: 420, w: 600, h: 160, rotation: 0 },
      },
    );
    project.scenes.push(scene);
    writeFileSync(join(projectDir, 'prosjekt.json'), JSON.stringify(project, null, 2), 'utf8');
    const args = [OFFLINE, `--user-data-dir=${join(work, 'userdata')}`, projectDir];
    app = await electron.launch({
      ...(packaged ? { executablePath: packaged, args } : { args: [root, ...args] }),
      env: { ...process.env, LYSARK_HIDDEN: '1' },
    });
    page = await app.firstWindow();
    await page.waitForSelector('.app');
    await page.waitForSelector('.stage-inner .ls-el-text');
  }, 60_000);

  afterAll(async () => {
    await app
      ?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.destroy()))
      .catch(() => undefined);
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('proposes how each element comes in, and lets the lecturer choose another and the speed', async () => {
    for (const id of ['e_pil', 'e_tall', 'e_boks']) {
      await choose(id);
      await page.getByRole('button', { name: 'Nytt steg med det som er valgt' }).click();
    }
    await expect.poll(() => steps().count()).toBe(3);
    let scene = await save();
    // An arrow is drawn, a large number counts up, a box tones in: each at the ordinary speed.
    expect(scene.timeline.map((step) => step.actions)).toEqual([
      [{ target: 'e_pil', effect: 'draw', duration: 0.8 }],
      [{ target: 'e_tall', effect: 'count', duration: 1 }],
      [{ target: 'e_boks', effect: 'fade', duration: 0.4 }],
    ]);
    // What can be chosen follows the element: a box cannot be drawn or counted.
    const how = (index: number) => steps().nth(index).locator('ul select');
    expect(await how(0).locator('option').allTextContents()).toEqual([
      'Toner inn',
      'Glir inn fra siden',
      'Vokser fram',
      'Tegnes',
      'Vises med en gang',
    ]);
    expect(await how(2).locator('option').allTextContents()).toEqual([
      'Toner inn',
      'Glir inn fra siden',
      'Vokser fram',
      'Vises med en gang',
    ]);
    expect(await how(0).inputValue()).toBe('draw');
    await how(2).selectOption({ label: 'Glir inn fra siden' });
    await page.getByLabel('Fart på steg 3').selectOption({ label: 'Langsom' });
    await page.getByLabel('Fart på steg 1').selectOption({ label: 'Rask' });
    scene = await save();
    expect(scene.timeline[2]!.actions).toEqual([
      { target: 'e_boks', effect: 'slide', duration: 1 },
    ]);
    expect(scene.timeline[0]!.actions).toEqual([
      { target: 'e_pil', effect: 'draw', duration: 0.4 },
    ]);
  }, 120_000);

  it('makes steps that mark, take away and zoom, with the frame dragged on the slide', async () => {
    await choose('e_boks');
    await page.getByRole('button', { name: 'Marker det som er valgt' }).click();
    await choose('e_pil');
    await page.getByRole('button', { name: 'Ta bort det som er valgt' }).click();
    // Nothing is zoomed in on yet, so there is nothing to zoom out of.
    expect(await page.getByRole('button', { name: 'Zoom ut igjen' }).isDisabled()).toBe(true);
    await choose('e_tall');
    await page.getByRole('button', { name: 'Zoom inn', exact: true }).click();
    await expect.poll(() => steps().count()).toBe(6);
    expect(await steps().nth(3).locator('strong').textContent()).toBe('Steg 4: markerer');
    expect(await steps().nth(4).locator('strong').textContent()).toBe('Steg 5: tar bort');
    expect(await steps().nth(5).locator('strong').textContent()).toBe('Steg 6: zoomer inn');

    // The frame of the zoom is on the slide, round what was chosen, in the shape of the slide.
    const frame = page.locator('.stage-inner .zoom-frame');
    await frame.waitFor();
    expect(await frame.locator('.zoom-frame-label').textContent()).toBe('Steg 6: zoomer inn hit');
    let scene = await save();
    const first = scene.timeline[5]!.zoom!;
    expect(scene.timeline[5]).toMatchObject({ kind: 'zoom', actions: [], seconds: 0.9 });
    expect(first.w / first.h).toBeCloseTo(16 / 9, 2);
    expect(first.x).toBeLessThanOrEqual(1100);
    expect(first.x + first.w).toBeGreaterThanOrEqual(1700);
    await shot(page, 'b01-zoom-ramme');

    // Dragged to the left, it moves; its size stays.
    const rect = (await frame.boundingBox())!;
    const slide = (await page.locator('.stage-inner').boundingBox())!;
    const scale = slide.width / 1920;
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width / 2 - 300 * scale, rect.y + rect.height / 2, {
      steps: 5,
    });
    await page.mouse.up();
    scene = await save();
    const moved = scene.timeline[5]!.zoom!;
    expect(Math.abs(moved.x - (first.x - 300))).toBeLessThan(4);
    expect(moved.w).toBe(first.w);
    // Nothing on the slide was chosen or moved by it.
    expect(scene.elements.map((el) => el.box)).toEqual(
      (
        JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project
      ).scenes[0]!.elements.map((el) => el.box),
    );
    // The corner makes the part smaller, still in the shape of the slide.
    const corner = (await frame.locator('.zoom-frame-corner').boundingBox())!;
    await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
    await page.mouse.down();
    await page.mouse.move(corner.x - 150 * scale, corner.y - 100 * scale, { steps: 5 });
    await page.mouse.up();
    scene = await save();
    const smaller = scene.timeline[5]!.zoom!;
    expect(smaller.w).toBeLessThan(moved.w - 100);
    expect(smaller.x).toBe(moved.x);
    expect(smaller.w / smaller.h).toBeCloseTo(16 / 9, 2);

    // Done with the frame, it is put away; and now there is something to zoom out of.
    await steps().nth(5).getByRole('button', { name: 'Ferdig med rammen' }).click();
    await expect.poll(() => frame.count()).toBe(0);
    await page.getByRole('button', { name: 'Zoom ut igjen' }).click();
    await expect.poll(() => steps().count()).toBe(7);
    expect(await steps().nth(6).locator('strong').textContent()).toBe('Steg 7: zoomer ut');
    scene = await save();
    expect(scene.timeline.map((step) => step.kind ?? 'show')).toEqual([
      'show',
      'show',
      'show',
      'mark',
      'hide',
      'zoom',
      'zoom',
    ]);
    expect(scene.timeline[6]!.zoom).toBeUndefined();
    await shot(page, 'b02-stegene');
  }, 120_000);

  it('shows a student each step as it was made', async () => {
    const opened = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Forhåndsvis' }).click();
    const player = await opened;
    await player.waitForSelector('.lp-stage .ls-scene');
    const el = (id: string) => player.locator(`.lp-stage [data-el="${id}"]`);
    const style = (id: string, name: string): Promise<string> =>
      el(id).evaluate((node, key) => (node as HTMLElement).style.getPropertyValue(key), name);
    const hidden = (id: string): Promise<boolean> =>
      el(id).evaluate((node) => getComputedStyle(node).visibility === 'hidden');
    const zoom = (): Promise<string> =>
      player
        .locator('.lp-stage .ls-scene > .ls-zoom')
        .evaluate((node) => (node as HTMLElement).style.transform);
    // Nothing has come yet.
    expect(await hidden('e_pil')).toBe(true);
    expect(await hidden('e_tall')).toBe(true);
    expect(await hidden('e_boks')).toBe(true);

    // The arrow is drawn; when it is done, nothing of the drawing is left on it.
    await player.keyboard.press('ArrowRight');
    await expect.poll(() => hidden('e_pil')).toBe(false);
    await expect
      .poll(
        () =>
          el('e_pil')
            .locator('line')
            .evaluate((node) => (node as SVGElement).style.strokeDasharray),
        {
          timeout: 15_000,
        },
      )
      .toBe('');
    // The number counts up to what is written.
    await player.keyboard.press('ArrowRight');
    await expect.poll(() => hidden('e_tall')).toBe(false);
    await expect.poll(() => el('e_tall').textContent(), { timeout: 15_000 }).toBe('1 250');
    await expect.poll(() => style('e_tall', 'opacity'), { timeout: 15_000 }).toBe('');
    // The box glides in from the side, and stands in its place.
    await player.keyboard.press('ArrowRight');
    await expect.poll(() => hidden('e_boks')).toBe(false);
    await expect.poll(() => style('e_boks', 'opacity'), { timeout: 15_000 }).toBe('');
    expect(await style('e_boks', 'translate')).toBe('');
    // The box is marked, with a frame round it.
    await player.keyboard.press('ArrowRight');
    await expect.poll(() => style('e_boks', 'outline-style'), { timeout: 15_000 }).toBe('solid');
    await shot(player, 'b03-markert');
    // The arrow is taken away, and the mark goes when the next step comes.
    await player.keyboard.press('ArrowRight');
    await expect.poll(() => hidden('e_pil'), { timeout: 15_000 }).toBe(true);
    await expect.poll(() => style('e_boks', 'outline-style'), { timeout: 15_000 }).toBe('');
    // The picture glides in on the part of the slide, and out again.
    expect(await zoom()).toBe('');
    await player.keyboard.press('ArrowRight');
    await expect.poll(zoom, { timeout: 15_000 }).toMatch(/^scale\(\d\.\d+\) translate\(-\d/);
    const scale = Number(/scale\(([\d.]+)\)/.exec(await zoom())![1]);
    await expect
      .poll(async () => Number(/scale\(([\d.]+)\)/.exec(await zoom())?.[1] ?? 0), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(scale);
    await player.waitForTimeout(1500);
    await shot(player, 'b04-zoomet-inn');
    await player.keyboard.press('ArrowRight');
    await expect.poll(zoom, { timeout: 15_000 }).toBe('');
    await player.close();
  }, 120_000);
});

// The video is drawn picture by picture from the same moves. A slide with a
// purple box, and steps with times: the picture zooms in on the box, the box
// is marked, the picture zooms out, and the box is taken away. Each is
// measured in the pictures of the film. Needs FFmpeg in vendor/ffmpeg.
describe.skipIf(!built || !existsSync(ffmpeg))('movements, in the video', () => {
  let work: string;
  let app: ElectronApplication;
  let page: Page;

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-bevegelser-video-'));
    const projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    const project = newProject('Testforelesning');
    const scene = newScene('content', 'Lysark A');
    scene.showLogo = false;
    scene.elements.push({
      id: 'e_boks',
      type: 'shape',
      geometry: 'rect',
      fill: 'lilla',
      box: { x: 200, y: 400, w: 360, h: 200, rotation: 0 },
    });
    const mark = { target: 'e_boks', effect: 'fade' as const, duration: 0.4 };
    scene.timeline = [
      // A quarter of the slide, which holds the whole box: everything twice as large.
      { id: 't1', at: 1, kind: 'zoom', actions: [], zoom: { x: 0, y: 270, w: 960, h: 540 } },
      { id: 't2', at: 3, kind: 'mark', actions: [mark] },
      { id: 't3', at: 5, kind: 'zoom', actions: [] },
      { id: 't4', at: 7, kind: 'hide', actions: [mark] },
    ];
    project.scenes.push(scene);
    writeFileSync(join(projectDir, 'prosjekt.json'), JSON.stringify(project, null, 2), 'utf8');
    const args = [OFFLINE, `--user-data-dir=${join(work, 'userdata')}`, projectDir];
    app = await electron.launch({
      ...(packaged ? { executablePath: packaged, args } : { args: [root, ...args] }),
      env: { ...process.env, LYSARK_HIDDEN: '1' },
    });
    page = await app.firstWindow();
    await page.waitForSelector('.app');
    await page.waitForSelector('.stage-inner .ls-el-shape');
  }, 60_000);

  afterAll(async () => {
    await app
      ?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.destroy()))
      .catch(() => undefined);
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it(
    'zooms in, marks, zooms out and takes away, at the times of the steps',
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

      /** How many pixels of a picture of the film are purple (the box), and orange (the mark). */
      const colours = (time: number): { purple: number; orange: number } => {
        const pixels = execFileSync(
          ffmpeg,
          ['-v', 'error', '-ss', String(time), '-i', out, '-frames:v', '1'].concat([
            '-f',
            'rawvideo',
            '-pix_fmt',
            'rgb24',
            'pipe:1',
          ]),
          { maxBuffer: 1 << 26 },
        );
        let purple = 0;
        let orange = 0;
        for (let i = 0; i < pixels.length; i += 3) {
          const [r, g, b] = [pixels[i]!, pixels[i + 1]!, pixels[i + 2]!];
          if (Math.abs(r - 120) < 40 && g < 60 && b > 190) purple += 1;
          else if (r > 215 && g > 60 && g < 140 && b < 60) orange += 1;
        }
        return { purple, orange };
      };
      const box = 360 * 200;
      const near = (count: number, expected: number): boolean =>
        Math.abs(count - expected) < expected * 0.06;
      // From the start: the box as it is, and nothing marked.
      const start = colours(0.5);
      expect(near(start.purple, box)).toBe(true);
      expect(start.orange).toBe(0);
      // Zoomed in on a quarter of the slide: the box is twice as wide and twice as high.
      expect(near(colours(2.5).purple, box * 4)).toBe(true);
      // Marked: an orange frame round it (16 wide in the picture, round a box of 720 by 400).
      const marked = colours(4.5);
      expect(near(marked.purple, box * 4)).toBe(true);
      expect(marked.orange).toBeGreaterThan(30_000);
      // Zoomed out again, and the mark has gone with the step that came.
      const back = colours(6.5);
      expect(near(back.purple, box)).toBe(true);
      expect(back.orange).toBe(0);
      // Taken away.
      expect(colours(8.5).purple).toBe(0);
      if (shots) {
        mkdirSync(shots, { recursive: true });
        execFileSync(
          ffmpeg,
          ['-v', 'error', '-y', '-ss', '4.5', '-i', out].concat([
            '-frames:v',
            '1',
            join(shots, 'b05-video-zoomet-og-markert.png'),
          ]),
        );
      }
    },
    EXPORT_TEST,
  );
});
