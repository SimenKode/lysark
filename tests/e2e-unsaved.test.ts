// Runs the built program end to end for the question about unsaved changes:
// when a project with changes is about to be left for another, the lecturer
// is asked once, with three answers that say what they do (the owner,
// 26.11.2026). Needs `npm run build`. The window is never shown; the test
// answers the question itself.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newProject, newScene } from '../src/shared/format/factory';
import type { Project } from '../src/shared/format/schema';
import { OFFLINE } from './fixtures/offline';

const root = resolve(__dirname, '..');
const built = existsSync(join(root, 'out/main/index.js'));
const packaged = process.env.LYSARK_APP;

interface Asked {
  message: string;
  detail?: string;
  buttons: string[];
}

describe.skipIf(!built)('unsaved changes, end to end', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;

  /** Lets the test answer the question (0, 1 or 2), and says no to every file dialog. */
  const answer = (choice: number): Promise<void> =>
    app.evaluate(({ dialog }, pick) => {
      const asked = ((globalThis as unknown as { lysarkAsked?: unknown[] }).lysarkAsked ??= []);
      dialog.showMessageBoxSync = ((_window: unknown, options: unknown) => {
        asked.push(options);
        return pick;
      }) as typeof dialog.showMessageBoxSync;
      dialog.showSaveDialog = () => Promise.resolve({ canceled: true, filePath: '' });
      dialog.showOpenDialog = () => Promise.resolve({ canceled: true, filePaths: [] });
    }, choice);
  const asked = (): Promise<Asked[]> =>
    app.evaluate(() => (globalThis as unknown as { lysarkAsked?: Asked[] }).lysarkAsked ?? []);
  const newFromMenu = (): Promise<void> =>
    app.evaluate(({ Menu }) => {
      const file = Menu.getApplicationMenu()!.items.find((item) => item.label === 'Fil')!;
      file.submenu!.items.find((item) => item.label === 'Nytt prosjekt …')!.click();
    });
  const saveButton = (): Promise<string | null> =>
    page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .textContent();
  const onDisk = (): Project =>
    JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-ulagret-'));
    projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    const project = newProject('Testforelesning');
    project.scenes.push(newScene('content', 'Lysark A'));
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

  it('asks once, with answers that say what they do, and does what is answered', async () => {
    // Without changes nothing is asked.
    await answer(2);
    await newFromMenu();
    await page.waitForTimeout(500);
    expect(await asked()).toHaveLength(0);

    // A change: the name of the slide.
    await page.getByLabel('Navn i innholdsoversikten').fill('Lysark endret');
    await expect.poll(saveButton).toContain('•');

    // "Avbryt": one question, and the lecturer stays, with the changes unsaved.
    await newFromMenu();
    await expect.poll(async () => (await asked()).length).toBe(1);
    const question = (await asked())[0]!;
    expect(question.buttons).toEqual(['Lagre', 'Ikke lagre', 'Avbryt']);
    expect(question.message).toBe('Prosjektet har endringer som ikke er lagret.');
    expect(question.detail).toBe('Vil du lagre dem før du går videre?');
    await page.waitForTimeout(500);
    expect(await asked()).toHaveLength(1);
    expect(await saveButton()).toContain('•');
    expect(onDisk().scenes[0]!.title).toBe('Lysark A');

    // "Ikke lagre": asked once more, nothing is saved, and the program goes on
    // (to the dialog for the new project, which the test says no to).
    await answer(1);
    await newFromMenu();
    await expect.poll(async () => (await asked()).length).toBe(2);
    await page.waitForTimeout(500);
    expect(onDisk().scenes[0]!.title).toBe('Lysark A');

    // "Lagre": the changes are saved before the program goes on.
    await answer(0);
    await newFromMenu();
    await expect.poll(() => onDisk().scenes[0]!.title).toBe('Lysark endret');
    await expect.poll(saveButton).toBe('Lagret');
    expect(await asked()).toHaveLength(3);
  }, 120_000);
});
