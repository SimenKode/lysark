// Runs the built program end to end for figures that draw themselves from a
// form: a process, layers and a comparison are put in, their forms are
// filled in, and the figure follows. It is moved and resized as one, written
// in on the slide, given steps, seen as a student sees it, and made into a
// free figure. Needs `npm run build`. The window is never shown, and nothing
// touches the network. The content is test content, not subject matter.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  _electron as electron,
  type ElectronApplication,
  type Locator,
  type Page,
} from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newProject, newScene, plainText, richText } from '../src/shared/format/factory';
import type { FigureElement, Project, Scene, ShapeElement } from '../src/shared/format/schema';
import { followFigures } from '../src/shared/layout/groups';
import { followTemplates } from '../src/shared/layout/templates';
import { COLOR_NAMES } from '../src/shared/theme/palette';
import { OFFLINE } from './fixtures/offline';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
const packaged = process.env.LYSARK_APP;
const shots = process.env.LYSARK_SHOTS;

describe.skipIf(!built)('figures that draw themselves from a form, end to end', () => {
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
  /** The parts of the slide's figure of one kind, in the order of the form. */
  const parts = (scene: Scene, kind = 'box'): ShapeElement[] => {
    const figure = figureIn(scene);
    return figure.items.map(
      (item) =>
        scene.elements.find(
          (el) => el.of?.figure === figure.id && el.of.part === `${kind}:${item.id}`,
        ) as ShapeElement,
    );
  };
  const said = (shapes: ShapeElement[]): string[] =>
    shapes.map((el) => (el.content ? plainText(el.content) : ''));
  /** True when the slide is already what its forms say, and its lines lie right. */
  const settled = (scene: Scene): boolean => {
    const copy = structuredClone(scene);
    return !followTemplates(copy) && !followFigures(copy);
  };
  const onScreen = async (x: number, y: number): Promise<{ x: number; y: number }> => {
    const slide = (await page.locator('.stage-inner').boundingBox())!;
    const scale = slide.width / 1920;
    return { x: slide.x + x * scale, y: slide.y + y * scale };
  };
  /** Drags from one point of the slide to another, with Alt down to keep off the grid. */
  const dragOnSlide = async (
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): Promise<void> => {
    const a = await onScreen(from.x, from.y);
    const b = await onScreen(to.x, to.y);
    await page.keyboard.down('Alt');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Alt');
  };
  const heading = (): Promise<string | null> =>
    page.locator('.panel-body h3').first().textContent();
  const insertFigure = async (name: string): Promise<void> => {
    await page.locator('.insertbar').getByRole('button', { name: 'Figur' }).click();
    await page.locator('.insertbar .menu').getByRole('menuitem', { name }).click();
  };
  const onStage = (): Locator => page.locator('.stage-inner .ls-el-shape');
  const middle = (el: ShapeElement): { x: number; y: number } => ({
    x: el.box.x + el.box.w / 2,
    y: el.box.y + el.box.h / 2,
  });

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-maler-'));
    projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    const project = newProject('Testforelesning');
    for (const name of ['A', 'B', 'C']) {
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

  it('puts in a process with an empty form, which the figure follows as it is filled in', async () => {
    await insertFigure('Prosess');
    // Three empty boxes and the two arrows between them; the form is what is shown.
    await expect.poll(() => onStage().count()).toBe(5);
    expect(await heading()).toBe('Figur: Prosess');
    expect(await page.locator('.stage-inner').textContent()).toBe('Overskrift A');
    for (const [index, text] of ['A', 'B', 'C'].entries()) {
      await page.getByLabel(`Tekst i boks ${index + 1}`).fill(text);
    }
    await expect
      .poll(() => page.locator('.stage-inner .ls-shape-content').allTextContents())
      .toEqual(['A', 'B', 'C']);

    // One more box, which is then moved one place up, and the last one is taken away.
    await page.getByRole('button', { name: 'Legg til boks' }).click();
    await page.getByLabel('Tekst i boks 4').fill('D');
    await expect.poll(() => onStage().count()).toBe(7);
    await page.getByRole('button', { name: 'Flytt boks 4 opp' }).click();
    let scene = await save();
    expect(figureIn(scene).items.map((item) => item.text)).toEqual(['A', 'B', 'D', 'C']);
    expect(said(parts(scene))).toEqual(['A', 'B', 'D', 'C']);
    // The boxes stand in the order of the form, from left to right.
    const xs = parts(scene).map((el) => el.box.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(settled(scene)).toBe(true);
    await page.getByRole('button', { name: 'Fjern boks 4' }).click();
    await expect.poll(() => onStage().count()).toBe(5);
    await shot(page, 'm01-prosess');

    // Down instead of across, in another colour, and back again.
    const direction = page.locator('fieldset.segmented', { hasText: 'Retning' });
    await direction.getByRole('button', { name: 'Nedover' }).click();
    const colour = page.locator('fieldset.swatches', { hasText: 'Farge' });
    await colour.getByRole('button', { name: COLOR_NAMES.oransje }).click();
    scene = await save();
    const ys = parts(scene).map((el) => el.box.y);
    expect(ys[1]!).toBeGreaterThan(ys[0]!);
    expect(ys[2]!).toBeGreaterThan(ys[1]!);
    expect(parts(scene).every((el) => el.fill === 'oransje')).toBe(true);
    expect(parts(scene).every((el) => el.box.x === figureIn(scene).box.x)).toBe(true);
    await shot(page, 'm02-prosess-nedover');
    await direction.getByRole('button', { name: 'Bortover' }).click();
    await colour.getByRole('button', { name: 'Malens' }).click();
    scene = await save();
    expect(figureIn(scene).direction).toBeUndefined();
    expect(figureIn(scene).color).toBeUndefined();
    expect(parts(scene).every((el) => el.fill === 'lilla')).toBe(true);
  }, 120_000);

  it('moves and resizes the figure as one, and takes what is written on the slide into the form', async () => {
    let scene = await save();
    const frame = figureIn(scene).box;
    const before = parts(scene);
    // Dragged by one of its boxes, the whole figure moves.
    await dragOnSlide(middle(before[1]!), {
      x: middle(before[1]!).x + 60,
      y: middle(before[1]!).y + 200,
    });
    scene = await save();
    const moved = figureIn(scene).box;
    expect(Math.abs(moved.x - frame.x - 60)).toBeLessThan(4);
    expect(Math.abs(moved.y - frame.y - 200)).toBeLessThan(4);
    expect(parts(scene)[0]!.box.x).toBe(moved.x);
    expect(parts(scene)[0]!.box.y).toBe(moved.y);
    expect(settled(scene)).toBe(true);

    // The frame's corner is dragged in: the figure is laid out anew inside it.
    expect(await heading()).toBe('Figur: Prosess');
    const handle = page.locator('.selection-many .handle[data-handle="m:1,1"]');
    const at = (await handle.boundingBox())!;
    const to = await onScreen(moved.x + moved.w * 0.8, moved.y + moved.h * 1.5);
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
    scene = await save();
    const sized = figureIn(scene).box;
    expect(Math.abs(sized.w - moved.w * 0.8)).toBeLessThan(8);
    expect(Math.abs(sized.h - moved.h * 1.5)).toBeLessThan(8);
    const last = parts(scene)[2]!.box;
    expect(last.x + last.w).toBe(sized.x + sized.w);
    expect(last.h).toBe(sized.h);
    expect(settled(scene)).toBe(true);

    // A double click on a box writes in it, and what is written is in the form afterwards.
    const second = page.locator(`.stage-inner [data-el="${parts(scene)[1]!.id}"]`);
    await second.dblclick();
    await page.waitForSelector('.stage-inner .is-editing');
    await page.keyboard.press('End');
    await page.keyboard.type('2');
    await page.getByRole('button', { name: 'Ferdig' }).click();
    // The one box is what is chosen now: the panel says what it is, and leads back to the form.
    await expect.poll(heading).toBe('Avrundet rektangel: B2');
    expect(await page.locator('.panel-body .hint').first().textContent()).toContain(
      'Dette er en del av en figur (prosess)',
    );
    await page.getByRole('button', { name: 'Vis skjemaet' }).click();
    await expect.poll(heading).toBe('Figur: Prosess');
    expect(await page.getByLabel('Tekst i boks 2').inputValue()).toBe('B2');
    scene = await save();
    expect(figureIn(scene).items.map((item) => item.text)).toEqual(['A', 'B2', 'D']);
  }, 120_000);

  it('gives each box its step, as a student sees it, and is made into a free figure', async () => {
    await page.getByRole('button', { name: 'Ett steg per boks' }).click();
    let scene = await save();
    const boxes = parts(scene);
    const arrows = parts(scene, 'arrow');
    expect(scene.timeline.map((step) => step.actions.map((action) => action.target))).toEqual([
      [boxes[0]!.id],
      [boxes[1]!.id, arrows[1]!.id],
      [boxes[2]!.id, arrows[2]!.id],
    ]);

    const opened = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Forhåndsvis' }).click();
    const player = await opened;
    await player.waitForSelector('.lp-stage .ls-scene');
    const hidden = (id: string): Promise<boolean> =>
      player
        .locator(`.lp-stage [data-el="${id}"]`)
        .evaluate((node) => getComputedStyle(node).visibility === 'hidden');
    expect(await hidden(boxes[0]!.id)).toBe(true);
    await player.keyboard.press('ArrowRight');
    await expect.poll(() => hidden(boxes[0]!.id)).toBe(false);
    expect(await hidden(boxes[1]!.id)).toBe(true);
    await player.keyboard.press('ArrowRight');
    await expect.poll(() => hidden(boxes[1]!.id)).toBe(false);
    await expect.poll(() => hidden(arrows[1]!.id)).toBe(false);
    expect(await hidden(boxes[2]!.id)).toBe(true);
    // The frame of the figure is there, shows nothing, and is in nobody's way.
    const frame = player.locator(`.lp-stage [data-el="${figureIn(scene).id}"]`);
    expect(await frame.textContent()).toBe('');
    expect(await frame.evaluate((node) => getComputedStyle(node).pointerEvents)).toBe('none');
    await shot(player, 'm03-spiller');
    await player.close();

    // Made into a free figure, the form is gone, and the shapes are a group like any other.
    await page.getByRole('button', { name: 'Gjør om til fri figur' }).click();
    await expect.poll(heading).toBe('Gruppe med 5 deler');
    scene = await save();
    expect(scene.elements.some((el) => el.type === 'figure' || el.of !== undefined)).toBe(false);
    expect(scene.elements.filter((el) => el.group !== undefined)).toHaveLength(5);
    expect(scene.timeline).toHaveLength(3);
    const free = scene.elements.filter(
      (el): el is ShapeElement => el.type === 'shape' && el.geometry === 'arrow',
    );
    expect(free.every((el) => el.startAt && el.endAt)).toBe(true);
    // One undo brings the form back.
    await page.getByRole('button', { name: 'Angre' }).click();
    scene = await save();
    expect(figureIn(scene).items).toHaveLength(3);
    expect(parts(scene).map((el) => el.id)).toEqual(boxes.map((el) => el.id));
  }, 120_000);

  it('puts in layers and a comparison, each with its own form', async () => {
    await page.locator('.scene-item').nth(1).click();
    await page.waitForSelector('.stage-inner .ls-el-text');
    await insertFigure('Lagvis oppbygging');
    await expect.poll(() => onStage().count()).toBe(3);
    expect(await heading()).toBe('Figur: Lagvis oppbygging');
    for (const [index, text] of ['A', 'B', 'C'].entries()) {
      await page.getByLabel(`Tekst i lag ${index + 1}`).fill(text);
    }
    expect(await page.getByRole('button', { name: 'Legg til lag' }).count()).toBe(1);
    expect(await page.locator('fieldset.segmented', { hasText: 'Retning' }).count()).toBe(0);
    let scene = await save(1);
    const layers = parts(scene);
    expect(said(layers)).toEqual(['A', 'B', 'C']);
    expect(layers[1]!.box.y).toBe(layers[0]!.box.y + layers[0]!.box.h);
    expect(new Set(layers.map((el) => el.fill)).size).toBe(3);
    await shot(page, 'm04-lag');

    await page.locator('.scene-item').nth(2).click();
    await page.waitForSelector('.stage-inner .ls-el-text');
    await insertFigure('Sammenligning');
    await expect.poll(() => onStage().count()).toBe(4);
    await page.getByLabel('Overskrift i kolonne 1').fill('A');
    await page.getByLabel('Punkter i kolonne 1').fill('En\nTo');
    await page.getByLabel('Overskrift i kolonne 2').fill('B');
    await page.getByLabel('Punkter i kolonne 2').fill('Tre');
    await page.getByRole('button', { name: 'Legg til kolonne' }).click();
    await page.getByLabel('Overskrift i kolonne 3').fill('C');
    await expect.poll(() => onStage().count()).toBe(6);
    scene = await save(2);
    expect(said(parts(scene, 'head'))).toEqual(['A', 'B', 'C']);
    expect(said(parts(scene, 'body'))).toEqual(['En\nTo', 'Tre', '']);
    expect(parts(scene, 'body')[0]!.content!.paragraphs.every((p) => p.list === 'bullet')).toBe(
      true,
    );
    expect(settled(scene)).toBe(true);
    await shot(page, 'm05-sammenligning');

    // Deleted as a whole, nothing of it is left.
    expect(await heading()).toBe('Figur: Sammenligning');
    await page.locator('.panel-body').getByRole('button', { name: 'Slett' }).click();
    scene = await save(2);
    expect(scene.elements.map((el) => el.id)).toEqual(['e_tittel_C']);
  }, 120_000);
});
