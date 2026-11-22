// A tool for looking at how a real lecture comes out: imports one file from
// eksempler/ through the program itself and saves a picture of every scene.
// Runs only when asked for:
//   LYSARK_SHOTS=<folder> LYSARK_PPTX="<file name>" npx vitest run tests/real-screens.test.ts
// Optional LYSARK_SCENES="1-12" limits which scenes are pictured.
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');
const shots = process.env.LYSARK_SHOTS;
const name = process.env.LYSARK_PPTX;
const source = name ? join(root, 'eksempler', name) : '';
const range = /^(\d+)-(\d+)$/.exec(process.env.LYSARK_SCENES ?? '');

describe.skipIf(!shots || !name || !existsSync(source))('pictures of a real lecture', () => {
  it('imports the file and pictures every scene', async () => {
    const work = mkdtempSync(join(tmpdir(), 'lysark-screens-'));
    mkdirSync(shots!, { recursive: true });
    const app = await electron.launch({
      args: [root, `--user-data-dir=${join(work, 'userdata')}`],
      env: { ...process.env, LYSARK_HIDDEN: '1' },
    });
    try {
      await app.evaluate(
        ({ dialog }, paths) => {
          dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [paths.source] });
          dialog.showSaveDialog = async () => ({ canceled: false, filePath: paths.dir });
        },
        { source, dir: join(work, 'prosjekt') },
      );
      const page = await app.firstWindow();
      await page.waitForSelector('.welcome');
      // Use USN's logo when the owner's logo package is unpacked in merkevare/.
      const logoPackage = join(root, 'merkevare');
      if (existsSync(join(logoPackage, 'Hovedlogo'))) {
        await app.evaluate(({ dialog }, folder) => {
          dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
        }, logoPackage);
        await page.evaluate(() =>
          (
            window as unknown as { lysark: { chooseLogoFolder(): Promise<unknown> } }
          ).lysark.chooseLogoFolder(),
        );
        await page.reload();
        await page.waitForSelector('.welcome');
        await app.evaluate(({ dialog }, pptx) => {
          dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [pptx] });
        }, source);
      }
      await page.getByRole('button', { name: 'Importer PowerPoint …' }).click();
      await page.waitForSelector('dialog.dialog[open]', { timeout: 120_000 });
      await page.locator('dialog.dialog').getByRole('button', { name: 'Lukk' }).click();
      const count = await page.locator('.scene-item').count();
      expect(count).toBeGreaterThan(0);
      const first = range ? Number(range[1]) : 1;
      const last = range ? Math.min(count, Number(range[2])) : count;
      for (let i = first; i <= last; i++) {
        await page
          .locator('.scene-item')
          .nth(i - 1)
          .click();
        await page.waitForFunction(() =>
          [...document.querySelectorAll('.stage-inner img')].every(
            (img) => (img as HTMLImageElement).complete,
          ),
        );
        await page
          .locator('.stage-frame')
          .screenshot({ path: join(shots!, `scene-${String(i).padStart(3, '0')}.png`) });
      }
    } finally {
      await app.close().catch(() => undefined);
      rmSync(work, { recursive: true, force: true });
    }
  }, 600_000);
});
