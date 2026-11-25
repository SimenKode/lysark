// Writes small PDF files by hand for tests: a few pages with a line of
// text each, and optionally more lines of text, filled rectangles, links,
// and pictures in the formats pdf.js needs its own decoders for. The
// content is deliberately neutral ("A", "B").

/** Red, green and blue, each from 0 to 1. */
export type TestColor = [number, number, number];

/** A line of text at a place of its own. Places are in points from the page's lower left corner. */
export interface TestLine {
  text: string;
  /** Where the baseline starts. */
  x: number;
  y: number;
  size: number;
  /** Black when left out. */
  color?: TestColor;
  /**
   * Helvetica, Helvetica-Bold or Times-Italic, none of them embedded, or the
   * embedded font under a name that says it is bold (letters A to Z only).
   * Helvetica when left out.
   */
  font?: 'plain' | 'bold' | 'serif' | 'embedded-bold';
  /** Written without showing, as the text a scanner program lays over a scanned page. */
  invisible?: boolean;
}

export interface TestRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: TestColor;
}

/** A link over a rectangle: to an address, or to another page of the file (from 1). */
export interface TestLink {
  x: number;
  y: number;
  w: number;
  h: number;
  url?: string;
  page?: number;
}

export interface TestPage {
  /** Page size in points. */
  width: number;
  height: number;
  /** A line of text, set in the font the page names. Left out for a page without text. */
  text?: string;
  /** 'standard' names Helvetica without embedding it; 'embedded' carries the font file. */
  font?: 'standard' | 'embedded';
  /** Pictures drawn as 100 x 100 points, the first at (100, 100), the next to its right. */
  pictures?: Array<'jpeg2000' | 'ccitt' | 'jbig2'>;
  /** Degrees the page is turned when shown. */
  rotate?: 0 | 90 | 180 | 270;
  /** Filled rectangles, drawn first. */
  rects?: TestRect[];
  /** More lines of text, drawn after `text`. */
  lines?: TestLine[];
  /** Rectangles drawn after everything else, on top of text and pictures. */
  cover?: TestRect[];
  links?: TestLink[];
}

export interface TestPdf {
  title?: string;
  pages: TestPage[];
  /** A TrueType font file to embed for pages that ask for 'embedded'. */
  fontFile?: Uint8Array;
  /** Marks the file as protected with a password nobody knows, so that it cannot be opened. */
  encrypted?: boolean;
}

/** A 16 x 16 JPEG 2000 picture: left half purple (120, 0, 240), right half orange (255, 98, 2). */
const JPEG2000 = Buffer.from(
  'AAAADGpQICANCocKAAAAFGZ0eXBqcDIgAAAAAGpwMiAAAAAtanAyaAAAABZpaGRyAAAAEAAAABAAAwcHAAAAAAAPY29scgEAAAAAABAA' +
    'AAESanAyY/9P/1EALwAAAAAAEAAAABAAAAAAAAAAAAAAABAAAAAQAAAAAAAAAAAAAwcBAQcBAQcBAf9SAAwAAAABAAQEBAAB/1wAEEBA' +
    'SEhQSEhQSEhQSEhQ/2QAJQABQ3JlYXRlZCBieSBPcGVuSlBFRyB2ZXJzaW9uIDIuNS4w/5AACgAAAAAAjgAB/5PD5wQDH8+0CAg/x9QE' +
    'AI/H2gIAAMfaBAADP8/ACAl5x9oKAAjxRyEPw+oEAAjwmyjH2gwAAVtKyllfx9oQABcsqIgpUkQfw+oHABcryDzpX8fPwCQX2LCA84wd' +
    '99HH2hAAIW4NJp+MA9XD6gcAIW4Hrga2A8faEAAiGgnxDvigP//Z',
  'base64',
);

/** A 32 x 32 one-bit picture, CCITT group 4: left half white, right half black. */
const CCITT = Buffer.from('NQL//////////4AIAIA=', 'base64');

/**
 * The same 32 x 32 picture as a JBIG2 stream the way a PDF carries it: a
 * page information segment and one generic region, coded like the CCITT one.
 */
const JBIG2 = Buffer.from(
  'AAAAADAAAQAAABMAAAAgAAAAIAAAAAAAAAAAAAAAAAAAASYAAQAAACAAAAAgAAAAIAAAAAAAAAAAAAE1Av//////////gAgAgA==',
  'base64',
);

const PICTURE_NAMES = { jpeg2000: 'Im1', ccitt: 'Im2', jbig2: 'Im3' } as const;

function pdfString(text: string): string {
  return `(${text.replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

export function buildPdf(spec: TestPdf): Uint8Array {
  const objects: Buffer[] = [];
  /** Adds an object and returns its number. */
  const add = (dict: string, stream?: Uint8Array): number => {
    const head = Buffer.from(
      stream ? `<< ${dict} /Length ${stream.byteLength} >>\nstream\n` : `<< ${dict} >>`,
      'latin1',
    );
    objects.push(
      stream ? Buffer.concat([head, Buffer.from(stream), Buffer.from('\nendstream')]) : head,
    );
    return objects.length;
  };
  /** Reserves a number for an object that is written later. */
  const reserve = (): number => {
    objects.push(Buffer.alloc(0));
    return objects.length;
  };

  const catalog = reserve();
  const pages = reserve();
  const standardFont = add(
    '/Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding',
  );
  const boldFont = add(
    '/Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding',
  );
  const serifFont = add(
    '/Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding',
  );
  let embeddedFont = 0;
  let embeddedBold = 0;
  if (spec.fontFile) {
    const file = add(`/Length1 ${spec.fontFile.byteLength}`, spec.fontFile);
    const descriptor = add(
      '/Type /FontDescriptor /FontName /TestSans /Flags 32 /FontBBox [-544 -303 1302 980] ' +
        `/ItalicAngle 0 /Ascent 905 /Descent -212 /CapHeight 729 /StemV 80 /FontFile2 ${file} 0 R`,
    );
    // Widths for the letters A to Z only; the tests write nothing else in this font.
    const widths = Array.from({ length: 26 }, () => 667).join(' ');
    embeddedFont = add(
      '/Type /Font /Subtype /TrueType /BaseFont /TestSans /Encoding /WinAnsiEncoding ' +
        `/FirstChar 65 /LastChar 90 /Widths [${widths}] /FontDescriptor ${descriptor} 0 R`,
    );
    // The same font file under a bold name: an embedded font says it is bold only by its name.
    const boldDescriptor = add(
      '/Type /FontDescriptor /FontName /TestSans-Bold /Flags 32 /FontBBox [-544 -303 1302 980] ' +
        `/ItalicAngle 0 /Ascent 905 /Descent -212 /CapHeight 729 /StemV 80 /FontFile2 ${file} 0 R`,
    );
    embeddedBold = add(
      '/Type /Font /Subtype /TrueType /BaseFont /TestSans-Bold /Encoding /WinAnsiEncoding ' +
        `/FirstChar 65 /LastChar 90 /Widths [${widths}] /FontDescriptor ${boldDescriptor} 0 R`,
    );
  }
  const jpeg2000 = add(
    '/Type /XObject /Subtype /Image /Width 16 /Height 16 /ColorSpace /DeviceRGB ' +
      '/BitsPerComponent 8 /Filter /JPXDecode',
    JPEG2000,
  );
  const ccitt = add(
    '/Type /XObject /Subtype /Image /Width 32 /Height 32 /ColorSpace /DeviceGray ' +
      '/BitsPerComponent 1 /Filter /CCITTFaxDecode /DecodeParms << /K -1 /Columns 32 /Rows 32 >>',
    CCITT,
  );
  const jbig2 = add(
    '/Type /XObject /Subtype /Image /Width 32 /Height 32 /ColorSpace /DeviceGray ' +
      '/BitsPerComponent 1 /Filter /JBIG2Decode',
    JBIG2,
  );

  const kids: number[] = [];
  /** Links to other pages are written when every page has its number. */
  const pageLinks: Array<{ object: number; link: TestLink }> = [];
  const fill = (rect: TestRect): string =>
    `${rect.color.join(' ')} rg ${rect.x} ${rect.y} ${rect.w} ${rect.h} re f\n`;
  const place = (link: TestLink): string =>
    `/Type /Annot /Subtype /Link /Border [0 0 0] /Rect [${link.x} ${link.y} ${link.x + link.w} ${link.y + link.h}]`;
  const FONT_NAMES = { plain: 'F2', bold: 'F3', serif: 'F4', 'embedded-bold': 'F5' } as const;
  for (const page of spec.pages) {
    const font = page.font === 'embedded' && embeddedFont ? embeddedFont : standardFont;
    let content = '';
    for (const rect of page.rects ?? []) content += fill(rect);
    if (page.rects?.length) content += '0 0 0 rg\n';
    if (page.text !== undefined) {
      content += `BT /F1 96 Tf 72 ${page.height - 160} Td ${pdfString(page.text)} Tj ET\n`;
    }
    for (const line of page.lines ?? []) {
      content +=
        `BT ${(line.color ?? [0, 0, 0]).join(' ')} rg ${line.invisible ? '3' : '0'} Tr ` +
        `/${FONT_NAMES[line.font ?? 'plain']} ${line.size} Tf ${line.x} ${line.y} Td ` +
        `${pdfString(line.text)} Tj ET\n`;
    }
    (page.pictures ?? []).forEach((kind, index) => {
      content += `q 100 0 0 100 ${100 + index * 120} 100 cm /${PICTURE_NAMES[kind]} Do Q\n`;
    });
    for (const rect of page.cover ?? []) content += fill(rect);
    const stream = add('', Buffer.from(content, 'latin1'));
    const annotations: number[] = [];
    for (const link of page.links ?? []) {
      if (link.url !== undefined) {
        annotations.push(add(`${place(link)} /A << /S /URI /URI ${pdfString(link.url)} >>`));
      } else {
        const object = reserve();
        annotations.push(object);
        pageLinks.push({ object, link });
      }
    }
    kids.push(
      add(
        `/Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${page.width} ${page.height}] ` +
          `${page.rotate ? `/Rotate ${page.rotate} ` : ''}` +
          `${annotations.length ? `/Annots [${annotations.map((a) => `${a} 0 R`).join(' ')}] ` : ''}` +
          `/Resources << /Font << /F1 ${font} 0 R /F2 ${standardFont} 0 R /F3 ${boldFont} 0 R /F4 ${serifFont} 0 R /F5 ${embeddedBold || boldFont} 0 R >> ` +
          `/XObject << /Im1 ${jpeg2000} 0 R /Im2 ${ccitt} 0 R /Im3 ${jbig2} 0 R >> >> ` +
          `/Contents ${stream} 0 R`,
      ),
    );
  }
  for (const { object, link } of pageLinks) {
    const target = kids[(link.page ?? 1) - 1] ?? kids[0]!;
    objects[object - 1] = Buffer.from(`<< ${place(link)} /Dest [${target} 0 R /Fit] >>`, 'latin1');
  }
  objects[catalog - 1] = Buffer.from(`<< /Type /Catalog /Pages ${pages} 0 R >>`);
  objects[pages - 1] = Buffer.from(
    `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`,
  );
  const info = spec.title === undefined ? 0 : add(`/Title ${pdfString(spec.title)}`);
  // The two keys are arbitrary, so no password fits, not even the empty one.
  const encrypt = spec.encrypted
    ? add(`/Filter /Standard /V 1 /R 2 /O <${'01'.repeat(32)}> /U <${'02'.repeat(32)}> /P -4`)
    : 0;

  const parts: Buffer[] = [Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let offset = parts[0]!.byteLength;
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    const object = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`),
      body,
      Buffer.from('\nendobj\n'),
    ]);
    offsets.push(offset);
    offset += object.byteLength;
    parts.push(object);
  });
  const xref =
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R` +
    `${info ? ` /Info ${info} 0 R` : ''}` +
    `${encrypt ? ` /Encrypt ${encrypt} 0 R /ID [<${'03'.repeat(16)}> <${'03'.repeat(16)}>]` : ''}` +
    ` >>\nstartxref\n${offset}\n%%EOF\n`;
  parts.push(Buffer.from(xref + trailer, 'latin1'));
  return new Uint8Array(Buffer.concat(parts));
}
