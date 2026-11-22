import { createHash } from 'node:crypto';
import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { importPptx, type ImportResult } from '../src/importer/pptx';
import { parseXml } from '../src/importer/xml';
import {
  Project,
  type Element,
  type ImageElement,
  type ShapeElement,
  type TableElement,
  type TextElement,
  type VideoElement,
} from '../src/shared/format/schema';
import {
  LAYOUT_BLANK,
  LAYOUT_CONTENT,
  LAYOUT_SECTION,
  LAYOUT_TITLE,
  LAYOUT_TITLE_BOXES,
  MASTER_BODY_BOX,
  MASTER_TITLE_BOX,
  REL,
  STANDARD,
  URI,
  buildPptx,
  cell,
  connector,
  defaultMasterShapes,
  graphicFrame,
  group,
  para,
  pic,
  run,
  sp,
  table,
  textBox,
  tinyPng,
  txBody,
  xfrm,
  type DeckSpec,
  type SlideSpec,
} from './fixtures/buildPptx';

// ---------- Helpers ----------

/** Imports a built deck and checks that the project is valid. */
function load(spec: DeckSpec, fileName = 'Test.pptx'): ImportResult {
  const result = importPptx(buildPptx(spec), { fileName });
  expect(() => Project.parse(result.project)).not.toThrow();
  return result;
}

function elementsOf(result: ImportResult, slide = 0): Element[] {
  return result.project.scenes[slide]!.elements;
}

function ofType<T extends Element>(result: ImportResult, type: T['type'], slide = 0): T[] {
  return elementsOf(result, slide).filter((element): element is T => element.type === type);
}

const textsOf = (result: ImportResult, slide = 0) => ofType<TextElement>(result, 'text', slide);
const shapesOf = (result: ImportResult, slide = 0) => ofType<ShapeElement>(result, 'shape', slide);
const imagesOf = (result: ImportResult, slide = 0) => ofType<ImageElement>(result, 'image', slide);

function codesOf(result: ImportResult, slide = 0): string[] {
  return result.project.scenes[slide]!.imported!.warnings.map((warning) => warning.code);
}

function plain(element: TextElement | ShapeElement): string[] {
  return (element.content?.paragraphs ?? []).map((p) => p.runs.map((r) => r.text).join(''));
}

function titleSp(text: string): string {
  return sp({ ph: 'type="title"', body: txBody(para(text)) });
}

function bodySp(paragraphs: string, options: Parameters<typeof txBody>[1] = {}): string {
  return sp({ ph: 'idx="1"', body: txBody(paragraphs, options) });
}

const RECT = '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
const solid = (color: string): string => `<a:solidFill>${color}</a:solidFill>`;
const srgb = (hex: string): string => `<a:srgbClr val="${hex}"/>`;
const scheme = (name: string): string => `<a:schemeClr val="${name}"/>`;
const line = (extra = ''): string => `<a:ln w="12700">${solid(srgb('000000'))}${extra}</a:ln>`;

const PNG_A = tinyPng(1, 2, 3);
const PNG_B = tinyPng(3, 2, 1);
const imageRel = (id: string, file: string) => ({
  id,
  type: REL.image,
  target: `../media/${file}`,
});

function mediaFileName(data: Uint8Array, extension: string): string {
  return `media/${createHash('sha256').update(data).digest('hex').slice(0, 16)}.${extension}`;
}

// ---------- Presentation ----------

describe('presentation', () => {
  it('follows the slide order of p:sldIdLst', () => {
    const result = load({
      slides: [{ shapes: titleSp('A') }, { shapes: titleSp('B') }, { shapes: titleSp('C') }],
      order: [2, 0, 1],
    });
    expect(result.project.scenes.map((scene) => scene.title)).toEqual(['C', 'A', 'B']);
    expect(result.project.scenes.map((scene) => scene.imported?.slide)).toEqual([1, 2, 3]);
    expect(result.report.slides).toBe(3);
  });

  it('names scenes without a title by their number', () => {
    const result = load({ slides: [{ shapes: titleSp('A') }, { shapes: '' }] });
    expect(result.project.scenes.map((scene) => scene.title)).toEqual(['A', 'Lysark 2']);
  });

  it('takes the project title from the document properties, else from the file name', () => {
    const slides: SlideSpec[] = [{ shapes: titleSp('A') }];
    expect(load({ slides, coreTitle: 'Tittel' }).project.meta.title).toBe('Tittel');
    expect(load({ slides }, 'Fil 1.pptx').project.meta.title).toBe('Fil 1');
    expect(load({ slides, coreTitle: '  ' }, 'Fil 2.pptx').project.meta.title).toBe('Fil 2');
    expect(
      load({ slides, coreTitle: 'PowerPoint-presentasjon' }, 'Fil 3.pptx').project.meta.title,
    ).toBe('Fil 3');
    expect(load({ slides }).project.meta.language).toBe('nb');
  });

  it('counts the elements it creates', () => {
    const result = load({
      media: { 'image1.png': PNG_A },
      slides: [
        {
          rels: [imageRel('rIdImage', 'image1.png')],
          shapes:
            titleSp('A') +
            bodySp(para('B')) +
            pic({ embed: 'rIdImage', xfrm: xfrm(0, 0, 100, 100) }) +
            sp({ xfrm: xfrm(0, 0, 100, 100), spPr: RECT + solid(srgb('000000')) }) +
            graphicFrame(0, 0, 100, 100, URI.table, table([100], [[cell('1')]])),
        },
      ],
    });
    expect(result.report).toMatchObject({ texts: 2, images: 1, shapes: 1, tables: 1, videos: 0 });
  });
});

// ---------- Geometry ----------

describe('geometry', () => {
  it('lets placeholders inherit their position from the layout', () => {
    const result = load({
      layouts: [LAYOUT_TITLE],
      slides: [
        {
          shapes:
            sp({ ph: 'type="ctrTitle"', body: txBody(para('A')) }) +
            sp({ ph: 'type="subTitle" idx="1"', body: txBody(para('B')) }),
        },
      ],
    });
    const [title, subtitle] = textsOf(result);
    expect(title!.box).toEqual({ ...LAYOUT_TITLE_BOXES.title, rotation: 0 });
    expect(subtitle!.box).toEqual({ ...LAYOUT_TITLE_BOXES.subtitle, rotation: 0 });
  });

  it('lets placeholders inherit their position from the master', () => {
    const result = load({ slides: [{ shapes: titleSp('A') + bodySp(para('B')) }] });
    const [title, body] = textsOf(result);
    expect(title!.box).toEqual({ ...MASTER_TITLE_BOX, rotation: 0 });
    expect(body!.box).toEqual({ ...MASTER_BODY_BOX, rotation: 0 });
  });

  it("uses the placeholder's own position when it has one", () => {
    const result = load({
      slides: [
        {
          shapes: sp({
            ph: 'type="title"',
            xfrm: xfrm(10, 20, 300, 40, ' rot="5400000"'),
            body: txBody(para('A')),
          }),
        },
      ],
    });
    expect(textsOf(result)[0]!.box).toEqual({ x: 10, y: 20, w: 300, h: 40, rotation: 90 });
  });

  it('flattens groups, also nested ones', () => {
    const inner = group({
      // In the outer group's child coordinates; children are drawn at double size.
      frame: { x: 400, y: 200, w: 400, h: 200 },
      child: { x: 1000, y: 1000, w: 200, h: 100 },
      children: textBox(1050, 1025, 100, 50, txBody(para('B'))),
    });
    const outer = group({
      // Children are drawn at half size.
      frame: { x: 100, y: 100, w: 400, h: 200 },
      child: { x: 0, y: 0, w: 800, h: 400 },
      children: textBox(200, 100, 400, 200, txBody(para('A'))) + inner,
    });
    const result = load({ layouts: [LAYOUT_BLANK], slides: [{ shapes: outer }] });
    const [a, b] = textsOf(result);
    expect(plain(a!)).toEqual(['A']);
    expect(a!.box).toEqual({ x: 200, y: 150, w: 200, h: 100, rotation: 0 });
    expect(plain(b!)).toEqual(['B']);
    expect(b!.box).toEqual({ x: 350, y: 225, w: 100, h: 50, rotation: 0 });
  });

  it('mirrors the children of a flipped group', () => {
    const flipped = group({
      frame: { x: 0, y: 0, w: 400, h: 200 },
      attrs: ' flipH="1"',
      children: sp({ xfrm: xfrm(0, 0, 100, 50), spPr: RECT + solid(srgb('000000')) }),
    });
    const result = load({ layouts: [LAYOUT_BLANK], slides: [{ shapes: flipped }] });
    expect(shapesOf(result)[0]!.box).toEqual({ x: 300, y: 0, w: 100, h: 50, rotation: 0 });
  });

  it('turns the children of a rotated group around its centre', () => {
    const rotated = group({
      frame: { x: 0, y: 0, w: 400, h: 200 },
      attrs: ' rot="5400000"',
      // Left of the centre; a quarter turn clockwise moves it above the centre.
      children: sp({ xfrm: xfrm(0, 50, 100, 100), spPr: RECT + solid(srgb('000000')) }),
    });
    const result = load({ layouts: [LAYOUT_BLANK], slides: [{ shapes: rotated }] });
    expect(shapesOf(result)[0]!.box).toEqual({ x: 150, y: -100, w: 100, h: 100, rotation: 90 });
  });

  it('keeps the z-order of the shape tree', () => {
    const result = load({
      layouts: [LAYOUT_BLANK],
      media: { 'image1.png': PNG_A },
      slides: [
        {
          rels: [imageRel('rIdImage', 'image1.png')],
          shapes:
            sp({ xfrm: xfrm(0, 0, 10, 10), spPr: RECT + solid(srgb('000000')) }) +
            pic({ embed: 'rIdImage', xfrm: xfrm(0, 0, 10, 10) }) +
            textBox(0, 0, 10, 10, txBody(para('A'))) +
            group({
              frame: { x: 0, y: 0, w: 10, h: 10 },
              children: pic({ embed: 'rIdImage', xfrm: xfrm(0, 0, 10, 10) }),
            }) +
            sp({ xfrm: xfrm(0, 0, 10, 10), spPr: RECT + solid(srgb('000000')) }),
        },
      ],
    });
    expect(elementsOf(result).map((element) => element.type)).toEqual([
      'shape',
      'image',
      'text',
      'image',
      'shape',
    ]);
  });

  it('centres a 4:3 slide on the stage', () => {
    const result = load({
      size: STANDARD,
      layouts: [LAYOUT_BLANK],
      slides: [
        {
          shapes:
            textBox(0, 0, 1440, 1080, txBody(para('A'))) +
            textBox(100, 200, 300, 400, txBody(para(run('B', 'sz="1800"')))),
        },
      ],
    });
    const [whole, part] = textsOf(result);
    expect(whole!.box).toEqual({ x: 240, y: 0, w: 1440, h: 1080, rotation: 0 });
    expect(part!.box).toEqual({ x: 340, y: 200, w: 300, h: 400, rotation: 0 });
    expect(part!.fontSize).toBe(36);
  });
});

// ---------- Scenes ----------

describe('scenes', () => {
  it('takes the scene kind from the type of the layout', () => {
    const result = load({
      layouts: [LAYOUT_CONTENT, LAYOUT_TITLE, LAYOUT_SECTION, LAYOUT_BLANK, { shapes: '' }],
      slides: [{ layout: 1 }, { layout: 2 }, { layout: 0 }, { layout: 3 }, { layout: 4 }],
    });
    expect(result.project.scenes.map((scene) => scene.kind)).toEqual([
      'title',
      'section',
      'content',
      'content',
      'content',
    ]);
  });

  it('shows the decoration only on title and section scenes where it is free', () => {
    const titleShapes =
      sp({ ph: 'type="ctrTitle"', body: txBody(para('A')) }) +
      sp({ ph: 'type="subTitle" idx="1"', body: txBody(para('B')) });
    const result = load({
      layouts: [LAYOUT_TITLE, LAYOUT_SECTION, LAYOUT_CONTENT],
      slides: [
        { layout: 0, shapes: titleShapes },
        { layout: 0, shapes: titleShapes + textBox(1200, 200, 300, 100, txBody(para('C'))) },
        { layout: 1, shapes: titleSp('A') },
        { layout: 2, shapes: '' },
      ],
    });
    const scenes = result.project.scenes;
    expect(scenes.map((scene) => scene.decoration)).toEqual([true, false, true, false]);
    expect(scenes.map((scene) => scene.shapeVariant)).toEqual([0, 1, 2, 0]);
    expect(scenes.every((scene) => scene.showLogo && scene.timeline.length === 0)).toBe(true);
  });

  it('turns the notes into the script', () => {
    const result = load({
      slides: [{ shapes: titleSp('A'), notes: ['A', 'B', ''] }, { shapes: titleSp('B') }],
    });
    expect(result.project.scenes[0]!.script).toBe('A\nB');
    expect(result.project.scenes[1]!.script).toBe('');
    expect(result.report.notes).toBe(1);
  });

  it('imports hidden slides with a warning', () => {
    const result = load({ slides: [{ shapes: titleSp('A'), hidden: true }, { shapes: '' }] });
    expect(result.project.scenes).toHaveLength(2);
    expect(codesOf(result, 0)).toEqual(['hidden']);
    expect(codesOf(result, 1)).toEqual([]);
    expect(result.report.warnings).toEqual([
      { slide: 1, code: 'hidden', message: expect.stringContaining('skjult') },
    ]);
  });

  it('warns once about animations', () => {
    const animated =
      '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>' +
      '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>' +
      '<p:par><p:cTn id="3" fill="hold"><p:childTnLst>' +
      '<p:set><p:cBhvr><p:cTn id="4" dur="1" fill="hold"/><p:tgtEl><p:spTgt spid="2"/></p:tgtEl></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>' +
      '<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="5" dur="500"/><p:tgtEl><p:spTgt spid="2"/></p:tgtEl></p:cBhvr></p:animEffect>' +
      '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>' +
      '<p:bldLst><p:bldP spid="2" grpId="0"/></p:bldLst></p:timing>';
    // The timing PowerPoint writes for a video is not an animation.
    const videoOnly =
      '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>' +
      '<p:video><p:cMediaNode vol="80000"><p:cTn id="2" fill="hold" display="0"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="4"/></p:tgtEl></p:cMediaNode></p:video>' +
      '</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>';
    const result = load({
      slides: [
        { shapes: titleSp('A'), timing: animated },
        { shapes: titleSp('B'), timing: videoOnly },
      ],
    });
    expect(codesOf(result, 0)).toEqual(['animation']);
    expect(result.project.scenes[0]!.imported!.warnings[0]!.message).toBe(
      'Animasjonene fra PowerPoint følger ikke med. Bruk steg i stedet.',
    );
    expect(codesOf(result, 1)).toEqual([]);
  });

  it('warns about a background picture on the slide', () => {
    const picture =
      '<p:bg><p:bgPr><a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="rIdBackground"/><a:stretch><a:fillRect/></a:stretch></a:blipFill><a:effectLst/></p:bgPr></p:bg>';
    const colour = `<p:bg><p:bgPr>${solid(scheme('bg1'))}<a:effectLst/></p:bgPr></p:bg>`;
    const result = load({
      media: { 'image1.png': PNG_A },
      slides: [
        { background: picture, rels: [imageRel('rIdBackground', 'image1.png')] },
        { background: colour },
      ],
    });
    expect(codesOf(result, 0)).toEqual(['background']);
    expect(elementsOf(result, 0)).toEqual([]);
    expect(codesOf(result, 1)).toEqual([]);
    expect(result.media).toEqual([]);
  });
});

// ---------- Text ----------

describe('text', () => {
  it('gives placeholders and text boxes their roles', () => {
    const result = load({
      layouts: [LAYOUT_TITLE, LAYOUT_CONTENT],
      slides: [
        {
          layout: 0,
          shapes:
            sp({ ph: 'type="ctrTitle"', body: txBody(para('Tittel')) }) +
            sp({ ph: 'type="subTitle" idx="1"', body: txBody(para('A')) }),
        },
        {
          layout: 1,
          shapes:
            titleSp('B') +
            bodySp(para('C')) +
            textBox(0, 0, 100, 100, txBody(para('D'))) +
            sp({ ph: 'type="dt" sz="half" idx="10"', body: txBody(para('1.1.2000')) }) +
            sp({ ph: 'type="ftr" sz="quarter" idx="11"', body: txBody(para('E')) }) +
            sp({ ph: 'type="sldNum" sz="quarter" idx="12"', body: txBody(para('2')) }),
        },
      ],
    });
    expect(textsOf(result, 0).map((t) => [t.role, plain(t)[0]])).toEqual([
      ['title', 'Tittel'],
      ['subtitle', 'A'],
    ]);
    expect(textsOf(result, 1).map((t) => [t.role, plain(t)[0]])).toEqual([
      ['title', 'B'],
      ['body', 'C'],
      ['body', 'D'],
    ]);
    expect(result.project.scenes[0]!.title).toBe('Tittel');
    expect(textsOf(result, 0).every((t) => t.color === undefined)).toBe(true);
  });

  it('skips text elements without text and drops trailing empty paragraphs', () => {
    const result = load({
      slides: [
        {
          shapes:
            sp({ ph: 'type="title"', body: txBody('') }) +
            bodySp(para('A') + para('') + para('B') + para('') + para(run(' '))) +
            textBox(0, 0, 100, 100, txBody(para(''))),
        },
      ],
    });
    const texts = textsOf(result);
    expect(texts).toHaveLength(1);
    expect(plain(texts[0]!)).toEqual(['A', '', 'B']);
  });

  it('reads paragraph levels and clamps them', () => {
    const result = load({
      slides: [
        {
          shapes: bodySp(
            para('A') +
              para('B', '<a:pPr lvl="1"/>') +
              para('C', '<a:pPr lvl="4"/>') +
              para('D', '<a:pPr lvl="7"/>'),
          ),
        },
      ],
    });
    expect(textsOf(result)[0]!.content.paragraphs.map((p) => p.level)).toEqual([0, 1, 4, 4]);
  });

  it("takes bullets from the paragraph's own properties first", () => {
    const result = load({
      slides: [
        {
          shapes: bodySp(
            para('A', '<a:pPr><a:buNone/></a:pPr>') +
              para('B', '<a:pPr><a:buAutoNum type="arabicPeriod"/></a:pPr>') +
              para('C', '<a:pPr><a:buFont typeface="Arial"/><a:buChar char="-"/></a:pPr>') +
              para('D', '<a:pPr><a:buBlip><a:blip r:embed="rIdBullet"/></a:buBlip></a:pPr>'),
            // The shape's own list style loses against the paragraph.
            { lstStyle: '<a:lvl1pPr><a:buAutoNum type="arabicPeriod"/></a:lvl1pPr>' },
          ),
        },
      ],
    });
    expect(textsOf(result)[0]!.content.paragraphs.map((p) => p.list)).toEqual([
      'none',
      'number',
      'bullet',
      'bullet',
    ]);
  });

  it("takes bullets from the shape's list style, per level", () => {
    const result = load({
      slides: [
        {
          shapes: bodySp(para('A') + para('B', '<a:pPr lvl="1"/>'), {
            lstStyle: '<a:lvl1pPr><a:buNone/></a:lvl1pPr>',
          }),
        },
      ],
    });
    // Level 1 falls through to the master's body style, which has bullets.
    expect(textsOf(result)[0]!.content.paragraphs.map((p) => p.list)).toEqual(['none', 'bullet']);
  });

  it('takes bullets from the list style of the layout placeholder', () => {
    const result = load({
      layouts: [
        {
          type: 'obj',
          shapes: sp({
            ph: 'idx="1"',
            body: txBody(para('Tekst'), {
              lstStyle: '<a:lvl1pPr><a:buAutoNum type="arabicPeriod"/></a:lvl1pPr>',
            }),
          }),
        },
        LAYOUT_TITLE,
      ],
      slides: [
        { layout: 0, shapes: bodySp(para('A')) },
        { layout: 1, shapes: sp({ ph: 'type="subTitle" idx="1"', body: txBody(para('B')) }) },
      ],
    });
    expect(textsOf(result, 0)[0]!.content.paragraphs[0]!.list).toBe('number');
    // The subtitle of a title layout switches the body bullets off.
    expect(textsOf(result, 1)[0]!.content.paragraphs[0]!.list).toBe('none');
  });

  it('takes bullets from the list style of the master placeholder', () => {
    const result = load({
      masterShapes: defaultMasterShapes(
        '<a:lvl1pPr><a:buAutoNum type="arabicPeriod"/></a:lvl1pPr>',
      ),
      slides: [{ shapes: bodySp(para('A') + para('B', '<a:pPr lvl="1"/>')) }],
    });
    expect(textsOf(result)[0]!.content.paragraphs.map((p) => p.list)).toEqual(['number', 'bullet']);
  });

  it("takes bullets from the master's text styles", () => {
    const result = load({
      txStyles:
        '<p:titleStyle><a:lvl1pPr><a:buNone/></a:lvl1pPr></p:titleStyle>' +
        '<p:bodyStyle><a:lvl1pPr><a:buChar char="-"/></a:lvl1pPr></p:bodyStyle>' +
        '<p:otherStyle><a:lvl1pPr><a:buAutoNum type="arabicPeriod"/></a:lvl1pPr></p:otherStyle>',
      slides: [
        {
          shapes: titleSp('A') + bodySp(para('B')) + textBox(0, 0, 100, 100, txBody(para('C'))),
        },
      ],
    });
    expect(textsOf(result).map((t) => t.content.paragraphs[0]!.list)).toEqual([
      'none',
      'bullet',
      'number',
    ]);
  });

  it('has no bullets when nothing in the chain says so', () => {
    const result = load({
      txStyles: '',
      slides: [{ shapes: bodySp(para('A')) + textBox(0, 0, 100, 100, txBody(para('B'))) }],
    });
    expect(textsOf(result).map((t) => t.content.paragraphs[0]!.list)).toEqual(['none', 'none']);
  });

  it('reads bold and italic from the runs only, and merges equal runs', () => {
    const result = load({
      slides: [
        {
          shapes:
            // The master's title style is bold; that is the theme's business.
            titleSp('A') +
            bodySp(
              para(
                run('A ') +
                  run('B', 'b="1"') +
                  run('C', 'b="1"') +
                  run('D', 'i="1"') +
                  run('E', 'b="1" i="1"') +
                  run('F', 'b="0" i="0"'),
              ),
            ),
        },
      ],
    });
    const [title, body] = textsOf(result);
    expect(title!.content.paragraphs[0]!.runs).toEqual([{ text: 'A' }]);
    expect(body!.content.paragraphs[0]!.runs).toEqual([
      { text: 'A ' },
      { text: 'BC', bold: true },
      { text: 'D', italic: true },
      { text: 'E', bold: true, italic: true },
      { text: 'F' },
    ]);
  });

  it('keeps links to the web and to other slides', () => {
    const link = (id: string, action = ''): string =>
      `<a:hlinkClick r:id="${id}"${action ? ` action="${action}"` : ''}/>`;
    const result = load({
      slides: [
        {
          rels: [
            { id: 'rIdWeb', type: REL.hyperlink, target: 'https://example.org/a', external: true },
            { id: 'rIdMail', type: REL.hyperlink, target: 'mailto:a@example.org', external: true },
            { id: 'rIdFile', type: REL.hyperlink, target: 'file:///C:/a.docx', external: true },
            { id: 'rIdJump', type: REL.slide, target: 'slide2.xml' },
          ],
          shapes: bodySp(
            para(
              run('A', '', link('rIdWeb')) +
                run('B', '', link('rIdMail')) +
                run('C', '', link('rIdFile')) +
                run('D', '', link('rIdJump', 'ppaction://hlinksldjump')) +
                run('E', '', link('rIdMissing')),
            ),
          ),
        },
        { shapes: titleSp('B') },
      ],
    });
    const target = result.project.scenes[1]!.id;
    expect(textsOf(result)[0]!.content.paragraphs[0]!.runs).toEqual([
      { text: 'A', link: 'https://example.org/a' },
      { text: 'B', link: 'mailto:a@example.org' },
      { text: 'C' },
      { text: 'D', link: `#scene:${target}` },
      { text: 'E' },
    ]);
  });

  it('turns line breaks into new lines and keeps white space and fields', () => {
    const result = load({
      slides: [
        {
          shapes:
            sp({
              ph: 'type="title"',
              body: txBody(`<a:p>${run('A')}<a:br><a:rPr lang="nb-NO"/></a:br>${run('B')}</a:p>`),
            }) +
            bodySp(
              `<a:p><a:br/>${run(' A & B  ')}${run('C', 'b="1"')}<a:br/></a:p>` +
                `<a:p><a:fld id="{00000000-0000-0000-0000-000000000000}" type="slidenum"><a:rPr lang="nb-NO"/><a:t>1</a:t></a:fld></a:p>` +
                '<a:p><a:r><a:t>&#197; &lt;1&gt;</a:t></a:r><a:endParaRPr lang="nb-NO" sz="9900"/></a:p>',
            ),
        },
      ],
    });
    const [title, body] = textsOf(result);
    expect(title!.content.paragraphs[0]!.runs).toEqual([{ text: 'A\nB' }]);
    expect(result.project.scenes[0]!.title).toBe('A B');
    expect(body!.content.paragraphs.map((p) => p.runs)).toEqual([
      [{ text: '\n A & B  ' }, { text: 'C\n', bold: true }],
      [{ text: '1' }],
      [{ text: 'Å <1>' }],
    ]);
  });

  it('resolves the font size through the inheritance chain', () => {
    const result = load({
      layouts: [LAYOUT_CONTENT, LAYOUT_TITLE],
      slides: [
        {
          layout: 0,
          shapes:
            // Master text styles: 44 pt title, 28 pt body.
            titleSp('A') +
            bodySp(para('B')) +
            // The run's own size.
            textBox(0, 0, 100, 100, txBody(para(run('C', 'sz="2000"')))) +
            // The shape's list style.
            textBox(
              0,
              0,
              100,
              100,
              txBody(para('D'), { lstStyle: '<a:lvl1pPr><a:defRPr sz="3200"/></a:lvl1pPr>' }),
            ) +
            // The master's style for other text: 18 pt.
            textBox(0, 0, 100, 100, txBody(para('E'))),
        },
        {
          layout: 1,
          // The list styles of the layout placeholders: 60 pt and 24 pt.
          shapes:
            sp({ ph: 'type="ctrTitle"', body: txBody(para('F')) }) +
            sp({ ph: 'type="subTitle" idx="1"', body: txBody(para('G')) }),
        },
      ],
    });
    expect(textsOf(result, 0).map((t) => t.fontSize)).toEqual([88, 56, 40, 64, 36]);
    expect(textsOf(result, 1).map((t) => t.fontSize)).toEqual([120, 48]);
  });

  it('resolves the font size from the master placeholder and the presentation default', () => {
    const fromMaster = load({
      masterShapes: defaultMasterShapes('<a:lvl1pPr><a:defRPr sz="2000"/></a:lvl1pPr>'),
      slides: [{ shapes: bodySp(para('A')) }],
    });
    expect(textsOf(fromMaster)[0]!.fontSize).toBe(40);

    const fromDefault = load({
      txStyles: '',
      defaultTextStyle: '<a:lvl1pPr><a:defRPr sz="2400"/></a:lvl1pPr>',
      slides: [{ shapes: textBox(0, 0, 100, 100, txBody(para('A'))) }],
    });
    expect(textsOf(fromDefault)[0]!.fontSize).toBe(48);
  });

  it('uses the size that covers the most characters, scaled by autofit', () => {
    const result = load({
      slides: [
        {
          shapes:
            textBox(
              0,
              0,
              100,
              100,
              txBody(para(run('A', 'sz="4000"') + run('BBBB', 'sz="2000"'))),
            ) +
            // Level 0 is 28 pt and level 1 is 24 pt in the master's body style.
            bodySp(para('A') + para('BBB', '<a:pPr lvl="1"/>')) +
            bodySp(para('A'), {
              bodyPr:
                '<a:bodyPr><a:normAutofit fontScale="50000" lnSpcReduction="10000"/></a:bodyPr>',
            }),
        },
      ],
    });
    expect(textsOf(result).map((t) => t.fontSize)).toEqual([40, 48, 28]);
  });

  it('leaves the font size out when none can be resolved', () => {
    const result = load({
      txStyles: '',
      slides: [{ shapes: bodySp(para('A')) + textBox(0, 0, 100, 100, txBody(para('B'))) }],
    });
    expect(textsOf(result).map((t) => 'fontSize' in t)).toEqual([false, false]);
  });

  it('resolves the alignment covering the most paragraphs', () => {
    const result = load({
      layouts: [LAYOUT_CONTENT, LAYOUT_TITLE],
      slides: [
        {
          layout: 0,
          shapes:
            titleSp('A') +
            bodySp(
              para('A', '<a:pPr algn="r"/>') +
                para('B', '<a:pPr algn="r"/>') +
                para('C', '<a:pPr algn="ctr"/>'),
            ) +
            textBox(0, 0, 100, 100, txBody(para('A', '<a:pPr algn="just"/>'))) +
            textBox(0, 0, 100, 100, txBody(para('A'), { lstStyle: '<a:lvl1pPr algn="ctr"/>' })),
        },
        { layout: 1, shapes: sp({ ph: 'type="ctrTitle"', body: txBody(para('A')) }) },
      ],
    });
    expect(textsOf(result, 0).map((t) => t.align)).toEqual(['left', 'right', 'left', 'center']);
    // From the list style of the layout placeholder.
    expect(textsOf(result, 1)[0]!.align).toBe('center');
  });

  it('resolves the vertical alignment from shape, layout and master', () => {
    const result = load({
      layouts: [LAYOUT_CONTENT, LAYOUT_TITLE],
      slides: [
        {
          layout: 0,
          shapes:
            // The master's title placeholder is anchored in the middle.
            titleSp('A') +
            bodySp(para('B')) +
            bodySp(para('C'), { bodyPr: '<a:bodyPr anchor="b"/>' }) +
            textBox(0, 0, 100, 100, txBody(para('D'), { bodyPr: '<a:bodyPr anchor="ctr"/>' })) +
            textBox(0, 0, 100, 100, txBody(para('E'))),
        },
        // The layout's title placeholder is anchored at the bottom.
        { layout: 1, shapes: sp({ ph: 'type="ctrTitle"', body: txBody(para('F')) }) },
      ],
    });
    expect(textsOf(result, 0).map((t) => t.valign)).toEqual([
      'middle',
      'top',
      'bottom',
      'middle',
      'top',
    ]);
    expect(textsOf(result, 1)[0]!.valign).toBe('bottom');
  });
});

// ---------- Pictures ----------

describe('pictures', () => {
  it('imports a picture with alt text and crop', () => {
    const result = load({
      media: { 'image1.png': PNG_A, 'image2.jpeg': PNG_B },
      slides: [
        {
          rels: [
            imageRel('rIdA', 'image1.png'),
            // An absolute target, as some programs write them.
            { id: 'rIdB', type: REL.image, target: '/ppt/media/image2.jpeg' },
          ],
          shapes:
            pic({
              embed: 'rIdA',
              xfrm: xfrm(100, 200, 300, 400),
              descr: ' A & B ',
              srcRect: 'l="10000" t="20000" r="30000" b="40000"',
            }) +
            pic({
              embed: 'rIdB',
              xfrm: xfrm(0, 0, 10, 10),
              srcRect: 'l="0" t="0" r="0" b="0"',
              // Marked as decorative in PowerPoint.
              cNvPrChildren:
                '<a:extLst><a:ext uri="{C183D7F6-B498-43B3-948B-1728B52AA6E4}"><adec:decorative xmlns:adec="http://schemas.microsoft.com/office/drawing/2017/decorative" val="1"/></a:ext></a:extLst>',
            }),
        },
      ],
    });
    const [a, b] = imagesOf(result);
    expect(a!.box).toEqual({ x: 100, y: 200, w: 300, h: 400, rotation: 0 });
    expect(a!.alt).toBe('A & B');
    expect('decorative' in a!).toBe(false);
    expect(a!.crop).toEqual({ l: 0.1, t: 0.2, r: 0.3, b: 0.4 });
    expect(b!.alt).toBe('');
    expect(b!.decorative).toBe(true);
    expect('crop' in b!).toBe(false);

    const fileA = mediaFileName(PNG_A, 'png');
    expect(result.project.assets[a!.asset]).toEqual({
      kind: 'image',
      file: fileA,
      mime: 'image/png',
      bytes: PNG_A.length,
      name: 'image1.png',
    });
    expect(result.project.assets[b!.asset]).toMatchObject({
      file: mediaFileName(PNG_B, 'jpg'),
      mime: 'image/jpeg',
      name: 'image2.jpeg',
    });
    expect(result.media.find((entry) => entry.file === fileA)?.data).toEqual(PNG_A);
    expect(result.media).toHaveLength(2);
  });

  it('stores identical pictures once', () => {
    const result = load({
      media: { 'image1.png': PNG_A, 'image2.png': PNG_A, 'image3.png': PNG_B },
      slides: [
        {
          rels: [imageRel('rIdA', 'image1.png'), imageRel('rIdB', 'image2.png')],
          shapes:
            pic({ embed: 'rIdA', xfrm: xfrm(0, 0, 10, 10) }) +
            pic({ embed: 'rIdB', xfrm: xfrm(0, 0, 10, 10) }),
        },
        {
          rels: [imageRel('rIdA', 'image1.png'), imageRel('rIdC', 'image3.png')],
          shapes:
            pic({ embed: 'rIdA', xfrm: xfrm(0, 0, 10, 10) }) +
            pic({ embed: 'rIdC', xfrm: xfrm(0, 0, 10, 10) }),
        },
      ],
    });
    const assets = [...imagesOf(result, 0), ...imagesOf(result, 1)].map((image) => image.asset);
    expect(assets[0]).toBe(assets[1]);
    expect(assets[0]).toBe(assets[2]);
    expect(assets[3]).not.toBe(assets[0]);
    expect(Object.keys(result.project.assets)).toHaveLength(2);
    expect(result.media.map((entry) => entry.file).sort()).toEqual(
      [mediaFileName(PNG_A, 'png'), mediaFileName(PNG_B, 'png')].sort(),
    );
  });

  it('leaves out pictures in formats that cannot be shown, with a warning', () => {
    const result = load({
      media: { 'image1.emf': new Uint8Array([1, 2, 3]) },
      slides: [
        {
          rels: [imageRel('rIdA', 'image1.emf')],
          shapes: pic({ embed: 'rIdA', xfrm: xfrm(0, 0, 10, 10) }),
        },
      ],
    });
    expect(elementsOf(result)).toEqual([]);
    expect(result.media).toEqual([]);
    expect(result.report.warnings).toEqual([
      {
        slide: 1,
        code: 'image-format',
        message:
          'Et bilde i formatet EMF kan ikke vises og følger ikke med. Lagre det som PNG i PowerPoint og sett det inn på nytt.',
      },
    ]);
  });

  it('warns about pictures that are missing or only linked', () => {
    const result = load({
      slides: [
        {
          rels: [
            imageRel('rIdMissing', 'image9.png'),
            {
              id: 'rIdLinked',
              type: REL.image,
              target: 'file:///C:/a.png',
              external: true,
            },
          ],
          shapes:
            pic({ embed: 'rIdMissing', xfrm: xfrm(0, 0, 10, 10) }) +
            pic({ embed: 'rIdLinked', xfrm: xfrm(0, 0, 10, 10) }),
        },
      ],
    });
    expect(elementsOf(result)).toEqual([]);
    expect(result.report.warnings.map((warning) => [warning.code, warning.message])).toEqual([
      ['other', 'Et bilde mangler i fila og følger ikke med.'],
      ['other', 'Et bilde som er lenket til en fil utenfor presentasjonen, følger ikke med.'],
    ]);
  });

  it('imports a shape with a picture fill as an image', () => {
    const result = load({
      media: { 'image1.png': PNG_A },
      slides: [
        {
          rels: [imageRel('rIdA', 'image1.png')],
          shapes: sp({
            xfrm: xfrm(10, 20, 30, 40),
            spPr: `${RECT}<a:blipFill><a:blip r:embed="rIdA"/><a:stretch><a:fillRect/></a:stretch></a:blipFill>`,
          }),
        },
      ],
    });
    expect(elementsOf(result)).toHaveLength(1);
    expect(imagesOf(result)[0]!.box).toEqual({ x: 10, y: 20, w: 30, h: 40, rotation: 0 });
  });
});

// ---------- Video and sound ----------

describe('video and sound', () => {
  const MP4 = new Uint8Array([1, 2, 3, 4]);
  const mediaNvPr = (videoRel: string, mediaRel: string): string =>
    `<a:videoFile r:link="${videoRel}"/><p:extLst><p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}"><p14:media r:embed="${mediaRel}"/></p:ext></p:extLst>`;

  it('imports an embedded MP4 as a video with the picture as poster', () => {
    const result = load({
      media: { 'image1.png': PNG_A, 'media1.mp4': MP4 },
      slides: [
        {
          rels: [
            imageRel('rIdPoster', 'image1.png'),
            { id: 'rIdVideo', type: REL.video, target: '../media/media1.mp4' },
            { id: 'rIdMedia', type: REL.media, target: '../media/media1.mp4' },
          ],
          shapes:
            pic({
              embed: 'rIdPoster',
              xfrm: xfrm(100, 100, 640, 360),
              name: 'A',
              descr: 'B',
              nvPr: mediaNvPr('rIdVideo', 'rIdMedia'),
            }) +
            pic({
              embed: 'rIdPoster',
              xfrm: xfrm(0, 0, 10, 10),
              name: 'C',
              nvPr: mediaNvPr('rIdVideo', 'rIdMedia'),
            }),
        },
      ],
    });
    const [video, second] = ofType<VideoElement>(result, 'video');
    expect(elementsOf(result)).toHaveLength(2);
    expect(video!.box).toEqual({ x: 100, y: 100, w: 640, h: 360, rotation: 0 });
    expect(video!.title).toBe('B');
    expect(second!.title).toBe('C');
    expect(video!.source.kind).toBe('asset');
    const asset = video!.source.kind === 'asset' ? video!.source.asset : '';
    expect(result.project.assets[asset]).toEqual({
      kind: 'video',
      file: mediaFileName(MP4, 'mp4'),
      mime: 'video/mp4',
      bytes: MP4.length,
      name: 'media1.mp4',
    });
    expect(result.project.assets[video!.poster!]).toMatchObject({ kind: 'image' });
    expect(result.report.videos).toBe(2);
    expect(result.report.images).toBe(0);
    expect(codesOf(result)).toEqual([]);
  });

  it('imports only the poster of a video in an unsupported format', () => {
    const result = load({
      media: { 'image1.png': PNG_A, 'media1.wmv': MP4 },
      slides: [
        {
          rels: [
            imageRel('rIdPoster', 'image1.png'),
            { id: 'rIdVideo', type: REL.video, target: '../media/media1.wmv' },
            { id: 'rIdMedia', type: REL.media, target: '../media/media1.wmv' },
          ],
          shapes: pic({
            embed: 'rIdPoster',
            xfrm: xfrm(0, 0, 10, 10),
            nvPr: mediaNvPr('rIdVideo', 'rIdMedia'),
          }),
        },
      ],
    });
    expect(elementsOf(result).map((element) => element.type)).toEqual(['image']);
    expect(codesOf(result)).toEqual(['media']);
    expect(result.report.warnings[0]!.message).toContain('WMV');
    expect(Object.values(result.project.assets).map((asset) => asset.kind)).toEqual(['image']);
  });

  it('imports a linked web video as a URL', () => {
    const result = load({
      media: { 'image1.png': PNG_A },
      slides: [
        {
          rels: [
            imageRel('rIdPoster', 'image1.png'),
            {
              id: 'rIdVideo',
              type: REL.video,
              target: 'https://example.org/video',
              external: true,
            },
          ],
          shapes: pic({
            embed: 'rIdPoster',
            xfrm: xfrm(0, 0, 10, 10),
            nvPr: '<a:videoFile r:link="rIdVideo"/>',
          }),
        },
      ],
    });
    const video = ofType<VideoElement>(result, 'video')[0]!;
    expect(video.source).toEqual({ kind: 'url', url: 'https://example.org/video' });
    expect(codesOf(result)).toEqual([]);
  });

  it('leaves out sound, with a warning', () => {
    const result = load({
      media: { 'image1.png': PNG_A, 'media1.mp3': MP4 },
      slides: [
        {
          rels: [
            imageRel('rIdIcon', 'image1.png'),
            { id: 'rIdAudio', type: REL.audio, target: '../media/media1.mp3' },
            { id: 'rIdMedia', type: REL.media, target: '../media/media1.mp3' },
          ],
          shapes: pic({
            embed: 'rIdIcon',
            xfrm: xfrm(0, 0, 10, 10),
            nvPr: `<a:audioFile r:link="rIdAudio"/><p:extLst><p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}"><p14:media r:embed="rIdMedia"/></p:ext></p:extLst>`,
          }),
        },
      ],
    });
    expect(elementsOf(result)).toEqual([]);
    expect(result.report.warnings).toEqual([
      { slide: 1, code: 'media', message: 'Lyd fra PowerPoint følger ikke med.' },
    ]);
  });
});

// ---------- Shapes ----------

describe('shapes', () => {
  function shapesFrom(shapes: string, extra: Partial<DeckSpec> = {}): ImportResult {
    return load({ layouts: [LAYOUT_BLANK], slides: [{ shapes }], ...extra });
  }

  it('maps an RGB fill to the nearest palette colour', () => {
    const result = shapesFrom(
      sp({ xfrm: xfrm(10, 20, 30, 40), spPr: RECT + solid(srgb('FF6202')) }) +
        sp({ xfrm: xfrm(0, 0, 10, 10), spPr: RECT + solid(srgb('FE0000')) }) +
        sp({ xfrm: xfrm(0, 0, 10, 10), spPr: RECT + solid('<a:prstClr val="black"/>') }) +
        sp({
          xfrm: xfrm(0, 0, 10, 10),
          spPr: RECT + solid('<a:sysClr val="window" lastClr="FFFFFF"/>'),
        }),
    );
    const shapes = shapesOf(result);
    expect(shapes[0]).toMatchObject({
      type: 'shape',
      geometry: 'rect',
      fill: 'oransje',
      box: { x: 10, y: 20, w: 30, h: 40, rotation: 0 },
    });
    expect(shapes.map((shape) => shape.fill)).toEqual(['oransje', 'oransje', 'sort', 'hvit']);
    expect(shapes.every((shape) => shape.stroke === undefined)).toBe(true);
  });

  it('resolves scheme colours through the colour map and the theme', () => {
    const shapes =
      sp({ xfrm: xfrm(0, 0, 10, 10), spPr: RECT + solid(scheme('accent1')) }) +
      sp({ xfrm: xfrm(0, 0, 10, 10), spPr: RECT + solid(scheme('tx1')) }) +
      sp({ xfrm: xfrm(0, 0, 10, 10), spPr: RECT + solid(scheme('bg1')) }) +
      sp({
        xfrm: xfrm(0, 0, 10, 10),
        // Colour modifiers are ignored.
        spPr: RECT + solid('<a:schemeClr val="accent2"><a:lumMod val="75000"/></a:schemeClr>'),
      });
    expect(shapesOf(shapesFrom(shapes)).map((shape) => shape.fill)).toEqual([
      'lilla',
      'sort',
      'hvit',
      'oransje',
    ]);
    // A dark master maps text to the light colour and background to the dark one.
    const dark = shapesFrom(shapes, {
      clrMap:
        'bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"',
    });
    expect(shapesOf(dark).map((shape) => shape.fill)).toEqual(['lilla', 'hvit', 'sort', 'oransje']);
  });

  it('reads fills from gradients and from the shape style', () => {
    const style =
      `<p:style><a:lnRef idx="2">${scheme('accent1')}</a:lnRef><a:fillRef idx="1">${scheme('accent3')}</a:fillRef>` +
      `<a:effectRef idx="0">${scheme('accent1')}</a:effectRef><a:fontRef idx="minor">${scheme('lt1')}</a:fontRef></p:style>`;
    const gradient = `<a:gradFill><a:gsLst><a:gs pos="0">${srgb('CFFF1F')}</a:gs><a:gs pos="100000">${srgb('000000')}</a:gs></a:gsLst><a:lin ang="5400000" scaled="1"/></a:gradFill>`;
    const result = shapesFrom(
      sp({ xfrm: xfrm(0, 0, 10, 10), spPr: RECT, style }) +
        sp({ xfrm: xfrm(0, 0, 10, 10), spPr: RECT + gradient }) +
        // An explicit "no fill" wins over the style; the style's line remains.
        sp({ xfrm: xfrm(0, 0, 10, 10), spPr: `${RECT}<a:noFill/>`, style }),
    );
    expect(shapesOf(result).map((shape) => [shape.fill, shape.stroke])).toEqual([
      ['rosa', undefined],
      ['syregronn', undefined],
      [undefined, 'lilla'],
    ]);
  });

  it('keeps the stroke only for shapes without a fill', () => {
    const result = shapesFrom(
      sp({ xfrm: xfrm(0, 0, 10, 10), spPr: `${RECT}<a:noFill/>${line()}` }) +
        sp({ xfrm: xfrm(0, 0, 10, 10), spPr: RECT + solid(srgb('FFFFFF')) + line() }),
    );
    expect(shapesOf(result).map((shape) => [shape.fill, shape.stroke])).toEqual([
      [undefined, 'sort'],
      ['hvit', undefined],
    ]);
  });

  it('maps rectangles, rounded rectangles and ellipses', () => {
    const preset = (name: string): string =>
      sp({
        xfrm: xfrm(0, 0, 10, 10),
        spPr: `<a:prstGeom prst="${name}"><a:avLst/></a:prstGeom>${solid(srgb('000000'))}`,
      });
    const result = shapesFrom(
      [
        'rect',
        'roundRect',
        'round1Rect',
        'round2SameRect',
        'round2DiagRect',
        'snipRoundRect',
        'ellipse',
      ]
        .map(preset)
        .join(''),
    );
    expect(shapesOf(result).map((shape) => shape.geometry)).toEqual([
      'rect',
      'roundRect',
      'roundRect',
      'roundRect',
      'roundRect',
      'roundRect',
      'ellipse',
    ]);
    expect(codesOf(result)).toEqual([]);
  });

  it('keeps the text of a shape, and turns invisible shapes into text or nothing', () => {
    const result = shapesFrom(
      sp({
        xfrm: xfrm(0, 0, 100, 100),
        spPr: RECT + solid(srgb('000000')),
        body: txBody(para('A') + para(run('B', 'b="1"'))),
      }) +
        sp({ xfrm: xfrm(10, 20, 30, 40), spPr: RECT, body: txBody(para('C')) }) +
        sp({ xfrm: xfrm(0, 0, 100, 100), spPr: RECT }) +
        sp({ xfrm: xfrm(0, 0, 100, 100), spPr: `${RECT}<a:noFill/><a:ln><a:noFill/></a:ln>` }),
    );
    expect(elementsOf(result).map((element) => element.type)).toEqual(['shape', 'text']);
    const shape = shapesOf(result)[0]!;
    expect(shape.content?.paragraphs.map((p) => p.runs)).toEqual([
      [{ text: 'A' }],
      [{ text: 'B', bold: true }],
    ]);
    // 18 pt from the master's style for other text.
    expect(shape.fontSize).toBe(36);
    const text = textsOf(result)[0]!;
    expect(text).toMatchObject({
      role: 'body',
      box: { x: 10, y: 20, w: 30, h: 40, rotation: 0 },
    });
    expect(plain(text)).toEqual(['C']);
  });

  it('leaves out shapes that are hidden in PowerPoint', () => {
    const result = shapesFrom(
      sp({
        xfrm: xfrm(0, 0, 10, 10),
        spPr: RECT + solid(srgb('000000')),
        cNvPrAttrs: ' hidden="1"',
      }) + textBox(0, 0, 100, 100, txBody(para('A'))),
    );
    expect(elementsOf(result).map((element) => element.type)).toEqual(['text']);
  });

  it('tells lines from arrows and turns arrows the right way', () => {
    const head = '<a:headEnd type="triangle"/>';
    const tail = '<a:tailEnd type="triangle"/>';
    const result = shapesFrom(
      sp({
        xfrm: xfrm(100, 100, 300, 200),
        spPr: `<a:prstGeom prst="line"><a:avLst/></a:prstGeom>${line()}`,
      }) +
        connector(xfrm(0, 0, 100, 100), line(tail)) +
        connector(xfrm(0, 0, 100, 100, ' flipV="1"'), line(tail)) +
        // Only a head at the start: the line is reversed.
        connector(xfrm(0, 0, 100, 100), line(head)) +
        connector(xfrm(0, 0, 100, 100, ' flipH="1"'), line(head)) +
        connector(xfrm(0, 0, 100, 100), line(head + tail)) +
        connector(xfrm(0, 0, 100, 100), line('<a:headEnd type="none"/><a:tailEnd type="none"/>')) +
        // A horizontal line has no height in PowerPoint.
        connector(xfrm(50, 60, 100, 0), line()) +
        // A bent connector becomes a straight line.
        connector(xfrm(0, 0, 100, 100, ' flipH="1" flipV="1"'), line(), 'bentConnector3') +
        // No visible stroke: nothing to show.
        connector(xfrm(0, 0, 100, 100), '<a:ln><a:noFill/></a:ln>'),
    );
    const shapes = shapesOf(result);
    expect(shapes.map((s) => [s.geometry, s.flipH ?? false, s.flipV ?? false])).toEqual([
      ['line', false, false],
      ['arrow', false, false],
      ['arrow', false, true],
      ['arrow', true, true],
      ['arrow', false, true],
      ['arrow', false, false],
      ['line', false, false],
      ['line', false, false],
      ['line', true, true],
    ]);
    expect(shapes[0]!.box).toEqual({ x: 100, y: 100, w: 300, h: 200, rotation: 0 });
    expect(shapes[7]!.box).toMatchObject({ x: 50, w: 100, h: 1 });
    expect(shapes.every((s) => s.stroke === 'sort' && s.fill === undefined)).toBe(true);
    expect(codesOf(result)).toEqual([]);
  });

  it('turns block arrows into arrows through the middle of the box', () => {
    const blockArrow = (name: string, w: number, h: number, attrs = ''): string =>
      sp({
        xfrm: xfrm(100, 100, w, h, attrs),
        spPr: `<a:prstGeom prst="${name}"><a:avLst/></a:prstGeom>${solid(scheme('accent2'))}${line()}`,
      });
    const result = shapesFrom(
      blockArrow('rightArrow', 400, 100) +
        blockArrow('leftArrow', 400, 100) +
        blockArrow('downArrow', 100, 400) +
        blockArrow('upArrow', 100, 400) +
        blockArrow('rightArrow', 400, 100, ' flipH="1"'),
    );
    const shapes = shapesOf(result);
    expect(shapes.map((s) => [s.geometry, s.stroke, s.fill])).toEqual(
      new Array(5).fill(['arrow', 'oransje', undefined]),
    );
    expect(shapes.map((s) => [s.flipH ?? false, s.flipV ?? false])).toEqual([
      [false, false],
      [true, false],
      [false, false],
      [false, true],
      [true, false],
    ]);
    expect(shapes[0]!.box).toEqual({ x: 100, y: 149.5, w: 400, h: 1, rotation: 0 });
    expect(shapes[2]!.box).toEqual({ x: 149.5, y: 100, w: 1, h: 400, rotation: 0 });
    expect(codesOf(result)).toEqual([]);
  });

  it('simplifies other geometries to rectangles with one warning per slide', () => {
    const result = shapesFrom(
      sp({
        xfrm: xfrm(0, 0, 10, 10),
        spPr: `<a:prstGeom prst="star5"><a:avLst/></a:prstGeom>${solid(srgb('000000'))}`,
      }) +
        sp({
          xfrm: xfrm(0, 0, 10, 10),
          spPr: `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst/></a:custGeom>${solid(srgb('000000'))}`,
        }),
    );
    expect(shapesOf(result).map((shape) => shape.geometry)).toEqual(['rect', 'rect']);
    expect(result.report.warnings).toEqual([
      { slide: 1, code: 'geometry', message: 'Noen former er forenklet til rektangler.' },
    ]);
  });
});

// ---------- Graphic frames ----------

describe('graphic frames', () => {
  const chartData =
    '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rIdChart"/>';
  const diagramData =
    '<dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" r:dm="rIdData" r:lo="rIdLayout2" r:qs="rIdStyle" r:cs="rIdColors"/>';

  it('imports a table with header row and merged cells', () => {
    const bulleted = `<a:tc>${txBody(para('5', '<a:pPr><a:buChar char="-"/></a:pPr>'), { tag: 'a:txBody' })}<a:tcPr/></a:tc>`;
    const result = load({
      layouts: [LAYOUT_BLANK],
      slides: [
        {
          shapes: graphicFrame(
            100,
            200,
            600,
            120,
            URI.table,
            table(
              [200, 300, 100],
              [
                [cell('A', ' gridSpan="2"'), cell('', ' hMerge="1"'), cell('B')],
                [cell('1', ' rowSpan="2"'), cell('2'), cell('3')],
                [cell('', ' vMerge="1"'), cell(''), bulleted],
              ],
            ),
          ),
        },
      ],
    });
    const element = ofType<TableElement>(result, 'table')[0]!;
    const text = (value: string, list = 'none') => ({
      paragraphs: [{ level: 0, list, runs: value ? [{ text: value }] : [] }],
    });
    expect(element.box).toEqual({ x: 100, y: 200, w: 600, h: 120, rotation: 0 });
    expect(element.columns).toEqual([200, 300, 100]);
    expect(element.headerRow).toBe(true);
    expect(element.rows).toEqual([
      [{ content: text('A'), colSpan: 2 }, { content: text('B') }],
      [{ content: text('1'), rowSpan: 2 }, { content: text('2') }, { content: text('3') }],
      [{ content: text('') }, { content: text('5', 'bullet') }],
    ]);
    // 18 pt from the master's style for other text.
    expect(element.fontSize).toBe(36);
    expect(result.report.tables).toBe(1);
    expect(codesOf(result)).toEqual([]);
  });

  it('reads a table without a header row', () => {
    const result = load({
      layouts: [LAYOUT_BLANK],
      slides: [
        {
          shapes: graphicFrame(
            0,
            0,
            100,
            40,
            URI.table,
            table([100], [[cell('1')]], 'bandRow="1"'),
          ),
        },
      ],
    });
    expect(ofType<TableElement>(result, 'table')[0]!.headerRow).toBe(false);
  });

  it('warns about charts, SmartArt and embedded objects', () => {
    const result = load({
      layouts: [LAYOUT_BLANK],
      slides: [
        { shapes: graphicFrame(0, 0, 100, 100, URI.chart, chartData) },
        { shapes: graphicFrame(0, 0, 100, 100, URI.diagram, diagramData) },
        {
          shapes: graphicFrame(
            0,
            0,
            100,
            100,
            URI.ole,
            '<p:oleObj name="Regneark" r:id="rIdObject" imgW="100" imgH="100" progId="Excel.Sheet.12"><p:embed/></p:oleObj>',
          ),
        },
      ],
    });
    expect(result.project.scenes.every((scene) => scene.elements.length === 0)).toBe(true);
    expect(result.report.warnings.map((w) => [w.slide, w.code])).toEqual([
      [1, 'chart'],
      [2, 'smartart'],
      [3, 'embedded-object'],
    ]);
    expect(result.report.warnings[1]!.message).toBe(
      'SmartArt-figuren følger ikke med og må lages på nytt.',
    );
  });

  it('imports the preview picture of an embedded object', () => {
    const oleWithPreview = (relId: string): string =>
      '<mc:AlternateContent><mc:Choice xmlns:v="urn:schemas-microsoft-com:vml" Requires="v">' +
      '<p:oleObj spid="_x0000_s1026" name="Regneark" r:id="rIdObject" imgW="100" imgH="100" progId="Excel.Sheet.12"><p:embed/></p:oleObj>' +
      '</mc:Choice><mc:Fallback><p:oleObj name="Regneark" r:id="rIdObject" imgW="100" imgH="100" progId="Excel.Sheet.12"><p:embed/>' +
      pic({ embed: relId, xfrm: xfrm(1, 2, 3, 4) }) +
      '</p:oleObj></mc:Fallback></mc:AlternateContent>';
    const result = load({
      layouts: [LAYOUT_BLANK],
      media: { 'image1.png': PNG_A, 'image2.emf': new Uint8Array([1, 2, 3]) },
      slides: [
        {
          rels: [imageRel('rIdPreview', 'image1.png')],
          shapes: graphicFrame(100, 200, 300, 400, URI.ole, oleWithPreview('rIdPreview')),
        },
        {
          rels: [imageRel('rIdPreview', 'image2.emf')],
          shapes: graphicFrame(100, 200, 300, 400, URI.ole, oleWithPreview('rIdPreview')),
        },
      ],
    });
    expect(imagesOf(result, 0)[0]!.box).toEqual({ x: 100, y: 200, w: 300, h: 400, rotation: 0 });
    expect(codesOf(result, 0)).toEqual(['embedded-object']);
    // A preview that cannot be shown gives no second warning.
    expect(elementsOf(result, 1)).toEqual([]);
    expect(codesOf(result, 1)).toEqual(['embedded-object']);
  });

  it('uses the fallback of alternate content', () => {
    const alternate = (choice: string, fallback?: string): string =>
      `<mc:AlternateContent><mc:Choice xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" Requires="a14">${choice}</mc:Choice>` +
      `${fallback === undefined ? '' : `<mc:Fallback>${fallback}</mc:Fallback>`}</mc:AlternateContent>`;
    const result = load({
      layouts: [LAYOUT_BLANK],
      media: { 'image1.png': PNG_A },
      slides: [
        {
          shapes:
            alternate(
              textBox(0, 0, 100, 100, txBody(para('A'))),
              textBox(0, 0, 100, 100, txBody(para('B'))),
            ) + alternate(textBox(0, 0, 100, 100, txBody(para('C')))),
        },
        {
          rels: [imageRel('rIdPicture', 'image1.png')],
          // A newer chart type with a picture of itself as fallback.
          shapes: alternate(
            graphicFrame(
              0,
              0,
              100,
              100,
              'http://schemas.microsoft.com/office/drawing/2014/chartex',
              '<cx:chart xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" r:id="rIdChart"/>',
            ),
            pic({ embed: 'rIdPicture', xfrm: xfrm(10, 20, 30, 40) }),
          ),
        },
      ],
    });
    expect(textsOf(result, 0).map((t) => plain(t)[0])).toEqual(['B', 'C']);
    expect(elementsOf(result, 1).map((element) => element.type)).toEqual(['image']);
    expect(codesOf(result, 1)).toEqual(['chart']);
  });
});

// ---------- Unreadable files ----------

describe('unreadable files', () => {
  it('rejects input that is not a zip file', () => {
    expect(() => importPptx(strToU8('ikke en zip-fil'), { fileName: 'a.pptx' })).toThrow(
      'Fila er ikke en lesbar PPTX-fil.',
    );
    expect(() => importPptx(new Uint8Array(0), { fileName: 'a.pptx' })).toThrow(/PPTX/);
  });

  it('rejects a zip file without a presentation', () => {
    const zip = zipSync({ 'a.txt': strToU8('A') });
    expect(() => importPptx(zip, { fileName: 'a.pptx' })).toThrow(/ppt\/presentation\.xml/);
  });

  it('rejects password-protected files and the old PPT format', () => {
    const ole = new Uint8Array(512);
    ole.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(() => importPptx(ole, { fileName: 'a.pptx' })).toThrow(/passordbeskyttet/);
  });
});

// ---------- XML ----------

describe('xml', () => {
  it('recognises the namespaces under other prefixes', () => {
    const root = parseXml(
      '<x:sld xmlns:x="http://schemas.openxmlformats.org/presentationml/2006/main" ' +
        'xmlns:d="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
        'xmlns:rel="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<d:blip rel:embed="rId1" cstate="print"/><d:t xml:space="preserve"> A </d:t></x:sld>',
    );
    expect(root?.name).toBe('p:sld');
    expect(root?.children.map((node) => node.name)).toEqual(['a:blip', 'a:t']);
    expect(root?.children[0]?.attrs).toEqual({ 'r:embed': 'rId1', cstate: 'print' });
    expect(root?.children[1]?.text).toBe(' A ');
  });
});
