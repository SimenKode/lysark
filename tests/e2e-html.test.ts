// Runs the built program end to end for "Åpne HTML-fil …": export the
// sample project to HTML with the program, then open that file as a new
// project through the menu and check that the slides, the picture and the
// "Lær mer" content are there. Needs `npm run build` first. The window is
// never shown on screen.
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Project } from '../src/shared/format/schema';
import { testPng, writeSampleProject } from './fixtures/sampleProject';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
/** Set LYSARK_APP to a packaged executable to test that instead of the build in out/. */
const packaged = process.env.LYSARK_APP;

describe.skipIf(!built)('opening an exported HTML file as a project, end to end', () => {
  let work: string;
  let sourceDir: string;
  let source: Project;
  let exported: string;
  let app: ElectronApplication;
  let page: Page;

  /** Makes the next file dialogs answer with these paths, and counts how often they are asked. */
  const answerDialogs = async (open: string, save: string): Promise<void> => {
    await app.evaluate(
      ({ dialog }, paths) => {
        const counts = { open: 0, save: 0 };
        (globalThis as unknown as { lysarkDialogs: typeof counts }).lysarkDialogs = counts;
        dialog.showOpenDialog = async () => {
          counts.open += 1;
          return { canceled: false, filePaths: [paths.open] };
        };
        dialog.showSaveDialog = async () => {
          counts.save += 1;
          return { canceled: false, filePath: paths.save };
        };
      },
      { open, save },
    );
  };
  const dialogsAsked = (): Promise<{ open: number; save: number }> =>
    app.evaluate(
      () =>
        (globalThis as unknown as { lysarkDialogs: { open: number; save: number } }).lysarkDialogs,
    );
  /** Chooses an entry in the File menu, as the owner would. */
  const fileMenu = async (label: string): Promise<void> => {
    await app.evaluate(({ Menu }, text) => {
      const file = Menu.getApplicationMenu()!.items.find((item) => item.label === 'Fil')!;
      file.submenu!.items.find((item) => item.label === text)!.click();
    }, label);
  };

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-html-e2e-'));
    sourceDir = join(work, 'prosjekt');
    source = writeSampleProject(sourceDir);
    exported = join(work, 'Eksportert.html');
    const args = [`--user-data-dir=${join(work, 'userdata')}`, sourceDir];
    app = await electron.launch({
      ...(packaged ? { executablePath: packaged, args } : { args: [root, ...args] }),
      env: { ...process.env, LYSARK_HIDDEN: '1' },
    });
    page = await app.firstWindow();
    await page.waitForSelector('.app');
  }, 60_000);

  afterAll(async () => {
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('exports the sample project to one HTML file', async () => {
    await answerDialogs(join(work, 'ubrukt'), exported);
    await page.getByRole('button', { name: 'Eksporter HTML' }).click();
    await expect.poll(() => page.locator('.notice').textContent()).toContain('HTML-fila er lagret');
    expect(readFileSync(exported, 'utf8')).toContain('<meta name="generator" content="Lysark">');
    await page.locator('.notice button', { hasText: 'Lukk' }).click();
  });

  it('opens the HTML file as a new project with the same slides and media', async () => {
    const dir = join(work, 'Fra HTML');
    await answerDialogs(exported, dir);
    await fileMenu('Åpne HTML-fil …');
    await expect
      .poll(() => page.locator('.notice').textContent())
      .toContain('Eksportert.html er åpnet som et nytt prosjekt.');
    expect(await dialogsAsked()).toEqual({ open: 1, save: 1 });
    expect(await page.locator('.notice-error').count()).toBe(0);
    await expect.poll(() => page.locator('.scene-item').count()).toBe(3);
    expect(await page.locator('.project-title').inputValue()).toBe('Testforelesning');
    // The new project is saved in its own folder; nothing is waiting to be saved.
    expect(await page.getByRole('button', { name: /^Lagre/ }).textContent()).toBe('Lagret');
    await expect
      .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getTitle()))
      .toBe('Testforelesning – Lysark');

    // On disk: the same project, with the picture under a name made from its content.
    const opened = JSON.parse(readFileSync(join(dir, 'prosjekt.json'), 'utf8')) as Project;
    const png = testPng(400, 240);
    const name = `${createHash('sha256').update(png).digest('hex').slice(0, 16)}.png`;
    expect(readdirSync(join(dir, 'media'))).toEqual([name]);
    expect(readFileSync(join(dir, 'media', name)).equals(png)).toBe(true);
    const [assetId] = Object.keys(source.assets);
    expect(opened).toEqual({
      ...source,
      assets: { [assetId!]: { ...source.assets[assetId!]!, file: `media/${name}` } },
    });
    // The project it came from is untouched.
    expect(readdirSync(join(sourceDir, 'media'))).toEqual(['testbilde.png']);
  });

  it('shows the picture and the "Lær mer" content of the opened project', async () => {
    await page.locator('.scene-item').nth(1).click();
    const image = page.locator('.stage-inner .ls-el-image');
    await expect
      .poll(() => image.locator('img').evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBe(400);
    expect(await image.locator('img').getAttribute('alt')).toBe('Testbilde med to fargefelt');
    expect(await page.locator('.stage-inner .ls-el-table').count()).toBe(1);
    expect(await page.locator('.script-panel textarea').inputValue()).toBe('Manus A.\nManus B.');
    // The picture carries "Lær mer" content, and so does the button.
    expect(await page.locator('.stage-inner .ls-el-image .ls-more-badge').count()).toBe(1);
    await image.click({ position: { x: 20, y: 20 } });
    await page.getByRole('button', { name: 'Rediger utdyping …' }).click();
    await page.waitForSelector('.builder');
    const panel = page.locator('.builder-panel');
    expect(await panel.locator('h2').textContent()).toBe('Om bildet');
    expect(await panel.locator('.lm-heading').textContent()).toBe('Overskrift B');
    expect(await panel.locator('.lm-text').first().textContent()).toBe('Utdyping A.');
    expect(await panel.locator('.lm-table th').count()).toBe(2);
    await page.getByRole('button', { name: 'Ferdig' }).click();
    await expect.poll(() => page.locator('.builder').count()).toBe(0);
    // Looking is not changing: there is still nothing to save.
    expect(await page.getByRole('button', { name: /^Lagre/ }).textContent()).toBe('Lagret');
  });

  it('refuses an HTML file Lysark did not make, before asking for a folder', async () => {
    const other = join(work, 'Annet.html');
    writeFileSync(other, '<!doctype html><html><head><title>A</title></head><body>B</body></html>');
    const dir = join(work, 'Skal ikke finnes');
    await answerDialogs(other, dir);
    await fileMenu('Åpne HTML-fil …');
    await expect
      .poll(() => page.locator('.notice-error').textContent())
      .toContain('Fila er ikke en forelesning eksportert fra Lysark.');
    expect(await dialogsAsked()).toEqual({ open: 1, save: 0 });
    expect(existsSync(dir)).toBe(false);
    // The project that was open is still open.
    expect(await page.locator('.project-title').inputValue()).toBe('Testforelesning');
  });
});
