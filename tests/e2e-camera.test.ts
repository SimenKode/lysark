// Runs the built program end to end for the camera circle: the lecturer's
// face is filmed while a slide is read in, the circle is dragged about, and
// the video shows the face in the circle where it stood at each moment.
// Needs `npm run build` and FFmpeg in vendor/ffmpeg. The window is never
// shown, the camera and the microphone are Chromium's fake ones (a test
// picture and beeps; never a real camera), and nothing touches the network.
import { execFileSync, spawnSync } from 'node:child_process';
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
import type { Project } from '../src/shared/format/schema';
import { CAMERA_DIAMETER, CAMERA_GLIDE_SECONDS } from '../src/shared/render/clock';
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

/** Where the test puts the circle: before reading, while reading, and afterwards on slide 2. */
const START = { x: 300, y: 800 };
const MOVED = { x: 1500, y: 300 };
const LATER = { x: 960, y: 760 };

describe.skipIf(!built || !existsSync(ffmpeg))('the camera circle, end to end', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;
  let movedAt = 0;
  let firstLength = 0;

  const shot = async (target: Page, name: string): Promise<void> => {
    if (!shots) return;
    mkdirSync(shots, { recursive: true });
    await target.screenshot({ path: join(shots, `${name}.png`) });
  };
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
  const answerSaveDialog = (file: string): Promise<void> =>
    app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: path });
    }, file);
  /** Drags the circle so that its centre lands on a point of the slide (in stage pixels). */
  const drag = async (stage: Locator, to: { x: number; y: number }): Promise<void> => {
    const circle = (await stage.locator('.camera-circle').boundingBox())!;
    const slide = (await stage.boundingBox())!;
    const scale = slide.width / 1920;
    await page.mouse.move(circle.x + circle.width / 2, circle.y + circle.height / 2);
    await page.mouse.down();
    await page.mouse.move(slide.x + to.x * scale, slide.y + to.y * scale, { steps: 6 });
    await page.mouse.up();
  };
  /** The centre of the circle on the slide, in stage pixels. */
  const centre = async (stage: Locator): Promise<{ x: number; y: number }> => {
    const circle = (await stage.locator('.camera-circle').boundingBox())!;
    const slide = (await stage.boundingBox())!;
    const scale = slide.width / 1920;
    return {
      x: (circle.x + circle.width / 2 - slide.x) / scale,
      y: (circle.y + circle.height / 2 - slide.y) / scale,
    };
  };

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-kamera-'));
    projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    const project = newProject('Testforelesning');
    for (const name of ['A', 'B']) {
      const scene = newScene('content', `Lysark ${name}`);
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
      scene.showLogo = false;
      project.scenes.push(scene);
    }
    writeFileSync(join(projectDir, 'prosjekt.json'), JSON.stringify(project, null, 2), 'utf8');

    const args = [
      OFFLINE,
      `--user-data-dir=${join(work, 'userdata')}`,
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      projectDir,
    ];
    app = await electron.launch({
      ...(packaged ? { executablePath: packaged, args } : { args: [root, ...args] }),
      env: { ...process.env, LYSARK_HIDDEN: '1' },
    });
    page = await app.firstWindow();
    await page.waitForSelector('.app');
  }, 60_000);

  afterAll(async () => {
    await app
      ?.evaluate(({ dialog }) => {
        dialog.showMessageBoxSync = () => 1; // "Ikke lagre"
      })
      .catch(() => undefined);
    await app?.close().catch(() => undefined);
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('films the lecturer while reading, and remembers where the circle was dragged', async () => {
    await page.getByRole('tab', { name: /^Lyd/ }).click();
    await page.getByRole('button', { name: 'Les inn', exact: true }).click();
    const recorder = page.locator('.recorder');
    await recorder.waitFor();
    const stage = recorder.locator('.recorder-stage-inner');
    // The camera is off until the owner switches it on.
    const camera = recorder.getByLabel('Kamera', { exact: true });
    expect(await camera.isChecked()).toBe(false);
    expect(await stage.locator('.camera-circle').count()).toBe(0);
    await camera.check();
    const circle = stage.locator('.camera-circle');
    await circle.waitFor();
    await expect
      .poll(() => circle.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth))
      .toBeGreaterThan(0);
    expect(await recorder.locator('.recorder-press').last().textContent()).toContain(
      'Dra kamerasirkelen',
    );
    // It starts in the lower right corner, and can be put in place before the reading.
    const first = await centre(stage);
    expect(first.x).toBeGreaterThan(1500);
    expect(first.y).toBeGreaterThan(700);
    await drag(stage, START);
    const placed = await centre(stage);
    expect(placed.x).toBeCloseTo(START.x, -1);
    expect(placed.y).toBeCloseTo(START.y, -1);
    await shot(page, 'k01-opptak-kamera');

    await recorder.getByRole('button', { name: 'Start opptak' }).click();
    await recorder.locator('.recorder-clock.is-on').waitFor({ timeout: 10_000 });
    await page.waitForTimeout(1300);
    // Dragged while reading: the move is remembered with its time.
    await drag(stage, MOVED);
    await page.waitForTimeout(1200);
    // On to the next slide; the arrow still means that after a drag.
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => recorder.locator('.recorder-where').textContent())
      .toContain('Lysark 2 av 2');
    await page.waitForTimeout(1600);
    await recorder.getByRole('button', { name: 'Ferdig' }).click();
    await recorder.waitFor({ state: 'detached', timeout: 60_000 });
    await page.locator('.notice button', { hasText: 'Lukk' }).click();

    const project = await save();
    const [a, b] = project.scenes;
    expect(a!.camera).toMatchObject({ size: 'medium' });
    expect(a!.camera!.x).toBeCloseTo(START.x, -1);
    expect(a!.camera!.y).toBeCloseTo(START.y, -1);
    const moves = (a!.events ?? []).filter((e) => e.kind === 'camera-move');
    expect(moves).toHaveLength(1);
    const move = moves[0]!;
    expect(move.kind === 'camera-move' && Math.abs(move.x - MOVED.x)).toBeLessThan(6);
    expect(move.kind === 'camera-move' && Math.abs(move.y - MOVED.y)).toBeLessThan(6);
    movedAt = move.at;
    const clipA = a!.audio!.clips[0]!;
    firstLength = clipA.kind === 'sound' ? clipA.to - clipA.from : 0;
    expect(movedAt).toBeGreaterThan(1);
    expect(movedAt).toBeLessThan(firstLength - 0.8);
    // The next slide starts where the circle stood, and has no moves of its own.
    expect(Math.abs(b!.camera!.x - MOVED.x)).toBeLessThan(6);
    expect(Math.abs(b!.camera!.y - MOVED.y)).toBeLessThan(6);
    expect((b!.events ?? []).length).toBe(0);

    // The whole recording has one film, which runs on where the slide changes:
    // a file in the project folder, square and even. Each slide's sound says
    // which moment of the film it began at.
    const lengths = [a!, b!].map((scene) => {
      const clip = scene.audio!.clips[0]!;
      return clip.kind === 'sound' ? clip.to - clip.from : 0;
    });
    const recordings = [a!, b!].map((scene) => {
      const clip = scene.audio!.clips[0]!;
      return project.assets[clip.kind === 'sound' ? clip.asset : '']!;
    });
    expect(recordings[0]!.camera).toBeDefined();
    expect(recordings[1]!.camera).toBeDefined();
    expect(recordings[1]!.camera!.asset).toBe(recordings[0]!.camera!.asset);
    // The first slide began with the film, the second where the first ended.
    expect(Math.abs(recordings[0]!.camera!.offset)).toBeLessThan(0.05);
    expect(Math.abs(recordings[1]!.camera!.offset + lengths[0]!)).toBeLessThan(0.3);
    const film = project.assets[recordings[0]!.camera!.asset]!;
    expect(film.kind).toBe('camera');
    expect(film.file).toMatch(/^media\/kamera-[0-9a-f]{16}\.mp4$/);
    expect(Object.values(project.assets).filter((asset) => asset.kind === 'camera')).toHaveLength(
      1,
    );
    const said = spawnSync(ffmpeg, ['-hide_banner', '-i', join(projectDir, film.file)], {
      encoding: 'utf8',
    }).stderr;
    expect(said).toMatch(/Video: h264/);
    expect(said).toMatch(/480x480/);
    expect(said).toMatch(/\b30 fps/);
    expect(said).not.toMatch(/Audio:/);
    const seconds = /Duration: 00:00:(\d+\.\d+)/.exec(said);
    expect(Math.abs(Number(seconds?.[1]) - (lengths[0]! + lengths[1]!))).toBeLessThan(0.5);
  }, 150_000);

  it('shows the circle in the editor, where it can be moved, made smaller and hidden', async () => {
    // The last slide that was read is the one that is shown.
    const stage = page.locator('.stage-inner');
    const circle = stage.locator('.camera-circle');
    await circle.waitFor();
    await expect
      .poll(() => circle.locator('video').evaluate((v: HTMLVideoElement) => v.readyState))
      .toBeGreaterThan(1);
    const before = await centre(stage);
    expect(Math.abs(before.x - MOVED.x)).toBeLessThan(8);
    await drag(stage, LATER);
    await page.getByRole('tab', { name: 'Lysark', exact: true }).click();
    const group = page.locator('.group', { hasText: 'Kamerasirkelen' });
    await group.getByLabel('Størrelse').selectOption({ label: 'Liten' });
    await shot(page, 'k02-kamera-i-lysarket');
    let project = await save();
    expect(project.scenes[1]!.camera!.size).toBe('small');
    expect(Math.abs(project.scenes[1]!.camera!.x - LATER.x)).toBeLessThan(8);
    expect(Math.abs(project.scenes[1]!.camera!.y - LATER.y)).toBeLessThan(8);
    expect(await circle.evaluate((el) => (el as HTMLElement).style.width)).toBe(
      `${CAMERA_DIAMETER.small}px`,
    );
    // Hidden on this slide, and back again.
    const shown = group.getByLabel('Vis kamerasirkelen på dette lysarket');
    await shown.uncheck();
    await expect.poll(() => stage.locator('.camera-circle').count()).toBe(0);
    await shown.check();
    await circle.waitFor();
    project = await save();
    expect(project.scenes[1]!.camera!.hidden).toBeUndefined();

    // On the first slide the move made while reading is a mark in the sound panel.
    await page.locator('.scene-item').first().click();
    await page.waitForSelector('.audio-panel .track');
    const mark = page.locator('.track-event.is-camera-move');
    expect(await mark.count()).toBe(1);
    expect(await mark.getAttribute('title')).toContain('Kamerasirkelen flyttes ved');
    const there = await centre(stage);
    expect(Math.abs(there.x - START.x)).toBeLessThan(8);
    expect(Math.abs(there.y - START.y)).toBeLessThan(8);
  }, 60_000);

  it('makes a video with the face in the circle, where it stood at each moment', async () => {
    const out = join(work, 'forelesning.mp4');
    await answerSaveDialog(out);
    await page.locator('.topbar-actions').getByRole('button', { name: 'Eksporter video' }).click();
    const dialog = page.locator('dialog.video-dialog');
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Velg fil og eksporter' }).click();
    await expect
      .poll(() => page.locator('.notice').textContent(), { timeout: 150_000, interval: 500 })
      .toContain('Videoen er lagret');
    await page.locator('.notice button', { hasText: 'Lukk' }).click();

    /** A part of one picture of the video, as red, green, blue. */
    const crop = (time: number, x: number, y: number, w: number, h: number): Buffer =>
      execFileSync(
        ffmpeg,
        ['-v', 'error', '-ss', String(time), '-i', out, '-frames:v', '1'].concat([
          '-vf',
          `crop=${w}:${h}:${Math.round(x)}:${Math.round(y)}`,
          '-f',
          'rawvideo',
          '-pix_fmt',
          'rgb24',
          'pipe:1',
        ]),
        { maxBuffer: 1 << 24 },
      );
    /** The middle of where a circle would stand, 80 pixels each way. */
    const middle = (time: number, at: { x: number; y: number }): Buffer =>
      crop(time, at.x - 40, at.y - 40, 80, 80);
    const difference = (a: Buffer, b: Buffer): number => {
      let sum = 0;
      for (let i = 0; i < a.length; i++) sum += Math.abs(a[i]! - b[i]!);
      return sum / a.length;
    };
    const white = (pixels: Buffer): number => {
      let count = 0;
      for (let i = 0; i < pixels.length; i += 3) {
        if (pixels[i]! > 235 && pixels[i + 1]! > 235 && pixels[i + 2]! > 235) count += 1;
      }
      return count;
    };
    // What the slide looks like where nothing is: its own colour.
    const empty = middle(0.5, { x: 960, y: 480 });
    const isEmpty = (pixels: Buffer): boolean => difference(pixels, empty) < 3;

    // Before the move the face is where the circle was put, and nowhere else.
    expect(isEmpty(middle(0.5, START))).toBe(false);
    expect(isEmpty(middle(0.5, MOVED))).toBe(true);
    // The white ring is at the circle's edge.
    const r = CAMERA_DIAMETER.medium / 2;
    expect(white(crop(0.5, START.x - r, START.y - 2, 6, 4))).toBeGreaterThan(12);
    // After the move, and the glide, it is at the new place.
    const after = movedAt + CAMERA_GLIDE_SECONDS + 0.2;
    expect(isEmpty(middle(after, START))).toBe(true);
    expect(isEmpty(middle(after, MOVED))).toBe(false);
    // On the next slide it glides to where it was put afterwards, and is smaller.
    const second = firstLength + CAMERA_GLIDE_SECONDS + 0.6;
    expect(isEmpty(middle(second, MOVED))).toBe(true);
    expect(isEmpty(middle(second, LATER))).toBe(false);
    const small = CAMERA_DIAMETER.small / 2;
    expect(white(crop(second, LATER.x - small, LATER.y - 2, 6, 4))).toBeGreaterThan(12);
    expect(isEmpty(crop(second, LATER.x - r + 10, LATER.y - 20, 20, 40))).toBe(true);
    // The face is a film: its picture changes while the slide stands still.
    const face = (time: number): Buffer => crop(time, START.x - 90, START.y - 90, 180, 180);
    expect(difference(face(0.2), face(0.9))).toBeGreaterThan(0.3);
    expect(
      difference(middle(0.2, { x: 960, y: 480 }), middle(0.9, { x: 960, y: 480 })),
    ).toBeLessThan(0.5);
    if (shots) {
      execFileSync(
        ffmpeg,
        ['-v', 'error', '-y', '-ss', String(after), '-i', out].concat([
          '-frames:v',
          '1',
          join(shots, 'k03-video-kamera.png'),
        ]),
      );
    }
  }, 240_000);

  it('leaves the circle out of the HTML file', async () => {
    const out = join(work, 'forelesning.html');
    await answerSaveDialog(out);
    await page.locator('.topbar-actions').getByRole('button', { name: 'Eksporter HTML' }).click();
    await expect.poll(() => existsSync(out), { timeout: 60_000 }).toBe(true);
    await expect
      .poll(() => page.locator('.notice').textContent(), { timeout: 60_000 })
      .toContain('HTML-fila er lagret');
    const html = readFileSync(out, 'utf8');
    // What the file carries of the lecture: no film, no place for the circle, no moves.
    const data = /<script type="application\/json" id="lysark-data">([\s\S]*?)<\/script>/.exec(
      html,
    );
    expect(data).not.toBeNull();
    const content = data![1]!;
    expect(content).not.toContain('camera');
    expect(content).not.toContain('kamera-');
    const exported = (JSON.parse(content) as { project: Project }).project;
    expect(Object.values(exported.assets).map((asset) => asset.kind)).toEqual(['audio', 'audio']);
    // The voice is still there.
    expect(content).toContain('media/stemme-');
    expect(html).not.toContain('kamera-');
  }, 90_000);
});
