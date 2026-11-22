// Runs the built program end to end: open a project, edit, undo, export
// HTML and use the exported player. Needs `npm run build` first. The window
// is never shown on screen.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { writeSampleProject } from './fixtures/sampleProject';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
/** Set LYSARK_APP to a packaged executable to test that instead of the build in out/. */
const packaged = process.env.LYSARK_APP;
/** Set LYSARK_SHOTS to a folder to keep screenshots of each stage. */
const shots = process.env.LYSARK_SHOTS;
/** USN's unpacked logo package, when the owner has put it in merkevare/ (never in git). */
const logoPackage = join(root, 'merkevare');
const hasLogoPackage = existsSync(join(logoPackage, 'Hovedlogo'));

describe.skipIf(!built)('the program, end to end', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;

  const shot = async (target: Page, name: string): Promise<void> => {
    if (!shots) return;
    mkdirSync(shots, { recursive: true });
    await target.screenshot({ path: join(shots, `${name}.png`) });
  };

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-e2e-'));
    projectDir = join(work, 'prosjekt');
    writeSampleProject(projectDir);
    const args = [`--user-data-dir=${join(work, 'userdata')}`, projectDir];
    app = await electron.launch({
      ...(packaged ? { executablePath: packaged, args } : { args: [root, ...args] }),
      env: { ...process.env, LYSARK_HIDDEN: '1' },
    });
    page = await app.firstWindow();
    await page.setViewportSize({ width: 1500, height: 950 }).catch(() => undefined);
    await page.waitForSelector('.app');
  }, 60_000);

  afterAll(async () => {
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('opens the project given on the command line', async () => {
    await expect.poll(() => page.locator('.scene-item').count()).toBe(3);
    expect(await page.locator('.project-title').inputValue()).toBe('Testforelesning');
    expect(await page.locator('.stage-inner .ls-scene').count()).toBe(1);
    await shot(page, '01-apnet');
  });

  it('keeps the scene pictures inside their box in the list, also with a scrollbar', async () => {
    const measure = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.scene-item')].map((item) => {
          const thumb = item.querySelector('.scene-thumb')!;
          const inner = item.querySelector('.scene-thumb-inner')!;
          const pad = parseFloat(getComputedStyle(item).paddingRight);
          return {
            room: item.getBoundingClientRect().right - pad - thumb.getBoundingClientRect().right,
            // The scaled scene is exactly as wide as the frame around it.
            fill: inner.getBoundingClientRect().width - thumb.getBoundingClientRect().width,
            width: thumb.getBoundingClientRect().width,
          };
        }),
      );
    const wide = await measure();
    expect(wide).toHaveLength(3);
    for (const m of wide) {
      expect(m.room).toBeGreaterThanOrEqual(0);
      expect(Math.abs(m.fill)).toBeLessThan(0.5);
    }
    // A list too long for the window gets a scrollbar, which takes room from the pictures.
    await page.evaluate(() => {
      (document.querySelector('.scene-list ol') as HTMLElement).style.maxHeight = '160px';
    });
    await expect.poll(async () => (await measure())[0]!.width).toBeLessThan(wide[0]!.width);
    await expect.poll(async () => Math.abs((await measure())[0]!.fill)).toBeLessThan(0.5);
    for (const m of await measure()) expect(m.room).toBeGreaterThanOrEqual(0);
    await page.evaluate(() => {
      (document.querySelector('.scene-list ol') as HTMLElement).style.maxHeight = '';
    });
    await expect.poll(async () => (await measure())[0]!.width).toBe(wide[0]!.width);
  });

  it('keeps the chosen scene readable when the pointer is over it', async () => {
    const chosen = page.locator('.scene-item[aria-current="true"]');
    await chosen.hover();
    const colours = await chosen.evaluate((el) => {
      const style = getComputedStyle(el);
      return { background: style.backgroundColor, text: style.color };
    });
    expect(colours).toEqual({ background: 'rgb(120, 0, 240)', text: 'rgb(255, 255, 255)' });
    await page.mouse.move(700, 500);
  });

  it('draws the title scene with the brand shapes and the serif title', async () => {
    const scene = page.locator('.stage-inner .ls-scene');
    expect(await scene.locator('.ls-decoration path').count()).toBe(4);
    const title = scene.locator('.ls-role-title');
    expect(await title.evaluate((el) => getComputedStyle(el).fontFamily)).toContain(
      'Liberation Serif',
    );
    expect(await title.evaluate((el) => getComputedStyle(el).fontWeight)).toBe('400');
    expect(await page.evaluate(() => document.fonts.check("80px 'Liberation Serif'"))).toBe(true);
  });

  it('selects, moves and undoes', async () => {
    await page.locator('.scene-item').nth(1).click();
    await page.waitForSelector('.stage-inner .ls-el-table');
    const shape = page.locator('.stage-inner .ls-el-shape').first();
    const before = await shape.evaluate((el) => (el as HTMLElement).style.left);
    const box = (await shape.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => page.locator('.stage-overlay .selection').count()).toBe(1);
    expect(await page.locator('.stage-overlay .handle').count()).toBe(8);

    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => shape.evaluate((el) => (el as HTMLElement).style.left))
      .not.toBe(before);
    expect(await page.getByRole('button', { name: /^Lagre/ }).textContent()).toContain('•');

    await page.getByRole('button', { name: 'Angre' }).click();
    await expect.poll(() => shape.evaluate((el) => (el as HTMLElement).style.left)).toBe(before);
    await shot(page, '02-valgt');
  });

  it('drags an element and snaps it to the grid', async () => {
    const image = page.locator('.stage-inner .ls-el-image');
    const box = (await image.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 6 });
    await page.mouse.up();
    const left = await image.evaluate((el) => parseFloat((el as HTMLElement).style.left));
    expect(left).toBeGreaterThan(1000);
    await page.getByRole('button', { name: 'Angre' }).click();
    await expect
      .poll(() => image.evaluate((el) => parseFloat((el as HTMLElement).style.left)))
      .toBe(1000);
  });

  it('edits text in place', async () => {
    const title = page.locator('.stage-inner .ls-el-text').first();
    const box = (await title.boundingBox())!;
    await page.mouse.dblclick(box.x + 40, box.y + box.height / 2);
    await page.waitForSelector('.stage-inner .ProseMirror');
    await page.keyboard.press('End');
    await page.keyboard.type(' ny');
    await shot(page, '03-redigerer');
    await page.keyboard.press('Escape');
    await expect.poll(() => page.locator('.stage-inner .ProseMirror').count()).toBe(0);
    await expect.poll(() => title.textContent()).toBe('Overskrift A ny');
  });

  it('shows steps and their preview', async () => {
    await page.getByRole('tab', { name: /^Steg/ }).click();
    expect(await page.locator('.step-item').count()).toBe(3); // "from the start" and two steps
    expect(await page.locator('.stage-overlay .step-badge').count()).toBe(2);
    await shot(page, '04-steg');
  });

  it('saves the project so it can be read again', async () => {
    await page.getByRole('button', { name: /^Lagre/ }).click();
    await expect
      .poll(() => page.getByRole('button', { name: /^Lagre/ }).textContent())
      .toBe('Lagret');
    const saved = JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8'));
    expect(JSON.stringify(saved)).toContain('Overskrift A ny');
  });

  it.skipIf(!hasLogoPackage)('finds USN’s logo in the unpacked logo package', async () => {
    expect(await page.locator('.stage-inner .ls-logo').count()).toBe(0);
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
    }, logoPackage);
    await page.getByRole('button', { name: 'Innstillinger' }).click();
    await page.getByRole('button', { name: 'Velg mappa med logopakka …' }).click();
    await expect.poll(() => page.locator('.logo-status .ok').count()).toBe(2);
    await page.locator('dialog.dialog').getByRole('button', { name: 'Lukk' }).click();
    // Light surface: the purple logo, bottom left, unchanged proportions.
    const logo = page.locator('.stage-inner .ls-logo');
    await expect.poll(() => logo.count()).toBe(1);
    expect(await logo.getAttribute('src')).toContain('brand/nb-light');
    await expect
      .poll(() => logo.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    const ratio = await logo.evaluate((el) => {
      const img = el as HTMLImageElement;
      return img.offsetWidth / img.offsetHeight / (img.naturalWidth / img.naturalHeight);
    });
    expect(ratio).toBeCloseTo(1, 2);
    expect(await logo.evaluate((el) => (el as HTMLElement).style.left)).toBe('120px');
    // Purple surface: the white logo.
    await page.locator('.scene-item').first().click();
    await expect
      .poll(() => page.locator('.stage-inner .ls-logo').getAttribute('src'))
      .toContain('brand/nb-dark');
    await shot(page, '04b-logo');
    await page.locator('.scene-item').nth(1).click();
    await page.waitForSelector('.stage-inner .ls-el-table');
  });

  it('exports one HTML file that works on its own', async () => {
    const out = join(work, 'eksport.html');
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, out);
    await page.getByRole('button', { name: 'Eksporter HTML' }).click();
    await page.waitForSelector('.notice');
    expect(existsSync(out)).toBe(true);
    const html = readFileSync(out, 'utf8');
    expect(statSync(out).size).toBeGreaterThan(1_000_000); // fonts are inside the file
    expect(html).toContain('id="lysark-data"');
    expect(html).toContain("font-family:'Liberation Serif'");
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+href=/);
    // Only data: URLs and references inside the page itself are allowed.
    expect(html).not.toMatch(/url\((?!data:|#)/);
    await page.locator('.notice button', { hasText: 'Lukk' }).click();
  });

  it('plays the export: steps, contents, script and the "Lær mer" panel', async () => {
    const opened = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Forhåndsvis' }).click();
    const player = await opened;
    await player.waitForSelector('.lp-stage .ls-scene');
    await player.setViewportSize({ width: 1280, height: 800 }).catch(() => undefined);

    // The window says it is the preview, also after the page has named itself.
    const titles = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((w) => w.getTitle()),
    );
    expect(titles.some((title) => title.startsWith('Forhåndsvisning – '))).toBe(true);

    // The preview opens on the scene that was open in the editor.
    await expect.poll(() => player.locator('.lp-counter').textContent()).toBe('2 / 3');
    const shape = player.locator('.lp-stage .ls-el-shape').first();
    expect(await shape.evaluate((el) => getComputedStyle(el).visibility)).toBe('hidden');
    await shot(player, '05-spiller-for-steg');

    await player.keyboard.press('ArrowRight');
    await expect
      .poll(() => shape.evaluate((el) => getComputedStyle(el).visibility))
      .toBe('visible');
    await player.keyboard.press('ArrowRight');
    await expect
      .poll(() =>
        player.locator('.lp-stage .ls-el-table').evaluate((el) => getComputedStyle(el).visibility),
      )
      .toBe('visible');
    await player.keyboard.press('ArrowLeft');
    await expect
      .poll(() =>
        player.locator('.lp-stage .ls-el-table').evaluate((el) => getComputedStyle(el).visibility),
      )
      .toBe('hidden');
    await player.keyboard.press('ArrowRight');

    // Images come from inside the file.
    const src = await player.locator('.lp-stage .ls-image img').getAttribute('src');
    expect(src).toMatch(/^blob:/);
    expect(
      await player
        .locator('.lp-stage .ls-image img')
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    ).toBe(400);

    await player.locator('.lp-stage .ls-deepdive').click();
    await player.waitForSelector('.lp-panel:not([hidden])');
    expect(await player.locator('#lp-panel-title').textContent()).toBe('Mer om A');
    expect(await player.locator('.lp-panel .lm-body img').count()).toBe(1);
    await shot(player, '06-spiller-laer-mer');
    await player.keyboard.press('Escape');
    await expect.poll(() => player.locator('.lp-panel').isHidden()).toBe(true);

    await player.keyboard.press('m');
    await player.waitForSelector('.lp-script:not([hidden])');
    expect(await player.locator('.lp-script-text p').count()).toBe(2);
    await player.keyboard.press('i');
    await player.waitForSelector('.lp-toc:not([hidden])');
    expect(await player.locator('.lp-toc-item').count()).toBe(3);
    await shot(player, '07-spiller-paneler');
    await player.locator('.lp-toc-item').nth(2).click();
    await expect.poll(() => player.locator('.lp-counter').textContent()).toBe('3 / 3');
    await player.keyboard.press('Home');
    await expect.poll(() => player.locator('.lp-counter').textContent()).toBe('1 / 3');
    await player.keyboard.press('Escape');
    await player.keyboard.press('Escape');
    await shot(player, '08-spiller-tittel');
  });
});
