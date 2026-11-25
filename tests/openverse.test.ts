// Openverse: how the search is asked, and how the answer is read. No
// network is used here.
import { describe, expect, it } from 'vitest';
import { ALLOWED_HOSTS, isAllowedUrl } from '../src/main/commons';
import {
  OPENVERSE_HOST,
  isOpenverseId,
  isOpenversePicture,
  openverseDetailUrl,
  openverseLicence,
  openversePictureUrl,
  openverseSearchUrl,
  parseOpenverseAnswer,
  parseOpenverseHit,
} from '../src/main/openverse';

const ID_A = '00000000-0000-4000-8000-00000000000a';
const ID_B = '00000000-0000-4000-8000-00000000000b';

const item = (id: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  title: 'Bilde A',
  creator: 'Person A',
  license: 'by',
  license_version: '2.0',
  license_url: 'https://creativecommons.org/licenses/by/2.0/',
  foreign_landing_url: 'https://example.org/bilde/a',
  url: 'https://example.org/filer/a.jpg',
  thumbnail: `https://api.openverse.org/v1/images/${id}/thumb/`,
  mature: false,
  ...extra,
});

describe('what is asked of Openverse', () => {
  it('goes to one host, which is on the list of hosts the program may contact', () => {
    expect(ALLOWED_HOSTS).toContain(OPENVERSE_HOST);
    for (const address of [
      openverseSearchUrl('A B', 1),
      openverseDetailUrl(ID_A),
      openversePictureUrl(ID_A, false),
      openversePictureUrl(ID_A, true),
    ]) {
      expect(new URL(address).hostname).toBe('api.openverse.org');
      expect(isAllowedUrl(address)).toBe(true);
    }
  });

  it('sends the search words and asks only for licences that can be used', () => {
    const url = new URL(openverseSearchUrl('  A B  ', 3));
    expect(url.pathname).toBe('/v1/images/');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'A B',
      license: 'cc0,pdm,by,by-sa',
      page_size: '20',
      page: '3',
      excluded_source: 'wikimedia',
    });
    expect(new URL(openverseSearchUrl('A', 0)).searchParams.get('page')).toBe('1');
    expect(new URL(openverseSearchUrl('A'.repeat(500), 1)).searchParams.get('q')).toHaveLength(200);
  });

  it('builds the addresses of pictures from their id, and takes nothing else for one', () => {
    expect(openversePictureUrl(ID_A, false)).toBe(
      `https://api.openverse.org/v1/images/${ID_A}/thumb/`,
    );
    expect(openversePictureUrl(ID_A, true)).toBe(
      `https://api.openverse.org/v1/images/${ID_A}/thumb/?full_size=true`,
    );
    expect(isOpenversePicture(openversePictureUrl(ID_A, false))).toBe(true);
    expect(isOpenversePicture(openversePictureUrl(ID_A, true))).toBe(true);
    expect(isOpenversePicture(openverseDetailUrl(ID_A))).toBe(false);
    expect(isOpenversePicture(openverseSearchUrl('A', 1))).toBe(false);
    expect(isOpenversePicture(`https://api.openverse.org/v1/images/${ID_A}/thumb/?x=1`)).toBe(
      false,
    );
    expect(isOpenversePicture(`https://example.org/v1/images/${ID_A}/thumb/`)).toBe(false);
    expect(isOpenverseId('../../etc')).toBe(false);
    expect(isOpenverseId(`${ID_A}/`)).toBe(false);
    expect(() => openversePictureUrl('a/b', true)).toThrow();
    expect(() => openverseDetailUrl('')).toThrow();
  });
});

describe('what is read from the answer', () => {
  it('names the licences as they are written in a credit', () => {
    expect(openverseLicence('by', '2.0')).toEqual({ name: 'CC BY 2.0', required: true });
    expect(openverseLicence('by-sa', '4.0')).toEqual({ name: 'CC BY-SA 4.0', required: true });
    expect(openverseLicence('cc0', '1.0')).toEqual({ name: 'CC0 1.0', required: false });
    expect(openverseLicence('pdm', '1.0')).toEqual({ name: 'Public domain', required: false });
    expect(openverseLicence('BY', '')).toEqual({ name: 'CC BY', required: true });
    expect(openverseLicence('by', '<b>')).toEqual({ name: 'CC BY', required: true });
    for (const code of [
      'by-nc',
      'by-nd',
      'by-nc-sa',
      'by-nc-nd',
      'sampling+',
      'nc-sampling+',
      '',
    ]) {
      expect(openverseLicence(code, '4.0')).toBeUndefined();
    }
  });

  it('makes a credit with author, licence and the page the picture comes from', () => {
    const hit = parseOpenverseHit(item(ID_A))!;
    expect(hit).toEqual({
      id: ID_A,
      thumbUrl: `https://api.openverse.org/v1/images/${ID_A}/thumb/`,
      name: 'Bilde A',
      credit: {
        title: 'Bilde A',
        author: 'Person A',
        license: 'CC BY 2.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
        sourceUrl: 'https://example.org/bilde/a',
        required: true,
      },
    });
  });

  it('never takes the address of the small picture from the answer', () => {
    const hit = parseOpenverseHit(item(ID_A, { thumbnail: 'https://example.org/annet.jpg' }))!;
    expect(hit.thumbUrl).toBe(`https://api.openverse.org/v1/images/${ID_A}/thumb/`);
  });

  it('keeps text only, and leaves out addresses that are not plain web addresses', () => {
    const hit = parseOpenverseHit(
      item(ID_A, {
        title: '<b>Bilde</b> &amp; A',
        creator: '<a href="https://example.org">Person A</a>',
        license: 'cc0',
        license_version: '1.0',
        license_url: 'https://example.org/ikke-cc',
        foreign_landing_url: 'javascript:alert(1)',
      }),
    )!;
    expect(hit.credit).toEqual({
      title: 'Bilde & A',
      author: 'Person A',
      license: 'CC0 1.0',
      required: false,
    });
    const plain = parseOpenverseHit(
      item(ID_B, { title: null, creator: null, foreign_landing_url: 'http://example.org/b' }),
    )!;
    expect(plain.name).toBe('openverse-00000000');
    expect(plain.credit.title).toBeUndefined();
    expect(plain.credit.author).toBeUndefined();
    expect(plain.credit.sourceUrl).toBe('https://example.org/b');
  });

  it('leaves out what cannot be used, and says which page comes next', () => {
    const answer = parseOpenverseAnswer({
      result_count: 240,
      page_count: 12,
      page_size: 20,
      page: 2,
      results: [
        item(ID_A),
        item(ID_A), // the same picture twice is shown once
        item(ID_B, { license: 'by-nc' }),
        item('00000000-0000-4000-8000-00000000000c', { mature: true }),
        item('ikke-en-id'),
        null,
        'x',
      ],
    });
    expect(answer.hits.map((hit) => hit.id)).toEqual([ID_A]);
    expect(answer.next).toBe(3);
    expect(parseOpenverseAnswer({ page: 12, page_count: 12, results: [item(ID_B)] }).next).toBe(
      undefined,
    );
    expect(parseOpenverseAnswer(null)).toEqual({ hits: [] });
    expect(parseOpenverseAnswer({ detail: 'x' })).toEqual({ hits: [] });
  });
});
