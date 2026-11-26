// Runs the built program end to end for lines that bend and are fastened:
// a line is bent by dragging the middle of it, an end dragged near a box
// takes one of its fastening points, an end dragged onto another line is
// fastened to it (a T-junction), and when the box and the lines are moved
// the ends follow. Once on a lying slide and once on an upright one. Needs
// `npm run build`. The window is never shown, and nothing touches the
// network. The content is test content, not subject matter.
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
import { stageOf } from '../src/shared/format/constants';
import type { Box, Project, Scene, ShapeElement } from '../src/shared/format/schema';
import {
  LINE_GAP,
  followFigures,
  lineEnds,
  linePath,
  nearestOnPath,
  setLineEnds,
} from '../src/shared/layout/groups';
import { OFFLINE } from './fixtures/offline';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
const packaged = process.env.LYSARK_APP;
const shots = process.env.LYSARK_SHOTS;

// Everything stands where it fits on both shapes of slide.
const BOXES: Record<string, Box> = {
  e_a: { x: 150, y: 250, w: 240, h: 120, rotation: 0 },
  e_b: { x: 650, y: 500, w: 240, h: 120, rotation: 0 },
};

describe.skipIf(!built).each([
  ['lying', undefined],
  ['upright', 'portrait' as const],
])('lines that bend and are fastened, on a %s slide', (name, orientation) => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;
  const tag = name === 'lying' ? 'l' : 'u';

  const shot = async (target: Page, file: string): Promise<void> => {
    if (!shots) return;
    mkdirSync(shots, { recursive: true });
    await target.screenshot({ path: join(shots, `${tag}-${file}.png`) });
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
  const shape = (scene: Scene, id: string): ShapeElement =>
    scene.elements.find((el) => el.id === id) as ShapeElement;
  const onScreen = async (x: number, y: number): Promise<{ x: number; y: number }> => {
    const slide = (await page.locator('.stage-inner').boundingBox())!;
    const scale = slide.width / stageOf({ orientation }).width;
    return { x: slide.x + x * scale, y: slide.y + y * scale };
  };
  /** Presses on a handle and moves it to a point on the slide; lets go unless told not to. */
  const dragHandle = async (
    handle: Locator,
    to: { x: number; y: number },
    options: { alt?: boolean; hold?: boolean } = {},
  ): Promise<void> => {
    const box = (await handle.boundingBox())!;
    const target = await onScreen(to.x, to.y);
    if (options.alt) await page.keyboard.down('Alt');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    if (options.hold) return;
    await page.mouse.up();
    if (options.alt) await page.keyboard.up('Alt');
  };
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
  const clickOnSlide = async (x: number, y: number, shift = false): Promise<void> => {
    const slide = (await page.locator('.stage-inner').boundingBox())!;
    const scale = slide.width / stageOf({ orientation }).width;
    await page.locator('.stage-inner').click({
      position: { x: x * scale, y: y * scale },
      modifiers: shift ? ['Shift'] : [],
      force: true,
    });
  };
  const chooseNothing = async (): Promise<void> => {
    const stage = stageOf({ orientation });
    await clickOnSlide(stage.width - 40, stage.height - 40);
  };
  const heading = (): Promise<string | null> =>
    page.locator('.panel-body h3').first().textContent();
  const linesInPlace = (scene: Scene): boolean => !followFigures(structuredClone(scene));
  const near = (p: { x: number; y: number }, q: { x: number; y: number }, by = 4): boolean =>
    Math.abs(p.x - q.x) <= by && Math.abs(p.y - q.y) <= by;

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-streker-'));
    projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    const project = newProject('Testforelesning');
    if (orientation) project.orientation = orientation;
    const scene = newScene('content', 'Lysark A');
    scene.showLogo = false;
    for (const [id, box] of Object.entries(BOXES)) {
      scene.elements.push({
        id,
        type: 'shape',
        geometry: 'rect',
        fill: 'lilla',
        content: richText(id.slice(-1).toUpperCase()),
        box,
      });
    }
    // An arrow lying by itself, and a line under it.
    const arrow: ShapeElement = {
      id: 'e_pil',
      type: 'shape',
      geometry: 'arrow',
      box: { x: 0, y: 0, w: 1, h: 1, rotation: 0 },
    };
    setLineEnds(arrow, { x: 200, y: 800 }, { x: 800, y: 800 });
    const branch: ShapeElement = {
      id: 'e_strek',
      type: 'shape',
      geometry: 'line',
      box: { x: 0, y: 0, w: 1, h: 1, rotation: 0 },
    };
    setLineEnds(branch, { x: 300, y: 1000 }, { x: 600, y: 950 });
    scene.elements.push(arrow, branch);
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

  it('bends a line where the middle of it is dragged, and straightens it again', async () => {
    await clickOnSlide(500, 800);
    await expect.poll(heading).toBe('Pil');
    expect(await page.locator('.panel-body').textContent()).toContain(
      'Dra i midten av streken for å bøye den.',
    );
    expect(await page.getByRole('button', { name: 'Rett ut streken' }).count()).toBe(0);
    await dragHandle(page.locator('.handle-mid[data-handle="mid:0"]'), { x: 500, y: 620 }, {
      alt: true,
    });
    let scene = await save();
    let arrow = shape(scene, 'e_pil');
    let path = linePath(arrow);
    expect(path).toHaveLength(3);
    expect(near(path[0]!, { x: 200, y: 800 }, 1)).toBe(true);
    expect(near(path[1]!, { x: 500, y: 620 })).toBe(true);
    expect(near(path[2]!, { x: 800, y: 800 }, 1)).toBe(true);
    // The chosen line shows its ends, its point, and a paler handle in the middle of each stretch.
    expect(await page.locator('.handle[data-handle="start"]').count()).toBe(1);
    expect(await page.locator('.handle-point').count()).toBe(1);
    expect(await page.locator('.handle-mid').count()).toBe(2);
    await shot(page, 'l01-boyd-pil');

    // A double click on the line puts a point there, and one on a point takes it away.
    const second = { x: (path[1]!.x + path[2]!.x) / 2, y: (path[1]!.y + path[2]!.y) / 2 };
    const at = await onScreen(second.x, second.y);
    await page.mouse.dblclick(at.x, at.y);
    scene = await save();
    expect(linePath(shape(scene, 'e_pil'))).toHaveLength(4);
    const point = page.locator('.handle-point[data-handle="p:2"]');
    const pointBox = (await point.boundingBox())!;
    await page.mouse.dblclick(pointBox.x + pointBox.width / 2, pointBox.y + pointBox.height / 2);
    scene = await save();
    expect(linePath(shape(scene, 'e_pil'))).toHaveLength(3);
    const bent = linePath(shape(scene, 'e_pil'));

    // «Rett ut streken» takes the points away; «Angre» brings them back.
    await page.getByRole('button', { name: 'Rett ut streken' }).click();
    scene = await save();
    expect(shape(scene, 'e_pil').points).toBeUndefined();
    await page.getByRole('button', { name: 'Angre' }).click();
    scene = await save();
    arrow = shape(scene, 'e_pil');
    path = linePath(arrow);
    expect(path).toEqual(bent);
  }, 120_000);

  it('fastens an end to a fastening point of a box, showing the four points as it comes near', async () => {
    const a = BOXES.e_a!;
    const top = { x: a.x + a.w / 2, y: a.y };
    await dragHandle(page.locator('.handle[data-handle="start"]'), { x: top.x + 4, y: top.y - 4 }, {
      hold: true,
    });
    // Four small dots on the box; the one it will take is filled.
    await expect.poll(() => page.locator('.fasten-dot').count()).toBe(4);
    expect(await page.locator('.fasten-dot.is-chosen').count()).toBe(1);
    await shot(page, 'l02-festepunkter');
    await page.mouse.up();
    let scene = await save();
    const arrow = shape(scene, 'e_pil');
    expect(arrow.startAt).toBe('e_a');
    expect(arrow.startSide).toBe('top');
    expect(lineEnds(arrow).start).toEqual({ x: top.x, y: top.y - LINE_GAP });
    expect(await page.locator('.fasten-dot').count()).toBe(0);
    expect(await page.locator('.fastened-list li').first().textContent()).toContain(
      'Starten: Rektangel: A, festepunktet oppe',
    );
    // Let go on the box away from its dots, the end is fastened to the box by itself.
    const b = BOXES.e_b!;
    await dragHandle(page.locator('.handle[data-handle="end"]'), { x: b.x + 40, y: b.y + 30 });
    scene = await save();
    expect(shape(scene, 'e_pil').endAt).toBe('e_b');
    expect(shape(scene, 'e_pil').endSide).toBeUndefined();
    expect(linesInPlace(scene)).toBe(true);
  }, 120_000);

  it('fastens an end of one line to another line: a T-junction', async () => {
    await chooseNothing();
    await clickOnSlide(450, 975);
    await expect.poll(heading).toBe('Strek');
    let scene = await save();
    const arrowPath = linePath(shape(scene, 'e_pil'));
    // The middle of the first stretch of the arrow.
    const target = {
      x: (arrowPath[0]!.x + arrowPath[1]!.x) / 2 + 3,
      y: (arrowPath[0]!.y + arrowPath[1]!.y) / 2 + 2,
    };
    await dragHandle(page.locator('.handle[data-handle="end"]'), target, { hold: true });
    // The other line is lit, and a mark shows the place.
    await expect.poll(() => page.locator('.snap-line').count()).toBe(1);
    expect(await page.locator('.snap-place').count()).toBe(1);
    await page.mouse.up();
    scene = await save();
    const branch = shape(scene, 'e_strek');
    expect(branch.endAt).toBe('e_pil');
    expect(branch.endAlong).toBeGreaterThan(0);
    expect(branch.endAlong).toBeLessThan(0.5);
    const on = nearestOnPath(linePath(shape(scene, 'e_pil')), lineEnds(branch).end);
    expect(on.distance).toBeLessThan(1);
    expect(await page.locator('.fastened-list li').first().textContent()).toContain(
      'Slutten: Pil, et sted langs den',
    );
    await shot(page, 'l03-t-kryss');
  }, 120_000);

  it('moves the ends fastened to a box with it, and keeps a line moved with its box fastened', async () => {
    let scene = await save();
    const before = linePath(shape(scene, 'e_pil'));
    // A is moved by itself: the start of the arrow goes with it, its point stays where it was.
    await chooseNothing();
    const a = BOXES.e_a!;
    // (Taken by its left part: the arrow runs across the middle of it.)
    await dragOnSlide({ x: a.x + 30, y: a.y + a.h / 2 }, { x: a.x + 30, y: a.y + a.h / 2 + 100 });
    scene = await save();
    let arrow = shape(scene, 'e_pil');
    let path = linePath(arrow);
    const movedA = shape(scene, 'e_a').box;
    expect(Math.abs(movedA.y - (a.y + 100))).toBeLessThan(4);
    expect(arrow.startAt).toBe('e_a');
    expect(near(path[0]!, { x: movedA.x + movedA.w / 2, y: movedA.y - LINE_GAP }, 0.01)).toBe(true);
    expect(near(path[1]!, before[1]!, 0.01)).toBe(true);
    // The T-junction followed the arrow.
    let branch = shape(scene, 'e_strek');
    expect(nearestOnPath(path, lineEnds(branch).end).distance).toBeLessThan(1);
    expect(linesInPlace(scene)).toBe(true);

    // A, B and the arrow are moved together: the arrow stays fastened, with its point.
    await clickOnSlide(movedA.x + 20, movedA.y + 20);
    // (B is taken at its far corner: the arrow ends at its near side.)
    await clickOnSlide(BOXES.e_b!.x + BOXES.e_b!.w - 20, BOXES.e_b!.y + 20, true);
    // (The arrow is taken along its last stretch: its point can lie under a handle of the
    // frame round A and B, and the line with the T-junction crosses its first stretch.)
    await clickOnSlide((path[1]!.x * 2 + path[2]!.x) / 3, (path[1]!.y * 2 + path[2]!.y) / 3, true);
    await expect.poll(heading).toBe('3 elementer valgt');
    // (Taken low in A, away from the handles of the frame round all three.)
    await dragOnSlide(
      { x: movedA.x + 40, y: movedA.y + movedA.h - 25 },
      { x: movedA.x + 40, y: movedA.y + movedA.h - 125 },
    );
    scene = await save();
    arrow = shape(scene, 'e_pil');
    const was = path;
    path = linePath(arrow);
    expect(arrow.startAt).toBe('e_a');
    expect(arrow.endAt).toBe('e_b');
    expect(Math.abs(path[1]!.y - (was[1]!.y - 100))).toBeLessThan(4);
    expect(Math.abs(path[1]!.x - was[1]!.x)).toBeLessThan(4);
    branch = shape(scene, 'e_strek');
    expect(branch.endAt).toBe('e_pil');
    expect(nearestOnPath(path, lineEnds(branch).end).distance).toBeLessThan(1);
    expect(linesInPlace(scene)).toBe(true);
    // The line on its own, dragged away, is let go.
    await chooseNothing();
    await clickOnSlide(path[1]!.x, path[1]!.y);
    await expect.poll(heading).toBe('Pil');
    // Taken a quarter of the way along its last stretch, where it has no handle.
    const grip = {
      x: path[1]!.x + (path[2]!.x - path[1]!.x) * 0.25,
      y: path[1]!.y + (path[2]!.y - path[1]!.y) * 0.25,
    };
    await dragOnSlide(grip, { x: grip.x, y: grip.y + 60 });
    scene = await save();
    arrow = shape(scene, 'e_pil');
    expect(arrow.startAt).toBeUndefined();
    expect(arrow.endAt).toBeUndefined();
    expect(linePath(arrow)).toHaveLength(3);
  }, 120_000);
});
