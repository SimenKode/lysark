// Runs the built program end to end for a recording that is saved in the
// background: "Ferdig" closes the recording window at once, the lecturer
// works on the slides while the film and the sound are stored, and the
// recording is put on the project as it is when that is done, as one change
// that one undo takes away. Meanwhile a new recording and the exports wait,
// and so does closing the program.
// Needs `npm run build` and FFmpeg in vendor/ffmpeg (the film of the camera).
// The window is never shown, the microphone and the camera are Chromium's
// fake ones, and nothing touches the network. The test holds the storing of
// the sound back until it lets it go, so that "meanwhile" is certain.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import type { Project } from '../src/shared/format/schema';
import { OFFLINE } from './fixtures/offline';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
const ffmpeg = join(
  root,
  'vendor/ffmpeg',
  `${process.platform}-${process.arch}`,
  process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
);
const WAIT = 'Opptaket lagres. Vent til det er ferdig.';

describe.skipIf(!built || !existsSync(ffmpeg))('a recording saved in the background', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;

  const saved = (): Project =>
    JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;
  const save = async (): Promise<Project> => {
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
    return saved();
  };
  const notice = (): Promise<string | null> => page.locator('.notice').textContent();
  const status = (): Promise<string | null> => page.locator('.topbar-status').textContent();
  const slides = (): Promise<string[]> => page.locator('.scene-title').allTextContents();

  /**
   * Holds back the storing of every recording's sound in the main process
   * until `letGo` is called. The program's own handler does the work then.
   */
  const holdSound = (): Promise<void> =>
    app.evaluate(({ ipcMain }) => {
      const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, Function> })
        ._invokeHandlers;
      const held = globalThis as unknown as { own?: Function; gates?: (() => void)[] };
      // The program's own handler, kept from the first time; every gate is opened by `letGo`.
      held.own ??= handlers.get('lysark:add-recording')!;
      held.gates ??= [];
      const own = held.own;
      const gate = new Promise<void>((done) => held.gates!.push(done));
      handlers.set('lysark:add-recording', async (...args: unknown[]) => {
        await gate;
        return own(...args);
      });
    });
  const letGo = (): Promise<void> =>
    app.evaluate(({ ipcMain }) => {
      const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, Function> })
        ._invokeHandlers;
      const held = globalThis as unknown as { own?: Function; gates?: (() => void)[] };
      if (held.own) handlers.set('lysark:add-recording', held.own);
      for (const open of held.gates ?? []) open();
      held.gates = [];
    });

  /** Reads slide after slide in from the selected one, about 1.5 s each, and presses "Ferdig". */
  const record = async (count: number, camera: boolean): Promise<void> => {
    await page.getByRole('tab', { name: /^Lyd/ }).click();
    await page.getByRole('button', { name: 'Les inn', exact: true }).click();
    const recorder = page.locator('.recorder');
    await recorder.waitFor();
    const box = recorder.getByLabel('Kamera', { exact: true });
    if (camera) {
      await box.check();
      await expect
        .poll(() =>
          recorder.locator('.camera-circle video').evaluate((v: HTMLVideoElement) => v.videoWidth),
        )
        .toBeGreaterThan(0);
    } else {
      await box.uncheck();
    }
    await recorder.getByRole('button', { name: 'Start opptak' }).click();
    await recorder.locator('.recorder-clock.is-on').waitFor({ timeout: 15_000 });
    for (let n = 1; n <= count; n++) {
      await page.waitForTimeout(1500);
      if (n < count) {
        await page.keyboard.press('ArrowRight');
        await expect
          .poll(() => recorder.locator('.recorder-where').textContent())
          .toContain(`Lysark ${n + 1} av`);
      }
    }
    await holdSound();
    await recorder.getByRole('button', { name: 'Ferdig' }).click();
  };

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-bakgrunn-'));
    projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    const project = newProject('Testforelesning');
    for (const name of ['A', 'B', 'C']) {
      const scene = newScene('content', `Lysark ${name}`);
      scene.id = `s_${name}`;
      scene.showLogo = false;
      scene.elements.push({
        id: `e_tittel_${name}`,
        type: 'text',
        role: 'title',
        content: richText(`Overskrift ${name}`),
        align: 'left',
        valign: 'top',
        box: { x: 120, y: 96, w: 1000, h: 90, rotation: 0 },
      });
      scene.script = `Manus ${name}.`;
      project.scenes.push(scene);
    }
    writeFileSync(join(projectDir, 'prosjekt.json'), JSON.stringify(project, null, 2), 'utf8');
    app = await electron.launch({
      args: [
        root,
        OFFLINE,
        `--user-data-dir=${join(work, 'userdata')}`,
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        projectDir,
      ],
      env: { ...process.env, LYSARK_HIDDEN: '1' },
    });
    page = await app.firstWindow();
    await page.waitForSelector('.app');
  }, 60_000);

  afterAll(async () => {
    // Whatever happened, the sound is let go, so the program can close.
    await letGo().catch(() => undefined);
    await app
      ?.evaluate(({ dialog }) => {
        dialog.showMessageBoxSync = () => 1; // "Ikke lagre"
      })
      .catch(() => undefined);
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('closes at once, lets the lecturer work meanwhile, and puts the recording on as one change', async () => {
    await record(2, true);
    // The window goes at once; the top bar says, calmly, what goes on.
    await page.locator('.recorder').waitFor({ state: 'detached', timeout: 5000 });
    expect(await status()).toBe('Lagrer opptaket');
    expect(await page.locator('.topbar-status').getAttribute('aria-live')).toBe('polite');

    // The lecturer writes in the manuscript of the first slide.
    await page.getByRole('tab', { name: 'Manus' }).click();
    const script = page.locator('.script-panel textarea');
    await script.fill('Manus A, skrevet mens opptaket ble lagret.');

    // A new recording and the exports wait, and say why. (Their buttons say they
    // wait, and can still be pressed: the test presses them as a lecturer would.)
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: 'Eksporter HTML' })
      .click({ force: true });
    await expect.poll(notice).toBe(`${WAIT}Lukk`);
    await page.locator('.notice button', { hasText: 'Lukk' }).click();
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: 'Eksporter video' })
      .click({ force: true });
    await expect.poll(notice).toContain(WAIT);
    expect(await page.locator('dialog.video-dialog').count()).toBe(0);
    await page.locator('.notice button', { hasText: 'Lukk' }).click();
    await page.getByRole('tab', { name: /^Lyd/ }).click();
    const again = page.getByRole('button', { name: 'Les inn', exact: true });
    expect(await again.getAttribute('title')).toBe(WAIT);
    await again.click({ force: true });
    await expect.poll(notice).toContain(WAIT);
    expect(await page.locator('.recorder').count()).toBe(0);
    await page.locator('.notice button', { hasText: 'Lukk' }).click();
    await page.getByRole('tab', { name: 'Manus' }).click();

    // Closing the program waits too: no box, the window stays, and it says why.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
    await expect.poll(notice).toContain('Opptaket lagres ennå');
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    await page.locator('.notice button', { hasText: 'Lukk' }).click();

    await letGo();
    await expect
      .poll(notice, { timeout: 60_000 })
      .toContain('Opptaket er lagt på 2 lysark. Husk å lagre prosjektet.');
    expect(await status()).toBe('');
    // Nothing was changed under the lecturer's hands: the same slide, the same panel.
    expect(await page.locator('.scene-item').first().getAttribute('aria-current')).toBe('true');
    expect(await page.getByRole('tab', { name: 'Manus' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(await script.inputValue()).toBe('Manus A, skrevet mens opptaket ble lagret.');
    await page.locator('.notice button', { hasText: 'Lukk' }).click();

    let project = await save();
    const [a, b, c] = project.scenes;
    expect(a!.script).toBe('Manus A, skrevet mens opptaket ble lagret.');
    expect(a!.audio?.clips).toHaveLength(1);
    expect(b!.audio?.clips).toHaveLength(1);
    expect(c!.audio?.clips ?? []).toHaveLength(0);
    // The film of the camera came along.
    const clip = a!.audio!.clips[0]!;
    const sound = project.assets[clip.kind === 'sound' ? clip.asset : '']!;
    expect(project.assets[sound.camera!.asset]?.kind).toBe('camera');

    // One undo takes the whole recording away, and leaves what was written.
    await page.getByRole('button', { name: 'Angre' }).click();
    project = await save();
    expect(project.scenes.map((s) => s.audio?.clips.length ?? 0)).toEqual([0, 0, 0]);
    expect(project.scenes[0]!.script).toBe('Manus A, skrevet mens opptaket ble lagret.');
    expect(Object.values(project.assets).filter((x) => x.kind === 'camera')).toHaveLength(0);
  }, 150_000);

  it('leaves out a slide that was deleted while the recording was saved, and says so', async () => {
    await page.locator('.scene-item').first().click();
    await record(3, false);
    await page.locator('.recorder').waitFor({ state: 'detached', timeout: 5000 });
    // B is deleted meanwhile.
    await page.locator('.scene-item').nth(1).click();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Slett lysarket' }).click();
    await expect.poll(slides).toEqual(['Lysark A', 'Lysark C']);

    await letGo();
    await expect.poll(notice, { timeout: 60_000 }).toContain('Opptaket er lagt på 2 lysark.');
    expect(await notice()).toContain(
      'Ett lysark du leste inn, ble slettet mens opptaket ble lagret. Det du sa der, er ikke lagt på.',
    );
    await page.locator('.notice button', { hasText: 'Lukk' }).click();
    const project = await save();
    expect(project.scenes.map((s) => s.id)).toEqual(['s_A', 's_C']);
    expect(project.scenes.map((s) => s.audio?.clips.length ?? 0)).toEqual([1, 1]);
    // No sound of the deleted slide is left among the project's media list.
    const used = new Set(
      project.scenes.flatMap((s) =>
        (s.audio?.clips ?? []).map((clip) => (clip.kind === 'sound' ? clip.asset : '')),
      ),
    );
    const sounds = Object.entries(project.assets).filter(([, x]) => x.kind === 'audio');
    expect(sounds.every(([id]) => used.has(id))).toBe(true);
  }, 120_000);
});
