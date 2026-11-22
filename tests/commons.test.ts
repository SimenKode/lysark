// Wikimedia Commons: which addresses the program may contact, how the
// search is asked, and how the answer is read. No network is used here.
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_HOSTS,
  COMMONS_DOWNLOAD_WIDTH,
  commonsFileUrl,
  commonsSearchUrl,
  downloadAddress,
  extensionForMime,
  isAllowedUrl,
  licenceKind,
  parseCommonsAnswer,
  pictureAddress,
  plainFromHtml,
} from '../src/main/commons';

const meta = (values: Record<string, string>): Record<string, { value: string }> =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }]));

function page(index: number, name: string, values: Record<string, string>, extra = {}): unknown {
  return {
    title: `File:${name}`,
    index,
    imageinfo: [
      {
        url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${name}`,
        thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${name}/330px-${name}`,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:${name}`,
        width: 4000,
        height: 3000,
        mime: 'image/jpeg',
        extmetadata: meta(values),
        ...extra,
      },
    ],
  };
}

describe('the allow-list', () => {
  it('names exactly the hosts the owner agreed to', () => {
    expect([...ALLOWED_HOSTS]).toEqual([
      'commons.wikimedia.org',
      'upload.wikimedia.org',
      'i.ytimg.com',
    ]);
  });

  it('accepts only those hosts, over https, without detours', () => {
    expect(isAllowedUrl('https://commons.wikimedia.org/w/api.php?action=query')).toBe(true);
    expect(isAllowedUrl('https://upload.wikimedia.org/a.jpg')).toBe(true);
    expect(isAllowedUrl('https://i.ytimg.com/vi/A/hqdefault.jpg')).toBe(true);
    for (const address of [
      'http://commons.wikimedia.org/',
      'https://en.wikipedia.org/',
      'https://commons.wikimedia.org.example.org/',
      'https://example.org/?u=https://commons.wikimedia.org/',
      'https://user:pass@commons.wikimedia.org/',
      'https://commons.wikimedia.org:8443/',
      'https://www.youtube.com/watch?v=A',
      'file:///etc/passwd',
      'ikke en adresse',
    ]) {
      expect(isAllowedUrl(address), address).toBe(false);
    }
  });
});

describe('the search request', () => {
  it('asks for files that are pictures, with licence and author, and sends only the search words', () => {
    const url = new URL(commonsSearchUrl('  A B  ', 24));
    expect(isAllowedUrl(url.toString())).toBe(true);
    expect(url.searchParams.get('gsrsearch')).toBe('A B filetype:bitmap|drawing');
    expect(url.searchParams.get('gsrnamespace')).toBe('6');
    expect(url.searchParams.get('gsroffset')).toBe('24');
    expect(url.searchParams.get('iiprop')).toBe('url|size|mime|extmetadata');
    expect([...url.searchParams.keys()].sort()).toEqual(
      [
        'action',
        'format',
        'formatversion',
        'generator',
        'gsrlimit',
        'gsrnamespace',
        'gsroffset',
        'gsrsearch',
        'iiextmetadatafilter',
        'iiextmetadatalanguage',
        'iiprop',
        'iiurlwidth',
        'prop',
      ].sort(),
    );
  });

  it('asks for one file at the width that is downloaded', () => {
    const url = new URL(commonsFileUrl('File:A.jpg', COMMONS_DOWNLOAD_WIDTH));
    expect(url.searchParams.get('titles')).toBe('File:A.jpg');
    expect(url.searchParams.get('iiurlwidth')).toBe('1920');
  });
});

describe('licences', () => {
  it('lets through public domain, CC0, CC BY and CC BY-SA, and nothing else', () => {
    expect(licenceKind('cc0', 'CC0')).toBe('free');
    expect(licenceKind('pd', 'Public domain')).toBe('free');
    expect(licenceKind('pd-old-70', 'Public domain')).toBe('free');
    expect(licenceKind('cc-by-4.0', 'CC BY 4.0')).toBe('attribution');
    expect(licenceKind('cc-by-sa-3.0', 'CC BY-SA 3.0')).toBe('attribution');
    expect(licenceKind('cc-by-sa-2.5-dk', 'CC BY-SA 2.5 dk')).toBe('attribution');
    expect(licenceKind('', 'CC BY-SA 4.0')).toBe('attribution');
    for (const [code, name] of [
      ['gfdl', 'GFDL'],
      ['cc-by-nc-4.0', 'CC BY-NC 4.0'],
      ['cc-by-nd-4.0', 'CC BY-ND 4.0'],
      ['cc-by-nc-sa-2.0', 'CC BY-NC-SA 2.0'],
      ['fal', 'FAL'],
      ['', ''],
      ['', 'Copyrighted free use'],
    ]) {
      expect(licenceKind(code!, name!), `${code} ${name}`).toBeUndefined();
    }
  });
});

describe('reading the answer', () => {
  it('keeps the usable hits in the order of the search, with what the credit must say', () => {
    const answer = {
      continue: { gsroffset: 24 },
      query: {
        pages: [
          page(3, 'C.jpg', { License: 'gfdl', LicenseShortName: 'GFDL' }),
          page(2, 'B.png', { License: 'cc0', LicenseShortName: 'CC0', ObjectName: 'Navn B' }),
          page(1, 'A_bilde.jpg', {
            License: 'cc-by-sa-4.0',
            LicenseShortName: 'CC BY-SA 4.0',
            LicenseUrl: 'http://creativecommons.org/licenses/by-sa/4.0',
            Artist:
              '<a href="//commons.wikimedia.org/wiki/User:A" title="User:A">Person&nbsp;A</a>',
            AttributionRequired: 'true',
          }),
        ],
      },
    };
    const { hits, next } = parseCommonsAnswer(answer);
    expect(next).toBe(24);
    expect(hits.map((h) => h.title)).toEqual(['File:A_bilde.jpg', 'File:B.png']);
    expect(hits[0]!.credit).toEqual({
      title: 'A bilde',
      author: 'Person A',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:A_bilde.jpg',
      required: true,
    });
    expect(hits[1]!.credit).toEqual({
      title: 'Navn B',
      license: 'CC0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:B.png',
      required: false,
    });
    expect(hits[0]!.width).toBe(4000);
  });

  it('drops hits whose pictures lie anywhere but on Wikimedia', () => {
    const answer = {
      query: {
        pages: [
          page(
            1,
            'A.jpg',
            { License: 'cc0', LicenseShortName: 'CC0' },
            { thumburl: 'https://example.org/a.jpg' },
          ),
          page(
            2,
            'B.jpg',
            { License: 'cc0', LicenseShortName: 'CC0' },
            { url: 'http://upload.wikimedia.org/b.jpg' },
          ),
        ],
      },
    };
    expect(parseCommonsAnswer(answer).hits).toEqual([]);
  });

  it('uses the approved host for scaled pictures and sends no tracking parameters', () => {
    // What Wikimedia answers today: scaled pictures on another host, with parameters added.
    const answer = {
      query: {
        pages: [
          page(
            1,
            'A.jpg',
            { License: 'cc0', LicenseShortName: 'CC0' },
            {
              url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/A.jpg?utm_source=commons.wikimedia.org&utm_content=original',
              thumburl:
                'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/A.jpg/330px-A.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo',
            },
          ),
        ],
      },
    };
    const hit = parseCommonsAnswer(answer).hits[0]!;
    expect(hit.thumbUrl).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/A.jpg/330px-A.jpg',
    );
    expect(hit.originalUrl).toBe('https://upload.wikimedia.org/wikipedia/commons/a/ab/A.jpg');
    expect(isAllowedUrl(hit.thumbUrl) && isAllowedUrl(hit.originalUrl)).toBe(true);
    expect(pictureAddress('https://thumb.example.org/a.jpg')).toBeUndefined();
  });

  it('survives answers that are empty or not what was expected', () => {
    for (const answer of [
      null,
      'feil',
      {},
      { query: {} },
      { query: { pages: [{}, { title: 'File:A' }] } },
    ]) {
      expect(parseCommonsAnswer(answer)).toEqual({ hits: [] });
    }
  });

  it('turns HTML into plain text', () => {
    expect(plainFromHtml('<b>A</b> &amp; <i>B</i><script>alert(1)</script>')).toBe('A & B');
    expect(plainFromHtml('&#65;&#x42;&quot;')).toBe('AB"');
    expect(plainFromHtml('x'.repeat(500))).toHaveLength(200);
  });
});

describe('what is downloaded', () => {
  const base = parseCommonsAnswer({
    query: { pages: [page(1, 'A.jpg', { License: 'cc0', LicenseShortName: 'CC0' })] },
  }).hits[0]!;

  it('takes the scaled picture of a large original, and a small original as it is', () => {
    expect(downloadAddress(base)).toBe(base.thumbUrl);
    expect(downloadAddress({ ...base, width: 1200 })).toBe(base.originalUrl);
    // Formats a browser cannot show are always fetched as the picture Commons makes of them.
    expect(downloadAddress({ ...base, width: 1200, mime: 'image/tiff' })).toBe(base.thumbUrl);
    expect(downloadAddress({ ...base, width: 800, mime: 'image/svg+xml' })).toBe(base.thumbUrl);
  });

  it('names the file after the type the server says it is', () => {
    expect(extensionForMime('image/jpeg')).toBe('.jpg');
    expect(extensionForMime('image/png; charset=binary')).toBe('.png');
    expect(extensionForMime('text/html')).toBeUndefined();
  });
});
