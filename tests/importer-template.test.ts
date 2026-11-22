// Import rules that came from the owner's real lectures, which are built on
// USN's PowerPoint template: layouts without a type attribute, the
// template's own logo picture, text boxes with formulas, and table headers
// made by hand.
import { describe, expect, it } from 'vitest';
import { importPptx } from '../src/importer/pptx';
import { Project } from '../src/shared/format/schema';
import {
  LAYOUT_BLANK,
  REL,
  URI,
  buildPptx,
  graphicFrame,
  para,
  pic,
  sp,
  tinyPng,
  txBody,
  xfrm,
  type DeckSpec,
} from './fixtures/buildPptx';

function load(spec: DeckSpec) {
  const result = importPptx(buildPptx(spec), { fileName: 'Test.pptx' });
  expect(() => Project.parse(result.project)).not.toThrow();
  return result;
}

const text = (value: string): string => `<a:r><a:t>${value}</a:t></a:r>`;

describe('USN template', () => {
  it('reads the kind of scene from the layout name when the type is missing', () => {
    const names = [
      'Tittellysbilde',
      'Tittellysbilde #2',
      'Deloverskrift',
      'Avslutningsside med tekst',
      'Tittel og innhold',
      'Title Slide',
      'Section Header',
    ];
    const result = load({
      layouts: names.map((name) => ({ name, shapes: '' })),
      slides: names.map((_, layout) => ({ layout })),
    });
    expect(result.project.scenes.map((s) => s.kind)).toEqual([
      'title',
      'title',
      'section',
      'closing',
      'content',
      'title',
      'section',
    ]);
  });

  it('leaves out the template’s own logo picture, and nothing else', () => {
    const result = load({
      layouts: [LAYOUT_BLANK],
      media: { 'image1.png': tinyPng(1, 2, 3) },
      slides: [
        {
          rels: [{ id: 'rIdImage', type: REL.image, target: '../media/image1.png' }],
          shapes:
            pic({ embed: 'rIdImage', name: 'logo', xfrm: xfrm(0, 0, 100, 50) }) +
            pic({ embed: 'rIdImage', name: 'Bilde 4', xfrm: xfrm(200, 200, 100, 50) }),
        },
      ],
    });
    const scene = result.project.scenes[0]!;
    expect(scene.elements).toHaveLength(1);
    expect(scene.elements[0]!.box.x).toBe(200);
    expect(result.report.warnings).toEqual([]);
  });

  it('takes a text box with formulas as PowerPoint’s picture of it, with a warning', () => {
    const math =
      '<a14:m xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main"><m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:r><m:t>1+2</m:t></m:r></m:oMath></a14:m>';
    const body = txBody(para(text('Tekst A')) + para(text('Verdien er ') + math));
    const result = load({
      layouts: [LAYOUT_BLANK],
      media: { 'image1.png': tinyPng(1, 2, 3) },
      slides: [
        {
          rels: [{ id: 'rIdImage', type: REL.image, target: '../media/image1.png' }],
          shapes:
            '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">' +
            `<mc:Choice xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" Requires="a14">${sp({ xfrm: xfrm(100, 200, 800, 400), spPr: '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>', body, txBox: true })}</mc:Choice>` +
            `<mc:Fallback>${sp({
              xfrm: xfrm(100, 200, 800, 400),
              spPr: '<a:blipFill><a:blip r:embed="rIdImage"/><a:stretch><a:fillRect l="-2000" t="-1000"/></a:stretch></a:blipFill>',
              body: txBody(para(text(' '))),
              txBox: true,
            })}</mc:Fallback>` +
            '</mc:AlternateContent>',
        },
      ],
    });
    const elements = result.project.scenes[0]!.elements;
    expect(elements).toHaveLength(1);
    const picture = elements[0]!;
    expect(picture.type).toBe('image');
    // The formula is never spelled out as text: flattening it would garble it.
    if (picture.type === 'image') expect(picture.alt).toBe('Tekst A Verdien er [formel]');
    // The picture reaches a little outside the box, as PowerPoint draws it.
    expect(picture.box.x).toBeCloseTo(100 - 0.02 * 800);
    expect(picture.box.w).toBeCloseTo(800 * 1.02);
    expect(result.report.warnings.map((w) => w.code)).toEqual(['text']);
    expect(result.report.warnings[0]!.message).toMatch(/formler/);
  });

  it('lets what lies under ink from PowerPoint’s pen and highlighter show through', () => {
    const result = load({
      layouts: [LAYOUT_BLANK],
      media: { 'image1.png': tinyPng(1, 2, 3) },
      slides: [
        {
          rels: [{ id: 'rIdImage', type: REL.image, target: '../media/image1.png' }],
          shapes:
            '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">' +
            '<mc:Choice xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" Requires="p14"><p:contentPart r:id="rIdInk"/></mc:Choice>' +
            `<mc:Fallback>${pic({ embed: 'rIdImage', xfrm: xfrm(100, 200, 300, 20), name: 'Håndskrift 1' })}</mc:Fallback>` +
            '</mc:AlternateContent>' +
            pic({ embed: 'rIdImage', xfrm: xfrm(0, 0, 10, 10) }),
        },
      ],
    });
    const [ink, photo] = result.project.scenes[0]!.elements;
    expect(ink).toMatchObject({ type: 'image', blend: 'multiply', decorative: true, alt: '' });
    expect(photo).not.toHaveProperty('blend');
  });

  it('sees a header row that was made by filling the first row by hand', () => {
    const cell = (value: string, fill: boolean): string =>
      `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p>${text(value)}</a:p></a:txBody><a:tcPr>${fill ? '<a:solidFill><a:srgbClr val="CCCCCC"/></a:solidFill>' : ''}</a:tcPr></a:tc>`;
    const table = (firstFilled: boolean, secondFilled: boolean): string =>
      `<a:tbl><a:tblPr/><a:tblGrid><a:gridCol w="1000"/><a:gridCol w="1000"/></a:tblGrid>` +
      `<a:tr h="100">${cell('A', firstFilled)}${cell('B', firstFilled)}</a:tr>` +
      `<a:tr h="100">${cell('1', secondFilled)}${cell('2', secondFilled)}</a:tr></a:tbl>`;
    const result = load({
      layouts: [LAYOUT_BLANK],
      slides: [
        { shapes: graphicFrame(0, 0, 400, 200, URI.table, table(true, false)) },
        { shapes: graphicFrame(0, 0, 400, 200, URI.table, table(true, true)) },
        { shapes: graphicFrame(0, 0, 400, 200, URI.table, table(false, false)) },
      ],
    });
    const headers = result.project.scenes.map((scene) => {
      const element = scene.elements[0]!;
      return element.type === 'table' ? element.headerRow : undefined;
    });
    expect(headers).toEqual([true, false, false]);
  });

  it('sets running text smaller when the deck was laid out in a narrower font', () => {
    const slides = [
      {
        shapes:
          sp({
            ph: 'type="title"',
            body: txBody(para('<a:r><a:rPr sz="4000"/><a:t>Tittel</a:t></a:r>')),
          }) +
          sp({
            xfrm: xfrm(100, 300, 800, 200),
            spPr: '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>',
            body: txBody(para('<a:r><a:rPr sz="2000"/><a:t>Tekst</a:t></a:r>')),
            txBox: true,
          }),
      },
    ];
    const sizes = (bodyTypeface: string | undefined): Array<number | undefined> =>
      load({ bodyTypeface, slides }).project.scenes[0]!.elements.map((e) =>
        e.type === 'text' ? e.fontSize : undefined,
      );
    // 1 pt is 2 stage pixels. The title is set in the serif font and keeps its size.
    expect(sizes(undefined)).toEqual([80, 40]);
    // 20 pt at 0.9: lines in Liberation Sans are about a tenth wider than in Calibri.
    expect(sizes('Calibri')).toEqual([80, 36]);
    expect(sizes('Maison Neue Book')).toEqual([80, 36]);
    expect(sizes('Arial')).toEqual([80, 40]);
  });
});
