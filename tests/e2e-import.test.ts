// Runs the built program end to end for the import path: pick a PPTX,
// choose where the project goes, and check what the owner then sees.
// Needs `npm run build` first. The window is never shown on screen.
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  LAYOUT_CONTENT,
  LAYOUT_TITLE,
  REL,
  URI,
  buildPptx,
  graphicFrame,
  para,
  pic,
  sp,
  tinyPng,
  txBody,
  xfrm,
} from './fixtures/buildPptx';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
/** Set LYSARK_APP to a packaged executable to test that instead of the build in out/. */
const packaged = process.env.LYSARK_APP;

function testDeck(): Uint8Array {
  return buildPptx({
    coreTitle: 'Testimport',
    layouts: [LAYOUT_TITLE, LAYOUT_CONTENT],
    media: { 'image1.png': tinyPng(120, 0, 240) },
    slides: [
      {
        layout: 0,
        shapes:
          sp({ ph: 'type="ctrTitle"', body: txBody(para('<a:r><a:t>Tittel A</a:t></a:r>')) }) +
          sp({
            ph: 'type="subTitle" idx="1"',
            body: txBody(para('<a:r><a:t>Undertittel B</a:t></a:r>')),
          }),
      },
      {
        layout: 1,
        notes: ['Notat A', 'Notat B'],
        rels: [{ id: 'rIdImage', type: REL.image, target: '../media/image1.png' }],
        shapes:
          sp({ ph: 'type="title"', body: txBody(para('<a:r><a:t>Overskrift A</a:t></a:r>')) }) +
          sp({
            ph: 'idx="1"',
            body: txBody(
              para('<a:r><a:t>Punkt A</a:t></a:r>') + para('<a:r><a:t>Punkt B</a:t></a:r>'),
            ),
          }) +
          pic({ embed: 'rIdImage', xfrm: xfrm(1200, 400, 400, 300), descr: 'Bilde A' }) +
          graphicFrame(
            200,
            700,
            400,
            200,
            URI.chart,
            '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rIdChart"/>',
          ),
      },
    ],
  });
}

describe.skipIf(!built)('importing a PowerPoint file, end to end', () => {
  let work: string;
  let app: ElectronApplication;
  let page: Page;
  let projectDir: string;

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-import-'));
    const pptx = join(work, 'Testimport.pptx');
    writeFileSync(pptx, testDeck());
    projectDir = join(work, 'Importert');
    const args = [`--user-data-dir=${join(work, 'userdata')}`];
    app = await electron.launch({
      ...(packaged ? { executablePath: packaged, args } : { args: [root, ...args] }),
      env: { ...process.env, LYSARK_HIDDEN: '1' },
    });
    await app.evaluate(
      ({ dialog }, paths) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.pptx] });
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.dir });
      },
      { pptx, dir: projectDir },
    );
    page = await app.firstWindow();
    await page.waitForSelector('.welcome');
  }, 60_000);

  afterAll(async () => {
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('imports, creates the project folder and shows the report', async () => {
    await page.getByRole('button', { name: 'Importer PowerPoint …' }).click();
    await page.waitForSelector('dialog.dialog[open]');
    const report = (await page.locator('dialog.dialog').textContent()) ?? '';
    expect(report).toContain('Testimport.pptx');
    expect(report).toContain('2 lysark');
    expect(report).toContain('Lysark 2');
    expect(report).toMatch(/diagram/i);
    expect(existsSync(join(projectDir, 'prosjekt.json'))).toBe(true);
    expect(readdirSync(join(projectDir, 'media')).length).toBe(1);
    await page.locator('dialog.dialog').getByRole('button', { name: 'Lukk' }).click();
    await expect.poll(() => page.locator('.scene-item').count()).toBe(2);
    // The file's own title wins over the title slide.
    expect(await page.locator('.project-title').inputValue()).toBe('Testimport');
  });

  it('gives the plain title slide the theme layout with the brand shapes', async () => {
    const scene = page.locator('.stage-inner .ls-scene');
    expect(await scene.locator('.ls-decoration').count()).toBe(1);
    const title = scene.locator('.ls-el-text').first();
    expect(await title.evaluate((el) => (el as HTMLElement).style.left)).toBe('120px');
    expect(await title.textContent()).toBe('Tittel A');
  });

  it('keeps positions on content slides, and turns notes into the script', async () => {
    await page.locator('.scene-item').nth(1).click();
    await page.waitForSelector('.stage-inner .ls-el-image');
    const image = page.locator('.stage-inner .ls-el-image');
    expect(await image.evaluate((el) => (el as HTMLElement).style.left)).toBe('1200px');
    expect(await image.locator('img').getAttribute('alt')).toBe('Bilde A');
    expect(
      await image.locator('img').evaluate((el) => (el as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
    expect(await page.locator('.script-panel textarea').inputValue()).toBe('Notat A\nNotat B');
    expect(await page.locator('.stage-inner .ls-list .ls-li').count()).toBe(2);
    expect(await page.locator('.scene-item').nth(1).textContent()).toContain('å ordne');
  });
});
