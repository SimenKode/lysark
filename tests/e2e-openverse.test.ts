// Runs the built program end to end for the second source of pictures:
// a search in Openverse from the media dialog, with Openverse answered by
// the test itself, never the network. Needs `npm run build` first. The
// window is never shown on screen.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Project } from '../src/shared/format/schema';
import { OFFLINE } from './fixtures/offline';
import { testPng, writeSampleProject } from './fixtures/sampleProject';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
const packaged = process.env.LYSARK_APP;
const shots = process.env.LYSARK_SHOTS;

const SMALL = '00000000-0000-4000-8000-00000000000a';
const LARGE = '00000000-0000-4000-8000-00000000000b';
const NOT_FREE = '00000000-0000-4000-8000-00000000000c';

describe.skipIf(!built)('pictures from Openverse, end to end', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;

  const shot = async (name: string): Promise<void> => {
    if (!shots) return;
    mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: join(shots, `${name}.png`) });
  };
  const seen = (): Promise<string[]> =>
    app.evaluate(() => (globalThis as unknown as { lysarkSeen: string[] }).lysarkSeen);
  const saved = (): Project =>
    JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-openverse-'));
    projectDir = join(work, 'prosjekt');
    writeSampleProject(projectDir);
    const args = [OFFLINE, `--user-data-dir=${join(work, 'userdata')}`, projectDir];
    app = await electron.launch({
      ...(packaged ? { executablePath: packaged, args } : { args: [root, ...args] }),
      env: { ...process.env, LYSARK_HIDDEN: '1' },
    });
    page = await app.firstWindow();
    await page.waitForSelector('.app');
    await page.locator('.scene-item').nth(1).click();
    await page.waitForSelector('.stage-inner .ls-el-table');

    // The test answers for Openverse; no request leaves the machine.
    await app.evaluate(
      ({ session }, pictures) => {
        const requests: string[] = [];
        (globalThis as unknown as { lysarkSeen: string[] }).lysarkSeen = requests;
        const item = (id: string, extra: Record<string, unknown>): Record<string, unknown> => ({
          id,
          title: 'Bilde A',
          creator: 'Person A',
          license: 'by',
          license_version: '2.0',
          license_url: 'https://creativecommons.org/licenses/by/2.0/',
          foreign_landing_url: 'https://example.org/bilde/a',
          url: 'https://example.org/filer/a.png',
          mature: false,
          ...extra,
        });
        const items: Record<string, Record<string, unknown>> = {
          [pictures.small]: item(pictures.small, {}),
          [pictures.large]: item(pictures.large, {
            title: 'Bilde B',
            creator: 'Person B',
            license: 'cc0',
            license_version: '1.0',
            license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
          }),
          [pictures.notFree]: item(pictures.notFree, { title: 'Bilde C', license: 'by-nc' }),
        };
        const json = (body: unknown, status = 200): Response =>
          new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
          });
        session.fromPartition('lysark-web').protocol.handle('https', (request) => {
          requests.push(request.url);
          const url = new URL(request.url);
          if (url.hostname !== 'api.openverse.org') return new Response(null, { status: 404 });
          if (url.pathname === '/v1/images/') {
            if (url.searchParams.get('q') === 'for mye') {
              return json({ detail: 'Request was throttled.' }, 429);
            }
            return json({
              result_count: 3,
              page_count: 1,
              page_size: 20,
              page: 1,
              results: Object.values(items),
            });
          }
          const match = /^\/v1\/images\/([0-9a-f-]{36})\/(thumb\/)?$/.exec(url.pathname);
          const found = match && items[match[1]!];
          if (!match || !found) return json({ detail: 'Not found.' }, 404);
          if (!match[2]) return json(found);
          const full = url.searchParams.get('full_size') === 'true';
          const bytes = full && match[1] === pictures.large ? pictures.largePng : pictures.smallPng;
          return new Response(Buffer.from(bytes, 'base64'), {
            headers: { 'content-type': 'image/png' },
          });
        });
      },
      {
        small: SMALL,
        large: LARGE,
        notFree: NOT_FREE,
        smallPng: testPng(640, 480).toString('base64'),
        largePng: testPng(2400, 1000).toString('base64'),
      },
    );
  }, 60_000);

  afterAll(async () => {
    await app
      ?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.destroy()))
      .catch(() => undefined);
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('has its own tab, which says what Openverse is and is not', async () => {
    await page.locator('.insertbar').getByRole('button', { name: 'Bilde' }).click();
    await page.waitForSelector('dialog.media-dialog[open]');
    expect(await page.locator('.media-dialog').getByRole('tab').allTextContents()).toEqual([
      'Søk i Wikimedia Commons',
      'Søk i Openverse',
      'Last opp',
      'I prosjektet',
    ]);
    await page.locator('.media-dialog').getByRole('tab', { name: 'Søk i Openverse' }).click();
    const hint = await page.locator('.media-tab .hint').first().textContent();
    expect(hint).toContain('Bare søkeordene følger med');
    expect(hint).toContain('kontrollerer ikke lisensene');
    expect(hint).toContain('ikke godkjent eller støttet av Openverse');
    // Nothing has been sent yet: opening the tab contacts nobody.
    expect(await seen()).toEqual([]);
  });

  it('searches, shows only pictures that can be used, and inserts one with its credit', async () => {
    await page.getByLabel('Søk i Openverse').fill('A B');
    await page.getByRole('button', { name: 'Søk', exact: true }).click();
    const tiles = page.locator('.media-tile');
    await tiles.first().waitFor();
    // The picture with a licence that forbids commercial use is left out.
    expect(await tiles.count()).toBe(2);
    expect(await tiles.locator('.media-badge').allTextContents()).toEqual(['CC BY 2.0', 'CC0 1.0']);
    await expect
      .poll(() =>
        tiles
          .first()
          .locator('img')
          .evaluate((img) => (img as HTMLImageElement).naturalWidth),
      )
      .toBe(640);
    await tiles.first().click();
    const detail = page.locator('.media-detail');
    expect(await detail.textContent()).toContain('Person A');
    expect(await detail.textContent()).toContain('CC BY 2.0');
    // The owner is to look at the source: its address is there to be opened.
    expect(
      await detail.getByRole('link', { name: 'Se bildet hos kilden' }).getAttribute('href'),
    ).toBe('https://example.org/bilde/a');
    await shot('o01-openverse-treff');
    await detail.getByRole('button', { name: 'Sett inn' }).click();
    await expect.poll(() => page.locator('dialog.media-dialog').count()).toBe(0);
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
    const asset = Object.values(saved().assets).find(
      (a) => a.credit?.author === 'Person A' && a.credit.license === 'CC BY 2.0',
    )!;
    expect(asset.credit).toEqual({
      title: 'Bilde A',
      author: 'Person A',
      license: 'CC BY 2.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
      sourceUrl: 'https://example.org/bilde/a',
      required: true,
    });
    // A picture that is not too wide is stored as it came.
    expect(asset.mime).toBe('image/png');
    expect(asset.bytes).toBe(testPng(640, 480).length);
    expect(existsSync(join(projectDir, asset.file))).toBe(true);

    // What was sent: the search words, to Openverse's one host, under the program's name.
    const sent = await seen();
    expect(sent.length).toBeGreaterThan(0);
    for (const address of sent)
      expect(address).toMatch(/^https:\/\/api\.openverse\.org\/v1\/images\//);
    expect(sent.some((address) => address.includes('q=A+B'))).toBe(true);
    expect(sent.some((address) => address.endsWith(`${SMALL}/thumb/?full_size=true`))).toBe(true);
    // The licence is read again when the picture is fetched, not taken from the gallery.
    expect(sent.some((address) => address.endsWith(`/v1/images/${SMALL}/`))).toBe(true);
    const userAgent = await app.evaluate(({ session }) =>
      session.fromPartition('lysark-web').getUserAgent(),
    );
    expect(userAgent).toMatch(/^Lysark\/\d+\.\d+\.\d+$/);
  }, 60_000);

  it('scales a very wide picture down to the width of the stage', async () => {
    await page.locator('.insertbar').getByRole('button', { name: 'Bilde' }).click();
    await page.locator('.media-dialog').getByRole('tab', { name: 'Søk i Openverse' }).click();
    await page.getByLabel('Søk i Openverse').fill('A B');
    await page.getByRole('button', { name: 'Søk', exact: true }).click();
    const tile = page.locator('.media-tile').nth(1);
    await tile.waitFor();
    await tile.click();
    await page.locator('.media-detail').getByRole('button', { name: 'Sett inn' }).click();
    await expect.poll(() => page.locator('dialog.media-dialog').count()).toBe(0);
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
    const asset = Object.values(saved().assets).find((a) => a.credit?.author === 'Person B')!;
    expect(asset.credit).toMatchObject({ license: 'CC0 1.0', required: false });
    const size = await page.evaluate(async (file) => {
      const img = new Image();
      img.src = `lysark-media://project/${encodeURIComponent(file.replace(/^media\//, ''))}`;
      await img.decode();
      return [img.naturalWidth, img.naturalHeight];
    }, asset.file);
    expect(size).toEqual([1920, 800]);
    // A picture that was not a JPEG is stored as WebP, which keeps see-through parts.
    expect(asset.mime).toBe('image/webp');
    expect(asset.file).toMatch(/\.webp$/);
  }, 60_000);

  it('says so in plain words when Openverse will take no more searches', async () => {
    await page.locator('.insertbar').getByRole('button', { name: 'Bilde' }).click();
    await page.locator('.media-dialog').getByRole('tab', { name: 'Søk i Openverse' }).click();
    await page.getByLabel('Søk i Openverse').fill('for mye');
    await page.getByRole('button', { name: 'Søk', exact: true }).click();
    await expect
      .poll(() => page.locator('.media-tab .warning').textContent())
      .toContain('Openverse tar ikke imot flere søk akkurat nå');
    await page.locator('.media-dialog').getByRole('button', { name: 'Avbryt' }).click();
  });
});
