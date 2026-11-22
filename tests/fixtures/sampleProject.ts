// Builds a small project on disk for tests. The content is deliberately
// neutral ("A", "B", 1, 2, 3): it exercises every element type without
// pretending to be subject matter.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { newId, newProject, newScene, paragraph, richText } from '../../src/shared/format/factory';
import type { Project } from '../../src/shared/format/schema';

function crc32(bytes: Uint8Array): number {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** A plain two-colour PNG, enough to see that images are drawn and cropped. */
export function testPng(width: number, height: number): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      const left = x < width / 2;
      raw[row + 1 + x * 3] = left ? 0x78 : 0xff;
      raw[row + 2 + x * 3] = left ? 0x00 : 0x62;
      raw[row + 3 + x * 3] = left ? 0xf0 : 0x02;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function sampleProject(): {
  project: Project;
  media: Array<{ file: string; data: Buffer }>;
} {
  const project = newProject('Testforelesning');
  const png = testPng(400, 240);
  const imageId = newId('a');
  project.assets[imageId] = {
    kind: 'image',
    file: 'media/testbilde.png',
    mime: 'image/png',
    bytes: png.length,
    name: 'testbilde.png',
    credit: {
      title: 'Testbilde',
      author: 'Person A',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Testbilde.png',
      required: true,
    },
  };

  const front = newScene('title', 'Tittel');
  front.elements.push(
    {
      id: newId('e'),
      type: 'text',
      role: 'title',
      content: richText('Tittel A'),
      align: 'left',
      valign: 'bottom',
      box: { x: 120, y: 220, w: 960, h: 360, rotation: 0 },
    },
    {
      id: newId('e'),
      type: 'text',
      role: 'subtitle',
      content: richText('Undertittel B'),
      align: 'left',
      valign: 'top',
      box: { x: 120, y: 620, w: 960, h: 200, rotation: 0 },
    },
  );

  const content = newScene('content', 'Innhold');
  const bodyId = newId('e');
  const shapeId = newId('e');
  const tableId = newId('e');
  const deepId = newId('e');
  content.elements.push(
    {
      id: newId('e'),
      type: 'text',
      role: 'title',
      content: richText('Overskrift A'),
      align: 'left',
      valign: 'top',
      box: { x: 120, y: 96, w: 1680, h: 90, rotation: 0 },
    },
    {
      id: bodyId,
      type: 'text',
      role: 'body',
      content: {
        paragraphs: [
          paragraph('Punkt A', { list: 'bullet' }),
          paragraph('Punkt B', { list: 'bullet', level: 1 }),
          {
            level: 0,
            list: 'none',
            runs: [
              { text: 'Tekst med ' },
              { text: 'markering', mark: true },
              { text: ' og ' },
              { text: 'lenke', link: 'https://example.org/' },
              { text: '.' },
            ],
          },
        ],
      },
      align: 'left',
      valign: 'top',
      box: { x: 120, y: 222, w: 800, h: 300, rotation: 0 },
    },
    {
      id: newId('e'),
      type: 'image',
      asset: imageId,
      alt: 'Testbilde med to fargefelt',
      // Any element can carry "Lær mer" content. Nothing here is fetched
      // unless a viewer presses play, which no test does.
      more: {
        title: 'Om bildet',
        blocks: [
          { id: 'm1', kind: 'heading', text: 'Overskrift B' },
          { id: 'm2', kind: 'text', content: richText('Utdyping A.') },
          {
            id: 'm3',
            kind: 'table',
            columns: [1, 1],
            headerRow: true,
            rows: [
              [{ content: richText('A') }, { content: richText('B') }],
              [{ content: richText('1') }, { content: richText('2') }],
            ],
          },
          {
            id: 'm4',
            kind: 'video',
            source: { kind: 'url', url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' },
            title: 'Video A',
          },
          { id: 'm5', kind: 'embed', url: 'https://example.org/side', title: 'Side A' },
        ],
      },
      box: { x: 1000, y: 222, w: 400, h: 240, rotation: 0 },
    },
    {
      id: shapeId,
      type: 'shape',
      geometry: 'roundRect',
      fill: 'oransje',
      content: richText('Form A'),
      box: { x: 1000, y: 520, w: 360, h: 160, rotation: 0 },
    },
    {
      id: newId('e'),
      type: 'shape',
      geometry: 'arrow',
      box: { x: 1400, y: 600, w: 300, h: 1, rotation: 0 },
    },
    {
      id: tableId,
      type: 'table',
      columns: [1, 1, 1],
      headerRow: true,
      rows: [
        [{ content: richText('A') }, { content: richText('B') }, { content: richText('C') }],
        [{ content: richText('1') }, { content: richText('2') }, { content: richText('3') }],
      ],
      box: { x: 120, y: 560, w: 800, h: 150, rotation: 0 },
    },
    {
      id: deepId,
      type: 'deepdive',
      label: 'Mer om A',
      more: {
        title: 'Mer om A',
        blocks: [
          { id: 'b1', kind: 'text', content: richText('Fordypning A.', 'Fordypning B.') },
          { id: 'b2', kind: 'image', asset: imageId, alt: 'Testbilde', caption: 'Bildetekst A' },
          {
            id: 'b3',
            kind: 'text',
            content: {
              paragraphs: [
                {
                  level: 0,
                  list: 'none',
                  runs: [{ text: 'Lenke A', link: 'https://example.org/' }],
                },
              ],
            },
          },
        ],
      },
      box: { x: 120, y: 780, w: 320, h: 76, rotation: 0 },
    },
  );
  content.timeline.push(
    { id: newId('t'), actions: [{ target: shapeId, effect: 'fade', duration: 0.4 }] },
    { id: newId('t'), actions: [{ target: tableId, effect: 'appear', duration: 0 }] },
  );
  content.script = 'Manus A.\nManus B.';

  const closing = newScene('closing', 'Avslutning');
  closing.elements.push({
    id: newId('e'),
    type: 'text',
    role: 'title',
    content: richText('Slutt'),
    align: 'left',
    valign: 'bottom',
    box: { x: 120, y: 220, w: 960, h: 360, rotation: 0 },
  });

  project.scenes.push(front, content, closing);
  return { project, media: [{ file: 'media/testbilde.png', data: png }] };
}

export function writeSampleProject(dir: string): Project {
  const { project, media } = sampleProject();
  mkdirSync(join(dir, 'media'), { recursive: true });
  for (const item of media) writeFileSync(join(dir, item.file), item.data);
  writeFileSync(join(dir, 'prosjekt.json'), JSON.stringify(project, null, 2), 'utf8');
  return project;
}
