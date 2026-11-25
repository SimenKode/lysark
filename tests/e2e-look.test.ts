// Runs the built program end to end for the choice the lecturer makes at
// import: the slides keep the look they have, or are made over into the
// theme. A PowerPoint file that keeps its look is imported by way of a PDF
// of it, made by LibreOffice here (the test is skipped where LibreOffice
// is not installed), with names, manuscript and chapters from the
// PowerPoint file; without such a program the lecturer is asked for a PDF.
// Needs `npm run build` first. No window is shown, by the program or by
// LibreOffice, and nothing touches the network.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterEach, describe, expect, it } from 'vitest';
import { plainText } from '../src/shared/format/factory';
import type { Project } from '../src/shared/format/schema';
import { buildPdf } from './fixtures/buildPdf';
import { buildPptx, para, sp, txBody } from './fixtures/buildPptx';
import { OFFLINE } from './fixtures/offline';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
const packaged = process.env.LYSARK_APP;
const soffice = (process.env.PATH ?? '')
  .split(delimiter)
  .flatMap((dir) => [join(dir, 'soffice'), join(dir, 'libreoffice')])
  .find((file) => existsSync(file));

const title = (text: string): string =>
  sp({ ph: 'type="title"', body: txBody(para(`<a:r><a:t>${text}</a:t></a:r>`)) });

/** Three slides, the middle one hidden, in two sections, with notes on the first and the last. */
function deck(): Uint8Array {
  return buildPptx({
    slides: [
      { shapes: title('Overskrift A'), notes: ['Notat A'] },
      { shapes: title('Overskrift B'), hidden: true },
      { shapes: title('Overskrift C'), notes: ['Notat C'] },
    ],
    sections: [
      { name: 'Del en', slides: [0] },
      { name: 'Del to', slides: [1, 2] },
    ],
  });
}

/** A PDF with as many pages as the deck has slides, each with a line of text and a coloured field. */
function pdf(): Uint8Array {
  return buildPdf({
    pages: ['A', 'B', 'C'].map((name) => ({
      width: 960,
      height: 540,
      rects: [{ x: 0, y: 500, w: 960, h: 40, color: [0.47, 0, 0.94] as [number, number, number] }],
      lines: [
        { text: `Side ${name}`, x: 60, y: 420, size: 40 },
        { text: `Tekst ${name}`, x: 60, y: 300, size: 24 },
      ],
    })),
  });
}

describe.skipIf(!built)('the look of an imported file', () => {
  let work: string;
  let app: ElectronApplication | undefined;

  /** Starts the program with a file to pick, and returns its window. */
  const start = async (
    files: Record<string, string>,
    env: NodeJS.ProcessEnv = {},
  ): Promise<Page> => {
    work = mkdtempSync(join(tmpdir(), 'lysark-utseende-'));
    const paths: Record<string, string> = {};
    for (const [name, kind] of Object.entries(files)) {
      paths[kind] = join(work, name);
      writeFileSync(paths[kind]!, kind === 'pptx' ? deck() : pdf());
    }
    const args = [OFFLINE, `--user-data-dir=${join(work, 'userdata')}`];
    app = await electron.launch({
      ...(packaged ? { executablePath: packaged, args } : { args: [root, ...args] }),
      env: { ...process.env, LYSARK_HIDDEN: '1', ...env },
    });
    await app.evaluate(
      ({ dialog }, given) => {
        // The file that is asked for: a PowerPoint file, or a PDF.
        dialog.showOpenDialog = async (...args: unknown[]) => {
          const options = args[args.length - 1] as { filters?: Array<{ extensions: string[] }> };
          const kind = options.filters?.[0]?.extensions[0] ?? '';
          const file = given.paths[kind];
          return file ? { canceled: false, filePaths: [file] } : { canceled: true, filePaths: [] };
        };
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: given.dir });
      },
      { paths, dir: join(work, 'Prosjekt') },
    );
    const page = await app.firstWindow();
    await page.waitForSelector('.welcome');
    return page;
  };
  const menu = (label: string): Promise<void> =>
    app!.evaluate(({ Menu }, text) => {
      const file = Menu.getApplicationMenu()!.items.find((item) => item.label === 'Fil')!;
      file.submenu!.items.find((item) => item.label === text)!.click();
    }, label);
  const choose = async (page: Page, look: RegExp): Promise<void> => {
    const dialog = page.locator('dialog.look-dialog');
    await dialog.waitFor();
    await dialog.getByRole('radio', { name: look }).check();
    await dialog.getByRole('button', { name: 'Importer' }).click();
  };
  const saved = (): Project =>
    JSON.parse(readFileSync(join(work, 'Prosjekt', 'prosjekt.json'), 'utf8')) as Project;
  const texts = (project: Project, scene: number): string[] =>
    project.scenes[scene]!.elements.flatMap((el) =>
      el.type === 'text' ? [plainText(el.content)] : [],
    );

  afterEach(async () => {
    await app?.close().catch(() => undefined);
    app = undefined;
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it.skipIf(!soffice)(
    'lets a PowerPoint file keep its look, with manuscript and chapters from the file itself',
    async () => {
      const page = await start({ 'Forelesning.pptx': 'pptx' });
      await page.getByRole('button', { name: 'Importer PowerPoint' }).click();
      const dialog = page.locator('dialog.look-dialog');
      await dialog.waitFor();
      expect(await dialog.textContent()).toContain('Forelesning.pptx');
      // Keeping the look is what is chosen until the lecturer says otherwise.
      expect(await dialog.getByRole('radio', { name: /^Behold utseendet/ }).isChecked()).toBe(true);
      await dialog.getByRole('button', { name: 'Importer' }).click();
      await page.waitForSelector('.scene-item', { timeout: 120_000 });
      const notice = (await page.locator('.notice').textContent()) ?? '';
      expect(notice).toContain('Forelesning.pptx er importert: 2 lysark.');
      expect(notice).toContain('Manus og kapitler er hentet fra PowerPoint-fila.');
      // The lecturer is told that LibreOffice drew the slides, and what to do for the real thing.
      expect(notice).toContain('LibreOffice har tegnet lysarkene');

      // The hidden slide is not in the PDF, and the others have what the PowerPoint file knows.
      const project = saved();
      expect(project.scenes.map((s) => s.title)).toEqual(['Overskrift A', 'Overskrift C']);
      expect(project.scenes.map((s) => s.script)).toEqual(['Notat A', 'Notat C']);
      // The chapter that began on the hidden slide begins on the next one.
      expect(project.scenes.map((s) => s.chapter)).toEqual(['Del en', 'Del to']);
      // The text of the slides is text, standing on the slide.
      expect(texts(project, 0).join(' ')).toContain('Overskrift A');
      expect(texts(project, 1).join(' ')).toContain('Overskrift C');
      // The look is the file's own: no logo and no brand shapes are put on.
      expect(project.scenes.every((s) => !s.showLogo && !s.decoration)).toBe(true);
      expect(await page.locator('.scene-chapter input').count()).toBe(2);
    },
    180_000,
  );

  it('asks for a PDF of the presentation when no program can make one', async () => {
    // An empty LYSARK_SOFFICE says there is no LibreOffice (and no PowerPoint is tried).
    const page = await start(
      { 'Forelesning.pptx': 'pptx', 'Lagret fra PowerPoint.pdf': 'pdf' },
      { LYSARK_SOFFICE: '' },
    );
    let asked = '';
    page.once('dialog', (dialog) => {
      asked = dialog.message();
      void dialog.accept();
    });
    await page.getByRole('button', { name: 'Importer PowerPoint' }).click();
    await choose(page, /^Behold utseendet/);
    await page.waitForSelector('.scene-item', { timeout: 120_000 });
    expect(asked).toContain('verken PowerPoint eller LibreOffice');
    // This PDF has all three slides, the hidden one too: each page gets its slide's notes.
    const project = saved();
    expect(project.scenes.map((s) => s.title)).toEqual([
      'Overskrift A',
      'Overskrift B',
      'Overskrift C',
    ]);
    expect(project.scenes.map((s) => s.script)).toEqual(['Notat A', '', 'Notat C']);
    expect(project.scenes.map((s) => s.chapter)).toEqual(['Del en', 'Del to', undefined]);
    expect(texts(project, 0)).toContain('Side A');
    // The coloured field of the page lies behind the text, as a picture.
    expect(project.scenes[0]!.elements[0]!.type).toBe('image');
  }, 180_000);

  it('uses a PDF with the same name that lies next to the PowerPoint file, and says so', async () => {
    // Also where LibreOffice is installed: a PDF saved from PowerPoint is the real thing.
    const page = await start({ 'Forelesning.pptx': 'pptx', 'Forelesning.pdf': 'pdf' });
    await page.getByRole('button', { name: 'Importer PowerPoint' }).click();
    await choose(page, /^Behold utseendet/);
    await page.waitForSelector('.scene-item', { timeout: 120_000 });
    const notice = (await page.locator('.notice').textContent()) ?? '';
    expect(notice).toContain('Utseendet er hentet fra Forelesning.pdf');
    expect(notice).toContain('Manus og kapitler er hentet fra PowerPoint-fila.');
    const project = saved();
    expect(project.scenes.map((s) => s.script)).toEqual(['Notat A', '', 'Notat C']);
    expect(texts(project, 2)).toContain('Side C');
  }, 180_000);

  it('makes a PDF over into the theme when the lecturer chooses that', async () => {
    const page = await start({ 'Notater.pdf': 'pdf' });
    await menu('Importer PDF …');
    await choose(page, /^Gjør om til USN-stil/);
    await page.waitForSelector('.scene-item', { timeout: 120_000 });
    expect(await page.locator('.notice').textContent()).toContain(
      'Lysarkene er gjort om til USN-stil',
    );
    const project = saved();
    expect(project.scenes).toHaveLength(3);
    for (const scene of project.scenes) {
      // The text stands on the theme's surface, in the theme's colours, with the logo;
      // the coloured field of the page is not taken along.
      expect(scene.elements.every((el) => el.type === 'text')).toBe(true);
      expect(scene.background).toBeUndefined();
      expect(scene.showLogo).toBe(true);
      expect(scene.elements.every((el) => el.type !== 'text' || el.color === undefined)).toBe(true);
    }
    expect(texts(project, 1)).toEqual(['Side B', 'Tekst B']);
    // The largest text at the top is the title of the slide.
    expect(project.scenes[1]!.elements[0]).toMatchObject({ type: 'text', role: 'title' });
    // Nothing that is not shown is kept among the project's pictures.
    expect(Object.keys(project.assets)).toHaveLength(0);
  }, 180_000);
});
