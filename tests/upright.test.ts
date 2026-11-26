// Upright projects (9:16): the size of the stage, the theme laid out for
// it, pages and slides of another shape fitted whole onto it, and the shape
// Lysark recommends at import. Test content only ("A", "B", 1, 2, 3).
import { describe, expect, it } from 'vitest';
import { buildHtml } from '../src/exporter/html';
import { importHtml } from '../src/importer/html';
import { fitPage } from '../src/importer/pdf';
import { importPptx, pptxSlideSize } from '../src/importer/pptx';
import { recommendShape } from '../src/importer/shape';
import { newProject, newScene, richText } from '../src/shared/format/factory';
import {
  FORMAT_VERSION,
  Project,
  orientationOf,
  parseProject,
  stageFor,
  stageOf,
  type FigureElement,
  type TextElement,
} from '../src/shared/format/schema';
import { fitToGrid } from '../src/shared/layout/fitToGrid';
import { fitView, viewAround, wholeView } from '../src/shared/layout/steps';
import { newFigureSize } from '../src/shared/layout/templates';
import { cameraOnStage, defaultCameraPlace, videoSize } from '../src/shared/render/clock';
import { popView, seenBox } from '../src/shared/render/popover';
import { movesFrom } from '../src/shared/render/timeline';
import {
  THEME_REN,
  THEME_REN_UPRIGHT,
  columnEdges,
  getTheme,
  logoArea,
  overlapsDecoration,
  roomWidth,
} from '../src/shared/theme/theme';
import {
  EMU_PER_PX,
  LAYOUT_BLANK,
  REL,
  URI,
  WIDE,
  buildPptx,
  graphicFrame,
  para,
  run,
  textBox,
  txBody,
} from './fixtures/buildPptx';
import { sampleProject } from './fixtures/sampleProject';

const UPRIGHT = stageFor('portrait');
const LYING = stageFor('landscape');
const BARE = { bodyPr: '<a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/>' };
/** An upright deck: the stage turned, 1080 x 1920 pixels at 6350 EMU each. */
const TALL = { width: 1080 * EMU_PER_PX, height: 1920 * EMU_PER_PX };

describe('the stage of a project', () => {
  it('is lying unless the project says it is upright', () => {
    const project = newProject('A');
    expect(stageOf(project)).toEqual({ width: 1920, height: 1080 });
    expect(orientationOf(project)).toBe('landscape');
    project.orientation = 'portrait';
    expect(stageOf(project)).toEqual({ width: 1080, height: 1920 });
    expect(orientationOf(project)).toBe('portrait');
    expect(getTheme(project)).toBe(THEME_REN_UPRIGHT);
    expect(getTheme(newProject('B'))).toBe(THEME_REN);
  });

  it('is kept in the project file, and a file without it stays lying', () => {
    expect(FORMAT_VERSION).toBe(19);
    const upright = { ...newProject('A'), orientation: 'portrait' as const };
    expect(parseProject(JSON.parse(JSON.stringify(upright))).orientation).toBe('portrait');
    const old = { ...JSON.parse(JSON.stringify(newProject('B'))), version: 18 };
    const lifted = parseProject(old);
    expect(lifted.version).toBe(19);
    expect(lifted.orientation).toBeUndefined();
    expect(() => parseProject({ ...upright, orientation: 'landscape' })).toThrow();
  });

  it('gives a video and a "Lær mer" window of its own shape', () => {
    expect(videoSize(UPRIGHT)).toEqual({ width: 1080, height: 1920 });
    expect(videoSize(LYING)).toEqual({ width: 1920, height: 1080 });
    expect(popView(LYING)).toEqual({ width: 1280, height: 720 });
    expect(popView(UPRIGHT)).toEqual({ width: 720, height: 1280 });
  });

  it('zooms in parts of the shape of the slide, inside it', () => {
    expect(wholeView(UPRIGHT)).toEqual({ x: 0, y: 0, w: 1080, h: 1920 });
    const view = fitView({ x: 900, y: 1700, w: 540, h: 10 }, UPRIGHT);
    expect(view).toEqual({ x: 540, y: 960, w: 540, h: 960 });
    const around = viewAround([{ x: 100, y: 100, w: 200, h: 800 }], UPRIGHT);
    expect(around.w / around.h).toBeCloseTo(1080 / 1920, 2);
    expect(around.y + around.h).toBeLessThanOrEqual(1920);
    // Zoomed out again, the whole upright slide is shown, which is no zoom at all.
    const timeline = [
      { id: 't1', kind: 'zoom' as const, actions: [], zoom: view, seconds: 1 },
      { id: 't2', kind: 'zoom' as const, actions: [], seconds: 1 },
    ];
    expect(movesFrom({ timeline }, [Infinity, -1], UPRIGHT).view).toEqual(view);
    expect(movesFrom({ timeline }, [Infinity, Infinity], UPRIGHT).view).toBeUndefined();
    // A "Lær mer" box goes by where its element is seen under the zoom.
    expect(seenBox({ x: 540, y: 960, w: 270, h: 480 }, view, UPRIGHT)).toEqual({
      x: 0,
      y: 0,
      w: 540,
      h: 960,
    });
  });

  it('starts the camera circle in the lower right corner and keeps it on the slide', () => {
    expect(defaultCameraPlace(UPRIGHT)).toMatchObject({ x: 1080 - 193, y: 1920 - 193 });
    expect(defaultCameraPlace()).toMatchObject({ x: 1920 - 193, y: 1080 - 193 });
    expect(cameraOnStage(1500, 2500, 'large', UPRIGHT)).toEqual({ x: 880, y: 1720 });
  });
});

describe('the theme on an upright slide', () => {
  const theme = THEME_REN_UPRIGHT;

  it('has the lying theme’s colours, typefaces and margins, in four columns', () => {
    expect(theme.fonts).toEqual(THEME_REN.fonts);
    expect(theme.roles).toEqual(THEME_REN.roles);
    expect(theme.surfaces).toEqual(THEME_REN.surfaces);
    expect(theme.logo).toEqual(THEME_REN.logo);
    expect(theme.grid).toEqual({ ...THEME_REN.grid, columns: 4 });
    const { starts, ends } = columnEdges(theme);
    expect(starts[0]).toBe(120);
    expect(ends[3]).toBe(960);
    expect(roomWidth(theme)).toBe(840);
  });

  it('puts the brand shapes in the lower half, inside the margins and clear of the logo', () => {
    const d = theme.decoration;
    expect(d.x).toBeGreaterThanOrEqual(theme.grid.marginX);
    expect(d.x + d.w).toBeLessThanOrEqual(UPRIGHT.width - theme.grid.marginX);
    expect(d.y).toBeGreaterThan(UPRIGHT.height / 2);
    expect(overlapsDecoration(logoArea(theme, 'nb'), theme)).toBe(false);
    expect(logoArea(theme, 'nb').y + logoArea(theme, 'nb').h).toBeLessThanOrEqual(UPRIGHT.height);
  });

  it('tidies a title slide into the upper half, with the shapes below', () => {
    const scene = newScene('title', 'A');
    scene.elements.push(
      {
        id: 'e1',
        type: 'text',
        role: 'title',
        content: richText('A'),
        align: 'center',
        valign: 'middle',
        box: { x: 0, y: 1500, w: 1080, h: 300, rotation: 0 },
      },
      {
        id: 'e2',
        type: 'text',
        role: 'subtitle',
        content: richText('B'),
        align: 'center',
        valign: 'middle',
        box: { x: 0, y: 1800, w: 1080, h: 100, rotation: 0 },
      },
    );
    fitToGrid(scene, theme);
    for (const el of scene.elements) {
      expect(el.box.x).toBe(120);
      expect(el.box.x + el.box.w).toBe(960);
      expect(overlapsDecoration(el.box, theme)).toBe(false);
    }
    expect(scene.decoration).toBe(true);
  });

  it('makes new figures no wider than the room between the margins', () => {
    expect(newFigureSize('process', roomWidth(theme))).toEqual({ w: 840, h: 200 });
    expect(newFigureSize('layers', roomWidth(theme))).toEqual({ w: 840, h: 480 });
    expect(newFigureSize('process', roomWidth(THEME_REN))).toEqual({ w: 1500, h: 200 });
  });
});

describe('a page of another shape than the slide', () => {
  it('is put in whole on an upright slide, as large as it can be, centred', () => {
    // An upright A4 page fills the width and gets air above and below.
    const a4 = fitPage(595, 842, UPRIGHT);
    expect(a4.box.w).toBe(1080);
    expect(a4.box.h).toBeCloseTo((842 * 1080) / 595, 0);
    expect(a4.box.y).toBeCloseTo((1920 - a4.box.h) / 2, 5);
    expect(a4.box.x).toBe(0);
    // A lying page on an upright slide: the width, with more air.
    const wide = fitPage(720, 405, UPRIGHT);
    expect(wide.box).toEqual({ x: 0, y: 656.25, w: 1080, h: 607.5, rotation: 0 });
    expect(wide.pixelWidth).toBe(2160);
    // An upright 9:16 page fills an upright slide.
    expect(fitPage(405, 720, UPRIGHT).box).toEqual({ x: 0, y: 0, w: 1080, h: 1920, rotation: 0 });
  });

  it('keeps text where it stood on a lying PowerPoint slide made over onto an upright one', () => {
    const result = importPptx(
      buildPptx({
        layouts: [LAYOUT_BLANK],
        slides: [
          {
            shapes:
              textBox(0, 0, 1920, 1080, txBody(para('A'), BARE)) +
              textBox(960, 540, 480, 270, txBody(para(run('B', 'sz="1800"')), BARE)),
          },
        ],
      }),
      { fileName: 'A.pptx', orientation: 'portrait' },
    );
    expect(() => Project.parse(result.project)).not.toThrow();
    expect(result.project.orientation).toBe('portrait');
    const [whole, part] = result.project.scenes[0]!.elements as TextElement[];
    // One scale for both directions (1080 / 1920), centred from top to bottom.
    expect(whole!.box).toEqual({ x: 0, y: 656.25, w: 1080, h: 607.5, rotation: 0 });
    expect(part!.box).toEqual({ x: 540, y: 960, w: 270, h: 151.88, rotation: 0 });
    // 18 pt is 36 stage pixels on a lying slide; on the smaller picture of it, less.
    expect(part!.fontSize).toBeCloseTo(36 * (1080 / 1920), 0);
  });

  it('fills an upright slide with an upright PowerPoint slide', () => {
    const result = importPptx(
      buildPptx({
        size: TALL,
        layouts: [LAYOUT_BLANK],
        slides: [{ shapes: textBox(0, 0, 1080, 1920, txBody(para('A'), BARE)) }],
      }),
      { fileName: 'A.pptx', orientation: 'portrait' },
    );
    const [whole] = result.project.scenes[0]!.elements;
    expect(whole!.box).toEqual({ x: 0, y: 0, w: 1080, h: 1920, rotation: 0 });
  });

  it('keeps the numbers of a chart that is made over onto an upright slide', () => {
    const ns =
      'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
    const pts = (values: Array<string | number>): string =>
      `<c:ptCount val="${values.length}"/>` +
      values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
    const chart =
      `<c:chartSpace ${ns}><c:chart><c:plotArea><c:layout/>` +
      `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/>` +
      `<c:ser><c:idx val="0"/><c:order val="0"/>` +
      `<c:tx><c:strRef><c:f>Ark1!$B$1</c:f><c:strCache>${pts(['En'])}</c:strCache></c:strRef></c:tx>` +
      `<c:cat><c:strRef><c:f>Ark1!$A$2</c:f><c:strCache>${pts(['A', 'B', 'C'])}</c:strCache></c:strRef></c:cat>` +
      `<c:val><c:numRef><c:f>Ark1!$B$2</c:f><c:numCache><c:formatCode>General</c:formatCode>${pts([1, 2, 3])}</c:numCache></c:numRef></c:val>` +
      `</c:ser></c:barChart>` +
      `<c:catAx><c:axId val="1"/><c:scaling/><c:axPos val="b"/></c:catAx>` +
      `<c:valAx><c:axId val="2"/><c:axPos val="l"/></c:valAx>` +
      `</c:plotArea></c:chart></c:chartSpace>`;
    const result = importPptx(
      buildPptx({
        layouts: [LAYOUT_BLANK],
        parts: { 'ppt/charts/chart1.xml': chart },
        slides: [
          {
            rels: [{ id: 'rIdChart', type: REL.chart, target: '../charts/chart1.xml' }],
            shapes: graphicFrame(
              200,
              300,
              1000,
              500,
              URI.chart,
              '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rIdChart"/>',
            ),
          },
        ],
      }),
      { fileName: 'A.pptx', orientation: 'portrait' },
    );
    const figure = result.project.scenes[0]!.elements.find(
      (el): el is FigureElement => el.type === 'figure',
    )!;
    expect(figure.items.map((row) => [row.text, row.values])).toEqual([
      ['A', [1]],
      ['B', [2]],
      ['C', [3]],
    ]);
    expect(figure.yMin).toBeUndefined();
    expect(figure.yMax).toBeUndefined();
    // Where the chart stood, at the scale of the upright slide.
    expect(figure.box.x).toBeCloseTo(200 * 0.5625, 3);
    expect(figure.box.x + figure.box.w).toBeCloseTo(1200 * 0.5625, 3);
  });
});

describe('an exported HTML file of an upright project', () => {
  it('is opened as a project that is still upright', () => {
    const { project, media } = sampleProject();
    project.orientation = 'portrait';
    const html = buildHtml(project, {
      playerJs: '',
      readFont: () => new Uint8Array([1, 2, 3]),
      readAsset: (file) => (file === 'media/testbilde.png' ? media[0]!.data : new Uint8Array()),
      logo: {},
      sidecarHref: (_id, file) => file,
    }).html;
    expect(importHtml(html, () => undefined).project.orientation).toBe('portrait');
  });
});

describe('the shape Lysark recommends at import', () => {
  it('is the shape most of the pages have', () => {
    expect(recommendShape([{ width: 595, height: 842 }])).toBe('portrait');
    expect(recommendShape([{ width: 842, height: 595 }])).toBe('landscape');
    expect(
      recommendShape([
        { width: 595, height: 842 },
        { width: 595, height: 842 },
        { width: 842, height: 595 },
      ]),
    ).toBe('portrait');
  });

  it('is lying for square pages, an even split, and a file without pages', () => {
    expect(recommendShape([{ width: 500, height: 500 }])).toBe('landscape');
    expect(
      recommendShape([
        { width: 595, height: 842 },
        { width: 842, height: 595 },
      ]),
    ).toBe('landscape');
    expect(recommendShape([])).toBe('landscape');
    expect(recommendShape([{ width: 0, height: 100 }])).toBe('landscape');
  });

  it('reads the slide size of a PowerPoint file', () => {
    const upright = buildPptx({ size: TALL, layouts: [LAYOUT_BLANK], slides: [{ shapes: '' }] });
    expect(recommendShape([pptxSlideSize(upright)!])).toBe('portrait');
    const lying = buildPptx({ size: WIDE, layouts: [LAYOUT_BLANK], slides: [{ shapes: '' }] });
    expect(recommendShape([pptxSlideSize(lying)!])).toBe('landscape');
    expect(pptxSlideSize(new Uint8Array(4))).toBeUndefined();
  });
});
