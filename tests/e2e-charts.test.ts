// Runs the built program end to end for bar and line diagrams: they are put
// in from the "Figur" menu, their table of numbers is filled in by hand and
// by pasting what a spreadsheet gives, and the diagram follows. The series
// are given steps and seen as a student sees them, with the numbers as a
// table for those who cannot see. Needs `npm run build`. The window is
// never shown, and nothing touches the network. The numbers are test
// numbers, not subject matter.
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

describe.skipIf(!built)('bar and line diagrams, end to end', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;

  const shot = async (target: Page, name: string): Promise<void> => {
    if (!shots) return;
    mkdirSync(shots, { recursive: true });
    await target.screenshot({ path: join(shots, `${name}.png`) });
  };
  const save = async (slide = 0): Promise<Scene> => {
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
    const project = JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;
    return project.scenes[slide]!;
  };
  const figureIn = (scene: Scene): FigureElement =>
    scene.elements.find((el): el is FigureElement => el.type === 'figure')!;
  const part = <T extends Element = ShapeElement>(scene: Scene, key: string): T =>
    scene.elements.find((el) => el.of?.part === key) as T;
  const kind = (scene: Scene, name: string): Element[] =>
    scene.elements.filter((el) => el.of?.part.startsWith(`${name}:`));
  const settled = (scene: Scene): boolean => {
    const copy = structuredClone(scene);
    return !followTemplates(copy) && !followFigures(copy);
  };
  const heading = (): Promise<string | null> =>
    page.locator('.panel-body h3').first().textContent();
  const insertFigure = async (name: string): Promise<void> => {
    await page.locator('.insertbar').getByRole('button', { name: 'Figur' }).click();
    await page.locator('.insertbar .menu').getByRole('menuitem', { name }).click();
  };
  /** Pastes text into the field with that label, as Ctrl+V with a spreadsheet's cells would. */
  const paste = async (label: string, text: string): Promise<void> => {
    await page.getByLabel(label, { exact: true }).evaluate((node, value) => {
      const data = new DataTransfer();
      data.setData('text/plain', value);
      node.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      );
    }, text);
  };

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-diagram-'));
    projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    const project = newProject('Testforelesning');
    for (const name of ['A', 'B']) {
      const scene = newScene('content', `Lysark ${name}`);
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
      project.scenes.push(scene);
    }
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

  it('puts in a bar diagram without numbers, which follows its table as it is filled in', async () => {
    await page.locator('.insertbar').getByRole('button', { name: 'Figur' }).click();
    expect(await page.locator('.insertbar .menu').getByRole('menuitem').allTextContents()).toEqual([
      'Prosess',
      'Lagvis oppbygging',
      'Sammenligning',
      'Tidsakse',
      'Søylediagram',
      'Linjediagram',
    ]);
    await page.locator('.insertbar .menu').getByRole('menuitem', { name: 'Søylediagram' }).click();
    expect(await heading()).toBe('Figur: Søylediagram');
    // Only the two axes: no numbers are made up.
    await expect.poll(() => page.locator('.stage-inner .ls-el-shape').count()).toBe(2);
    expect(await page.locator('.stage-inner').textContent()).toBe('Overskrift A');

    // Written by hand, with a comma for the decimals.
    await page.getByLabel('Navn på rad 1').fill('A');
    await page.getByLabel('Serie 1, rad 1').fill('1,5');
    await page.getByLabel('Navn på rad 2').fill('B');
    await page.getByLabel('Serie 1, rad 2').fill('3');
    let scene = await save();
    expect(figureIn(scene).items.map((row) => [row.text, row.values])).toEqual([
      ['A', [1.5]],
      ['B', [3]],
      ['', [null]],
    ]);
    expect(kind(scene, 'bar')).toHaveLength(2);
    // The numbers along the axis are written alike, with a comma.
    expect(kind(scene, 'tick').map((el) => plainText((el as TextElement).content))).toEqual([
      '0,0',
      '0,5',
      '1,0',
      '1,5',
      '2,0',
      '2,5',
      '3,0',
    ]);
    // What is not a number is marked, and changes nothing.
    await page.getByLabel('Serie 1, rad 3').fill('x');
    expect(await page.getByLabel('Serie 1, rad 3').getAttribute('aria-invalid')).toBe('true');
    await page.getByLabel('Serie 1, rad 3').fill('');
    // The whole diagram is still what is chosen, with its table.
    expect(await heading()).toBe('Figur: Søylediagram');

    // Pasted from a spreadsheet over the whole table: names of two series, and three rows.
    await paste('Navn på rad 1', 'Navn\tEn\tTo\r\nA\t1\t2\r\nB\t3\t4\r\nC\t2\t1\r\n');
    await expect.poll(() => page.getByLabel('Navn på serie 2').inputValue()).toBe('To');
    expect(await page.getByLabel('To, rad 3').inputValue()).toBe('1');
    await page.getByLabel('Tekst ved den loddrette aksen').fill('Y');
    await page.getByLabel('Tekst ved den vannrette aksen').fill('X');
    scene = await save();
    const figure = figureIn(scene);
    expect(figure.series!.map((one) => one.name)).toEqual(['En', 'To']);
    expect(figure.items.map((row) => [row.text, row.values])).toEqual([
      ['A', [1, 2]],
      ['B', [3, 4]],
      ['C', [2, 1]],
    ]);
    expect(kind(scene, 'bar')).toHaveLength(6);
    expect(kind(scene, 'label')).toHaveLength(3);
    expect(kind(scene, 'name')).toHaveLength(2);
    const [one, two] = figure.series!;
    const b = figure.items[1]!;
    const first = part(scene, `bar:${b.id}:${one!.id}`);
    const second = part(scene, `bar:${b.id}:${two!.id}`);
    expect([first.fill, second.fill]).toEqual(['lilla', 'oransje']);
    expect(second.box.h).toBeGreaterThan(first.box.h);
    expect(first.box.y + first.box.h).toBe(second.box.y + second.box.h);
    expect(settled(scene)).toBe(true);
    await shot(page, 'd01-soyler');
  }, 120_000);

  it('gives each series its step, and shows a student the bars and reads out the numbers', async () => {
    await page.getByRole('button', { name: 'Ett steg per serie' }).click();
    const scene = await save();
    const figure = figureIn(scene);
    const [one, two] = figure.series!;
    expect(scene.timeline).toHaveLength(2);
    expect(scene.timeline[0]!.actions).toHaveLength(5);

    const opened = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Forhåndsvis' }).click();
    const player = await opened;
    await player.waitForSelector('.lp-stage .ls-scene');
    const hidden = (id: string): Promise<boolean> =>
      player
        .locator(`.lp-stage [data-el="${id}"]`)
        .evaluate((node) => getComputedStyle(node).visibility === 'hidden');
    const a = figure.items[0]!;
    const firstBar = part(scene, `bar:${a.id}:${one!.id}`).id;
    const secondBar = part(scene, `bar:${a.id}:${two!.id}`).id;
    // The axes and their numbers are there from the start; the series come one at a time.
    expect(await hidden(part(scene, 'axis:x').id)).toBe(false);
    expect(await hidden(part(scene, 'tick:1').id)).toBe(false);
    expect(await hidden(firstBar)).toBe(true);
    await player.keyboard.press('ArrowRight');
    await expect.poll(() => hidden(firstBar)).toBe(false);
    await expect.poll(() => hidden(part(scene, `name:${one!.id}`).id)).toBe(false);
    expect(await hidden(secondBar)).toBe(true);
    await player.keyboard.press('ArrowRight');
    await expect.poll(() => hidden(secondBar)).toBe(false);
    // The numbers are there as a table that is read, and takes no room on the slide.
    const table = player.locator(`.lp-stage [data-el="${figure.id}"] table`);
    expect(await table.locator('tr').allTextContents()).toEqual(['XEnTo', 'A12', 'B34', 'C21']);
    const size = (await player.locator('.lp-stage .ls-figure-table').boundingBox())!;
    expect(size.width).toBeLessThanOrEqual(2);
    expect(size.height).toBeLessThanOrEqual(2);
    await shot(player, 'd02-soyler-spiller');
    await player.close();
  }, 120_000);

  it('puts in a line diagram, where the points stand where their numbers say', async () => {
    await page.locator('.scene-item').nth(1).click();
    await page.waitForSelector('.stage-inner .ls-el-text');
    await insertFigure('Linjediagram');
    expect(await heading()).toBe('Figur: Linjediagram');
    await paste('X i rad 1', 'X\tEn\tTo\n0\t0\t4\n1\t2\t3\n4\t4\t\n');
    await expect.poll(() => page.getByLabel('En, rad 3').inputValue()).toBe('4');
    await page.getByLabel('Vis punktene').check();
    let scene = await save(1);
    let figure = figureIn(scene);
    expect(figure.items.map((row) => [row.x, row.values])).toEqual([
      [0, [0, 4]],
      [1, [2, 3]],
      [4, [4, null]],
    ]);
    const [one, two] = figure.series!;
    const curve = part(scene, `curve:${one!.id}`);
    expect(curve.points).toEqual([
      [0, 1],
      [0.25, 0.5],
      [1, 0],
    ]);
    expect(curve.dots).toBe(true);
    expect(part(scene, `curve:${two!.id}`).points).toEqual([
      [0, 0],
      [0.25, 0.25],
    ]);
    // Drawn as one line with a dot at each point.
    const drawn = page.locator(`.stage-inner [data-el="${curve.id}"]`);
    expect(await drawn.locator('polyline').count()).toBe(1);
    expect(await drawn.locator('circle').count()).toBe(3);
    expect(settled(scene)).toBe(true);
    await shot(page, 'd03-linjer');

    // The axis fixed by the lecturer, and one number changed by hand.
    await page.getByLabel('Høyeste tall på den loddrette aksen').last().fill('8');
    await page.getByLabel('To, rad 3').fill('1,5');
    scene = await save(1);
    figure = figureIn(scene);
    expect(figure.yMax).toBe(8);
    expect(figure.items[2]!.values).toEqual([4, 1.5]);
    expect(part(scene, `curve:${one!.id}`).points).toEqual([
      [0, 1],
      [0.25, 0.75],
      [1, 0.5],
    ]);
    expect(part(scene, `curve:${two!.id}`).points).toHaveLength(3);

    // A series taken away, and the diagram made into a free figure: the curve is a shape.
    await page.getByRole('button', { name: 'Fjern serie 2' }).click();
    await page.getByRole('button', { name: 'Gjør om til fri figur' }).click();
    await expect.poll(heading).toMatch(/^Gruppe med \d+ deler$/);
    scene = await save(1);
    expect(scene.elements.some((el) => el.type === 'figure' || el.of !== undefined)).toBe(false);
    const free = scene.elements.filter(
      (el): el is ShapeElement => el.type === 'shape' && el.geometry === 'curve',
    );
    expect(free).toHaveLength(1);
    // Chosen by itself it is called a curve, and cannot be made into another shape.
    await page.locator(`.stage-inner [data-el="${free[0]!.id}"]`).click();
    await page.locator(`.stage-inner [data-el="${free[0]!.id}"]`).click();
    await expect.poll(heading).toBe('Kurve');
    expect(await page.locator('.panel-body').getByLabel('Form', { exact: true }).count()).toBe(0);
    // One undo brings the table back.
    await page.getByRole('button', { name: 'Angre' }).click();
    scene = await save(1);
    expect(figureIn(scene).series).toHaveLength(1);
    expect(settled(scene)).toBe(true);
  }, 120_000);
});
