// Runs the built program end to end for upright slides (9:16): an upright
// PDF made here is imported, and Lysark recommends and chooses «Stående
// (9:16)»; the slide is upright in the editor, in «Forhåndsvis», in the
// exported HTML file and in the video (1080 x 1920, checked with FFmpeg).
// A lying PDF still gets «Liggende (16:9)». A new, empty project can be
// made upright, and a "Lær mer" box on an upright slide stays inside it.
// Needs `npm run build`, and FFmpeg in vendor/ffmpeg for the video. The
// window is never shown on screen, and nothing touches the network. The
// content is neutral ("A", "B").
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import type { Project } from '../src/shared/format/schema';
import { buildPdf } from './fixtures/buildPdf';
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

const launch = (work: string, extra: string[] = []): Promise<ElectronApplication> => {
  const args = [OFFLINE, `--user-data-dir=${join(work, 'userdata')}`, ...extra];
  return electron.launch({
    ...(packaged ? { executablePath: packaged, args } : { args: [root, ...args] }),
    env: { ...process.env, LYSARK_HIDDEN: '1' },
  });
};

const shot = async (target: Page, name: string): Promise<void> => {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await target.screenshot({ path: join(shots, `${name}.png`) });
};

/** The size of a slide as it is laid out (before any scaling) and as it is seen. */
const slideSize = (target: Page, selector: string) =>
  target
    .locator(selector)
    .first()
    .evaluate((el: HTMLElement) => {
      const seen = el.getBoundingClientRect();
      return {
        width: el.offsetWidth,
        height: el.offsetHeight,
        seenWidth: seen.width,
        seenHeight: seen.height,
        upright: el.classList.contains('ls-upright'),
      };
    });

describe.skipIf(!built)('upright slides, end to end', () => {
  let work: string;
  let app: ElectronApplication;
  let page: Page;
  const projectDir = (): string => join(work, 'Stående');
  const saved = (dir: string): Project =>
    JSON.parse(readFileSync(join(dir, 'prosjekt.json'), 'utf8')) as Project;

  /** Makes the next file dialogs answer with these paths. */
  const answerDialogs = (open: string, save: string): Promise<void> =>
    app.evaluate(
      ({ dialog }, paths) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.open] });
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.save });
      },
      { open, save },
    );
  const fileMenu = (label: string): Promise<void> =>
    app.evaluate(({ Menu }, text) => {
      const file = Menu.getApplicationMenu()!.items.find((item) => item.label === 'Fil')!;
      file.submenu!.items.find((item) => item.label === text)!.click();
    }, label);

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-staende-'));
    // An upright A4 page and a lying 16:9 page, each with a line of text.
    writeFileSync(
      join(work, 'staende.pdf'),
      buildPdf({ title: 'A', pages: [{ width: 595, height: 842, text: 'A' }] }),
    );
    writeFileSync(
      join(work, 'liggende.pdf'),
      buildPdf({ title: 'B', pages: [{ width: 720, height: 405, text: 'B' }] }),
    );
    app = await launch(work);
    page = await app.firstWindow();
    await page.waitForSelector('.welcome');
  }, 60_000);

  afterAll(async () => {
    await app
      ?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.destroy()))
      .catch(() => undefined);
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('recommends «Liggende (16:9)» for a lying PDF', async () => {
    await answerDialogs(join(work, 'liggende.pdf'), join(work, 'Liggende'));
    await fileMenu('Importer PDF …');
    const dialog = page.locator('dialog.look-dialog');
    await dialog.waitFor();
    await expect.poll(() => dialog.textContent()).toContain('Sidene i fila er liggende.');
    const lying = dialog.getByRole('radio', { name: /^Liggende \(16:9\)/ });
    expect(await lying.isChecked()).toBe(true);
    expect(await dialog.getByRole('radio', { name: /^Stående \(9:16\)/ }).isChecked()).toBe(false);
    // The recommendation stands by the shape the pages have, and only there.
    expect(await dialog.locator('.look-recommended').count()).toBe(1);
    expect(
      await dialog
        .locator('.look-option', { has: page.locator('.look-recommended') })
        .textContent(),
    ).toContain('Liggende (16:9)');
    await dialog.getByRole('button', { name: 'Avbryt' }).click();
    await dialog.waitFor({ state: 'detached' });
  }, 60_000);

  it('recommends and chooses «Stående (9:16)» for an upright PDF, and makes upright slides', async () => {
    await answerDialogs(join(work, 'staende.pdf'), projectDir());
    await fileMenu('Importer PDF …');
    const dialog = page.locator('dialog.look-dialog');
    await dialog.waitFor();
    await expect.poll(() => dialog.textContent()).toContain('Sidene i fila er stående.');
    const upright = dialog.getByRole('radio', { name: /^Stående \(9:16\)/ });
    expect(await upright.isChecked()).toBe(true);
    expect(
      await dialog
        .locator('.look-option', { has: page.locator('.look-recommended') })
        .textContent(),
    ).toContain('Stående (9:16)Anbefalt');
    // Both shapes are there to choose from.
    expect(await dialog.getByRole('radio', { name: /^Liggende \(16:9\)/ }).count()).toBe(1);
    if (shots) {
      // The dialog has come all the way in before the picture is taken.
      await expect
        .poll(() => dialog.evaluate((el) => getComputedStyle(el).opacity), { timeout: 15_000 })
        .toBe('1');
      await page.waitForTimeout(2500);
      await shot(page, 'c1-import-anbefalt');
    }
    await dialog.getByRole('button', { name: 'Importer' }).click();
    await page.waitForSelector('.scene-item', { timeout: 60_000 });

    const project = saved(projectDir());
    expect(project.orientation).toBe('portrait');
    // The A4 page fills the width of the slide and gets air above and below.
    const picture = project.scenes[0]!.elements.find((el) => el.type === 'image');
    if (picture) {
      expect(picture.box.x).toBe(0);
      expect(picture.box.w).toBe(1080);
      expect(picture.box.y).toBeGreaterThan(0);
    }
    const text = project.scenes[0]!.elements.find((el) => el.type === 'text')!;
    expect(text.box.x + text.box.w).toBeLessThanOrEqual(1080);
    expect(text.box.y).toBeGreaterThan(0);

    // The editor draws an upright slide.
    const editor = await slideSize(page, '.stage-inner .ls-scene');
    expect(editor).toMatchObject({ width: 1080, height: 1920, upright: true });
    expect(editor.seenHeight).toBeGreaterThan(editor.seenWidth);
    const thumb = await slideSize(page, '.scene-thumb .ls-scene');
    expect(thumb).toMatchObject({ width: 1080, height: 1920 });
    await shot(page, 'c2-redigering-staende');
  }, 120_000);

  it('shows the upright slide upright in «Forhåndsvis»', async () => {
    const opened = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Forhåndsvis' }).click();
    const player = await opened;
    await player.waitForSelector('.lp-stage .ls-scene');
    const box = await player
      .locator('.lp-stagebox')
      .evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
    expect(box.height).toBeGreaterThan(box.width);
    expect(box.height / box.width).toBeCloseTo(1920 / 1080, 1);
    expect(await slideSize(player, '.lp-stage .ls-scene')).toMatchObject({
      width: 1080,
      height: 1920,
      upright: true,
    });
    await shot(player, 'c3-forhandsvis-staende');
    await player.close();
  }, 60_000);

  it('exports an HTML file that shows the slide upright, as tall as the window allows', async () => {
    const out = join(work, 'staende.html');
    await answerDialogs('', out);
    await page.locator('.topbar-actions').getByRole('button', { name: 'Eksporter HTML' }).click();
    await expect
      .poll(() => page.locator('.notice').textContent(), { timeout: 60_000 })
      .toContain('HTML-fila er lagret');
    const html = readFileSync(out, 'utf8');
    const data = /<script type="application\/json" id="lysark-data">([\s\S]*?)<\/script>/.exec(
      html,
    );
    expect((JSON.parse(data![1]!) as { project: Project }).project.orientation).toBe('portrait');
    // The file opened in a browser window, never shown, as a student would open it.
    const opened = app.waitForEvent('window');
    await app.evaluate(async ({ BrowserWindow }, file) => {
      const window = new BrowserWindow({ show: false, width: 1200, height: 800 });
      await window.loadFile(file);
    }, out);
    const browser = await opened;
    await browser.waitForSelector('.lp-stage .ls-scene');
    const box = await browser
      .locator('.lp-stagebox')
      .evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
    const viewport = await browser
      .locator('.lp-viewport')
      .evaluate((el) => el.getBoundingClientRect().toJSON() as DOMRect);
    // As tall as the window allows, and centred.
    expect(Math.abs(box.height - viewport.height)).toBeLessThan(2);
    expect(box.height / box.width).toBeCloseTo(1920 / 1080, 1);
    const middle = box.left + box.width / 2;
    expect(Math.abs(middle - (viewport.left + viewport.width / 2))).toBeLessThan(2);
    await shot(browser, 'c4-html-staende');
    await browser.close();
  }, 90_000);

  it.skipIf(!existsSync(ffmpeg))(
    'exports a video of 1080 x 1920',
    async () => {
      const out = join(work, 'staende.mp4');
      await answerDialogs('', out);
      await page
        .locator('.topbar-actions')
        .getByRole('button', { name: 'Eksporter video' })
        .click();
      const dialog = page.locator('dialog.video-dialog');
      await dialog.waitFor();
      expect(await dialog.textContent()).toContain('MP4, 1080 × 1920');
      await dialog.getByRole('button', { name: 'Velg fil og eksporter' }).click();
      await expect
        .poll(() => page.locator('.notice').textContent(), { timeout: EXPORT_WAIT, interval: 500 })
        .toContain('Videoen er lagret');
      const probe = spawnSync(ffmpeg, ['-hide_banner', '-i', out], { encoding: 'utf8' }).stderr;
      expect(probe).toMatch(/Video: h264[^\n]*, 1080x1920[ ,]/);
      expect(probe).toMatch(/30 fps/);
    },
    EXPORT_TEST,
  );

  it('makes a new, empty project upright when the lecturer chooses it', async () => {
    const dir = join(work, 'Tomt');
    await answerDialogs('', dir);
    await fileMenu('Nytt prosjekt …');
    const dialog = page.locator('dialog.look-dialog');
    await dialog.waitFor();
    expect(await dialog.locator('h2').textContent()).toBe('Hvilken form skal lysarkene ha?');
    // Lying is chosen until the lecturer says otherwise, and nothing is recommended.
    expect(await dialog.getByRole('radio', { name: /^Liggende \(16:9\)/ }).isChecked()).toBe(true);
    expect(await dialog.locator('.look-recommended').count()).toBe(0);
    await dialog.getByRole('radio', { name: /^Stående \(9:16\)/ }).check();
    await dialog.getByRole('button', { name: 'Lag prosjektet' }).click();
    await expect.poll(() => existsSync(join(dir, 'prosjekt.json'))).toBe(true);
    expect(saved(dir).orientation).toBe('portrait');
    // A new slide in it is upright.
    await page.getByRole('button', { name: 'Nytt lysark' }).click();
    await page.getByRole('menuitem', { name: 'Innhold' }).click();
    expect(await slideSize(page, '.stage-inner .ls-scene')).toMatchObject({
      width: 1080,
      height: 1920,
    });
  }, 60_000);
});

describe.skipIf(!built)('the theme and "Lær mer" on an upright slide, end to end', () => {
  let work: string;
  let dir: string;
  let app: ElectronApplication;
  let page: Page;

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-staende-tema-'));
    dir = join(work, 'prosjekt');
    mkdirSync(join(dir, 'media'), { recursive: true });
    const project = newProject('A');
    project.orientation = 'portrait';
    const front = newScene('title', 'A');
    front.elements.push(
      {
        id: 'e_tittel',
        type: 'text',
        role: 'title',
        content: richText('A'),
        align: 'left',
        valign: 'bottom',
        box: { x: 120, y: 300, w: 840, h: 460, rotation: 0 },
      },
      {
        id: 'e_under',
        type: 'text',
        role: 'subtitle',
        content: richText('B'),
        align: 'left',
        valign: 'top',
        box: { x: 120, y: 800, w: 840, h: 180, rotation: 0 },
      },
    );
    const content = newScene('content', 'B');
    content.elements.push(
      {
        id: 'e_overskrift',
        type: 'text',
        role: 'title',
        content: richText('B'),
        align: 'left',
        valign: 'top',
        box: { x: 120, y: 96, w: 840, h: 100, rotation: 0 },
      },
      {
        id: 'e_tekst',
        type: 'text',
        role: 'body',
        content: richText('1', '2', '3'),
        align: 'left',
        valign: 'top',
        box: { x: 120, y: 240, w: 840, h: 400, rotation: 0 },
      },
      {
        id: 'e_mer',
        type: 'deepdive',
        label: 'A',
        more: {
          title: 'A',
          blocks: [{ id: 'b1', kind: 'text', content: richText('1', '2', '3', 'A', 'B') }],
        },
        box: { x: 700, y: 1600, w: 320, h: 76, rotation: 0 },
      },
    );
    project.scenes.push(front, content);
    writeFileSync(join(dir, 'prosjekt.json'), JSON.stringify(project, null, 2), 'utf8');
    app = await launch(work, [dir]);
    page = await app.firstWindow();
    await page.waitForSelector('.scene-item');
  }, 60_000);

  afterAll(async () => {
    await app
      ?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.destroy()))
      .catch(() => undefined);
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('draws the title slide with the brand shapes below the title', async () => {
    const shapes = await page
      .locator('.stage-inner .ls-decoration')
      .evaluate((el: SVGSVGElement) => ({
        left: parseFloat(el.style.left),
        top: parseFloat(el.style.top),
        w: Number(el.getAttribute('width')),
      }));
    expect(shapes.top).toBeGreaterThanOrEqual(980);
    expect(shapes.left + shapes.w).toBeLessThanOrEqual(1080 - 120);
    await shot(page, 'c5-tittel-staende');
    await page.locator('.scene-item').nth(1).click();
    await page.waitForSelector('.stage-inner [data-el="e_mer"]');
    await shot(page, 'c6-innhold-staende');
  }, 60_000);

  it('opens a "Lær mer" box that stays inside the upright slide', async () => {
    const opened = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Forhåndsvis' }).click();
    const player = await opened;
    await player.waitForSelector('.lp-stage .ls-scene');
    await player.locator('.lp-stage button.ls-deepdive').click();
    await player.waitForSelector('.lp-panel:not([hidden])');
    await expect
      .poll(() => player.locator('.lp-panel').evaluate((el) => getComputedStyle(el).opacity), {
        timeout: 15_000,
      })
      .toBe('1');
    const layout = await player.evaluate(() => {
      const rect = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect().toJSON() as DOMRect;
      return { pop: rect('.lp-panel'), slide: rect('.lp-stagebox') };
    });
    expect(layout.slide.height).toBeGreaterThan(layout.slide.width);
    expect(layout.pop.left).toBeGreaterThanOrEqual(layout.slide.left - 1);
    expect(layout.pop.right).toBeLessThanOrEqual(layout.slide.right + 1);
    expect(layout.pop.top).toBeGreaterThanOrEqual(layout.slide.top - 1);
    expect(layout.pop.bottom).toBeLessThanOrEqual(layout.slide.bottom + 1);
    await shot(player, 'c7-laer-mer-staende');
    await player.close();
  }, 60_000);
});
