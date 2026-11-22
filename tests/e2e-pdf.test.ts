// Runs the built program end to end for the PDF import: pick a PDF through
// the menu, choose where the project goes, and check the slides, the page
// pictures and their text. Also that an import can be stopped, and that a
// file that cannot be read leaves nothing behind. Needs `npm run build`
// first. The window is never shown on screen, and nothing touches the network.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Project } from '../src/shared/format/schema';
import { buildPdf } from './fixtures/buildPdf';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
/** Set LYSARK_APP to a packaged executable to test that instead of the build in out/. */
const packaged = process.env.LYSARK_APP;

/** How long to wait for an import, which draws pages at 3840 x 2160. */
const LONG = { timeout: 30_000 };

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

describe.skipIf(!built)('what the build carries of pdf.js', () => {
  /** Every file of the build, with its path. */
  const builtFiles = (): string[] =>
    readdirSync(join(root, 'out'), { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name));

  it('has the worker, the two picture decoders and their licence texts', () => {
    const names = builtFiles().map((file) => basename(file));
    expect(names.filter((name) => /^pdf\.worker.*\.mjs$/.test(name))).toHaveLength(1);
    expect(names.filter((name) => name.endsWith('.wasm')).sort()).toEqual([
      expect.stringMatching(/^jbig2-.*\.wasm$/),
      expect.stringMatching(/^openjpeg-.*\.wasm$/),
    ]);
    expect(readdirSync(join(root, 'out/renderer/licenses/pdfjs-dist')).sort()).toEqual([
      'LICENSE',
      'LICENSE_JBIG2',
      'LICENSE_OPENJPEG',
      'LICENSE_PDFJS_JBIG2',
      'LICENSE_PDFJS_OPENJPEG',
    ]);
  });

  it('has none of the font data and character maps that come with pdf.js', () => {
    // pdf.js ships standard_fonts/ (Foxit and Liberation files) and cmaps/.
    const files = builtFiles();
    const names = files.map((file) => basename(file));
    expect(names.filter((name) => /\.(pfb|bcmap|icc)$/i.test(name))).toEqual([]);
    expect(names.filter((name) => /foxit|cmap/i.test(name))).toEqual([]);
    // The only font files are the program's own six, byte for byte.
    const fonts = files.filter((file) => /\.(ttf|otf|woff2?)$/i.test(file));
    expect(fonts).toHaveLength(6);
    for (const font of fonts) {
      const own = basename(font).replace(/-[A-Za-z0-9_-]{8}\.ttf$/, '.ttf');
      expect(readFileSync(font).equals(readFileSync(join(root, 'resources/fonts', own)))).toBe(
        true,
      );
    }
  });

  it('keeps the pdf.js package itself out of the packaged program', () => {
    const config = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      build: { files: string[] };
    };
    expect(config.build.files).toEqual(
      expect.arrayContaining(['!node_modules/pdfjs-dist/**', '!node_modules/@napi-rs/**']),
    );
  });
});

describe.skipIf(!built)('importing a PDF, end to end', () => {
  let work: string;
  let app: ElectronApplication;
  let page: Page;
  const consoleLines: string[] = [];

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
  /** Decodes a stored page picture in the program's own browser engine and looks at it. */
  const look = (file: string, dark: Region, points: Array<[number, number]>) =>
    page.evaluate(
      async ({ base64, dark, points }) => {
        const img = new Image();
        img.src = `data:image/webp;base64,${base64}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const area = ctx.getImageData(dark.x, dark.y, dark.w, dark.h).data;
        let ink = 0;
        for (let i = 0; i < area.length; i += 4) {
          if (area[i]! + area[i + 1]! + area[i + 2]! < 150) ink += 1;
        }
        return {
          width: img.naturalWidth,
          height: img.naturalHeight,
          ink,
          colours: points.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)]),
        };
      },
      { base64: readFileSync(file).toString('base64'), dark, points },
    );
  const readProject = (dir: string): Project =>
    JSON.parse(readFileSync(join(dir, 'prosjekt.json'), 'utf8')) as Project;

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-pdf-'));
    const args = [`--user-data-dir=${join(work, 'userdata')}`];
    app = await electron.launch({
      ...(packaged ? { executablePath: packaged, args } : { args: [root, ...args] }),
      env: { ...process.env, LYSARK_HIDDEN: '1' },
    });
    page = await app.firstWindow();
    page.on('console', (message) => consoleLines.push(`${message.type()}: ${message.text()}`));
    await page.waitForSelector('.welcome');
  }, 60_000);

  afterAll(async () => {
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('turns each page into a slide with the page as a picture', async () => {
    const pdf = join(work, 'Dokument.pdf');
    writeFileSync(
      pdf,
      buildPdf({
        title: 'Test A',
        // The program's own font (SIL OFL), embedded the way PowerPoint embeds fonts.
        fontFile: readFileSync(join(root, 'resources/fonts/LiberationSans-Regular.ttf')),
        pages: [
          { width: 720, height: 405, text: 'A', font: 'standard' },
          {
            width: 595,
            height: 842,
            text: 'B',
            font: 'embedded',
            pictures: ['jpeg2000', 'ccitt', 'jbig2'],
          },
        ],
      }),
    );
    const dir = join(work, 'Fra PDF');
    await answerDialogs(pdf, dir);
    const before = consoleLines.length;
    await fileMenu('Importer PDF …');
    // The first import also loads pdf.js and starts its worker.
    await expect.poll(() => page.locator('.scene-item').count(), LONG).toBe(2);
    await expect.poll(() => page.locator('dialog.pdf-import').count()).toBe(0);
    expect(await page.locator('.notice').textContent()).toContain(
      'Dokument.pdf er importert: 2 lysark.',
    );
    // Nothing the import did was refused by the program's content security
    // policy (the worker, the decoders, the fonts), and pdf.js had no warnings.
    expect(consoleLines.slice(before)).toEqual([]);
    expect(page.workers()).toEqual([]);
    // The title comes from the PDF's own information.
    expect(await page.locator('.project-title').inputValue()).toBe('Test A');
    // The import has saved the project; nothing is waiting to be saved.
    expect(await page.getByRole('button', { name: /^Lagre/ }).textContent()).toBe('Lagret');

    const project = readProject(dir);
    expect(project.scenes.map((s) => s.title)).toEqual(['A', 'B']);
    const [first, second] = project.scenes;
    for (const scene of project.scenes) {
      expect(scene).toMatchObject({
        kind: 'content',
        background: 'hvit',
        showLogo: false,
        decoration: false,
        timeline: [],
        script: '',
      });
      expect(scene.elements).toHaveLength(1);
    }
    const pictures = project.scenes.map((scene) => {
      const element = scene.elements[0]!;
      if (element.type !== 'image') throw new Error('not an image');
      return { element, asset: project.assets[element.asset]! };
    });
    expect(pictures.map((p) => p.element.alt)).toEqual(['A', 'B']);
    expect(pictures.every((p) => !p.element.decorative)).toBe(true);
    // A 16:9 page fills the stage; a portrait page fills the height and is centred.
    expect(first!.elements[0]!.box).toEqual({ x: 0, y: 0, w: 1920, h: 1080, rotation: 0 });
    expect(second!.elements[0]!.box).toEqual({ x: 578.5, y: 0, w: 763, h: 1080, rotation: 0 });
    expect(readdirSync(join(dir, 'media')).sort()).toEqual(
      pictures.map((p) => p.asset.file.replace('media/', '')).sort(),
    );
    for (const p of pictures) {
      expect(p.asset).toMatchObject({ kind: 'image', mime: 'image/webp' });
      expect(p.asset.file).toMatch(/^media\/[0-9a-f]{16}\.webp$/);
      expect(readFileSync(join(dir, p.asset.file)).byteLength).toBe(p.asset.bytes);
    }

    // Double resolution: 3840 pixels across the stage. The letter is drawn
    // (a font that is not embedded gets a font from the machine).
    const one = await look(join(dir, pictures[0]!.asset.file), { x: 380, y: 470, w: 360, h: 400 }, [
      [3000, 1500],
    ]);
    expect(one).toMatchObject({ width: 3840, height: 2160 });
    expect(one.ink).toBeGreaterThan(2000);
    expect(one.colours[0]).toEqual([255, 255, 255]);
    // The second page: the embedded font, and pictures in the formats pdf.js
    // brings its own decoders for (JPEG 2000, and CCITT fax and JBIG2, which
    // scanned pages use). Each test picture has a left and a right half.
    const two = await look(join(dir, pictures[1]!.asset.file), { x: 180, y: 225, w: 180, h: 190 }, [
      [321, 1775],
      [449, 1775],
      [629, 1775],
      [757, 1775],
      [936, 1775],
      [1065, 1775],
    ]);
    expect(two).toMatchObject({ width: 1526, height: 2160 });
    expect(two.ink).toBeGreaterThan(2000);
    const near = (colour: number[], want: number[]): boolean =>
      colour.every((value, i) => Math.abs(value - want[i]!) <= 24);
    expect(near(two.colours[0]!, [120, 0, 240])).toBe(true);
    expect(near(two.colours[1]!, [255, 98, 2])).toBe(true);
    expect(near(two.colours[2]!, [255, 255, 255])).toBe(true);
    expect(near(two.colours[3]!, [0, 0, 0])).toBe(true);
    expect(near(two.colours[4]!, [255, 255, 255])).toBe(true);
    expect(near(two.colours[5]!, [0, 0, 0])).toBe(true);
  });

  it('shows the page in the slide, with its text for screen readers', async () => {
    const image = page.locator('.stage-inner .ls-el-image img');
    expect(await image.getAttribute('alt')).toBe('A');
    await expect
      .poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBe(3840);
    await page.locator('.scene-item').nth(1).click();
    await expect.poll(() => image.getAttribute('alt')).toBe('B');
    await expect
      .poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBe(1526);
  });

  it('saves and opens again like any project', async () => {
    const dir = join(work, 'Fra PDF');
    await page.locator('.script-panel textarea').fill('Manus B');
    await page.getByRole('button', { name: /^Lagre/ }).click();
    await expect
      .poll(() => page.getByRole('button', { name: /^Lagre/ }).textContent())
      .toBe('Lagret');
    expect(readProject(dir).scenes[1]!.script).toBe('Manus B');

    await answerDialogs(join(dir, 'prosjekt.json'), join(work, 'ubrukt'));
    await page.locator('.scene-item').first().click();
    await fileMenu('Åpne prosjekt …');
    await expect.poll(async () => (await dialogsAsked()).open).toBe(1);
    await expect.poll(() => page.locator('.scene-item').count()).toBe(2);
    await page.locator('.scene-item').nth(1).click();
    await expect.poll(() => page.locator('.script-panel textarea').inputValue()).toBe('Manus B');
    await expect
      .poll(() =>
        page
          .locator('.stage-inner .ls-el-image img')
          .evaluate((el) => (el as HTMLImageElement).naturalWidth),
      )
      .toBe(1526);
  });

  it('marks a page without text, so that the owner writes the alternative text', async () => {
    const pdf = join(work, 'Uten tekst.pdf');
    writeFileSync(
      pdf,
      buildPdf({
        pages: [
          { width: 400, height: 300, pictures: ['jpeg2000'] },
          { width: 300, height: 400, text: 'A', rotate: 90 },
        ],
      }),
    );
    const dir = join(work, 'Uten tekst');
    await answerDialogs(pdf, dir);
    await fileMenu('Importer PDF …');
    await expect.poll(() => existsSync(join(dir, 'prosjekt.json')), LONG).toBe(true);
    await expect
      .poll(() => page.locator('.notice').textContent(), LONG)
      .toContain('Lysark 1 har ingen tekst som kunne hentes ut');
    const project = readProject(dir);
    // No title of its own in the PDF: the file's name.
    expect(project.meta.title).toBe('Uten tekst');
    expect(project.scenes.map((s) => s.title)).toEqual(['Side 1', 'A']);
    expect(project.scenes[0]!.imported?.warnings).toHaveLength(1);
    expect(project.scenes[1]!.imported?.warnings).toEqual([]);
    expect(await page.locator('.scene-item').first().textContent()).toContain('å ordne');
    // A page that is turned in the PDF is drawn the way it is shown: lying.
    expect(project.scenes[1]!.elements[0]!.box).toMatchObject({ w: 1440, h: 1080, x: 240 });
  });

  it('can be stopped, and then leaves nothing behind', async () => {
    const pdf = join(work, 'Lang.pdf');
    writeFileSync(
      pdf,
      buildPdf({
        pages: Array.from({ length: 120 }, () => ({ width: 720, height: 405, text: 'A' })),
      }),
    );
    const dir = join(work, 'Avbrutt');
    await answerDialogs(pdf, dir);
    await fileMenu('Importer PDF …');
    const dialog = page.locator('dialog.pdf-import[open]');
    await expect.poll(() => dialog.textContent(), LONG).toMatch(/Importerer side \d+ av 120 …/);
    expect(existsSync(join(dir, 'media'))).toBe(true);
    // pdf.js reads the file in its own worker, loaded from the program's files.
    expect(page.workers().map((worker) => worker.url())).toEqual([
      expect.stringMatching(/^file:.*\/out\/renderer\/assets\/pdf\.worker[^/]*\.mjs$/),
    ]);
    await dialog.getByRole('button', { name: 'Avbryt' }).click();
    await expect.poll(() => page.locator('dialog.pdf-import').count(), LONG).toBe(0);
    await expect.poll(() => existsSync(dir)).toBe(false);
    // The project that was open is still open, and no error is shown.
    expect(await page.locator('.project-title').inputValue()).toBe('Uten tekst');
    expect(await page.locator('.notice-error').count()).toBe(0);
  });

  it('refuses a PDF with a password and a file that is not a PDF, before asking for a folder', async () => {
    const locked = join(work, 'Passord.pdf');
    writeFileSync(
      locked,
      buildPdf({ encrypted: true, pages: [{ width: 720, height: 405, text: 'A' }] }),
    );
    const dir = join(work, 'Skal ikke finnes');
    await answerDialogs(locked, dir);
    await fileMenu('Importer PDF …');
    await expect
      .poll(() => page.locator('.notice-error').textContent(), LONG)
      .toContain('beskyttet med passord');
    await expect.poll(() => page.locator('dialog.pdf-import').count()).toBe(0);
    expect(await dialogsAsked()).toEqual({ open: 1, save: 0 });

    const broken = join(work, 'Skadet.pdf');
    writeFileSync(broken, 'Dette er ikke en PDF.');
    await answerDialogs(broken, dir);
    await fileMenu('Importer PDF …');
    await expect
      .poll(() => page.locator('.notice-error').textContent(), LONG)
      .toContain('ikke en PDF som kan leses');
    await expect.poll(() => page.locator('dialog.pdf-import').count()).toBe(0);
    expect(await dialogsAsked()).toEqual({ open: 1, save: 0 });
    expect(existsSync(dir)).toBe(false);
    expect(await page.locator('.project-title').inputValue()).toBe('Uten tekst');
  });
});
