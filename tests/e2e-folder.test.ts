// Runs the built program end to end for two things about folders: the save
// dialogs of the exports and «Lagre som én fil» propose the folder last
// exported to, while it still exists; and «Rydd i prosjektmappa» moves the
// files in the media folder that nothing uses to the waste bin, after asking.
// Needs `npm run build`. The window is never shown; the test answers every
// dialog itself, and answers for the waste bin too, so nothing of the test
// lands in the real one.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import type { Project } from '../src/shared/format/schema';
import { OFFLINE } from './fixtures/offline';
import { testPng } from './fixtures/sampleProject';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
const packaged = process.env.LYSARK_APP;
const ffmpeg = join(
  root,
  'vendor/ffmpeg',
  `${process.platform}-${process.arch}`,
  process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
);

interface Asked {
  message: string;
  detail?: string;
  buttons: string[];
}

describe.skipIf(!built)('folders: where exports go, and tidying the project folder', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;

  const notice = (): Promise<string | null> => page.locator('.notice').textContent();
  const closeNotice = (): Promise<void> =>
    page.locator('.notice button', { hasText: 'Lukk' }).click();
  const saved = (): Project =>
    JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;
  const save = async (): Promise<void> => {
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
  };
  const fileMenu = (label: string): Promise<void> =>
    app.evaluate(({ Menu }, text) => {
      const file = Menu.getApplicationMenu()!.items.find((item) => item.label === 'Fil')!;
      file.submenu!.items.find((item) => item.label === text)!.click();
    }, label);

  /** The next save dialog answers with `file` (or is cancelled), and notes what it proposed. */
  const answerSave = (file: string | null): Promise<void> =>
    app.evaluate(({ dialog }, path) => {
      const g = globalThis as unknown as { proposed?: string[] };
      g.proposed ??= [];
      dialog.showSaveDialog = ((...args: unknown[]) => {
        const options = args[args.length - 1] as { defaultPath?: string };
        g.proposed!.push(options.defaultPath ?? '');
        return Promise.resolve(
          path ? { canceled: false, filePath: path } : { canceled: true, filePath: '' },
        );
      }) as typeof dialog.showSaveDialog;
    }, file);
  const lastProposed = async (): Promise<string> => {
    const all = await app.evaluate(
      () => (globalThis as unknown as { proposed?: string[] }).proposed ?? [],
    );
    return all[all.length - 1] ?? '';
  };

  /** Answers the question of «Rydd i prosjektmappa», and notes what went to the waste bin. */
  const answerTidy = (choice: number): Promise<void> =>
    app.evaluate(({ dialog, shell }, pick) => {
      const g = globalThis as unknown as { asked: unknown[]; trashed: string[] };
      g.asked = [];
      g.trashed = [];
      dialog.showMessageBoxSync = ((_window: unknown, options: unknown) => {
        g.asked.push(options);
        return pick;
      }) as typeof dialog.showMessageBoxSync;
      shell.trashItem = async (path: string) => {
        g.trashed.push(path);
      };
    }, choice);
  const tidyAsked = (): Promise<Asked[]> =>
    app.evaluate(() => (globalThis as unknown as { asked: Asked[] }).asked);
  const trashed = (): Promise<string[]> =>
    app.evaluate(() => (globalThis as unknown as { trashed: string[] }).trashed);
  /** What the test's waste bin got: the files go from the folder, as from the real one. */
  const emptyTrashed = async (): Promise<void> => {
    for (const path of await trashed()) if (existsSync(path)) unlinkSync(path);
  };

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-mapper-'));
    projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    const png = testPng(40, 20);
    writeFileSync(join(projectDir, 'media', 'bilde.png'), png);
    writeFileSync(join(projectDir, 'media', 'gammel.png'), testPng(30, 30));
    // A file in the media folder that the project does not even list.
    writeFileSync(join(projectDir, 'media', 'rest.wav'), Buffer.alloc(2048, 1));
    const project = newProject('Testforelesning');
    project.assets.a_bilde = {
      kind: 'image',
      file: 'media/bilde.png',
      mime: 'image/png',
      bytes: png.byteLength,
    };
    // Listed, but nothing uses it: a picture that was taken off its slide earlier.
    project.assets.a_gammel = {
      kind: 'image',
      file: 'media/gammel.png',
      mime: 'image/png',
      bytes: 100,
    };
    const scene = newScene('content', 'Lysark A');
    scene.elements.push(
      {
        id: 'e_tittel',
        type: 'text',
        role: 'title',
        content: richText('A'),
        align: 'left',
        valign: 'top',
        box: { x: 120, y: 96, w: 1000, h: 90, rotation: 0 },
      },
      {
        id: 'e_bilde',
        type: 'image',
        asset: 'a_bilde',
        alt: 'B',
        box: { x: 200, y: 300, w: 400, h: 200, rotation: 0 },
      },
    );
    project.scenes.push(scene);
    writeFileSync(join(projectDir, 'prosjekt.json'), JSON.stringify(project, null, 2), 'utf8');
    const args = [OFFLINE, `--user-data-dir=${join(work, 'userdata')}`, projectDir];
    app = await electron.launch({
      ...(packaged ? { executablePath: packaged, args } : { args: [root, ...args] }),
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

  it('proposes the folder last exported to, while it still exists', async () => {
    const out = join(work, 'ut');
    const other = join(work, 'annet');
    mkdirSync(out);
    mkdirSync(other);
    const exportHtml = async (file: string): Promise<void> => {
      await answerSave(file);
      await page.locator('.topbar-actions').getByRole('button', { name: 'Eksporter HTML' }).click();
      await expect.poll(notice, { timeout: 60_000 }).toContain('lagret');
      await closeNotice();
    };
    // The first time: beside the project, as before.
    await exportHtml(join(out, 'a.html'));
    expect(dirname(await lastProposed())).toBe(work);
    // Then where the last export went.
    await exportHtml(join(out, 'b.html'));
    expect(dirname(await lastProposed())).toBe(out);
    expect(await lastProposed()).toBe(join(out, 'Testforelesning.html'));
    // «Lagre som én fil» too, and it is remembered in turn.
    await answerSave(join(other, 'prosjekt.lysark.zip'));
    await fileMenu('Lagre som én fil …');
    await expect.poll(notice, { timeout: 30_000 }).toContain('lagret som én fil');
    await closeNotice();
    expect(dirname(await lastProposed())).toBe(out);
    if (existsSync(ffmpeg)) {
      // And the video: the dialog is only asked here, and cancelled.
      await answerSave(null);
      await page
        .locator('.topbar-actions')
        .getByRole('button', { name: 'Eksporter video' })
        .click();
      const dialog = page.locator('dialog.video-dialog');
      await dialog.waitFor();
      await dialog.getByRole('button', { name: 'Velg fil og eksporter' }).click();
      await expect.poll(lastProposed).toBe(join(other, 'Testforelesning.mp4'));
      await dialog.getByRole('button', { name: 'Lukk' }).click();
    }
    // It is kept in the program's settings.
    const settings = JSON.parse(
      readFileSync(join(work, 'userdata', 'innstillinger.json'), 'utf8'),
    ) as { exportFolder?: string };
    expect(settings.exportFolder).toBe(other);
    // A folder that is gone is not proposed: beside the project again.
    rmSync(other, { recursive: true, force: true });
    await exportHtml(join(out, 'c.html'));
    expect(dirname(await lastProposed())).toBe(work);
  }, 120_000);

  it('moves the files nothing uses to the waste bin, after asking, and keeps what «Angre» can bring back', async () => {
    // The picture is taken off the slide: «Angre» can bring it back, so its file stays.
    await page.locator('.scene-item').first().click();
    const picture = page.locator('.stage-inner [data-el="e_bilde"]');
    const box = (await picture.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await app.evaluate(({ Menu }) => {
      const edit = Menu.getApplicationMenu()!.items.find((item) => item.label === 'Rediger')!;
      edit.submenu!.items.find((item) => item.label === 'Slett element')!.click();
    });
    await expect.poll(() => picture.count()).toBe(0);

    // "Avbryt": asked, and nothing goes.
    await answerTidy(1);
    await fileMenu('Rydd i prosjektmappa …');
    await expect.poll(async () => (await tidyAsked()).length).toBe(1);
    const question = (await tidyAsked())[0]!;
    expect(question.message).toMatch(/^2 filer i prosjektmappa er ikke i bruk \(\d+ kB\)\.$/);
    expect(question.detail).toContain('Vil du legge dem i papirkurven?');
    expect(question.buttons).toEqual(['Legg i papirkurven', 'Avbryt']);
    await page.waitForTimeout(300);
    expect(await trashed()).toEqual([]);

    // A yes: the two go to the waste bin, never deleted outright.
    await answerTidy(0);
    await fileMenu('Rydd i prosjektmappa …');
    await expect.poll(notice).toContain('2 filer er lagt i papirkurven.');
    await closeNotice();
    expect((await trashed()).map((path) => path.split(/[\\/]/).pop()).sort()).toEqual([
      'gammel.png',
      'rest.wav',
    ]);
    await emptyTrashed();
    expect(existsSync(join(projectDir, 'media', 'bilde.png'))).toBe(true);
    // The picture that went is out of the project's list of media too.
    await save();
    expect(Object.keys(saved().assets)).toEqual(['a_bilde']);

    // Nothing more to tidy: it says so, and asks nothing.
    await answerTidy(0);
    await fileMenu('Rydd i prosjektmappa …');
    await expect.poll(notice).toContain('Prosjektmappa er ryddig. Alle filene i den er i bruk.');
    await closeNotice();
    expect(await tidyAsked()).toEqual([]);

    // «Angre» brings the picture back, from its file.
    await page.getByRole('button', { name: 'Angre' }).click();
    await expect.poll(() => picture.count()).toBe(1);
  }, 120_000);
});
