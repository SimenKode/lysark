// Runs the built program end to end for a "Lær mer" box on a slide that is
// zoomed in: in the HTML player the box lies beside its element where the
// element is seen, also when a step zooms while the box is open. Needs
// `npm run build`. The window is never shown, and nothing touches the network.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import { OFFLINE } from './fixtures/offline';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));

describe.skipIf(!built)('a "Lær mer" box on a zoomed slide, end to end', () => {
  let work: string;
  let app: ElectronApplication;
  let page: Page;

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-zoomboks-'));
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
      content: richText('A'),
      box: { x: 160, y: 420, w: 360, h: 200, rotation: 0 },
      more: {
        title: 'Om A',
        blocks: [{ id: 'b1', kind: 'text', content: richText('B') }],
      },
    });
    // One step: the picture zooms in on the left half of the slide, twice as large.
    scene.timeline.push({
      id: 't_zoom',
      kind: 'zoom',
      actions: [],
      zoom: { x: 0, y: 270, w: 960, h: 540 },
      seconds: 0.5,
    });
    project.scenes.push(scene);
    writeFileSync(join(projectDir, 'prosjekt.json'), JSON.stringify(project, null, 2), 'utf8');
    const args = [OFFLINE, `--user-data-dir=${join(work, 'userdata')}`, projectDir];
    app = await electron.launch({
      args: [root, ...args],
      env: { ...process.env, LYSARK_HIDDEN: '1' },
    });
    page = await app.firstWindow();
    await page.waitForSelector('.app');
    await page.waitForSelector('.scene-item');
  }, 60_000);

  afterAll(async () => {
    await app
      ?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.destroy()))
      .catch(() => undefined);
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('lies beside the element where it is seen, and follows a zoom made while it is open', async () => {
    const opened = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Forhåndsvis' }).click();
    const player = await opened;
    await player.waitForSelector('.lp-stage .ls-scene');
    const layout = (): Promise<{ pop: DOMRect; element: DOMRect; slide: DOMRect }> =>
      player.evaluate(() => {
        const rect = (selector: string): DOMRect =>
          document.querySelector(selector)!.getBoundingClientRect().toJSON() as DOMRect;
        return {
          pop: rect('.lp-panel'),
          element: rect('.lp-stage [data-el="e_boks"]'),
          slide: rect('.lp-stagebox'),
        };
      });

    // Opened before the zoom: beside the element, on its right.
    await player.locator('.lp-stage .ls-more-badge').click();
    await player.waitForSelector('.lp-panel:not([hidden])');
    await expect
      .poll(() => player.locator('.lp-panel').evaluate((el) => getComputedStyle(el).opacity), {
        timeout: 15_000,
      })
      .toBe('1');
    let now = await layout();
    expect(now.pop.left).toBeGreaterThanOrEqual(now.element.right);

    // The step zooms in while the box is open: the element is seen twice as
    // large, and the box goes along to lie beside it there.
    await player.keyboard.press('ArrowRight');
    await expect
      .poll(
        async () => {
          now = await layout();
          return now.element.width / (now.slide.width * (360 / 1920));
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(1.98);
    await expect
      .poll(async () => {
        now = await layout();
        return now.pop.left - now.element.right;
      })
      .toBeGreaterThanOrEqual(0);
    expect(now.pop.right).toBeLessThanOrEqual(now.slide.right + 1);
    await player.close();
  }, 120_000);
});
