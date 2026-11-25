// Runs the built program end to end for the PDF import: pick a PDF through
// the menu, choose where the project goes, and check the slides: the text
// as text elements where it stood, the pictures as elements of their own,
// links, and the rest of the page as a picture behind them. Also pages
// that stay one picture, that an import can be stopped, and that a file
// that cannot be read leaves nothing behind. Needs `npm run build`
// first. The window is never shown on screen, and nothing touches the network.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OFFLINE } from './fixtures/offline';
import type { Project } from '../src/shared/format/schema';
import { buildPdf } from './fixtures/buildPdf';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
/** Set LYSARK_APP to a packaged executable to test that instead of the build in out/. */
const packaged = process.env.LYSARK_APP;

/** How long to wait for an import, which draws every page several times at 3840 x 2160. */
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
  /** Starts the import of a PDF from the File menu, and says how its slides are to look. */
  const importPdfFile = async (look = 'Behold utseendet'): Promise<void> => {
    await fileMenu('Importer PDF …');
    const dialog = page.locator('dialog.look-dialog');
    await dialog.waitFor();
    await dialog.getByRole('radio', { name: new RegExp(`^${look}`) }).check();
    await dialog.getByRole('button', { name: 'Importer' }).click();
  };
  /**
   * Decodes a stored picture in the program's own browser engine and looks
   * at it: how many dark pixels an area holds, and the colours of some points.
   */
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
        // On white, as on the slide: what a picture does not paint is see-through.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    const args = [OFFLINE, `--user-data-dir=${join(work, 'userdata')}`];
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

  const near = (colour: number[], want: number[]): boolean =>
    colour.every((value, i) => Math.abs(value - want[i]!) <= 24);
  const PURPLE = [120, 0, 240];
  const ORANGE = [255, 98, 2];
  const WHITE = [255, 255, 255];
  const BLACK = [0, 0, 0];

  it('turns each page into a slide with its text and pictures as elements', async () => {
    const pdf = join(work, 'Dokument.pdf');
    writeFileSync(
      pdf,
      buildPdf({
        title: 'Test A',
        // The program's own font (SIL OFL), embedded the way PowerPoint embeds fonts.
        fontFile: readFileSync(join(root, 'resources/fonts/LiberationSans-Regular.ttf')),
        pages: [
          {
            width: 720,
            height: 405,
            text: 'A',
            font: 'standard',
            // A purple field: neither text nor a picture, so it stays in the background.
            rects: [{ x: 500, y: 300, w: 150, h: 60, color: [120 / 255, 0, 240 / 255] }],
            lines: [
              { text: 'Punkt B og C', x: 300, y: 150, size: 24 },
              { text: 'Les mer', x: 300, y: 60, size: 24, font: 'bold' },
            ],
            pictures: ['jpeg2000'],
            links: [
              // Over the "B" of the first line (Helvetica: "Punkt " is 68 points wide at this size).
              { x: 367, y: 146, w: 18, h: 24, url: 'https://example.org/b' },
              // Over the whole second line, to the second page.
              { x: 298, y: 54, w: 110, h: 30, page: 2 },
            ],
          },
          {
            width: 595,
            height: 842,
            text: 'B',
            font: 'embedded',
            lines: [{ text: 'C', x: 72, y: 500, size: 48, font: 'embedded-bold' }],
            pictures: ['jpeg2000', 'ccitt', 'jbig2'],
          },
        ],
      }),
    );
    const dir = join(work, 'Fra PDF');
    await answerDialogs(pdf, dir);
    const before = consoleLines.length;
    await importPdfFile();
    // The first import also loads pdf.js and starts its worker.
    await expect.poll(() => page.locator('.scene-item').count(), LONG).toBe(2);
    await expect.poll(() => page.locator('dialog.pdf-import').count()).toBe(0);
    expect(await page.locator('.notice').textContent()).toContain(
      'Dokument.pdf er importert: 2 lysark. Tekst og bilder er egne elementer som kan flyttes og endres.',
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
        imported: { warnings: [] },
      });
    }
    const assetOf = (element: Project['scenes'][number]['elements'][number]) => {
      if (element.type !== 'image') throw new Error('not an image');
      return project.assets[element.asset]!;
    };

    // The first page: the rest of the page behind, then the picture, then the text in the PDF's order.
    expect(first!.elements.map((e) => e.type)).toEqual(['image', 'image', 'text', 'text', 'text']);
    const [background, picture, letter, line, more] = first!.elements;
    expect(background).toMatchObject({
      type: 'image',
      alt: '',
      decorative: true,
      box: { x: 0, y: 0, w: 1920, h: 1080, rotation: 0 },
    });
    // The picture stands where it stood: 100 points in, 100 points square, at 1920 / 720 pixels a point.
    expect(picture).toMatchObject({ type: 'image', alt: '' });
    expect(picture).not.toHaveProperty('decorative');
    const scale = 1920 / 720;
    expect(picture!.box.x).toBeCloseTo(100 * scale, 0);
    expect(picture!.box.y).toBeCloseTo((405 - 200) * scale, 0);
    expect(picture!.box.w).toBeCloseTo(100 * scale, 0);
    expect(picture!.box.h).toBeCloseTo(100 * scale, 0);

    // The text is text, in the program's own font, standing where it stood.
    if (letter!.type !== 'text' || line!.type !== 'text' || more!.type !== 'text') {
      throw new Error('not text');
    }
    expect(letter).toMatchObject({
      role: 'body',
      fontSize: 96 * scale,
      align: 'left',
      valign: 'top',
      content: { paragraphs: [{ level: 0, list: 'none', runs: [{ text: 'A' }] }] },
    });
    expect(letter.box.x).toBeCloseTo(72 * scale, 0);
    // The baseline lies 160 points down the page. Liberation Sans reaches 0.905 of its size above
    // the baseline of a line and 0.212 below, and the line is 1.2 times the size high.
    const baseline = 160 * scale - (96 * scale * (1.2 + 0.905 - 0.212)) / 2;
    expect(Math.abs(letter.box.y - baseline)).toBeLessThan(2);
    // Wide enough for the letter, so nothing breaks, and not much more.
    expect(letter.box.w).toBeGreaterThan(0.667 * 96 * scale);
    expect(letter.box.w).toBeLessThan(0.667 * 96 * scale + 6);
    expect(line.fontSize).toBe(24 * scale);
    expect(line.box.x).toBeCloseTo(300 * scale, 0);
    // The link lies on the word it covered, and only on that.
    expect(line.content.paragraphs).toEqual([
      {
        level: 0,
        list: 'none',
        runs: [{ text: 'Punkt ' }, { text: 'B', link: 'https://example.org/b' }, { text: ' og C' }],
      },
    ]);
    // Bold text is a heading; a link to another page leads to that page's slide.
    expect(more.role).toBe('heading');
    expect(more.content.paragraphs).toEqual([
      { level: 0, list: 'none', runs: [{ text: 'Les mer', link: `#scene:${second!.id}` }] },
    ]);

    // The second page, a portrait page: three pictures and two letters, and nothing left for a background.
    expect(second!.elements.map((e) => e.type)).toEqual([
      'image',
      'image',
      'image',
      'text',
      'text',
    ]);
    const portrait = 1080 / 842;
    second!.elements.slice(0, 3).forEach((element, i) => {
      // The page fills the height and is centred: its left edge is at 578.5.
      expect(element.box.x).toBeCloseTo(578.5 + (100 + i * 120) * portrait, 0);
      expect(element.box.y).toBeCloseTo((842 - 200) * portrait, 0);
      expect(element.box.w).toBeCloseTo(100 * portrait, 0);
    });
    const last = second!.elements[3]!;
    expect(last).toMatchObject({ type: 'text', fontSize: Math.round(96 * portrait * 10) / 10 });
    expect(last.box.x).toBeCloseTo(578.5 + 72 * portrait, 0);
    // An embedded font says it is bold by its name only.
    expect(second!.elements[4]).toMatchObject({
      type: 'text',
      role: 'heading',
      content: { paragraphs: [{ runs: [{ text: 'C' }] }] },
    });

    // Every stored file belongs to an element, and is what its asset says.
    const assets = project.scenes.flatMap((scene) =>
      scene.elements.flatMap((e) => (e.type === 'image' ? [assetOf(e)] : [])),
    );
    // Five pictures, four files: the two black and white pictures show the same, and are stored once.
    expect(Object.keys(project.assets)).toHaveLength(4);
    expect(assetOf(second!.elements[1]!)).toBe(assetOf(second!.elements[2]!));
    expect(readdirSync(join(dir, 'media')).sort()).toEqual(
      [...new Set(assets.map((a) => a.file.replace('media/', '')))].sort(),
    );
    for (const asset of assets) {
      expect(asset).toMatchObject({ kind: 'image', mime: 'image/webp' });
      expect(asset.file).toMatch(/^media\/[0-9a-f]{16}\.webp$/);
      expect(readFileSync(join(dir, asset.file)).byteLength).toBe(asset.bytes);
    }

    // The background at double resolution: the purple field is there, the text and
    // the picture are not (5.33 pixels a point).
    const behind = await look(
      join(dir, assetOf(background!).file),
      { x: 380, y: 470, w: 360, h: 400 },
      [
        [3067, 400],
        [800, 1360],
        [1700, 1330],
      ],
    );
    expect(behind).toMatchObject({ width: 3840, height: 2160, ink: 0 });
    expect(near(behind.colours[0]!, PURPLE)).toBe(true);
    expect(near(behind.colours[1]!, WHITE)).toBe(true);
    expect(near(behind.colours[2]!, WHITE)).toBe(true);
    // The picture by itself, with no more pixels than it needs: its left half purple, its right orange.
    const alone = await look(join(dir, assetOf(picture!).file), { x: 0, y: 0, w: 1, h: 1 }, []);
    expect(alone.width).toBe(alone.height);
    expect(alone.width).toBeGreaterThanOrEqual(16);
    expect(alone.width).toBeLessThanOrEqual(2 * 100 * scale + 2);
    const halves = async (element: (typeof first)['elements'][number]) => {
      const size = (await look(join(dir, assetOf(element).file), { x: 0, y: 0, w: 1, h: 1 }, []))
        .width;
      const y = Math.floor(size / 2);
      return (
        await look(join(dir, assetOf(element).file), { x: 0, y: 0, w: 1, h: 1 }, [
          [Math.floor(size * 0.25), y],
          [Math.floor(size * 0.75), y],
        ])
      ).colours;
    };
    const jpeg2000 = await halves(picture!);
    expect(near(jpeg2000[0]!, PURPLE)).toBe(true);
    expect(near(jpeg2000[1]!, ORANGE)).toBe(true);
    // The second page: pictures in the formats pdf.js brings its own decoders for (JPEG 2000, and
    // CCITT fax and JBIG2, which scanned pages use). Each test picture has a left and a right half.
    const [two, three, four] = second!.elements;
    const again = await halves(two!);
    expect(near(again[0]!, PURPLE)).toBe(true);
    expect(near(again[1]!, ORANGE)).toBe(true);
    for (const element of [three!, four!]) {
      const colours = await halves(element);
      expect(near(colours[0]!, WHITE)).toBe(true);
      expect(near(colours[1]!, BLACK)).toBe(true);
    }
  });

  it('shows the slide with text and pictures that can be selected one by one', async () => {
    const stage = page.locator('.stage-inner');
    const texts = stage.locator('.ls-el-text');
    await expect.poll(() => texts.count()).toBe(3);
    expect(await texts.nth(0).textContent()).toBe('A');
    expect(await texts.nth(1).textContent()).toBe('Punkt B og C');
    expect(await texts.nth(1).locator('.ls-link').textContent()).toBe('B');
    // The text is set in the program's own font, not drawn as a picture.
    expect(
      await texts.nth(0).evaluate((el) => getComputedStyle(el.firstElementChild!).fontFamily),
    ).toContain('Liberation Sans');
    // The line of text is one line here too.
    const lineBox = (await texts.nth(1).boundingBox())!;
    const lineText = (await texts.nth(1).locator('.ls-p').boundingBox())!;
    const frame = (await page.locator('.stage-frame').boundingBox())!;
    const shown = frame.width / 1920;
    expect(lineText.height / shown).toBeLessThan(24 * (1920 / 720) * 1.5);
    expect(lineText.height).toBeLessThanOrEqual(lineBox.height + 1);

    const images = stage.locator('.ls-el-image img');
    expect(await images.count()).toBe(2);
    await expect
      .poll(() => images.nth(0).evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBe(3840);

    // A click on the letter selects the letter, and a click on the picture the picture: not the page.
    const selection = page.locator('.stage-overlay .selection');
    const selected = async (): Promise<number> =>
      Number.parseFloat(await selection.evaluate((el) => (el as HTMLElement).style.width));
    const letter = (await texts.nth(0).boundingBox())!;
    await page.mouse.click(letter.x + letter.width / 2, letter.y + letter.height / 2);
    await expect.poll(() => selection.count()).toBe(1);
    expect(await selected()).toBeLessThan(300);
    const picture = (await stage.locator('.ls-el-image').nth(1).boundingBox())!;
    await page.mouse.click(picture.x + picture.width / 2, picture.y + picture.height / 2);
    await expect.poll(() => selected()).toBeCloseTo(100 * (1920 / 720), 0);
    await page.keyboard.press('Escape');

    await page.locator('.scene-item').nth(1).click();
    await expect.poll(() => stage.locator('.ls-el-image img').count()).toBe(3);
    expect(await texts.count()).toBe(2);
    expect(await texts.first().textContent()).toBe('B');
    expect(
      await texts.nth(1).evaluate((el) => getComputedStyle(el.firstElementChild!).fontWeight),
    ).toBe('700');
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
    await expect.poll(() => page.locator('.stage-inner .ls-el-image img').count()).toBe(3);
    expect(await page.locator('.stage-inner .ls-el-text').first().textContent()).toBe('B');
  });

  it('takes out what is painted on a picture with it, and says which text is a picture', async () => {
    const pdf = join(work, 'Lagt oppå.pdf');
    writeFileSync(
      pdf,
      buildPdf({
        pages: [
          {
            width: 720,
            height: 405,
            // A dark field with a white letter on it.
            rects: [{ x: 400, y: 250, w: 200, h: 80, color: [47 / 255, 11 / 255, 99 / 255] }],
            lines: [
              { text: 'Punkt A', x: 72, y: 300, size: 24 },
              { text: 'B', x: 480, y: 275, size: 40, color: [1, 1, 1] },
            ],
            // A picture with an orange bar painted across its upper right part.
            pictures: ['jpeg2000'],
            cover: [{ x: 150, y: 150, w: 100, h: 20, color: [1, 98 / 255, 2 / 255] }],
          },
          {
            width: 720,
            height: 405,
            // A white letter on the purple half of a picture.
            lines: [{ text: 'Punkt C', x: 300, y: 300, size: 24 }],
            pictures: ['jpeg2000'],
            captions: [{ text: 'D', x: 115, y: 130, size: 40, color: [1, 1, 1] }],
          },
        ],
      }),
    );
    const dir = join(work, 'Lagt oppå');
    await answerDialogs(pdf, dir);
    await importPdfFile();
    await expect.poll(() => existsSync(join(dir, 'prosjekt.json')), LONG).toBe(true);
    await expect
      .poll(() => page.locator('.notice').textContent(), LONG)
      .toContain('Lysark 1 og 2 har merknader fra importen');
    const project = readProject(dir);
    const [scene, other] = project.scenes;
    const file = (element: (typeof scene)['elements'][number]): string => {
      if (element.type !== 'image') throw new Error('not an image');
      return join(dir, project.assets[element.asset]!.file);
    };
    const scale = 1920 / 720;

    // The first page. The black line is text. The white letter would not show on this slide's
    // white surface in a colour text can have: it stays in the background, on its field. The
    // picture is taken out, and the bar that was painted across it lies on top of it.
    expect(scene!.elements.map((e) => e.type)).toEqual(['image', 'image', 'image', 'text']);
    const [background, picture, bar, line] = scene!.elements;
    expect(line).toMatchObject({ content: { paragraphs: [{ runs: [{ text: 'Punkt A' }] }] } });
    // The background speaks for the text that stays in it.
    expect(background).toMatchObject({ type: 'image', alt: 'B' });
    expect(background).not.toHaveProperty('decorative');
    expect(scene!.imported?.warnings).toEqual([
      { code: 'text', message: expect.stringContaining('er lagt inn som bilde') },
    ]);
    expect(picture!.box.x).toBeCloseTo(100 * scale, 0);
    expect(picture!.box.w).toBeCloseTo(100 * scale, 0);
    expect(bar).toMatchObject({ type: 'image', alt: '', decorative: true });
    expect(bar!.box.x).toBeCloseTo(150 * scale, 0);
    expect(bar!.box.y).toBeCloseTo((405 - 170) * scale, 0);
    expect(bar!.box.w).toBeCloseTo(100 * scale, 0);
    expect(bar!.box.h).toBeCloseTo(20 * scale, 0);
    const behind = await look(file(background!), { x: 380, y: 500, w: 420, h: 160 }, [
      // The field, the stem of the letter on it, and where the picture and the bar were.
      [2240, 533],
      [2587, 616],
      [667, 1360],
      [933, 1307],
    ]);
    expect(near(behind.colours[0]!, [47, 11, 99])).toBe(true);
    expect(near(behind.colours[1]!, WHITE)).toBe(true);
    expect(near(behind.colours[2]!, WHITE)).toBe(true);
    expect(near(behind.colours[3]!, WHITE)).toBe(true);
    // The line that became text is not in the background too.
    expect(behind.ink).toBe(0);
    const barPicture = await look(file(bar!), { x: 0, y: 0, w: 1, h: 1 }, [[20, 20]]);
    expect(near(barPicture.colours[0]!, ORANGE)).toBe(true);

    // The second page: the white letter lies on the picture. The picture is taken out, and the
    // letter is a small picture of its own on top of it, which says what the letter says.
    expect(other!.elements.map((e) => e.type)).toEqual(['image', 'image', 'text']);
    const [under, letter] = other!.elements;
    expect(under!.box.w).toBeCloseTo(100 * scale, 0);
    expect(letter).toMatchObject({ type: 'image', alt: 'D' });
    expect(letter).not.toHaveProperty('decorative');
    // It stands where the letter stood: inside the left half of the picture.
    expect(letter!.box.x).toBeGreaterThan(100 * scale);
    expect(letter!.box.x + letter!.box.w).toBeLessThan(150 * scale);
    expect(letter!.box.y).toBeGreaterThan((405 - 200) * scale);
    expect(letter!.box.y + letter!.box.h).toBeLessThan((405 - 100) * scale);
    expect(other!.imported?.warnings).toEqual([
      { code: 'text', message: expect.stringContaining('er lagt inn som bilde') },
    ]);
  });

  it('keeps pages without text that shows as one picture, and marks those that need a text', async () => {
    const pdf = join(work, 'Uten tekst.pdf');
    writeFileSync(
      pdf,
      buildPdf({
        pages: [
          // A scanned page: a picture and nothing else.
          { width: 400, height: 300, pictures: ['jpeg2000'] },
          { width: 300, height: 400, text: 'A', rotate: 90 },
          // A scanned page with the text a scanner program has laid over it, without showing.
          {
            width: 400,
            height: 300,
            pictures: ['ccitt'],
            lines: [{ text: 'Skannet A', x: 100, y: 150, size: 20, invisible: true }],
          },
          // Text that something else covers does not show either.
          {
            width: 400,
            height: 300,
            lines: [{ text: 'Skjult B', x: 100, y: 150, size: 20 }],
            cover: [{ x: 50, y: 100, w: 300, h: 100, color: [1, 0.38, 0] }],
          },
        ],
      }),
    );
    const dir = join(work, 'Uten tekst');
    await answerDialogs(pdf, dir);
    await importPdfFile();
    await expect.poll(() => existsSync(join(dir, 'prosjekt.json')), LONG).toBe(true);
    await expect
      .poll(() => page.locator('.notice').textContent(), LONG)
      .toContain('Lysark 1 har ingen tekst som kunne hentes ut');
    expect(await page.locator('.notice').textContent()).toContain(
      'Lysark 1, 3 og 4 er lagt inn som ett bilde av hele siden.',
    );
    const project = readProject(dir);
    // No title of its own in the PDF: the file's name.
    expect(project.meta.title).toBe('Uten tekst');
    expect(project.scenes.map((s) => s.title)).toEqual(['Side 1', 'A', 'Skannet A', 'Skjult B']);
    const whole = [project.scenes[0]!, project.scenes[2]!, project.scenes[3]!];
    for (const scene of whole) {
      expect(scene.elements).toHaveLength(1);
      expect(scene.elements[0]).toMatchObject({
        type: 'image',
        box: { x: 240, y: 0, w: 1440, h: 1080, rotation: 0 },
      });
      expect(scene.elements[0]).not.toHaveProperty('decorative');
    }
    // The text that does not show is what the picture says to a screen reader.
    expect(whole.map((scene) => (scene.elements[0] as { alt: string }).alt)).toEqual([
      '',
      'Skannet A',
      'Skjult B',
    ]);
    expect(project.scenes[0]!.imported?.warnings).toEqual([
      { code: 'text', message: expect.stringContaining('ingen tekst') },
    ]);
    expect(project.scenes[2]!.imported?.warnings).toEqual([]);
    expect(project.scenes[3]!.imported?.warnings).toEqual([]);
    expect(await page.locator('.scene-item').first().textContent()).toContain('å ordne');
    // A page that is turned in the PDF is read the way it is shown, lying. Its letter then runs
    // downwards, and is a text element turned the same way, where the letter stood.
    const turned = project.scenes[1]!;
    expect(turned.imported?.warnings).toEqual([]);
    expect(turned.elements.map((e) => e.type)).toEqual(['text']);
    const letter = turned.elements[0]!;
    expect(letter).toMatchObject({ content: { paragraphs: [{ runs: [{ text: 'A' }] }] } });
    expect(letter.box.rotation).toBe(90);
    // The page is 400 x 300 when turned: 3.6 pixels a point, and 240 in from the left. The
    // baseline starts 240 points in and 72 points down, and runs straight down from there.
    const size = 96 * 3.6;
    const start = { x: 240 + 240 * 3.6, y: 72 * 3.6 };
    const middle = { x: letter.box.x + letter.box.w / 2, y: letter.box.y + letter.box.h / 2 };
    expect(Math.abs(middle.y - letter.box.w / 2 - start.y)).toBeLessThan(2);
    const baselineInBox = (size * (1.2 + 0.905 - 0.212)) / 2;
    expect(Math.abs(middle.x + letter.box.h / 2 - baselineInBox - start.x)).toBeLessThan(3);
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
    await importPdfFile();
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
    await importPdfFile();
    await expect
      .poll(() => page.locator('.notice-error').textContent(), LONG)
      .toContain('beskyttet med passord');
    await expect.poll(() => page.locator('dialog.pdf-import').count()).toBe(0);
    expect(await dialogsAsked()).toEqual({ open: 1, save: 0 });

    const broken = join(work, 'Skadet.pdf');
    writeFileSync(broken, 'Dette er ikke en PDF.');
    await answerDialogs(broken, dir);
    await importPdfFile();
    await expect
      .poll(() => page.locator('.notice-error').textContent(), LONG)
      .toContain('ikke en PDF som kan leses');
    await expect.poll(() => page.locator('dialog.pdf-import').count()).toBe(0);
    expect(await dialogsAsked()).toEqual({ open: 1, save: 0 });
    expect(existsSync(dir)).toBe(false);
    expect(await page.locator('.project-title').inputValue()).toBe('Uten tekst');
  });
});
