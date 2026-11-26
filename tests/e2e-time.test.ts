// Runs the built program end to end for how long a slide stands: the field
// «Tid uten lyd» in the tab «Lysark», the same number in the tab «Lyd» with
// «Bruk på alle lysark uten lyd», and the edge of a slide on the timeline.
// Needs `npm run build`. The window is never shown, and nothing touches the
// network.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encodeWav } from '../src/shared/audio/wav';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import type { Project } from '../src/shared/format/schema';
import { OFFLINE } from './fixtures/offline';

const root = resolve(__dirname, '..');
const built = existsSync(join(root, 'out/main/index.js'));
const packaged = process.env.LYSARK_APP;

describe.skipIf(!built)('how long a slide stands, end to end', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;

  const saved = (): Project =>
    JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;
  const save = async (): Promise<void> => {
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
  };
  const slide = (n: number) => page.locator('.scene-item').nth(n);
  const field = () => page.locator('#scene-seconds');

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-tid-'));
    projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    const voice = new Float32Array(3 * 48000);
    for (let i = 0; i < voice.length; i++)
      voice[i] = 0.3 * Math.sin((2 * Math.PI * 300 * i) / 48000);
    const wav = encodeWav(voice);
    writeFileSync(join(projectDir, 'media', 'stemme.wav'), wav);
    const project = newProject('Testforelesning');
    project.assets.a_stemme = {
      kind: 'audio',
      file: 'media/stemme.wav',
      mime: 'audio/wav',
      bytes: wav.byteLength,
    };
    for (const [index, name] of ['A', 'B', 'C', 'D'].entries()) {
      const scene = newScene('content', `Lysark ${name}`);
      scene.id = `s_${name.toLowerCase()}`;
      scene.elements.push({
        id: `e_${index}`,
        type: 'text',
        role: 'title',
        content: richText(`Overskrift ${name}`),
        align: 'left',
        valign: 'top',
        box: { x: 120, y: 96, w: 1680, h: 90, rotation: 0 },
      });
      project.scenes.push(scene);
    }
    // A: no sound and one step. B: a voice of three seconds. C: only a pause
    // of four seconds (the old way of giving a slide a length). D: no sound.
    project.scenes[0]!.timeline = [
      { id: 't_a', actions: [{ target: 'e_0', effect: 'fade', duration: 0.4 }] },
    ];
    project.scenes[1]!.audio = {
      clips: [{ id: 'c_b', kind: 'sound', asset: 'a_stemme', from: 0, to: 3 }],
    };
    project.scenes[2]!.audio = { clips: [{ id: 'c_c', kind: 'pause', duration: 4 }] };
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

  it('shows the time that applies in the tab «Lysark», and sets the slide’s own', async () => {
    await slide(0).click();
    // Five seconds and two for the one step: what applies when nothing is set.
    await expect.poll(() => field().inputValue()).toBe('7');
    expect(await page.locator('#scene-seconds-hint').textContent()).toBe(
      'Så lenge står lysarket i videoen og i «Spill av» når det ikke har lyd.',
    );
    await field().fill('12,5');
    await field().press('Enter');
    await expect.poll(() => page.getByRole('tab', { name: /^Lyd/ }).textContent()).toBe(
      'Lyd (0:13)',
    );
    await save();
    expect(saved().scenes[0]!.seconds).toBe(12.5);

    // A slide with sound: the sound decides, and the field is not offered.
    await slide(1).click();
    await expect.poll(() => field().count()).toBe(0);
    expect(await page.locator('.scene-time-sound').textContent()).toMatch(
      /lyd.*0:03.*fanen «Lyd»/,
    );

    // A slide whose only sound is a pause shows the pause, and the number replaces it.
    await slide(2).click();
    await expect.poll(() => field().inputValue()).toBe('4');
    await field().fill('6');
    await field().press('Enter');
    await save();
    expect(saved().scenes[2]!.audio).toBeUndefined();
    expect(saved().scenes[2]!.seconds).toBe(6);
  });

  it('shows the same number in the tab «Lyd», and gives it to every slide without sound at once', async () => {
    await page.getByRole('tab', { name: /^Lyd/ }).click();
    await slide(3).click();
    const sentence = page.locator('.audio-silent');
    await sentence.waitFor();
    expect(await sentence.textContent()).toMatch(/^Lysarket har ingen lyd\. Det står i/);
    const number = page.getByLabel('Hvor mange sekunder lysarket står');
    await expect.poll(() => number.inputValue()).toBe('5');
    await number.fill('9');
    await number.press('Enter');
    await expect.poll(() => page.getByRole('tab', { name: /^Lyd/ }).textContent()).toBe(
      'Lyd (0:09)',
    );
    await page.getByRole('button', { name: 'Bruk på alle lysark uten lyd' }).click();
    await save();
    expect(saved().scenes.map((s) => s.seconds)).toEqual([9, undefined, 9, 9]);
    // One change, one undo: the slides have their own times again.
    await page.getByRole('button', { name: 'Angre' }).click();
    await save();
    expect(saved().scenes.map((s) => s.seconds)).toEqual([12.5, undefined, 6, 9]);
    // A slide with sound has no such sentence.
    await slide(1).click();
    await expect.poll(() => sentence.count()).toBe(0);
  });

  it('sets the time of a slide without sound by its edge on the timeline', async () => {
    await page.getByRole('tab', { name: 'Tidslinje' }).click();
    await page.waitForSelector('.timeline');
    const edge = page.locator('.tl-edge').nth(3);
    await edge.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await save();
    expect(saved().scenes[3]!.seconds).toBe(10);
    expect(saved().scenes[3]!.audio).toBeUndefined();
    // Dragged with the pointer.
    const pps = Number(await page.locator('.tl-inner').getAttribute('data-pps'));
    const box = (await edge.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - pps * 2, y, { steps: 6 });
    await page.mouse.up();
    await save();
    expect(saved().scenes[3]!.seconds).toBeCloseTo(8, 0);
    // The tab «Lysark» shows what the edge set.
    await slide(3).click();
    await expect
      .poll(async () => Number((await field().inputValue()).replace(',', '.')))
      .toBeCloseTo(saved().scenes[3]!.seconds!, 1);
  });
});
