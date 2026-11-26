// Runs the built program end to end for the figure «Nettverk»: a network of
// three nodes and two connections is made in the form, a node is dragged
// on the slide and the connections follow, an arrow is bent, and the end of
// one connection is dragged onto the other (a T-junction). It is then seen
// in «Forhåndsvis», in an exported HTML file and (on a lying slide) in a
// short video measured with FFmpeg. Once on a lying slide and once on an
// upright one. Needs `npm run build`, and FFmpeg in vendor/ffmpeg for the
// video. The window is never shown, and nothing touches the network. The
// content is test content, not subject matter.
import { execFileSync } from 'node:child_process';
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
import { newProject, newScene, plainText } from '../src/shared/format/factory';
import { stageOf } from '../src/shared/format/constants';
import type { FigureElement, Project, Scene, ShapeElement } from '../src/shared/format/schema';
import { followFigures, lineEnds, linePath, nearestOnPath } from '../src/shared/layout/groups';
import { followTemplates } from '../src/shared/layout/templates';
import { EXPORT_TEST, EXPORT_WAIT } from './fixtures/limits';
import { OFFLINE } from './fixtures/offline';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
const packaged = process.env.LYSARK_APP;
const shots = process.env.LYSARK_SHOTS;
const ffmpeg =
  process.env.LYSARK_FFMPEG ??
  join(
    root,
    'vendor/ffmpeg',
    `${process.platform}-${process.arch}`,
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
  );

type Point = { x: number; y: number };

describe.skipIf(!built).each([
  ['lying', undefined],
  ['upright', 'portrait' as const],
])('the figure «Nettverk», on a %s slide', (name, orientation) => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;
  const tag = name === 'lying' ? 'l' : 'u';
  const stage = stageOf({ orientation });
  /** The point the arrow is bent through, where the video is measured. */
  let bend: Point;
  let straightMiddle: Point;

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
  const answerSaveDialog = (file: string): Promise<void> =>
    app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: path });
    }, file);
  const figureOf = (scene: Scene): FigureElement =>
    scene.elements.find((el) => el.type === 'figure') as FigureElement;
  const node = (scene: Scene, text: string): ShapeElement => {
    const figure = figureOf(scene);
    const item = figure.items.find((one) => one.text === text)!;
    return scene.elements.find((el) => el.of?.part === `node:${item.id}`) as ShapeElement;
  };
  const link = (scene: Scene, index: number): ShapeElement => {
    const figure = figureOf(scene);
    return scene.elements.find(
      (el) => el.of?.part === `link:${figure.links![index]!.id}`,
    ) as ShapeElement;
  };
  const middle = (el: ShapeElement): Point => ({
    x: el.box.x + el.box.w / 2,
    y: el.box.y + el.box.h / 2,
  });
  const settled = (scene: Scene): boolean => {
    const copy = structuredClone(scene);
    return !followTemplates(copy) && !followFigures(copy);
  };
  const onScreen = async (p: Point): Promise<Point> => {
    const slide = (await page.locator('.stage-inner').boundingBox())!;
    const scale = slide.width / stage.width;
    return { x: slide.x + p.x * scale, y: slide.y + p.y * scale };
  };
  const clickOnSlide = async (p: Point): Promise<void> => {
    const at = await onScreen(p);
    await page.mouse.click(at.x, at.y);
  };
  const dragOnSlide = async (from: Point, to: Point): Promise<void> => {
    const a = await onScreen(from);
    const b = await onScreen(to);
    await page.keyboard.down('Alt');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up('Alt');
  };
  const dragHandle = async (handle: Locator, to: Point, alt = false): Promise<void> => {
    const box = (await handle.boundingBox())!;
    const target = await onScreen(to);
    if (alt) await page.keyboard.down('Alt');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.mouse.up();
    if (alt) await page.keyboard.up('Alt');
  };
  const heading = (): Promise<string | null> =>
    page.locator('.panel-body h3').first().textContent();
  /** A part of the figure is chosen by itself: the first click chooses the whole figure, the next goes into it. */
  const choosePart = async (p: Point, expected: string): Promise<void> => {
    await clickOnSlide({ x: stage.width - 30, y: stage.height - 30 });
    await clickOnSlide(p);
    await expect.poll(heading).toBe('Figur: Nettverk');
    await clickOnSlide(p);
    await expect.poll(heading).toBe(expected);
  };

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-nettverk-'));
    projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    const project = newProject('Testforelesning');
    if (orientation) project.orientation = orientation;
    const scene = newScene('content', 'Lysark A');
    scene.showLogo = false;
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
  }, 60_000);

  afterAll(async () => {
    await app
      ?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.destroy()))
      .catch(() => undefined);
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('makes a network of three nodes and two connections in the form', async () => {
    await page.locator('.insertbar').getByRole('button', { name: 'Figur' }).click();
    await page.locator('.insertbar .menu').getByRole('menuitem', { name: 'Nettverk' }).click();
    await expect.poll(heading).toBe('Figur: Nettverk');
    // A new network is empty, and says so.
    expect(await page.locator('.stage-inner .ls-figure-empty').count()).toBe(1);
    expect(await page.getByRole('button', { name: 'Legg til kobling' }).isDisabled()).toBe(true);
    for (const [i, text] of ['A', 'B', 'C'].entries()) {
      await page.getByRole('button', { name: 'Legg til node' }).click();
      await page.getByLabel(`Tekst i node ${i + 1}`).fill(text);
    }
    await page.getByRole('button', { name: 'Legg til kobling' }).click();
    await page.getByRole('button', { name: 'Legg til kobling' }).click();
    // The first is A to B, made an arrow; the second runs from B to C.
    const rows = page.locator('.network-links li');
    await rows.nth(0).getByRole('button', { name: 'Pil' }).click();
    await page.getByLabel('Fra i kobling 2').selectOption({ label: 'B' });
    await page.getByLabel('Til i kobling 2').selectOption({ label: 'C' });
    const scene = await save();
    const figure = figureOf(scene);
    expect(figure.items.map((item) => item.text)).toEqual(['A', 'B', 'C']);
    expect(figure.links).toHaveLength(2);
    expect(figure.links![0]!.arrow).toBe(true);
    const nodes = ['A', 'B', 'C'].map((text) => node(scene, text));
    expect(nodes.map((el) => plainText(el.content!))).toEqual(['A', 'B', 'C']);
    for (const el of nodes) {
      expect(el.box.x).toBeGreaterThanOrEqual(figure.box.x);
      expect(el.box.x + el.box.w).toBeLessThanOrEqual(figure.box.x + figure.box.w);
    }
    expect(link(scene, 0).geometry).toBe('arrow');
    expect([link(scene, 0).startAt, link(scene, 0).endAt]).toEqual([nodes[0]!.id, nodes[1]!.id]);
    expect([link(scene, 1).startAt, link(scene, 1).endAt]).toEqual([nodes[1]!.id, nodes[2]!.id]);
    expect(settled(scene)).toBe(true);
    // «Ordne nodene» lays them out: in layers by the arrow, or in a ring.
    await page.getByRole('button', { name: 'Ordne nodene' }).click();
    expect(settled(await save())).toBe(true);
  }, 120_000);

  it('drags a node on the slide, and the connections follow; the form does not move it back', async () => {
    let scene = await save();
    const c = node(scene, 'C');
    const from = { x: c.box.x + 20, y: c.box.y + 20 };
    await choosePart(from, 'Avrundet rektangel: C');
    expect(await page.locator('.panel-body').textContent()).toContain('Dette er en node i et nettverk.');
    const to = { x: from.x, y: Math.min(stage.height - 200, from.y + 220) };
    await dragOnSlide(from, to);
    scene = await save();
    const moved = node(scene, 'C');
    expect(Math.abs(moved.box.y - c.box.y - (to.y - from.y))).toBeLessThan(4);
    expect(link(scene, 1).endAt).toBe(moved.id);
    expect(settled(scene)).toBe(true);
    // A change in the form leaves it where the lecturer put it.
    await page.getByRole('button', { name: 'Vis skjemaet' }).click();
    await expect.poll(heading).toBe('Figur: Nettverk');
    await page.getByLabel('Tekst i node 1').fill('AA');
    await page.getByLabel('Tekst i node 1').fill('A');
    scene = await save();
    expect(node(scene, 'C').box).toEqual(moved.box);
  }, 120_000);

  it('bends the arrow, and makes a T-junction where one connection ends on the other', async () => {
    let scene = await save();
    let arrow = link(scene, 0);
    let path = linePath(arrow);
    const grip = { x: path[0]!.x + (path[1]!.x - path[0]!.x) * 0.3, y: path[0]!.y + (path[1]!.y - path[0]!.y) * 0.3 };
    await choosePart(grip, 'Pil');
    expect(await page.locator('.panel-body').textContent()).toContain('Dette er en kobling i et nettverk.');
    // Bent by dragging the middle of it, away from the nodes.
    straightMiddle = { x: (path[0]!.x + path[1]!.x) / 2, y: (path[0]!.y + path[1]!.y) / 2 };
    const length = Math.hypot(path[1]!.x - path[0]!.x, path[1]!.y - path[0]!.y);
    const normal = { x: -(path[1]!.y - path[0]!.y) / length, y: (path[1]!.x - path[0]!.x) / length };
    const target = {
      // Far enough that both stretches are long, and inside the slide.
      x: Math.round(Math.min(stage.width - 60, Math.max(60, straightMiddle.x + normal.x * 260))),
      y: Math.round(Math.min(stage.height - 60, Math.max(60, straightMiddle.y + normal.y * 260))),
    };
    await dragHandle(page.locator('.handle-mid[data-handle="mid:0"]'), target, true);
    scene = await save();
    arrow = link(scene, 0);
    path = linePath(arrow);
    expect(path).toHaveLength(3);
    bend = path[1]!;
    expect(Math.hypot(bend.x - target.x, bend.y - target.y)).toBeLessThan(4);
    await shot(page, 'n01-boyd-pil');

    // The start of B to C is dragged onto the arrow: a T-junction.
    const second = link(scene, 1);
    // The place on the arrow farthest from every node.
    const boxes = ['A', 'B', 'C'].map((text) => node(scene, text).box);
    const away = (p: Point): number =>
      Math.min(
        ...boxes.map((b) =>
          Math.hypot(
            Math.max(b.x - p.x, 0, p.x - b.x - b.w),
            Math.max(b.y - p.y, 0, p.y - b.y - b.h),
          ),
        ),
      );
    const places = [0, 1].flatMap((k) =>
      [0.2, 0.35, 0.5, 0.65, 0.8].map((t) => ({
        x: path[k]!.x + (path[k + 1]!.x - path[k]!.x) * t,
        y: path[k]!.y + (path[k + 1]!.y - path[k]!.y) * t,
      })),
    );
    const onArrow = places.reduce((best, p) => (away(p) > away(best) ? p : best));
    await choosePart(
      {
        x: lineEnds(second).start.x + (lineEnds(second).end.x - lineEnds(second).start.x) * 0.6,
        y: lineEnds(second).start.y + (lineEnds(second).end.y - lineEnds(second).start.y) * 0.6,
      },
      'Strek',
    );
    await dragHandle(page.locator('.handle[data-handle="start"]'), onArrow);
    scene = await save();
    const t = link(scene, 1);
    // (Where B and C lie close, the handle of the other end can lie over this one: then that end is taken.)
    const end = t.startAt === arrow.id ? 'start' : 'end';
    expect(end === 'start' ? t.startAt : t.endAt).toBe(arrow.id);
    expect(nearestOnPath(linePath(link(scene, 0)), lineEnds(t)[end]).distance).toBeLessThan(1);
    // The form still says B to C, and says where the end lies, in plain words.
    expect(figureOf(scene).links![1]!.from).toBe(figureOf(scene).items[1]!.id);
    expect(figureOf(scene).links![1]!.to).toBe(figureOf(scene).items[2]!.id);
    await clickOnSlide({ x: stage.width - 30, y: stage.height - 30 });
    await clickOnSlide(middle(node(scene, 'A')));
    await expect.poll(heading).toBe('Figur: Nettverk');
    expect(await page.locator('.network-links li').nth(1).textContent()).toContain(
      `${end === 'start' ? 'Starten' : 'Slutten'} ligger på koblingen A til B.`,
    );
    expect(settled(scene)).toBe(true);
    await shot(page, 'n02-nettverk-med-skjema');
  }, 120_000);

  it('is seen in «Forhåndsvis», with the connections read as a list', async () => {
    const scene = await save();
    const arrow = link(scene, 0);
    const opened = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Forhåndsvis' }).click();
    const player = await opened;
    await player.waitForSelector('.lp-stage .ls-scene');
    expect(await player.locator(`.lp-stage [data-el="${arrow.id}"] svg > polyline`).count()).toBe(1);
    expect(await player.locator('.lp-stage .ls-figure-table li').allTextContents()).toEqual([
      'A til B',
      'B og C',
    ]);
    // The list is read, not shown.
    const size = await player
      .locator('.lp-stage .ls-figure-table')
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(size).toBeLessThanOrEqual(1);
    await shot(player, 'n03-forhandsvis');
    await player.close();
  }, 60_000);

  it('is in an exported HTML file as it is on the slide', async () => {
    const scene = await save();
    const arrow = link(scene, 0);
    const out = join(work, 'nettverk.html');
    await answerSaveDialog(out);
    await page.locator('.topbar-actions').getByRole('button', { name: 'Eksporter HTML' }).click();
    await expect
      .poll(() => page.locator('.notice').textContent(), { timeout: 60_000 })
      .toContain('HTML-fila er lagret');
    await page.locator('.notice button', { hasText: 'Lukk' }).click();
    const opened = app.waitForEvent('window');
    await app.evaluate(async ({ BrowserWindow }, file) => {
      const window = new BrowserWindow({ show: false, width: 1200, height: 800 });
      await window.loadFile(file);
    }, out);
    const browser = await opened;
    await browser.waitForSelector('.lp-stage .ls-scene');
    expect(await browser.locator('.lp-stage .ls-figure-table li').allTextContents()).toEqual([
      'A til B',
      'B og C',
    ]);
    // The bent arrow is drawn through its point: the polyline's middle point is the bend, in its box.
    const points = await browser
      .locator(`.lp-stage [data-el="${arrow.id}"] svg > polyline`)
      .getAttribute('points');
    const middlePoint = points!.split(' ')[1]!.split(',').map(Number);
    expect(Math.abs(arrow.box.x + middlePoint[0]! - bend.x)).toBeLessThan(1);
    expect(Math.abs(arrow.box.y + middlePoint[1]! - bend.y)).toBeLessThan(1);
    await browser.close();
  }, 90_000);

  it.skipIf(name !== 'lying' || !existsSync(ffmpeg))(
    'is in a short video, with the bent arrow where it should be',
    async () => {
      const out = join(work, 'nettverk.mp4');
      await answerSaveDialog(out);
      await page
        .locator('.topbar-actions')
        .getByRole('button', { name: 'Eksporter video' })
        .click();
      const dialog = page.locator('dialog.video-dialog');
      await dialog.waitFor();
      await dialog.getByRole('button', { name: 'Velg fil og eksporter' }).click();
      await expect
        .poll(() => page.locator('.notice').textContent(), { timeout: EXPORT_WAIT, interval: 500 })
        .toContain('Videoen er lagret');
      const pixels = execFileSync(
        ffmpeg,
        ['-v', 'error', '-ss', '0.5', '-i', out, '-frames:v', '1'].concat([
          '-f',
          'rawvideo',
          '-pix_fmt',
          'rgb24',
          'pipe:1',
        ]),
        { maxBuffer: 1 << 26 },
      );
      expect(pixels.length).toBe(stage.width * stage.height * 3);
      /** The darkest pixel within a few pixels of a point (the arrow is dark on the light slide). */
      const darkest = (p: Point): number => {
        let least = 255 * 3;
        for (let dy = -4; dy <= 4; dy++) {
          for (let dx = -4; dx <= 4; dx++) {
            const i = (Math.round(p.y + dy) * stage.width + Math.round(p.x + dx)) * 3;
            least = Math.min(least, pixels[i]! + pixels[i + 1]! + pixels[i + 2]!);
          }
        }
        return least;
      };
      // The arrow runs through its bend, and not where it ran before it was bent.
      expect(darkest(bend)).toBeLessThan(250);
      expect(darkest(straightMiddle)).toBeGreaterThan(600);
      if (shots) {
        mkdirSync(shots, { recursive: true });
        execFileSync(ffmpeg, [
          '-v',
          'error',
          '-y',
          '-ss',
          '0.5',
          '-i',
          out,
          '-frames:v',
          '1',
          join(shots, `${tag}-n04-video.png`),
        ]);
      }
    },
    EXPORT_TEST,
  );
});
