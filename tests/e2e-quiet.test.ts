// Tests never show a window on the owner's screen. An error in the main
// process would come up there as a box that waits for an answer; when the
// program runs without windows (LYSARK_HIDDEN=1) it is written out instead,
// and the program ends. Needs `npm run build`.
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { describe, expect, it } from 'vitest';
import { OFFLINE } from './fixtures/offline';

const root = resolve(__dirname, '..');
const built = existsSync(join(root, 'out/main/index.js'));

describe.skipIf(!built)('the program without windows', () => {
  it('ends when its main process fails, and puts no error box on the screen', async () => {
    const work = mkdtempSync(join(tmpdir(), 'lysark-stille-'));
    const app = await electron.launch({
      args: [root, OFFLINE, `--user-data-dir=${join(work, 'userdata')}`],
      env: { ...process.env, LYSARK_HIDDEN: '1' },
    });
    const child = app.process();
    try {
      await app.firstWindow();
      const ended = new Promise<number | null>((done) => child.once('exit', (code) => done(code)));
      await app
        .evaluate(() => {
          setTimeout(() => {
            throw new Error('An error made by the test');
          }, 0);
        })
        .catch(() => undefined);
      const waited = new Promise<'still running'>((done) =>
        setTimeout(() => done('still running'), 20_000),
      );
      expect(await Promise.race([ended, waited])).toBe(1);
    } finally {
      // Whatever happened, nothing of it is left standing.
      child.kill('SIGKILL');
      rmSync(work, { recursive: true, force: true });
    }
  }, 60_000);
});
