// Runs the built program end to end for free figures: an arrow put between
// two boxes follows them, an end dragged onto a box is fastened to it,
// several elements are grouped, moved and resized as one, and the parts come
// in at steps the way a student sees them. Needs `npm run build`. The window
// is never shown, and nothing touches the network. The content is test
// content, not subject matter.
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
import { newProject, newScene, richText } from '../src/shared/format/factory';
import type { Box, Project, Scene, ShapeElement } from '../src/shared/format/schema';
import {
  LINE_GAP,
  followFigures,
  lineEnds,
  setLineEnds,
  unionBox,
} from '../src/shared/layout/groups';
import { OFFLINE } from './fixtures/offline';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
const packaged = process.env.LYSARK_APP;
const shots = process.env.LYSARK_SHOTS;

const BOXES: Record<string, Box> = {
  e_a: { x: 300, y: 400, w: 240, h: 120, rotation: 0 },
  e_b: { x: 800, y: 400, w: 240, h: 120, rotation: 0 },
  e_c: { x: 1300, y: 400, w: 240, h: 120, rotation: 0 },
};

describe.skipIf(!built)('free figures, end to end', () => {
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
    // Something else is changed first, so there is always something to save.
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
    const project = JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;
    return project.scenes[0]!;
  };
  const shape = (scene: Scene, id: string): ShapeElement =>
    scene.elements.find((el) => el.id === id) as ShapeElement;
  const arrows = (scene: Scene): ShapeElement[] =>
    scene.elements.filter(
      (el): el is ShapeElement => el.type === 'shape' && el.geometry === 'arrow',
    );
  /** A point on the slide (in stage pixels) as a point on the screen. */
  const onScreen = async (x: number, y: number): Promise<{ x: number; y: number }> => {
    const slide = (await page.locator('.stage-inner').boundingBox())!;
    const scale = slide.width / 1920;
    return { x: slide.x + x * scale, y: slide.y + y * scale };
  };
  /** Drags from one point of the slide to another. Alt keeps what is dragged off the grid, and an end unfastened. */
  const dragOnSlide = async (
    from: { x: number; y: number },
    to: { x: number; y: number },
    alt: boolean,
  ): Promise<void> => {
    const a = await onScreen(from.x, from.y);
    const b = await onScreen(to.x, to.y);
    if (alt) await page.keyboard.down('Alt');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
    if (alt) await page.keyboard.up('Alt');
  };
  /** Drags a handle, by its middle, to a point on the slide. */
  const dragHandle = async (
    handle: Locator,
    to: { x: number; y: number },
    alt = false,
  ): Promise<void> => {
    const box = (await handle.boundingBox())!;
    const target = await onScreen(to.x, to.y);
    if (alt) await page.keyboard.down('Alt');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 6 });
    await page.mouse.up();
    if (alt) await page.keyboard.up('Alt');
  };
  const el = (id: string): Locator => page.locator(`.stage-inner [data-el="${id}"]`);
  /** A click on the slide where nothing lies: nothing is chosen after it. */
  const chooseNothing = async (): Promise<void> => {
    const empty = await onScreen(1800, 1000);
    await page.mouse.click(empty.x, empty.y);
  };
  const heading = (): Promise<string | null> =>
    page.locator('.panel-body h3').first().textContent();
  const middle = (box: Box): { x: number; y: number } => ({
    x: box.x + box.w / 2,
    y: box.y + box.h / 2,
  });
  /** True when every fastened line of the slide lies where its elements say it should. */
  const linesInPlace = (scene: Scene): boolean => !followFigures(structuredClone(scene));

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-figurer-'));
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
    for (const [id, box] of Object.entries(BOXES)) {
      scene.elements.push({
        id,
        type: 'shape',
        geometry: id === 'e_c' ? 'ellipse' : 'rect',
        fill: 'lilla',
        content: richText(id.slice(-1).toUpperCase()),
        box,
      });
    }
    // An arrow that is fastened to nothing, lying by itself under the boxes.
    const free: ShapeElement = {
      id: 'e_fri',
      type: 'shape',
      geometry: 'arrow',
      box: { x: 0, y: 0, w: 1, h: 1, rotation: 0 },
    };
    setLineEnds(free, { x: 500, y: 900 }, { x: 800, y: 800 });
    scene.elements.push(free);
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
    await page.waitForSelector('.stage-inner .ls-el-shape');
  }, 60_000);

  afterAll(async () => {
    await app
      ?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.destroy()))
      .catch(() => undefined);
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('puts an arrow between two boxes, and the arrow follows them', async () => {
    await el('e_a').click();
    await el('e_b').click({ modifiers: ['Shift'] });
    expect(await heading()).toBe('2 elementer valgt');
    await page.getByRole('button', { name: 'Sett pil mellom dem' }).click();
    // The new arrow is what is chosen, and the panel says what it is fastened to.
    await expect.poll(heading).toBe('Pil');
    const fastened = page.locator('.fastened-list li');
    expect(await fastened.allTextContents()).toEqual([
      'Starten: Rektangel: ALøsne',
      'Spissen: Rektangel: BLøsne',
    ]);
    expect(await page.locator('.fasten-target').count()).toBe(2);
    expect(await page.locator('.handle-fastened').count()).toBe(2);
    let scene = await save();
    const arrow = arrows(scene).find((a) => a.startAt === 'e_a')!;
    expect(arrow.endAt).toBe('e_b');
    // From the right edge of A to the left edge of B.
    expect(lineEnds(arrow).start.x).toBe(540 + LINE_GAP);
    expect(lineEnds(arrow).end.x).toBe(800 - LINE_GAP);
    await shot(page, 'g01-pil-mellom');

    // B is dragged down and to the left: the arrow goes with it, and still points at it.
    await dragOnSlide(middle(BOXES.e_b!), { x: 700, y: 820 }, true);
    scene = await save();
    const moved = shape(scene, 'e_b').box;
    expect(Math.abs(moved.x + moved.w / 2 - 700)).toBeLessThan(4);
    expect(Math.abs(moved.y + moved.h / 2 - 820)).toBeLessThan(4);
    const after = shape(scene, arrow.id);
    expect(after.endAt).toBe('e_b');
    expect(linesInPlace(scene)).toBe(true);
    // Its head is at the top of B now, and its tail at the bottom of A.
    expect(lineEnds(after).end.y).toBe(moved.y - LINE_GAP);
    expect(lineEnds(after).start.y).toBe(520 + LINE_GAP);
    // The drag is one thing to undo, and undoing it puts both back.
    await page.getByRole('button', { name: 'Angre' }).click();
    scene = await save();
    expect(shape(scene, 'e_b').box).toEqual(BOXES.e_b);
    expect(shape(scene, arrow.id).box).toEqual(arrow.box);
    expect(shape(scene, arrow.id).endAt).toBe('e_b');
  }, 90_000);

  it('fastens an end that is let go on a box, and lets it go when it is dragged off', async () => {
    // The arrow that lies by itself is chosen by a click on it.
    await chooseNothing();
    const at = await onScreen(650, 850);
    await page.mouse.click(at.x, at.y);
    await expect.poll(heading).toBe('Pil');
    expect(await page.locator('.group', { hasText: 'Festet til' }).textContent()).toContain(
      'Dra en ende av pila inn på en boks',
    );
    const end = page.locator('.handle[data-handle="end"]');
    await dragHandle(end, middle(BOXES.e_c!));
    let scene = await save();
    let free = shape(scene, 'e_fri');
    expect(free.endAt).toBe('e_c');
    expect(free.startAt).toBeUndefined();
    expect(lineEnds(free).start).toEqual({ x: 500, y: 900 });
    expect(linesInPlace(scene)).toBe(true);
    // C is an ellipse: the head is on its round edge, not at the middle where it was let go.
    const head = lineEnds(free).end;
    const c = BOXES.e_c!;
    const onEdge =
      ((head.x - (c.x + c.w / 2)) / (c.w / 2 + LINE_GAP)) ** 2 +
      ((head.y - (c.y + c.h / 2)) / (c.h / 2 + LINE_GAP)) ** 2;
    expect(Math.abs(onEdge - 1)).toBeLessThan(0.06);
    expect(await page.locator('.handle-fastened').count()).toBe(1);
    expect(await page.locator('.fastened-list li').allTextContents()).toEqual([
      'Spissen: Ellipse: CLøsne',
    ]);
    await shot(page, 'g02-festet-ende');

    // Dragged off to where nothing lies, the end is free again and stays where it was put.
    await dragHandle(end, { x: 1500, y: 900 });
    scene = await save();
    free = shape(scene, 'e_fri');
    expect(free.endAt).toBeUndefined();
    expect(Math.abs(lineEnds(free).end.x - 1500)).toBeLessThan(4);
    expect(Math.abs(lineEnds(free).end.y - 900)).toBeLessThan(4);

    // With Alt held down an end is not fastened, though it is let go on a box.
    await dragHandle(end, middle(BOXES.e_c!), true);
    scene = await save();
    expect(shape(scene, 'e_fri').endAt).toBeUndefined();

    // Fastened again, and let go with the button in the panel.
    await dragHandle(end, { x: 1500, y: 900 });
    await dragHandle(end, middle(BOXES.e_c!));
    await page.getByRole('button', { name: 'Løsne spissen' }).click();
    scene = await save();
    expect(shape(scene, 'e_fri').endAt).toBeUndefined();
    await page.getByRole('button', { name: 'Angre' }).click();
    scene = await save();
    expect(shape(scene, 'e_fri').endAt).toBe('e_c');
  }, 90_000);

  it('groups elements, which are then chosen, moved and resized as one', async () => {
    // Everything but the heading is chosen, and made into a group.
    await chooseNothing();
    await el('e_a').click();
    await page.keyboard.press('Control+a');
    await el('e_tittel').click({ modifiers: ['Shift'], position: { x: 20, y: 20 } });
    expect(await heading()).toBe('5 elementer valgt');
    await page.locator('.panel-body').getByRole('button', { name: 'Grupper' }).click();
    await expect.poll(heading).toBe('Gruppe med 5 deler');
    let scene = await save();
    const group = shape(scene, 'e_a').group!;
    expect(group).toBeTruthy();
    expect(scene.elements.filter((e) => e.group === group)).toHaveLength(5);
    expect(shape(scene, 'e_tittel').group).toBeUndefined();

    // A click on one part chooses the whole group, with one frame round it.
    await chooseNothing();
    expect(await page.locator('.selection').count()).toBe(0);
    await el('e_b').click();
    await expect.poll(heading).toBe('Gruppe med 5 deler');
    expect(await page.locator('.selection-many').count()).toBe(1);
    expect(await page.locator('.selection:not(.selection-many)').count()).toBe(3);
    await shot(page, 'g03-gruppe');

    // Dragged by one part, all of it moves, and the arrows stay fastened.
    const before = new Map(scene.elements.map((e) => [e.id, e.box]));
    await dragOnSlide(middle(BOXES.e_b!), { x: middle(BOXES.e_b!).x + 80, y: 300 }, true);
    scene = await save();
    const by = {
      x: shape(scene, 'e_b').box.x - BOXES.e_b!.x,
      y: shape(scene, 'e_b').box.y - BOXES.e_b!.y,
    };
    expect(Math.abs(by.x - 80)).toBeLessThan(4);
    expect(Math.abs(by.y + 160)).toBeLessThan(4);
    for (const part of scene.elements.filter((e) => e.group === group)) {
      const was = before.get(part.id)!;
      expect(Math.abs(part.box.x - was.x - by.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(part.box.y - was.y - by.y)).toBeLessThanOrEqual(2);
    }
    expect(shape(scene, 'e_tittel').box).toEqual(before.get('e_tittel'));
    expect(arrows(scene).map((a) => [a.startAt, a.endAt])).toEqual([
      [undefined, 'e_c'],
      ['e_a', 'e_b'],
    ]);
    expect(linesInPlace(scene)).toBe(true);

    // The frame's corner is dragged out: everything in the group grows, and keeps its place in it.
    const frame = unionBox(scene.elements.filter((e) => e.group === group).map((e) => e.box));
    const a = shape(scene, 'e_a').box;
    await dragHandle(page.locator('.selection-many .handle[data-handle="m:1,1"]'), {
      x: frame.x + frame.w * 1.2,
      y: frame.y + frame.h * 1.2,
    });
    scene = await save();
    const grown = shape(scene, 'e_a').box;
    expect(Math.abs(grown.w - a.w * 1.2)).toBeLessThan(6);
    expect(Math.abs(grown.h - a.h * 1.2)).toBeLessThan(6);
    // The corner opposite the one that was dragged stayed where it was.
    expect(Math.abs(grown.x - a.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(grown.y - a.y)).toBeLessThanOrEqual(2);
    expect(linesInPlace(scene)).toBe(true);

    // A click on a part of the group that is chosen goes into it: only that part is chosen.
    await el('e_a').click();
    await expect.poll(heading).toBe('Rektangel: A');
    const panel = page.locator('.group', { hasText: 'Dette er en del av en gruppe med 5 deler' });
    await panel.getByRole('button', { name: 'Velg hele gruppen' }).click();
    await expect.poll(heading).toBe('Gruppe med 5 deler');

    // A double click on a part of the group writes in that part, as on any other shape.
    await el('e_b').dblclick();
    await page.waitForSelector('.stage-inner [data-el="e_b"] .is-editing');
    await page.keyboard.type('B');
    await page.getByRole('button', { name: 'Ferdig' }).click();
    await expect.poll(() => el('e_b').textContent()).toBe('BB');
    scene = await save();
    expect(shape(scene, 'e_b').group).toBe(group);
    await el('e_a').click();
    await page.getByRole('button', { name: 'Velg hele gruppen' }).click();
    await expect.poll(heading).toBe('Gruppe med 5 deler');
  }, 120_000);

  it('gives each part its step, and a student sees a box come in with its arrow', async () => {
    await page.locator('.panel-body').getByRole('button', { name: 'Ett steg per del' }).click();
    let scene = await save();
    const between = arrows(scene).find((a) => a.startAt === 'e_a')!;
    expect(scene.timeline.map((step) => step.actions.map((action) => action.target))).toEqual([
      ['e_a'],
      ['e_b', between.id],
      ['e_c', 'e_fri'],
    ]);

    const opened = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Forhåndsvis' }).click();
    const player = await opened;
    await player.waitForSelector('.lp-stage .ls-scene');
    const hidden = (id: string): Promise<boolean> =>
      player
        .locator(`.lp-stage [data-el="${id}"]`)
        .evaluate((node) => getComputedStyle(node).visibility === 'hidden');
    // Only the heading is there at first.
    expect(await hidden('e_tittel')).toBe(false);
    expect(await hidden('e_a')).toBe(true);
    await player.keyboard.press('ArrowRight');
    await expect.poll(() => hidden('e_a')).toBe(false);
    expect(await hidden('e_b')).toBe(true);
    expect(await hidden(between.id)).toBe(true);
    await player.keyboard.press('ArrowRight');
    await expect.poll(() => hidden('e_b')).toBe(false);
    await expect.poll(() => hidden(between.id)).toBe(false);
    expect(await hidden('e_c')).toBe(true);
    // The arrow is drawn where the editor laid it: between the two boxes.
    const edges = await player.evaluate(
      ([from, to, line]) => {
        const rect = (id: string): DOMRect =>
          document.querySelector(`.lp-stage [data-el="${id}"]`)!.getBoundingClientRect();
        return { from: rect(from!), to: rect(to!), line: rect(line!) };
      },
      ['e_a', 'e_b', between.id],
    );
    expect(edges.line.left).toBeGreaterThan(edges.from.left);
    expect(edges.line.right).toBeLessThan(edges.to.right);
    await shot(player, 'g04-spiller');
    await player.close();

    // Broken up, the parts are single elements again; the arrows are still fastened.
    await page.locator('.panel-body').getByRole('button', { name: 'Del opp gruppen' }).click();
    await expect.poll(heading).toBe('5 elementer valgt');
    scene = await save();
    expect(scene.elements.some((e) => e.group !== undefined)).toBe(false);
    expect(shape(scene, between.id).endAt).toBe('e_b');
    expect(scene.timeline).toHaveLength(3);

    // The same from the menu that a right click gives.
    await el('e_a').click({ button: 'right' });
    await page.locator('.context-menu').getByRole('menuitem', { name: 'Grupper' }).click();
    await expect.poll(heading).toBe('Gruppe med 5 deler');
    await el('e_a').click({ button: 'right' });
    expect(await page.locator('.context-menu').getByRole('menuitem').allTextContents()).toContain(
      'Del opp gruppen',
    );
    await page.keyboard.press('Escape');
    scene = await save();
    expect(scene.elements.filter((e) => e.group !== undefined)).toHaveLength(5);
  }, 120_000);
});
