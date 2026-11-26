// Runs the built program end to end for the time axis: it is put in from the
// "Figur" menu, its form of events is filled in, and the figure follows. The
// text of an event is written and emptied on the slide, the axis is turned
// to run down, the events are given steps and seen as a student sees them,
// and the figure is made into a free one. Needs `npm run build`. The window
// is never shown, and nothing touches the network. The content is test
// content, not subject matter.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newProject, newScene, plainText, richText } from '../src/shared/format/factory';
import type {
  Element,
  FigureElement,
  Project,
  Scene,
  ShapeElement,
  TextElement,
} from '../src/shared/format/schema';
import { followFigures } from '../src/shared/layout/groups';
import { followTemplates } from '../src/shared/layout/templates';
import { OFFLINE } from './fixtures/offline';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
const packaged = process.env.LYSARK_APP;
const shots = process.env.LYSARK_SHOTS;

describe.skipIf(!built)('the time axis, end to end', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;

  const shot = async (target: Page, name: string): Promise<void> => {
    if (!shots) return;
    mkdirSync(shots, { recursive: true });
    await target.screenshot({ path: join(shots, `${name}.png`) });
  };
  const save = async (): Promise<Scene> => {
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
    const project = JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;
    return project.scenes[0]!;
  };
  const figureIn = (scene: Scene): FigureElement =>
    scene.elements.find((el): el is FigureElement => el.type === 'figure')!;
  /** The parts of the figure of one kind, in the order of the form; undefined where an event has none. */
  const parts = <T extends Element = ShapeElement>(scene: Scene, kind: string): Array<T> => {
    const figure = figureIn(scene);
    return figure.items.map(
      (item) =>
        scene.elements.find(
          (el) => el.of?.figure === figure.id && el.of.part === `${kind}:${item.id}`,
        ) as T,
    );
  };
  const settled = (scene: Scene): boolean => {
    const copy = structuredClone(scene);
    return !followTemplates(copy) && !followFigures(copy);
  };
  const heading = (): Promise<string | null> =>
    page.locator('.panel-body h3').first().textContent();
  const onStage = (kind: 'shape' | 'text'): Promise<number> =>
    page.locator(`.stage-inner .ls-el-${kind}`).count();

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-tidsakse-'));
    projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    const project = newProject('Testforelesning');
    const scene = newScene('content', 'Lysark A');
    scene.showLogo = false;
    scene.elements.push({
      id: 'e_tittel',
      type: 'text',
      role: 'title',
      content: richText('Overskrift A'),
      align: 'left',
      valign: 'top',
      box: { x: 120, y: 96, w: 1000, h: 90, rotation: 0 },
    });
    project.scenes.push(scene);
    writeFileSync(join(projectDir, 'prosjekt.json'), JSON.stringify(project, null, 2), 'utf8');

    const args = [OFFLINE, `--user-data-dir=${join(work, 'userdata')}`, projectDir];
    app = await electron.launch({
      ...(packaged ? { executablePath: packaged, args } : { args: [root, ...args] }),
      env: { ...process.env, LYSARK_HIDDEN: '1' },
    });
    page = await app.firstWindow();
    await page.waitForSelector('.app');
    await page.locator('.scene-item').first().click();
    await page.waitForSelector('.stage-inner .ls-el-text');
  }, 60_000);

  afterAll(async () => {
    await app
      ?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.destroy()))
      .catch(() => undefined);
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('is put in with three empty events, and follows its form as it is filled in', async () => {
    await page.locator('.insertbar').getByRole('button', { name: 'Figur' }).click();
    const menu = page.locator('.insertbar .menu');
    // It is called "Tidsakse": "Tidslinje" is the tab under the slide.
    expect(await menu.getByRole('menuitem').allTextContents()).toContain('Tidsakse');
    expect(await menu.getByRole('menuitem').allTextContents()).not.toContain('Tidslinje');
    await menu.getByRole('menuitem', { name: 'Tidsakse' }).click();
    // The line, and a point and a box for each event. Nothing is written yet.
    await expect.poll(() => onStage('shape')).toBe(7);
    expect(await onStage('text')).toBe(1);
    expect(await heading()).toBe('Figur: Tidsakse');
    expect(await page.locator('.stage-inner').textContent()).toBe('Overskrift A');

    for (const [index, when] of ['1', '2', '3'].entries()) {
      await page.getByLabel(`Tidspunkt for hendelse ${index + 1}`).fill(when);
    }
    await page.getByLabel('Tekst til hendelse 1').fill('A');
    await page.getByLabel('Tekst til hendelse 2').fill('B\nC');
    // Two events have a text now; it is read with its event.
    await expect.poll(() => onStage('text')).toBe(3);
    expect(await page.locator('.stage-inner').textContent()).toBe('Overskrift A1A2BC3');
    // The whole figure is still what is chosen, with its form.
    expect(await heading()).toBe('Figur: Tidsakse');

    await page.getByRole('button', { name: 'Legg til hendelse' }).click();
    await page.getByLabel('Tidspunkt for hendelse 4').fill('4');
    await page.getByRole('button', { name: 'Flytt hendelse 4 opp' }).click();
    let scene = await save();
    expect(figureIn(scene).items.map((item) => item.text)).toEqual(['1', '2', '4', '3']);
    expect(figureIn(scene).items.map((item) => item.detail)).toEqual([
      'A',
      'B\nC',
      undefined,
      undefined,
    ]);
    // The events stand in the order of the form, from left to right, each point under its box.
    const heads = parts(scene, 'head');
    const dots = parts(scene, 'dot');
    const xs = heads.map((el) => el.box.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    heads.forEach((head, i) => {
      const dot = dots[i]!;
      expect(Math.abs(head.box.x + head.box.w / 2 - (dot.box.x + dot.box.w / 2))).toBeLessThan(2);
    });
    const bodies = parts<TextElement>(scene, 'body');
    expect(bodies.map((el) => (el ? plainText(el.content) : null))).toEqual([
      'A',
      'B\nC',
      null,
      null,
    ]);
    expect(bodies[0]!.type).toBe('text');
    expect(settled(scene)).toBe(true);
    await page.getByRole('button', { name: 'Fjern hendelse 3' }).click();
    await expect.poll(() => onStage('shape')).toBe(7);
    await shot(page, 't01-tidsakse');
    scene = await save();
    expect(figureIn(scene).items.map((item) => item.text)).toEqual(['1', '2', '3']);
  }, 120_000);

  it('takes what is written on the slide into the form, and an emptied text out of it', async () => {
    let scene = await save();
    const body = parts<TextElement>(scene, 'body')[0]!;
    const onSlide = page.locator(`.stage-inner [data-el="${body.id}"]`);
    await onSlide.dblclick();
    await page.waitForSelector('.stage-inner .is-editing');
    await page.keyboard.press('End');
    await page.keyboard.type('2');
    await page.getByRole('button', { name: 'Ferdig' }).click();
    // The text is what is chosen now: the panel says it belongs to the figure, and leads to the form.
    await expect.poll(heading).toBe('Brødtekst: A2');
    expect(await page.locator('.panel-body .hint').first().textContent()).toContain(
      'Dette er en del av en figur (tidsakse)',
    );
    await page.getByRole('button', { name: 'Vis skjemaet' }).click();
    await expect.poll(heading).toBe('Figur: Tidsakse');
    expect(await page.getByLabel('Tekst til hendelse 1').inputValue()).toBe('A2');

    // When it is, is written in its box on the slide.
    const head = parts(scene, 'head')[2]!;
    await page.locator(`.stage-inner [data-el="${head.id}"]`).dblclick();
    await page.waitForSelector('.stage-inner .is-editing');
    await page.keyboard.press('End');
    await page.keyboard.type('0');
    await page.getByRole('button', { name: 'Ferdig' }).click();
    await page.getByRole('button', { name: 'Vis skjemaet' }).click();
    expect(await page.getByLabel('Tidspunkt for hendelse 3').inputValue()).toBe('30');

    // The text deleted by itself: the field is emptied, and the event stays.
    await onSlide.click();
    await onSlide.click();
    await expect.poll(heading).toBe('Brødtekst: A2');
    await page.locator('.panel-body').getByRole('button', { name: 'Slett' }).click();
    scene = await save();
    expect(figureIn(scene).items.map((item) => item.text)).toEqual(['1', '2', '30']);
    expect(figureIn(scene).items[0]!.detail).toBeUndefined();
    expect(parts(scene, 'body')[0]).toBeUndefined();
    expect(settled(scene)).toBe(true);
  }, 120_000);

  it('is turned to run down, and gives each event its step as a student sees it', async () => {
    // A click on one of its boxes chooses the whole figure.
    const first = parts(await save(), 'head')[0]!;
    await page.locator(`.stage-inner [data-el="${first.id}"]`).click();
    await expect.poll(heading).toBe('Figur: Tidsakse');
    await page.getByRole('button', { name: 'Ett steg per hendelse' }).click();
    // Written after the steps were made, the text still comes in with its event.
    await page.getByLabel('Tekst til hendelse 1').fill('A');
    const direction = page.locator('fieldset.segmented', { hasText: 'Retning' });
    await direction.getByRole('button', { name: 'Nedover' }).click();
    let scene = await save();
    const figure = figureIn(scene);
    expect(figure.direction).toBe('down');
    const heads = parts(scene, 'head');
    const dots = parts(scene, 'dot');
    const bodies = parts<TextElement>(scene, 'body');
    const ys = heads.map((el) => el.box.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(heads.every((el) => el.box.x === figure.box.x)).toBe(true);
    expect(bodies[0]!.box.x).toBeGreaterThan(dots[0]!.box.x);
    expect(scene.timeline.map((step) => step.actions.map((action) => action.target))).toEqual([
      [dots[0]!.id, heads[0]!.id, bodies[0]!.id],
      [dots[1]!.id, heads[1]!.id, bodies[1]!.id],
      [dots[2]!.id, heads[2]!.id],
    ]);
    expect(settled(scene)).toBe(true);
    await shot(page, 't02-tidsakse-nedover');

    const opened = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Forhåndsvis' }).click();
    const player = await opened;
    await player.waitForSelector('.lp-stage .ls-scene');
    const hidden = (id: string): Promise<boolean> =>
      player
        .locator(`.lp-stage [data-el="${id}"]`)
        .evaluate((node) => getComputedStyle(node).visibility === 'hidden');
    // The line is there from the start; the events come one at a time.
    const axis = scene.elements.find((el) => el.of?.part === 'axis:line')!;
    expect(await hidden(axis.id)).toBe(false);
    expect(await hidden(heads[0]!.id)).toBe(true);
    expect(await hidden(bodies[0]!.id)).toBe(true);
    await player.keyboard.press('ArrowRight');
    await expect.poll(() => hidden(heads[0]!.id)).toBe(false);
    await expect.poll(() => hidden(bodies[0]!.id)).toBe(false);
    await expect.poll(() => hidden(dots[0]!.id)).toBe(false);
    expect(await hidden(heads[1]!.id)).toBe(true);
    await player.keyboard.press('ArrowRight');
    await expect.poll(() => hidden(bodies[1]!.id)).toBe(false);
    expect(await hidden(heads[2]!.id)).toBe(true);
    await shot(player, 't03-spiller');
    await player.close();

    // Across again, in the frame a new time axis has.
    await direction.getByRole('button', { name: 'Bortover' }).click();
    scene = await save();
    expect(figureIn(scene).direction).toBeUndefined();
    expect(figureIn(scene).box.w).toBe(1500);
  }, 120_000);

  it('leaves the HTML player without the code that checks project files', () => {
    // The player reads the rows of a form to say what is read first. That must
    // not bring the whole project format with it: every exported file holds the player.
    const player = readFileSync(join(root, 'out/player/player.js'), 'utf8');
    expect(player).not.toContain('safeParse');
    expect(player.length).toBeLessThan(90_000);
  });

  it('is made into a free figure: shapes and text boxes in a group', async () => {
    await page.getByRole('button', { name: 'Gjør om til fri figur' }).click();
    // The line, three points, three boxes and two texts.
    await expect.poll(heading).toBe('Gruppe med 9 deler');
    let scene = await save();
    expect(scene.elements.some((el) => el.type === 'figure' || el.of !== undefined)).toBe(false);
    const group = scene.elements.filter((el) => el.group !== undefined);
    expect(group).toHaveLength(9);
    expect(group.filter((el) => el.type === 'text')).toHaveLength(2);
    expect(scene.timeline).toHaveLength(3);
    // One undo brings the form back.
    await page.getByRole('button', { name: 'Angre' }).click();
    scene = await save();
    expect(figureIn(scene).items).toHaveLength(3);
    expect(settled(scene)).toBe(true);
  }, 120_000);
});
