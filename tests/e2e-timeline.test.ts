// Runs the built program end to end for the timeline: the slides in a row,
// music put in under them, moved, cut, faded and divided, a slide made to
// stand longer, the whole lecture played, and the music in the exported
// video, lowered while the voice speaks. Needs `npm run build` and FFmpeg
// in vendor/ffmpeg. The window is never shown, and nothing touches the network.
import { execFileSync } from 'node:child_process';
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

describe.skipIf(!built || !existsSync(ffmpeg))('the timeline, end to end', () => {
  let work: string;
  let projectDir: string;
  let music: string;
  let app: ElectronApplication;
  let page: Page;

  const shot = async (name: string): Promise<void> => {
    if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
  };
  const saved = (): Project =>
    JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;
  const save = async (): Promise<void> => {
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
  };
  const answerSaveDialog = (file: string): Promise<void> =>
    app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: path });
    }, file);
  const clip = () => page.locator('.tl-music .tl-clip');
  const time = (): Promise<string | null> => page.locator('.tl-time').textContent();

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-tidslinje-'));
    projectDir = join(work, 'prosjekt');
    mkdirSync(join(projectDir, 'media'), { recursive: true });
    // A "voice" of four seconds for the first slide: a low tone, loud enough to count as speech.
    const voice = new Float32Array(4 * 48000);
    for (let i = 0; i < voice.length; i++)
      voice[i] = 0.3 * Math.sin((2 * Math.PI * 300 * i) / 48000);
    const wav = encodeWav(voice);
    writeFileSync(join(projectDir, 'media', 'stemme.wav'), wav);
    // The music the owner brings in: a high tone of twenty seconds, in another format.
    music = join(work, 'musikk A.mp3');
    execFileSync(ffmpeg, [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=2000:duration=20',
      '-ac',
      '2',
      '-ar',
      '44100',
      music,
    ]);

    const project = newProject('Testforelesning');
    project.assets.a_stemme = {
      kind: 'audio',
      file: 'media/stemme.wav',
      mime: 'audio/wav',
      bytes: wav.byteLength,
    };
    // The loudness of the video is left as it is, so the test can measure the music.
    project.video = { transition: 'cut', evenLoudness: false, credits: false };
    for (const [index, name] of ['A', 'B', 'C'].entries()) {
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
      scene.audio =
        index === 0
          ? { clips: [{ id: 'c_a', kind: 'sound', asset: 'a_stemme', from: 0, to: 4 }] }
          : { clips: [{ id: `c_${index}`, kind: 'pause', duration: index === 1 ? 4 : 3 }] };
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

  it('shows the slides in a row by their length, with the voice under them', async () => {
    await page.getByRole('tab', { name: 'Tidslinje' }).click();
    await page.waitForSelector('.timeline');
    const slides = page.locator('.tl-slide-box');
    expect(await slides.count()).toBe(3);
    expect(await time()).toBe('0:00,0 / 0:11');
    // Four, four and three seconds: the widths follow.
    const widths = await slides.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().width),
    );
    expect(widths[0]! / widths[2]!).toBeCloseTo(4 / 3, 1);
    expect(widths[1]! / widths[0]!).toBeCloseTo(1, 1);
    expect(await page.locator('.tl-voice-clip').count()).toBe(1);
    // The voice is drawn as a waveform. It is read from the project folder: this
    // recording was not made in this session, so nothing of it lies in memory.
    const drawn = (selector: string): Promise<number> =>
      page.locator(selector).evaluate((el) => {
        const canvas = el as HTMLCanvasElement;
        const column = canvas
          .getContext('2d')!
          .getImageData(Math.floor(canvas.width / 2), 0, 1, canvas.height).data;
        let filled = 0;
        for (let i = 3; i < column.length; i += 4) if (column[i]! > 0) filled += 1;
        return filled / canvas.height;
      });
    await expect
      .poll(() => drawn('.tl-voice-clip canvas'), { timeout: 15_000 })
      .toBeGreaterThan(0.2);
    // The same goes for the sound panel of the slide.
    await page.getByRole('tab', { name: /^Lyd/ }).click();
    await expect.poll(() => drawn('.track-wave'), { timeout: 15_000 }).toBeGreaterThan(0.2);
    await page.getByRole('tab', { name: 'Tidslinje' }).click();
    expect(await page.locator('.tl-music .tl-empty').textContent()).toContain('«Legg til musikk»');
    // A press on a slide shows it, and puts the playhead at its start.
    await page.locator('.tl-slide').nth(1).click();
    expect(await time()).toBe('0:04,0 / 0:11');
    expect(await page.locator('.tl-slide').nth(1).getAttribute('aria-current')).toBe('true');
    await page.locator('.tl-slide').nth(0).click();
  });

  it('puts music in at the playhead, and moves, shortens, fades and divides it', async () => {
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, music);
    await page.getByRole('button', { name: 'Legg til musikk' }).click();
    await clip().waitFor();
    expect(await clip().count()).toBe(1);
    expect(await page.locator('.tl-chosen').textContent()).toContain('musikk A.mp3');
    expect(await page.locator('.tl-chosen').textContent()).toContain('av 0:20,0');

    // The arrow keys move it: ten presses is one second.
    await clip().focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
    // Its right end is drawn in, to about nine seconds from the start of the lecture.
    // (The clip is longer than the lecture: the timeline reaches to the end of
    // the clip, and marks what lies after the end of the lecture.)
    expect(await page.locator('.tl-after').textContent()).toContain('høres ikke');
    const area = (await page.locator('.tl-inner').boundingBox())!;
    const pps = Number(await page.locator('.tl-inner').getAttribute('data-pps'));
    const box = (await clip().boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width - 3, y);
    await page.mouse.down();
    await page.mouse.move(area.x + 9.5 * pps, y, { steps: 6 });
    await page.mouse.move(area.x + 9 * pps, y, { steps: 3 });
    await page.mouse.up();

    await page.getByLabel('Ton inn, sekunder').fill('1');
    await page.getByLabel('Ton inn, sekunder').press('Enter');
    await page.getByLabel('Ton ut, sekunder').fill('2');
    await page.getByLabel('Ton ut, sekunder').press('Enter');
    await page.locator('.tl-tools input[type="range"]').fill('-6');
    expect(await page.locator('.tl-tools .audio-gain-value').textContent()).toContain('-6 dB');
    await shot('t01-tidslinje-musikk');
    // Who made the music can be written down, in words that fit music.
    await page.getByRole('button', { name: 'Kreditering' }).click();
    const credit = page.locator('dialog.tl-credit');
    await credit.waitFor();
    expect(await credit.textContent()).toContain('Tittel på stykket');
    await credit.getByLabel('Opphavsperson').fill('Person A');
    await credit.getByRole('button', { name: 'Ferdig' }).click();
    await credit.waitFor({ state: 'hidden' });

    await save();
    const placed = saved().tracks!.music[0]!;
    expect(placed).toMatchObject({ scene: 's_a', from: 0, gain: -6, fadeIn: 1, fadeOut: 2 });
    expect(placed.offset).toBeCloseTo(1, 5);
    expect(placed.to).toBeGreaterThan(7.5);
    expect(placed.to).toBeLessThan(8.5);
    // The music is a file in the project, in the project's own sound format.
    expect(saved().assets[placed.asset]).toMatchObject({
      kind: 'audio',
      mime: 'audio/wav',
      credit: { author: 'Person A' },
    });

    // Divided where the playhead stands, and joined again by undoing.
    // (The clip now ends inside the lecture, so the whole width shows the lecture again.)
    await expect.poll(() => page.locator('.tl-after').count()).toBe(0);
    const ruler = (await page.locator('.tl-ruler').boundingBox())!;
    const now = Number(await page.locator('.tl-inner').getAttribute('data-pps'));
    await page.mouse.click(ruler.x + 5 * now, ruler.y + ruler.height / 2);
    expect(await time()).toMatch(/^0:0[45],\d \/ 0:11$/);
    // The slide under the playhead is the slide that is shown.
    expect(await page.locator('.tl-slide').nth(1).getAttribute('aria-current')).toBe('true');
    await clip().first().click();
    await page.getByRole('button', { name: 'Del ved spillehodet' }).click();
    await expect.poll(() => clip().count()).toBe(2);
    await page.getByRole('button', { name: 'Angre' }).click();
    await expect.poll(() => clip().count()).toBe(1);
  }, 60_000);

  it('lets a slide stand longer by its edge, and the music under later slides stays with them', async () => {
    const edge = page.locator('.tl-edge').nth(1);
    await edge.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect.poll(time).toMatch(/ \/ 0:12$/);
    await save();
    // That slide has no voice: its pause was only there to give it a length,
    // and the edge sets the slide's own time without sound instead.
    const second = saved().scenes[1]!;
    expect(second.audio).toBeUndefined();
    expect(second.seconds).toBe(5);
    // A slide with a voice cannot be made shorter than what is said.
    await page.locator('.tl-edge').nth(0).focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
    await save();
    expect(saved().scenes[0]!.audio!.clips).toHaveLength(1);
  });

  it('plays the whole lecture, slide after slide', async () => {
    await page.locator('.tl-slide').nth(0).click();
    await page.getByRole('button', { name: 'Spill av', exact: true }).click();
    await page.getByRole('button', { name: 'Stopp' }).waitFor();
    // The playhead runs, and the slide that is heard becomes the slide that is shown.
    await expect
      .poll(() => page.locator('.tl-slide').nth(1).getAttribute('aria-current'), {
        timeout: 20_000,
      })
      .toBe('true');
    await shot('t02-tidslinje-spiller');
    await page.getByRole('button', { name: 'Stopp' }).click();
    await page.getByRole('button', { name: 'Spill av', exact: true }).waitFor();
    expect(await time()).not.toBe('0:00,0 / 0:12');
  }, 60_000);

  it('puts the music in the video, lowered while the voice speaks', async () => {
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

    // The music is a tone at 2000 Hz; the voice lies far below it, and is filtered well away.
    const band = 'highpass=f=1700,lowpass=f=2300';
    const pcm = execFileSync(
      ffmpeg,
      ['-v', 'error', '-i', out, '-af', `${band},${band},${band}`, '-ac', '1'].concat([
        '-ar',
        '48000',
        '-f',
        's16le',
        'pipe:1',
      ]),
      { maxBuffer: 1 << 26 },
    );
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
    const loudness = (from: number, to: number): number => {
      let sum = 0;
      const a = Math.round(from * 48000);
      const b = Math.min(samples.length, Math.round(to * 48000));
      for (let i = a; i < b; i++) sum += samples[i]! * samples[i]!;
      return Math.sqrt(sum / Math.max(1, b - a));
    };
    const end = 1 + saved().tracks!.music[0]!.to; // where the clip ends in the lecture
    const before = loudness(0.2, 0.8); // the clip starts one second in
    const underVoice = loudness(2.5, 3.5); // faded in, and the voice speaks until 4 s
    const alone = loudness(5.6, 6.6); // the voice has been quiet for a while
    const after = loudness(end + 0.4, 11.8);
    expect(alone).toBeGreaterThan(100);
    expect(before).toBeLessThan(alone / 20);
    expect(after).toBeLessThan(alone / 20);
    // Lowered to about a quarter under the voice.
    expect(underVoice / alone).toBeGreaterThan(0.15);
    expect(underVoice / alone).toBeLessThan(0.4);
    // And it tones out towards its end.
    expect(loudness(end - 0.5, end - 0.1)).toBeLessThan(alone / 2);
  }, 240_000);

  it('puts the music into the sound of the slides in the HTML file', async () => {
    const out = join(work, 'forelesning.html');
    await answerSaveDialog(out);
    await page.getByRole('button', { name: 'Eksporter HTML' }).click();
    await expect
      .poll(() => page.locator('.notice').textContent(), { timeout: 60_000 })
      .toContain('lagret');
    await page.locator('.notice button', { hasText: 'Lukk' }).click();
    const html = readFileSync(out, 'utf8');
    // Every slide has sound of its own now, also the two without a voice; the music file itself is not in.
    expect(html).toContain('a_voice_s_a');
    expect(html).toContain('a_voice_s_b');
    expect(html).toContain('a_voice_s_c');
    // What is left of the music is who made it, for the list of sources.
    expect(html).toContain('Person A');
  }, 120_000);
});
