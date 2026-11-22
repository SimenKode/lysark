// Runs the built program end to end for "Lær mer": the builder, the media
// dialog (with Wikimedia Commons answered by the test itself, never the
// network), the network block, and the panel in the player. Needs
// `npm run build` first. The window is never shown on screen.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testPng, writeSampleProject } from './fixtures/sampleProject';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
const packaged = process.env.LYSARK_APP;
const shots = process.env.LYSARK_SHOTS;

describe.skipIf(!built)('"Lær mer", end to end', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;
  let outside: Server;
  let outsideUrl: string;
  let outsideRequests = 0;

  const shot = async (target: Page, name: string): Promise<void> => {
    if (!shots) return;
    mkdirSync(shots, { recursive: true });
    await target.screenshot({ path: join(shots, `${name}.png`) });
  };

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-more-'));
    projectDir = join(work, 'prosjekt');
    const sample = writeSampleProject(projectDir);
    // A YouTube video on the last slide, with a still picture from the project.
    sample.scenes[2]!.elements.push({
      id: 'e_youtube',
      type: 'video',
      source: { kind: 'url', url: 'https://youtu.be/BBBBBBBBBBB' },
      title: 'Video B',
      poster: Object.keys(sample.assets)[0]!,
      box: { x: 960, y: 270, w: 800, h: 540, rotation: 0 },
    });
    writeFileSync(join(projectDir, 'prosjekt.json'), JSON.stringify(sample, null, 2), 'utf8');
    writeFileSync(join(work, 'opplastet.png'), testPng(320, 200));
    // Stands in for "somewhere on the network": nothing may ever reach it.
    outside = createServer((_req, res) => {
      outsideRequests += 1;
      res.end('x');
    });
    await new Promise<void>((done) => outside.listen(0, '127.0.0.1', done));
    outsideUrl = `http://127.0.0.1:${(outside.address() as AddressInfo).port}/`;

    const args = [`--user-data-dir=${join(work, 'userdata')}`, projectDir];
    app = await electron.launch({
      ...(packaged ? { executablePath: packaged, args } : { args: [root, ...args] }),
      env: { ...process.env, LYSARK_HIDDEN: '1' },
    });
    page = await app.firstWindow();
    await page.waitForSelector('.app');
    await page.locator('.scene-item').nth(1).click();
    await page.waitForSelector('.stage-inner .ls-el-table');
  }, 60_000);

  afterAll(async () => {
    // A failed run can leave unsaved changes; closing must never wait for an answer.
    await app
      ?.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.destroy()))
      .catch(() => undefined);
    await app?.close().catch(() => undefined);
    outside?.closeAllConnections();
    await new Promise((done) => outside?.close(done));
    if (work) rmSync(work, { recursive: true, force: true });
  });

  it('marks the element that has content, in the editor too', async () => {
    const badges = page.locator('.stage-inner .ls-more-badge');
    expect(await badges.count()).toBe(1);
    expect(await page.locator('.stage-inner .ls-el-image .ls-more-badge').count()).toBe(1);
    await shot(page, 'm01-merke-i-scenen');
  });

  it('opens the builder from the side panel and shows the panel as the student sees it', async () => {
    await page.locator('.stage-inner .ls-el-image').click({ position: { x: 20, y: 20 } });
    await page.getByRole('button', { name: 'Rediger utdyping …' }).click();
    await page.waitForSelector('.builder');
    expect(await page.locator('.block-card').count()).toBe(5);
    const preview = page.locator('.builder-panel');
    expect(await preview.locator('h2').textContent()).toBe('Om bildet');
    expect(await preview.locator('.lm-heading').textContent()).toBe('Overskrift B');
    expect(await preview.locator('.lm-table th').count()).toBe(2);
    // Web content is drawn, but nothing in the preview can fetch anything.
    expect(await preview.locator('.ls-webvideo').count()).toBe(2);
    expect(await preview.locator('button, a, iframe').count()).toBe(0);
    await shot(page, 'm02-byggeren');
  });

  it('builds: add, write, reorder and delete, with the preview following', async () => {
    const preview = page.locator('.builder-panel');
    await page.locator('.block-add').getByRole('button', { name: 'Overskrift' }).click();
    expect(await page.locator('.block-card').count()).toBe(6);
    await page
      .locator('.block-card')
      .nth(5)
      .getByRole('textbox', { name: 'Overskrift' })
      .fill('Overskrift C');
    await expect
      .poll(() => preview.locator('.lm-heading').nth(1).textContent())
      .toBe('Overskrift C');

    // Move it to the top with the keyboard-friendly buttons.
    for (let i = 5; i > 0; i--) {
      await page
        .locator('.block-card')
        .nth(i)
        .getByRole('button', { name: 'Flytt overskrift opp' })
        .click();
    }
    await expect
      .poll(() => preview.locator('.lm-heading').first().textContent())
      .toBe('Overskrift C');

    await page.getByLabel('Overskrift i panelet').fill('Om bildet A');
    await expect.poll(() => preview.locator('h2').textContent()).toBe('Om bildet A');

    await page.getByRole('button', { name: 'Nede til venstre' }).click();
    await page
      .locator('.block-card')
      .first()
      .getByRole('button', { name: 'Slett overskrift' })
      .click();
    expect(await page.locator('.block-card').count()).toBe(5);
    await expect
      .poll(() => preview.locator('.lm-heading').first().textContent())
      .toBe('Overskrift B');
  });

  it('adds a picture the project already has, through the media dialog', async () => {
    await page.locator('.block-add').getByRole('button', { name: 'Bilde' }).click();
    await page.waitForSelector('dialog.media-dialog[open]');
    expect(await page.locator('.media-dialog').getByRole('tab').allTextContents()).toEqual([
      'Søk i Wikimedia Commons',
      'Last opp',
      'I prosjektet',
    ]);
    await shot(page, 'm03-mediedialog');
    await page.locator('.media-dialog').getByRole('tab', { name: 'I prosjektet' }).click();
    await page.locator('.media-tile').first().click();
    // The licence of this picture demands its credit; it is shown and cannot be edited.
    expect(await page.locator('.media-detail .credit-fixed').textContent()).toContain(
      '«Testbilde» av Person A, CC BY 4.0',
    );
    expect(await page.locator('.media-detail input').count()).toBe(0);
    await shot(page, 'm04-i-prosjektet');
    await page.locator('.media-detail').getByRole('button', { name: 'Sett inn' }).click();
    await expect.poll(() => page.locator('dialog.media-dialog').count()).toBe(0);
    expect(await page.locator('.block-card').count()).toBe(6);
    await page.locator('.block-card').nth(5).getByLabel('Alternativ tekst').fill('Bilde A');
    const figure = page.locator('.builder-panel .lm-figure').last();
    await expect.poll(() => figure.locator('img').getAttribute('alt')).toBe('Bilde A');
    expect(await figure.locator('.lm-credit').textContent()).toContain('av Person A');
  });

  it('uploads a file with a credit the owner writes', async () => {
    await app.evaluate(
      ({ dialog }, file) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
      },
      join(work, 'opplastet.png'),
    );
    await page.locator('.block-add').getByRole('button', { name: 'Bilde' }).click();
    await page.locator('.media-dialog').getByRole('tab', { name: 'Last opp' }).click();
    await page.getByRole('button', { name: 'Last opp medie …' }).click();
    await page.waitForSelector('.media-upload-preview');
    await page.getByLabel('Opphavsperson').fill('Person B');
    await page.getByLabel('Lisens').fill('Egen');
    await page.locator('.media-detail').getByRole('button', { name: 'Sett inn' }).click();
    await expect.poll(() => page.locator('.block-card').count()).toBe(7);
    const figure = page.locator('.builder-panel .lm-figure').last();
    await expect.poll(() => figure.locator('.lm-credit').textContent()).toBe('av Person B, Egen');
    expect(
      await figure.locator('img').evaluate((img) => (img as HTMLImageElement).naturalWidth),
    ).toBe(320);
  });

  it('searches Wikimedia Commons and inserts a picture with its credit', async () => {
    // The test answers for Wikimedia; no request leaves the machine.
    const png = testPng(640, 480).toString('base64');
    await app.evaluate(({ session }, picture) => {
      const seen: string[] = [];
      (globalThis as unknown as { lysarkSeen: string[] }).lysarkSeen = seen;
      const info = (width: number) => ({
        url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Test_A.png',
        thumburl: `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Test_A.png/${width}px-Test_A.png`,
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Test_A.png',
        width: 640,
        height: 480,
        mime: 'image/png',
        extmetadata: {
          License: { value: 'cc-by-sa-4.0' },
          LicenseShortName: { value: 'CC BY-SA 4.0' },
          LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0' },
          Artist: { value: '<a href="//example.org">Person C</a>' },
          AttributionRequired: { value: 'true' },
        },
      });
      session.fromPartition('lysark-web').protocol.handle('https', (request) => {
        seen.push(request.url);
        const url = new URL(request.url);
        if (url.hostname === 'commons.wikimedia.org') {
          const width = Number(url.searchParams.get('iiurlwidth'));
          const pages = [{ title: 'File:Test A.png', index: 1, imageinfo: [info(width)] }];
          return new Response(JSON.stringify({ query: { pages } }), {
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.hostname === 'upload.wikimedia.org' || url.hostname === 'thumb.wikimedia.org') {
          return new Response(Buffer.from(picture, 'base64'), {
            headers: { 'content-type': 'image/png' },
          });
        }
        return new Response(null, { status: 404 });
      });
    }, png);

    await page.locator('.block-add').getByRole('button', { name: 'Bilde' }).click();
    await page.waitForSelector('dialog.media-dialog[open]');
    await page.getByLabel('Søk i Wikimedia Commons').fill('A B');
    await page.getByRole('button', { name: 'Søk', exact: true }).click();
    const tile = page.locator('.media-tile').first();
    await tile.waitFor();
    expect(await tile.locator('.media-badge').textContent()).toBe('CC BY-SA 4.0');
    await expect
      .poll(() => tile.locator('img').evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBe(640);
    await tile.click();
    expect(await page.locator('.media-detail').textContent()).toContain('Person C');
    await shot(page, 'm05-commons-treff');
    await page.locator('.media-detail').getByRole('button', { name: 'Sett inn' }).click();
    await expect.poll(() => page.locator('.block-card').count()).toBe(8);
    const figure = page.locator('.builder-panel .lm-figure').last();
    await expect
      .poll(() => figure.locator('.lm-credit').textContent())
      .toBe('«Test A» av Person C, CC BY-SA 4.0. Kilde');

    // What was sent: the search words, to Wikimedia only, under the program's name and nothing else.
    const sent = await app.evaluate(({ session }) => ({
      seen: (globalThis as unknown as { lysarkSeen: string[] }).lysarkSeen,
      userAgent: session.fromPartition('lysark-web').getUserAgent(),
    }));
    expect(sent.userAgent).toMatch(/^Lysark\/\d+\.\d+\.\d+$/);
    expect(sent.seen.length).toBeGreaterThan(0);
    for (const address of sent.seen) {
      expect(address).toMatch(/^https:\/\/(commons|upload|thumb)\.wikimedia\.org\//);
    }
    expect(sent.seen.some((address) => address.includes('gsrsearch=A+B+filetype'))).toBe(true);
  });

  it('finishes, and the scene shows the mark in its new corner', async () => {
    await page.getByRole('button', { name: 'Ferdig' }).click();
    await expect.poll(() => page.locator('.builder').count()).toBe(0);
    const badge = page.locator('.stage-inner .ls-el-image .ls-more-badge');
    expect(parseFloat(await badge.evaluate((el) => (el as HTMLElement).style.left))).toBeLessThan(
      0,
    );
  });

  it('adds content to any element from the right-click menu, and can be undone', async () => {
    await page.locator('.stage-inner .ls-role-title').click({ button: 'right' });
    const menu = page.locator('.context-menu');
    await menu.waitFor();
    await shot(page, 'm06-hoyreklikk');
    await menu.getByRole('menuitem', { name: 'Legg til utdyping …' }).click();
    await page.waitForSelector('.builder');
    expect(await page.locator('.block-card').count()).toBe(0);
    await page.locator('.block-add').getByRole('button', { name: 'Tekst' }).click();
    await page.locator('.block-card .ProseMirror').click();
    await page.keyboard.type('Utdyping C');
    await expect
      .poll(() => page.locator('.builder-panel .lm-text').textContent())
      .toBe('Utdyping C');
    await page.getByRole('button', { name: 'Ferdig' }).click();
    expect(await page.locator('.stage-inner .ls-more-badge').count()).toBe(2);

    // An element that is opened and closed without content gets no mark.
    await page.locator('.stage-inner .ls-el-table').click({ button: 'right' });
    await page
      .locator('.context-menu')
      .getByRole('menuitem', { name: 'Legg til utdyping …' })
      .click();
    await page.getByRole('button', { name: 'Ferdig' }).click();
    expect(await page.locator('.stage-inner .ls-more-badge').count()).toBe(2);
  });

  it('keeps "+ Lær mer" as the simple way in', async () => {
    const before = await page.locator('.stage-inner .ls-deepdive').count();
    await page.locator('.insertbar').getByRole('button', { name: '+ Lær mer' }).click();
    await page.waitForSelector('.builder');
    expect(await page.locator('.stage-inner .ls-deepdive').count()).toBe(before + 1);
    // Only the builder can be reached while it is open.
    expect(await page.locator('.app').evaluate((el) => (el as HTMLElement).inert)).toBe(true);
    await page.locator('.builder').getByLabel('Tekst på knappen').fill('Knapp A');
    await page.getByRole('button', { name: 'Ferdig' }).click();
    expect(await page.locator('.app').evaluate((el) => (el as HTMLElement).inert)).toBe(false);
    await expect
      .poll(() => page.locator('.stage-inner .ls-deepdive').last().textContent())
      .toBe('Knapp A');
  });

  it('never lets the interface, or the network session, reach anything off the list', async () => {
    const results = await app.evaluate(async ({ session }, url) => {
      const attempt = async (fetcher: { fetch(u: string): Promise<unknown> }): Promise<string> => {
        try {
          await fetcher.fetch(url);
          return 'fetched';
        } catch (error) {
          return String(error);
        }
      };
      return {
        ui: await attempt(session.defaultSession),
        web: await attempt(session.fromPartition('lysark-web')),
      };
    }, outsideUrl);
    expect(results.ui).toContain('ERR_BLOCKED_BY_CLIENT');
    expect(results.web).not.toBe('fetched');
    // From inside the page as well.
    const fromPage = await page.evaluate(async (url) => {
      try {
        await fetch(url);
        return 'fetched';
      } catch {
        return 'refused';
      }
    }, outsideUrl);
    expect(fromPage).toBe('refused');
    expect(outsideRequests).toBe(0);
  });

  it('saves a project that opens again with everything in place', async () => {
    await page.locator('.topbar-actions').getByRole('button', { name: 'Lagre •' }).click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
    const saved = JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as {
      version: number;
      assets: Record<string, { credit?: { author?: string; required?: boolean }; file: string }>;
      scenes: Array<{
        elements: Array<{
          type: string;
          more?: { title: string; corner?: string; blocks: unknown[] };
        }>;
      }>;
    };
    expect(saved.version).toBe(3);
    const image = saved.scenes[1]!.elements.find((e) => e.type === 'image')!;
    expect(image.more!.title).toBe('Om bildet A');
    expect(image.more!.corner).toBe('bl');
    expect(image.more!.blocks).toHaveLength(8);
    const fromCommons = Object.values(saved.assets).find((a) => a.credit?.author === 'Person C')!;
    expect(fromCommons.credit!.required).toBe(true);
    expect(existsSync(join(projectDir, fromCommons.file))).toBe(true);
  });

  it('plays: the mark opens the panel, YouTube plays in place when shown, other web content waits', async () => {
    // The test answers for the web here too: whatever the preview asks for
    // is noted and answered with an empty page. Nothing leaves the machine.
    await app.evaluate(({ session }) => {
      const asked: string[] = [];
      (globalThis as unknown as { lysarkAsked: string[] }).lysarkAsked = asked;
      session.fromPartition('lysark-preview').protocol.handle('https', (request) => {
        asked.push(request.url);
        return new Response('<!doctype html><title>x</title>', {
          headers: { 'content-type': 'text/html' },
        });
      });
    });
    const asked = (): Promise<string[]> =>
      app.evaluate(() => (globalThis as unknown as { lysarkAsked: string[] }).lysarkAsked);
    const opened = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Forhåndsvis' }).click();
    const player = await opened;
    await player.waitForSelector('.lp-stage .ls-scene');
    // Served from this machine, so embedded video behaves as it will from the learning platform.
    expect(player.url()).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/[0-9a-f]{36}\/index\.html#2$/);

    const badge = player.locator('.lp-stage .ls-el-image .ls-more-badge');
    expect(await badge.getAttribute('aria-label')).toBe('Lær mer om: Om bildet A');
    await badge.focus();
    await player.keyboard.press('Enter');
    await player.waitForSelector('.lp-panel:not([hidden])');
    expect(await player.locator('#lp-panel-title').textContent()).toBe('Om bildet A');
    expect(await badge.getAttribute('aria-expanded')).toBe('true');
    await expect
      .poll(() => player.evaluate(() => document.activeElement?.id))
      .toBe('lp-panel-title');
    const panel = player.locator('.lp-panel');
    expect(await panel.locator('.lm-table th').count()).toBe(2);
    // The YouTube video is YouTube's player, fetched now that the panel is
    // open. The embedded page is still a button, and is not fetched.
    const inPanel = 'https://www.youtube-nocookie.com/embed/AAAAAAAAAAA?rel=0';
    expect(await panel.locator('iframe.ls-webvideo-frame').getAttribute('src')).toBe(inPanel);
    expect(await panel.locator('button.ls-webvideo-play').count()).toBe(1);
    expect(await panel.locator('a.ls-webvideo-open').first().getAttribute('href')).toBe(
      'https://www.youtube.com/watch?v=AAAAAAAAAAA',
    );
    await expect.poll(asked).toEqual([inPanel]);
    await shot(player, 'm07-spiller-panel');

    await panel.getByRole('button', { name: 'Utvid' }).click();
    expect(await panel.evaluate((el) => el.classList.contains('lp-panel-wide'))).toBe(true);
    expect(await panel.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(1200);
    await shot(player, 'm08-spiller-utvidet');

    await player.keyboard.press('Escape');
    await expect.poll(() => panel.isHidden()).toBe(true);
    expect(await badge.getAttribute('aria-expanded')).toBe('false');
    expect(
      await player.evaluate(() => document.activeElement?.classList.contains('ls-more-badge')),
    ).toBe(true);

    // A click anywhere on the element opens the panel; it does not go to the next step.
    await player.locator('.lp-stage .ls-el-image img').click();
    await player.waitForSelector('.lp-panel:not([hidden])');
    expect(await player.locator('.lp-counter').textContent()).toBe('2 / 3');
    await player.keyboard.press('Escape');

    await player.getByRole('button', { name: 'Bildekilder' }).click();
    const credits = player.locator('.lp-credits-list li');
    expect(await credits.count()).toBe(3);
    expect(await credits.first().textContent()).toContain('«Testbilde» av Person A, CC BY 4.0');
    await shot(player, 'm09-bildekilder');
    await player.keyboard.press('Escape');
    await expect.poll(() => player.locator('.lp-credits').isVisible()).toBe(false);

    // The video on the last slide: nothing was asked for it until the slide is shown.
    const onSlide = 'https://www.youtube-nocookie.com/embed/BBBBBBBBBBB?rel=0';
    expect(await asked()).not.toContain(onSlide);
    expect(await player.locator('iframe').count()).toBe(0); // closing the panel took its player away
    await player.keyboard.press('End');
    await expect.poll(() => player.locator('.lp-counter').textContent()).toBe('3 / 3');
    const frame = player.locator('.lp-stage .ls-el-video iframe.ls-webvideo-frame');
    expect(await frame.getAttribute('src')).toBe(onSlide);
    expect(await frame.getAttribute('title')).toBe('Video B');
    await expect.poll(asked).toContain(onSlide);
    expect(
      await player.locator('.lp-stage .ls-el-video a.ls-webvideo-open').getAttribute('href'),
    ).toBe('https://www.youtube.com/watch?v=BBBBBBBBBBB');
    await shot(player, 'm10-youtube-i-lysarket');
    // Going on takes the player away, so nothing plays in the background.
    await player.locator('.lp-nav-prev').click();
    await expect.poll(() => player.locator('.lp-counter').textContent()).toBe('2 / 3');
    expect(await player.locator('iframe').count()).toBe(0);
  });
});
