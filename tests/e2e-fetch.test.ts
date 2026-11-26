// Runs the built program end to end for a figure in a "Lær mer" box: a
// process is made on one slide and fetched into the box of a text on
// another. The box shows it in the builder and to the student, where it
// fits the box and follows it when the box is widened; and it stays when
// the figure on the slide is taken away. Needs `npm run build`. The window
// is never shown, and nothing touches the network. The content is test
// content, not subject matter.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import type { MoreBlock, Project } from '../src/shared/format/schema';
import { OFFLINE } from './fixtures/offline';

const root = resolve(__dirname, '..');
const built =
  existsSync(join(root, 'out/main/index.js')) && existsSync(join(root, 'out/player/player.js'));
const packaged = process.env.LYSARK_APP;
const shots = process.env.LYSARK_SHOTS;

type FigureBlock = Extract<MoreBlock, { kind: 'figure' }>;

describe.skipIf(!built)('a figure in a "Lær mer" box, end to end', () => {
  let work: string;
  let projectDir: string;
  let app: ElectronApplication;
  let page: Page;

  const shot = async (target: Page, name: string): Promise<void> => {
    if (!shots) return;
    mkdirSync(shots, { recursive: true });
    await target.screenshot({ path: join(shots, `${name}.png`) });
  };
  const save = async (): Promise<Project> => {
    await page
      .locator('.topbar-actions')
      .getByRole('button', { name: /^Lagre/ })
      .click();
    await expect.poll(() => page.locator('.topbar-actions').textContent()).toContain('Lagret');
    return JSON.parse(readFileSync(join(projectDir, 'prosjekt.json'), 'utf8')) as Project;
  };
  const blockOf = (project: Project): FigureBlock =>
    project.scenes[0]!.elements.find((el) => el.id === 'e_tekst')!.more!.blocks.find(
      (block): block is FigureBlock => block.kind === 'figure',
    )!;
  /** How wide the figure is drawn, and how wide its holder is, in a window. */
  const drawn = (target: Page, within: string): Promise<{ holder: number; stage: number }> =>
    target.evaluate((selector) => {
      const holder = document.querySelector(`${selector} .lm-drawing`)!;
      const stage = holder.querySelector('.lm-stage')!;
      return {
        holder: holder.getBoundingClientRect().width,
        stage: stage.getBoundingClientRect().width,
      };
    }, within);
  const openBuilder = async (): Promise<void> => {
    await page.locator('.scene-item').first().click();
    await page.locator('.stage-inner [data-el="e_tekst"]').click({ position: { x: 20, y: 20 } });
    await page.getByRole('button', { name: /«Lær mer»$/ }).click();
    await page.waitForSelector('.builder');
  };

  beforeAll(async () => {
    work = mkdtempSync(join(tmpdir(), 'lysark-hent-'));
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
    project.scenes[0]!.elements.push({
      id: 'e_tekst',
      type: 'text',
      role: 'body',
      content: richText('Tekst A'),
      align: 'left',
      valign: 'top',
      box: { x: 120, y: 300, w: 500, h: 70, rotation: 0 },
    });
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

  it('says where a figure is made, when the slides have none', async () => {
    await openBuilder();
    await page.locator('.block-add').getByRole('button', { name: 'Figur' }).click();
    const picker = page.locator('dialog.figure-picker');
    await picker.waitFor();
    expect(await picker.locator('h2').textContent()).toBe('Hent en figur fra et lysark');
    expect(await picker.locator('p').first().textContent()).toContain(
      'Det er ingen figurer i lysarkene ennå',
    );
    expect(await picker.locator('.figure-choice').count()).toBe(0);
    // Escape puts the list away, and the builder stays.
    await page.keyboard.press('Escape');
    await expect.poll(() => picker.count()).toBe(0);
    expect(await page.locator('.builder').count()).toBe(1);
    await page.locator('.builder').getByRole('button', { name: 'Ferdig' }).click();
    await expect.poll(() => page.locator('.builder').count()).toBe(0);
  }, 60_000);

  it('fetches a process from another slide into the box, as a copy', async () => {
    // The figure is made on the second slide.
    await page.locator('.scene-item').nth(1).click();
    await page.waitForSelector('.stage-inner [data-el="e_tittel_B"]');
    await page.locator('.insertbar').getByRole('button', { name: 'Figur' }).click();
    await page.locator('.insertbar .menu').getByRole('menuitem', { name: 'Prosess' }).click();
    for (const [index, text] of ['A', 'B', 'C'].entries()) {
      await page.getByLabel(`Tekst i boks ${index + 1}`).fill(text);
    }
    await expect
      .poll(() => page.locator('.stage-inner .ls-shape-content').allTextContents())
      .toEqual(['A', 'B', 'C']);

    await openBuilder();
    await page.locator('.block-add').getByRole('button', { name: 'Figur' }).click();
    const picker = page.locator('dialog.figure-picker');
    const choices = picker.locator('.figure-choice');
    await expect.poll(() => choices.count()).toBe(1);
    expect(await choices.first().textContent()).toBe('ABCLysark 2: Prosess');
    // The figure is drawn on the button, as large as the button has room for.
    await expect
      .poll(() =>
        choices.first().evaluate((button) => {
          const frame = button.querySelector('.drawing-thumb')!.getBoundingClientRect();
          const stage = button.querySelector('.lm-stage')!.getBoundingClientRect();
          return Math.abs(frame.width - stage.width) < 1 && stage.height > 10;
        }),
      )
      .toBe(true);
    // The list has come all the way in before the picture is taken.
    await expect
      .poll(() => picker.evaluate((el) => getComputedStyle(el).opacity), { timeout: 15_000 })
      .toBe('1');
    await shot(page, 'h01-velg-figur');
    await choices.first().click();
    await expect.poll(() => picker.count()).toBe(0);

    // The card of the figure, and the box as the student sees it.
    const card = page.locator('.block-card');
    await expect.poll(() => card.count()).toBe(1);
    expect(await card.locator('.block-kind').textContent()).toBe('Figur');
    const preview = page.locator('.builder-panel');
    await expect.poll(() => preview.locator('.lm-stage').textContent()).toBe('ABC');
    expect(await preview.locator('.lm-stage > .ls-el-shape').count()).toBe(5);
    // The figure fills its holder: neither cut nor smaller than it.
    await expect
      .poll(async () => {
        const { holder, stage } = await drawn(page, '.builder-panel');
        return Math.abs(holder - stage);
      })
      .toBeLessThan(1);
    await card.getByLabel('Beskrivelse for skjermleser').fill('Tre bokser med piler mellom');
    await card.getByLabel('Figurtekst (vises under figuren)').fill('Figurtekst A');
    await expect.poll(() => preview.locator('figcaption').textContent()).toBe('Figurtekst A');
    expect(await preview.locator('.lm-drawing').getAttribute('aria-label')).toBe(
      'Tre bokser med piler mellom',
    );
    await shot(page, 'h02-figur-i-boksen');
    await page.locator('.builder').getByRole('button', { name: 'Ferdig' }).click();

    const project = await save();
    const block = blockOf(project);
    expect(block.alt).toBe('Tre bokser med piler mellom');
    expect(block.caption).toBe('Figurtekst A');
    // The form and what it draws: three boxes and the two arrows between them.
    expect(block.elements.map((el) => el.type).sort()).toEqual([
      'figure',
      'shape',
      'shape',
      'shape',
      'shape',
      'shape',
    ]);
    const onSlide = new Set(project.scenes[1]!.elements.map((el) => el.id));
    expect(block.elements.some((el) => onSlide.has(el.id))).toBe(false);
    expect(project.scenes[1]!.elements.filter((el) => el.type === 'shape')).toHaveLength(5);
  }, 120_000);

  it('keeps the figure in the box when the one on the slide is changed and taken away', async () => {
    await page.locator('.scene-item').nth(1).click();
    await page.waitForSelector('.stage-inner .ls-el-shape');
    await page.locator('.stage-inner .ls-el-shape').first().click();
    await page.getByLabel('Tekst i boks 1').fill('Endret');
    let project = await save();
    expect(blockOf(project).elements.some((el) => JSON.stringify(el).includes('Endret'))).toBe(
      false,
    );

    // Fetched anew, the box has the figure as it is now.
    await openBuilder();
    await page.locator('.block-card').getByRole('button', { name: 'Hent på nytt' }).click();
    const picker = page.locator('dialog.figure-picker');
    await picker.locator('.figure-choice').first().click();
    await expect
      .poll(() => page.locator('.builder-panel .lm-stage').textContent())
      .toBe('EndretBC');
    // What was written about the figure stays.
    expect(
      await page.locator('.block-card').getByLabel('Beskrivelse for skjermleser').inputValue(),
    ).toBe('Tre bokser med piler mellom');
    await page.locator('.builder').getByRole('button', { name: 'Ferdig' }).click();

    // The figure on the slide is deleted; the box keeps its own.
    await page.locator('.scene-item').nth(1).click();
    await page.waitForSelector('.stage-inner .ls-el-shape');
    await page.locator('.stage-inner .ls-el-shape').first().click();
    await page.locator('.panel-body').getByRole('button', { name: 'Slett' }).click();
    project = await save();
    expect(project.scenes[1]!.elements.map((el) => el.id)).toEqual(['e_tittel_B']);
    expect(blockOf(project).elements).toHaveLength(6);
  }, 120_000);

  it('shows the figure to the student, as large as the box allows', async () => {
    const opened = app.waitForEvent('window');
    await page.getByRole('button', { name: 'Forhåndsvis' }).click();
    const player = await opened;
    await player.waitForSelector('.lp-stage .ls-scene');
    await player.keyboard.press('Home');
    const badge = player.locator('.lp-stage [data-el="e_tekst"] .ls-more-badge');
    await badge.click();
    const panel = player.locator('.lp-panel');
    await player.waitForSelector('.lp-panel:not([hidden])');
    expect(await panel.locator('.lm-stage').textContent()).toBe('EndretBC');
    expect(await panel.locator('figcaption').textContent()).toBe('Figurtekst A');
    await expect
      .poll(async () => {
        const { holder, stage } = await drawn(player, '.lp-panel');
        return Math.abs(holder - stage);
      })
      .toBeLessThan(1);
    const narrow = await drawn(player, '.lp-panel');
    // The texts of the figure are those of the slide, not those of the box: white on purple.
    expect(
      await panel
        .locator('.lm-stage .ls-shape-content')
        .first()
        .evaluate((el) => getComputedStyle(el).color),
    ).toBe('rgb(255, 255, 255)');
    await expect
      .poll(() => panel.evaluate((el) => getComputedStyle(el).opacity), { timeout: 15_000 })
      .toBe('1');
    await shot(player, 'h03-hos-studenten');

    // Widened, the box gives the figure more room, and the figure follows.
    await panel.getByRole('button', { name: 'Utvid' }).click();
    await expect
      .poll(async () => (await drawn(player, '.lp-panel')).holder)
      .toBeGreaterThan(narrow.holder);
    await expect
      .poll(async () => {
        const { holder, stage } = await drawn(player, '.lp-panel');
        return Math.abs(holder - stage);
      })
      .toBeLessThan(1);
    await shot(player, 'h04-utvidet');
    await player.close();
  }, 120_000);
});
